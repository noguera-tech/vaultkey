/* ============================================================
   VaultKey 2.0 ? backup/restauracion compartidos
   ============================================================ */

(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  if (root) { root.vkBackup = api; }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var BACKUP_VERSION = 4;

  function clone(value) {
    return value === null || value === undefined
      ? value
      : JSON.parse(JSON.stringify(value));
  }

  function isObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value);
  }

  function validateBlob(blob) {
    if (
      !isObject(blob) ||
      blob.app !== 'VaultKey' ||
      Number(blob.schemaVersion) !== 2 ||
      typeof blob.cryptoVersion !== 'number' ||
      !isObject(blob.kdf) ||
      !isObject(blob.wraps) ||
      !isObject(blob.wraps.master) ||
      !isObject(blob.wraps.kit) ||
      !isObject(blob.vault)
    ) {
      throw new Error('La boveda VaultKey 2.0 no tiene un formato valido');
    }
    return blob;
  }

  function validateAttachments(attachments) {
    if (
      !isObject(attachments) ||
      attachments.format !== 'VaultKeyAttachments' ||
      typeof attachments.formatVersion !== 'number' ||
      !Array.isArray(attachments.records)
    ) {
      throw new Error('El bloque de adjuntos no tiene un formato valido');
    }
    return attachments;
  }

  function createEnvelope(opts) {
    opts = opts || {};
    var blob = validateBlob(opts.blob);
    var attachments = validateAttachments(opts.attachments);

    return {
      app: 'VaultKey',
      format: 'vkbak',
      version: BACKUP_VERSION,
      vaultFormat: 'vk2_blob',
      createdAt: opts.createdAt || new Date().toISOString(),
      restorePolicy: {
        pinWrap: 'regenerate-on-device'
      },
      vk2_blob: blob,
      attachments: attachments
    };
  }

  function validateEnvelope(envelope) {
    if (
      !isObject(envelope) ||
      envelope.app !== 'VaultKey' ||
      envelope.format !== 'vkbak' ||
      envelope.vaultFormat !== 'vk2_blob'
    ) {
      throw new Error('La copia no tiene un formato valido de VaultKey');
    }

    var version = Number(envelope.version);
    if (version !== 3 && version !== 4) {
      throw new Error('Version de respaldo no soportada');
    }

    if (
      version === 4 &&
      (
        !isObject(envelope.restorePolicy) ||
        envelope.restorePolicy.pinWrap !== 'regenerate-on-device'
      )
    ) {
      throw new Error('Politica de restauracion no soportada');
    }

    validateBlob(envelope.vk2_blob);
    validateAttachments(envelope.attachments);

    return envelope;
  }

  function assertDependencies(opts) {
    if (!opts || !opts.store || !opts.attachments || !opts.crypto) {
      throw new Error('Dependencias de restauracion incompletas');
    }

    var store = opts.store;
    var attachments = opts.attachments;
    var crypto = opts.crypto;

    if (
      typeof store.loadBlob !== 'function' ||
      typeof store.saveBlob !== 'function' ||
      typeof store.removeBlob !== 'function' ||
      typeof store.loadPinWrap !== 'function' ||
      typeof store.savePinWrap !== 'function' ||
      typeof store.removePinWrap !== 'function'
    ) {
      throw new Error('vkStore no ofrece la API requerida');
    }

    if (
      typeof attachments.exportAll !== 'function' ||
      typeof attachments.replaceAll !== 'function'
    ) {
      throw new Error('vkAttachments no ofrece la API requerida');
    }

    if (
      typeof crypto.getOrCreatePepper !== 'function' ||
      typeof crypto.createPinWrapFromVault !== 'function'
    ) {
      throw new Error('vkCrypto no ofrece la API requerida');
    }
  }

  function restoreStoredValue(store, value, saveName, removeName) {
    if (value === null || value === undefined) {
      store[removeName]();
    } else {
      store[saveName](clone(value));
    }
  }

  function restore(envelope, opts) {
    opts = opts || {};

    var validated;
    try {
      validated = validateEnvelope(envelope);
      assertDependencies(opts);
    } catch (err) {
      return Promise.reject(err);
    }

    if (!isObject(opts.credential)) {
      return Promise.reject(new Error('Credencial de restauracion obligatoria'));
    }
    if (typeof opts.pin !== 'string' || !/^\d{6}$/.test(opts.pin)) {
      return Promise.reject(new Error('El PIN de restauracion debe tener 6 digitos'));
    }

    var store = opts.store;
    var attachments = opts.attachments;
    var crypto = opts.crypto;

    var snapshot = {
      blob: clone(store.loadBlob()),
      pinWrap: clone(store.loadPinWrap()),
      attachments: null
    };

    var newPinWrap;

    return attachments.exportAll()
      .then(function (currentAttachments) {
        snapshot.attachments = clone(currentAttachments);
        return crypto.getOrCreatePepper();
      })
      .then(function (pepper) {
        return crypto.createPinWrapFromVault(
          validated.vk2_blob,
          opts.credential,
          opts.pin,
          pepper
        );
      })
      .then(function (pinWrap) {
        newPinWrap = clone(pinWrap);
        return attachments.replaceAll(validated.attachments);
      })
      .then(function () {
        store.saveBlob(validated.vk2_blob);
        store.savePinWrap(newPinWrap);

        var savedBlob = store.loadBlob();
        var savedPinWrap = store.loadPinWrap();

        if (JSON.stringify(savedBlob) !== JSON.stringify(validated.vk2_blob)) {
          throw new Error('No se pudo verificar la boveda restaurada');
        }
        if (JSON.stringify(savedPinWrap) !== JSON.stringify(newPinWrap)) {
          throw new Error('No se pudo verificar el pinwrap restaurado');
        }

        return attachments.exportAll();
      })
      .then(function (savedAttachments) {
        var expectedAttachments = {
          format: validated.attachments.format,
          formatVersion: validated.attachments.formatVersion,
          records: validated.attachments.records
        };
        var actualAttachments = {
          format: savedAttachments && savedAttachments.format,
          formatVersion: savedAttachments && savedAttachments.formatVersion,
          records: savedAttachments && savedAttachments.records
        };

        if (JSON.stringify(actualAttachments) !== JSON.stringify(expectedAttachments)) {
          throw new Error('No se pudieron verificar los adjuntos restaurados');
        }

        return {
          ok: true,
          version: Number(validated.version)
        };
      })
      .catch(function (restoreError) {
        var rollback = Promise.resolve()
          .then(function () {
            restoreStoredValue(store, snapshot.blob, 'saveBlob', 'removeBlob');
          })
          .then(function () {
            restoreStoredValue(store, snapshot.pinWrap, 'savePinWrap', 'removePinWrap');
          })
          .then(function () {
            if (snapshot.attachments) {
              return attachments.replaceAll(snapshot.attachments);
            }
          });

        return rollback.then(
          function () { throw restoreError; },
          function (rollbackError) {
            var combined = new Error(
              'La restauracion fallo y el rollback no pudo completarse: ' +
              (rollbackError && rollbackError.message ? rollbackError.message : rollbackError)
            );
            combined.restoreError = restoreError;
            combined.rollbackError = rollbackError;
            throw combined;
          }
        );
      });
  }

  return {
    BACKUP_VERSION: BACKUP_VERSION,
    createEnvelope: createEnvelope,
    validateEnvelope: validateEnvelope,
    validateBlob: validateBlob,
    validateAttachments: validateAttachments,
    restore: restore
  };
});
