/* ============================================================
   VaultKey 2.0 — vk-debug.js
   Panel de diagnóstico interno para desarrollo ("VK_DEBUG").

   PROPÓSITO: sustituir el ciclo manual de DevTools/consola/borrar
   IndexedDB por un panel dentro de la propia app que muestra estado
   (sesión, DEK, IndexedDB, vkAttachments) y ejecuta un smoke test
   real del ciclo guardar → leer → reemplazar → borrar de adjuntos.

   REGLAS: aislado (sin app.js, sin vault-store.js, sin
   vault-crypto.js); NUNCA implementa cifrado propio — solo llama a
   las funciones públicas ya existentes de vkSession/vkAttachments;
   solo se activa si localStorage.vk_debug === '1' (nunca por
   defecto); no engancha window.onerror global, solo registra los
   errores que producen sus propias sondas y pruebas.
   ============================================================ */

(function (root, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  if (root) { root.vkDebug = api; }
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';

  var FLAG_KEY = 'vk_debug';
  var PANEL_ID = 'vkdbg-panel';
  var TRIGGER_ID = 'vkdbg-trigger';
  var STYLE_ID = 'vkdbg-style';
  var MAX_ERRORS = 30;

  var errorLog = [];      /* más reciente primero */
  var panelState = { state: null, results: null, running: false };

  /* ---- utilidades ---- */

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function logError(source, message) {
    errorLog.unshift({ ts: Date.now(), source: String(source), message: String(message) });
    if (errorLog.length > MAX_ERRORS) { errorLog.length = MAX_ERRORS; }
  }

  function isEnabled() {
    try { return root.localStorage && root.localStorage.getItem(FLAG_KEY) === '1'; }
    catch (e) { return false; }
  }

  function enable() {
    try { root.localStorage.setItem(FLAG_KEY, '1'); } catch (e) { /* ignorar */ }
    mountTrigger();
    return true;
  }

  function disable() {
    try { root.localStorage.removeItem(FLAG_KEY); } catch (e) { /* ignorar */ }
    removeTrigger();
    return true;
  }

  /* ---- sonda de estado (solo lectura) ---- */

  function probeState() {
    var out = {
      session: { available: typeof vkSession !== 'undefined', active: false },
      dek: { available: false },
      indexedDB: { available: typeof indexedDB !== 'undefined', ok: false, detail: '' },
      vkAttachments: { available: typeof vkAttachments !== 'undefined', methods: [] },
      errors: errorLog.slice(0, 20)
    };

    if (out.session.available) {
      try { out.session.active = !!vkSession.isActive(); } catch (e) { /* deja active=false */ }
    }
    if (out.session.active) {
      try { out.dek.available = !!vkSession.getDEK(); } catch (e) { out.dek.available = false; }
    }

    if (out.vkAttachments.available) {
      ['init', 'has', 'list', 'save', 'load', 'replace', 'delete', 'deleteAll', 'exportAll', 'importAll'].forEach(function (fn) {
        if (typeof vkAttachments[fn] === 'function') { out.vkAttachments.methods.push(fn); }
      });
      return vkAttachments.list().then(function () {
        out.indexedDB.ok = true;
        return out;
      }, function (err) {
        out.indexedDB.ok = false;
        out.indexedDB.detail = String((err && err.message) || err);
        logError('sonda IndexedDB', out.indexedDB.detail);
        return out;
      });
    }
    return Promise.resolve(out);
  }

  /* ---- generación de blobs de prueba (canvas, sin bytes hardcodeados) ---- */

  function makeTestPngBlob(color) {
    return new Promise(function (resolve, reject) {
      try {
        var canvas = root.document.createElement('canvas');
        canvas.width = 1; canvas.height = 1;
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 1, 1);
        canvas.toBlob(function (blob) {
          if (blob) { resolve(blob); } else { reject(new Error('No se pudo generar el blob de prueba')); }
        }, 'image/png');
      } catch (err) { reject(err); }
    });
  }

  function blobsEqual(b1, b2) {
    if (b1.size !== b2.size) { return Promise.resolve(false); }
    return Promise.all([b1.arrayBuffer(), b2.arrayBuffer()]).then(function (bufs) {
      var a1 = new Uint8Array(bufs[0]), a2 = new Uint8Array(bufs[1]);
      for (var i = 0; i < a1.length; i++) { if (a1[i] !== a2[i]) { return false; } }
      return true;
    });
  }

  /* ---- suite de pruebas end-to-end (usa la API pública real) ---- */

  function runTests() {
    var results = [];
    var testId = 'vkdbg-test-' + (root.crypto && root.crypto.randomUUID ? root.crypto.randomUUID() : String(Date.now()));
    var testEntryId = 'vkdbg-entry-' + testId;
    var dek = null;
    var cleanupNeeded = false;

    function record(name, ok, detail) {
      results.push({ name: name, status: ok ? 'PASADO' : 'FALLIDO', detail: detail || '' });
      if (!ok) { logError('prueba: ' + name, detail || 'fallo sin detalle'); }
    }

    var sessionActive = typeof vkSession !== 'undefined' && (function () { try { return vkSession.isActive(); } catch (e) { return false; } })();
    record('Comprobar sesión VK2 activa', sessionActive, sessionActive ? '' : 'vkSession no está definida o no hay sesión activa — desbloquea la bóveda antes de ejecutar las pruebas.');
    if (!sessionActive) { return Promise.resolve(results); }

    try { dek = vkSession.getDEK(); } catch (err) {
      record('Obtener DEK de la sesión', false, String((err && err.message) || err));
      return Promise.resolve(results);
    }
    record('Obtener DEK de la sesión', !!dek, dek ? '' : 'vkSession.getDEK() devolvió un valor vacío.');
    if (!dek) { return Promise.resolve(results); }

    if (typeof vkAttachments === 'undefined') {
      record('Módulo vkAttachments disponible', false, 'vkAttachments no está cargado (revisa app.html o el Service Worker).');
      return Promise.resolve(results);
    }

    var blobA, blobB;

    return makeTestPngBlob('#ff0000')
      .then(function (b) {
        blobA = b;
        return vkAttachments.save({ id: testId, entryId: testEntryId, file: blobA, dekKey: dek });
      })
      .then(function (meta) {
        cleanupNeeded = true;
        record('Guardar blob cifrado', !!(meta && meta.id === testId), '');
      }, function (err) {
        record('Guardar blob cifrado', false, String((err && err.message) || err));
      })
      .then(function () {
        if (!cleanupNeeded) { return; }
        return vkAttachments.load({ id: testId, dekKey: dek })
          .then(function (loaded) { return blobsEqual(loaded.blob, blobA); })
          .then(function (matches) {
            record('Leer blob y verificar contenido', matches, matches ? '' : 'El contenido descifrado no coincide con el original.');
          }, function (err) {
            record('Leer blob y verificar contenido', false, String((err && err.message) || err));
          });
      })
      .then(function () {
        if (!cleanupNeeded) { return; }
        return makeTestPngBlob('#0000ff')
          .then(function (b) { blobB = b; return vkAttachments.replace({ id: testId, file: blobB, dekKey: dek }); })
          .then(function () { return vkAttachments.load({ id: testId, dekKey: dek }); })
          .then(function (loaded2) { return blobsEqual(loaded2.blob, blobB); })
          .then(function (matchesB) {
            record('Reemplazar blob y verificar nuevo contenido', matchesB, matchesB ? '' : 'Tras replace(), el contenido leído no coincide con el nuevo archivo.');
          }, function (err) {
            record('Reemplazar blob y verificar nuevo contenido', false, String((err && err.message) || err));
          });
      })
      .then(function () {
        if (!cleanupNeeded) { return; }
        return vkAttachments.delete({ id: testId })
          .then(function () { return vkAttachments.has({ id: testId }); })
          .then(function (stillThere) {
            record('Borrar blob', stillThere === false, stillThere ? 'has() todavía devuelve true tras delete().' : '');
            cleanupNeeded = false;
          }, function (err) {
            record('Borrar blob', false, String((err && err.message) || err));
          });
      })
      .then(function () {
        if (cleanupNeeded) { return vkAttachments['delete']({ id: testId }).catch(function () {}); }
      })
      .then(function () { return results; });
  }

  /* ---- UI: botón flotante + panel (inyectados por el propio módulo) ---- */

  function ensureStyles() {
    if (root.document.getElementById(STYLE_ID)) { return; }
    var style = root.document.createElement('style');
    style.id = STYLE_ID;
    style.textContent =
      '.vkdbg-trigger{position:fixed;right:14px;bottom:14px;z-index:99998;background:#182F4E;color:#fff;border:1px solid rgba(255,255,255,.2);border-radius:20px;padding:8px 14px;font:600 12px system-ui,sans-serif;cursor:pointer}' +
      '.vkdbg-panel{position:fixed;inset:0;z-index:99999;background:rgba(6,10,18,.92);color:#fff;font:13px/1.5 system-ui,sans-serif;display:flex;flex-direction:column;padding:16px;box-sizing:border-box;overflow:auto}' +
      '.vkdbg-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;font-size:15px}' +
      '.vkdbg-header button{background:none;border:0;color:#fff;font-size:16px;cursor:pointer}' +
      '.vkdbg-body h3{margin:16px 0 6px;font-size:13px;color:#7ab0d0}' +
      '.vkdbg-list{list-style:none;margin:0;padding:0}' +
      '.vkdbg-list li{background:#111827;border:1px solid rgba(58,74,96,.6);border-radius:8px;padding:8px 10px;margin-bottom:6px}' +
      '.vkdbg-ok{border-color:rgba(34,197,94,.5)!important}' +
      '.vkdbg-fail{border-color:rgba(239,68,68,.5)!important}' +
      '.vkdbg-muted{color:#7ab0d0;font-size:12px}' +
      '.vkdbg-actions{display:flex;gap:8px;margin-top:12px}' +
      '.vkdbg-actions button{background:#3B82F6;color:#fff;border:0;border-radius:8px;padding:8px 12px;font:600 12px system-ui,sans-serif;cursor:pointer}' +
      '.vkdbg-actions button[disabled]{opacity:.5;cursor:default}';
    root.document.head.appendChild(style);
  }

  function renderPanel() {
    var el = root.document.getElementById(PANEL_ID);
    if (!el) { return; }
    var s = panelState.state;
    var body = '';
    if (!s) {
      body = '<p class="vkdbg-muted">Cargando estado…</p>';
    } else {
      body += '<h3>Estado</h3><ul class="vkdbg-list">';
      body += '<li>vkSession: ' + (s.session.available ? (s.session.active ? '✅ activa' : '⚠️ cargada, sin sesión') : '❌ no cargada') + '</li>';
      body += '<li>DEK: ' + (s.session.active ? (s.dek.available ? '✅ disponible' : '❌ no disponible') : '— (requiere sesión activa)') + '</li>';
      body += '<li>vkAttachments: ' + (s.vkAttachments.available ? ('✅ cargado (' + s.vkAttachments.methods.length + ' métodos)') : '❌ no cargado') + '</li>';
      body += '<li>IndexedDB: ' + (s.indexedDB.available ? (s.indexedDB.ok ? '✅ operativa' : ('❌ ' + esc(s.indexedDB.detail))) : '❌ no disponible en este navegador') + '</li>';
      body += '</ul>';
      body += '<div class="vkdbg-actions">' +
        '<button type="button" data-vkdbg-action="refresh">Actualizar estado</button>' +
        '<button type="button" data-vkdbg-action="run-tests"' + (panelState.running ? ' disabled' : '') + '>' + (panelState.running ? 'Ejecutando…' : 'Ejecutar pruebas de adjuntos') + '</button>' +
        '</div>';
      if (panelState.results) {
        body += '<h3>Resultados</h3><ul class="vkdbg-list">' + panelState.results.map(function (r) {
          return '<li class="' + (r.status === 'PASADO' ? 'vkdbg-ok' : 'vkdbg-fail') + '"><strong>' + (r.status === 'PASADO' ? '✅ PASADO' : '❌ FALLIDO') + '</strong> — ' + esc(r.name) + (r.detail ? (' <span class="vkdbg-muted">(' + esc(r.detail) + ')</span>') : '') + '</li>';
        }).join('') + '</ul>';
      }
      if (s.errors && s.errors.length) {
        body += '<h3>Últimos errores</h3><ul class="vkdbg-list">' + s.errors.map(function (e) {
          return '<li><span class="vkdbg-muted">' + new Date(e.ts).toLocaleTimeString() + ' · ' + esc(e.source) + '</span><br>' + esc(e.message) + '</li>';
        }).join('') + '</ul>';
      }
    }
    el.querySelector('.vkdbg-body').innerHTML = body;
  }

  function refreshState() {
    renderPanel();
    probeState().then(function (s) { panelState.state = s; renderPanel(); });
  }

  function runAndRender() {
    panelState.running = true; renderPanel();
    runTests().then(function (results) {
      panelState.results = results;
      panelState.running = false;
      return probeState();
    }).then(function (s) {
      panelState.state = s;
      renderPanel();
    });
  }

  function openPanel() {
    ensureStyles();
    var el = root.document.getElementById(PANEL_ID);
    if (!el) {
      el = root.document.createElement('div');
      el.id = PANEL_ID;
      el.className = 'vkdbg-panel';
      el.innerHTML = '<div class="vkdbg-header"><strong>Diagnóstico VaultKey VK2</strong><button type="button" data-vkdbg-action="close" aria-label="Cerrar">✕</button></div><div class="vkdbg-body"></div>';
      el.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-vkdbg-action]');
        if (!btn) { return; }
        var action = btn.getAttribute('data-vkdbg-action');
        if (action === 'close') { closePanel(); }
        else if (action === 'refresh') { refreshState(); }
        else if (action === 'run-tests') { runAndRender(); }
      });
      root.document.body.appendChild(el);
    }
    el.hidden = false;
    refreshState();
  }

  function closePanel() {
    var el = root.document.getElementById(PANEL_ID);
    if (el) { el.hidden = true; }
  }

  function mountTrigger() {
    if (root.document.getElementById(TRIGGER_ID)) { return; }
    ensureStyles();
    var btn = root.document.createElement('button');
    btn.id = TRIGGER_ID;
    btn.type = 'button';
    btn.className = 'vkdbg-trigger';
    btn.textContent = 'VK2 🔧';
    btn.setAttribute('aria-label', 'Abrir diagnóstico VaultKey VK2');
    btn.addEventListener('click', openPanel);
    root.document.body.appendChild(btn);
  }

  function removeTrigger() {
    var btn = root.document.getElementById(TRIGGER_ID);
    if (btn) { btn.remove(); }
    closePanel();
  }

  function boot() {
    if (isEnabled()) { mountTrigger(); }
  }
  if (typeof root.document !== 'undefined') {
    if (root.document.readyState === 'loading') {
      root.document.addEventListener('DOMContentLoaded', boot);
    } else {
      boot();
    }
  }

  return {
    isEnabled: isEnabled,
    enable: enable,
    disable: disable,
    open: openPanel,
    close: closePanel,
    runTests: runTests,
    probeState: probeState
  };
});
