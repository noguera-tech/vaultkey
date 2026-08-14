/* ============================================================
   VaultKey 2.0 — credentials.js
   Cambio de credenciales (Módulo 2 · tarea 2.8) — AISLADO
   CONTRATO: 2.1 v1.0 + decisión 11-07 (Master, Kit y PIN son
   rutas independientes sobre la misma DEK; cambiar una no rompe
   las otras).

   REGLAS: sin app.js/app.html/index.html/sw.js/drive.js; sin
   dependencias; no toca vault-crypto.js ni vault-store.js.
   ============================================================ */

(function (root, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  if (root) { root.vkCredentials = api; }
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';

  /* ---- changeMaster ----
     Solo re-wrap del master-wrap (rotateMaster).
     DEK no cambia → kit-wrap y pin-wrap permanecen válidos.   */
  function changeMaster(opts) {
    var store  = opts.store;
    var crypto = opts.crypto;
    var current = opts.currentMaster;
    var next    = opts.newMaster;
    var blob = store.loadBlob();
    if (!blob) { return Promise.reject(new Error('No hay bóveda.')); }
    return crypto.rotateMaster(blob, current, next)
      .then(function (newBlob) {
        store.saveBlob(newBlob);
        return true;
      });
  }

  /* ---- changePIN ----
     Requiere master (única ruta para obtener dekRaw).
     Genera nuevo pin-wrap con el pepper existente.            */
  function changePIN(opts) {
    var store  = opts.store;
    var crypto = opts.crypto;
    var master = opts.master;
    var newPin = opts.newPin;
    var blob = store.loadBlob();
    if (!blob) { return Promise.reject(new Error('No hay bóveda.')); }

    function uns(b64) {
      var bin = (typeof atob === 'function') ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
      var u = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) { u[i] = bin.charCodeAt(i); }
      return u;
    }

    var dekRaw;
    return crypto.deriveKEK(master, uns(blob.kdf.saltMaster), blob.kdf.iterMaster)
      .then(function (kek) { return crypto.unwrapDEKRaw(blob.wraps.master, kek); })
      .then(function (raw) {
        dekRaw = raw;
        return crypto.getOrCreatePepper();
      })
      .then(function (pepper) {
        return crypto.createPinWrap(dekRaw, newPin, pepper);
      })
      .then(function (pw) {
        if (dekRaw && dekRaw.fill) { dekRaw.fill(0); }
        store.savePinWrap(pw);
        return true;
      });
  }

  return { changeMaster: changeMaster, changePIN: changePIN };
});
