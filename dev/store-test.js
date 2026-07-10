/* ============================================================
   VaultKey 2.0 — dev/store-test.js
   Batería de la 2.3. Ejecutar: node dev/store-test.js
   Shim mínimo de localStorage + spy de vkCrypto.deletePepper.
   El ciclo real de IndexedDB se valida en dev/pepper-test.html.
   ============================================================ */
'use strict';

/* Shim localStorage */
var mem = {};
globalThis.localStorage = {
  getItem: function (k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
  setItem: function (k, v) { mem[k] = String(v); },
  removeItem: function (k) { delete mem[k]; }
};
/* Spy de deletePepper */
var pepperDeleted = 0;
globalThis.vkCrypto = { deletePepper: function () { pepperDeleted++; return Promise.resolve(true); } };

var st = require('../vault-store.js');
var pass = 0, fail = 0;
function t(name, cond) {
  if (cond) { pass++; console.log('  ✔ ' + name); }
  else { fail++; console.log('  ✘ FALLO: ' + name); }
}

(async function () {
  console.log('== round-trip y has* ==');
  t('hasVault false en limpio', st.hasVault() === false);
  t('hasPinWrap false en limpio', st.hasPinWrap() === false);
  var blob = { app: 'VaultKey', schemaVersion: 2, cryptoVersion: 1, vault: { iv: 'a', ct: 'b' } };
  st.saveBlob(blob);
  t('round-trip blob', JSON.stringify(st.loadBlob()) === JSON.stringify(blob));
  t('hasVault true', st.hasVault() === true);
  var pw = { saltPin: 's', iterPin: 300000, iv: 'i', ct: 'c' };
  st.savePinWrap(pw);
  t('round-trip pinwrap', JSON.stringify(st.loadPinWrap()) === JSON.stringify(pw));
  t('hasPinWrap true', st.hasPinWrap() === true);

  console.log('== meta ==');
  var m = st.getMeta();
  t('meta con defaults', m.failedAttempts === 0 && m.autolockOption === 'immediate' && m.onboardingDone === false);
  st.setMeta({ autolockOption: '1m', onboardingDone: true });
  t('setMeta persiste', st.getMeta().autolockOption === '1m' && st.getMeta().onboardingDone === true);
  st.setMeta({ autolockOption: 'inventada' });
  t('autolockOption inválida cae a immediate', st.getMeta().autolockOption === 'immediate');
  st.setMeta({ claveAjena: 'x' });
  t('setMeta ignora claves fuera del esquema', !('claveAjena' in st.getMeta()));

  console.log('== contador de intentos ==');
  var r;
  for (var i = 1; i <= 9; i++) { r = st.recordFailedAttempt(); }
  t('intentos 1→9 sin mustWipe', r.attempts === 9 && r.remaining === 1 && r.mustWipe === false);
  r = st.recordFailedAttempt();
  t('intento 10: mustWipe true, remaining 0', r.attempts === 10 && r.remaining === 0 && r.mustWipe === true);
  t('recordFailedAttempt NO ejecutó wipe (blob sigue)', st.hasVault() === true && pepperDeleted === 0);
  st.resetAttempts();
  t('resetAttempts a cero', st.getMeta().failedAttempts === 0 && st.getMeta().lockUntil === 0);

  console.log('== corrupción tolerada ==');
  localStorage.setItem('vk2_blob', '{{{corrupto');
  t('blob corrupto → null sin lanzar', st.loadBlob() === null && st.hasVault() === false);
  localStorage.setItem('vk2_meta', 'no-json');
  t('meta corrupta → defaults sin lanzar', st.getMeta().failedAttempts === 0);
  st.saveBlob(blob); /* restaurar para el wipe */

  console.log('== wipeLocal: lista cerrada ==');
  localStorage.setItem('vk_data_v1', 'SEÑUELO-1X');
  localStorage.setItem('vk_meta_v1', 'SEÑUELO-1X');
  localStorage.setItem('ajena_app', 'SEÑUELO-AJENA');
  var res = await st.wipeLocal();
  t('borra vk2_blob/vk2_pinwrap/vk2_meta', st.loadBlob() === null && st.loadPinWrap() === null && localStorage.getItem('vk2_meta') === null);
  t('reporta lo borrado incluyendo pepper', res.deleted.indexOf('vk2_blob') !== -1 && res.deleted.indexOf('device-pepper') !== -1);
  t('spy: deletePepper llamado exactamente 1 vez', pepperDeleted === 1);
  t('claves señuelo 1.x intactas', localStorage.getItem('vk_data_v1') === 'SEÑUELO-1X' && localStorage.getItem('vk_meta_v1') === 'SEÑUELO-1X');
  t('clave ajena intacta', localStorage.getItem('ajena_app') === 'SEÑUELO-AJENA');
  var res2 = await st.wipeLocal();
  t('wipe idempotente (segunda pasada no rompe)', res2.deleted.indexOf('vk2_blob') === -1);

  console.log('');
  console.log('Resultado: ' + pass + ' correctas, ' + fail + ' fallos');
  process.exit(fail === 0 ? 0 : 1);
})().catch(function (e) { console.error('ERROR FATAL:', e); process.exit(1); });
