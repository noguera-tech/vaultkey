/* ============================================================
   VaultKey 2.1 — unlock.js
   Desbloqueo diario VK2 — PIN + contraseña maestra

   REGLAS CONSERVADAS:
   · PIN fijo de 6 dígitos.
   · Envío explícito; no hay autoenvío al sexto dígito.
   · 10 intentos fallidos de PIN → wipe local.
   · La contraseña maestra no consume intentos del PIN.
   · Sin biometría: la función legacy tryBio() no se reutiliza.
   · Guarda busy global: bloquea toda interacción durante crypto/wipe.
   · Sin dependencias de app.js/app.html; consume únicamente ctx.
   ============================================================ */

(function (root, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  if (root) { root.vkUnlock = api; }
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';

  var ROUTES = ['unlock'];
  var PIN_LEN = 6;
  var ui = {
    mode: 'pin',              /* 'pin' | 'master' */
    pinState: 'initial',      /* initial | ready | checking | error | wiping */
    masterState: 'normal',    /* normal | checking | error */
    pinBuffer: '',
    message: '',
    busy: false,
    masterVisible: false,
    masterValue: ''
  };
  var lastCtx = null;

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }

  function val(id) {
    var el = root.document.getElementById(id);
    return el ? el.value : '';
  }

  function legalHtml() {
    return '<p class="vk-unlock__legal">' +
      '<a href="https://nogueratech.app/privacy.html" target="_blank" rel="noopener noreferrer">Política de privacidad</a>' +
      '<span aria-hidden="true"> · </span>' +
      '<a href="https://nogueratech.app/terms.html" target="_blank" rel="noopener noreferrer">Términos de uso</a>' +
      '</p>';
  }

  function shieldHtml() {
    return '<div class="vk-unlock__shield" aria-hidden="true">' +
      '<svg class="vk-unlock__shield-outline" viewBox="0 0 151 181" fill="none">' +
        '<path d="M150.5 99.4875C150.5 144.48 117.688 166.976 78.6875 180.024C76.6453 180.688 74.4269 180.656 72.4062 179.934C33.3125 166.976 0.5 144.48 0.5 99.4875V36.498C0.5 34.1115 1.48772 31.8227 3.24588 30.1351C5.00403 28.4476 7.3886 27.4995 9.875 27.4995C28.625 27.4995 52.0625 16.7013 68.375 3.02362C70.3611 1.39488 72.8877 0.5 75.5 0.5C78.1123 0.5 80.6389 1.39488 82.625 3.02362C99.0312 16.7913 122.375 27.4995 141.125 27.4995C143.611 27.4995 145.996 28.4476 147.754 30.1351C149.512 31.8227 150.5 34.1115 150.5 36.498V99.4875Z"/>' +
      '</svg>' +
      '<svg class="vk-unlock__shield-lock" viewBox="0 0 36 40" fill="none">' +
        '<path d="M31.125 18.1479H4.875C2.80393 18.1479 1.125 19.8062 1.125 21.8517V34.8146C1.125 36.8601 2.80393 38.5183 4.875 38.5183H31.125C33.1961 38.5183 34.875 36.8601 34.875 34.8146V21.8517C34.875 19.8062 33.1961 18.1479 31.125 18.1479Z"/>' +
        '<path d="M8.625 18.1481V10.7407C8.625 8.285 9.61272 5.92987 11.3709 4.19342C13.129 2.45697 15.5136 1.48145 18 1.48145C20.4864 1.48145 22.871 2.45697 24.6291 4.19342C26.3873 5.92987 27.375 8.285 27.375 10.7407V18.1481"/>' +
      '</svg>' +
    '</div>';
  }

  function dotsHtml() {
    var out = '';
    var filled = (ui.pinState === 'checking') ? PIN_LEN : ui.pinBuffer.length;
    for (var i = 0; i < PIN_LEN; i++) {
      out += '<span class="vk-unlock__dot' + (i < filled ? ' vk-unlock__dot--filled' : '') + '" aria-hidden="true"></span>';
    }
    return out;
  }

  function keypadHtml() {
    var keys = ['1','2','3','4','5','6','7','8','9','','0','del'];
    var out = '';
    var disabled = ui.busy ? ' disabled' : '';
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      if (key === '') {
        out += '<span class="vk-unlock__key vk-unlock__key--empty" aria-hidden="true"></span>';
      } else if (key === 'del') {
        out += '<button type="button" class="vk-unlock__key vk-unlock__key--delete" data-ul="del" aria-label="Borrar"' + disabled + '>' +
          '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 4H8l-7 8 7 8h13z"/><path d="M18 9l-6 6M12 9l6 6"/></svg>' +
          '</button>';
      } else {
        out += '<button type="button" class="vk-unlock__key" data-ul="digit-' + key + '" aria-label="Dígito ' + key + '"' + disabled + '>' + key + '</button>';
      }
    }
    return out;
  }

  function pinStatusHtml() {
    if (!ui.message) { return '<p class="vk-unlock__status" aria-live="polite"></p>'; }
    return '<p class="vk-unlock__status" aria-live="assertive">' + esc(ui.message) + '</p>';
  }

  function pinScreen() {
    var ready = ui.pinBuffer.length === PIN_LEN && !ui.busy;
    var buttonText = ui.pinState === 'checking' ? 'Comprobando…' : 'Desbloquear';
    return '<div class="vk-unlock vk-unlock--' + ui.pinState + '">' +
      '<main class="vk-unlock__panel">' +
        shieldHtml() +
        '<h1 class="vk-unlock__brand">VaultKey</h1>' +
        '<p class="vk-unlock__subtitle">Introduce tu PIN</p>' +
        '<div class="vk-unlock__dots" aria-label="' + ui.pinBuffer.length + ' de 6 dígitos introducidos">' + dotsHtml() + '</div>' +
        pinStatusHtml() +
        '<div class="vk-unlock__keypad" aria-label="Teclado numérico">' + keypadHtml() + '</div>' +
        '<div class="vk-unlock__actions">' +
          '<button type="button" class="vk-btn vk-btn--primary vk-btn--block vk-unlock__submit" data-ul="submit-pin"' + (ready ? '' : ' disabled') + '>' + buttonText + '</button>' +
          '<button type="button" class="vk-btn vk-btn--text vk-btn--block vk-unlock__master-link" data-ul="go-master"' + (ui.busy ? ' disabled' : '') + '>Usar contraseña maestra</button>' +
        '</div>' +
        legalHtml() +
      '</main>' +
    '</div>';
  }

  function eyeSvg() {
    if (ui.masterVisible) {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 10.7a2 2 0 0 0 2.7 2.7"/><path d="M9.9 4.2A10.8 10.8 0 0 1 12 4c5.5 0 9 8 9 8a17 17 0 0 1-2.1 3.2"/><path d="M6.6 6.6C4.4 8.1 3 12 3 12s3.5 8 9 8a9.7 9.7 0 0 0 4.1-.9"/></svg>';
    }
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
  }

  function masterScreen() {
    var checking = ui.masterState === 'checking';
    var inputType = ui.masterVisible ? 'text' : 'password';
    var masterValue = esc(ui.masterValue);
    var message = ui.message || '';
    return '<div class="vk-unlock vk-unlock--master vk-unlock--' + ui.masterState + '">' +
      '<header class="vk-unlock__appbar">' +
        '<button type="button" class="vk-iconbtn" data-ul="go-pin" aria-label="Volver al PIN"' + (checking ? ' disabled' : '') + '>' +
          '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>' +
        '</button>' +
        '<div class="vk-unlock__appbar-title">Usar contraseña maestra</div>' +
      '</header>' +
      '<main class="vk-unlock__master-panel">' +
        shieldHtml() +
        '<h1 class="vk-unlock__brand">VaultKey</h1>' +
        '<label class="vk-unlock__master-field">' +
          '<span class="vk-sr-only">Contraseña maestra</span>' +
          '<span class="vk-unlock__master-control">' +
            '<input class="vk-input" id="ul-master" type="' + inputType + '" value="' + masterValue + '" placeholder="Contraseña maestra" autocomplete="current-password"' + (checking ? ' disabled' : '') + '>' +
            '<button type="button" class="vk-unlock__eye" data-ul="toggle-master" aria-label="' + (ui.masterVisible ? 'Ocultar contraseña' : 'Mostrar contraseña') + '"' + (checking ? ' disabled' : '') + '>' + eyeSvg() + '</button>' +
          '</span>' +
        '</label>' +
        '<p class="vk-unlock__master-info">La contraseña maestra no consume los intentos del PIN.</p>' +
        '<p class="vk-unlock__status" aria-live="assertive">' + esc(message) + '</p>' +
        '<button type="button" class="vk-btn vk-btn--primary vk-btn--block vk-unlock__master-submit" data-ul="submit-master"' + (checking ? ' disabled' : '') + '>' + (checking ? 'Comprobando…' : 'Desbloquear') + '</button>' +
        legalHtml() +
      '</main>' +
    '</div>';
  }

  function rerender(ctx) {
    if (ctx) { lastCtx = ctx; }
    if (lastCtx && lastCtx.container) {
      lastCtx.container.innerHTML = ui.mode === 'master' ? masterScreen() : pinScreen();
    }
  }

  function resetUi() {
    ui.mode = 'pin';
    ui.pinState = 'initial';
    ui.masterState = 'normal';
    ui.pinBuffer = '';
    ui.message = '';
    ui.busy = false;
    ui.masterVisible = false;
    ui.masterValue = '';
  }

  function finish(ctx, dekKey) {
    resetUi();
    if (typeof ctx.onUnlocked === 'function') { ctx.onUnlocked({ dekKey: dekKey }); }
    ctx.router.replace('/dashboard');
  }

  function handleAction(action, ctx) {
    if (ui.busy) { return; }

    if (action === 'go-master') {
      ui.mode = 'master';
      ui.masterState = 'normal';
      ui.masterValue = '';
      ui.message = '';
      rerender(ctx);
      return;
    }
    if (action === 'go-pin') {
  ui.mode = 'pin';
  ui.pinState = ui.pinBuffer.length === PIN_LEN ? 'ready' : 'initial';
  ui.message = '';
  ui.masterValue = '';
  ui.masterVisible = false;
  rerender(ctx);
  return;
}
    if (action === 'toggle-master') {
      ui.masterValue = val('ul-master');
      ui.masterVisible = !ui.masterVisible;
      rerender(ctx);
      return;
    }

    if (action.indexOf('digit-') === 0) {
      var n = action.slice(6);
      if (/^[0-9]$/.test(n) && ui.pinBuffer.length < PIN_LEN) {
        if (ui.pinState === 'error') { ui.message = ''; }
        ui.pinBuffer += n;
        ui.pinState = ui.pinBuffer.length === PIN_LEN ? 'ready' : 'initial';
        rerender(ctx);
      }
      return;
    }

    if (action === 'del') {
      ui.pinBuffer = ui.pinBuffer.slice(0, -1);
      ui.message = '';
      ui.pinState = ui.pinBuffer.length === PIN_LEN ? 'ready' : 'initial';
      rerender(ctx);
      return;
    }

    if (action === 'submit-pin') {
      if (ui.pinBuffer.length !== PIN_LEN) { return; }
      var pin = ui.pinBuffer;
      var pinWrap = ctx.store.loadPinWrap();
      if (!pinWrap) {
        ui.pinState = 'error';
        ui.message = 'No hay desbloqueo por PIN en este dispositivo. Usa la contraseña maestra.';
        rerender(ctx);
        return;
      }

      ui.busy = true;
      ui.pinState = 'checking';
      ui.message = '';
      rerender(ctx);

      ctx.crypto.getOrCreatePepper()
        .then(function (pepper) { return ctx.crypto.openPinWrap(pinWrap, pin, pepper); })
        .then(function (dekKey) {
          ctx.store.resetAttempts();
          finish(ctx, dekKey);
        }, function () {
          var r = ctx.store.recordFailedAttempt();
          ui.pinBuffer = '';
          if (r.mustWipe) {
            ui.pinState = 'wiping';
            ui.message = 'Décimo intento fallido. Borrando datos locales…';
            rerender(ctx);
            ctx.store.wipeLocal().then(function (result) {
              /* La bóveda principal ya se eliminó de forma síncrona dentro de
                 wipeLocal() antes de intentar el pepper (ver vault-store.js) --
                 este resultado nunca puede dejarnos con una bóveda a medias. */
              if (result && result.pepperDeleted === false) {
                console.error('[VK2] wipeLocal: el pepper del dispositivo no se pudo borrar', result.pepperError);
              }
              resetUi();
              ctx.router.replace('/welcome');
            });
          } else {
            ui.busy = false;
            ui.pinState = 'error';
            ui.message = 'PIN incorrecto. Intentos restantes: ' + r.remaining + '.';
            rerender(ctx);
          }
        });
      return;
    }

    if (action === 'submit-master') {
      var master = val('ul-master');
      ui.masterValue = master;
      var blob = ctx.store.loadBlob();
      if (!blob) {
        ui.masterState = 'error';
        ui.message = 'No hay bóveda en este dispositivo.';
        rerender(ctx);
        return;
      }
      if (!master) {
        ui.masterState = 'error';
        ui.message = 'Introduce la contraseña maestra.';
        rerender(ctx);
        return;
      }

      ui.busy = true;
      ui.masterState = 'checking';
      ui.message = '';
      rerender(ctx);

      ctx.crypto.openVaultBlob(blob, { master: master })
        .then(function (res) {
          ctx.store.resetAttempts();
          finish(ctx, res.dekKey);
        }, function () {
          ui.busy = false;
          ui.masterState = 'error';
          ui.message = 'Contraseña incorrecta.';
          rerender(ctx);
        });
      return;
    }
  }

  return {
    routes: ROUTES.slice(),
    handlesRoute: function (name) { return name === 'unlock'; },
    render: function (route, container, ctx) {
      ctx.container = container;
      resetUi();
      rerender(ctx);
      return true;
    },
    handleAction: handleAction
  };
});
