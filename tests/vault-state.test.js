/* Ejecutable desde CUALQUIER directorio de trabajo:
   node tests/vault-state.test.js
   node vault-state.test.js   (estando ya dentro de tests/)
   No requiere mover ningún archivo (P0.3 #1: usa __dirname, no
   rutas relativas '../' frágiles frente al cwd). */
'use strict';
var path = require('path');

var mem = {};
globalThis.localStorage = {
  getItem: function (k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
  setItem: function (k, v) { mem[k] = String(v); },
  removeItem: function (k) { delete mem[k]; }
};
function reset() { mem = {}; }

var vs = require(path.join(__dirname, '..', 'vault-state.js'));
var pass = 0, fail = 0;
function t(name, cond) {
  if (cond) { pass++; console.log('  \u2714 ' + name); }
  else { fail++; console.log('  \u2718 FALLO: ' + name); }
}

function b64(bytes) { return Buffer.from(bytes).toString('base64'); }
var IV12 = b64(new Uint8Array(12));
var SALT16 = b64(new Uint8Array(16));
var SALT_BAD_LEN = b64(new Uint8Array(10)); /* #14: NO son 16 bytes */

function validV1() {
  reset();
  localStorage.setItem('vk_meta_v1', JSON.stringify({ hash: 'abc' }));
  localStorage.setItem('vk_data_v1', JSON.stringify({ salt: SALT16, iv: IV12, ct: b64([1, 2, 3]) }));
}

/* #13: blob "canónico" con todos los campos exactos que ahora se exigen */
function blobObj(overrides) {
  var base = {
    app: 'VaultKey',
    schemaVersion: 2,
    cryptoVersion: 1,
    kdf: { algo: 'PBKDF2-SHA256', iterMaster: 2000000, iterKit: 2000000, saltMaster: SALT16, saltKit: SALT16 },
    wraps: { master: { iv: IV12, ct: b64([1, 2]) }, kit: { iv: IV12, ct: b64([3, 4]) } },
    vault: { iv: IV12, ct: b64([5, 6]) }
  };
  return Object.assign({}, base, overrides);
}
function pinWrapObj(overrides) {
  return Object.assign({ saltPin: SALT16, iterPin: 300000, iv: IV12, ct: b64([7, 8]) }, overrides);
}
function validVK2(withPin) {
  reset();
  localStorage.setItem('vk2_blob', JSON.stringify(blobObj()));
  localStorage.setItem('vk2_meta', JSON.stringify({ onboardingDone: true }));
  if (withPin) { localStorage.setItem('vk2_pinwrap', JSON.stringify(pinWrapObj())); }
}

(async function () {
  console.log('== readRawDetailed ==');
  reset();
  t('missing', vs.readRawDetailed('nope').status === 'missing');
  localStorage.setItem('k1', '{"a":1}');
  t('valid', vs.readRawDetailed('k1').status === 'valid');
  localStorage.setItem('k2', '{not json');
  t('corrupt', vs.readRawDetailed('k2').status === 'corrupt');
  var badLs = { getItem: function () { throw new Error('boom'); } };
  t('storage_error', vs.readRawDetailed('k3', badLs).status === 'storage_error');

  console.log('== base64 estricta / bytes UTF-8 (heredado, sigue verificado) ==');
  t('base64 válida', vs._internal.isStrictBase64('QUJD') === true);
  t('base64 inválida rechazada', vs._internal.isStrictBase64('QUJD!!') === false);
  t('utf8ByteLength cuenta bytes reales, no code units', vs._internal.utf8ByteLength('😀') === 4 && '😀'.length === 2);

  console.log('== #14: salt EXACTO de 16 bytes ==');
  t('SALT16 (16 bytes) es válido como salt', vs._internal.isValidSaltField(SALT16) === true);
  t('SALT_BAD_LEN (10 bytes) NO es válido como salt', vs._internal.isValidSaltField(SALT_BAD_LEN) === false);

  validVK2(true);
  var okBlob = vs.detectVaultStateSync();
  t('VK2_READY con salts de 16 bytes exactos', okBlob.state === 'VK2_READY');

  reset();
  localStorage.setItem('vk2_blob', JSON.stringify(blobObj({ kdf: Object.assign({}, blobObj().kdf, { saltMaster: SALT_BAD_LEN }) })));
  localStorage.setItem('vk2_meta', JSON.stringify({ onboardingDone: true }));
  localStorage.setItem('vk2_pinwrap', JSON.stringify(pinWrapObj()));
  var badSaltBlob = vs.detectVaultStateSync();
  t('VK2_CORRUPT si saltMaster no mide 16 bytes exactos', badSaltBlob.state === 'VK2_CORRUPT');

  reset();
  localStorage.setItem('vk2_blob', JSON.stringify(blobObj()));
  localStorage.setItem('vk2_meta', JSON.stringify({ onboardingDone: true }));
  localStorage.setItem('vk2_pinwrap', JSON.stringify(pinWrapObj({ saltPin: SALT_BAD_LEN })));
  var badPinSalt = vs.detectVaultStateSync();
  t('VK2_CORRUPT si saltPin no mide 16 bytes exactos', badPinSalt.state === 'VK2_CORRUPT');

  console.log('== #14: iterPin exigido explícitamente (sin default oculto) ==');
  reset();
  localStorage.setItem('vk2_blob', JSON.stringify(blobObj()));
  localStorage.setItem('vk2_meta', JSON.stringify({ onboardingDone: true }));
  var pwSinIter = pinWrapObj(); delete pwSinIter.iterPin;
  localStorage.setItem('vk2_pinwrap', JSON.stringify(pwSinIter));
  var noIterPin = vs.detectVaultStateSync();
  t('VK2_CORRUPT si iterPin falta (ya no se asume 300000 por defecto)', noIterPin.state === 'VK2_CORRUPT');

  reset();
  localStorage.setItem('vk2_blob', JSON.stringify(blobObj()));
  localStorage.setItem('vk2_meta', JSON.stringify({ onboardingDone: true }));
  localStorage.setItem('vk2_pinwrap', JSON.stringify(pinWrapObj({ iterPin: -5 })));
  var badIterPin = vs.detectVaultStateSync();
  t('VK2_CORRUPT si iterPin es negativo', badIterPin.state === 'VK2_CORRUPT');

  console.log('== #13: app / schemaVersion / cryptoVersion / kdf.algo exactos ==');
  reset();
  localStorage.setItem('vk2_blob', JSON.stringify(blobObj({ app: 'OtraApp' })));
  localStorage.setItem('vk2_meta', JSON.stringify({ onboardingDone: true }));
  localStorage.setItem('vk2_pinwrap', JSON.stringify(pinWrapObj()));
  t('VK2_CORRUPT si app !== "VaultKey"', vs.detectVaultStateSync().state === 'VK2_CORRUPT');

  reset();
  localStorage.setItem('vk2_blob', JSON.stringify(blobObj({ kdf: Object.assign({}, blobObj().kdf, { algo: 'MD5' }) })));
  localStorage.setItem('vk2_meta', JSON.stringify({ onboardingDone: true }));
  localStorage.setItem('vk2_pinwrap', JSON.stringify(pinWrapObj()));
  t('VK2_CORRUPT si kdf.algo !== "PBKDF2-SHA256"', vs.detectVaultStateSync().state === 'VK2_CORRUPT');

  reset();
  localStorage.setItem('vk2_blob', JSON.stringify(blobObj({ schemaVersion: 1 })));
  localStorage.setItem('vk2_meta', JSON.stringify({ onboardingDone: true }));
  localStorage.setItem('vk2_pinwrap', JSON.stringify(pinWrapObj()));
  t('VK2_CORRUPT si schemaVersion !== 2 exacto (no "menor o igual")', vs.detectVaultStateSync().state === 'VK2_CORRUPT');

  reset();
  localStorage.setItem('vk2_blob', JSON.stringify(blobObj({ schemaVersion: 99 })));
  localStorage.setItem('vk2_meta', JSON.stringify({ onboardingDone: true }));
  t('UNSUPPORTED_VERSION sigue distinguiéndose de CORRUPT (versión futura)', vs.detectVaultStateSync().state === 'UNSUPPORTED_VERSION');

  console.log('== #12: VK2 sin pin-wrap SIEMPRE es INCOMPLETE (sin excepción) ==');
  validVK2(false);
  var r8 = vs.detectVaultStateSync();
  t('VK2_INCOMPLETE sin pin-wrap', r8.state === 'VK2_INCOMPLETE' && r8.vk2.warnings.indexOf('VK2_BLOB_WITHOUT_PINWRAP') !== -1);

  reset();
  localStorage.setItem('vk2_blob', JSON.stringify(blobObj()));
  localStorage.setItem('vk2_meta', JSON.stringify({ onboardingDone: true, pinlessModeConfirmed: true }));
  var rNoException = vs.detectVaultStateSync();
  t('#12: ya NO existe ninguna excepción por campo de meta; sigue INCOMPLETE aunque se intente forzar', rNoException.state === 'VK2_INCOMPLETE');
  t('#12: la API pública ya no expone NO_PIN_MODE_FIELD', vs.NO_PIN_MODE_FIELD === undefined);

  console.log('== detección V1 (sin cambios funcionales, verificación de no-regresión) ==');
  reset();
  t('EMPTY sin nada', vs.detectVaultStateSync().state === 'EMPTY');
  validV1();
  t('V1_READY con meta+data válidos', vs.detectVaultStateSync().state === 'V1_READY');

  console.log('== #4 (heredado de P0.2, sigue verificado): pepper missing degrada el estado ==');
  validVK2(true);
  var rMissingPepper = await vs.detectVaultState({ cryptoApi: { pepperExists: function () { return Promise.resolve(false); } } });
  t('pepper missing -> VK2_INCOMPLETE (no solo warning)', rMissingPepper.state === 'VK2_INCOMPLETE' && rMissingPepper.activeFormat === null);

  console.log('\n' + pass + ' OK, ' + fail + ' FALLOS');
  process.exit(fail > 0 ? 1 : 0);
})();
