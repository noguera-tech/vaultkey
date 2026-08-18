/* ============================================================
   VaultKey · A11-R01.2 — Ajustes de Sonidos
   UI aislada sobre el motor sonoro existente de app.js.
   No toca cifrado, bóveda, backups ni credenciales.
   ============================================================ */

(function () {
  'use strict';

  var SOUND_KEY = 'vk_sound';
  var STYLE_KEY = 'vk_sound_style';
  var ALLOWED_STYLES = ['suave', 'minimo', 'cristal'];
  var STYLE_LABELS = {
    suave: 'Suave',
    minimo: 'Minimal',
    cristal: 'Cristal'
  };

  var draftEnabled = false;
  var draftStyle = 'suave';
  var previewCtx = null;

  // Identidades elegidas en la prueba física A11-R01.2.
  // copy/success/preview conservan exactamente la firma escuchada;
  // el resto de acciones reutiliza la misma identidad con variaciones
  // discretas de altura para mantener semántica sin cambiar timbre.
  var SOUND_IDENTITIES = {
    suave: [
      { freq: 495, type: 'triangle', vol: 0.022, attack: 0.002, duration: 0.040, t: 0 },
      { freq: 620, type: 'sine',     vol: 0.020, attack: 0.002, duration: 0.050, t: 38 }
    ],
    minimo: [
      { freq: 480, type: 'sine', vol: 0.018, attack: 0.002, duration: 0.025, t: 0 }
    ],
    cristal: [
      { freq: 640, type: 'triangle', vol: 0.018, attack: 0.002, duration: 0.032, t: 0 },
      { freq: 860, type: 'sine',     vol: 0.014, attack: 0.002, duration: 0.038, t: 35 }
    ]
  };

  var ACTION_FACTORS = {
    pin: 0.84,
    pinDel: 0.68,
    pinOk: 1.08,
    pinErr: 0.60,
    copy: 1,
    save: 0.96,
    del: 0.62,
    nav: 0.80,
    gen: 1.04,
    open: 0.90,
    success: 1,
    error: 0.58,
    lock: 0.54,
    empty: 0.72
  };

  var NEGATIVE_ACTIONS = { pinErr: true, del: true, error: true, lock: true, empty: true };

  function soundIsEnabled() {
    return localStorage.getItem(SOUND_KEY) === '1';
  }

  function normalizedStyle() {
    var stored = localStorage.getItem(STYLE_KEY) || 'suave';
    if (ALLOWED_STYLES.indexOf(stored) === -1) {
      localStorage.setItem(STYLE_KEY, 'suave');
      return 'suave';
    }
    return stored;
  }

  function loadDraftFromSaved() {
    draftEnabled = soundIsEnabled();
    draftStyle = normalizedStyle();
  }

  function findSoundCard() {
    var root = document.getElementById('interactionSettings');
    if (!root) return null;
    var cards = root.querySelectorAll('.vk-interaction-card');
    for (var i = 0; i < cards.length; i++) {
      var title = cards[i].querySelector('.vk-interaction-copy strong');
      if (title && title.textContent.trim() === 'Sonidos') return cards[i];
    }
    return null;
  }

  function updateSoundCardStatus() {
    var card = findSoundCard();
    if (!card) return;
    var status = card.querySelector('.vk-interaction-status');
    if (status) status.textContent = soundIsEnabled() ? 'Activado' : 'Desactivado';
  }

  function setStyles(el, styles) {
    Object.keys(styles).forEach(function (key) { el.style[key] = styles[key]; });
    return el;
  }

  function makeIcon(name) {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '24');
    svg.setAttribute('height', '24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    setStyles(svg, { flex: '0 0 24px', color: 'var(--vk-text)' });

    function path(d) {
      var p = document.createElementNS(ns, 'path');
      p.setAttribute('d', d);
      svg.appendChild(p);
    }
    function line(x1, y1, x2, y2) {
      var l = document.createElementNS(ns, 'line');
      l.setAttribute('x1', x1); l.setAttribute('y1', y1);
      l.setAttribute('x2', x2); l.setAttribute('y2', y2);
      svg.appendChild(l);
    }
    function polygon(points) {
      var p = document.createElementNS(ns, 'polygon');
      p.setAttribute('points', points);
      svg.appendChild(p);
    }

    if (name === 'waves-horizontal') {
      path('M2 12h2'); path('M6 8v8'); path('M10 5v14');
      path('M14 8v8'); path('M18 10v4'); path('M22 12h-2');
    } else if (name === 'audio-lines') {
      path('M2 10v3'); path('M6 6v11'); path('M10 3v18');
      path('M14 8v7'); path('M18 5v13'); path('M22 10v3');
    } else if (name === 'gem') {
      polygon('6 3 18 3 22 9 12 21 2 9');
      line('2', '9', '22', '9');
      path('m10 3-2 6 4 12 4-12-2-6');
    } else if (name === 'play') {
      polygon('6 3 20 12 6 21 6 3');
    }
    return svg;
  }

  function makeProfileRow(styleId, label, iconName) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'vk-row';
    button.setAttribute('data-sound-style', styleId);
    button.setAttribute('aria-pressed', 'false');
    setStyles(button, {
      minHeight: '41px',
      padding: '8px 16px',
      cursor: 'pointer',
      gap: '16px'
    });

    button.appendChild(makeIcon(iconName));

    var text = document.createElement('span');
    text.className = 'vk-row__body';
    var title = document.createElement('strong');
    title.className = 'vk-row__title';
    title.textContent = label;
    text.appendChild(title);

    var radio = document.createElement('span');
    radio.setAttribute('aria-hidden', 'true');
    radio.textContent = '○';
    setStyles(radio, {
      marginLeft: 'auto',
      fontSize: '26px',
      lineHeight: '1',
      color: 'var(--vk-text-muted)'
    });

    button.appendChild(text);
    button.appendChild(radio);
    button.addEventListener('click', function () {
      draftStyle = styleId;
      syncSheet();
    });
    return button;
  }

  function buildSheet() {
    if (document.getElementById('soundSettingsSheet')) return;

    var sheet = document.createElement('div');
    sheet.id = 'soundSettingsSheet';
    sheet.className = 'vk-sheet';
    sheet.setAttribute('aria-hidden', 'true');
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    sheet.setAttribute('aria-labelledby', 'soundSettingsTitle');

    var scrim = document.createElement('div');
    scrim.className = 'vk-sheet__scrim';
    scrim.setAttribute('data-vk-close', '');

    var panel = document.createElement('div');
    panel.className = 'vk-sheet__panel';
    setStyles(panel, {
      borderRadius: '24px 24px 0 0',
      padding: '8px 24px 30px',
      background: 'var(--vk-card)'
    });

    var handle = document.createElement('div');
    handle.className = 'vk-sheet__handle';

    var title = document.createElement('div');
    title.id = 'soundSettingsTitle';
    title.textContent = 'SONIDOS';
    setStyles(title, {
      marginTop: '2px',
      textAlign: 'center',
      fontSize: '14px',
      fontWeight: '600',
      color: '#ffffff'
    });

    var subtitle = document.createElement('div');
    subtitle.textContent = 'Respuesta sonora de VaultKey';
    setStyles(subtitle, {
      margin: '14px 8px 4px',
      fontSize: '12px',
      color: 'var(--vk-text-muted)'
    });

    var toggleCard = document.createElement('div');
    toggleCard.className = 'vk-card';
    var toggleRow = document.createElement('div');
    toggleRow.className = 'vk-row';
    setStyles(toggleRow, { minHeight: '40px', padding: '7px 16px' });

    var toggleText = document.createElement('span');
    toggleText.className = 'vk-row__body';
    var toggleTitle = document.createElement('strong');
    toggleTitle.className = 'vk-row__title';
    toggleTitle.textContent = 'Activar sonidos';
    toggleText.appendChild(toggleTitle);

    var toggle = document.createElement('label');
    toggle.className = 'vk-toggle';
    var input = document.createElement('input');
    input.id = 'soundSettingsToggle';
    input.type = 'checkbox';
    input.setAttribute('aria-label', 'Activar sonidos');
    var track = document.createElement('span');
    track.className = 'vk-toggle__track';
    toggle.appendChild(input);
    toggle.appendChild(track);
    toggleRow.appendChild(toggleText);
    toggleRow.appendChild(toggle);
    toggleCard.appendChild(toggleRow);

    input.addEventListener('change', function () {
      draftEnabled = input.checked;
      syncSheet();
    });

    var profiles = document.createElement('div');
    profiles.id = 'soundProfileCard';
    profiles.className = 'vk-card';
    setStyles(profiles, { marginTop: '16px' });
    profiles.appendChild(makeProfileRow('suave', 'Suave', 'waves-horizontal'));
    profiles.appendChild(makeProfileRow('minimo', 'Minimal', 'audio-lines'));
    profiles.appendChild(makeProfileRow('cristal', 'Cristal', 'gem'));

    var preview = document.createElement('button');
    preview.id = 'soundPreviewButton';
    preview.type = 'button';
    preview.className = 'vk-row vk-card';
    setStyles(preview, {
      marginTop: '10px',
      minHeight: '40px',
      padding: '7px 16px',
      cursor: 'pointer',
      gap: '16px'
    });
    preview.appendChild(makeIcon('play'));
    var previewText = document.createElement('strong');
    previewText.className = 'vk-row__title';
    previewText.textContent = 'Probar sonido';
    preview.appendChild(previewText);
    preview.addEventListener('click', function () {
      if (!draftEnabled) return;
      playIdentity(draftStyle, 'copy', true);
    });

    var actions = document.createElement('div');
    actions.className = 'vk-actions';
    setStyles(actions, {
      justifyContent: 'center',
      alignItems: 'center',
      gap: '65px',
      marginTop: '24px',
      paddingBottom: '2px'
    });

    var cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'vk-btn vk-btn--secondary';
    cancel.textContent = 'Cancelar';
    setStyles(cancel, {
      flex: '0 0 85px', width: '85px', minWidth: '85px', minHeight: '43px',
      padding: '0 7px', borderRadius: '14px', whiteSpace: 'nowrap', fontSize: '13px'
    });
    cancel.addEventListener('click', function () {
      loadDraftFromSaved();
      closeSoundSettings();
    });

    var save = document.createElement('button');
    save.type = 'button';
    save.className = 'vk-btn vk-btn--primary';
    save.textContent = 'Guardar';
    setStyles(save, {
      flex: '0 0 85px', width: '85px', minWidth: '85px', minHeight: '43px',
      padding: '0 7px', borderRadius: '14px', whiteSpace: 'nowrap', fontSize: '13px'
    });
    save.addEventListener('click', function () {
      localStorage.setItem(SOUND_KEY, draftEnabled ? '1' : '0');
      localStorage.setItem(STYLE_KEY, draftStyle);
      updateSoundCardStatus();
      closeSoundSettings();
      if (typeof window.toast === 'function') window.toast('Cambios guardados');
    });

    actions.appendChild(cancel);
    actions.appendChild(save);

    panel.appendChild(handle);
    panel.appendChild(title);
    panel.appendChild(subtitle);
    panel.appendChild(toggleCard);
    panel.appendChild(profiles);
    panel.appendChild(preview);
    panel.appendChild(actions);
    sheet.appendChild(scrim);
    sheet.appendChild(panel);
    document.body.appendChild(sheet);
  }

  function syncSheet() {
    var input = document.getElementById('soundSettingsToggle');
    if (input) input.checked = draftEnabled;

    var profiles = document.getElementById('soundProfileCard');
    if (profiles) {
      profiles.style.opacity = draftEnabled ? '1' : '0.55';
      profiles.style.pointerEvents = draftEnabled ? 'auto' : 'none';
    }

    var preview = document.getElementById('soundPreviewButton');
    if (preview) {
      preview.disabled = !draftEnabled;
      preview.style.opacity = draftEnabled ? '1' : '0.55';
    }

    var rows = document.querySelectorAll('#soundProfileCard [data-sound-style]');
    for (var i = 0; i < rows.length; i++) {
      var active = rows[i].getAttribute('data-sound-style') === draftStyle;
      rows[i].setAttribute('aria-pressed', active ? 'true' : 'false');
      var radio = rows[i].lastElementChild;
      if (radio) {
        radio.textContent = active ? '•' : '○';
        radio.style.color = active ? 'var(--vk-primary)' : 'var(--vk-text-muted)';
      }
    }
  }

  function closeSoundSettings() {
    if (typeof window.vkSheetClose === 'function') {
      window.vkSheetClose('soundSettingsSheet');
      return;
    }
    var sheet = document.getElementById('soundSettingsSheet');
    if (sheet) {
      sheet.classList.remove('vk-open');
      sheet.setAttribute('aria-hidden', 'true');
    }
  }

  function closeAllSheetsForLock() {
    document.querySelectorAll('.vk-sheet.vk-open').forEach(function (sheet) {
      if (typeof window.vkSheetClose === 'function' && sheet.id) window.vkSheetClose(sheet.id);
      else {
        sheet.classList.remove('vk-open');
        sheet.setAttribute('aria-hidden', 'true');
      }
    });
    loadDraftFromSaved();
  }

  function openSoundSettings() {
    buildSheet();
    loadDraftFromSaved();
    syncSheet();
    if (typeof window.vkSheetOpen === 'function') {
      window.vkSheetOpen('soundSettingsSheet');
    } else {
      var sheet = document.getElementById('soundSettingsSheet');
      if (sheet) {
        sheet.classList.add('vk-open');
        sheet.setAttribute('aria-hidden', 'false');
      }
    }
  }

  function installSoundCard() {
    var card = findSoundCard();
    if (!card || card.dataset.vkSoundReady === '1') return;
    card.dataset.vkSoundReady = '1';
    card.removeAttribute('onclick');
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', 'Configurar sonidos');
    card.style.cursor = 'pointer';
    card.addEventListener('click', openSoundSettings);
    card.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openSoundSettings();
      }
    });
    updateSoundCardStatus();
  }

  function getPreviewCtx() {
    if (!previewCtx) {
      try { previewCtx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { previewCtx = null; }
    }
    if (previewCtx && previewCtx.state === 'suspended') previewCtx.resume();
    return previewCtx;
  }

  function playOneTone(tone, allowDraft) {
    if (!allowDraft && !soundIsEnabled()) return;
    var ctx = getPreviewCtx();
    if (!ctx) return;
    var now = ctx.currentTime;
    var attack = tone.attack || 0.002;
    var duration = tone.duration || 0.04;
    var gain = ctx.createGain();
    var osc = ctx.createOscillator();
    gain.connect(ctx.destination);
    osc.connect(gain);
    osc.type = tone.type || 'sine';
    osc.frequency.setValueAtTime(tone.freq || 440, now);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(tone.vol || 0.018, now + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.start(now);
    osc.stop(now + duration + 0.01);
  }

  function tonesForAction(styleId, action) {
    var base = SOUND_IDENTITIES[styleId] || SOUND_IDENTITIES.suave;
    var factor = Object.prototype.hasOwnProperty.call(ACTION_FACTORS, action) ? ACTION_FACTORS[action] : 1;
    var tones = base.map(function (tone) {
      return {
        freq: Math.max(120, Math.round(tone.freq * factor)),
        type: tone.type,
        vol: tone.vol,
        attack: tone.attack,
        duration: tone.duration,
        t: tone.t || 0
      };
    });
    if (NEGATIVE_ACTIONS[action] && tones.length > 1) {
      tones = tones.slice().reverse().map(function (tone, index) {
        tone.t = index * 38;
        return tone;
      });
    }
    if (action === 'pin' || action === 'pinDel' || action === 'nav' || action === 'open' || action === 'empty') {
      tones = [tones[0]];
    }
    return tones;
  }

  function playIdentity(styleId, action, allowDraft) {
    tonesForAction(styleId, action).forEach(function (tone) {
      window.setTimeout(function () { playOneTone(tone, allowDraft); }, tone.t || 0);
    });
  }

  function installSelectedSoundProfiles() {
    if (typeof window.playStyle !== 'function' || window.playStyle.__vkA11R012) return;
    var originalPlayStyle = window.playStyle;
    var wrapped = function (action) {
      var style = localStorage.getItem(STYLE_KEY) || 'suave';
      if (ALLOWED_STYLES.indexOf(style) === -1) return originalPlayStyle.apply(this, arguments);
      playIdentity(style, action, false);
    };
    wrapped.__vkA11R012 = true;
    window.playStyle = wrapped;
  }

  function installCopySoundDeduplication() {
    if (typeof window.soundCopy !== 'function' || window.soundCopy.__vkDeduped) return;
    var original = window.soundCopy;
    var suppressNextQuickCopySound = false;

    document.addEventListener('click', function (event) {
      var button = event.target && event.target.closest
        ? event.target.closest('button[aria-label="Copiar usuario"], button[aria-label="Copiar contraseña"]')
        : null;
      if (button) suppressNextQuickCopySound = true;
    }, true);

    var wrapped = function () {
      if (suppressNextQuickCopySound) {
        suppressNextQuickCopySound = false;
        return;
      }
      return original.apply(this, arguments);
    };

    wrapped.__vkDeduped = true;
    window.soundCopy = wrapped;
  }

  function installPinNavigationSilence() {
    if (typeof window.show !== 'function' || typeof window.soundNav !== 'function' || window.show.__vkPinNavGuard) return;
    var originalShow = window.show;
    var originalSoundNav = window.soundNav;
    var suppressNextNav = false;

    var guardedSoundNav = function () {
      if (suppressNextNav) {
        suppressNextNav = false;
        return;
      }
      return originalSoundNav.apply(this, arguments);
    };

    var guardedShow = function (id, dir) {
      var active = document.querySelector('.screen.active');
      if (id === 'pin' || (active && active.id === 'pin')) suppressNextNav = true;
      return originalShow.call(this, id, dir);
    };

    guardedShow.__vkPinNavGuard = true;
    window.soundNav = guardedSoundNav;
    window.show = guardedShow;
  }

  function installLockSoundGuard() {
    if (typeof window.soundLock !== 'function' || typeof window.lock !== 'function' || window.lock.__vkLockSoundGuard) return;
    var originalSoundLock = window.soundLock;
    var originalLock = window.lock;
    var externalLockSoundPending = false;
    var suppressNestedLockSound = false;

    var guardedSoundLock = function () {
      if (suppressNestedLockSound) return;
      originalSoundLock.apply(this, arguments);
      externalLockSoundPending = true;
      Promise.resolve().then(function () { externalLockSoundPending = false; });
    };

    var guardedLock = function () {
      var hadExternalSound = externalLockSoundPending;
      externalLockSoundPending = false;
      suppressNestedLockSound = hadExternalSound;
      try {
        closeAllSheetsForLock();
        return originalLock.apply(this, arguments);
      } finally {
        suppressNestedLockSound = false;
      }
    };

    guardedLock.__vkLockSoundGuard = true;
    window.soundLock = guardedSoundLock;
    window.lock = guardedLock;
  }

  function installSheetLifecycleGuard() {
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) closeAllSheetsForLock();
    });
    window.addEventListener('pagehide', closeAllSheetsForLock);

    var pinScreen = document.getElementById('pin');
    if (pinScreen && window.MutationObserver) {
      var observer = new MutationObserver(function () {
        if (pinScreen.classList.contains('active')) closeAllSheetsForLock();
      });
      observer.observe(pinScreen, { attributes: true, attributeFilter: ['class'] });
    }
  }

  function init() {
    normalizedStyle();
    loadDraftFromSaved();
    buildSheet();
    installSoundCard();
    installSelectedSoundProfiles();
    installCopySoundDeduplication();
    installPinNavigationSilence();
    installLockSoundGuard();
    installSheetLifecycleGuard();
    updateSoundCardStatus();
  }

  window.openSoundSettings = openSoundSettings;

   if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
