/* ============================================================
   VaultKey 2.0 — session.js
   Autobloqueo de sesión (Módulo 2 · tarea 2.6) — AISLADO
   CONTRATO: decisiones congeladas — opciones immediate/30s/1m/5m;
   eventos de actividad: pointerdown, keydown, touchstart.

   REGLAS: sin app.js/app.html/index.html/sw.js/drive.js; sin
   dependencias. Complementa unlock.js y vault-store.js.
   ============================================================ */

(function (root, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  if (root) { root.vkSession = api; }
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';

  var TIMEOUTS = { 'immediate': 0, '30s': 30000, '1m': 60000, '5m': 300000 };
  var ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'touchstart'];

  var _dek = null;       /* CryptoKey no extraíble; null = bloqueado */
  var _store = null;
  var _router = null;
  var _timer = null;
  var _onActivity = null;
  var _onVisibility = null;
  var _onBlur = null;
  var _timeoutMs = 0;

  function clearTimer() {
    if (_timer !== null) { root.clearTimeout(_timer); _timer = null; }
  }

  function scheduleTimer() {
    clearTimer();
    if (_timeoutMs <= 0) { return; }
    _timer = root.setTimeout(function () { lock(); }, _timeoutMs);
  }

  function removeListeners() {
    if (_onActivity) {
      ACTIVITY_EVENTS.forEach(function (ev) {
        root.removeEventListener(ev, _onActivity, true);
      });
      _onActivity = null;
    }
    if (_onVisibility) {
      root.document && root.document.removeEventListener('visibilitychange', _onVisibility);
      _onVisibility = null;
    }
    if (_onBlur) {
      root.removeEventListener('blur', _onBlur);
      _onBlur = null;
    }
  }

  function lock() {
    _dek = null;
    clearTimer();
    removeListeners();
    if (_router) { _router.replace('/unlock'); }
  }

  function start(opts) {
    stop();  /* limpiar por completo cualquier sesión anterior */
    _dek = opts.dekKey;
    _store = opts.store;
    _router = opts.router;

    var option = (_store && _store.getMeta().autolockOption) || 'immediate';
    _timeoutMs = TIMEOUTS[option] !== undefined ? TIMEOUTS[option] : 0;

    if (option === 'immediate') {
      /* Bloquear en cuanto la app pierde visibilidad o foco */
      _onVisibility = function () {
        if (root.document && root.document.visibilityState === 'hidden') { lock(); }
      };
      _onBlur = function () { lock(); };
      root.document && root.document.addEventListener('visibilitychange', _onVisibility);
      root.addEventListener('blur', _onBlur);
    } else {
      /* Timer de inactividad: se reinicia en cada evento de actividad */
      _onActivity = function () { scheduleTimer(); };
      ACTIVITY_EVENTS.forEach(function (ev) {
        root.addEventListener(ev, _onActivity, true);
      });
      scheduleTimer();
    }
  }

  function stop() {
    _dek = null;
    clearTimer();
    removeListeners();
  }

  function getDEK() { return _dek; }
  function isActive() { return _dek !== null; }

  return {
    TIMEOUTS: TIMEOUTS,
    ACTIVITY_EVENTS: ACTIVITY_EVENTS.slice(),
    start: start,
    lock: lock,
    stop: stop,
    getDEK: getDEK,
    isActive: isActive
  };
});
