'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const values = new Map([['vk_drive_token', 'token-antiguo-sin-cifrar']]);
const localStorage = {
  getItem(key) { return values.has(key) ? values.get(key) : null; },
  setItem(key, value) { values.set(key, String(value)); },
  removeItem(key) { values.delete(key); }
};

let revokeResponse = { successful: true };
const context = {
  console,
  localStorage,
  navigator: { onLine: true },
  document: {
    getElementById() { return null; },
    querySelector() { return null; },
    addEventListener() {}
  },
  google: {
    accounts: {
      oauth2: {
        hasGrantedAllScopes(response, scope) {
          return String(response.scope || '').split(/\s+/).includes(scope);
        },
        revoke(_token, callback) { callback(revokeResponse); }
      }
    }
  },
  setInterval,
  clearInterval,
  setTimeout,
  clearTimeout
};
context.window = context;
context.window.addEventListener = function () {};
context.globalThis = context;

let source = fs.readFileSync(path.join(__dirname, '..', 'drive.js'), 'utf8');
source += `\n;globalThis.__driveTokenTest = {
  clear: driveClearToken,
  read: driveReadToken,
  valid: driveGetValidAccessToken,
  save: driveSaveToken,
  init: driveInit,
  revoke: driveRevokeToken,
  setRaw: function (value) { driveAccessToken = value; }
};`;
vm.runInNewContext(source, context, { filename: 'drive.js' });

(async function run() {
  const api = context.__driveTokenTest;

  api.init();
  assert.strictEqual(localStorage.getItem('vk_drive_token'), null, 'init debe eliminar tokens persistidos antiguos');
  assert.strictEqual(api.read(), null, 'init no debe importar el token antiguo a memoria');

  const saved = api.save({
    access_token: 'token-sesion',
    expires_in: 3600,
    token_type: 'Bearer',
    scope: 'https://www.googleapis.com/auth/drive.file'
  });
  assert.strictEqual(api.valid(), 'token-sesion', 'el token válido debe estar disponible en memoria');
  assert.ok(saved.expires_at > Date.now(), 'el token debe tener caducidad futura');
  assert.strictEqual(localStorage.getItem('vk_drive_token'), null, 'el bearer nunca debe persistirse');
  api.init();
  assert.strictEqual(api.valid(), 'token-sesion', 'reabrir Ajustes no debe desconectar el token en memoria');

  assert.throws(() => api.save({ access_token: 'x', expires_in: 0, scope: 'https://www.googleapis.com/auth/drive.file' }), /caducidad válida/);
  assert.throws(() => api.save({ access_token: 'x', expires_in: 3600, scope: 'profile' }), /permiso necesario/);

  api.setRaw({ access_token: 'caducado', expires_at: Date.now() - 1 });
  assert.strictEqual(api.valid(), null, 'un token caducado debe eliminarse');
  assert.strictEqual(api.read(), null, 'un token caducado no debe permanecer en memoria');

  revokeResponse = { successful: false, error: 'invalid_request' };
  const failedRevoke = await api.revoke('token-sesion');
  assert.strictEqual(failedRevoke.revoked, false, 'una revocación no confirmada no debe anunciar éxito');

  revokeResponse = { successful: false, error: 'invalid_token' };
  const expiredRevoke = await api.revoke('token-caducado');
  assert.strictEqual(expiredRevoke.revoked, true, 'Google considera invalid_token ya caducado o revocado');

  console.log('OK: ciclo de vida del token de Drive verificado');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
