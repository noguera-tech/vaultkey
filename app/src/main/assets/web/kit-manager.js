/* ============================================================
   VaultKey 2.0 — kit-manager.js
   Gestión del Emergency Kit (Módulo 2 · tarea 2.7) — AISLADO
   CONTRATO: 2.1 v1.0 D-2 (kit, PDF D-2b, verificación por PIN).

   REGLAS: sin app.js/app.html/index.html/sw.js/drive.js; sin nueva
   criptografía (reutiliza vkCrypto + vkStore). El código del kit
   nunca se expone en globales; solo aparece en el DOM tras PIN OK.
   ============================================================ */

(function (root, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  if (root) { root.vkKitManager = api; }
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }
  function val(id) { var el = root.document.getElementById(id); return el ? el.value : ''; }
  function setHint(id, msg, kind) {
    var el = root.document.getElementById(id);
    if (!el) { return; }
    el.textContent = msg;
    el.className = 'vk-field__hint' + (kind ? ' vk-field__hint--' + kind : '');
  }

  /* ---- Vista imprimible del kit (D-2b: nativa, sin dependencias) ---- */
  function openKitPrint(code) {
    var w = root.open('', '_blank');
    if (!w) { return false; }
    var d = new Date();
    w.document.write(
      '<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">' +
      '<title>Kit de emergencia de VaultKey</title>' +
      '<style>body{font-family:system-ui,sans-serif;padding:40px;color:#111}' +
      'h1{font-size:22px}.code{font-family:monospace;font-size:22px;letter-spacing:2px;' +
      'border:2px solid #111;padding:16px;text-align:center;margin:24px 0}' +
      'li{margin:6px 0}</style></head><body>' +
      '<h1>Kit de emergencia de VaultKey</h1>' +
      '<div class="code">' + esc(code) + '</div>' +
      '<p><b>Fecha:</b> ' + d.toLocaleDateString('es-ES') + '</p>' +
      '<ul>' +
      '<li>Este código es la única forma de recuperar tu bóveda si olvidas la contraseña maestra.</li>' +
      '<li>Guárdalo impreso o en un lugar seguro FUERA del teléfono.</li>' +
      '<li>No lo compartas con nadie ni lo guardes junto al dispositivo.</li>' +
      '<li>Si regeneras el kit desde la app, este código quedará invalidado.</li>' +
      '</ul><script>window.print();<\/script></body></html>');
    w.document.close();
    return true;
  }

  /* ---- showKit ----
     Renders PIN-entry form in container. On success, shows the kit
     code extracted from the blob by re-deriving via master.
     pinVerify(pin) → Promise<{kitRaw}> where kitRaw is the kit code.
     The caller supplies pinVerify so kit-manager has no direct access
     to the raw PIN or pepper — it only receives what pinVerify exposes. */
  function showKit(opts) {
    var container = opts.container;
    var pinVerify = opts.pinVerify; /* fn(pin) → Promise<string kitCode> */

    container.innerHTML =
      '<div style="padding:16px;">' +
      '<h3 style="margin:0 0 8px;">Ver kit de emergencia</h3>' +
      '<p class="vk-field__hint" style="font-size:13px;">Verifica tu PIN para ver el código.</p>' +
      '<form class="vk-form" onsubmit="return false;">' +
      '<label class="vk-field"><span class="vk-field__label">PIN</span>' +
      '<span class="vk-field__control">' +
      '<input class="vk-input" id="km-pin" type="password" inputmode="numeric" placeholder="••••••" autocomplete="off">' +
      '</span><span class="vk-field__hint" id="km-pin-hint"></span></label></form>' +
      '<button class="vk-btn vk-btn--primary vk-btn--block" id="km-verify-btn" style="margin-top:12px">Verificar PIN</button>' +
      '<div id="km-kit-section" style="display:none; margin-top:16px;">' +
      '<div class="vk-card" id="km-code" style="padding:16px; text-align:center; font-family:monospace; font-size:15px; letter-spacing:1px;"></div>' +
      '<div style="display:flex; gap:12px; margin-top:12px;">' +
      '<button class="vk-btn vk-btn--secondary" id="km-copy-btn" style="flex:1">Copiar</button>' +
      '<button class="vk-btn vk-btn--secondary" id="km-pdf-btn" style="flex:1">Descargar PDF</button>' +
      '</div><span class="vk-field__hint" id="km-copy-hint"></span>' +
      '</div></div>';

    var btn = root.document.getElementById('km-verify-btn');
    btn.addEventListener('click', function () {
      var pin = val('km-pin');
      setHint('km-pin-hint', 'Verificando…');
      btn.disabled = true;
      pinVerify(pin).then(function (kitCode) {
        setHint('km-pin-hint', 'PIN correcto.', 'ok');
        var section = root.document.getElementById('km-kit-section');
        var codeEl  = root.document.getElementById('km-code');
        codeEl.textContent = kitCode; /* código visible solo tras PIN OK */
        section.style.display = 'block';
        btn.style.display = 'none';

        root.document.getElementById('km-copy-btn').addEventListener('click', function () {
          if (root.navigator && root.navigator.clipboard) {
            root.navigator.clipboard.writeText(kitCode).then(function () {
              setHint('km-copy-hint', 'Copiado al portapapeles.', 'ok');
            }, function () {
              setHint('km-copy-hint', 'No se pudo copiar; usa el PDF.', 'error');
            });
          } else {
            setHint('km-copy-hint', 'Portapapeles no disponible.', 'error');
          }
        });

        root.document.getElementById('km-pdf-btn').addEventListener('click', function () {
          if (!openKitPrint(kitCode)) {
            setHint('km-copy-hint', 'Permite pop-ups para imprimir.', 'error');
          }
        });

      }, function () {
        setHint('km-pin-hint', 'PIN incorrecto.', 'error');
        btn.disabled = false;
      });
    });
  }

  /* ---- regenerateKit ----
     Requires master (not PIN): re-wrap of DEK needs the blob open.
     Returns Promise<{kitCode, blob}> or rejects on wrong master.     */
  function regenerateKit(opts) {
    var store  = opts.store;
    var crypto = opts.crypto;
    var master = opts.master;
    var blob   = store.loadBlob();
    if (!blob) { return Promise.reject(new Error('No hay bóveda.')); }
    return crypto.regenerateKit(blob, master).then(function (res) {
      store.saveBlob(res.blob);
      return { kitCode: res.kitCode, blob: res.blob };
    });
  }

  return { showKit: showKit, regenerateKit: regenerateKit };
});
