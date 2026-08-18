/* ============================================================
   VaultKey · A11-R01.4 — Ajustes de Sonidos
   Fidelidad visual: Figma 764:677.
   UI aislada sobre el motor sonoro existente de app.js.
   No toca cifrado, bóveda, backups ni credenciales.
   ============================================================ */

(function () {
  'use strict';

  var SOUND_KEY = 'vk_sound';
  var STYLE_KEY = 'vk_sound_style';
  var ALLOWED_STYLES = ['suave', 'minimo', 'cristal'];
  var draftEnabled = false;
  var draftStyle = 'suave';
  var previewCtx = null;

  var ICON_ASSETS = {
    suave: 'assets/sound-waves-horizontal.svg',
    minimo: 'assets/sound-audio-lines.svg',
    cristal: 'assets/sound-gem.svg',
    play: 'assets/sound-play.svg'
  };

  // Misma identidad elegida en la prueba física; solo aumenta la ganancia.
  var SOUND_IDENTITIES = {
    suave: [
      { freq: 495, type: 'triangle', vol: 0.066, attack: 0.002, duration: 0.040, t: 0 },
      { freq: 620, type: 'sine',     vol: 0.060, attack: 0.002, duration: 0.050, t: 38 }
    ],
    minimo: [
      { freq: 480, type: 'sine', vol: 0.054, attack: 0.002, duration: 0.025, t: 0 }
    ],
    cristal: [
      { freq: 640, type: 'triangle', vol: 0.054, attack: 0.002, duration: 0.032, t: 0 },
      { freq: 860, type: 'sine',     vol: 0.042, attack: 0.002, duration: 0.038, t: 35 }
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

  function setStyles(el, styles) {
    Object.keys(styles).forEach(function (key) { el.style[key] = styles[key]; });
    return el;
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

  function makeAssetIcon(assetKey) {
    var img = document.createElement('img');
    img.src = ICON_ASSETS[assetKey];
    img.alt = '';
    img.setAttribute('aria-hidden', 'true');
    img.width = 24;
    img.height = 24;
    setStyles(img, {
      display: 'block',
      width: '24px',
      height: '24px',
      flex: '0 0 24px',
      objectFit: 'contain'
    });
    return img;
  }

  function makeRadio() {
    var radio = document.createElement('span');
    radio.className = 'vk-sound-radio';
    radio.setAttribute('aria-hidden', 'true');
    setStyles(radio, {
      position: 'relative',
      display: 'block',
      width: '22px',
      height: '22px',
      minWidth: '22px',
      marginLeft: 'auto',
      borderRadius: '50%',
      background: '#d9d9d9'
    });

    var dot = document.createElement('span');
    dot.className = 'vk-sound-radio__dot';
    setStyles(dot, {
      position: 'absolute',
      width: '8px',
      height: '8px',
      left: '7px',
      top: '7px',
      borderRadius: '50%',
      background: '#1a1a1a',
      opacity: '0'
    });
    radio.appendChild(dot);
    return radio;
  }

  function makeProfileRow(styleId, label, assetKey, isLast) {
    var button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('data-sound-style', styleId);
    button.setAttribute('aria-pressed', 'false');
    setStyles(button, {
      boxSizing: 'border-box',
      display: 'flex',
      alignItems: 'center',
      width: '100%',
      height: isLast ? '42px' : '43px',
      padding: '0 20px 0 14px',
      gap: '29px',
      border: '0',
      borderBottom: isLast ? '0' : '1px solid rgba(58,74,96,0.8)',
      background: 'transparent',
      color: '#ffffff',
      font: 'inherit',
      cursor: 'pointer',
      textAlign: 'left'
    });

    button.appendChild(makeAssetIcon(assetKey));

    var title = document.createElement('span');
    title.textContent = label;
    setStyles(title, {
      fontSize: '16px',
      lineHeight: '20px',
      fontWeight: '600',
      color: '#ffffff',
      whiteSpace: 'nowrap'
    });
    button.appendChild(title);
    button.appendChild(makeRadio());

    button.addEventListener('click', function () {
      draftStyle = styleId;
      syncSheet();
    });
    return button;
  }

  function makeToggle() {
    var label = document.createElement('label');
    setStyles(label, {
      position: 'relative',
      display: 'block',
      width: '48px',
      height: '28px',
      marginLeft: 'auto',
      flex: '0 0 48px',
      borderRadius: '14px',
      background: '#334155',
      cursor: 'pointer'
    });

    var input = document.createElement('input');
    input.id = 'soundSettingsToggle';
    input.type = 'checkbox';
    input.setAttribute('aria-label', 'Activar sonidos');
    setStyles(input, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      margin: '0',
      opacity: '0',
      cursor: 'pointer'
    });

    var knob = document.createElement('span');
    knob.className = 'vk-sound-toggle-knob';
    setStyles(knob, {
      position: 'absolute',
      left: '5px',
      top: '4px',
      width: '20px',
      height: '20px',
      borderRadius: '50%',
      background: '#d9d9d9',
      transition: 'transform 150ms ease',
      pointerEvents: 'none'
    });

    input.addEventListener('change', function () {
      draftEnabled = input.checked;
      syncSheet();
    });

    label.appendChild(input);
    label.appendChild(knob);
    return label;
  }

  function makeActionButton(label, primary) {
    var button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    setStyles(button, {
      boxSizing: 'border-box',
      width: '85px',
      minWidth: '85px',
      height: '42.578px',
      minHeight: '42.578px',
      padding: '0',
      borderRadius: '16px',
      border: primary ? '1px solid #1e1e1e' : '1px solid #3a4a60',
      background: primary ? '#f59e0b' : 'transparent',
      color: '#ffffff',
      fontSize: '14px',
      lineHeight: '17px',
      fontWeight: '400',
      cursor: 'pointer',
      flex: '0 0 85px'
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
    scrim.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      loadDraftFromSaved();
      closeSoundSettings();
    });

    var panel = document.createElement('div');
    panel.className = 'vk-sheet__panel';
    setStyles(panel, {
      boxSizing: 'border-box',
      height: 'calc(394px + env(safe-area-inset-bottom, 0px))',
      minHeight: 'calc(394px + env(safe-area-inset-bottom, 0px))',
      maxHeight: 'calc(100vh - 16px)',
      overflow: 'hidden',
      padding: '0 0 env(safe-area-inset-bottom, 0px)',
      border: '0',
      borderRadius: '24px 24px 0 0',
      background: 'rgba(36,50,70,0.35)',
      fontFamily: "Inter, Roboto, system-ui, -apple-system, sans-serif"
    });

    var title = document.createElement('div');
    title.id = 'soundSettingsTitle';
    title.textContent = 'SONIDOS';
    setStyles(title, {
      position: 'absolute',
      top: '5px',
      left: '24px',
      right: '24px',
      height: '20px',
      textAlign: 'center',
      fontSize: '14px',
      lineHeight: '20px',
      fontWeight: '500',
      color: '#a7b6c9'
    });

    var subtitle = document.createElement('div');
    subtitle.textContent = 'Respuesta sonora de Vaultkey';
    setStyles(subtitle, {
      position: 'absolute',
      top: '39px',
      left: '32px',
      fontSize: '12px',
      lineHeight: '15px',
      fontWeight: '500',
      color: '#a7b6c9',
      whiteSpace: 'nowrap'
    });

    var toggleCard = document.createElement('div');
    setStyles(toggleCard, {
      boxSizing: 'border-box',
      position: 'absolute',
      top: '59px',
      left: '24px',
      right: '24px',
      height: '40px',
      display: 'flex',
      alignItems: 'center',
      padding: '0 24px',
      border: '1px solid rgba(58,74,96,0.6)',
      borderRadius: '12px',
      background: '#243246'
    });

    var toggleText = document.createElement('span');
    toggleText.textContent = 'Activar sonidos';
    setStyles(toggleText, {
      fontSize: '16px',
      lineHeight: '20px',
      fontWeight: '400',
      color: '#ffffff'
    });
    toggleCard.appendChild(toggleText);
    toggleCard.appendChild(makeToggle());

    var profiles = document.createElement('div');
    profiles.id = 'soundProfileCard';
    setStyles(profiles, {
      boxSizing: 'border-box',
      position: 'absolute',
      top: '115px',
      left: '24px',
      right: '24px',
      height: '128px',
      overflow: 'hidden',
      border: '1px solid rgba(58,74,96,0.6)',
      borderRadius: '12px',
      background: '#243246'
    });
    profiles.appendChild(makeProfileRow('suave', 'Suave', 'suave', false));
    profiles.appendChild(makeProfileRow('minimo', 'Minimal', 'minimo', false));
    profiles.appendChild(makeProfileRow('cristal', 'Cristal', 'cristal', true));

    var preview = document.createElement('button');
    preview.id = 'soundPreviewButton';
    preview.type = 'button';
    setStyles(preview, {
      boxSizing: 'border-box',
      position: 'absolute',
      top: '253px',
      left: '24px',
      right: '24px',
      height: '40px',
      display: 'flex',
      alignItems: 'center',
      padding: '0 15px',
      gap: '29px',
      border: '1px solid rgba(58,74,96,0.6)',
      borderRadius: '12px',
      background: '#243246',
      color: '#ffffff',
      cursor: 'pointer',
      font: 'inherit'
    });
    preview.appendChild(makeAssetIcon('play'));
    var previewText = document.createElement('span');
    previewText.textContent = 'Probar sonido';
    setStyles(previewText, {
      fontSize: '16px',
      lineHeight: '20px',
      fontWeight: '600',
      color: '#ffffff'
    });
    preview.appendChild(previewText);
    preview.addEventListener('click', function () {
      if (!draftEnabled) return;
      playIdentity(draftStyle, 'copy', true);
    });

    var actions = document.createElement('div');
    setStyles(actions, {
      position: 'absolute',
      top: '317px',
      left: '0',
      right: '0',
      height: '43px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '65px'
    });

    var cancel = makeActionButton('Cancelar', false);
    cancel.addEventListener('click', function () {
      loadDraftFromSaved();
      closeSoundSettings();
    });

    var save = makeActionButton('Guardar', true);
    save.addEventListener('click', function () {
      localStorage.setItem(SOUND_KEY, draftEnabled ? '1' : '0');
      localStorage.setItem(STYLE_KEY, draftStyle);
      updateSoundCardStatus();
      closeSoundSettings();
      if (typeof window.toast === 'function') window.toast('Cambios guardados');
    });

    actions.appendChild(cancel);
    actions.appendChild(save);
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
    if (input) {
      input.checked = draftEnabled;
      var knob = input.parentElement && input.parentElement.querySelector('.vk-sound-toggle-knob');
      if (knob) knob.style.transform = draftEnabled ? 'translateX(18px)' : 'translateX(0)';
      if (input.parentElement) input.parentElement.style.background = draftEnabled ? '#3b82f6' : '#334155';
    }

    var profiles = document.getElementById('soundProfileCard');
    if (profiles) {
      profiles.style.opacity = '1';
      profiles.style.pointerEvents = draftEnabled ? 'auto' : 'none';
    }

    var preview = document.getElementById('soundPreviewButton');
    if (preview) {
      preview.disabled = !draftEnabled;
      preview.style.opacity = '1';
    }

    var rows = document.querySelectorAll('#soundProfileCard [data-sound-style]');
    for (var i = 0; i < rows.length; i++) {
      var active = rows[i].getAttribute('data-sound-style') === draftStyle;
      rows[i].setAttribute('aria-pressed', active ? 'true' : 'false');
      var dot = rows[i].querySelector('.vk-sound-radio__dot');
      if (dot) dot.style.opacity = active ? '1' : '0';
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
    gain.gain.linearRampToValueAtTime(tone.vol || 0.054, now + attack);
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
    if (typeof window.playStyle !== 'function' || window.playStyle.__vkA11R013) return;
    var originalPlayStyle = window.playStyle;
    var wrapped = function (action) {
      var style = localStorage.getItem(STYLE_KEY) || 'suave';
      if (ALLOWED_STYLES.indexOf(style) === -1) return originalPlayStyle.apply(this, arguments);
      playIdentity(style, action, false);
    };
    wrapped.__vkA11R013 = true;
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
      if (suppressNestedLockSound || document.hidden) return;
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

  function installHealthPanelSound() {
    if (typeof window.showHealthPanel !== 'function' || window.showHealthPanel.__vkSoundOpen) return;
    var originalShowHealthPanel = window.showHealthPanel;
    var wrapped = function () {
      if (typeof window.soundOpen === 'function') window.soundOpen();
      return originalShowHealthPanel.apply(this, arguments);
    };
    wrapped.__vkSoundOpen = true;
    window.showHealthPanel = wrapped;
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
    installHealthPanelSound();
    updateSoundCardStatus();
  }

  window.openSoundSettings = openSoundSettings;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();