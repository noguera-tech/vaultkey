'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const start = source.indexOf('const VK_HAPTIC_PATTERNS=');
const end = source.indexOf('// ── SISTEMA DE SONIDOS', start);
if (start < 0 || end < 0) throw new Error('No se pudo aislar el modulo haptico');

const listeners = {};
const calls = [];
let disabled = false;
const context = {
  Date,
  Object,
  Array,
  String,
  clearTimeout,
  setTimeout,
  localStorage: { getItem: key => key === 'vk_vibe' && disabled ? '0' : null },
  navigator: { vibrate: value => { calls.push(value); return true; } },
  window: {},
  document: {
    addEventListener(type, handler) { listeners[type] = handler; }
  }
};

vm.runInNewContext(source.slice(start, end), context);

function waitThrottle() {
  vm.runInNewContext('_vkLastHapticAt=0', context);
}

function interactiveTarget(signature = {}) {
  return {
    id: signature.id || '',
    className: signature.className || '',
    textContent: signature.textContent || '',
    dataset: signature.dataset || {},
    disabled: false,
    getAttribute(name) {
      if (name === 'onclick') return signature.onclick || '';
      if (name === 'aria-disabled') return null;
      return null;
    }
  };
}

const button = interactiveTarget({ textContent: 'Guardar' });
listeners.click({ target: { closest: () => button } });
if (calls.length !== 1 || calls[0] !== 18) throw new Error('El clic global no vibra de forma inmediata');

waitThrottle();
const input = {
  dataset: {},
  disabled: false,
  matches: () => true,
  getAttribute: () => null
};
listeners.input({ target: input, inputType: 'insertText' });
if (calls.at(-1) !== 28) throw new Error('La escritura no usa el patron key');

waitThrottle();
listeners.input({ target: input, inputType: 'deleteContentBackward' });
if (calls.at(-1) !== 18) throw new Error('El borrado no usa el patron backspace');

waitThrottle();
disabled = true;
const before = calls.length;
listeners.click({ target: { closest: () => button } });
if (calls.length !== before) throw new Error('La preferencia de vibracion desactivada no se respeta');

console.log('OK: cobertura haptica global de pulsacion, escritura y borrado verificada');
