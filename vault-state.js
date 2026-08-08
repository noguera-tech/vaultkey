/* ============================================================
   VaultKey — vault-state.js (PROPUESTA P0.2, NO integrada)
   Piezas 1 y 2 del Paquete Técnico P0, revisadas tras la ronda
   de corrección obligatoria (P0.2).

   Cambios respecto a P0.1 relevantes para este archivo:
   - #3  vk2_blob + onboardingDone=true SIN vk2_pinwrap ahora es
         VK2_INCOMPLETE, salvo indicador explícito de modo sin PIN
         (ver DECISIÓN ABIERTA D-3 más abajo: el campo no existe
         hoy en el esquema real, así que en la práctica esta rama
         nunca se activa mientras no se defina y confirme).
   - #4  pin-wrap presente + pepper 'missing' degrada el ESTADO a
         VK2_INCOMPLETE (antes solo añadía un warning).
   - #12 Base64 validado con regex estricta + longitud calculada
         matemáticamente (no depende de atob/Buffer, que son
         permisivos de forma distinta en cada entorno).
   - #13 Tamaño de JSON crudo medido en bytes UTF-8 reales
         (TextEncoder / Buffer.byteLength), no en .length (UTF-16).
   - #14 Nombres de clave importados de vault-keys.js, no
         duplicados aquí.

   Cambios P0.3:
   - #12 Se elimina el indicador de "modo sin PIN". VK2 sin
         vk2_pinwrap es SIEMPRE VK2_INCOMPLETE, sin excepción.
   - #13 Se exige app==='VaultKey', schemaVersion===2 exacto,
         cryptoVersion===1 exacto y kdf.algo==='PBKDF2-SHA256'.
   - #14 Salts de 16 bytes EXACTOS (no bajo un máximo defensivo).
         iterPin se exige explícitamente, sin defaultear cuando
         falta.

   Sigue siendo un módulo de SOLO LECTURA. No escribe, no borra,
   no llama a getOrCreatePepper() ni a deletePepper().
   ============================================================ */

