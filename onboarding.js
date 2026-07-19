/* ============================================================
   VaultKey 2.0 — onboarding.js
   Flujo de onboarding R1 (Módulo 2 · tarea 2.4) — AISLADO
   CONTRATOS: Especificación §onboarding (8 pantallas, confirmaciones
   integradas), 2.1 v1.0 (D-2 kit, D-3 A+, D-4 sesión).

   REGLAS: sin app.js/app.html/index.html/sw.js/drive.js; sin
   dependencias; consume vkRouter + vkCrypto + vkStore + componentes.
   Credenciales: variables efímeras, anuladas tras el alta (D-4).
   PDF del kit (D-2b): vista imprimible nativa + print del sistema.

   PROVISIONAL (ajustable en checkpoint visual, no congelado aquí):
   · Umbral de master "fuerte": ≥12 caracteres y ≥3 clases.
   · PIN: 6 dígitos exactos.
   ============================================================ */

(function (root, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  if (root) { root.vkOnboarding = api; }
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';

  /* Estado efímero del alta (D-4): muere al terminar */
  var draft = { master: null, pin: null, kitCode: null };
  var ROUTES = ['splash', 'welcome', 'onboarding-master', 'onboarding-pin',
    'onboarding-kit-save', 'onboarding-kit-verify', 'onboarding-creating'];

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---- Reglas de avance ---- */
  function masterStrength(pw) {
    var classes = 0;
    if (/[a-z]/.test(pw)) { classes++; }
    if (/[A-Z]/.test(pw)) { classes++; }
    if (/[0-9]/.test(pw)) { classes++; }
    if (/[^A-Za-z0-9]/.test(pw)) { classes++; }
    if (pw.length >= 12 && classes >= 3) { return 'fuerte'; }
    if (pw.length >= 8 && classes >= 2) { return 'media'; }
    return 'debil';
  }
  function pinValid(pin) { return /^[0-9]{6}$/.test(pin); }

  /* ---- Plantillas (clases de components.css) ---- */
  function appbar(title) {
    return '<header class="vk-appbar"><button class="vk-iconbtn" data-ob="back" aria-label="Atrás">' +
      '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>' +
      '</button><div class="vk-appbar__title">' + esc(title) + '</div></header>';
  }
  function field(id, label, type, placeholder) {
    return '<label class="vk-field"><span class="vk-field__label">' + esc(label) + '</span>' +
      '<span class="vk-field__control"><input class="vk-input" id="' + id + '" type="' + type + '" placeholder="' + esc(placeholder || '') + '" autocomplete="off"></span>' +
      '<span class="vk-field__hint" id="' + id + '-hint"></span></label>';
  }
  function actions(primaryLabel, primaryAction) {
    return '<div style="display:flex; gap:12px; padding:16px;">' +
      '<button class="vk-btn vk-btn--secondary" data-ob="back" style="flex:1">Cancelar</button>' +
      '<button class="vk-btn vk-btn--primary" data-ob="' + primaryAction + '" style="flex:1">' + esc(primaryLabel) + '</button></div>';
  }

  var SCREENS = {
    'splash': function () {
      return '<div class="vk-screen" style="min-height:80vh; display:flex; align-items:center; justify-content:center;">' +
        '<div style="text-align:center"><div style="font-size:28px; font-weight:700;">VaultKey</div>' +
        '<div class="vk-field__hint">Splash (transición 1000 ms → Bienvenida)</div>' +
        '<button class="vk-btn vk-btn--primary" data-ob="go-welcome" style="margin-top:16px">Continuar</button></div></div>';
    },
    'welcome': function () {
      return '<div class="vk-onb">' +
        '<div class="vk-onb__shield">' +
          '<svg width="150" height="180" viewBox="0 0 151 181" fill="none">' +
          '<path d="M150.5 99.4875C150.5 144.48 117.688 166.976 78.6875 180.024C76.6453 180.688 74.4269 180.656 72.4062 179.934C33.3125 166.976 0.5 144.48 0.5 99.4875V36.498C0.5 34.1115 1.48772 31.8227 3.24588 30.1351C5.00403 28.4476 7.3886 27.4995 9.875 27.4995C28.625 27.4995 52.0625 16.7013 68.375 3.02362C70.3611 1.39488 72.8877 0.5 75.5 0.5C78.1123 0.5 80.6389 1.39488 82.625 3.02362C99.0312 16.7913 122.375 27.4995 141.125 27.4995C143.611 27.4995 145.996 28.4476 147.754 30.1351C149.512 31.8227 150.5 34.1115 150.5 36.498V99.4875Z" stroke="var(--vk-onb-stroke)" stroke-linecap="round" stroke-linejoin="round"/>' +
          '</svg>' +
          '<svg class="vk-onb__shield-lock" width="20" height="22" viewBox="0 0 36 40" fill="none">' +
          '<path d="M31.125 18.1479H4.875C2.80393 18.1479 1.125 19.8062 1.125 21.8517V34.8146C1.125 36.8601 2.80393 38.5183 4.875 38.5183H31.125C33.1961 38.5183 34.875 36.8601 34.875 34.8146V21.8517C34.875 19.8062 33.1961 18.1479 31.125 18.1479Z" stroke="var(--vk-onb-stroke)" stroke-linecap="round" stroke-linejoin="round"/>' +
          '<path d="M8.625 18.1481V10.7407C8.625 8.285 9.61272 5.92987 11.3709 4.19342C13.129 2.45697 15.5136 1.48145 18 1.48145C20.4864 1.48145 22.871 2.45697 24.6291 4.19342C26.3873 5.92987 27.375 8.285 27.375 10.7407V18.1481" stroke="var(--vk-onb-stroke)" stroke-linecap="round" stroke-linejoin="round"/>' +
          '</svg>' +
        '</div>' +
        '<h1 class="vk-onb__brand">VaultKey</h1>' +
        '<p class="vk-onb__subtitle">Todo lo importante.<br>En un solo lugar seguro.</p>' +
        '<button class="vk-btn vk-btn--primary vk-btn--block vk-onb__start" data-ob="go-master">Comenzar</button>' +
      '</div>';
    },
    'onboarding-master': function () {
      /* VK2 Figma onboarding master v1 */
      return '<section class="vk-onb-master">' +
        '<header class="vk-onb-master__appbar">' +
          '<button class="vk-iconbtn vk-onb-master__back" data-ob="back" aria-label="Atrás">' +
            '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
              '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>' +
            '</svg>' +
          '</button>' +
        '</header>' +
        '<div class="vk-onb-master__content">' +
          '<h1 class="vk-onb-master__title">Crea tu contraseña maestra</h1>' +
          '<p class="vk-onb-master__subtitle">Será la clave principal para proteger tu bóveda.</p>' +
          '<form class="vk-onb-master__form" onsubmit="return false">' +
            '<label class="vk-onb-master__field">' +
              '<span class="vk-onb-master__control">' +
                '<input class="vk-input vk-onb-master__input" id="ob-master" type="password" placeholder="Contraseña maestra" autocomplete="new-password">' +
              '</span>' +
              '<span class="vk-field__hint vk-onb-master__hint" id="ob-master-hint"></span>' +
            '</label>' +
            '<label class="vk-onb-master__field">' +
              '<span class="vk-onb-master__control">' +
                '<input class="vk-input vk-onb-master__input" id="ob-master2" type="password" placeholder="Confirmar contraseña" autocomplete="new-password">' +
              '</span>' +
              '<span class="vk-field__hint vk-onb-master__hint" id="ob-master2-hint"></span>' +
            '</label>' +
            '<div class="vk-onb-master__strength" aria-live="polite">' +
              '<div class="vk-onb-master__strength-track"><span id="ob-master-strength-bar"></span></div>' +
              '<span id="ob-master-strength-text">Seguridad: pendiente</span>' +
            '</div>' +
            '<ul class="vk-onb-master__rules">' +
              '<li id="ob-master-rule-length">Al menos 12 caracteres</li>' +
              '<li id="ob-master-rule-case">Mayúsculas y minúsculas</li>' +
              '<li id="ob-master-rule-extra">Números o símbolos</li>' +
            '</ul>' +
          '</form>' +
        '</div>' +
        '<div class="vk-onb-master__footer">' +
          '<button class="vk-btn vk-btn--primary vk-btn--block" id="ob-master-submit" data-ob="submit-master" disabled>Continuar</button>' +
        '</div>' +
      '</section>';
    },
    'onboarding-pin': function () {
      return '<section class="vk-onb-pin">' +
        '<header class="vk-onb-pin__appbar">' +
          '<button class="vk-onb-pin__back" type="button" data-ob="back" aria-label="Volver">' +
            '<svg viewBox="0 0 24 24" aria-hidden="true">' +
              '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>' +
            '</svg>' +
          '</button>' +
        '</header>' +
        '<div class="vk-onb-pin__content">' +
          '<h1 class="vk-onb-pin__title">Crea tu PIN local</h1>' +
          '<p class="vk-onb-pin__subtitle">Servirá para desbloquear VaultKey rápidamente en este dispositivo.</p>' +
          '<form class="vk-onb-pin__form" onsubmit="return false">' +
            '<label class="vk-onb-pin__field">' +
              '<span class="vk-onb-pin__sr-label">Introduce tu PIN</span>' +
              '<input class="vk-input vk-onb-pin__input" id="ob-pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" placeholder="Introduce tu PIN" autocomplete="off">' +
              '<span class="vk-field__hint vk-onb-pin__hint" id="ob-pin-hint"></span>' +
            '</label>' +
            '<label class="vk-onb-pin__field">' +
              '<span class="vk-onb-pin__sr-label">Vuelve a introducir el PIN</span>' +
              '<input class="vk-input vk-onb-pin__input" id="ob-pin2" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" placeholder="Vuelve a introducir el PIN" autocomplete="off">' +
              '<span class="vk-field__hint vk-onb-pin__hint" id="ob-pin2-hint"></span>' +
            '</label>' +
          '</form>' +
          '<div class="vk-onb-pin__explanation">' +
            '<p>El PIN no cifra tu bóveda.</p>' +
            '<p>Solo permite el desbloqueo rápido en este dispositivo.</p>' +
          '</div>' +
        '</div>' +
        '<div class="vk-onb-pin__footer">' +
          '<button class="vk-btn vk-btn--primary vk-onb-pin__submit" id="ob-pin-submit" type="button" data-ob="submit-pin" disabled>Continuar</button>' +
        '</div>' +
      '</section>';
    },
    'onboarding-kit-save': function () {
      return '<section class="vk-onb-kit-save">' +
        '<header class="vk-onb-kit-save__appbar">' +
          '<button class="vk-onb-kit-save__back" type="button" data-ob="back" aria-label="Volver">' +
            '<svg viewBox="0 0 24 24" aria-hidden="true">' +
              '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>' +
            '</svg>' +
          '</button>' +
        '</header>' +
        '<div class="vk-onb-kit-save__heading">' +
          '<h1 class="vk-onb-kit-save__title">Guarda tu kit de emergencia</h1>' +
          '<p class="vk-onb-kit-save__subtitle">Te ayudará a recuperar el acceso si olvidas tu<br>contraseña maestra.</p>' +
        '</div>' +
        '<div class="vk-onb-kit-save__block">' +
          '<div class="vk-onb-kit-save__code" id="ob-kitcode"></div>' +
          '<p class="vk-onb-kit-save__help">Descarga una copia y guárdala fuera del móvil.</p>' +
          '<button class="vk-onb-kit-save__download" type="button" data-ob="kit-pdf">' +
            '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14a2 2 0 0 0 2-2v-3"/><path d="M3 16v3a2 2 0 0 0 2 2"/></svg>' +
            '<span>Descargar PDF</span>' +
          '</button>' +
          '<button class="vk-onb-kit-save__submit" type="button" data-ob="go-kit-verify">Ya lo he guardado</button>' +
          '<p class="vk-onb-kit-save__warning">No podrás recuperar tu bóveda sin tu contraseña maestra<br>o tu kit de emergencia.</p>' +
          '<span class="vk-field__hint vk-onb-kit-save__hint" id="ob-kit-hint"></span>' +
        '</div>' +
      '</section>';
    },
    'onboarding-kit-verify': function () {
      return '<section class="vk-onb-kit-verify">' +
        '<header class="vk-onb-kit-verify__appbar">' +
          '<button class="vk-onb-kit-verify__back" type="button" data-ob="back" aria-label="Volver">' +
            '<svg viewBox="0 0 24 24" aria-hidden="true">' +
              '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>' +
            '</svg>' +
          '</button>' +
        '</header>' +
        '<div class="vk-onb-kit-verify__heading">' +
          '<h1 class="vk-onb-kit-verify__title">Verifica tu kit de emergencia</h1>' +
          '<p class="vk-onb-kit-verify__subtitle">Introduce el código indicado en tu kit para confirmar<br>que lo has guardado.</p>' +
        '</div>' +
        '<div class="vk-onb-kit-verify__block">' +
          '<label class="vk-onb-kit-verify__label" for="ob-kit4">Introduce los 4 últimos caracteres del código</label>' +
          '<div class="vk-onb-kit-verify__input-wrap">' +
            '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 19 6v5c0 4.8-2.7 8.1-7 10-4.3-1.9-7-5.2-7-10V6l7-3Z"/></svg>' +
            '<input class="vk-onb-kit-verify__input" id="ob-kit4" type="text" inputmode="text" maxlength="4" placeholder="Código de verificación" autocomplete="off" autocapitalize="characters" spellcheck="false">' +
          '</div>' +
          '<span class="vk-field__hint vk-onb-kit-verify__hint" id="ob-kit4-hint"></span>' +
          '<p class="vk-onb-kit-verify__help">Descarga o imprime una copia y guárdala en un lugar<br>seguro.</p>' +
          '<button class="vk-onb-kit-verify__submit" id="ob-kit-verify-submit" type="button" data-ob="submit-kit-verify" disabled>Verificar y continuar</button>' +
          '<p class="vk-onb-kit-verify__confirmation">Este paso confirma que has guardado<br>correctamente tu kit.</p>' +
          '<button class="vk-onb-kit-verify__download" type="button" data-ob="kit-pdf">Volver a descargar</button>' +
        '</div>' +
      '</section>';
    },
    'onboarding-creating': function () {
      return '<section class="vk-onb-creating" aria-live="polite">' +
        '<div class="vk-onb-creating__shield" aria-hidden="true">' +
          '<svg width="150" height="180" viewBox="0 0 151 181" fill="none">' +
            '<path d="M150.5 99.4875C150.5 144.48 117.688 166.976 78.6875 180.024C76.6453 180.688 74.4269 180.656 72.4062 179.934C33.3125 166.976 0.5 144.48 0.5 99.4875V36.498C0.5 34.1115 1.48772 31.8227 3.24588 30.1351C5.00403 28.4476 7.3886 27.4995 9.875 27.4995C28.625 27.4995 52.0625 16.7013 68.375 3.02362C70.3611 1.39488 72.8877 0.5 75.5 0.5C78.1123 0.5 80.6389 1.39488 82.625 3.02362C99.0312 16.7913 122.375 27.4995 141.125 27.4995C143.611 27.4995 145.996 28.4476 147.754 30.1351C149.512 31.8227 150.5 34.1115 150.5 36.498V99.4875Z" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>' +
          '</svg>' +
          '<svg class="vk-onb-creating__lock" width="36" height="40" viewBox="0 0 36 40" fill="none">' +
            '<path d="M31.125 18.1479H4.875C2.80393 18.1479 1.125 19.8062 1.125 21.8517V34.8146C1.125 36.8601 2.80393 38.5183 4.875 38.5183H31.125C33.1961 38.5183 34.875 36.8601 34.875 34.8146V21.8517C34.875 19.8062 33.1961 18.1479 31.125 18.1479Z" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>' +
            '<path d="M8.625 18.1481V10.7407C8.625 8.285 9.61272 5.92987 11.3709 4.19342C13.129 2.45697 15.5136 1.48145 18 1.48145C20.4864 1.48145 22.871 2.45697 24.6291 4.19342C26.3873 5.92987 27.375 8.285 27.375 10.7407V18.1481" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>' +
          '</svg>' +
        '</div>' +
        '<h1 class="vk-onb-creating__title">Creando tu bóveda</h1>' +
        '<p class="vk-onb-creating__subtitle" id="ob-creating-status">Protegiendo tu información…</p>' +
        '<div class="vk-onb-creating__dots" aria-label="Creando bóveda">' +
          '<span></span><span></span><span></span>' +
        '</div>' +
      '</section>';
    }
  };

  /* ---- Vista imprimible del kit (D-2b: nativa, sin dependencias) ---- */
  function openKitPrintView(code) {
    var w = root.open('', '_blank');
    if (!w) { return false; }
    var d = new Date();
    w.document.write(
      '<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Kit de emergencia de VaultKey</title>' +
      '<style>body{font-family:system-ui,sans-serif;padding:40px;color:#111}h1{font-size:22px}' +
      '.code{font-family:monospace;font-size:22px;letter-spacing:2px;border:2px solid #111;padding:16px;text-align:center;margin:24px 0}' +
      'li{margin:6px 0}</style></head><body>' +
      '<h1>Kit de emergencia de VaultKey</h1>' +
      '<div class="code">' + esc(code) + '</div>' +
      '<p><b>Fecha de generación:</b> ' + d.toLocaleDateString('es-ES') + '</p>' +
      '<ul><li>Este código es la única forma de recuperar tu bóveda si olvidas la contraseña maestra.</li>' +
      '<li>Guárdalo impreso o en un lugar seguro FUERA del teléfono.</li>' +
      '<li>No lo compartas con nadie ni lo guardes junto al dispositivo.</li>' +
      '<li>Si regeneras el kit desde la app, este código quedará invalidado.</li></ul>' +
      '<script>window.print();<\/script></body></html>');
    w.document.close();
    return true;
  }

  /* ---- Flujo ---- */
  function setHint(id, msg, kind) {
    var el = root.document.getElementById(id);
    if (!el) { return; }
    el.textContent = msg;
    el.className = 'vk-field__hint' + (kind ? ' vk-field__hint--' + kind : '');
  }
  function val(id) {
    var el = root.document.getElementById(id);
    return el ? el.value : '';
  }

  function handleAction(action, ctx) {
    var R = ctx.router;
    if (action === 'go-welcome') { R.navigate('/welcome'); return; }
    if (action === 'go-master') { R.navigate('/onboarding/master'); return; }
    if (action === 'back') { R.back(); return; }

    if (action === 'submit-master') {
      var m1 = val('ob-master'), m2 = val('ob-master2');
      var strength = masterStrength(m1);
      if (strength !== 'fuerte') {
        setHint('ob-master-hint', 'Contraseña ' + strength + ': usa al menos 12 caracteres con mayúsculas, minúsculas y números o símbolos.', 'error');
        return;
      }
      setHint('ob-master-hint', 'Contraseña fuerte', 'ok');
      if (m1 !== m2) { setHint('ob-master2-hint', 'Las contraseñas no coinciden', 'error'); return; }
      draft.master = m1;
      R.navigate('/onboarding/pin');
      return;
    }

    if (action === 'submit-pin') {
      var p1 = val('ob-pin'), p2 = val('ob-pin2');
      if (!pinValid(p1)) { setHint('ob-pin-hint', 'El PIN debe tener exactamente 6 dígitos', 'error'); return; }
      if (p1 !== p2) { setHint('ob-pin2-hint', 'Los PIN no coinciden', 'error'); return; }
      draft.pin = p1;
      draft.kitCode = ctx.crypto.generateKitCode();
      R.navigate('/onboarding/kit-save');
      return;
    }

    if (action === 'kit-copy') {
      var done = function () { setHint('ob-kit-hint', 'Copiado al portapapeles', 'ok'); };
      if (root.navigator && root.navigator.clipboard) {
        root.navigator.clipboard.writeText(draft.kitCode).then(done, function () {
          setHint('ob-kit-hint', 'No se pudo copiar; anótalo o usa el PDF', 'error');
        });
      } else { setHint('ob-kit-hint', 'Portapapeles no disponible; usa el PDF', 'error'); }
      return;
    }
    if (action === 'kit-pdf') {
      if (!openKitPrintView(draft.kitCode)) {
        setHint('ob-kit-hint', 'El navegador bloqueó la ventana; permite pop-ups para imprimir', 'error');
      }
      return;
    }
    if (action === 'go-kit-verify') { R.navigate('/onboarding/kit-verify'); return; }

    if (action === 'submit-kit-verify') {
      var typed = ctx.crypto.normalizeKitCode(val('ob-kit4'));
      var expected = ctx.crypto.normalizeKitCode(draft.kitCode).slice(-4);
      if (typed !== expected) {
        setHint('ob-kit4-hint', 'No coincide. Comprueba los 4 últimos caracteres de tu código.', 'error');
        return;
      }
      R.navigate('/onboarding/creating');
      /* El alta arranca al renderizarse "creating" (ver render) */
      return;
    }
  }

  function performCreation(ctx) {
    var payload = JSON.stringify({ app: 'VaultKey', schemaVersion: 2, entries: [] });
    return ctx.crypto.createVaultBlob({ master: draft.master, kitCode: draft.kitCode, payloadStr: payload })
      .then(function (alta) {
        ctx.store.saveBlob(alta.blob);
        return ctx.crypto.getOrCreatePepper().then(function (pepper) {
          /* pin-wrap requiere bytes crudos: se re-derivan por master
             UNA vez dentro del alta (los del blob ya murieron) */
          return ctx.crypto.deriveKEK(draft.master, uns(alta.blob.kdf.saltMaster), alta.blob.kdf.iterMaster)
            .then(function (kek) { return ctx.crypto.unwrapDEKRaw(alta.blob.wraps.master, kek); })
            .then(function (dekRaw) {
              return ctx.crypto.createPinWrap(dekRaw, draft.pin, pepper).then(function (pw) {
                if (dekRaw && dekRaw.fill) { dekRaw.fill(0); }
                ctx.store.savePinWrap(pw);
                ctx.store.setMeta({ onboardingDone: true });
                ctx.store.resetAttempts();
                /* D-4: las credenciales mueren aquí */
                draft.master = null; draft.pin = null; draft.kitCode = null;
                /* La CryptoKey no extraíble pasa directamente a la sesión. */
                return alta.dekKey;
              });
            });
        });
      });
    function uns(b64s) {
      var bin = root.atob(b64s), u = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) { u[i] = bin.charCodeAt(i); }
      return u;
    }
  }

  /* ---- API ---- */
  return {
    routes: ROUTES.slice(),
    masterStrength: masterStrength,
    pinValid: pinValid,
    handlesRoute: function (name) { return ROUTES.indexOf(name) !== -1; },
    render: function (route, container, ctx) {
      var fn = SCREENS[route.name];
      if (!fn) { return false; }
            container.innerHTML = fn();
      if (route.name === 'onboarding-master') {
        var masterInput = root.document.getElementById('ob-master');
        var masterConfirm = root.document.getElementById('ob-master2');
        var masterSubmit = root.document.getElementById('ob-master-submit');
        var strengthBar = root.document.getElementById('ob-master-strength-bar');
        var strengthText = root.document.getElementById('ob-master-strength-text');
        var ruleLength = root.document.getElementById('ob-master-rule-length');
        var ruleCase = root.document.getElementById('ob-master-rule-case');
        var ruleExtra = root.document.getElementById('ob-master-rule-extra');

        var updateMasterUi = function () {
          var m1 = masterInput ? masterInput.value : '';
          var m2 = masterConfirm ? masterConfirm.value : '';
          var strength = masterStrength(m1);
          var hasLength = m1.length >= 12;
          var hasCase = /[a-z]/.test(m1) && /[A-Z]/.test(m1);
          var hasExtra = /[0-9]/.test(m1) || /[^A-Za-z0-9]/.test(m1);
          var valid = strength === 'fuerte' && m1 === m2 && m2.length > 0;

          if (masterSubmit) { masterSubmit.disabled = !valid; }
          if (strengthBar) {
  var progress = 0;

  if (m1) {
    progress =
      Math.round((Math.min(m1.length, 12) / 12) * 60) +
      (hasCase ? 20 : 0) +
      (hasExtra ? 20 : 0);
  }

  strengthBar.className = m1 ? 'is-' + strength : '';
  strengthBar.style.width = Math.min(progress, 100) + '%';
}
          if (strengthText) {
            strengthText.textContent = 'Seguridad: ' + (m1 ? strength : 'pendiente');
          }
          if (ruleLength) { ruleLength.className = hasLength ? 'is-ok' : ''; }
          if (ruleCase) { ruleCase.className = hasCase ? 'is-ok' : ''; }
          if (ruleExtra) { ruleExtra.className = hasExtra ? 'is-ok' : ''; }
        };

        if (masterInput) { masterInput.addEventListener('input', updateMasterUi); }
        if (masterConfirm) { masterConfirm.addEventListener('input', updateMasterUi); }
        updateMasterUi();
      }
      if (route.name === 'onboarding-pin') {
        var pinInput = root.document.getElementById('ob-pin');
        var pinConfirm = root.document.getElementById('ob-pin2');
        var pinSubmit = root.document.getElementById('ob-pin-submit');

        var updatePinUi = function () {
          var p1 = pinInput ? pinInput.value.replace(/\D/g, '').slice(0, 6) : '';
          var p2 = pinConfirm ? pinConfirm.value.replace(/\D/g, '').slice(0, 6) : '';

          if (pinInput && pinInput.value !== p1) { pinInput.value = p1; }
          if (pinConfirm && pinConfirm.value !== p2) { pinConfirm.value = p2; }

          var valid = pinValid(p1) && p1 === p2;
          if (pinSubmit) { pinSubmit.disabled = !valid; }
        };

        if (pinInput) { pinInput.addEventListener('input', updatePinUi); }
        if (pinConfirm) { pinConfirm.addEventListener('input', updatePinUi); }
        updatePinUi();
      }
      if (route.name === 'onboarding-kit-save') {
        root.document.getElementById('ob-kitcode').textContent = draft.kitCode || '(sin código: reinicia el flujo)';
      }
      if (route.name === 'onboarding-kit-verify') {
        var kitVerifyInput = root.document.getElementById('ob-kit4');
        var kitVerifySubmit = root.document.getElementById('ob-kit-verify-submit');

        var updateKitVerifyUi = function () {
          var value = kitVerifyInput ? kitVerifyInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) : '';

          if (kitVerifyInput && kitVerifyInput.value !== value) {
            kitVerifyInput.value = value;
          }

          if (kitVerifySubmit) {
            kitVerifySubmit.disabled = value.length !== 4;
          }
        };

        if (kitVerifyInput) {
          kitVerifyInput.addEventListener('input', updateKitVerifyUi);
        }
        updateKitVerifyUi();
      }
      if (route.name === 'onboarding-creating') {
        var creatingStartedAt = Date.now();

        performCreation(ctx).then(function (dekKey) {
          var wait = Math.max(0, 2000 - (Date.now() - creatingStartedAt));

          setTimeout(function () {
            if (ctx && typeof ctx.onCreated === 'function') {
              ctx.onCreated({ dekKey: dekKey });
              return;
            }
            setTimeout(function () { ctx.router.replace('/dashboard'); }, 300);
          }, wait);
        }, function (e) {
          setHint('ob-creating-status', 'Error en el alta: ' + e.message, 'error');
        });
      }
      return true;
    },
    handleAction: handleAction,
    _resetDraftForTests: function () { draft.master = null; draft.pin = null; draft.kitCode = null; }
  };
});
