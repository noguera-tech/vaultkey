/* ============================================================
   VaultKey 2.0 ? dev/backup-test.js
   Contrato del m?dulo compartido de backup/restauraci?n.
   Ejecutar: node dev/backup-test.js
   ============================================================ */
'use strict';

var vkBackup = require('../vault-backup.js');
var pass = 0, fail = 0;

function t(name, cond) {
  if (cond) { pass++; console.log('  ? ' + name); }
  else { fail++; console.log('  ? FALLO: ' + name); }
}

function fails(p) {
  return p.then(function () { return false; }, function () { return true; });
}

function clone(v) {
  return v === null || v === undefined ? v : JSON.parse(JSON.stringify(v));
}

(async function () {
  var blob = {
    app: 'VaultKey',
    schemaVersion: 2,
    cryptoVersion: 1,
    kdf: {
      saltMaster: 'AAAA',
      saltKit: 'BBBB',
      iterMaster: 2000000,
      iterKit: 2000000
    },
    wraps: {
      master: { iv: 'miv', ct: 'mct' },
      kit: { iv: 'kiv', ct: 'kct' }
    },
    vault: { iv: 'viv', ct: 'vct' }
  };

  var attachments = {
    format: 'VaultKeyAttachments',
    formatVersion: 1,
    exportedAt: 1,
    records: []
  };

  console.log('== envelope ==');
  var envelope = vkBackup.createEnvelope({
    blob: blob,
    attachments: attachments,
    createdAt: '2026-08-07T00:00:00.000Z'
  });

  t('crea v4 exacta', envelope.version === 4);
  t('declara regeneracion local de pinwrap',
    envelope.restorePolicy &&
    envelope.restorePolicy.pinWrap === 'regenerate-on-device');
  t('conserva blob y adjuntos',
    envelope.vk2_blob === blob &&
    envelope.attachments === attachments);

  t('acepta v4 valida', vkBackup.validateEnvelope(envelope).version === 4);

  var v3 = clone(envelope);
  v3.version = 3;
  delete v3.restorePolicy;
  t('acepta v3 historica', vkBackup.validateEnvelope(v3).version === 3);

  var unknown = clone(envelope);
  unknown.version = 99;
  t('rechaza versiones desconocidas',
    await fails(Promise.resolve().then(function () {
      return vkBackup.validateEnvelope(unknown);
    })));

  var missingAttachments = clone(envelope);
  delete missingAttachments.attachments;
  t('exige adjuntos en v3/v4',
    await fails(Promise.resolve().then(function () {
      return vkBackup.validateEnvelope(missingAttachments);
    })));

  console.log('== restore y rollback ==');

  var state = {
    blob: { id: 'old-blob' },
    pinWrap: { id: 'old-pin' },
    attachments: {
      format: 'VaultKeyAttachments',
      formatVersion: 1,
      exportedAt: 2,
      records: [{ id: 'old-att' }]
    }
  };

  var store = {
    loadBlob: function () { return clone(state.blob); },
    saveBlob: function (v) { state.blob = clone(v); },
    removeBlob: function () { state.blob = null; },
    loadPinWrap: function () { return clone(state.pinWrap); },
    savePinWrap: function (v) { state.pinWrap = clone(v); },
    removePinWrap: function () { state.pinWrap = null; }
  };

  var attachmentExportClock = 100;
  var attachmentApi = {
    exportAll: function () {
      var exported = clone(state.attachments);
      exported.exportedAt = attachmentExportClock++;
      return Promise.resolve(exported);
    },
    replaceAll: function (v) {
      state.attachments = clone(v);
      return Promise.resolve({ imported: v.records.length });
    }
  };

  var cryptoApi = {
    getOrCreatePepper: function () {
      return Promise.resolve({ localPepper: true });
    },
    createPinWrapFromVault: function (restoredBlob, cred, pin, pepper) {
      if (!restoredBlob || cred.master !== 'master-ok' || pin !== '731905' || !pepper.localPepper) {
        return Promise.reject(new Error('credenciales invalidas'));
      }
      return Promise.resolve({ id: 'new-pin' });
    }
  };

  var restored = await vkBackup.restore(envelope, {
    credential: { master: 'master-ok' },
    pin: '731905',
    store: store,
    attachments: attachmentApi,
    crypto: cryptoApi
  });

  t('restore informa exito', restored && restored.ok === true);
  t('restore guarda nuevo blob', state.blob.cryptoVersion === 1);
  t('restore guarda pinwrap regenerado', state.pinWrap.id === 'new-pin');
  t('restore sustituye adjuntos', state.attachments.records.length === 0);

  state.blob = { id: 'before-failure' };
  state.pinWrap = { id: 'before-pin' };
  state.attachments = {
    format: 'VaultKeyAttachments',
    formatVersion: 1,
    exportedAt: 3,
    records: [{ id: 'before-att' }]
  };

  var failNextBlobSave = true;
  var failingStore = {
    loadBlob: store.loadBlob,
    saveBlob: function (v) {
      if (failNextBlobSave) {
        failNextBlobSave = false;
        throw new Error('saveBlob fallo');
      }
      state.blob = clone(v);
    },
    removeBlob: store.removeBlob,
    loadPinWrap: store.loadPinWrap,
    savePinWrap: store.savePinWrap,
    removePinWrap: store.removePinWrap
  };

  var rollbackFailed = await fails(vkBackup.restore(envelope, {
    credential: { master: 'master-ok' },
    pin: '731905',
    store: failingStore,
    attachments: attachmentApi,
    crypto: cryptoApi
  }));

  t('restore rechaza si falla una escritura', rollbackFailed === true);
  t('rollback recupera blob anterior', state.blob.id === 'before-failure');
  t('rollback recupera pinwrap anterior', state.pinWrap.id === 'before-pin');
  t('rollback recupera adjuntos anteriores',
    state.attachments.records.length === 1 &&
    state.attachments.records[0].id === 'before-att');

  console.log('');
  console.log('Resultado: ' + pass + ' correctas, ' + fail + ' fallos');
  process.exit(fail === 0 ? 0 : 1);
})().catch(function (e) {
  console.error('ERROR FATAL:', e);
  process.exit(1);
});
