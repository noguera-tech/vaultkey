/* ============================================================
   VaultKey — transaction-store.js (PROPUESTA P0.2, NO integrada)
   Piezas 3 y 4, revisadas tras la ronda de corrección P0.2.

   Cambios respecto a P0.1 relevantes para este archivo:
   - #1  vk_tx_active ahora se lee con detección detallada
         (missing/valid/corrupt/storage_error). beginTransaction
         BLOQUEA si está corrupto o si hay storage_error, en vez
         de tratarlo silenciosamente como "sin transacción".
   - #2  removeKey ahora verifica cada borrado releyendo la clave;
         si falla el borrado o la relectura, lanza un error tipado
         en vez de tragárselo.
   - #6  el digest de integridad cubre TODO el contenedor
         determinista (snapshotVersion, id, transactionId,
         createdAt, reason, sourceState, sourceFormat, data,
         status, integrity.algorithm) excepto integrity.digest.
   - #7  saveSnapshot relee la clave completa y reverifica el
         digest antes de confirmar la escritura.
   - #8  createSnapshot falla (rechaza) ante cualquier
         storage_error al leer las claves reales; nunca produce
         un snapshot VERIFIED con __storageError dentro.
   - #10 markCommitted SOLO fija la fase COMMITTED y la verifica;
         finalizeCommitted() es un paso aparte y explícito que
         borra vk_tx_active/candidate tras comprobar que
         COMMITTED quedó persistido.
   - #11 el snapshot de una operación destructiva (rollback o
         cierre de una transacción que llegó a promover) se migra
         a vk_tx_last_recovery_snapshot de forma explícita; si ya
         había uno, se exige opts.allowOverwriteLastSnapshot=true
         para no sobrescribir en silencio.
   - #14 nombres de clave importados de vault-keys.js.

   Cambios P0.3:
   - #2  beginTransaction bloquea ante CUALQUIER vk_tx_active,
         incluidas fases terminales (COMMITTED/ROLLED_BACK): exige
         finalizeCommitted()/finalizeRolledBack() primero.
   - #4  finalizeCommitted acepta y propaga opts de snapshot; ya
         no oculta un conflicto con vk_tx_last_recovery_snapshot.
   - #5  archiveAndClear distingue 'CANCELLED' (nunca preserva
         snapshot) de 'ROLLED_BACK'/'COMMITTED_DESTRUCTIVE' (sí lo
         preservan): una cancelación temprana no deja rastro falso
         de "último rollback".
   - #6  clearActiveTransaction (genérico) se elimina; se divide
         en cancelTransaction, clearCandidate, finalizeCommitted,
         finalizeRolledBack.
   - #7  loadSnapshot/loadCandidate/loadLastRecoverySnapshot lanzan
         errores tipados distintos para corrupt/storage_error;
         "missing" sigue devolviendo null.
   - #8  saveCandidate exige transactionId/targetFormat/targetState
         + digest de integridad; releé y reverifica antes de
         confirmar.
   - #9  saveSnapshot/saveCandidate exigen pertenecer al
         transactionId de la transacción activa.
   - #15 uuid() ya no usa Math.random como fallback.

   Cambios P0.4:
   - #1  verifyCandidateShape se renombra a verifyCandidate y pasa a
         ser API PÚBLICA (antes solo estaba en _internal).
   - #3  archiveAndClear rechaza con SNAPSHOT_NOT_FOUND si falta el
         snapshot activo cuando el cierre debía preservarlo
         (ROLLED_BACK/COMMITTED_DESTRUCTIVE), sin tocar nada.
   - #5  archiveAndClear reverifica verifySnapshot() ANTES de
         archivar/limpiar; un JSON válido con digest incorrecto
         nunca se archiva ni limpia vk_tx_active.
   - #6  archiveAndClear, cancelTransaction, finalizeCommitted y
         finalizeRolledBack son ahora asíncronas (devuelven Promise).
   - #7  saveCandidate exige candidate.targetFormat/targetState
         idénticos a active.meta.targetFormat/targetState.
   - #8  targetDigest e integrity.digest (candidato y snapshot) se
         validan como SHA-256 hexadecimal de 64 caracteres.
   - #10 vk_tx_active con JSON válido pero estructura imposible
         (transactionId/phase/fechas/meta/history) lanza
         TRANSACTION_STORE_CORRUPT.

   Cambios P0.5 (finishArchive/archiveAndClear):
   - #1  vk_tx_active se elimina ANTES que vk_tx_snapshot (el
         snapshot técnico puede quedar como residuo limpiable, pero
         nunca debe desaparecer mientras exista la transacción).
   - #2  recuperación defensiva vía vk_tx_last_recovery_snapshot si
         falta vk_tx_snapshot: solo se acepta si pertenece al mismo
         transactionId, su digest verifica y su contenido está
         completo.
   - #3  tras escribir vk_tx_last_recovery_snapshot, se relee y se
         compara el contenedor COMPLETO, se reverifica con
         verifySnapshot() y se comprueba transactionId de nuevo.
   - #4  se exige snapshot.transactionId === record.transactionId
         antes de archivar.
   - #5  opts se propaga a TODAS las llamadas a verifySnapshot().
   - #6  el resumen vk_tx_last_recovery se escribe DESPUÉS de haber
         eliminado vk_tx_active, nunca antes.
   ============================================================ */

