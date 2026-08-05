/* ============================================================
   VaultKey 2.0 — vault-attachments.js
   Almacenamiento cifrado de adjuntos (imágenes de documentos) en
   IndexedDB, separado de vk2_blob (localStorage).

   FASE INICIAL (esta entrega): solo apertura de la base de datos,
   init(), has() y list(). save/load/replace/delete/deleteAll/
   exportAll/importAll se añaden en fases posteriores.

   REGLAS: aislado (sin app.js, sin vault-store.js, sin
   vault-crypto.js); no cifra ni descifra nada; list() nunca expone
   el campo 'enc' de un registro; onupgradeneeded nunca borra ni
   migra datos existentes, solo crea lo que falte.
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

  /* Metadata expuesta por has()/list() — NUNCA incluye 'enc' */
  var META_FIELDS = ['id', 'entryId', 'mime', 'size', 'createdAt', 'updatedAt', 'formatVersion', 'cryptoVersion'];

  function idbFactory() {
    return (root && root.indexedDB) || (typeof indexedDB !== 'undefined' ? indexedDB : null);
  }

  function isNonEmptyString(v) { return typeof v === 'string' && v.trim().length > 0; }

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

  return {
    init: init,
    has: has,
    list: list
  };
});
