/* ============================================================
   VaultKey 2.0 — unlock.js
   Flujo de desbloqueo (Módulo 2 · tarea 2.5) — AISLADO
   CONTRATOS: 2.1 v1.0 (D-3 A+, D-4), decisión 08-07 (PIN bloqueado
   → siempre "Usar contraseña maestra"), regla congelada:
   10 intentos fallidos de PIN → wipe local.

   DECISIONES 11-07:
   · master-sin-contador: la master NO consume el contador del PIN.
   · El bloqueo temporal provisional (5/7/9 fallos) fue retirado
     para evitar código provisional frágil. El frame "PIN bloqueado"
     se implementa en integración con la política definitiva.

   REGLAS: sin app.js/app.html/index.html/sw.js/drive.js; sin
   dependencias. Salida de sesión: onUnlocked({ dekKey }).
   ============================================================ */

(function (root, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  if (root) { root.vkUnlock = api; }
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';

  var ROUTES = ['unlock'];
  var mode = 'pin'; /* 'pin' | 'master' */

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }
  function setHint(id, msg, kind) {
    var el = root.document.getElementById(id);
    if (!el) { return; }
    el.textContent = msg;
    el.className = 'vk-field__hint' + (kind ? ' vk-field__hint--' + kind : '');
  }
  function val(id) { var el = root.document.getElementById(id); return el ? el.value : ''; }

  /* ---- Plantillas ---- */
  function pinScreen() {
    return '<div style="padding:24px 16px;">' +
      '<h2 style="margin:0 0 4px;">Desbloquear VaultKey</h2>' +
      '<p class="vk-field__hint" style="font-size:14px;">Introduce tu PIN local.</p>' +
      '<form class="vk-form" onsubmit="return false">' +
      '<label class="vk-field"><span class="vk-field__label">PIN</span>' +
      '<span class="vk-field__control">' +
      '<input class="vk-input" id="ul-pin" type="password" inputmode="numeric" placeholder="••••••" autocomplete="off">' +
      '</span><span class="vk-field__hint" id="ul-pin-hint"></span></label></form>' +
      '<button class="vk-btn vk-btn--primary vk-btn--block" data-ul="submit-pin" style="margin-top:12px">Desbloquear</button>' +
      '<button class="vk-btn vk-btn--text vk-btn--block" data-ul="go-master" style="margin-top:8px">Usar contraseña maestra</button>' +
      '</div>';
  }
  function masterScreen() {
    return '<header class="vk-appbar">' +
      '<button class="vk-iconbtn" data-ul="go-pin" aria-label="Atrás">' +
      '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>' +
      '</button><div class="vk-appbar__title">Usar contraseña maestra</div></header>' +
      '<div style="padding:16px;"><form class="vk-form" onsubmit="return false">' +
      '<label class="vk-field"><span class="vk-field__label">Contraseña maestra</span>' +
      '<span class="vk-field__control">' +
      '<input class="vk-input" id="ul-master" type="password" placeholder="Introduce la contraseña" autocomplete="off">' +
      '</span><span class="vk-field__hint" id="ul-master-hint"></span></label></form>' +
      '<button class="vk-btn vk-btn--primary vk-btn--block" data-ul="submit-master" style="margin-top:12px">Desbloquear</button>' +
      '<p class="vk-field__hint" style="margin-top:10px;">' +
      'La contraseña maestra siempre puede desbloquear. No consume el contador de intentos del PIN.</p>' +
      '</div>';
  }

  /* ---- Lógica ---- */
  var lastCtx = null;
  function rerender(ctx) {
    if (ctx) { lastCtx = ctx; }
    if (lastCtx && lastCtx.container) {
      lastCtx.container.innerHTML = (mode === 'master') ? masterScreen() : pinScreen();
    }
  }
  function finish(ctx, dekKey) {
    mode = 'pin';
    if (typeof ctx.onUnlocked === 'function') { ctx.onUnlocked({ dekKey: dekKey }); }
    ctx.router.replace('/dashboard');
  }

  function handleAction(action, ctx) {
    if (action === 'go-master') { mode = 'master'; rerender(ctx); return; }
    if (action === 'go-pin')    { mode = 'pin';    rerender(ctx); return; }

    if (action === 'submit-pin') {
      var pin = val('ul-pin');
      var pinWrap = ctx.store.loadPinWrap();
      if (!pinWrap) {
        setHint('ul-pin-hint', 'No hay desbloqueo por PIN en este dispositivo. Usa la contraseña maestra.', 'error');
        return;
      }
      setHint('ul-pin-hint', 'Comprobando…');
      ctx.crypto.getOrCreatePepper()
        .then(function (pepper) { return ctx.crypto.openPinWrap(pinWrap, pin, pepper); })
        .then(function (dekKey) {
          ctx.store.resetAttempts();
          finish(ctx, dekKey);
        }, function () {
          /* PIN erróneo: incrementar contador (REGLA CONGELADA: 10 → wipe) */
          var r = ctx.store.recordFailedAttempt();
          if (r.mustWipe) {
            setHint('ul-pin-hint', 'Décimo intento fallido. Borrando datos locales…', 'error');
            ctx.store.wipeLocal().then(function () {
              mode = 'pin';
              ctx.router.replace('/welcome');
            });
          } else {
            setHint('ul-pin-hint', 'PIN incorrecto. Intentos restantes: ' + r.remaining + '.', 'error');
          }
        });
      return;
    }

    if (action === 'submit-master') {
      var master = val('ul-master');
      var blob = ctx.store.loadBlob();
      if (!blob) { setHint('ul-master-hint', 'No hay bóveda en este dispositivo.', 'error'); return; }
      setHint('ul-master-hint', 'Comprobando (unos segundos)…');
      ctx.crypto.openVaultBlob(blob, { master: master })
        .then(function (res) {
          ctx.store.resetAttempts(); /* limpia también lockUntil residual */
          finish(ctx, res.dekKey);
        }, function () {
          /* DECISIÓN 11-07: la master NO consume el contador del PIN */
          setHint('ul-master-hint', 'Contraseña incorrecta.', 'error');
        });
      return;
    }
  }

  return {
    routes: ROUTES.slice(),
    handlesRoute: function (name) { return name === 'unlock'; },
    render: function (route, container, ctx) {
      ctx.container = container;
      mode = 'pin';
      rerender(ctx);
      return true;
    },
    handleAction: handleAction
  };
});
