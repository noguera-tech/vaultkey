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
      return '<div style="padding:24px 16px;">' +
        '<h2 style="margin:0 0 8px;">Bienvenido a VaultKey</h2>' +
        '<p class="vk-field__hint" style="font-size:14px;">Tu bóveda cifrada local. Crea tu contraseña maestra para empezar.</p>' +
        '<button class="vk-btn vk-btn--primary vk-btn--block" data-ob="go-master" style="margin-top:24px">Crear bóveda</button></div>';
    },
    'onboarding-master': function () {
      return appbar('Crear contraseña maestra') + '<form class="vk-form" style="padding:16px;" onsubmit="return false">' +
        field('ob-master', 'Contraseña maestra', 'password', 'Introduce la contraseña') +
        field('ob-master2', 'Confirmar contraseña', 'password', 'Repítela') +
        '</form>' + actions('Continuar', 'submit-master');
    },
    'onboarding-pin': function () {
      return appbar('Crear PIN local') + '<form class="vk-form" style="padding:16px;" onsubmit="return false">' +
        field('ob-pin', 'PIN (6 dígitos)', 'password', '••••••') +
        field('ob-pin2', 'Confirmar PIN', 'password', '••••••') +
        '<p class="vk-field__hint">El PIN solo desbloquea este dispositivo. Tu contraseña maestra sigue siendo la llave real.</p>' +
        '</form>' + actions('Continuar', 'submit-pin');
    },
    'onboarding-kit-save': function () {
      return appbar('Guarda tu kit de emergencia') + '<div style="padding:16px;">' +
        '<p class="vk-field__hint" style="font-size:14px;">Si olvidas tu contraseña maestra, este código es la ÚNICA forma de recuperar tu bóveda. Guárdalo fuera del teléfono.</p>' +
        '<div class="vk-card" style="padding:16px; text-align:center; font-family:monospace; font-size:16px; letter-spacing:1px;" id="ob-kitcode"></div>' +
        '<div style="display:flex; gap:12px; margin-top:12px;">' +
        '<button class="vk-btn vk-btn--secondary" data-ob="kit-copy" style="flex:1">Copiar</button>' +
        '<button class="vk-btn vk-btn--secondary" data-ob="kit-pdf" style="flex:1">Descargar PDF</button></div>' +
        '<span class="vk-field__hint" id="ob-kit-hint"></span></div>' +
        actions('Ya lo he guardado', 'go-kit-verify');
    },
    'onboarding-kit-verify': function () {
      return appbar('Verifica tu kit') + '<form class="vk-form" style="padding:16px;" onsubmit="return false">' +
        '<p class="vk-field__hint" style="font-size:14px;">Introduce los 4 últimos caracteres de tu código para confirmar que lo has guardado.</p>' +
        field('ob-kit4', 'Últimos 4 caracteres', 'text', 'XXXX') +
        '</form>' + actions('Verificar y crear bóveda', 'submit-kit-verify');
    },
    'onboarding-creating': function () {
      return '<div class="vk-screen" style="min-height:60vh; display:flex; align-items:center; justify-content:center;">' +
        '<div style="text-align:center"><div style="font-size:20px; font-weight:600;">Creando tu bóveda…</div>' +
        '<div class="vk-field__hint" id="ob-creating-status">Derivando claves (unos segundos)</div></div></div>';
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
                return true;
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
      if (route.name === 'onboarding-kit-save') {
        root.document.getElementById('ob-kitcode').textContent = draft.kitCode || '(sin código: reinicia el flujo)';
      }
      if (route.name === 'onboarding-creating') {
        performCreation(ctx).then(function () {
          setTimeout(function () { ctx.router.replace('/dashboard'); }, 300); /* 1500 ms reales en integración */
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
