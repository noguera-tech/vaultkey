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

  console.log('\n' + pass + ' OK, ' + fail + ' FALLOS');
  process.exit(fail > 0 ? 1 : 0);
})();
