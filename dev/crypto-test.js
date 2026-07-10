/* ============================================================
   VaultKey 2.0 — dev/crypto-test.js
   Batería de la 2.2. Ejecutar: node dev/crypto-test.js
   HERRAMIENTA INTERNA — vectores fijos SOLO aquí, jamás en prod.
   Nota: el ciclo IndexedDB del pepper (getOrCreatePepper/deletePepper
   persistente) se valida en navegador en el arnés de la 2.3; aquí
   se prueba su SEMÁNTICA con peppers importados en memoria.
   ============================================================ */
'use strict';
var vk = require('../vault-crypto.js');
var pass = 0, fail = 0, t0 = Date.now();
function t(name, cond) {
  if (cond) { pass++; console.log('  ✔ ' + name); }
  else { fail++; console.log('  ✘ FALLO: ' + name); }
}
function fails(p) { return p.then(function(){return false;}, function(){return true;}); }

(async function () {
  var MASTER = 'master-de-prueba-larga-y-unica-2026';
  var PAYLOAD = JSON.stringify({ app:'VaultKey', schemaVersion:2, entries:[{ id:'t1', type:'note', title:'Nota', fav:false, tags:[], createdAt:1, updatedAt:1, body:'hola' }] });

  console.log('== kit code ==');
  var kit = vk.generateKitCode();
  t('formato VK2-XXXXX-XXXXX-XXXXX-XXXXX-XXXXXX', /^VK2-[0-9A-HJKMNP-TV-Z]{5}(-[0-9A-HJKMNP-TV-Z]{5}){3}-[0-9A-HJKMNP-TV-Z]{6}$/.test(kit));
  t('sin caracteres ambiguos I/L/O/U', !/[ILOU]/.test(kit));
  var many = {}; for (var i=0;i<50;i++){ many[vk.generateKitCode()]=1; }
  t('50 códigos únicos', Object.keys(many).length === 50);
  t('normaliza minúsculas y guiones', vk.normalizeKitCode(kit.toLowerCase()) === vk.normalizeKitCode(kit));

  console.log('== alta y apertura por las 3 rutas ==');
  console.log('  (derivaciones a 2M iteraciones: tarda unos segundos)');
  var alta = await vk.createVaultBlob({ master: MASTER, kitCode: kit, payloadStr: PAYLOAD });
  var blob = alta.blob;
  t('blob v2: campos del contrato', blob.app==='VaultKey' && blob.schemaVersion===2 && blob.cryptoVersion===1 && blob.kdf.algo==='PBKDF2-SHA256' && blob.kdf.iterMaster===2000000 && blob.kdf.iterPin===300000);
  var s = JSON.stringify(blob);
  t('pin-wrap NO aparece en el blob exportable', s.indexOf('pinWrap')===-1 && s.indexOf('saltPin')===-1 && s.indexOf('pin')===-1);
  t('DEK de sesión no extraíble', alta.dekKey.extractable === false);

  var byMaster = await vk.openVaultBlob(blob, { master: MASTER });
  t('abre por master y recupera payload', byMaster.payloadStr === PAYLOAD);
  var byKit = await vk.openVaultBlob(blob, { kitCode: kit });
  t('abre por kit (recuperación real sin master)', byKit.payloadStr === PAYLOAD);
  t('abre por kit tecleado en minúsculas', (await vk.openVaultBlob(blob, { kitCode: kit.toLowerCase() })).payloadStr === PAYLOAD);

  console.log('== pin-wrap con pepper A+ ==');
  var pepperRaw = new Uint8Array(32).fill(7); /* vector fijo SOLO en test */
  var pepper = await vk.importPepperKey(pepperRaw);
  var dekRaw = vk.generateDEKBytes();
  var dekKey = await vk.importDEK(dekRaw);
  var vaultCt = await vk.encryptVault(dekKey, PAYLOAD);
  var pinWrap = await vk.createPinWrap(dekRaw, '482913', pepper);
  var dekFromPin = await vk.openPinWrap(pinWrap, '482913', pepper);
  t('PIN correcto + pepper correcto abre', (await vk.decryptVault(dekFromPin, vaultCt)) === PAYLOAD);
  t('DEK desde pin-wrap no extraíble', dekFromPin.extractable === false);
  t('PIN erróneo falla', await fails(vk.openPinWrap(pinWrap, '000000', pepper)));
  var otherPepper = await vk.importPepperKey(new Uint8Array(32).fill(9));
  t('pepper distinto falla (semántica del borrado A+: sin el pepper original el pin-wrap es inservible)', await fails(vk.openPinWrap(pinWrap, '482913', otherPepper)));
  t('createPinWrap exige bytes crudos (no CryptoKey)', await fails(vk.createPinWrap(dekKey, '482913', pepper)));

  console.log('== credenciales erróneas y manipulación ==');
  t('master errónea falla', await fails(vk.openVaultBlob(blob, { master: 'otra' })));
  t('kit erróneo falla', await fails(vk.openVaultBlob(blob, { kitCode: vk.generateKitCode() })));
  var tampered = JSON.parse(JSON.stringify(blob));
  var ctb = Buffer.from(tampered.vault.ct, 'base64'); ctb[5] ^= 0xff;
  tampered.vault.ct = ctb.toString('base64');
  t('blob manipulado muere en el tag GCM', await fails(vk.openVaultBlob(tampered, { master: MASTER })));
  var vBad = JSON.parse(JSON.stringify(blob)); vBad.cryptoVersion = 99;
  t('cryptoVersion desconocida rechazada', await fails(vk.openVaultBlob(vBad, { master: MASTER })));

  console.log('== rotaciones (re-wrap sin re-cifrar) ==');
  var NUEVA = 'nueva-master-todavia-mas-larga-2026';
  var rotado = await vk.rotateMaster(blob, MASTER, NUEVA);
  t('nueva master abre', (await vk.openVaultBlob(rotado, { master: NUEVA })).payloadStr === PAYLOAD);
  t('master antigua ya no abre', await fails(vk.openVaultBlob(rotado, { master: MASTER })));
  t('el kit sobrevive al cambio de master', (await vk.openVaultBlob(rotado, { kitCode: kit })).payloadStr === PAYLOAD);
  t('vault.ct intacto (no se re-cifró)', rotado.vault.ct === blob.vault.ct);

  var reg = await vk.regenerateKit(rotado, NUEVA);
  t('kit nuevo abre', (await vk.openVaultBlob(reg.blob, { kitCode: reg.kitCode })).payloadStr === PAYLOAD);
  t('kit anterior revocado', await fails(vk.openVaultBlob(reg.blob, { kitCode: kit })));
  t('la master sobrevive a la regeneración del kit', (await vk.openVaultBlob(reg.blob, { master: NUEVA })).payloadStr === PAYLOAD);

  console.log('');
  console.log('Resultado: ' + pass + ' correctas, ' + fail + ' fallos · ' + ((Date.now()-t0)/1000).toFixed(1) + ' s');
  process.exit(fail === 0 ? 0 : 1);
})().catch(function (e) { console.error('ERROR FATAL:', e); process.exit(1); });
