/* ============================================================
   VaultKey — vault-keys.js (PROPUESTA P0.2, NO integrada)
   Fuente única de nombres de clave para vault-state.js y
   transaction-store.js (corrige riesgo R-1 de la entrega P0).

   NOTA IMPORTANTE (riesgo residual, ver entrega): vault-store.js
   en producción define K_BLOB/K_PINWRAP/K_META de forma
   independiente y NO importa este archivo, porque esta propuesta
   no puede tocar vault-store.js sin autorización explícita. Este
   módulo centraliza las copias dentro de la PROPUESTA P0.2; la
   centralización completa contra el original exigiría una tarea
   aparte y autorizada sobre vault-store.js.
   ============================================================ */

(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  if (root) { root.vkKeys = api; }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  return {
    V1: {
      META: 'vk_meta_v1',
      DATA: 'vk_data_v1',
      RECOVERY: 'vk_recovery_v1',
      PIN_CHANGE_BACKUP: 'vk_pin_change_backup'
    },
    VK2: {
      BLOB: 'vk2_blob',
      PINWRAP: 'vk2_pinwrap',
      META: 'vk2_meta'
    },
    TX: {
      ACTIVE: 'vk_tx_active',
      SNAPSHOT: 'vk_tx_snapshot',
      CANDIDATE: 'vk_tx_candidate',
      LAST_RECOVERY: 'vk_tx_last_recovery',
      LAST_RECOVERY_SNAPSHOT: 'vk_tx_last_recovery_snapshot'
    }
  };
});