(function (root, factory) {
  'use strict';
  var keys = (typeof module === 'object' && module.exports) ? require('./vault-keys.js') : (root && root.vkKeys);
  var api = factory(root, keys);
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  if (root) { root.vkTransactionStore = api; }
})(typeof window !== 'undefined' ? window : globalThis, function (root, KEYS) {
  'use strict';

  var K_TX_ACTIVE = KEYS.TX.ACTIVE;
  var K_TX_SNAPSHOT = KEYS.TX.SNAPSHOT;
  var K_TX_CANDIDATE = KEYS.TX.CANDIDATE;
  var K_TX_LAST_RECOVERY = KEYS.TX.LAST_RECOVERY;
  var K_TX_LAST_RECOVERY_SNAPSHOT = KEYS.TX.LAST_RECOVERY_SNAPSHOT;

  var V1_META = KEYS.V1.META, V1_DATA = KEYS.V1.DATA, V1_RECOVERY = KEYS.V1.RECOVERY, V1_BACKUP = KEYS.V1.PIN_CHANGE_BACKUP;
  var VK2_BLOB = KEYS.VK2.BLOB, VK2_PINWRAP = KEYS.VK2.PINWRAP, VK2_META = KEYS.VK2.META;

  var PHASES = [
    'CREATED', 'SNAPSHOT_WRITTEN', 'SNAPSHOT_VERIFIED',
    'CANDIDATE_PREPARED', 'CANDIDATE_VERIFIED',
    'PROMOTION_STARTED', 'PROMOTED', 'FINAL_VERIFIED', 'COMMITTED',
    'ROLLBACK_STARTED', 'ROLLED_BACK', 'FAILED'
  ];

  var TRANSITIONS = {
    CREATED: ['SNAPSHOT_WRITTEN', 'FAILED', 'ROLLBACK_STARTED'],
    SNAPSHOT_WRITTEN: ['SNAPSHOT_VERIFIED', 'FAILED', 'ROLLBACK_STARTED'],
    SNAPSHOT_VERIFIED: ['CANDIDATE_PREPARED', 'FAILED', 'ROLLBACK_STARTED'],
    CANDIDATE_PREPARED: ['CANDIDATE_VERIFIED', 'FAILED', 'ROLLBACK_STARTED'],
    CANDIDATE_VERIFIED: ['PROMOTION_STARTED', 'FAILED', 'ROLLBACK_STARTED'],
    PROMOTION_STARTED: ['PROMOTED', 'FAILED', 'ROLLBACK_STARTED'],
    PROMOTED: ['FINAL_VERIFIED', 'FAILED', 'ROLLBACK_STARTED'],
    FINAL_VERIFIED: ['COMMITTED', 'FAILED', 'ROLLBACK_STARTED'],
    COMMITTED: [],
    ROLLBACK_STARTED: ['ROLLED_BACK', 'FAILED'],
    ROLLED_BACK: [],
    FAILED: ['ROLLBACK_STARTED']
  };

  var TERMINAL_PHASES = ['COMMITTED', 'ROLLED_BACK'];

  function ls() { return (root && root.localStorage) || globalThis.localStorage; }

  function normalizeErr(e) { return { name: (e && e.name) || 'Error', message: (e && e.message) || String(e) }; }

  function err(code, message, extra) {
    var e = new Error(message || code);
    e.code = code;
    if (extra) { for (var k in extra) { e[k] = extra[k]; } }
    return e;
  }

  /* #15: SIN fallback a Math.random (no es criptográficamente
     seguro para identificadores de transacción/snapshot). Si no
     hay randomUUID(), se construye un UUIDv4 a partir de
     crypto.getRandomValues(); si ni siquiera eso existe, se falla
     de forma segura en vez de generar un ID débil. */
  function uuid() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      var bytes = crypto.getRandomValues(new Uint8Array(16));
      bytes[6] = (bytes[6] & 0x0f) | 0x40; /* versión 4 */
      bytes[8] = (bytes[8] & 0x3f) | 0x80; /* variante RFC 4122 */
      var hex = Array.prototype.map.call(bytes, function (b) { return b.toString(16).padStart(2, '0'); }).join('');
      return hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-' + hex.slice(12, 16) + '-' + hex.slice(16, 20) + '-' + hex.slice(20);
    }
    throw err('STORAGE_WRITE_FAILED', 'No hay generador de aleatoriedad criptográfica disponible (crypto.randomUUID / crypto.getRandomValues); no se genera un identificador inseguro.');
  }

  /* ---- lectura de bajo nivel, con distinción explícita de estados ---- */
  function readDetailed(key, storage) {
    var store = storage || ls();
    var raw;
    try { raw = store.getItem(key); }
    catch (e) { return { status: 'storage_error', raw: null, value: null, error: normalizeErr(e) }; }
    if (raw === null || raw === undefined) { return { status: 'missing', raw: null, value: null, error: null }; }
    try { return { status: 'valid', raw: raw, value: JSON.parse(raw), error: null }; }
    catch (e) { return { status: 'corrupt', raw: raw, value: null, error: normalizeErr(e) }; }
  }

  function writeJSON(key, value, storage) {
    (storage || ls()).setItem(key, JSON.stringify(value));
  }

  /* #2: el borrado se verifica SIEMPRE releyendo la clave; nunca
     se traga una excepción de removeItem ni de la relectura. */
  function removeKeyVerified(key, storage) {
    var store = storage || ls();
    try {
      store.removeItem(key);
    } catch (e) {
      throw err('STORAGE_WRITE_FAILED', 'No se pudo eliminar ' + key + '.', { detail: normalizeErr(e) });
    }
    var check;
    try {
      check = store.getItem(key);
    } catch (e) {
      throw err('STORAGE_READ_FAILED', 'No se pudo verificar el borrado de ' + key + '.', { detail: normalizeErr(e) });
    }
    if (check !== null && check !== undefined) {
      throw err('STORAGE_WRITE_FAILED', 'El borrado de ' + key + ' no se pudo verificar: la clave sigue presente.');
    }
  }

  /* ================= #1 — lectura detallada de la transacción activa ================= */

  function readActiveDetailed(storage) { return readDetailed(K_TX_ACTIVE, storage); }

  /* #10 (P0.4): un JSON "válido" no basta. vk_tx_active debe tener
     una forma reconocible: transactionId no vacío, phase dentro del
     enum conocido, createdAt/updatedAt numéricos, meta como objeto
     y history como array de entradas {phase,at} válidas. Un objeto
     vacío o con campos imposibles se trata como corrupción, no
     como una transacción legítima con campos raros. */
  function isValidActiveRecord(v) {
    if (!v || typeof v !== 'object' || Array.isArray(v)) { return false; }
    if (typeof v.transactionId !== 'string' || v.transactionId.length === 0) { return false; }
    if (PHASES.indexOf(v.phase) === -1) { return false; }
    if (typeof v.createdAt !== 'number' || !isFinite(v.createdAt)) { return false; }
    if (typeof v.updatedAt !== 'number' || !isFinite(v.updatedAt)) { return false; }
    if (!v.meta || typeof v.meta !== 'object' || Array.isArray(v.meta)) { return false; }
    if (!Array.isArray(v.history) || v.history.length === 0) { return false; }
    for (var i = 0; i < v.history.length; i++) {
      var h = v.history[i];
      if (!h || typeof h !== 'object' || PHASES.indexOf(h.phase) === -1 || typeof h.at !== 'number' || !isFinite(h.at)) {
        return false;
      }
    }
    return true;
  }

  /* getActiveTransaction ahora LANZA en corrupt/storage_error en vez
     de devolver null: "ausente", "corrupto" y "error de storage" son
     tres cosas distintas y no deben confundirse en ningún llamador. */
  function getActiveTransaction(storage) {
    var d = readActiveDetailed(storage);
    if (d.status === 'storage_error') {
      throw err('STORAGE_READ_FAILED', 'No se pudo leer ' + K_TX_ACTIVE + '.', { detail: d.error });
    }
    if (d.status === 'corrupt') {
      throw err('TRANSACTION_STORE_CORRUPT', K_TX_ACTIVE + ' contiene JSON corrupto.', { detail: d.error });
    }
    if (d.status === 'valid' && !isValidActiveRecord(d.value)) {
      throw err('TRANSACTION_STORE_CORRUPT', K_TX_ACTIVE + ' es JSON válido pero su estructura es inválida o imposible.');
    }
    return d.value; /* null si 'missing' */
  }

  function beginTransaction(meta, storage) {
    var active = getActiveTransaction(storage); /* lanza si corrupto/storage_error: NO se puede decidir con seguridad */
    if (active) {
      /* #2: CUALQUIER vk_tx_active bloquea, incluidas las fases
         terminales (COMMITTED/ROLLED_BACK). Una transacción
         terminal que sigue en vk_tx_active significa que su
         limpieza (finalizeCommitted/finalizeRolledBack) no se
         completó todavía; hay que resolver eso primero, nunca
         empezar una transacción nueva por encima. */
      if (TERMINAL_PHASES.indexOf(active.phase) !== -1) {
        throw err('TRANSACTION_NOT_FINALIZED',
          'Existe una transacción ' + active.phase + ' (' + active.transactionId + ') sin finalizar. ' +
          'Llama a finalizeCommitted()/finalizeRolledBack() o a recoverInterruptedTransaction() antes de iniciar otra.');
      }
      throw err('TRANSACTION_ALREADY_ACTIVE', 'Ya existe una transacción activa: ' + active.transactionId);
    }
    var now = Date.now();
    var record = {
      transactionId: uuid(),
      phase: 'CREATED',
      createdAt: now,
      updatedAt: now,
      meta: meta || {},
      history: [{ phase: 'CREATED', at: now }]
    };
    writeJSON(K_TX_ACTIVE, record, storage);
    var check = getActiveTransaction(storage);
    if (!check || check.transactionId !== record.transactionId) {
      throw err('STORAGE_WRITE_FAILED', 'No se pudo verificar la escritura de la transacción nueva.');
    }
    return record;
  }

  function setTransactionPhase(transactionId, phase, patch, storage) {
    if (PHASES.indexOf(phase) === -1) {
      throw err('INVALID_PHASE_TRANSITION', 'Fase desconocida: ' + phase);
    }
    var active = getActiveTransaction(storage);
    if (!active) { throw err('TRANSACTION_NOT_FOUND', 'No hay transacción activa.'); }
    if (active.transactionId !== transactionId) {
      throw err('TRANSACTION_ID_MISMATCH', 'El transactionId no coincide con la transacción activa.');
    }
    var allowed = TRANSITIONS[active.phase] || [];
    if (allowed.indexOf(phase) === -1) {
      throw err('INVALID_PHASE_TRANSITION', 'Transición no permitida: ' + active.phase + ' -> ' + phase);
    }
    var now = Date.now();
    var updated = {
      transactionId: active.transactionId,
      phase: phase,
      createdAt: active.createdAt,
      updatedAt: now,
      meta: active.meta,
      history: active.history.concat([{ phase: phase, at: now }])
    };
    if (patch) {
      for (var k in patch) {
        if (k !== 'transactionId' && k !== 'phase' && k !== 'history' && k !== 'createdAt') { updated[k] = patch[k]; }
      }
    }
    writeJSON(K_TX_ACTIVE, updated, storage);
    var check = getActiveTransaction(storage);
    if (!check || check.phase !== phase) {
      throw err('STORAGE_WRITE_FAILED', 'La fase no se pudo verificar tras escribir.');
    }
    return updated;
  }

  /* #10: markCommitted SOLO fija y verifica la fase COMMITTED.
     NO borra nada. finalizeCommitted() es el paso explícito
     posterior que limpia active/candidate una vez comprobado que
     COMMITTED quedó persistido y es releíble. */
  function markCommitted(transactionId, storage) {
    return setTransactionPhase(transactionId, 'COMMITTED', null, storage);
  }

  function markFailed(transactionId, errorCode, storage) {
    return setTransactionPhase(transactionId, 'FAILED', { errorCode: errorCode }, storage);
  }

  var CANCELLABLE_PHASES = ['CREATED', 'SNAPSHOT_WRITTEN', 'SNAPSHOT_VERIFIED', 'CANDIDATE_PREPARED', 'CANDIDATE_VERIFIED'];

  /* #5/#11 (P0.3): archiveAndClear exige un "kind" explícito que
     documenta QUÉ tipo de cierre es, y decide en consecuencia si el
     snapshot se conserva como recuperación o se descarta:
       - 'CANCELLED'            -> nunca se llegó a escribir nada
                                    destructivo sobre la bóveda real;
                                    el snapshot se descarta (no tiene
                                    valor de recuperación).
       - 'ROLLED_BACK'          -> hubo una restauración real; el
                                    snapshot usado se conserva en
                                    vk_tx_last_recovery_snapshot.
       - 'COMMITTED_DESTRUCTIVE'-> hubo una promoción real
                                    confirmada; el snapshot previo a
                                    esa promoción se conserva por si
                                    hiciera falta recuperación manual
                                    futura.
     #5/#6 (P0.4): archiveAndClear es ASÍNCRONA porque debe
     reverificar el digest del snapshot (SHA-256, async) ANTES de
     archivarlo o de limpiar vk_tx_active. Un JSON sintácticamente
     válido con digest incorrecto NUNCA se archiva ni dispara la
     limpieza: se rechaza con SNAPSHOT_CORRUPT y se conservan TODOS
     los artefactos (candidate, snapshot, active) intactos.
     #3/#4 (P0.4): si el cierre requiere preservar el snapshot
     ('ROLLED_BACK'/'COMMITTED_DESTRUCTIVE') y no hay snapshot
     activo, se rechaza con SNAPSHOT_NOT_FOUND sin tocar nada.

     Cambios P0.5:
     - #1 finishArchive elimina vk_tx_active ANTES que vk_tx_snapshot
       (el snapshot técnico puede quedar como residuo limpiable,
       pero vk_tx_active nunca debe quedar sin snapshot mientras
       sigue existiendo).
     - #2 si falta vk_tx_snapshot, se intenta un respaldo defensivo
       con vk_tx_last_recovery_snapshot, solo si pertenece al MISMO
       transactionId, su digest verifica y su contenido está
       completo (isCompleteSnapshotData).
     - #3 tras escribir vk_tx_last_recovery_snapshot, se relee y se
       compara el CONTENEDOR COMPLETO (stableStringify), se
       reverifica con verifySnapshot() y se comprueba transactionId,
       no solo el id.
     - #4 antes de archivar, se exige snapshot.transactionId ===
       record.transactionId.
     - #5 opts se propaga a TODAS las llamadas a verifySnapshot(),
       incluida la de la copia archivada releída.
     - #6 el resumen vk_tx_last_recovery se escribe DESPUÉS de haber
       eliminado vk_tx_active con éxito, nunca antes: nunca afirma
       una finalización que todavía no ha ocurrido. */
  function snapshotNotFoundError(kind) {
    return err('SNAPSHOT_NOT_FOUND',
      'No se puede finalizar (' + kind + '): falta el snapshot activo que debía preservarse ' +
      'y no hay un respaldo válido en ' + K_TX_LAST_RECOVERY_SNAPSHOT + '. No se ha modificado ningún artefacto.');
  }

  /* #2: un respaldo en vk_tx_last_recovery_snapshot solo sirve si
     tiene la forma completa de un snapshot real (mismas claves que
     produce collectV1Raw/collectVK2Raw), no basta con que "parezca"
     un objeto cualquiera con esos nombres. */
  function isCompleteSnapshotData(snapshot) {
    if (!snapshot || !snapshot.data) { return false; }
    var v1 = snapshot.data.v1, vk2 = snapshot.data.vk2;
    if (!v1 || typeof v1 !== 'object' || Array.isArray(v1)) { return false; }
    if (!vk2 || typeof vk2 !== 'object' || Array.isArray(vk2)) { return false; }
    var v1Keys = ['metaRaw', 'dataRaw', 'recoveryRaw', 'pinChangeBackupRaw'];
    var vk2Keys = ['blobRaw', 'pinWrapRaw', 'metaRaw', 'pepperStatus'];
    for (var i = 0; i < v1Keys.length; i++) { if (!(v1Keys[i] in v1)) { return false; } }
    for (var j = 0; j < vk2Keys.length; j++) { if (!(vk2Keys[j] in vk2)) { return false; } }
    return true;
  }

  function archiveAndClear(record, storage, kind, opts) {
    opts = opts || {};
    var preserveSnapshot = (kind === 'ROLLED_BACK' || kind === 'COMMITTED_DESTRUCTIVE');

    return Promise.resolve().then(function () {
      if (!preserveSnapshot) {
        /* 'CANCELLED': nunca se llegó a escribir nada destructivo;
           el contenido del snapshot es irrelevante, solo se
           descarta. Si vk_tx_snapshot no existe, no pasa nada. */
        finishArchive(record, storage, kind, false);
        return;
      }

      var snapshot = loadSnapshot(storage); /* puede lanzar SNAPSHOT_CORRUPT/STORAGE_READ_FAILED: se propaga tal cual */

      if (!snapshot) {
        /* #2: recuperación defensiva. Solo se acepta un respaldo en
           vk_tx_last_recovery_snapshot si pertenece a ESTA misma
           transacción, verifica su propio digest y tiene la forma
           completa de un snapshot real. Cualquier fallo en estas
           comprobaciones (incluida una lectura corrupta del propio
           respaldo) se trata igual que "no hay respaldo utilizable". */
        var fallback = null;
        try { fallback = loadLastRecoverySnapshot(storage); }
        catch (e) { fallback = null; }

        if (!fallback || fallback.transactionId !== record.transactionId) {
          throw snapshotNotFoundError(kind);
        }
        return verifySnapshot(fallback, opts).then(function (fv) {
          if (!fv.ok || !isCompleteSnapshotData(fallback)) {
            throw snapshotNotFoundError(kind);
          }
          /* El respaldo ya es válido, pertenece a esta transacción y
             está completo: no hace falta reescribirlo, basta con
             completar la finalización usándolo como snapshot
             conservado. */
          finishArchive(record, storage, kind, true);
        });
      }

      /* #4: el snapshot debe pertenecer a ESTA transacción antes de
         archivarlo bajo ningún concepto. */
      if (snapshot.transactionId !== record.transactionId) {
        throw err('TRANSACTION_ID_MISMATCH',
          'El snapshot activo pertenece a otra transacción (' + snapshot.transactionId + '); ' +
          'no se archiva ni se limpia ' + K_TX_ACTIVE + '.');
      }

      return verifySnapshot(snapshot, opts).then(function (v) {
        if (!v.ok) {
          throw err('SNAPSHOT_CORRUPT',
            'El snapshot activo no verifica su digest (' + v.reason + '); no se archiva ni se limpia ' + K_TX_ACTIVE + '. ' +
            'No se ha modificado ningún artefacto.');
        }

        var existing = readDetailed(K_TX_LAST_RECOVERY_SNAPSHOT, storage);
        if (existing.status === 'storage_error') {
          throw err('STORAGE_READ_FAILED', 'No se pudo leer ' + K_TX_LAST_RECOVERY_SNAPSHOT + ' antes de migrar el snapshot.', { detail: existing.error });
        }
        if (existing.status === 'corrupt') {
          throw err('SNAPSHOT_WRITE_FAILED', K_TX_LAST_RECOVERY_SNAPSHOT + ' contiene JSON corrupto; requiere revisión manual antes de sobrescribir.');
        }
        var existingDifferent = existing.status === 'valid' && existing.value && existing.value.id !== snapshot.id;
        if (existingDifferent && opts.allowOverwriteLastSnapshot !== true) {
          throw err('SNAPSHOT_WRITE_FAILED',
            'Ya existe un snapshot de recuperación previo (' + existing.value.id + '); ' +
            'se requiere opts.allowOverwriteLastSnapshot=true para sobrescribirlo.');
        }

        writeJSON(K_TX_LAST_RECOVERY_SNAPSHOT, snapshot, storage);

        /* #3: no basta comprobar el id. Se relee y se compara el
           CONTENEDOR COMPLETO, se reverifica el digest (con opts
           propagado, #5) y se comprueba transactionId de nuevo
           sobre la copia releída, no sobre el original en memoria. */
        var checkSnap = readDetailed(K_TX_LAST_RECOVERY_SNAPSHOT, storage);
        if (checkSnap.status !== 'valid') {
          throw err('SNAPSHOT_WRITE_FAILED', 'La copia archivada en ' + K_TX_LAST_RECOVERY_SNAPSHOT + ' no se pudo releer como JSON válido.');
        }
        if (stableStringify(checkSnap.value) !== stableStringify(snapshot)) {
          throw err('SNAPSHOT_WRITE_FAILED', 'La copia archivada releída no coincide con el snapshot que se pretendía migrar.');
        }
        if (checkSnap.value.transactionId !== record.transactionId) {
          throw err('SNAPSHOT_WRITE_FAILED', 'La copia archivada releída no pertenece a esta transacción.');
        }
        return verifySnapshot(checkSnap.value, opts).then(function (v2) {
          if (!v2.ok) {
            throw err('SNAPSHOT_WRITE_FAILED', 'La copia archivada releída no verifica su digest (' + v2.reason + ').');
          }
          finishArchive(record, storage, kind, true);
        });
      });
    });
  }

  /* #1/#6 (P0.5): orden estricto:
       1) candidate (artefacto secundario, sin valor de recuperación)
       2) vk_tx_active (la transacción deja de existir)
       3) SOLO ENTONCES se escribe el resumen vk_tx_last_recovery,
          que por tanto nunca puede afirmar una finalización que
          todavía no ha ocurrido de verdad.
       4) vk_tx_snapshot se limpia el ÚLTIMO, como residuo técnico:
          si este paso falla, la transacción ya no existe (paso 2 ya
          se completó) y el residuo es inofensivo y limpiable más
          tarde; pero el fallo SÍ se propaga como rechazo para que
          el llamador sepa que la limpieza no terminó al 100%. */
  function finishArchive(record, storage, kind, hasRecoverableSnapshot) {
    removeKeyVerified(K_TX_CANDIDATE, storage);
    removeKeyVerified(K_TX_ACTIVE, storage);

    writeJSON(K_TX_LAST_RECOVERY, {
      transactionId: record.transactionId,
      finalPhase: record.phase,
      kind: kind,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      historyLength: record.history.length,
      hasRecoverableSnapshot: !!hasRecoverableSnapshot
    }, storage);

    removeKeyVerified(K_TX_SNAPSHOT, storage);
  }

  function requireActiveMatch(transactionId, storage) {
    var active = getActiveTransaction(storage);
    if (!active) { throw err('TRANSACTION_NOT_FOUND', 'No hay transacción activa.'); }
    if (active.transactionId !== transactionId) {
      throw err('TRANSACTION_ID_MISMATCH', 'El transactionId no coincide con la transacción activa.');
    }
    return active;
  }

  /* #6: operaciones con responsabilidad explícita, en vez de un
     clearActiveTransaction() genérico que mezclaba cancelación,
     commit y rollback bajo la misma llamada. */

  /* Cancela una transacción que NO llegó a promover nada real
     (fases pre-promoción). Nunca preserva el snapshot como
     recuperación: no hubo operación destructiva que recuperar. */
  function cancelTransaction(transactionId, storage, opts) {
    return Promise.resolve().then(function () {
      var active = requireActiveMatch(transactionId, storage);
      if (CANCELLABLE_PHASES.indexOf(active.phase) === -1) {
        throw err('INVALID_PHASE_TRANSITION', 'cancelTransaction no admite la fase ' + active.phase + '; usa finalizeRolledBack/finalizeCommitted o un rollback.');
      }
      return archiveAndClear(active, storage, 'CANCELLED', opts);
    });
  }

  /* #4: finalizeCommitted acepta y propaga opts de snapshot
     (allowOverwriteLastSnapshot); si hay conflicto con un snapshot
     de recuperación previo, NO lo oculta: propaga el rechazo.
     #3: si falta el snapshot activo, rechaza con SNAPSHOT_NOT_FOUND
     y no modifica ningún artefacto. Async por #6. */
  function finalizeCommitted(transactionId, storage, opts) {
    return Promise.resolve().then(function () {
      var active = requireActiveMatch(transactionId, storage);
      if (active.phase !== 'COMMITTED') {
        throw err('INVALID_PHASE_TRANSITION', 'finalizeCommitted requiere fase COMMITTED, actual: ' + active.phase);
      }
      return archiveAndClear(active, storage, 'COMMITTED_DESTRUCTIVE', opts);
    });
  }

  function finalizeRolledBack(transactionId, storage, opts) {
    return Promise.resolve().then(function () {
      var active = requireActiveMatch(transactionId, storage);
      if (active.phase !== 'ROLLED_BACK') {
        throw err('INVALID_PHASE_TRANSITION', 'finalizeRolledBack requiere fase ROLLED_BACK, actual: ' + active.phase);
      }
      return archiveAndClear(active, storage, 'ROLLED_BACK', opts);
    });
  }

  function clearCandidate(transactionId, storage) {
    var active = getActiveTransaction(storage);
    if (active && transactionId && active.transactionId !== transactionId) {
      throw err('TRANSACTION_ID_MISMATCH', 'No se puede limpiar el candidato de otra transacción.');
    }
    removeKeyVerified(K_TX_CANDIDATE, storage);
  }

  /* ================= snapshot: lectura cruda ================= */

  function readRawValueOrNull(key, storage) {
    var store = storage || ls();
    try {
      var v = store.getItem(key);
      return v === undefined ? null : v;
    } catch (e) {
      return { __storageError: normalizeErr(e) };
    }
  }

  function isStorageErrorMarker(v) { return v !== null && typeof v === 'object' && v.__storageError; }

  function collectV1Raw(storage) {
    return {
      metaRaw: readRawValueOrNull(V1_META, storage),
      dataRaw: readRawValueOrNull(V1_DATA, storage),
      recoveryRaw: readRawValueOrNull(V1_RECOVERY, storage),
      pinChangeBackupRaw: readRawValueOrNull(V1_BACKUP, storage)
    };
  }
  function collectVK2Raw(storage, pepperStatus) {
    return {
      blobRaw: readRawValueOrNull(VK2_BLOB, storage),
      pinWrapRaw: readRawValueOrNull(VK2_PINWRAP, storage),
      metaRaw: readRawValueOrNull(VK2_META, storage),
      pepperStatus: pepperStatus || 'unknown'
    };
  }

  function findStorageErrorKey(v1, vk2) {
    var map = { metaRaw_v1: v1.metaRaw, dataRaw_v1: v1.dataRaw, recoveryRaw_v1: v1.recoveryRaw, pinChangeBackupRaw_v1: v1.pinChangeBackupRaw,
      blobRaw_vk2: vk2.blobRaw, pinWrapRaw_vk2: vk2.pinWrapRaw, metaRaw_vk2: vk2.metaRaw };
    for (var k in map) { if (isStorageErrorMarker(map[k])) { return k; } }
    return null;
  }

  /* ================= integridad: stable stringify + sha256 ================= */

  function stableStringify(value) {
    if (value === null || typeof value !== 'object') { return JSON.stringify(value); }
    if (Array.isArray(value)) { return '[' + value.map(stableStringify).join(',') + ']'; }
    var keys = Object.keys(value).sort();
    return '{' + keys.map(function (k) { return JSON.stringify(k) + ':' + stableStringify(value[k]); }).join(',') + '}';
  }

  /* #8 (P0.4): valida que un digest declarado tenga la FORMA de un
     SHA-256 hexadecimal (64 caracteres hex) antes de compararlo o
     de confiar en él. Un campo con forma imposible (vacío, corto,
     con caracteres fuera de rango) nunca se trata como un digest
     válido, se haya calculado o no. */
  var SHA256_HEX_RE = /^[0-9a-fA-F]{64}$/;
  function isSha256Hex(v) { return typeof v === 'string' && SHA256_HEX_RE.test(v); }

  function sha256Hex(str, injected) {
    if (injected) { return Promise.resolve(injected(str)); }
    if (typeof root !== 'undefined' && root && root.crypto && root.crypto.subtle) {
      var enc = new TextEncoder().encode(str);
      return root.crypto.subtle.digest('SHA-256', enc).then(function (buf) {
        return Array.prototype.map.call(new Uint8Array(buf), function (b) { return b.toString(16).padStart(2, '0'); }).join('');
      });
    }
    try {
      var nodeCrypto = require('crypto');
      return Promise.resolve(nodeCrypto.createHash('sha256').update(str, 'utf8').digest('hex'));
    } catch (e) {
      return Promise.reject(err('STORAGE_READ_FAILED', 'No hay proveedor SHA-256 disponible en este entorno.'));
    }
  }

  /* #6: el digest cubre TODO el contenedor determinista salvo el
     propio digest. Se congela integrity.digest a null antes de
     serializar, para que el cálculo sea reproducible en
     verifySnapshot sin depender de mutar el objeto original. */
  function containerForDigest(container) {
    return Object.assign({}, container, {
      integrity: { algorithm: container.integrity.algorithm, digest: null }
    });
  }

  /* #8: falla ante cualquier storage_error real; nunca produce un
     snapshot VERIFIED que contenga __storageError. */
  function createSnapshot(opts, storage) {
    opts = opts || {};
    var storageRef = storage || ls();
    var v1 = collectV1Raw(storageRef);
    var vk2 = collectVK2Raw(storageRef, opts.pepperStatus);

    var badKey = findStorageErrorKey(v1, vk2);
    if (badKey) {
      return Promise.reject(err('STORAGE_READ_FAILED', 'No se puede crear el snapshot: storage_error al leer ' + badKey + '.'));
    }

    var container = {
      snapshotVersion: 1,
      id: uuid(),
      transactionId: opts.transactionId || null,
      createdAt: Date.now(),
      reason: opts.reason || 'UNSPECIFIED',
      sourceState: (opts.detectedState && opts.detectedState.state) || null,
      sourceFormat: (opts.detectedState && opts.detectedState.activeFormat) || null,
      data: { v1: v1, vk2: vk2 },
      integrity: { algorithm: 'SHA-256', digest: null },
      status: 'VERIFIED'
    };

    var canonical = stableStringify(containerForDigest(container));
    return sha256Hex(canonical, opts.digestFn).then(function (digest) {
      container.integrity.digest = digest;
      return container;
    });
  }

  function verifySnapshot(snapshot, opts) {
    opts = opts || {};
    if (!snapshot || !snapshot.data || !snapshot.integrity || !isSha256Hex(snapshot.integrity.digest)) {
      return Promise.resolve({ ok: false, reason: 'SNAPSHOT_CORRUPT' });
    }
    var canonical = stableStringify(containerForDigest(snapshot));
    return sha256Hex(canonical, opts.digestFn).then(function (digest) {
      return { ok: digest === snapshot.integrity.digest, reason: digest === snapshot.integrity.digest ? null : 'DIGEST_MISMATCH' };
    }, function () {
      return { ok: false, reason: 'DIGEST_COMPUTE_FAILED' };
    });
  }

  /* #7: helper genérico para exponer missing/corrupt/storage_error
     como estados DISTINTOS mediante errores tipados, en vez de
     colapsar corrupt y storage_error en "null" como si fueran
     "ausente". */
  function loadTyped(key, corruptCode, storage) {
    var d = readDetailed(key, storage);
    if (d.status === 'missing') { return null; }
    if (d.status === 'storage_error') {
      throw err('STORAGE_READ_FAILED', 'No se pudo leer ' + key + '.', { detail: d.error });
    }
    if (d.status === 'corrupt') {
      throw err(corruptCode, key + ' contiene JSON corrupto.', { detail: d.error });
    }
    return d.value;
  }

  /* #9: el snapshot debe pertenecer a la transacción activa. Se
     comprueba ANTES de escribir para no dejar en disco un snapshot
     huérfano de otra transacción.
     #7: escribe, RELEE la clave completa, compara byte a byte con
     lo que se pretendía escribir y reverifica el digest antes de
     dar la escritura por buena. */
  function saveSnapshot(snapshot, storage) {
    /* Async de punta a punta (incluidas las validaciones previas a
       escribir): así CUALQUIER fallo, incluida la pertenencia a la
       transacción activa, llega como rechazo de promesa y no como
       excepción síncrona — consistente con el resto de la API
       async de snapshot/candidato. */
    return Promise.resolve().then(function () {
      var storageRef = storage || ls();
      var active = getActiveTransaction(storageRef);
      if (!active) { throw err('TRANSACTION_NOT_FOUND', 'No hay transacción activa a la que asociar el snapshot.'); }
      if (!snapshot || snapshot.transactionId !== active.transactionId) {
        throw err('TRANSACTION_ID_MISMATCH', 'El snapshot no pertenece a la transacción activa (' + active.transactionId + ').');
      }
      writeJSON(K_TX_SNAPSHOT, snapshot, storageRef);
      var reread = readDetailed(K_TX_SNAPSHOT, storageRef);
      if (reread.status !== 'valid') {
        throw err('SNAPSHOT_WRITE_FAILED', 'El snapshot releído no es JSON válido (status=' + reread.status + ').');
      }
      if (stableStringify(reread.value) !== stableStringify(snapshot)) {
        throw err('SNAPSHOT_WRITE_FAILED', 'El snapshot releído no coincide con el escrito.');
      }
      return verifySnapshot(reread.value).then(function (v) {
        if (!v.ok) { throw err('SNAPSHOT_WRITE_FAILED', 'El digest del snapshot releído no verifica (' + v.reason + ').'); }
        return reread.value;
      });
    });
  }
  function loadSnapshot(storage) { return loadTyped(K_TX_SNAPSHOT, 'SNAPSHOT_CORRUPT', storage); }

  /* #8/#9: el candidato debe declarar transactionId/targetFormat/
     targetState y un digest de integridad; se comprueba que
     pertenece a la transacción activa, se escribe, se RELEE, se
     compara byte a byte y se reverifica el digest antes de
     confirmar. */
  function candidateForDigest(c) {
    return Object.assign({}, c, { integrity: { algorithm: c.integrity.algorithm, digest: null } });
  }
  /* candidate.integrity.digest = autointegridad del propio objeto
     candidato (detecta manipulación/corrupción del candidato, igual
     que el snapshot). candidate.targetDigest = hash del contenido
     REAL de storage que se espera tras la promoción; es lo que la
     recuperación compara contra computeCurrentDigest(). Son dos
     cosas distintas a propósito: mezclar "el candidato no está
     corrupto" con "la promoción escribió lo que dijo que iba a
     escribir" en un solo campo impediría verificar cualquiera de
     las dos por separado. Esta decisión queda aprobada y sin tocar.

     #1 (P0.4): se expone como API PÚBLICA verifyCandidate(), para
     que recoverInterruptedTransaction (y cualquier otro llamador)
     recalcule y verifique el digest ANTES de confiar en
     transactionId/targetFormat/targetState/targetDigest — loadCandidate()
     por sí solo NUNCA es suficiente, solo confirma que el JSON es
     sintácticamente válido, no que no ha sido alterado.
     #8 (P0.4): targetDigest e integrity.digest deben tener forma de
     SHA-256 hexadecimal de 64 caracteres; si no, CANDIDATE_INVALID. */
  function verifyCandidate(candidate) {
    if (!candidate || !candidate.transactionId || !candidate.targetFormat || !candidate.targetState ||
      !isSha256Hex(candidate.targetDigest) || !candidate.integrity || !isSha256Hex(candidate.integrity.digest)) {
      return Promise.resolve({ ok: false, reason: 'CANDIDATE_INVALID' });
    }
    var canonical = stableStringify(candidateForDigest(candidate));
    return sha256Hex(canonical).then(function (digest) {
      return { ok: digest === candidate.integrity.digest, reason: digest === candidate.integrity.digest ? null : 'DIGEST_MISMATCH' };
    }, function () {
      return { ok: false, reason: 'DIGEST_COMPUTE_FAILED' };
    });
  }
  function saveCandidate(candidate, storage) {
    return Promise.resolve().then(function () {
    var storageRef = storage || ls();
    var active = getActiveTransaction(storageRef);
    if (!active) { throw err('TRANSACTION_NOT_FOUND', 'No hay transacción activa a la que asociar el candidato.'); }
    return verifyCandidate(candidate).then(function (v) {
      if (!v.ok) { throw err('CANDIDATE_INVALID', 'Candidato inválido: ' + v.reason); }
      if (candidate.transactionId !== active.transactionId) {
        throw err('TRANSACTION_ID_MISMATCH', 'El candidato no pertenece a la transacción activa (' + active.transactionId + ').');
      }
      /* #7 (P0.4): el candidato debe declarar EXACTAMENTE el mismo
         target que la propia transacción declaró al empezar (o no
         se guarda). Un candidato con un target distinto al de
         meta.targetFormat/targetState nunca es válido para ESTA
         transacción, aunque su propio digest verifique. */
      var metaTargetFormat = active.meta && active.meta.targetFormat;
      var metaTargetState = active.meta && active.meta.targetState;
      if (candidate.targetFormat !== metaTargetFormat || candidate.targetState !== metaTargetState) {
        throw err('CANDIDATE_INVALID',
          'El target del candidato (' + candidate.targetFormat + '/' + candidate.targetState + ') no coincide ' +
          'con el target declarado por la transacción (' + metaTargetFormat + '/' + metaTargetState + ').');
      }
      writeJSON(K_TX_CANDIDATE, candidate, storageRef);
      var reread = readDetailed(K_TX_CANDIDATE, storageRef);
      if (reread.status !== 'valid') { throw err('CANDIDATE_INVALID', 'El candidato releído no es JSON válido.'); }
      if (stableStringify(reread.value) !== stableStringify(candidate)) {
        throw err('CANDIDATE_INVALID', 'El candidato releído no coincide con el escrito.');
      }
      return verifyCandidate(reread.value).then(function (v2) {
        if (!v2.ok) { throw err('CANDIDATE_INVALID', 'El digest del candidato releído no verifica (' + v2.reason + ').'); }
        return reread.value;
      });
    });
    });
  }
  function loadCandidate(storage) { return loadTyped(K_TX_CANDIDATE, 'CANDIDATE_INVALID', storage); }
  function loadLastRecoverySnapshot(storage) { return loadTyped(K_TX_LAST_RECOVERY_SNAPSHOT, 'SNAPSHOT_CORRUPT', storage); }

  /* Digest del estado ACTUAL de storage para un formato dado, con
     la misma serialización que el snapshot. Se usa en recuperación
     (#5) para comparar contra candidate.integrity.digest y
     confirmar que la promoción escribió EXACTAMENTE lo esperado,
     no solo "algo que quedó READY". */
  function computeCurrentDigest(format, storage, opts) {
    opts = opts || {};
    var storageRef = storage || ls();
    var data;
    if (format === 'V1') { data = collectV1Raw(storageRef); }
    else if (format === 'VK2') { data = collectVK2Raw(storageRef, opts.pepperStatus); }
    else { return Promise.reject(err('CANDIDATE_INVALID', 'Formato desconocido: ' + format)); }
    var badKey = findStorageErrorKey(format === 'V1' ? data : {}, format === 'VK2' ? data : {});
    if (badKey) { return Promise.reject(err('STORAGE_READ_FAILED', 'storage_error al recomputar digest en ' + badKey + '.')); }
    return sha256Hex(stableStringify(data), opts.digestFn);
  }

  function restoreRawValue(key, rawValue, storage) {
    var store = storage || ls();
    if (rawValue === null) { removeKeyVerified(key, store); return; }
    if (isStorageErrorMarker(rawValue)) {
      throw err('ROLLBACK_FAILED', 'No se puede restaurar ' + key + ': el snapshot registró un storage_error.');
    }
    try {
      store.setItem(key, rawValue);
    } catch (e) {
      throw err('STORAGE_WRITE_FAILED', 'No se pudo escribir ' + key + ' durante el rollback.', { detail: normalizeErr(e) });
    }
  }

  function restoreSnapshot(snapshot, storage, opts) {
    opts = opts || {};
    var storageRef = storage || ls();
    return verifySnapshot(snapshot, opts).then(function (verification) {
      if (!verification.ok) { return { ok: false, reason: verification.reason || 'ROLLBACK_FAILED' }; }
      try {
        var v1 = snapshot.data.v1;
        restoreRawValue(V1_META, v1.metaRaw, storageRef);
        restoreRawValue(V1_DATA, v1.dataRaw, storageRef);
        restoreRawValue(V1_RECOVERY, v1.recoveryRaw, storageRef);
        restoreRawValue(V1_BACKUP, v1.pinChangeBackupRaw, storageRef);

        var vk2 = snapshot.data.vk2;
        restoreRawValue(VK2_BLOB, vk2.blobRaw, storageRef);
        restoreRawValue(VK2_PINWRAP, vk2.pinWrapRaw, storageRef);
        restoreRawValue(VK2_META, vk2.metaRaw, storageRef);
        /* El pepper NUNCA se toca durante el rollback. */
      } catch (e) {
        return { ok: false, reason: e.code || 'ROLLBACK_FAILED', error: normalizeErr(e) };
      }

      var mismatches = [];
      function checkKey(key, expected) {
        var actual = readRawValueOrNull(key, storageRef);
        if (actual !== expected) { mismatches.push(key); }
      }
      checkKey(V1_META, snapshot.data.v1.metaRaw);
      checkKey(V1_DATA, snapshot.data.v1.dataRaw);
      checkKey(V1_RECOVERY, snapshot.data.v1.recoveryRaw);
      checkKey(V1_BACKUP, snapshot.data.v1.pinChangeBackupRaw);
      checkKey(VK2_BLOB, snapshot.data.vk2.blobRaw);
      checkKey(VK2_PINWRAP, snapshot.data.vk2.pinWrapRaw);
      checkKey(VK2_META, snapshot.data.vk2.metaRaw);

      if (mismatches.length > 0) { return { ok: false, reason: 'ROLLBACK_FAILED', mismatches: mismatches }; }
      return { ok: true };
    });
  }

  return {
    KEYS: { K_TX_ACTIVE: K_TX_ACTIVE, K_TX_SNAPSHOT: K_TX_SNAPSHOT, K_TX_CANDIDATE: K_TX_CANDIDATE, K_TX_LAST_RECOVERY: K_TX_LAST_RECOVERY, K_TX_LAST_RECOVERY_SNAPSHOT: K_TX_LAST_RECOVERY_SNAPSHOT },
    PHASES: PHASES.slice(),
    TRANSITIONS: TRANSITIONS,
    readActiveDetailed: readActiveDetailed,
    beginTransaction: beginTransaction,
    getActiveTransaction: getActiveTransaction,
    setTransactionPhase: setTransactionPhase,
    markCommitted: markCommitted,
    markFailed: markFailed,
    cancelTransaction: cancelTransaction,
    finalizeCommitted: finalizeCommitted,
    finalizeRolledBack: finalizeRolledBack,
    clearCandidate: clearCandidate,
    saveSnapshot: saveSnapshot,
    loadSnapshot: loadSnapshot,
    saveCandidate: saveCandidate,
    loadCandidate: loadCandidate,
    loadLastRecoverySnapshot: loadLastRecoverySnapshot,
    createSnapshot: createSnapshot,
    verifySnapshot: verifySnapshot,
    verifyCandidate: verifyCandidate,
    restoreSnapshot: restoreSnapshot,
    computeCurrentDigest: computeCurrentDigest,
    _internal: { stableStringify: stableStringify, sha256Hex: sha256Hex, removeKeyVerified: removeKeyVerified, candidateForDigest: candidateForDigest, isSha256Hex: isSha256Hex, isValidActiveRecord: isValidActiveRecord, isCompleteSnapshotData: isCompleteSnapshotData }
  };
});
