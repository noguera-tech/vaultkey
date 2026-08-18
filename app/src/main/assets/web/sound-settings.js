/* ============================================================
   VaultKey · A11-R01 — Ajustes de Sonidos
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

  function makeProfileRow(styleId, label) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'vk-row';
    button.setAttribute('data-sound-style', styleId);
    button.setAttribute('aria-pressed', 'false');
    setStyles(button, {
      minHeight: '41px',
      padding: '8px 16px',
      cursor: 'pointer'
    });

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
      localStorage.setItem(STYLE_KEY, styleId);
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
      padding: '8px 24px 24px',
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
      fontWeight: '500',
      color: 'var(--vk-text-muted)'
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
      localStorage.setItem(SOUND_KEY, input.checked ? '1' : '0');
      updateSoundCardStatus();
      syncSheet();
    });

    var profiles = document.createElement('div');
    profiles.id = 'soundProfileCard';
    profiles.className = 'vk-card';
    setStyles(profiles, { marginTop: '16px' });
    profiles.appendChild(makeProfileRow('suave', 'Suave'));
    profiles.appendChild(makeProfileRow('minimo', 'Minimal'));
    profiles.appendChild(makeProfileRow('cristal', 'Cristal'));

    var preview = document.createElement('button');
    preview.id = 'soundPreviewButton';
    preview.type = 'button';
    preview.className = 'vk-row vk-card';
    setStyles(preview, {
      marginTop: '10px',
      minHeight: '40px',
      padding: '7px 16px',
      cursor: 'pointer',
      justifyContent: 'center'
    });
    var previewText = document.createElement('strong');
    previewText.className = 'vk-row__title';
    previewText.textContent = 'Probar sonido';
    preview.appendChild(previewText);
    preview.addEventListener('click', function () {
      if (!soundIsEnabled()) {
        if (typeof window.toast === 'function') window.toast('Activa los sonidos para probarlos');
        return;
      }
      if (typeof window.soundCopy === 'function') window.soundCopy();
    });

    var actions = document.createElement('div');
    actions.className = 'vk-actions';
    setStyles(actions, { justifyContent: 'center', marginTop: '26px' });
    var cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'vk-btn vk-btn--secondary';
    cancel.setAttribute('data-vk-close', '');
    cancel.textContent = 'Cancelar';
    setStyles(cancel, { flex: '0 0 174px', minHeight: '48px', borderRadius: '16px' });
    actions.appendChild(cancel);

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
    var enabled = soundIsEnabled();
    var input = document.getElementById('soundSettingsToggle');
    if (input) input.checked = enabled;

    var profiles = document.getElementById('soundProfileCard');
    if (profiles) {
      profiles.style.opacity = enabled ? '1' : '0.55';
      profiles.style.pointerEvents = enabled ? 'auto' : 'none';
    }

    var preview = document.getElementById('soundPreviewButton');
    if (preview) {
      preview.disabled = !enabled;
      preview.style.opacity = enabled ? '1' : '0.55';
    }

    var selected = normalizedStyle();
    var rows = document.querySelectorAll('#soundProfileCard [data-sound-style]');
    for (var i = 0; i < rows.length; i++) {
      var active = rows[i].getAttribute('data-sound-style') === selected;
      rows[i].setAttribute('aria-pressed', active ? 'true' : 'false');
      var radio = rows[i].lastElementChild;
      if (radio) {
        radio.textContent = active ? '●' : '○';
        radio.style.color = active ? 'var(--vk-primary)' : 'var(--vk-text-muted)';
      }
    }
  }

  function openSoundSettings() {
    buildSheet();
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
    if (!card) return;
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

  function installCopySoundDeduplication() {
    if (typeof window.soundCopy !== 'function' || window.soundCopy.__vkDeduped) return;
    var original = window.soundCopy;
    var lastPlayed = 0;
    var wrapped = function () {
      var now = (window.performance && typeof window.performance.now === 'function')
        ? window.performance.now()
        : Date.now();
      if (now - lastPlayed < 140) return;
      lastPlayed = now;
      return original.apply(this, arguments);
    };
    wrapped.__vkDeduped = true;
    window.soundCopy = wrapped;
  }

  function init() {
    normalizedStyle();
    buildSheet();
    installSoundCard();
    installCopySoundDeduplication();
    updateSoundCardStatus();
  }

  window.openSoundSettings = openSoundSettings;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
