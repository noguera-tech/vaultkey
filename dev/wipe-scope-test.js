'use strict';

/* Regresion de alcance para el borrado manual. Ejecutar con Node desde la
   raiz del repositorio: node dev/wipe-scope-test.js */
const fs = require('fs');
const path = require('path');

const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '..', 'app.html'), 'utf8');
const unlock = fs.readFileSync(path.join(__dirname, '..', 'unlock.js'), 'utf8');

function section(start, end) {
  const from = app.indexOf(start);
  const to = app.indexOf(end, from + start.length);
  if (from < 0 || to < 0) throw new Error(`No se pudo aislar ${start}`);
  return app.slice(from, to);
}

const removalSection = section('function wipeFragmentedLocalStores()', 'function wipeCheckRemaining()');
const verificationSection = section('function wipeCheckRemaining()', 'async function wipe(options)');

const requiredLocalKeys = [
  'vk2_blob', 'vk2_pinwrap', 'vk2_meta',
  'vk_pin_change_backup',
  'vk_drive_token', 'vk_drive_last_sync', 'vk_local_backup_last',
  'vk_recovery_pending', 'vk_recovery_saved',
  'vaultkey_notes', 'vaultkey_cards', 'vaultkey_documents'
];

for (const key of requiredLocalKeys) {
  const literal = `'${key}'`;
  if (!verificationSection.includes(literal)) {
    throw new Error(`La verificacion final no incluye: ${key}`);
  }
}

for (const key of requiredLocalKeys.slice(3)) {
  if (!removalSection.includes(`'${key}'`)) {
    throw new Error(`El borrado auxiliar no incluye: ${key}`);
  }
}

if (!app.includes('results.vk2Store={ok:pepperDeleted')) {
  throw new Error('El fallo al borrar el pepper no bloquea el exito del wipe');
}
if (!app.includes("typeof vkStore.wipeLocal==='function'")) {
  throw new Error('wipeLocal debe ejecutarse incluso sin blob VK2 visible');
}
if (!app.includes('wipe({skipConfirm:true,deferNavigation:true})')) {
  throw new Error('La ruta legacy no reutiliza el borrado completo sin confirmacion');
}
for (const key of requiredLocalKeys.slice(3)) {
  if (!unlock.includes(`'${key}'`)) {
    throw new Error(`El auto-wipe VK2 no incluye: ${key}`);
  }
}
if (!unlock.includes('wipeResults.vk2Store = { ok: pepperDeleted')) {
  throw new Error('El auto-wipe VK2 acepta un fallo al borrar el pepper');
}
if (!html.includes('Borrar bóveda local') ||
    !html.includes('Las copias de Drive y los archivos descargados se conservarán')) {
  throw new Error('La interfaz no explica correctamente el alcance del borrado');
}

console.log('OK: alcance del borrado manual y automático verificado');
