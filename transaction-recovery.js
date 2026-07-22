/* ============================================================
   VaultKey — transaction-recovery.js (PROPUESTA P0.4, NO integrada)
   Pieza 5, revisada tras la tercera ronda de corrección (P0.4).

   Cambios respecto a P0.3 relevantes para este archivo:
   - #1  loadCandidate() ya NO es suficiente por sí solo. Antes de
         confiar en transactionId/targetFormat/targetState/
         targetDigest, se llama a store.verifyCandidate(candidate)
         (API pública) para recalcular y verificar
         candidate.integrity.digest. Si no verifica, se trata igual
         que un candidato ausente/corrupto (rollback), nunca se usan
         sus campos.
   - #2  La fase SNAPSHOT_WRITTEN envuelve TODO en try/catch,
         incluida la llamada a loadSnapshot() (que puede lanzar
         SNAPSHOT_CORRUPT/STORAGE_READ_FAILED) y a verifySnapshot()
         (que puede rechazar). Nunca se deja una excepción o un
         rechazo sin normalizar a MANUAL_RECOVERY_REQUIRED.
   - #6  cancelTransaction/finalizeCommitted/finalizeRolledBack ahora
         son asíncronas en transaction-store.js; aquí se esperan
         (await) con su propio try/catch, nunca se invocan como si
         fueran síncronas.
   - #9  Toda la función vive dentro de un try/catch de nivel
         superior. Cualquier excepción o rechazo no anticipado en
         cualquier punto de la lógica (detectVaultState,
         verifySnapshot, verifyCandidate, computeCurrentDigest,
         finalización) se normaliza en el catch final a
         MANUAL_RECOVERY_REQUIRED, resolved:false. Esta función
         NUNCA deja una promesa rechazada sin normalizar.

   Cambio P0.6 (contrato finalized/warning):
   - cancelTransaction/finalizeCommitted/finalizeRolledBack ya no
     solo pueden rechazar o resolver "sin más": pueden resolver con
     { finalized:true, kind, warningCode, cleanupPending } cuando
     candidate+active se eliminaron con éxito pero un paso POSTERIOR
     (resumen vk_tx_last_recovery o limpieza de vk_tx_snapshot)
     falló. El helper afterFinalize() interpreta ese resultado:
       - si trae warningCode -> action 'FINALIZED_WITH_WARNING'
         (o 'CLEANED_WITH_WARNING' para las rutas de cancelación),
         resolved:true, NUNCA MANUAL_RECOVERY_REQUIRED ni
         PROMOTION_FAILED/ROLLBACK_FAILED — no hay transacción que
         recuperar, ya está finalizada.
       - detectVaultState() para calcular stateAfter es BEST EFFORT
         en la rama de warning: si rechaza o lanza, stateAfter queda
         null, pero la acción de warning y resolved:true se
         mantienen igualmente.
       - si NO trae warningCode, se comporta exactamente como antes
         (detectAfter con la acción "limpia" de siempre).

   Sigue sin conectarse a bootApp(), app.js, Drive ni onboarding.
   ============================================================ */

