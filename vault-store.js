/* ============================================================
   VaultKey 2.0 — vault-store.js
   Persistencia y estado local (Módulo 2 · tarea 2.3)
   CONTRATO: 2.1 v1.0 §5 (D-3, Opción A+) + plan 2.3 aprobado.

   REGLAS: sin criptografía (eso es vault-crypto.js); sin app.js;
   lista CERRADA de claves vk2_; wipeLocal borra EXACTAMENTE esa
   lista y el pepper (vkCrypto.deletePepper); jamás claves 1.x
   ni ajenas; JSON corrupto devuelve null sin lanzar.
   ============================================================ */

(function (root, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  if (root) { root.vkStore = api; }
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';

  var K_BLOB = 'vk2_blob';
  var K_PINWRAP = 'vk2_pinwrap';
  var K_META = 'vk2_meta';
  var CLOSED_LIST = [K_BLOB, K_PINWRAP, K_META];

  var MAX_ATTEMPTS = 10; /* congelado: fijo, no configurable */
  var AUTOLOCK_OPTIONS = ['immediate', '30s', '1m', '5m'];

  var DEFAULT_META = {
    failedAttempts: 0,
    lockUntil: 0,
    autolockOption: 'immediate',
    onboardingDone: false
  };

  /* Inyectables para pruebas: por defecto, los reales del entorno */
  function ls() { return (root && root.localStorage) || globalThis.localStorage; }
  function cryptoApi() { return (root && root.vkCrypto) || globalThis.vkCrypto; }

  function readJSON(key) {
    var raw;
    try { raw = ls().getItem(key); } catch (e) { return null; }
    if (raw === null || raw === undefined) { return null; }
    try { return JSON.parse(raw); } catch (e) { return null; } /* corrupto → null */
  }
  function writeJSON(key, value) {
    ls().setItem(key, JSON.stringify(value));
  }

  /* ---- Blob ---- */
  function saveBlob(blob) { writeJSON(K_BLOB, blob); }
  function loadBlob() { return readJSON(K_BLOB); }
  function hasVault() { return loadBlob() !== null; }

  /* ---- Pin-wrap (local; JAMÁS dentro del blob) ---- */
  function savePinWrap(pw) { writeJSON(K_PINWRAP, pw); }
  function loadPinWrap() { return readJSON(K_PINWRAP); }
  function hasPinWrap() { return loadPinWrap() !== null; }

  /* ---- Meta ---- */
  function getMeta() {
    var m = readJSON(K_META);
    var out = {};
    for (var k in DEFAULT_META) {
      out[k] = (m && Object.prototype.hasOwnProperty.call(m, k)) ? m[k] : DEFAULT_META[k];
    }
    if (AUTOLOCK_OPTIONS.indexOf(out.autolockOption) === -1) {
      out.autolockOption = DEFAULT_META.autolockOption;
    }
    return out;
  }
  function setMeta(patch) {
    var m = getMeta();
    for (var k in patch) {
      if (Object.prototype.hasOwnProperty.call(DEFAULT_META, k)) { m[k] = patch[k]; }
    }
    if (AUTOLOCK_OPTIONS.indexOf(m.autolockOption) === -1) {
      m.autolockOption = DEFAULT_META.autolockOption;
    }
    writeJSON(K_META, m);
    return m;
  }

  /* ---- Contador de intentos ----
     SOLO INFORMA: mustWipe=true al 10.º intento; la ejecución del
     wipe es responsabilidad del integrador (flujo congelado). */
  function recordFailedAttempt() {
    var m = getMeta();
    m.failedAttempts = (m.failedAttempts | 0) + 1;
    writeJSON(K_META, m);
    var remaining = Math.max(0, MAX_ATTEMPTS - m.failedAttempts);
    return {
      attempts: m.failedAttempts,
      remaining: remaining,
      mustWipe: m.failedAttempts >= MAX_ATTEMPTS
    };
  }
  function resetAttempts() { setMeta({ failedAttempts: 0, lockUntil: 0 }); }

  /* ---- AutoWipe local (lista cerrada + pepper) ---- */
  function wipeLocal() {
    var deleted = [];
    for (var i = 0; i < CLOSED_LIST.length; i++) {
      try {
        if (ls().getItem(CLOSED_LIST[i]) !== null) { deleted.push(CLOSED_LIST[i]); }
        ls().removeItem(CLOSED_LIST[i]);
      } catch (e) { /* seguir borrando el resto */ }
    }
    var vc = cryptoApi();
    var pepperPromise = (vc && typeof vc.deletePepper === 'function')
      ? vc.deletePepper().then(function () { deleted.push('device-pepper'); return deleted; })
      : Promise.resolve(deleted);
    return pepperPromise.then(function () { return { deleted: deleted }; });
  }

  return {
    MAX_ATTEMPTS: MAX_ATTEMPTS,
    AUTOLOCK_OPTIONS: AUTOLOCK_OPTIONS.slice(),
    CLOSED_LIST: CLOSED_LIST.slice(),
    saveBlob: saveBlob, loadBlob: loadBlob, hasVault: hasVault,
    savePinWrap: savePinWrap, loadPinWrap: loadPinWrap, hasPinWrap: hasPinWrap,
    getMeta: getMeta, setMeta: setMeta,
    recordFailedAttempt: recordFailedAttempt, resetAttempts: resetAttempts,
    wipeLocal: wipeLocal
  };
});
