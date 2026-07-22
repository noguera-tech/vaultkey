/* Ejecutable desde CUALQUIER cwd: node tests/transaction-store.test.js
   o, dentro de tests/: node transaction-store.test.js */
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
var pass = 0, fail = 0;
function t(name, cond) {
  if (cond) { pass++; console.log('  \u2714 ' + name); }
  else { fail++; console.log('  \u2718 FALLO: ' + name); }
}
function throwsCode(fn, code) {
  try { fn(); return { threw: false }; }
  catch (e) { return { threw: true, code: e.code, matches: code ? e.code === code : true }; }
}
async function rejectsCode(promise, code) {
  try { await promise; return { rejected: false }; }
  catch (e) { return { rejected: true, code: e.code, matches: code ? e.code === code : true }; }
}
async function driveToPhase(txId, phase) {
  var order = ['CREATED', 'SNAPSHOT_WRITTEN', 'SNAPSHOT_VERIFIED', 'CANDIDATE_PREPARED', 'CANDIDATE_VERIFIED', 'PROMOTION_STARTED', 'PROMOTED', 'FINAL_VERIFIED', 'COMMITTED'];
  var idx = order.indexOf(phase);
  for (var i = 1; i <= idx; i++) { ts.setTransactionPhase(txId, order[i]); }
}
async function buildCandidate(txId, targetFormat, targetState) {
  var targetDigest = await ts.computeCurrentDigest(targetFormat);
  var draft = { transactionId: txId, targetFormat: targetFormat, targetState: targetState, targetDigest: targetDigest, integrity: { algorithm: 'SHA-256', digest: null } };
  var selfDigest = await ts._internal.sha256Hex(ts._internal.stableStringify(ts._internal.candidateForDigest(draft)));
  draft.integrity.digest = selfDigest;
  return draft;
}