(function (root, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  if (root) { root.vkTransactionRecovery = api; }
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';

  function respond(action, transactionId, resolved, stateAfter, extra) {
    var out = { action: action, transactionId: transactionId, resolved: resolved, stateAfter: stateAfter || null };
    if (extra) { for (var k in extra) { out[k] = extra[k]; } }
    return out;
  }

  async function recoverInterruptedTransaction(deps) {
    var store = deps.store;
    var vaultState = deps.vaultState;
    var opts = deps.opts || {};
    var txId = null;

    try {
      var active;
      try {
        active = store.getActiveTransaction(opts.storage);
      } catch (e) {
        return respond('MANUAL_RECOVERY_REQUIRED', null, false, null, { errorCode: e.code || 'STORAGE_READ_FAILED' });
      }

      if (!active) {
        var st0 = await vaultState.detectVaultState(opts);
        return respond('NONE', null, true, st0.state);
      }

      txId = active.transactionId;

      var detectAfter = async function (action, extra) {
        var st = await vaultState.detectVaultState(opts);
        return respond(action, txId, true, st.state, extra);
      };

      /* P0.6: interpreta el resultado de cancelTransaction/
         finalizeCommitted/finalizeRolledBack. Si trae warningCode,
         la transacción YA está finalizada (candidate/active ya no
         existen, para CUALQUIER kind incluido CANCELLED) y NO debe
         reportarse como MANUAL_RECOVERY_REQUIRED ni como
         PROMOTION_FAILED/ROLLBACK_FAILED.

         detectVaultState() es BEST EFFORT en la rama de warning:
         si rechaza o lanza, stateAfter queda null, pero la acción
         sigue siendo la de warning con resolved:true. Nunca se deja
         que ese rechazo suba al catch de nivel superior y convierta
         una finalización real en MANUAL_RECOVERY_REQUIRED. */
      var afterFinalize = async function (result, cleanAction, warningAction, precomputedState) {
        if (result && result.finalized && result.warningCode) {
          var stW = null;
          if (precomputedState) {
            stW = precomputedState;
          } else {
            try {
              var stRes = await vaultState.detectVaultState(opts);
              stW = stRes.state;
            } catch (e) {
              stW = null; /* best-effort: la transacción ya está
                             finalizada aunque no se pueda saber el
                             estado resultante */
            }
          }
          return respond(warningAction, txId, true, stW, { warningCode: result.warningCode, cleanupPending: !!result.cleanupPending });
        }
        if (precomputedState) { return respond(cleanAction, txId, true, precomputedState); }
        return await detectAfter(cleanAction);
      };

      var attemptRollback = async function () {
        var snap;
        try {
          snap = store.loadSnapshot(opts.storage);
        } catch (e) {
          return respond('MANUAL_RECOVERY_REQUIRED', txId, false, null, { errorCode: e.code || 'SNAPSHOT_CORRUPT' });
        }
        if (!snap) {
          return respond('MANUAL_RECOVERY_REQUIRED', txId, false, null, { errorCode: 'SNAPSHOT_CORRUPT' });
        }

        var result;
        try {
          result = await store.restoreSnapshot(snap, opts.storage, opts);
        } catch (e) {
          return respond('MANUAL_RECOVERY_REQUIRED', txId, false, null, { errorCode: e.code || 'ROLLBACK_FAILED' });
        }
        if (!result.ok) {
          return respond('MANUAL_RECOVERY_REQUIRED', txId, false, null, { errorCode: result.reason || 'ROLLBACK_FAILED' });
        }

        try {
          if (active.phase !== 'ROLLBACK_STARTED') {
            store.setTransactionPhase(txId, 'ROLLBACK_STARTED', null, opts.storage);
          }
          store.setTransactionPhase(txId, 'ROLLED_BACK', null, opts.storage);
        } catch (e) {
          return respond('MANUAL_RECOVERY_REQUIRED', txId, false, null, { errorCode: e.code || 'ROLLBACK_FAILED' });
        }

        var finAR;
        try {
          finAR = await store.finalizeRolledBack(txId, opts.storage, opts);
        } catch (e) {
          /* #3/#4/#5: si finalizeRolledBack rechaza (p.ej.
             SNAPSHOT_NOT_FOUND o SNAPSHOT_CORRUPT), NO se ignora:
             la transacción ya quedó en ROLLED_BACK (el rollback de
             datos SÍ se completó) pero la finalización de la
             transacción en sí no, y eso exige revisión manual. */
          return respond('MANUAL_RECOVERY_REQUIRED', txId, false, null, { errorCode: e.code || 'ROLLBACK_FAILED' });
        }

        return await afterFinalize(finAR, 'ROLLED_BACK_INVALID_PROMOTION', 'FINALIZED_WITH_WARNING');
      };

      /* Verificación estricta compartida por PROMOTION_STARTED,
         PROMOTED y FINAL_VERIFIED. */
      var verifyAndPromote = async function (fromPhase) {
        var meta = active.meta || {};
        if (!meta.targetFormat || !meta.targetState) {
          return respond('MANUAL_RECOVERY_REQUIRED', txId, false, null, { errorCode: 'TARGET_NOT_DECLARED' });
        }

        var candidate;
        try {
          candidate = store.loadCandidate(opts.storage);
        } catch (e) {
          return await attemptRollback(); /* candidato ilegible: no es seguro confiar en la promoción */
        }
        if (!candidate) { return await attemptRollback(); }

        /* #1: loadCandidate() por sí solo NUNCA basta. Se recalcula
           y verifica candidate.integrity.digest ANTES de confiar en
           transactionId/targetFormat/targetState/targetDigest. */
        var cv;
        try {
          cv = await store.verifyCandidate(candidate);
        } catch (e) {
          return await attemptRollback();
        }
        if (!cv.ok) { return await attemptRollback(); }

        if (candidate.transactionId !== txId || candidate.targetFormat !== meta.targetFormat || candidate.targetState !== meta.targetState) {
          return respond('MANUAL_RECOVERY_REQUIRED', txId, false, null, { errorCode: 'CANDIDATE_INVALID' });
        }

        var st;
        try {
          st = await vaultState.detectVaultState(opts);
        } catch (e) {
          return respond('MANUAL_RECOVERY_REQUIRED', txId, false, null, { errorCode: e.code || 'STORAGE_READ_FAILED' });
        }

        var stateMatches = st.state === meta.targetState && st.activeFormat === meta.targetFormat;
        if (!stateMatches) { return await attemptRollback(); }

        var currentDigest;
        try {
          currentDigest = await store.computeCurrentDigest(meta.targetFormat, opts.storage, opts);
        } catch (e) {
          return respond('MANUAL_RECOVERY_REQUIRED', txId, false, st.state, { errorCode: e.code || 'STORAGE_READ_FAILED' });
        }
        if (currentDigest !== candidate.targetDigest) { return await attemptRollback(); }

        try {
          if (fromPhase === 'PROMOTION_STARTED') { store.setTransactionPhase(txId, 'PROMOTED', null, opts.storage); }
          if (fromPhase === 'PROMOTION_STARTED' || fromPhase === 'PROMOTED') { store.setTransactionPhase(txId, 'FINAL_VERIFIED', null, opts.storage); }
          store.markCommitted(txId, opts.storage);
        } catch (e) {
          return respond('MANUAL_RECOVERY_REQUIRED', txId, false, st.state, { errorCode: e.code || 'PROMOTION_FAILED' });
        }

        var finVP;
        try {
          finVP = await store.finalizeCommitted(txId, opts.storage, opts);
        } catch (e) {
          return respond('MANUAL_RECOVERY_REQUIRED', txId, false, st.state, { errorCode: e.code || 'PROMOTION_FAILED' });
        }

        return await afterFinalize(finVP, 'COMPLETED_VALID_PROMOTION', 'FINALIZED_WITH_WARNING', st.state);
      };

      switch (active.phase) {
        case 'CREATED':
        case 'SNAPSHOT_VERIFIED':
        case 'CANDIDATE_PREPARED':
        case 'CANDIDATE_VERIFIED': {
          try {
            store.clearCandidate(txId, opts.storage);
          } catch (e) {
            return respond('MANUAL_RECOVERY_REQUIRED', txId, false, null, { errorCode: e.code });
          }
          var cancelResA;
          try {
            cancelResA = await store.cancelTransaction(txId, opts.storage, opts);
          } catch (e) {
            return respond('MANUAL_RECOVERY_REQUIRED', txId, false, null, { errorCode: e.code });
          }
          return await afterFinalize(cancelResA, 'CLEANED_INCOMPLETE_PREPARATION', 'CLEANED_WITH_WARNING');
        }

        case 'SNAPSHOT_WRITTEN': {
          /* #2: TODO envuelto en try/catch, incluida la lectura del
             snapshot (que puede lanzar) y su verificación (que
             puede rechazar). */
          var snap;
          try {
            snap = store.loadSnapshot(opts.storage);
          } catch (e) {
            return respond('MANUAL_RECOVERY_REQUIRED', txId, false, null, { errorCode: e.code || 'SNAPSHOT_CORRUPT' });
          }
          var v;
          try {
            v = await store.verifySnapshot(snap, opts);
          } catch (e) {
            return respond('MANUAL_RECOVERY_REQUIRED', txId, false, null, { errorCode: e.code || 'SNAPSHOT_CORRUPT' });
          }
          if (!snap || !v.ok) {
            return respond('MANUAL_RECOVERY_REQUIRED', txId, false, null, { errorCode: 'SNAPSHOT_CORRUPT' });
          }
          try {
            store.clearCandidate(txId, opts.storage);
          } catch (e) {
            return respond('MANUAL_RECOVERY_REQUIRED', txId, false, null, { errorCode: e.code });
          }
          var cancelResB;
          try {
            cancelResB = await store.cancelTransaction(txId, opts.storage, opts);
          } catch (e) {
            return respond('MANUAL_RECOVERY_REQUIRED', txId, false, null, { errorCode: e.code });
          }
          return await afterFinalize(cancelResB, 'CLEANED_INCOMPLETE_PREPARATION', 'CLEANED_WITH_WARNING');
        }

        case 'PROMOTION_STARTED':
        case 'PROMOTED':
        case 'FINAL_VERIFIED': {
          return await verifyAndPromote(active.phase);
        }

        case 'COMMITTED': {
          var finComm;
          try {
            finComm = await store.finalizeCommitted(txId, opts.storage, opts);
          } catch (e) {
            return respond('MANUAL_RECOVERY_REQUIRED', txId, false, null, { errorCode: e.code || 'PROMOTION_FAILED' });
          }
          return await afterFinalize(finComm, 'FINALIZED_COMMITTED', 'FINALIZED_WITH_WARNING');
        }

        case 'ROLLBACK_STARTED': {
          return await attemptRollback();
        }

        case 'ROLLED_BACK': {
          var finRB;
          try {
            finRB = await store.finalizeRolledBack(txId, opts.storage, opts);
          } catch (e) {
            return respond('MANUAL_RECOVERY_REQUIRED', txId, false, null, { errorCode: e.code || 'ROLLBACK_FAILED' });
          }
          return await afterFinalize(finRB, 'FINALIZED_ROLLED_BACK', 'FINALIZED_WITH_WARNING');
        }

        case 'FAILED':
        default: {
          var stF;
          try {
            stF = await vaultState.detectVaultState(opts);
          } catch (e) {
            return respond('MANUAL_RECOVERY_REQUIRED', txId, false, null, { errorCode: e.code || 'MANUAL_RECOVERY_REQUIRED' });
          }
          return respond('MANUAL_RECOVERY_REQUIRED', txId, false, stF.state, { errorCode: 'MANUAL_RECOVERY_REQUIRED' });
        }
      }
    } catch (e) {
      /* #9: red de seguridad final. Nada de lo anterior debería
         llegar aquí porque cada paso normaliza sus propios errores,
         pero si algo inesperado se escapa (un rechazo no previsto
         de detectVaultState/verifySnapshot/verifyCandidate/
         computeCurrentDigest/finalización, o cualquier otra causa),
         esta función SIGUE resolviendo un resultado tipado en vez
         de propagar una promesa rechazada. */
      return respond('MANUAL_RECOVERY_REQUIRED', txId, false, null, { errorCode: (e && e.code) || 'UNEXPECTED_ERROR' });
    }
  }

  return { recoverInterruptedTransaction: recoverInterruptedTransaction };
});
