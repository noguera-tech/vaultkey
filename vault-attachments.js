/* ============================================================
   VaultKey 2.0 — vault-attachments.js
   Almacenamiento cifrado de adjuntos (imágenes de documentos) en
   IndexedDB, separado de vk2_blob (localStorage).

   FASE ACTUAL (esta entrega): apertura de la base de datos, init(),
   has(), list(), save() y load(). replace/delete/deleteAll/
   exportAll/importAll se añaden en fases posteriores.

   REGLAS: aislado (sin app.js, sin vault-store.js, sin
   vault-crypto.js); no cifra ni descifra con lógica propia — usa
   únicamente las funciones públicas de vkCrypto (encryptVault/
   decryptVault); list() nunca expone el campo 'enc' de un registro;
   onupgradeneeded nunca borra ni migra datos existentes, solo crea
   lo que falte.
   ============================================================ */

(function (root, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  if (root) { root.vkAttachments = api; }
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';

  var DB_NAME = 'vk2-attachments';
  var DB_VERSION = 1;
  var STORE_NAME = 'blobs';
  var INDEX_ENTRY_ID = 'entryId';

  var FORMAT_VERSION = 1;
  var MAX_FILE_SIZE = 5 * 1024 * 1024;
  var ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

  /* Metadata expuesta por has()/list() — NUNCA incluye 'enc' */
  var META_FIELDS = ['id', 'entryId', 'mime', 'size', 'createdAt', 'updatedAt', 'formatVersion', 'cryptoVersion'];

  function idbFactory() {
    return (root && root.indexedDB) || (typeof indexedDB !== 'undefined' ? indexedDB : null);
  }

  function vkCryptoRef() {
    return (root && root.vkCrypto) || (typeof globalThis !== 'undefined' ? globalThis.vkCrypto : undefined);
  }

  function isNonEmptyString(v) { return typeof v === 'string' && v.trim().length > 0; }

  function isAllowedMime(mime) { return ALLOWED_MIME_TYPES.indexOf(mime) !== -1; }

  function isValidSize(size) {
    return typeof size === 'number' && isFinite(size) && Math.floor(size) === size && size > 0 && size <= MAX_FILE_SIZE;
  }

  function isValidBase64(str) {
    return typeof str === 'string' && str.length > 0 && str.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(str);
  }

  /* Valida la forma mínima de un registro ya leído de IndexedDB,
     antes de intentar descifrarlo. No comprueba 'id'/'entryId' (ya
     vienen de una búsqueda por clave/índice válida). */
  function validateStoredRecord(record, vc) {
    if (!record || typeof record !== 'object') { return false; }
    if (record.formatVersion !== FORMAT_VERSION) { return false; }
    if (!vc || record.cryptoVersion !== vc.CRYPTO_VERSION) { return false; }
    if (!isAllowedMime(record.mime)) { return false; }
    if (!isValidSize(record.size)) { return false; }
    if (!record.enc || !isNonEmptyString(record.enc.iv) || !isNonEmptyString(record.enc.ct)) { return false; }
    return true;
  }

  /* Lee un Blob/File como base64 vía FileReader.readAsDataURL y
     devuelve solo la parte posterior a la coma. Rechaza si el
     resultado no tiene el formato data:*;base64,... esperado. */
  function readBlobAsBase64(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () { reject(reader.error || new Error('No se pudo leer el archivo')); };
      reader.onload = function () {
        var result = reader.result;
        var comma = typeof result === 'string' ? result.indexOf(',') : -1;
        var prefix = comma !== -1 ? result.slice(0, comma) : '';
        if (comma === -1 || !/^data:[^;,]*;base64$/.test(prefix)) {
          reject(new Error('El archivo leído no tiene formato data:*;base64,...'));
          return;
        }
        resolve(result.slice(comma + 1));
      };
      reader.readAsDataURL(file);
    });
  }

  /* Convierte una cadena base64 ya validada a Uint8Array. Lanza si
     atob() no puede decodificarla (delegado, no revalida formato). */
  function base64ToUint8Array(b64) {
    var binary = atob(b64);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  /* ---- Conexión cacheada (init() es idempotente) ---- */
  var _dbPromise = null;

  function openDB() {
    var factory = idbFactory();
    if (!factory) {
      return Promise.reject(new Error('IndexedDB no disponible'));
    }
    return new Promise(function (resolve, reject) {
      var settled = false;
      function settleResolve(value) {
        if (settled) { return; }
        settled = true;
        resolve(value);
      }
      function settleReject(err) {
        if (settled) { return; }
        settled = true;
        reject(err);
      }

      var req = factory.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = function () {
        var db = req.result;
        var store;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        } else {
          store = req.transaction.objectStore(STORE_NAME);
        }
        if (!store.indexNames.contains(INDEX_ENTRY_ID)) {
          store.createIndex(INDEX_ENTRY_ID, INDEX_ENTRY_ID, { unique: false });
        }
      };

      req.onblocked = function () {
        settleReject(new Error('Apertura de IndexedDB bloqueada'));
      };

      req.onsuccess = function () {
        var db = req.result;
        if (settled) {
          db.close();
          return;
        }
        db.onversionchange = function () {
          db.close();
          _dbPromise = null;
        };
        settleResolve(db);
      };

      req.onerror = function () { settleReject(req.error || new Error('No se pudo abrir IndexedDB')); };
    });
  }

  /* Devuelve la conexión (IDBDatabase) cacheada, abriéndola si hace falta.
     Si la apertura falla, limpia la caché para permitir reintentar en
     una llamada posterior en vez de quedar atascado con un rechazo. */
  function _getDB() {
    if (!_dbPromise) {
      _dbPromise = openDB().catch(function (err) {
        _dbPromise = null;
        throw err;
      });
    }
    return _dbPromise;
  }

  function toMeta(record) {
    var out = {};
    for (var i = 0; i < META_FIELDS.length; i++) {
      var k = META_FIELDS[i];
      out[k] = record[k];
    }
    return out;
  }

  /* ---- API pública ---- */

  function init() {
    return _getDB().then(function () { /* Promise<void>: no expone el IDBDatabase */ });
  }

  function has(opts) {
    var id = opts && opts.id;
    if (!isNonEmptyString(id)) {
      return Promise.reject(new Error('has: id debe ser un string no vacío'));
    }
    return _getDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE_NAME, 'readonly');
        var store = tx.objectStore(STORE_NAME);
        var req = store.get(id);
        req.onsuccess = function () { resolve(!!req.result); };
        req.onerror = function () { reject(req.error || new Error('has: fallo al leer IndexedDB')); };
      });
    });
  }

  /* list(): sin entryId devuelve todos los registros (metadata); con
     entryId usa el índice 'entryId'. El orden nativo de IndexedDB
     difiere según se use el store o el índice, así que el resultado
     se normaliza aquí: se ordena por createdAt ascendente, y por id
     como desempate estable si createdAt coincide. */
  function list(opts) {
    opts = opts || {};
    var entryId = opts.entryId;
    if (typeof entryId !== 'undefined' && !isNonEmptyString(entryId)) {
      return Promise.reject(new Error('list: entryId debe ser un string no vacío si se proporciona'));
    }
    return _getDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE_NAME, 'readonly');
        var store = tx.objectStore(STORE_NAME);
        var req = isNonEmptyString(entryId)
          ? store.index(INDEX_ENTRY_ID).getAll(entryId)
          : store.getAll();
        req.onsuccess = function () {
          var records = req.result || [];
          var metas = records.map(toMeta);
          metas.sort(function (a, b) {
            if (a.createdAt !== b.createdAt) { return a.createdAt - b.createdAt; }
            return a.id < b.id ? -1 : (a.id > b.id ? 1 : 0);
          });
          resolve(metas);
        };
        req.onerror = function () { reject(req.error || new Error('list: fallo al leer IndexedDB')); };
      });
    });
  }

  /* save(): valida entrada, lee y cifra el archivo ANTES de abrir la
     transacción de escritura, y solo entonces abre una única
     transacción readwrite en la que comprueba la unicidad del id
     (store.get, no has()) y hace store.add(). Resuelve únicamente en
     tx.oncomplete — nunca en el onsuccess de una request suelta. */
  function save(opts) {
    opts = opts || {};
    var id = opts.id;
    var entryId = opts.entryId;
    var file = opts.file;
    var dekKey = opts.dekKey;

    if (!isNonEmptyString(id)) {
      return Promise.reject(new Error('save: id debe ser un string no vacío'));
    }
    if (!isNonEmptyString(entryId)) {
      return Promise.reject(new Error('save: entryId debe ser un string no vacío'));
    }
    if (typeof Blob === 'undefined' || !(file instanceof Blob)) {
      return Promise.reject(new Error('save: file debe ser un Blob o File'));
    }
    if (!isAllowedMime(file.type)) {
      return Promise.reject(new Error('save: tipo de archivo no permitido: ' + file.type));
    }
    if (!(file.size > 0)) {
      return Promise.reject(new Error('save: el archivo está vacío'));
    }
    if (file.size > MAX_FILE_SIZE) {
      return Promise.reject(new Error('save: el archivo supera el tamaño máximo permitido'));
    }
    if (!dekKey) {
      return Promise.reject(new Error('save: dekKey es obligatoria'));
    }
    var vc = vkCryptoRef();
    if (!vc || typeof vc.encryptVault !== 'function' || typeof vc.CRYPTO_VERSION === 'undefined') {
      return Promise.reject(new Error('save: vkCrypto no está disponible'));
    }

    return readBlobAsBase64(file).then(function (base64) {
      return vc.encryptVault(dekKey, base64);
    }).then(function (enc) {
      if (!enc || !isNonEmptyString(enc.iv) || !isNonEmptyString(enc.ct)) {
        throw new Error('save: vkCrypto devolvió un cifrado inválido');
      }
      var now = Date.now();
      var record = {
        id: id,
        entryId: entryId,
        formatVersion: FORMAT_VERSION,
        cryptoVersion: vc.CRYPTO_VERSION,
        mime: file.type,
        size: file.size,
        createdAt: now,
        updatedAt: now,
        enc: enc
      };
      return _getDB().then(function (db) {
        return new Promise(function (resolve, reject) {
          var abortError = null;
          var tx = db.transaction(STORE_NAME, 'readwrite');
          var store = tx.objectStore(STORE_NAME);

          var getReq = store.get(id);
          getReq.onsuccess = function () {
            if (getReq.result) {
              abortError = new Error('Ya existe un adjunto con id ' + id);
              try { tx.abort(); } catch (e) { /* onabort se encarga del rechazo */ }
              return;
            }
            store.add(record);
          };
          getReq.onerror = function () {
            abortError = getReq.error || new Error('save: fallo al comprobar el id existente');
            try { tx.abort(); } catch (e) { /* onabort se encarga del rechazo */ }
          };

          tx.oncomplete = function () { resolve(toMeta(record)); };
          tx.onerror = function () { reject(abortError || tx.error || new Error('save: fallo al guardar el adjunto')); };
          tx.onabort = function () { reject(abortError || tx.error || new Error('save: la transacción se abortó')); };
        });
      });
    });
  }

  /* load(): lee el registro cifrado en una transacción readonly,
     valida su forma mínima, y solo después lo descifra con
     vkCrypto.decryptVault. Reconstruye el Blob a partir del base64
     descifrado sin usar fetch(data:...). */
  function load(opts) {
    opts = opts || {};
    var id = opts.id;
    var dekKey = opts.dekKey;

    if (!isNonEmptyString(id)) {
      return Promise.reject(new Error('load: id debe ser un string no vacío'));
    }
    if (!dekKey) {
      return Promise.reject(new Error('load: dekKey es obligatoria'));
    }
    var vc = vkCryptoRef();
    if (!vc || typeof vc.decryptVault !== 'function' || typeof vc.CRYPTO_VERSION === 'undefined') {
      return Promise.reject(new Error('load: vkCrypto no está disponible'));
    }

    return _getDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE_NAME, 'readonly');
        var store = tx.objectStore(STORE_NAME);
        var req = store.get(id);
        req.onsuccess = function () {
          var record = req.result;
          if (!record) {
            reject(new Error('Adjunto no encontrado: ' + id));
            return;
          }
          if (!validateStoredRecord(record, vc)) {
            reject(new Error('load: el registro almacenado no tiene un formato válido'));
            return;
          }
          resolve(record);
        };
        req.onerror = function () { reject(req.error || new Error('load: fallo al leer IndexedDB')); };
      });
    }).then(function (record) {
      return vc.decryptVault(dekKey, record.enc).then(function (base64) {
        if (!isValidBase64(base64)) {
          throw new Error('load: el contenido descifrado no es base64 válido');
        }
        var bytes;
        try {
          bytes = base64ToUint8Array(base64);
        } catch (e) {
          throw new Error('load: el contenido descifrado no es base64 válido');
        }
        var blob = new Blob([bytes], { type: record.mime });
        if (blob.size !== record.size) {
          throw new Error('load: el tamaño del adjunto no coincide (posible corrupción)');
        }
        return {
          blob: blob,
          mime: record.mime,
          size: record.size,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
          formatVersion: record.formatVersion,
          cryptoVersion: record.cryptoVersion,
          entryId: record.entryId
        };
      });
    });
  }

  return {
    init: init,
    has: has,
    list: list,
    save: save,
    load: load
  };
});