(async function () {
  console.log('== transacción ausente vs corrupta vs storage_error (no-regresión) ==');
  reset();
  t('getActiveTransaction() === null cuando no hay nada', ts.getActiveTransaction() === null);
  localStorage.setItem('vk_tx_active', '{ json corrupto');
  t('getActiveTransaction() lanza TRANSACTION_STORE_CORRUPT ante JSON corrupto', throwsCode(function () { ts.getActiveTransaction(); }, 'TRANSACTION_STORE_CORRUPT').threw);

  console.log('== #10: vk_tx_active con JSON VÁLIDO pero estructura inválida ==');
  var badShapes = [
    ['objeto vacío', {}],
    ['sin transactionId', { phase: 'CREATED', createdAt: 1, updatedAt: 1, meta: {}, history: [{ phase: 'CREATED', at: 1 }] }],
    ['phase desconocida', { transactionId: 'x', phase: 'INVENTADA', createdAt: 1, updatedAt: 1, meta: {}, history: [{ phase: 'CREATED', at: 1 }] }],
    ['fechas no numéricas', { transactionId: 'x', phase: 'CREATED', createdAt: 'ayer', updatedAt: 1, meta: {}, history: [{ phase: 'CREATED', at: 1 }] }],
    ['meta no es objeto', { transactionId: 'x', phase: 'CREATED', createdAt: 1, updatedAt: 1, meta: 'no-es-objeto', history: [{ phase: 'CREATED', at: 1 }] }],
    ['history vacío', { transactionId: 'x', phase: 'CREATED', createdAt: 1, updatedAt: 1, meta: {}, history: [] }],
    ['history con entrada imposible', { transactionId: 'x', phase: 'CREATED', createdAt: 1, updatedAt: 1, meta: {}, history: [{ phase: 'INVENTADA', at: 1 }] }]
  ];
  badShapes.forEach(function (pair) {
    reset();
    localStorage.setItem('vk_tx_active', JSON.stringify(pair[1]));
    var r = throwsCode(function () { ts.getActiveTransaction(); }, 'TRANSACTION_STORE_CORRUPT');
    t('#10: "' + pair[0] + '" -> TRANSACTION_STORE_CORRUPT (JSON válido, estructura imposible)', r.threw && r.matches);
  });
  reset();
  var txShape = ts.beginTransaction({});
  t('#10: un registro legítimo generado por beginTransaction sigue siendo válido', ts.getActiveTransaction().transactionId === txShape.transactionId);

  console.log('== beginTransaction bloquea ante CUALQUIER vk_tx_active (no-regresión) ==');
  reset();
  var txT = ts.beginTransaction({});
  var snapT = await ts.createSnapshot({ transactionId: txT.transactionId, reason: 'X' });
  await ts.saveSnapshot(snapT);
  await driveToPhase(txT.transactionId, 'COMMITTED');
  t('beginTransaction() BLOQUEA con TRANSACTION_NOT_FINALIZED si hay un COMMITTED sin finalizar', throwsCode(function () { ts.beginTransaction({}); }, 'TRANSACTION_NOT_FINALIZED').threw);

  console.log('== #6: cancelTransaction/finalizeCommitted/finalizeRolledBack son ASÍNCRONAS ==');
  reset();
  var txAsync = ts.beginTransaction({});
  var p = ts.cancelTransaction(txAsync.transactionId);
  t('cancelTransaction() devuelve una Promise (tiene .then)', typeof p.then === 'function');
  await p;
  t('tras esperarla, la transacción queda limpia', ts.getActiveTransaction() === null);

  console.log('== #3: finalizeCommitted SIN snapshot activo -> SNAPSHOT_NOT_FOUND, nada se toca ==');
  reset();
  var txNoSnapC = ts.beginTransaction({ targetFormat: 'V1', targetState: 'V1_READY' });
  /* Se avanza de fase manualmente SIN haber guardado nunca un snapshot. */
  ts.setTransactionPhase(txNoSnapC.transactionId, 'SNAPSHOT_WRITTEN'); /* fase alcanzada sin snapshot real: escenario de prueba */
  ts.setTransactionPhase(txNoSnapC.transactionId, 'SNAPSHOT_VERIFIED');
  ts.setTransactionPhase(txNoSnapC.transactionId, 'CANDIDATE_PREPARED');
  ts.setTransactionPhase(txNoSnapC.transactionId, 'CANDIDATE_VERIFIED');
  ts.setTransactionPhase(txNoSnapC.transactionId, 'PROMOTION_STARTED');
  ts.setTransactionPhase(txNoSnapC.transactionId, 'PROMOTED');
  ts.setTransactionPhase(txNoSnapC.transactionId, 'FINAL_VERIFIED');
  ts.markCommitted(txNoSnapC.transactionId);
  var rC = await rejectsCode(ts.finalizeCommitted(txNoSnapC.transactionId), 'SNAPSHOT_NOT_FOUND');
  t('#3: finalizeCommitted sin snapshot -> rechaza SNAPSHOT_NOT_FOUND', rC.rejected && rC.matches);
  t('#3: vk_tx_active NO se ha limpiado', ts.getActiveTransaction() !== null && ts.getActiveTransaction().phase === 'COMMITTED');

  console.log('== #4: finalizeRolledBack SIN snapshot activo -> SNAPSHOT_NOT_FOUND, nada se toca ==');
  reset();
  var txNoSnapR = ts.beginTransaction({});
  ts.setTransactionPhase(txNoSnapR.transactionId, 'SNAPSHOT_WRITTEN');
  ts.setTransactionPhase(txNoSnapR.transactionId, 'ROLLBACK_STARTED');
  ts.setTransactionPhase(txNoSnapR.transactionId, 'ROLLED_BACK');
  var rR = await rejectsCode(ts.finalizeRolledBack(txNoSnapR.transactionId), 'SNAPSHOT_NOT_FOUND');
  t('#4: finalizeRolledBack sin snapshot -> rechaza SNAPSHOT_NOT_FOUND', rR.rejected && rR.matches);
  t('#4: vk_tx_active NO se ha limpiado', ts.getActiveTransaction() !== null && ts.getActiveTransaction().phase === 'ROLLED_BACK');

  console.log('== #5: snapshot con digest ALTERADO -> ni se archiva ni se limpia vk_tx_active ==');
  reset();
  localStorage.setItem('vk_meta_v1', JSON.stringify({ hash: 'abc' }));
  var txTamper = ts.beginTransaction({ targetFormat: 'V1', targetState: 'V1_READY' });
  var snapTamper = await ts.createSnapshot({ transactionId: txTamper.transactionId, reason: 'PRE' });
  await ts.saveSnapshot(snapTamper);
  /* Simula alteración directa del JSON en storage: sigue siendo JSON
     válido, pero el digest ya no corresponde al contenido. */
  var tampered = JSON.parse(localStorage.getItem('vk_tx_snapshot'));
  tampered.data.v1.metaRaw = JSON.stringify({ hash: 'ALTERADO_DIRECTAMENTE' });
  localStorage.setItem('vk_tx_snapshot', JSON.stringify(tampered));
  await driveToPhase(txTamper.transactionId, 'COMMITTED');
  var rTamper = await rejectsCode(ts.finalizeCommitted(txTamper.transactionId), 'SNAPSHOT_CORRUPT');
  t('#5: digest alterado -> finalizeCommitted rechaza SNAPSHOT_CORRUPT (no lo archiva)', rTamper.rejected && rTamper.matches);
  t('#5: vk_tx_last_recovery_snapshot sigue vacío (nunca se archivó)', ts.loadLastRecoverySnapshot() === null);
  t('#5: vk_tx_active NO se limpió', ts.getActiveTransaction() !== null);

  console.log('== #6: finalizeCommitted async correctamente esperado (rechazo real, no oculto) ==');
  reset();
  var txReject = ts.beginTransaction({ targetFormat: 'V1', targetState: 'V1_READY' });
  await driveToPhase(txReject.transactionId, 'COMMITTED'); /* sin snapshot: se sabe que rechazará */
  var caught = false, caughtCode = null;
  try { await ts.finalizeCommitted(txReject.transactionId); }
  catch (e) { caught = true; caughtCode = e.code; }
  t('#6: el rechazo de finalizeCommitted() se puede capturar con await/catch normalmente', caught === true && caughtCode === 'SNAPSHOT_NOT_FOUND');

  console.log('== #7: saveCandidate exige target IDÉNTICO al declarado por la transacción ==');
  reset();
  localStorage.setItem('vk_meta_v1', JSON.stringify({ hash: 'abc' }));
  var txTarget = ts.beginTransaction({ targetFormat: 'V1', targetState: 'V1_READY' });
  var mismatchCandidate = await buildCandidate(txTarget.transactionId, 'VK2', 'VK2_READY'); /* NO coincide con meta */
  var rMismatch = await rejectsCode(ts.saveCandidate(mismatchCandidate), 'CANDIDATE_INVALID');
  t('#7: candidato con target distinto al de active.meta -> CANDIDATE_INVALID', rMismatch.rejected && rMismatch.matches);

  var matchCandidate = await buildCandidate(txTarget.transactionId, 'V1', 'V1_READY');
  var savedMatch = await ts.saveCandidate(matchCandidate);
  t('#7: candidato con target idéntico al declarado se acepta', savedMatch.targetFormat === 'V1' && savedMatch.targetState === 'V1_READY');

  console.log('== #8: digests deben tener forma SHA-256 hex de 64 caracteres ==');
  t('isSha256Hex acepta un hex de 64 caracteres', ts._internal.isSha256Hex('a'.repeat(64)) === true);
  t('isSha256Hex rechaza longitud incorrecta', ts._internal.isSha256Hex('a'.repeat(63)) === false);
  t('isSha256Hex rechaza caracteres fuera de rango hex', ts._internal.isSha256Hex('g'.repeat(64)) === false);

  reset();
  var txBadDigest = ts.beginTransaction({ targetFormat: 'V1', targetState: 'V1_READY' });
  var badDigestCandidate = { transactionId: txBadDigest.transactionId, targetFormat: 'V1', targetState: 'V1_READY', targetDigest: 'no-tiene-forma-de-sha256', integrity: { algorithm: 'SHA-256', digest: 'tampoco' } };
  var rBadDigest = await rejectsCode(ts.saveCandidate(badDigestCandidate), 'CANDIDATE_INVALID');
  t('#8: targetDigest/integrity.digest sin forma SHA-256 -> CANDIDATE_INVALID', rBadDigest.rejected && rBadDigest.matches);

  console.log('== #1/#16: candidato ALTERADO después de saveCandidate ==');
  reset();
  localStorage.setItem('vk_meta_v1', JSON.stringify({ hash: 'abc' }));
  var txAlter = ts.beginTransaction({ targetFormat: 'V1', targetState: 'V1_READY' });
  var candAlter = await buildCandidate(txAlter.transactionId, 'V1', 'V1_READY');
  await ts.saveCandidate(candAlter);
  /* Alteración directa en storage tras guardar (bypass de saveCandidate) */
  var alteredRaw = JSON.parse(localStorage.getItem('vk_tx_candidate'));
  alteredRaw.targetState = 'V1_INCOMPLETE'; /* cambia un campo protegido por integrity.digest */
  localStorage.setItem('vk_tx_candidate', JSON.stringify(alteredRaw));
  var rewritten = ts.loadCandidate(); /* JSON sigue siendo válido: loadCandidate() NO detecta esto */
  t('loadCandidate() no detecta por sí solo la alteración (JSON sigue siendo válido)', rewritten.targetState === 'V1_INCOMPLETE');
  var vAltered = await ts.verifyCandidate(rewritten);
  t('#1: verifyCandidate() SÍ detecta la alteración (digest ya no coincide)', vAltered.ok === false && vAltered.reason === 'DIGEST_MISMATCH');

  console.log('== P0.5 #1/#16: removeItem(vk_tx_active) falla DESPUÉS de archivar el snapshot ==');
  reset();
  localStorage.setItem('vk_meta_v1', JSON.stringify({ hash: 'abc' }));
  var txFailActive = ts.beginTransaction({});
  var snapFailActive = await ts.createSnapshot({ transactionId: txFailActive.transactionId, reason: 'PRE' });
  await ts.saveSnapshot(snapFailActive);
  ts.setTransactionPhase(txFailActive.transactionId, 'SNAPSHOT_WRITTEN');
  ts.setTransactionPhase(txFailActive.transactionId, 'ROLLBACK_STARTED');
  await ts.restoreSnapshot(snapFailActive);
  ts.setTransactionPhase(txFailActive.transactionId, 'ROLLED_BACK');
  var flakyActiveStorage = {
    getItem: localStorage.getItem.bind(localStorage),
    setItem: localStorage.setItem.bind(localStorage),
    removeItem: function (k) {
      if (k === 'vk_tx_active') { throw new Error('fallo simulado al borrar active'); }
      localStorage.removeItem(k);
    }
  };
  var rFailActive = await rejectsCode(ts.finalizeRolledBack(txFailActive.transactionId, flakyActiveStorage), 'STORAGE_WRITE_FAILED');
  t('#1: el rechazo se propaga (removeItem de active falló)', rFailActive.rejected && rFailActive.matches);
  t('#1: el snapshot YA quedó archivado correctamente ANTES del fallo (no se pierde)', ts.loadLastRecoverySnapshot() !== null && ts.loadLastRecoverySnapshot().id === snapFailActive.id);
  t('#6: el resumen vk_tx_last_recovery NO se escribió (active seguía sin borrarse)', localStorage.getItem('vk_tx_last_recovery') === null);
  t('#1: vk_tx_active sigue presente (no se completó la limpieza)', ts.getActiveTransaction() !== null);
  t('#1: vk_tx_snapshot original NO se tocó (se limpia el último, tras active)', ts.loadSnapshot() !== null && ts.loadSnapshot().id === snapFailActive.id);

  console.log('== P0.5 #16: reinicio posterior completa la finalización usando el snapshot archivado ==');
  /* Reintento con storage normal, sin el fallo simulado: debe completar. */
  await ts.finalizeRolledBack(txFailActive.transactionId);
  t('reintento: vk_tx_active queda limpio', ts.getActiveTransaction() === null);
  t('reintento: vk_tx_last_recovery ahora SÍ refleja la finalización real', JSON.parse(localStorage.getItem('vk_tx_last_recovery')).transactionId === txFailActive.transactionId);

  console.log('== P0.5 #2/#16: vk_tx_snapshot AUSENTE, pero vk_tx_last_recovery_snapshot válido del MISMO transactionId permite completar ==');
  reset();
  localStorage.setItem('vk_meta_v1', JSON.stringify({ hash: 'abc' }));
  var txFallback = ts.beginTransaction({ targetFormat: 'V1', targetState: 'V1_READY' });
  var snapFallback = await ts.createSnapshot({ transactionId: txFallback.transactionId, reason: 'PRE' });
  /* Se archiva DIRECTAMENTE como respaldo (simulando que un intento
     previo llegó a archivar pero no a limpiar), sin dejar nunca un
     vk_tx_snapshot activo real. */
  localStorage.setItem('vk_tx_last_recovery_snapshot', JSON.stringify(snapFallback));
  await driveToPhase(txFallback.transactionId, 'COMMITTED');
  t('precondición: no hay vk_tx_snapshot activo', ts.loadSnapshot() === null);
  var savedFallback = await ts.finalizeCommitted(txFallback.transactionId);
  t('#2: finalizeCommitted COMPLETA usando el respaldo válido del mismo transactionId (no rechaza SNAPSHOT_NOT_FOUND)', ts.getActiveTransaction() === null);
  t('#2: el resumen refleja hasRecoverableSnapshot=true', JSON.parse(localStorage.getItem('vk_tx_last_recovery')).hasRecoverableSnapshot === true);

  console.log('== P0.5 #2/#16: copia archivada con el MISMO id pero CONTENIDO alterado no sirve de respaldo ==');
  reset();
  localStorage.setItem('vk_meta_v1', JSON.stringify({ hash: 'abc' }));
  var txAlteredFallback = ts.beginTransaction({});
  var snapForFallback = await ts.createSnapshot({ transactionId: txAlteredFallback.transactionId, reason: 'PRE' });
  var alteredFallback = JSON.parse(JSON.stringify(snapForFallback));
  alteredFallback.data.v1.metaRaw = JSON.stringify({ hash: 'CONTENIDO_ALTERADO' }); /* mismo id, digest ya no corresponde */
  localStorage.setItem('vk_tx_last_recovery_snapshot', JSON.stringify(alteredFallback));
  await driveToPhase(txAlteredFallback.transactionId, 'COMMITTED');
  var rAlteredFallback = await rejectsCode(ts.finalizeCommitted(txAlteredFallback.transactionId), 'SNAPSHOT_NOT_FOUND');
  t('#2: un respaldo con digest que no verifica NUNCA se acepta como sustituto', rAlteredFallback.rejected && rAlteredFallback.matches);
  t('vk_tx_active sigue presente', ts.getActiveTransaction() !== null);

  console.log('== P0.5 #4/#16: snapshot activo perteneciente a OTRO transactionId ==');
  reset();
  localStorage.setItem('vk_meta_v1', JSON.stringify({ hash: 'abc' }));
  var txForeignSnap = ts.beginTransaction({});
  /* Se inyecta directamente un snapshot ajeno (de otra transacción)
     como si fuera el vk_tx_snapshot activo. */
  var foreignSnap = await ts.createSnapshot({ transactionId: 'otra-transaccion-distinta', reason: 'AJENO' });
  localStorage.setItem('vk_tx_snapshot', JSON.stringify(foreignSnap));
  await driveToPhase(txForeignSnap.transactionId, 'COMMITTED');
  var rForeignSnap = await rejectsCode(ts.finalizeCommitted(txForeignSnap.transactionId), 'TRANSACTION_ID_MISMATCH');
  t('#4: snapshot activo de OTRA transacción -> TRANSACTION_ID_MISMATCH, nunca se archiva', rForeignSnap.rejected && rForeignSnap.matches);
  t('vk_tx_last_recovery_snapshot sigue vacío', ts.loadLastRecoverySnapshot() === null);
  t('vk_tx_active sigue presente', ts.getActiveTransaction() !== null);

  console.log('== P0.5 #1/#6/#16: fallo al eliminar el snapshot técnico DESPUÉS de eliminar active ==');
  reset();
  localStorage.setItem('vk_meta_v1', JSON.stringify({ hash: 'abc' }));
  var txFailSnapCleanup = ts.beginTransaction({});
  var snapCleanup = await ts.createSnapshot({ transactionId: txFailSnapCleanup.transactionId, reason: 'PRE' });
  await ts.saveSnapshot(snapCleanup);
  await driveToPhase(txFailSnapCleanup.transactionId, 'COMMITTED');
  var flakySnapStorage = {
    getItem: localStorage.getItem.bind(localStorage),
    setItem: localStorage.setItem.bind(localStorage),
    removeItem: function (k) {
      if (k === 'vk_tx_snapshot') { throw new Error('fallo simulado al borrar el residuo técnico'); }
      localStorage.removeItem(k);
    }
  };
  var rFailSnapCleanup = await rejectsCode(ts.finalizeCommitted(txFailSnapCleanup.transactionId, flakySnapStorage), 'STORAGE_WRITE_FAILED');
  t('#16: el rechazo se propaga (no se oculta el fallo de limpieza del residuo)', rFailSnapCleanup.rejected && rFailSnapCleanup.matches);
  t('#1: a pesar del fallo, vk_tx_active SÍ quedó eliminado (lo esencial se completó)', ts.getActiveTransaction() === null);
  t('#6: el resumen vk_tx_last_recovery SÍ refleja la finalización real (se escribió tras borrar active)', JSON.parse(localStorage.getItem('vk_tx_last_recovery')).transactionId === txFailSnapCleanup.transactionId);

  console.log('== P0.5 #6/#16: el resumen final NUNCA afirma cierre cuando active sigue presente ==');
  reset();
  localStorage.setItem('vk_meta_v1', JSON.stringify({ hash: 'abc' }));
  var txSummaryCheck = ts.beginTransaction({});
  var snapSummaryCheck = await ts.createSnapshot({ transactionId: txSummaryCheck.transactionId, reason: 'PRE' });
  await ts.saveSnapshot(snapSummaryCheck);
  await driveToPhase(txSummaryCheck.transactionId, 'COMMITTED');
  var flakyActiveStorage2 = {
    getItem: localStorage.getItem.bind(localStorage),
    setItem: localStorage.setItem.bind(localStorage),
    removeItem: function (k) {
      if (k === 'vk_tx_active') { throw new Error('fallo simulado'); }
      localStorage.removeItem(k);
    }
  };
  await rejectsCode(ts.finalizeCommitted(txSummaryCheck.transactionId, flakyActiveStorage2), 'STORAGE_WRITE_FAILED');
  t('#6: vk_tx_last_recovery NO existe (el resumen nunca se escribió sin haber borrado active antes)', localStorage.getItem('vk_tx_last_recovery') === null);
  t('#6: vk_tx_active sigue presente, consistente con la ausencia de resumen', ts.getActiveTransaction() !== null);


  reset();
  localStorage.setItem('vk_meta_v1', JSON.stringify({ hash: 'original' }));
  var txRoll = ts.beginTransaction({});
  var snapBefore = await ts.createSnapshot({ transactionId: txRoll.transactionId, reason: 'PRE_CHANGE' });
  t('snapshot tiene digest de 64 hex', ts._internal.isSha256Hex(snapBefore.integrity.digest));
  localStorage.setItem('vk_meta_v1', JSON.stringify({ hash: 'cambiado' }));
  var restore = await ts.restoreSnapshot(snapBefore);
  t('restoreSnapshot ok', restore.ok === true);
  t('vk_meta_v1 vuelve al original', localStorage.getItem('vk_meta_v1') === JSON.stringify({ hash: 'original' }));

  console.log('\n' + pass + ' OK, ' + fail + ' FALLOS');
  process.exit(fail > 0 ? 1 : 0);
})();
