/* ============================================================
   VaultKey 2.0 — vault-crypto.js
   Núcleo criptográfico aislado (Módulo 2 · tarea 2.2)
   CONTRATO: 2.1 · Esquema Criptográfico v1.0 CONGELADO (10-07-2026)

   REGLAS: aislado (sin app.js, sin localStorage; IndexedDB SOLO
   para el pepper A+). El pin-wrap NUNCA forma parte del blob.

   MANEJO DE LA DEK (ajuste aprobado 10-07):
   · La DEK nace como 32 bytes aleatorios crudos.
   · Para USO (cifrar/descifrar bóveda) se importa como CryptoKey
     AES-GCM extractable=false — es lo único que vive en sesión.
   · Para WRAP/UNWRAP se cifran los 32 bytes crudos con la KEK
     (AES-GCM). Los bytes crudos existen SOLO durante alta,
     unwrap o rotación, y se anulan (fill(0)) al terminar.
   ============================================================ */

(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  if (root) { root.vkCrypto = api; }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var subtle = crypto.subtle;

  /* ---- Parámetros CONGELADOS (2.1 v1.0) ---- */
  var ITER_MASTER = 2000000;
  var ITER_KIT    = 2000000;
  var ITER_PIN    = 300000;
  var IV_BYTES = 12, SALT_BYTES = 16, KEY_BYTES = 32;
  var CRYPTO_VERSION = 1;
  var KIT_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; /* Crockford */
  var PEPPER_DB = 'vk2-pepper', PEPPER_STORE = 'keys', PEPPER_ID = 'device-pepper';

  /* ---- Utilidades ---- */
  var te = new TextEncoder(), td = new TextDecoder();
  function rand(n) { return crypto.getRandomValues(new Uint8Array(n)); }
  function b64(buf) {
    var u = new Uint8Array(buf), s = '';
    for (var i = 0; i < u.length; i++) { s += String.fromCharCode(u[i]); }
    return (typeof btoa === 'function') ? btoa(s) : Buffer.from(u).toString('base64');
  }
  function unb64(str) {
    if (typeof atob === 'function') {
      var bin = atob(str), u = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) { u[i] = bin.charCodeAt(i); }
      return u;
    }
    return new Uint8Array(Buffer.from(str, 'base64'));
  }
  function zero(u8) { if (u8 && u8.fill) { u8.fill(0); } }

  /* ---- Derivación PBKDF2 (master / kit / pin) ---- */
  function deriveBits(secretStr, saltU8, iterations) {
    return subtle.importKey('raw', te.encode(secretStr), 'PBKDF2', false, ['deriveBits'])
      .then(function (base) {
        return subtle.deriveBits(
          { name: 'PBKDF2', hash: 'SHA-256', salt: saltU8, iterations: iterations },
          base, KEY_BYTES * 8);
      });
  }
  function bitsToAesKey(bits, usages) {
    return subtle.importKey('raw', bits, { name: 'AES-GCM' }, false, usages);
  }
  function deriveKEK(secretStr, saltU8, iterations) {
    return deriveBits(secretStr, saltU8, iterations).then(function (bits) {
      var key = bitsToAesKey(bits, ['encrypt', 'decrypt']);
      /* bits es ArrayBuffer: sin referencia viva tras importar */
      return key;
    });
  }

  /* ---- KEK-pin con pepper A+ (HKDF) ----
     KEK-pin = HKDF(ikm = pepper, salt = PBKDF2(pin, saltPin, 300k), info)
     El pepper es CryptoKey HKDF NO extraíble: JS no puede exportarlo. */
  function deriveKEKPin(pinStr, saltPinU8, pepperKey) {
    return deriveBits(pinStr, saltPinU8, ITER_PIN).then(function (pinBits) {
      return subtle.deriveBits(
        { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(pinBits), info: te.encode('vk2-pinwrap-v1') },
        pepperKey, KEY_BYTES * 8);
    }).then(function (bits) { return bitsToAesKey(bits, ['encrypt', 'decrypt']); });
  }

  /* ---- AES-GCM genérico: {iv, ct} en Base64 ---- */
  function aesEncrypt(key, dataU8) {
    var iv = rand(IV_BYTES); /* NUEVO por operación (2.1 §1) */
    return subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, dataU8)
      .then(function (ct) { return { iv: b64(iv), ct: b64(ct) }; });
  }
  function aesDecrypt(key, wrapped) {
    return subtle.decrypt(
      { name: 'AES-GCM', iv: unb64(wrapped.iv) }, key, unb64(wrapped.ct))
      .then(function (buf) { return new Uint8Array(buf); });
  }

  /* ---- DEK ---- */
  function generateDEKBytes() { return rand(KEY_BYTES); }
  function importDEK(rawU8) {
    /* Sesión: SIEMPRE no extraíble */
    return subtle.importKey('raw', rawU8, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  }
  function wrapDEK(dekRawU8, kek) { return aesEncrypt(kek, dekRawU8); }
  function unwrapDEKRaw(wrapped, kek) { return aesDecrypt(kek, wrapped); }

  /* ---- Bóveda ---- */
  function encryptVault(dekKey, payloadStr) { return aesEncrypt(dekKey, te.encode(payloadStr)); }
  function decryptVault(dekKey, wrapped) {
    return aesDecrypt(dekKey, wrapped).then(function (u8) { return td.decode(u8); });
  }

  /* ---- Emergency Kit: VK2-XXXXX-XXXXX-XXXXX-XXXXX-XXXXXX ---- */
  function generateKitCode() {
    /* 26 símbolos Crockford (5 bits c/u) = 130 bits > 128 requeridos */
    var out = '', r = rand(26);
    for (var i = 0; i < 26; i++) { out += KIT_ALPHABET[r[i] % 32]; }
    return 'VK2-' + out.slice(0, 5) + '-' + out.slice(5, 10) + '-' +
      out.slice(10, 15) + '-' + out.slice(15, 20) + '-' + out.slice(20, 26);
  }
  function normalizeKitCode(code) {
    return String(code).toUpperCase().replace(/[^0-9A-Z]/g, '')
      .replace(/^VK2/, '');
  }

  /* ---- Blob v2 (formato del 2.1 §7) ---- */
  function createVaultBlob(opts) {
    var master = opts.master, kitCode = opts.kitCode, payloadStr = opts.payloadStr;
    var saltMaster = rand(SALT_BYTES), saltKit = rand(SALT_BYTES);
    var dekRaw = generateDEKBytes();
    var out = {};
    return Promise.all([
      deriveKEK(master, saltMaster, ITER_MASTER),
      deriveKEK(normalizeKitCode(kitCode), saltKit, ITER_KIT),
      importDEK(dekRaw)
    ]).then(function (r) {
      var kekMaster = r[0], kekKit = r[1];
      out.dekKey = r[2];
      return Promise.all([wrapDEK(dekRaw, kekMaster), wrapDEK(dekRaw, kekKit),
        encryptVault(out.dekKey, payloadStr)]);
    }).then(function (r) {
      zero(dekRaw); /* los bytes crudos mueren aquí */
      var now = Date.now();
      out.blob = {
        app: 'VaultKey', schemaVersion: 2, cryptoVersion: CRYPTO_VERSION,
        kdf: { algo: 'PBKDF2-SHA256', iterMaster: ITER_MASTER, iterKit: ITER_KIT, iterPin: ITER_PIN,
               saltMaster: b64(saltMaster), saltKit: b64(saltKit) },
        wraps: { master: r[0], kit: r[1] },
        vault: r[2],
        createdAt: now, updatedAt: now
      };
      return out; /* { blob, dekKey } */
    });
  }

  function openVaultBlob(blob, cred) {
    if (!blob || blob.cryptoVersion !== CRYPTO_VERSION) {
      return Promise.reject(new Error('cryptoVersion no soportada'));
    }
    var route, salt, iter, secret;
    if (typeof cred.master === 'string') {
      route = 'master'; salt = unb64(blob.kdf.saltMaster); iter = blob.kdf.iterMaster; secret = cred.master;
    } else if (typeof cred.kitCode === 'string') {
      route = 'kit'; salt = unb64(blob.kdf.saltKit); iter = blob.kdf.iterKit; secret = normalizeKitCode(cred.kitCode);
    } else {
      return Promise.reject(new Error('credencial no soportada'));
    }
    var dekRaw;
    return deriveKEK(secret, salt, iter)
      .then(function (kek) { return unwrapDEKRaw(blob.wraps[route], kek); })
      .then(function (raw) { dekRaw = raw; return importDEK(raw); })
      .then(function (dekKey) {
        zero(dekRaw);
        return decryptVault(dekKey, blob.vault)
          .then(function (payloadStr) { return { dekKey: dekKey, payloadStr: payloadStr }; });
      });
  }

  /* ---- Rotación: re-wrap sin re-cifrar la bóveda ---- */
  function rotateMaster(blob, oldMaster, newMaster) {
    var dekRaw;
    return deriveKEK(oldMaster, unb64(blob.kdf.saltMaster), blob.kdf.iterMaster)
      .then(function (kek) { return unwrapDEKRaw(blob.wraps.master, kek); })
      .then(function (raw) {
        dekRaw = raw;
        var saltNew = rand(SALT_BYTES);
        return deriveKEK(newMaster, saltNew, ITER_MASTER).then(function (kekNew) {
          return wrapDEK(dekRaw, kekNew).then(function (wrap) {
            zero(dekRaw);
            var nb = JSON.parse(JSON.stringify(blob));
            nb.kdf.saltMaster = b64(saltNew);
            nb.wraps.master = wrap;
            nb.updatedAt = Date.now();
            return nb; /* kit-wrap intacto; vault intacta */
          });
        });
      });
  }

  function regenerateKit(blob, master) {
    var dekRaw, newCode = generateKitCode();
    return deriveKEK(master, unb64(blob.kdf.saltMaster), blob.kdf.iterMaster)
      .then(function (kek) { return unwrapDEKRaw(blob.wraps.master, kek); })
      .then(function (raw) {
        dekRaw = raw;
        var saltNew = rand(SALT_BYTES);
        return deriveKEK(normalizeKitCode(newCode), saltNew, ITER_KIT).then(function (kekKit) {
          return wrapDEK(dekRaw, kekKit).then(function (wrap) {
            zero(dekRaw);
            var nb = JSON.parse(JSON.stringify(blob));
            nb.kdf.saltKit = b64(saltNew);
            nb.wraps.kit = wrap; /* el código anterior queda revocado */
            nb.updatedAt = Date.now();
            return { blob: nb, kitCode: newCode };
          });
        });
      });
  }

  /* ---- Pin-wrap local (A+; NUNCA en el blob) ---- */
  function createPinWrap(dekKeyOrRaw, pin, pepperKey) {
    /* Necesita los bytes crudos: se llama en alta/rotación con dekRaw,
       o tras un openVaultBlob re-derivando por master (integración 2.5). */
    var saltPin = rand(SALT_BYTES);
    var rawPromise = (dekKeyOrRaw instanceof Uint8Array)
      ? Promise.resolve(dekKeyOrRaw)
      : Promise.reject(new Error('createPinWrap requiere los bytes crudos de la DEK'));
    return rawPromise.then(function (raw) {
      return deriveKEKPin(pin, saltPin, pepperKey).then(function (kekPin) {
        return wrapDEK(raw, kekPin).then(function (w) {
          return { saltPin: b64(saltPin), iterPin: ITER_PIN, iv: w.iv, ct: w.ct };
        });
      });
    });
  }
  function openPinWrap(pinWrap, pin, pepperKey) {
    var dekRaw;
    return deriveKEKPin(pin, unb64(pinWrap.saltPin), pepperKey)
      .then(function (kekPin) { return unwrapDEKRaw({ iv: pinWrap.iv, ct: pinWrap.ct }, kekPin); })
      .then(function (raw) { dekRaw = raw; return importDEK(raw); })
      .then(function (dekKey) { zero(dekRaw); return dekKey; });
  }

  /* ---- Pepper A+ (IndexedDB; CryptoKey HKDF NO extraíble) ---- */
  function importPepperKey(rawU8) {
    return subtle.importKey('raw', rawU8, 'HKDF', false, ['deriveBits']);
  }
  function idbOpen() {
    return new Promise(function (res, rej) {
      var req = indexedDB.open(PEPPER_DB, 1);
      req.onupgradeneeded = function () { req.result.createObjectStore(PEPPER_STORE); };
      req.onsuccess = function () { res(req.result); };
      req.onerror = function () { rej(req.error); };
    });
  }
  function getOrCreatePepper() {
    return idbOpen().then(function (db) {
      return new Promise(function (res, rej) {
        var tx = db.transaction(PEPPER_STORE, 'readwrite');
        var st = tx.objectStore(PEPPER_STORE);
        var get = st.get(PEPPER_ID);
        get.onsuccess = function () {
          if (get.result) { res(get.result); return; }
          var raw = rand(KEY_BYTES);
          importPepperKey(raw).then(function (key) {
            zero(raw);
            var put = st.put(key, PEPPER_ID); /* structured clone de CryptoKey */
            put.onsuccess = function () { res(key); };
            put.onerror = function () { rej(put.error); };
          }).catch(rej);
        };
        get.onerror = function () { rej(get.error); };
      });
    });
  }
  function deletePepper() {
    return idbOpen().then(function (db) {
      return new Promise(function (res, rej) {
        var tx = db.transaction(PEPPER_STORE, 'readwrite');
        var del = tx.objectStore(PEPPER_STORE).delete(PEPPER_ID);
        del.onsuccess = function () { res(true); };
        del.onerror = function () { rej(del.error); };
      });
    });
  }

  return {
    ITER_MASTER: ITER_MASTER, ITER_KIT: ITER_KIT, ITER_PIN: ITER_PIN,
    CRYPTO_VERSION: CRYPTO_VERSION,
    generateDEKBytes: generateDEKBytes, importDEK: importDEK,
    deriveKEK: deriveKEK, deriveKEKPin: deriveKEKPin,
    wrapDEK: wrapDEK, unwrapDEKRaw: unwrapDEKRaw,
    encryptVault: encryptVault, decryptVault: decryptVault,
    generateKitCode: generateKitCode, normalizeKitCode: normalizeKitCode,
    createVaultBlob: createVaultBlob, openVaultBlob: openVaultBlob,
    rotateMaster: rotateMaster, regenerateKit: regenerateKit,
    createPinWrap: createPinWrap, openPinWrap: openPinWrap,
    importPepperKey: importPepperKey,
    getOrCreatePepper: getOrCreatePepper, deletePepper: deletePepper
  };
});