(function (root, factory) {
  'use strict';
  var keys = (typeof module === 'object' && module.exports) ? require('./vault-keys.js') : (root && root.vkKeys);
  var api = factory(root, keys);
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  if (root) { root.vkVaultState = api; }
})(typeof window !== 'undefined' ? window : globalThis, function (root, KEYS) {
  'use strict';

  var K_META_V1 = KEYS.V1.META;
  var K_DATA_V1 = KEYS.V1.DATA;
  var K_RECOVERY_V1 = KEYS.V1.RECOVERY;
  var K_PIN_CHANGE_BACKUP = KEYS.V1.PIN_CHANGE_BACKUP;
  var K_BLOB = KEYS.VK2.BLOB;
  var K_PINWRAP = KEYS.VK2.PINWRAP;
  var K_META = KEYS.VK2.META;

  /* P0.3 #12: se elimina el indicador de "modo sin PIN". En el
     esquema real, el onboarding congelado hace el PIN obligatorio
     (Crear PIN local es pantalla R1) y no existe ningún campo que
     lo desactive. vk2_blob + onboardingDone=true SIN vk2_pinwrap
     es SIEMPRE VK2_INCOMPLETE, sin excepción. */

  var LIMITS = {
    MAX_RAW_JSON_BYTES: 2 * 1024 * 1024,
    MAX_CIPHERTEXT_BYTES: 5 * 1024 * 1024,
    MIN_PBKDF2_ITERATIONS: 100000,
    MAX_PBKDF2_ITERATIONS: 5000000,
    EXPECTED_AES_GCM_IV_BYTES: 12
  };

  var KNOWN_SCHEMA_VERSIONS_MAX = 2;
  var KNOWN_CRYPTO_VERSIONS_MAX = 1;
  var SALT_BYTES = 16; /* Esquema Criptográfico v1.0 CONGELADO */
  var KDF_ALGO = 'PBKDF2-SHA256';
  var APP_NAME = 'VaultKey';

  function ls() { return (root && root.localStorage) || globalThis.localStorage; }
  function cryptoApi() { return (root && root.vkCrypto) || globalThis.vkCrypto; }

  /* ---- #13: bytes UTF-8 reales, no .length (UTF-16) ---- */
  function utf8ByteLength(str) {
    if (typeof str !== 'string') { return -1; }
    if (typeof TextEncoder !== 'undefined') { return new TextEncoder().encode(str).length; }
    return Buffer.byteLength(str, 'utf8');
  }
  function rawFits(rawStr) {
    var n = utf8ByteLength(rawStr);
    return n >= 0 && n <= LIMITS.MAX_RAW_JSON_BYTES;
  }

  /* ================= PIEZA 1 — readRawDetailed ================= */

  function readRawDetailed(key, storage) {
    var store = storage || ls();
    var raw;
    try {
      raw = store.getItem(key);
    } catch (e) {
      return { key: key, status: 'storage_error', raw: null, value: null, error: normalizeError(e) };
    }
    if (raw === null || raw === undefined) {
      return { key: key, status: 'missing', raw: null, value: null, error: null };
    }
    var parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      return { key: key, status: 'corrupt', raw: raw, value: null, error: normalizeError(e) };
    }
    return { key: key, status: 'valid', raw: raw, value: parsed, error: null };
  }

  function normalizeError(e) {
    return { name: (e && e.name) || 'Error', message: (e && e.message) || String(e) };
  }

  /* ================= #12: Base64 estricta y determinista ================= */

  var STRICT_BASE64_RE = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{4})$/;

  function isStrictBase64(v) {
    return typeof v === 'string' && v.length > 0 && v.length % 4 === 0 && STRICT_BASE64_RE.test(v);
  }

  function b64DecodedByteLength(v) {
    if (!isStrictBase64(v)) { return -1; }
    var len = (v.length / 4) * 3;
    if (v.slice(-2) === '==') { len -= 2; }
    else if (v.slice(-1) === '=') { len -= 1; }
    return len;
  }

  function isNonEmptyString(v) { return typeof v === 'string' && v.length > 0; }

  function isValidBase64Field(v, maxBytes) {
    var len = b64DecodedByteLength(v);
    if (len < 0) { return false; }
    if (maxBytes && len > maxBytes) { return false; }
    return true;
  }

  function isValidIvField(v) {
    return b64DecodedByteLength(v) === LIMITS.EXPECTED_AES_GCM_IV_BYTES;
  }

  /* #14: salt EXACTO de 16 bytes (no "hasta un máximo defensivo"). */
  function isValidSaltField(v) {
    return b64DecodedByteLength(v) === SALT_BYTES;
  }

  function isValidIterations(n) {
    return typeof n === 'number' && isFinite(n) && Number.isInteger(n) &&
      n >= LIMITS.MIN_PBKDF2_ITERATIONS && n <= LIMITS.MAX_PBKDF2_ITERATIONS;
  }

  /* ================= PIEZA 2 — detección V1 ================= */

  function classifyV1(storage) {
    var fields = {
      meta: readRawDetailed(K_META_V1, storage),
      data: readRawDetailed(K_DATA_V1, storage),
      recovery: readRawDetailed(K_RECOVERY_V1, storage),
      pinChangeBackup: readRawDetailed(K_PIN_CHANGE_BACKUP, storage)
    };
    var warnings = [];
    var errors = [];

    if (fields.pinChangeBackup.status !== 'missing') {
      warnings.push('V1_PIN_CHANGE_INTERRUPTED');
    }

    var metaPresent = fields.meta.status !== 'missing';
    var dataPresent = fields.data.status !== 'missing';
    var recoveryPresent = fields.recovery.status !== 'missing';
    var backupPresent = fields.pinChangeBackup.status !== 'missing';

    var status;

    if (fields.meta.status === 'corrupt' || fields.data.status === 'corrupt') {
      status = 'CORRUPT';
      if (fields.meta.status === 'corrupt') { errors.push('META_JSON_CORRUPT'); }
      if (fields.data.status === 'corrupt') { errors.push('DATA_JSON_CORRUPT'); }
    } else if (metaPresent && dataPresent) {
      if (!rawFits(fields.meta.raw) || !rawFits(fields.data.raw)) {
        status = 'CORRUPT';
        errors.push('RAW_JSON_TOO_LARGE');
      } else {
        var metaOk = fields.meta.value && isNonEmptyString(fields.meta.value.hash);
        var d = fields.data.value || {};
        var dataOk = isNonEmptyString(d.salt) && isNonEmptyString(d.iv) && isNonEmptyString(d.ct) &&
          isValidBase64Field(d.salt, LIMITS.MAX_CIPHERTEXT_BYTES) &&
          isValidIvField(d.iv) &&
          isValidBase64Field(d.ct, LIMITS.MAX_CIPHERTEXT_BYTES);
        if (metaOk && dataOk) {
          status = 'READY';
        } else {
          status = 'CORRUPT';
          if (!metaOk) { errors.push('META_HASH_INVALID'); }
          if (!dataOk) { errors.push('DATA_FIELDS_INVALID'); }
        }
      }
    } else if (metaPresent !== dataPresent) {
      status = 'INCOMPLETE';
      warnings.push(metaPresent ? 'V1_META_WITHOUT_DATA' : 'V1_DATA_WITHOUT_META');
    } else if (recoveryPresent || backupPresent) {
      status = 'INCOMPLETE';
      if (recoveryPresent) { warnings.push('V1_RECOVERY_WITHOUT_VAULT'); }
    } else {
      status = 'ABSENT';
    }

    return { status: status, fields: fields, warnings: warnings, errors: errors };
  }

  /* ================= PIEZA 2 — detección VK2 (sin pepper) ================= */

  function classifyVK2Structure(storage) {
    var fields = {
      blob: readRawDetailed(K_BLOB, storage),
      pinwrap: readRawDetailed(K_PINWRAP, storage),
      meta: readRawDetailed(K_META, storage)
    };
    var warnings = [];
    var errors = [];

    var blobPresent = fields.blob.status !== 'missing';
    var pinwrapPresent = fields.pinwrap.status !== 'missing';
    var metaPresent = fields.meta.status !== 'missing';

    if (fields.blob.status === 'corrupt' || fields.meta.status === 'corrupt' || fields.pinwrap.status === 'corrupt') {
      if (fields.blob.status === 'corrupt') { errors.push('BLOB_JSON_CORRUPT'); }
      if (fields.meta.status === 'corrupt') { errors.push('META_JSON_CORRUPT'); }
      if (fields.pinwrap.status === 'corrupt') { errors.push('PINWRAP_JSON_CORRUPT'); }
      return { status: 'CORRUPT', fields: fields, warnings: warnings, errors: errors, pinwrapPresent: pinwrapPresent };
    }

    if (!blobPresent) {
      if (pinwrapPresent || metaPresent) {
        return { status: 'INCOMPLETE', fields: fields, warnings: ['VK2_META_OR_PINWRAP_WITHOUT_BLOB'], errors: errors, pinwrapPresent: pinwrapPresent };
      }
      return { status: 'ABSENT', fields: fields, warnings: warnings, errors: errors, pinwrapPresent: pinwrapPresent };
    }

    if (!rawFits(fields.blob.raw)) {
      errors.push('RAW_JSON_TOO_LARGE');
      return { status: 'CORRUPT', fields: fields, warnings: warnings, errors: errors, pinwrapPresent: pinwrapPresent };
    }

    var b = fields.blob.value || {};

    var schemaFuture = typeof b.schemaVersion === 'number' && b.schemaVersion > KNOWN_SCHEMA_VERSIONS_MAX;
    var cryptoFuture = typeof b.cryptoVersion === 'number' && b.cryptoVersion > KNOWN_CRYPTO_VERSIONS_MAX;
    if (schemaFuture || cryptoFuture) {
      return { status: 'UNSUPPORTED_VERSION', fields: fields, warnings: warnings, errors: errors, pinwrapPresent: pinwrapPresent };
    }

    var kdf = b.kdf || {};
    var wraps = b.wraps || {};
    var vault = b.vault || {};

    /* #13: valores EXACTOS del esquema congelado, no "hasta un máximo".
       #14: salts de 16 bytes exactos (isValidSaltField), no bajo el
       límite defensivo de ciphertext. */
    var structOk =
      b.app === APP_NAME &&
      b.schemaVersion === KNOWN_SCHEMA_VERSIONS_MAX &&
      b.cryptoVersion === KNOWN_CRYPTO_VERSIONS_MAX &&
      kdf.algo === KDF_ALGO &&
      isValidIterations(kdf.iterMaster) && isValidIterations(kdf.iterKit) &&
      isValidSaltField(kdf.saltMaster) &&
      isValidSaltField(kdf.saltKit) &&
      wraps.master && isValidIvField(wraps.master.iv) && isValidBase64Field(wraps.master.ct, LIMITS.MAX_CIPHERTEXT_BYTES) &&
      wraps.kit && isValidIvField(wraps.kit.iv) && isValidBase64Field(wraps.kit.ct, LIMITS.MAX_CIPHERTEXT_BYTES) &&
      vault && isValidIvField(vault.iv) && isValidBase64Field(vault.ct, LIMITS.MAX_CIPHERTEXT_BYTES);

    if (!structOk) {
      errors.push('BLOB_STRUCTURE_INVALID');
      return { status: 'CORRUPT', fields: fields, warnings: warnings, errors: errors, pinwrapPresent: pinwrapPresent };
    }

    if (!metaPresent) {
      return { status: 'INCOMPLETE', fields: fields, warnings: ['VK2_BLOB_WITHOUT_META'], errors: errors, pinwrapPresent: pinwrapPresent };
    }
    var m = fields.meta.value || {};
    if (m.onboardingDone !== true) {
      return { status: 'INCOMPLETE', fields: fields, warnings: ['VK2_ONBOARDING_INCOMPLETE'], errors: errors, pinwrapPresent: pinwrapPresent };
    }

    if (!pinwrapPresent) {
      /* #12: sin excepción posible. */
      return { status: 'INCOMPLETE', fields: fields, warnings: ['VK2_BLOB_WITHOUT_PINWRAP'], errors: errors, pinwrapPresent: pinwrapPresent };
    }

    var pw = fields.pinwrap.value || {};
    /* #14: iterPin se exige explícitamente (sin defaultear a 300000
       cuando falta: eso ocultaba un campo ausente como si fuera
       válido) y saltPin debe ser de 16 bytes exactos. */
    var pwOk = isValidSaltField(pw.saltPin) &&
      isValidIterations(pw.iterPin) &&
      isValidIvField(pw.iv) && isValidBase64Field(pw.ct, LIMITS.MAX_CIPHERTEXT_BYTES);
    if (!pwOk) {
      errors.push('PINWRAP_STRUCTURE_INVALID');
      return { status: 'CORRUPT', fields: fields, warnings: warnings, errors: errors, pinwrapPresent: pinwrapPresent };
    }

    return { status: 'READY', fields: fields, warnings: warnings, errors: errors, pinwrapPresent: pinwrapPresent };
  }

  /* ================= detección global ================= */

  function anyStorageError(v1Fields, vk2Fields) {
    var all = [v1Fields.meta, v1Fields.data, v1Fields.recovery, v1Fields.pinChangeBackup,
      vk2Fields.blob, vk2Fields.pinwrap, vk2Fields.meta];
    for (var i = 0; i < all.length; i++) {
      if (all[i].status === 'storage_error') { return all[i].error; }
    }
    return null;
  }

  function combineGlobal(v1, vk2) {
    var globalWarnings = [];
    var globalErrors = [];
    var state, activeFormat = null;

    var v1Absent = v1.status === 'ABSENT';
    var vk2Absent = vk2.status === 'ABSENT';

    if (!v1Absent && !vk2Absent) {
      state = 'BOTH_PRESENT';
      globalWarnings.push('AUTO_SYNC_BLOCKED', 'FORMAT_SELECTION_REQUIRED');
    } else if (v1Absent && vk2Absent) {
      state = 'EMPTY';
    } else if (!v1Absent) {
      state = 'V1_' + v1.status;
      if (v1.status === 'READY') { activeFormat = 'V1'; }
    } else {
      if (vk2.status === 'UNSUPPORTED_VERSION') {
        state = 'UNSUPPORTED_VERSION';
      } else {
        state = 'VK2_' + vk2.status;
        if (vk2.status === 'READY') { activeFormat = 'VK2'; }
      }
    }

    return { state: state, activeFormat: activeFormat, globalWarnings: globalWarnings, globalErrors: globalErrors };
  }

  function summarizeFields(fields) {
    var out = {};
    for (var k in fields) {
      out[k] = { status: fields[k].status, error: fields[k].error };
    }
    return out;
  }

  function buildResult(v1, vk2) {
    var combined = combineGlobal(v1, vk2);
    return {
      state: combined.state,
      activeFormat: combined.activeFormat,
      v1: { status: v1.status, fields: summarizeFields(v1.fields), warnings: v1.warnings, errors: v1.errors },
      vk2: {
        status: vk2.status, fields: summarizeFields(vk2.fields), warnings: vk2.warnings, errors: vk2.errors,
        pinwrapPresent: !!vk2.pinwrapPresent
      },
      warnings: combined.globalWarnings,
      errors: combined.globalErrors,
      checkedAt: Date.now()
    };
  }

  /* ================= API pública ================= */

  function detectVaultStateSync(options) {
    var storage;
    try { storage = (options && options.storage) || ls(); }
    catch (e) { storage = null; }

    var v1 = classifyV1(storage);
    var vk2 = classifyVK2Structure(storage);

    var storageErr = anyStorageError(v1.fields, vk2.fields);
    if (storageErr) {
      return {
        state: 'STORAGE_ERROR', activeFormat: null,
        v1: { status: v1.status, fields: {}, warnings: v1.warnings, errors: v1.errors },
        vk2: { status: vk2.status, fields: {}, warnings: vk2.warnings, errors: vk2.errors },
        warnings: [], errors: [storageErr], checkedAt: Date.now()
      };
    }

    return buildResult(v1, vk2);
  }

  /* #4: la variante async puede DEGRADAR el estado VK2 de READY a
     INCOMPLETE (no solo añadir un warning) cuando hay pin-wrap y
     el pepper falta. El global se recalcula por completo tras el
     ajuste, así state/activeFormat reflejan el estado corregido
     incluso en BOTH_PRESENT. */
  function detectVaultState(options) {
    var storage;
    try { storage = (options && options.storage) || ls(); }
    catch (e) { storage = null; }

    var v1 = classifyV1(storage);
    var vk2 = classifyVK2Structure(storage);

    var storageErr = anyStorageError(v1.fields, vk2.fields);
    if (storageErr) {
      return Promise.resolve({
        state: 'STORAGE_ERROR', activeFormat: null,
        v1: { status: v1.status, fields: {}, warnings: v1.warnings, errors: v1.errors },
        vk2: { status: vk2.status, fields: {}, warnings: vk2.warnings, errors: vk2.errors },
        warnings: [], errors: [storageErr], checkedAt: Date.now()
      });
    }

    function finish(pepperStatus, extraWarning) {
      var vk2Adjusted = vk2;
      if (pepperStatus === 'missing' && vk2.status === 'READY') {
        vk2Adjusted = {
          status: 'INCOMPLETE',
          fields: vk2.fields,
          pinwrapPresent: vk2.pinwrapPresent,
          warnings: vk2.warnings.concat(['VK2_PINWRAP_WITHOUT_PEPPER']),
          errors: vk2.errors
        };
      }
      var result = buildResult(v1, vk2Adjusted);
      result.vk2.pepperStatus = pepperStatus;
      if (extraWarning) { result.warnings = result.warnings.concat([extraWarning]); }
      return result;
    }

    if (!vk2.pinwrapPresent) {
      return Promise.resolve(finish('unknown'));
    }

    var vc = (options && options.cryptoApi) || cryptoApi();
    if (vc && typeof vc.pepperExists === 'function') {
      return Promise.resolve(vc.pepperExists()).then(
        function (exists) { return finish(exists ? 'available' : 'missing'); },
        function () { return finish('unavailable', 'PEPPER_CHECK_FAILED'); }
      );
    }
    return Promise.resolve(finish('unknown', 'PEPPER_CHECK_UNAVAILABLE'));
  }

  return {
    LIMITS: LIMITS,
    KNOWN_SCHEMA_VERSIONS_MAX: KNOWN_SCHEMA_VERSIONS_MAX,
    KNOWN_CRYPTO_VERSIONS_MAX: KNOWN_CRYPTO_VERSIONS_MAX,
    SALT_BYTES: SALT_BYTES,
    KDF_ALGO: KDF_ALGO,
    APP_NAME: APP_NAME,
    readRawDetailed: readRawDetailed,
    detectVaultStateSync: detectVaultStateSync,
    detectVaultState: detectVaultState,
    _internal: {
      classifyV1: classifyV1, classifyVK2Structure: classifyVK2Structure,
      isStrictBase64: isStrictBase64, isValidBase64Field: isValidBase64Field,
      isValidIvField: isValidIvField, isValidSaltField: isValidSaltField, isValidIterations: isValidIterations,
      utf8ByteLength: utf8ByteLength, rawFits: rawFits
    }
  };
});
