/* Ejecutable desde CUALQUIER cwd: node tests/transaction-recovery.test.js
   o, dentro de tests/: node transaction-recovery.test.js */
'use strict';
var path = require('path');

var mem = {};
globalThis.localStorage = {
  getItem: function (k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
  setItem: function (k, v) { mem[k] = String(v); },
  removeItem: function (k) { delete mem[k]; }
};
function reset() { mem = {}; }

var ts = require(path.join(__dirname, '..', 'transaction-store.js'));
var vs = require(path.join(__dirname, '..', 'vault-state.js'));
var tr = require(path.join(__dirname, '..', 'transaction-recovery.js'));

var pass = 0, fail = 0;
function t(name, cond) {
  if (cond) { pass++; console.log('  \u2714 ' + name); }
  else { fail++; console.log('  \u2718 FALLO: ' + name); }
}

function b64(bytes) { return Buffer.from(bytes).toString('base64'); }
var IV12 = b64(new Uint8Array(12));
var SALT16 = b64(new Uint8Array(16));

function seedValidV1() {
  localStorage.setItem('vk_meta_v1', JSON.stringify({ hash: 'abc' }));
  localStorage.setItem('vk_data_v1', JSON.stringify({ salt: SALT16, iv: IV12, ct: b64([1, 2, 3]) }));
}

async function driveToPhase(txId, phase) {
  var order = ['CREATED', 'SNAPSHOT_WRITTEN', 'SNAPSHOT_VERIFIED', 'CANDIDATE_PREPARED', 'CANDIDATE_VERIFIED', 'PROMOTION_STARTED', 'PROMOTED', 'FINAL_VERIFIED', 'COMMITTED'];
  var idx = order.indexOf(phase);
  for (var i = 1; i <= idx; i++) { ts.setTransactionPhase(txId, order[i]); }
}

async function makeValidCandidate(txId, targetFormat, targetState) {
  var targetDigest = await ts.computeCurrentDigest(targetFormat);
  var draft = { transactionId: txId, targetFormat: targetFormat, targetState: targetState, targetDigest: targetDigest, integrity: { algorithm: 'SHA-256', digest: null } };
  var selfDigest = await ts._internal.sha256Hex(ts._internal.stableStringify(ts._internal.candidateForDigest(draft)));
  draft.integrity.digest = selfDigest;
  return ts.saveCandidate(draft);
}

/* vaultState "espía" para forzar rechazos controlados de detectVaultState */
function rejectingVaultState(errCode) {
  return { detectVaultState: function () { return Promise.reject(Object.assign(new Error('fallo forzado'), { code: errCode })); } };
}

/* P0.6 (corregido): storage "por etapas" para probar el ORDEN REAL de
   la finalización con warning, sin cortar prematuramente en la
   primera lectura de vk_tx_active:
     1. Permite TODAS las lecturas mientras vk_tx_active exista.
     2. Detecta cuándo removeItem('vk_tx_active') terminó con éxito
        (solo entonces activa la siguiente etapa).
     3. Solo DESPUÉS de ese punto, rompe las lecturas de las claves
        V1/VK2 que usa detectVaultState() para clasificar el estado.
     4. Mantiene roto, en todo momento, setItem('vk_tx_last_recovery').
   NOTA DE CALIBRACIÓN: con este storage, detectVaultState() NO
   rechaza — internamente ya captura cada getItem roto y degrada a
   { state: 'STORAGE_ERROR' } de forma resuelta, nunca como rechazo.
   Por tanto stateAfter aquí es 'STORAGE_ERROR', no null. Esto SÍ
   demuestra el orden completo pedido (active se lee -> snapshot se
   archiva -> active se elimina -> falla el resumen -> finishArchive
   resuelve con warning -> detectVaultState se ve afectado después).
   Para probar la rama defensiva stateAfter:null (detectVaultState
   rechazando de verdad) se usa por separado rejectingVaultState. */
function stagedFailureStorage(underlying) {
  var activeRemoved = false;
  var stateKeys = ['vk_meta_v1', 'vk_data_v1', 'vk_recovery_v1', 'vk_pin_change_backup', 'vk2_blob', 'vk2_pinwrap', 'vk2_meta'];
  return {
    getItem: function (k) {
      if (activeRemoved && stateKeys.indexOf(k) !== -1) {
        throw new Error('storage caído tras eliminar vk_tx_active (lectura de estado v1/vk2): ' + k);
      }
      return underlying.getItem(k);
    },
    setItem: function (k, v) {
      if (k === 'vk_tx_last_recovery') {
        throw new Error('fallo simulado al escribir el resumen');
      }
      underlying.setItem(k, v);
    },
    removeItem: function (k) {
      underlying.removeItem(k);
      if (k === 'vk_tx_active') { activeRemoved = true; }
    }
  };
}

(async function () {
  console.log('== sin transacción activa ==');
  reset();
  seedValidV1();
  var r0 = await tr.recoverInterruptedTransaction({ store: ts, vaultState: vs });
  t('NONE cuando no hay transacción activa', r0.action === 'NONE' && r0.stateAfter === 'V1_READY');

  console.log('== transacción CORRUPTA (JSON inválido) -> MANUAL_RECOVERY_REQUIRED ==');
  reset();
  seedValidV1();
  localStorage.setItem('vk_tx_active', '{ corrupto');
  var rCorrupt = await tr.recoverInterruptedTransaction({ store: ts, vaultState: vs });
  t('vk_tx_active corrupto -> MANUAL_RECOVERY_REQUIRED', rCorrupt.action === 'MANUAL_RECOVERY_REQUIRED' && rCorrupt.resolved === false);

  console.log('== #10/#16: vk_tx_active con JSON VÁLIDO pero estructura inválida ==');
  reset();
  seedValidV1();
  localStorage.setItem('vk_tx_active', JSON.stringify({ algo: 'que no es una transacción' }));
  var rBadShape = await tr.recoverInterruptedTransaction({ store: ts, vaultState: vs });
  t('#10: estructura inválida -> MANUAL_RECOVERY_REQUIRED, resolved:false (nunca NONE)', rBadShape.action === 'MANUAL_RECOVERY_REQUIRED' && rBadShape.resolved === false && rBadShape.errorCode === 'TRANSACTION_STORE_CORRUPT');

  console.log('== CREATED -> CLEANED_INCOMPLETE_PREPARATION (no-regresión) ==');
  reset();
  seedValidV1();
  var txA = ts.beginTransaction({ reason: 'TEST' });
  var rA = await tr.recoverInterruptedTransaction({ store: ts, vaultState: vs });
  t('CREATED -> CLEANED_INCOMPLETE_PREPARATION', rA.action === 'CLEANED_INCOMPLETE_PREPARATION' && ts.getActiveTransaction() === null);

  console.log('== #2/#16: SNAPSHOT_WRITTEN con vk_tx_snapshot JSON CORRUPTO ==');
  reset();
  seedValidV1();
  var txCorruptSnap = ts.beginTransaction({ reason: 'TEST' });
  ts.setTransactionPhase(txCorruptSnap.transactionId, 'SNAPSHOT_WRITTEN');
  localStorage.setItem('vk_tx_snapshot', '{ corrupto de verdad');
  var rCorruptSnap = await tr.recoverInterruptedTransaction({ store: ts, vaultState: vs });
  t('#2: snapshot corrupto en SNAPSHOT_WRITTEN -> MANUAL_RECOVERY_REQUIRED (no lanza, no rechaza sin normalizar)', rCorruptSnap.action === 'MANUAL_RECOVERY_REQUIRED' && rCorruptSnap.resolved === false);
  t('la transacción sigue activa para revisión manual', ts.getActiveTransaction() !== null);

  console.log('== #2/#16: SNAPSHOT_WRITTEN con getItem FALLANDO ==');
  reset();
  seedValidV1();
  var txErrSnap = ts.beginTransaction({ reason: 'TEST' });
  var snapErr = await ts.createSnapshot({ transactionId: txErrSnap.transactionId, reason: 'PRE' });
  await ts.saveSnapshot(snapErr);
  ts.setTransactionPhase(txErrSnap.transactionId, 'SNAPSHOT_WRITTEN');
  var flakyStorage = {
    getItem: function (k) {
      if (k === 'vk_tx_snapshot') { throw new Error('disco caído'); }
      return localStorage.getItem(k);
    },
    setItem: localStorage.setItem.bind(localStorage),
    removeItem: localStorage.removeItem.bind(localStorage)
  };
  var rErrSnap = await tr.recoverInterruptedTransaction({ store: ts, vaultState: vs, opts: { storage: flakyStorage } });
  t('#2: getItem lanzando en SNAPSHOT_WRITTEN -> MANUAL_RECOVERY_REQUIRED, resolved:false', rErrSnap.action === 'MANUAL_RECOVERY_REQUIRED' && rErrSnap.resolved === false);

  console.log('== #16: COMMITTED SIN snapshot (nunca se guardó uno real) ==');
  reset();
  seedValidV1();
  var txCommitNoSnap = ts.beginTransaction({ targetFormat: 'V1', targetState: 'V1_READY' });
  await driveToPhase(txCommitNoSnap.transactionId, 'COMMITTED'); /* fases avanzadas sin snapshot real, escenario de prueba */
  var rCommitNoSnap = await tr.recoverInterruptedTransaction({ store: ts, vaultState: vs });
  t('#16: COMMITTED sin snapshot -> MANUAL_RECOVERY_REQUIRED con errorCode SNAPSHOT_NOT_FOUND', rCommitNoSnap.action === 'MANUAL_RECOVERY_REQUIRED' && rCommitNoSnap.resolved === false && rCommitNoSnap.errorCode === 'SNAPSHOT_NOT_FOUND');
  t('la transacción COMMITTED sigue activa (no se completó la finalización)', ts.getActiveTransaction() !== null && ts.getActiveTransaction().phase === 'COMMITTED');

  console.log('== #16: ROLLED_BACK SIN snapshot ==');
  reset();
  seedValidV1();
  var txRBNoSnap = ts.beginTransaction({ reason: 'TEST' });
  ts.setTransactionPhase(txRBNoSnap.transactionId, 'SNAPSHOT_WRITTEN');
  ts.setTransactionPhase(txRBNoSnap.transactionId, 'ROLLBACK_STARTED');
  ts.setTransactionPhase(txRBNoSnap.transactionId, 'ROLLED_BACK'); /* sin snapshot real, escenario de prueba */
  var rRBNoSnap = await tr.recoverInterruptedTransaction({ store: ts, vaultState: vs });
  t('#16: ROLLED_BACK sin snapshot -> MANUAL_RECOVERY_REQUIRED con errorCode SNAPSHOT_NOT_FOUND', rRBNoSnap.action === 'MANUAL_RECOVERY_REQUIRED' && rRBNoSnap.resolved === false && rRBNoSnap.errorCode === 'SNAPSHOT_NOT_FOUND');
  t('la transacción ROLLED_BACK sigue activa', ts.getActiveTransaction() !== null && ts.getActiveTransaction().phase === 'ROLLED_BACK');

  console.log('== #5/#16: snapshot con digest ALTERADO detectado por finalizeCommitted vía COMMITTED ==');
  reset();
  seedValidV1();
  var txAltCommit = ts.beginTransaction({ targetFormat: 'V1', targetState: 'V1_READY' });
  var snapAlt = await ts.createSnapshot({ transactionId: txAltCommit.transactionId, reason: 'PRE' });
  await ts.saveSnapshot(snapAlt);
  await driveToPhase(txAltCommit.transactionId, 'COMMITTED');
  /* Alteración directa del snapshot en storage: JSON sigue siendo
     válido, pero el digest ya no corresponde al contenido. */
  var tamperedSnap = JSON.parse(localStorage.getItem('vk_tx_snapshot'));
  tamperedSnap.data.v1.metaRaw = JSON.stringify({ hash: 'ALTERADO_DESPUES_DE_GUARDAR' });
  localStorage.setItem('vk_tx_snapshot', JSON.stringify(tamperedSnap));
  var rAltCommit = await tr.recoverInterruptedTransaction({ store: ts, vaultState: vs });
  t('#5: digest alterado -> finalizeCommitted rechaza y recovery normaliza a MANUAL_RECOVERY_REQUIRED/SNAPSHOT_CORRUPT', rAltCommit.action === 'MANUAL_RECOVERY_REQUIRED' && rAltCommit.errorCode === 'SNAPSHOT_CORRUPT');
  t('#5: NUNCA se limpia vk_tx_active con un snapshot que no verifica', ts.getActiveTransaction() !== null && ts.getActiveTransaction().phase === 'COMMITTED');
  t('#5: NUNCA se archiva un snapshot que no verifica', ts.loadLastRecoverySnapshot() === null);

  console.log('== #9/#16: detectVaultState() RECHAZADO durante la recuperación ==');
  reset();
  seedValidV1();
  var txDvsReject = ts.beginTransaction({ reason: 'TEST' });
  var rDvsReject = await tr.recoverInterruptedTransaction({ store: ts, vaultState: rejectingVaultState('STORAGE_READ_FAILED') });
  t('#9: si detectVaultState() rechaza durante detectAfter(), se normaliza a MANUAL_RECOVERY_REQUIRED (nunca una excepción sin capturar)', rDvsReject.action === 'MANUAL_RECOVERY_REQUIRED' && rDvsReject.resolved === false);

  console.log('== #7/#16: candidato cuyo target NO coincide con active.meta ==');
  reset();
  seedValidV1();
  var txMismatch = ts.beginTransaction({ targetFormat: 'V1', targetState: 'V1_READY' });
  var snapMismatch = await ts.createSnapshot({ transactionId: txMismatch.transactionId, reason: 'PRE' });
  await ts.saveSnapshot(snapMismatch);
  await driveToPhase(txMismatch.transactionId, 'PROMOTION_STARTED');
  /* Se inyecta directamente en storage un candidato cuyo propio digest
     verifica correctamente (fue construido con makeValidCandidate para
     un target DISTINTO), simulando que saveCandidate() no lo hubiera
     bloqueado por algún motivo — la recuperación debe detectarlo igual. */
  var otherTx = 'tx-generado-aparte';
  var foreignTargetDigest = await ts.computeCurrentDigest('V1');
  var foreignDraft = { transactionId: txMismatch.transactionId, targetFormat: 'VK2', targetState: 'VK2_READY', targetDigest: foreignTargetDigest, integrity: { algorithm: 'SHA-256', digest: null } };
  var foreignSelfDigest = await ts._internal.sha256Hex(ts._internal.stableStringify(ts._internal.candidateForDigest(foreignDraft)));
  foreignDraft.integrity.digest = foreignSelfDigest;
  localStorage.setItem('vk_tx_candidate', JSON.stringify(foreignDraft)); /* bypass directo, JSON íntegro y con digest propio correcto */
  var rMismatch = await tr.recoverInterruptedTransaction({ store: ts, vaultState: vs });
  t('#7: candidato con digest propio válido pero target != active.meta.target -> MANUAL_RECOVERY_REQUIRED CANDIDATE_INVALID', rMismatch.action === 'MANUAL_RECOVERY_REQUIRED' && rMismatch.errorCode === 'CANDIDATE_INVALID');

  console.log('== fases intermedias de cancelación segura (no-regresión) ==');
  for (var _p = 0; _p < 4; _p++) {
    var phase = ['SNAPSHOT_WRITTEN', 'SNAPSHOT_VERIFIED', 'CANDIDATE_PREPARED', 'CANDIDATE_VERIFIED'][_p];
    reset();
    seedValidV1();
    var txP = ts.beginTransaction({ reason: 'TEST' });
    var snapP = await ts.createSnapshot({ transactionId: txP.transactionId, reason: 'PRE' });
    await ts.saveSnapshot(snapP);
    await driveToPhase(txP.transactionId, phase);
    var rP = await tr.recoverInterruptedTransaction({ store: ts, vaultState: vs });
    t(phase + ' -> CLEANED_INCOMPLETE_PREPARATION, bóveda intacta', rP.action === 'CLEANED_INCOMPLETE_PREPARATION' && localStorage.getItem('vk_meta_v1') === JSON.stringify({ hash: 'abc' }));
  }

  console.log('== FINAL_VERIFIED con target+digest correctos -> COMPLETED_VALID_PROMOTION (no-regresión) ==');
  reset();
  seedValidV1();
  var txFV = ts.beginTransaction({ targetFormat: 'V1', targetState: 'V1_READY' });
  var snapFV = await ts.createSnapshot({ transactionId: txFV.transactionId, reason: 'PRE' });
  await ts.saveSnapshot(snapFV);
  await makeValidCandidate(txFV.transactionId, 'V1', 'V1_READY');
  await driveToPhase(txFV.transactionId, 'FINAL_VERIFIED');
  var rFV = await tr.recoverInterruptedTransaction({ store: ts, vaultState: vs });
  t('FINAL_VERIFIED correcto -> COMPLETED_VALID_PROMOTION', rFV.action === 'COMPLETED_VALID_PROMOTION');
  t('transacción queda limpia', ts.getActiveTransaction() === null);

  console.log('== COMMITTED/ROLLED_BACK interrumpidos sin finalizar -> acciones explícitas (no-regresión) ==');
  reset();
  seedValidV1();
  var txH = ts.beginTransaction({ targetFormat: 'V1', targetState: 'V1_READY' });
  var snapH = await ts.createSnapshot({ transactionId: txH.transactionId, reason: 'PRE' });
  await ts.saveSnapshot(snapH);
  await driveToPhase(txH.transactionId, 'COMMITTED');
  var rH = await tr.recoverInterruptedTransaction({ store: ts, vaultState: vs });
  t('COMMITTED sin finalizar -> FINALIZED_COMMITTED', rH.action === 'FINALIZED_COMMITTED' && ts.getActiveTransaction() === null);

  reset();
  seedValidV1();
  var txJ = ts.beginTransaction({ reason: 'TEST' });
  var snapJ = await ts.createSnapshot({ transactionId: txJ.transactionId, reason: 'PRE' });
  await ts.saveSnapshot(snapJ);
  ts.setTransactionPhase(txJ.transactionId, 'SNAPSHOT_WRITTEN');
  ts.setTransactionPhase(txJ.transactionId, 'ROLLBACK_STARTED');
  await ts.restoreSnapshot(snapJ);
  ts.setTransactionPhase(txJ.transactionId, 'ROLLED_BACK');
  var rJ = await tr.recoverInterruptedTransaction({ store: ts, vaultState: vs });
  t('ROLLED_BACK sin finalizar -> FINALIZED_ROLLED_BACK', rJ.action === 'FINALIZED_ROLLED_BACK' && ts.getActiveTransaction() === null);

  console.log('== ROLLBACK_STARTED interrumpido se completa (no-regresión) ==');
  reset();
  seedValidV1();
  var txI = ts.beginTransaction({ reason: 'TEST' });
  var snapI = await ts.createSnapshot({ transactionId: txI.transactionId, reason: 'PRE' });
  await ts.saveSnapshot(snapI);
  localStorage.setItem('vk_meta_v1', JSON.stringify({ hash: 'MUTADO_A_MEDIAS' }));
  ts.setTransactionPhase(txI.transactionId, 'SNAPSHOT_WRITTEN');
  ts.setTransactionPhase(txI.transactionId, 'ROLLBACK_STARTED');
  var rI = await tr.recoverInterruptedTransaction({ store: ts, vaultState: vs });
  t('ROLLBACK_STARTED se completa -> ROLLED_BACK_INVALID_PROMOTION', rI.action === 'ROLLED_BACK_INVALID_PROMOTION');
  t('bóveda restaurada al snapshot', localStorage.getItem('vk_meta_v1') === JSON.stringify({ hash: 'abc' }));

  console.log('== FAILED (no-regresión) ==');
  reset();
  seedValidV1();
  var txK = ts.beginTransaction({});
  ts.markFailed(txK.transactionId, 'ALGO_FALLO');
  var rK = await tr.recoverInterruptedTransaction({ store: ts, vaultState: vs });
  t('FAILED -> MANUAL_RECOVERY_REQUIRED, no resuelto automáticamente', rK.action === 'MANUAL_RECOVERY_REQUIRED' && ts.getActiveTransaction() !== null);

  console.log('== P0.6: orden real con storage por etapas — COMMITTED, resumen falla, detectVaultState degrada a STORAGE_ERROR ==');
  reset();
  seedValidV1();
  var txStagedC = ts.beginTransaction({ targetFormat: 'V1', targetState: 'V1_READY' });
  var snapStagedC = await ts.createSnapshot({ transactionId: txStagedC.transactionId, reason: 'PRE' });
  await ts.saveSnapshot(snapStagedC);
  await driveToPhase(txStagedC.transactionId, 'COMMITTED');
  var stagedC = stagedFailureStorage(localStorage);
  var rStagedC = await tr.recoverInterruptedTransaction({ store: ts, vaultState: vs, opts: { storage: stagedC } });
  t('orden real: action = FINALIZED_WITH_WARNING (se alcanzó finalize, no un corte temprano)', rStagedC.action === 'FINALIZED_WITH_WARNING');
  t('orden real: resolved = true', rStagedC.resolved === true);
  t('orden real: warningCode = RECOVERY_SUMMARY_WRITE_FAILED (el fallo real fue el paso 3)', rStagedC.warningCode === 'RECOVERY_SUMMARY_WRITE_FAILED');
  t('orden real: stateAfter = STORAGE_ERROR (detectVaultState degrada, no rechaza; ver nota de calibración)', rStagedC.stateAfter === 'STORAGE_ERROR');
  t('orden real: NUNCA MANUAL_RECOVERY_REQUIRED', rStagedC.action !== 'MANUAL_RECOVERY_REQUIRED');
  t('orden real: vk_tx_active quedó eliminado de verdad (no es un corte antes de leerlo)', ts.getActiveTransaction() === null);
  t('orden real: vk_tx_last_recovery_snapshot archivado permanece válido (paso 1 se completó antes del fallo)', ts.loadLastRecoverySnapshot() !== null && ts.loadLastRecoverySnapshot().id === snapStagedC.id);
  t('orden real: vk_tx_last_recovery NO se escribió (el fallo fue real, no se oculta)', localStorage.getItem('vk_tx_last_recovery') === null);

  console.log('== P0.6: reinicio posterior (storage normal, sin active) -> NONE ==');
  var rStagedC2 = await tr.recoverInterruptedTransaction({ store: ts, vaultState: vs });
  t('P0.6: tras reiniciar sin active, action = NONE', rStagedC2.action === 'NONE' && rStagedC2.resolved === true);

  console.log('== P0.6: mismo orden real para CANCELLED (fase CREATED, sin snapshot) ==');
  reset();
  seedValidV1();
  var txStagedCancel = ts.beginTransaction({ reason: 'TEST' });
  var stagedCancel = stagedFailureStorage(localStorage);
  var rStagedCancel = await tr.recoverInterruptedTransaction({ store: ts, vaultState: vs, opts: { storage: stagedCancel } });
  t('orden real (CANCELLED): action = CLEANED_WITH_WARNING', rStagedCancel.action === 'CLEANED_WITH_WARNING');
  t('orden real (CANCELLED): resolved = true', rStagedCancel.resolved === true);
  t('orden real (CANCELLED): warningCode correcto', rStagedCancel.warningCode === 'RECOVERY_SUMMARY_WRITE_FAILED');
  t('orden real (CANCELLED): stateAfter = STORAGE_ERROR', rStagedCancel.stateAfter === 'STORAGE_ERROR');
  t('orden real (CANCELLED): NUNCA MANUAL_RECOVERY_REQUIRED', rStagedCancel.action !== 'MANUAL_RECOVERY_REQUIRED');
  t('orden real (CANCELLED): vk_tx_active quedó eliminado de verdad', ts.getActiveTransaction() === null);

  console.log('== P0.6: detectVaultState() REALMENTE rechaza tras finalizar con warning -> stateAfter:null (COMMITTED) ==');
  reset();
  seedValidV1();
  var txRejC = ts.beginTransaction({ targetFormat: 'V1', targetState: 'V1_READY' });
  var snapRejC = await ts.createSnapshot({ transactionId: txRejC.transactionId, reason: 'PRE' });
  await ts.saveSnapshot(snapRejC);
  await driveToPhase(txRejC.transactionId, 'COMMITTED');
  var flakySummaryOnly = {
    getItem: localStorage.getItem.bind(localStorage),
    setItem: function (k, v) {
      if (k === 'vk_tx_last_recovery') { throw new Error('fallo simulado al escribir el resumen'); }
      localStorage.setItem(k, v);
    },
    removeItem: localStorage.removeItem.bind(localStorage)
  };
  var rRejC = await tr.recoverInterruptedTransaction({ store: ts, vaultState: rejectingVaultState('STORAGE_READ_FAILED'), opts: { storage: flakySummaryOnly } });
  t('detectVaultState rechaza de verdad (COMMITTED): action = FINALIZED_WITH_WARNING', rRejC.action === 'FINALIZED_WITH_WARNING');
  t('detectVaultState rechaza de verdad (COMMITTED): resolved = true', rRejC.resolved === true);
  t('detectVaultState rechaza de verdad (COMMITTED): stateAfter = null (best effort real)', rRejC.stateAfter === null);
  t('detectVaultState rechaza de verdad (COMMITTED): warningCode se conserva', rRejC.warningCode === 'RECOVERY_SUMMARY_WRITE_FAILED');
  t('detectVaultState rechaza de verdad (COMMITTED): NUNCA MANUAL_RECOVERY_REQUIRED', rRejC.action !== 'MANUAL_RECOVERY_REQUIRED');
  t('detectVaultState rechaza de verdad (COMMITTED): vk_tx_active quedó eliminado', ts.getActiveTransaction() === null);

  console.log('== P0.6: mismo caso con rejectingVaultState para CANCELLED -> stateAfter:null ==');
  reset();
  seedValidV1();
  var txRejCancel = ts.beginTransaction({ reason: 'TEST' });
  var flakySummaryOnlyCancel = {
    getItem: localStorage.getItem.bind(localStorage),
    setItem: function (k, v) {
      if (k === 'vk_tx_last_recovery') { throw new Error('fallo simulado'); }
      localStorage.setItem(k, v);
    },
    removeItem: localStorage.removeItem.bind(localStorage)
  };
  var rRejCancel = await tr.recoverInterruptedTransaction({ store: ts, vaultState: rejectingVaultState('STORAGE_READ_FAILED'), opts: { storage: flakySummaryOnlyCancel } });
  t('detectVaultState rechaza de verdad (CANCELLED): action = CLEANED_WITH_WARNING', rRejCancel.action === 'CLEANED_WITH_WARNING');
  t('detectVaultState rechaza de verdad (CANCELLED): resolved = true', rRejCancel.resolved === true);
  t('detectVaultState rechaza de verdad (CANCELLED): stateAfter = null', rRejCancel.stateAfter === null);
  t('detectVaultState rechaza de verdad (CANCELLED): warningCode se conserva', rRejCancel.warningCode === 'RECOVERY_SUMMARY_WRITE_FAILED');
  t('detectVaultState rechaza de verdad (CANCELLED): NUNCA MANUAL_RECOVERY_REQUIRED', rRejCancel.action !== 'MANUAL_RECOVERY_REQUIRED');
  t('detectVaultState rechaza de verdad (CANCELLED): vk_tx_active quedó eliminado', ts.getActiveTransaction() === null);

  console.log('== P0.6: no-regresión final — fallo ANTES de active sigue MANUAL_RECOVERY_REQUIRED en TODAS las rutas ==');
  reset();
  seedValidV1();
  var txCancFailActive = ts.beginTransaction({ reason: 'TEST' });
  var flakyActiveCancel = {
    getItem: localStorage.getItem.bind(localStorage),
    setItem: localStorage.setItem.bind(localStorage),
    removeItem: function (k) {
      if (k === 'vk_tx_active') { throw new Error('fallo simulado'); }
      localStorage.removeItem(k);
    }
  };
  var rCancFail = await tr.recoverInterruptedTransaction({ store: ts, vaultState: vs, opts: { storage: flakyActiveCancel } });
  t('P0.6 cancel no-regresión: fallo antes de active sigue MANUAL_RECOVERY_REQUIRED', rCancFail.action === 'MANUAL_RECOVERY_REQUIRED' && rCancFail.resolved === false);
  t('P0.6 cancel no-regresión: vk_tx_active sigue presente', ts.getActiveTransaction() !== null);

  console.log('\n' + pass + ' OK, ' + fail + ' FALLOS');
  process.exit(fail > 0 ? 1 : 0);
})();
