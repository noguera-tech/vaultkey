/* ============================================================
   VaultKey 2.0 — router.js
   Navegación base aislada (Plan Módulo 1 · 1.7)

   REGLAS (decisión 08-07):
   · Pieza aislada: NO se integra en app.js en el Módulo 1.
   · Cero lectura de localStorage, Drive, bóveda, crypto o
     datos reales. El estado se lo pasa el integrador.
   · Navegación por hash (#/ruta) → historial del navegador
     gratis; el botón atrás de Android (TWA) funciona solo.

   API pública:
   · vkRouter.init({ onRender })  — arranca y renderiza la ruta actual
   · vkRouter.navigate(path)      — navega (añade al historial)
   · vkRouter.replace(path)       — navega sin añadir al historial
   · vkRouter.back()              — equivale al atrás del navegador
   · vkRouter.current()           — { name, path, params, meta }
   · vkRouter.routes              — tabla de rutas (solo lectura)
   · vkInitialRoute({ hasVault }) — función pura: 'welcome' | 'unlock'
   ============================================================ */

(function () {
  'use strict';

  /* ---------- Tabla de rutas (Especificación §8) ----------
     root: true  → pantalla raíz (Header principal)
     root: false → pantalla interna (AppBar secundaria)
     placeholder: true → declarada; su lógica llega en módulos
                         posteriores (onboarding/seguridad → M2)
     transition.ms → disolver por defecto 300 ms (Espec. §13)   */

  var DEFAULT_MS = 300;

  var ROUTES = [
    /* Estado de entrada / onboarding (placeholders — Módulo 2) */
    { name: 'splash',            pattern: '/splash',            root: true,  placeholder: true },
    { name: 'welcome',           pattern: '/welcome',           root: true,  placeholder: true },
    { name: 'unlock',            pattern: '/unlock',            root: true,  placeholder: true },
    { name: 'onboarding-master', pattern: '/onboarding/master', root: false, placeholder: true },
    { name: 'onboarding-pin',    pattern: '/onboarding/pin',    root: false, placeholder: true },
    { name: 'onboarding-kit-save',   pattern: '/onboarding/kit-save',   root: false, placeholder: true },
    { name: 'onboarding-kit-verify', pattern: '/onboarding/kit-verify', root: false, placeholder: true },
    { name: 'onboarding-creating',   pattern: '/onboarding/creating',   root: true,  placeholder: true },

    /* Raíces (Header principal) */
    { name: 'dashboard', pattern: '/dashboard', root: true },
    { name: 'passwords', pattern: '/passwords', root: true },
    { name: 'notes',     pattern: '/notes',     root: true },
    { name: 'cards',     pattern: '/cards',     root: true },
    { name: 'documents', pattern: '/documents', root: true },
    { name: 'favorites', pattern: '/favorites', root: true },
    { name: 'settings',  pattern: '/settings',  root: true },

    /* Internas por módulo (AppBar secundaria) */
    { name: 'entry-add',    pattern: '/:module/add',       root: false },
    { name: 'entry-detail', pattern: '/:module/:id',       root: false },
    { name: 'entry-edit',   pattern: '/:module/:id/edit',  root: false },

    /* Sub-pantallas de Ajustes (AppBar secundaria) */
    { name: 'settings-security',      pattern: '/settings/security',      root: false },
    { name: 'settings-backups',       pattern: '/settings/backups',       root: false },
    { name: 'settings-notifications', pattern: '/settings/notifications', root: false },
    { name: 'settings-info',          pattern: '/settings/info',          root: false },
    { name: 'settings-danger',        pattern: '/settings/danger',        root: false }
  ];

  /* Módulos válidos para rutas paramétricas :module */
  var MODULES = ['passwords', 'notes', 'cards', 'documents'];

  /* Transiciones especiales (Espec. §13) — declaradas como
     metadatos; la reproducción visual fiel llega con las
     pantallas reales (decisión 08-07). */
  var SPECIAL_TRANSITIONS = [
    { from: 'splash',              to: 'welcome',   ms: 1000 },
    { from: 'onboarding-creating', to: 'dashboard', ms: 1500 }
  ];

  var FALLBACK = '/dashboard';

  /* ---------- Matching ---------- */

  function matchRoute(path) {
    var segs = path.split('/').filter(Boolean);
    for (var i = 0; i < ROUTES.length; i++) {
      var r = ROUTES[i];
      var psegs = r.pattern.split('/').filter(Boolean);
      if (psegs.length !== segs.length) { continue; }
      var params = {};
      var ok = true;
      for (var j = 0; j < psegs.length; j++) {
        if (psegs[j].charAt(0) === ':') {
          var key = psegs[j].slice(1);
          if (key === 'module' && MODULES.indexOf(segs[j]) === -1) { ok = false; break; }
          params[key] = decodeURIComponent(segs[j]);
        } else if (psegs[j] !== segs[j]) {
          ok = false; break;
        }
      }
      if (ok) {
        return { name: r.name, path: path, params: params, meta: r };
      }
    }
    return null;
  }

  function transitionMs(fromName, toName) {
    for (var i = 0; i < SPECIAL_TRANSITIONS.length; i++) {
      var t = SPECIAL_TRANSITIONS[i];
      if (t.from === fromName && t.to === toName) { return t.ms; }
    }
    return DEFAULT_MS;
  }

  /* ---------- Núcleo ---------- */

  var state = { current: null, onRender: null };

  function currentPath() {
    var h = window.location.hash || '';
    return h.charAt(0) === '#' ? h.slice(1) : h;
  }

  function handleChange() {
    var path = currentPath();
    var match = path ? matchRoute(path) : null;
    if (!match) {
      /* Ruta desconocida o vacía → fallback sin ensuciar historial */
      window.location.replace('#' + FALLBACK);
      return;
    }
    var prev = state.current;
    match.transitionMs = transitionMs(prev ? prev.name : null, match.name);
    state.current = match;
    if (typeof state.onRender === 'function') {
      state.onRender(match, prev);
    }
  }

  window.vkRouter = {
    routes: ROUTES,
    init: function (opts) {
      state.onRender = opts && opts.onRender ? opts.onRender : null;
      window.addEventListener('hashchange', handleChange);
      handleChange();
    },
    navigate: function (path) { window.location.hash = '#' + path; },
    replace: function (path) { window.location.replace('#' + path); },
    back: function () { window.history.back(); },
    current: function () { return state.current; }
  };

  /* ---------- Regla de estado de entrada (función pura) ----------
     El router NO sabe si hay bóveda: se lo dice el integrador.
     (Regla congelada: con bóveda → desbloqueo; sin bóveda →
      bienvenida. Checklist QA: "usuario con bóveda existente no
      vuelve a Bienvenida".)                                       */

  window.vkInitialRoute = function (stateIn) {
    return stateIn && stateIn.hasVault ? 'unlock' : 'welcome';
  };

})();
