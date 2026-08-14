'use strict';

// ============================================================
// GOOGLE DRIVE — PHASE 1 (versión híbrida: OAuth robusto + UI rica)
// OAuth2 + respaldo cifrado (vk2_blob si existe, vk_data_v1 como legacy)
// ============================================================

const DRIVE_CLIENT_ID = '299016319331-5it6s2gdts517jnehshfc1hkfpjgd4ku.apps.googleusercontent.com';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const DRIVE_TOKEN_KEY = 'vk_drive_token';
const DRIVE_LAST_SYNC_KEY = 'vk_drive_last_sync';
const DRIVE_AUTO_KEY = 'vk_drive_auto';
const DRIVE_TOKEN_SAFETY_MS = 60 * 1000;
const DRIVE_KEEP_BACKUPS = 10;

let driveTokenClient = null;
let driveAccessToken = null;
let driveUiState = 'disconnected';
let driveNetworkListenersBound = false;
let driveNativeAuthorizationResolver = null;
let driveNativeDisconnectResolver = null;

function driveUsesNativeAuthorization() {
  return /VaultKeyWebViewPrototype\//.test(navigator.userAgent || '');
}

window.vkNativeDriveAuthorizationResult = function (response) {
  if (!driveNativeAuthorizationResolver) return;
  const resolver = driveNativeAuthorizationResolver;
  driveNativeAuthorizationResolver = null;
  if (response && response.access_token) resolver.resolve(response);
  else resolver.reject(new Error((response && response.error) || 'La autorización de Google fue cancelada.'));
};

window.vkNativeDriveDisconnectResult = function (response) {
  if (!driveNativeDisconnectResolver) return;
  const resolver = driveNativeDisconnectResolver;
  driveNativeDisconnectResolver = null;
  if (response && response.ok === true) resolver.resolve(response);
  else resolver.reject(new Error((response && response.error) || 'Google no confirmó la revocación'));
};

function driveRequestNativeDisconnect() {
  return new Promise((resolve, reject) => {
    if (driveNativeDisconnectResolver) {
      reject(new Error('Ya hay una desconexión de Drive en curso'));
      return;
    }
    driveNativeDisconnectResolver = { resolve, reject };
    window.location.href = 'https://appassets.androidplatform.net/native/drive/disconnect';
  });
}

// ---------- Estado visual (conectando/sincronizando/conectado/offline) ----------
function driveSetUiState(state) {
  driveUiState = state;
  if (typeof window.syncDriveSettingsUI === 'function') window.syncDriveSettingsUI(state);
}
window.driveGetUiState = function () { return driveUiState; };

// ---------- OAuth guards — evita que el auto-bloqueo salte durante el login ----------
function driveBeginOAuthGuard() {
  window._vkGoogleOAuthOpen = true;
  window._vkGoogleOAuthGraceUntil = Date.now() + 120000;
}

function driveEndOAuthGuard() {
  window._vkGoogleOAuthOpen = false;
  window._vkGoogleOAuthGraceUntil = Date.now() + 1500;
}

// ---------- Token (solo en memoria, con expiración) ----------
function driveClearToken() {
  driveAccessToken = null;
  // Limpieza de compatibilidad: versiones anteriores persistían el bearer.
  try { localStorage.removeItem(DRIVE_TOKEN_KEY); } catch (_) { /* mejor esfuerzo */ }
}

function driveReadToken() {
  return driveAccessToken;
}

function driveGetValidAccessToken() {
  const token = driveReadToken();
  if (!token) return null;

  if (token.expires_at && Date.now() >= token.expires_at - DRIVE_TOKEN_SAFETY_MS) {
    driveClearToken();
    return null;
  }

  return token.access_token;
}

function driveSaveToken(response) {
  if (!response || typeof response.access_token !== 'string' || !response.access_token.trim()) {
    throw new Error('Google no devolvió un token de acceso válido.');
  }
  const expiresInSeconds = Number(response.expires_in);
  if (!Number.isFinite(expiresInSeconds) || expiresInSeconds <= 0) {
    throw new Error('Google no devolvió una caducidad válida para el token.');
  }
  const grantedScopes = String(response.scope || '').split(/\s+/).filter(Boolean);
  const scopeGranted = grantedScopes.includes(DRIVE_SCOPE) ||
    Boolean(window.google && google.accounts && google.accounts.oauth2 &&
      typeof google.accounts.oauth2.hasGrantedAllScopes === 'function' &&
      google.accounts.oauth2.hasGrantedAllScopes(response, DRIVE_SCOPE));
  if (!scopeGranted) {
    throw new Error('No se concedió el permiso necesario para Google Drive.');
  }
  driveAccessToken = {
    access_token: response.access_token,
    token_type: response.token_type || 'Bearer',
    scope: grantedScopes.join(' '),
    expires_at: Date.now() + expiresInSeconds * 1000
  };
  // Nunca persistir el bearer: solo vive en memoria durante esta carga.
  try { localStorage.removeItem(DRIVE_TOKEN_KEY); } catch (_) { /* compatibilidad */ }
  return driveAccessToken;
}

// ---------- Utilidades ----------
function driveFormatDate(timestamp, withTime) {
  const value = Number(timestamp);
  if (!value) return 'Nunca';
  return new Intl.DateTimeFormat('es-ES', withTime ? {
    dateStyle: 'short',
    timeStyle: 'short'
  } : {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(new Date(value));
}

function driveBackupFileName(timestamp) {
  const date = new Date(timestamp);
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  const random = new Uint8Array(4);
  crypto.getRandomValues(random);
  const suffix = Array.from(random, value => value.toString(16).padStart(2, '0')).join('');
  return `VaultKey_Backup_${dd}${mm}${yyyy}_${hh}${min}${ss}_${suffix}.vkbak`;
}

function driveToast(message, sound) {
  if (typeof toast === 'function') toast(message, sound);
}

async function driveShowError(title, error, options = {}) {
  const message = error && error.message ? error.message : String(error || 'Error desconocido');
  console.error(`Drive: ${title}`, error);
  driveToast(`❌ ${title}: ${message}`, 'err');

  if (typeof vkConfirm === 'function') {
    try {
      await vkConfirm(title, message, options);
    } catch (_) {
      // El toast ya informa del error; el diálogo es un apoyo visual.
    }
  }
}

// ---------- UI legacy (pantalla simple, se mantiene por compatibilidad) ----------
function driveSyncUI() {
  const connected = Boolean(driveGetValidAccessToken());
  const status = document.getElementById('driveConnectionStatus');
  const lastSync = document.getElementById('driveLastSync');
  const connectButton = document.getElementById('driveConnectButton');
  const syncButton = document.getElementById('driveSyncButton');
  const disconnectButton = document.getElementById('driveDisconnectButton');

  if (status) {
    status.textContent = connected ? 'Conectado a Drive' : 'Desconectado de Drive';
    status.dataset.connected = connected ? 'true' : 'false';
  }

  if (lastSync) {
    const timestamp = localStorage.getItem(DRIVE_LAST_SYNC_KEY);
    lastSync.textContent = timestamp ? `Última sincronización: ${driveFormatDate(timestamp, true)}` : 'Última sincronización: nunca';
  }

  if (connectButton) connectButton.hidden = connected;
  if (syncButton) syncButton.disabled = !connected;
  if (disconnectButton) disconnectButton.hidden = !connected;

  // Refleja también en la UI rica (Figma) si está montada.
  driveSetUiState(connected ? (navigator.onLine === false ? 'offline' : 'connected') : 'disconnected');
}

function driveInit() {
  // Puede llamarse varias veces al abrir Ajustes: limpiar solo el formato
  // persistido antiguo, sin desconectar el token válido de esta sesión.
  try { localStorage.removeItem(DRIVE_TOKEN_KEY); } catch (_) { /* mejor esfuerzo */ }
  if (!driveNetworkListenersBound) {
    window.addEventListener('online', driveSyncUI);
    window.addEventListener('offline', driveSyncUI);
    driveNetworkListenersBound = true;
  }
  if (localStorage.getItem(DRIVE_AUTO_KEY) === null) {
    localStorage.setItem(DRIVE_AUTO_KEY, '1'); // Auto-sync activado por defecto
  }
  driveSyncUI();
}

// ---------- OAuth ----------
function driveWaitForGoogleIdentity(timeoutMs = 5000) {
  if (window.google && google.accounts && google.accounts.oauth2) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const started = Date.now();
    const timer = window.setInterval(() => {
      if (window.google && google.accounts && google.accounts.oauth2) {
        window.clearInterval(timer);
        resolve();
      } else if (Date.now() - started >= timeoutMs) {
        window.clearInterval(timer);
        reject(new Error('Google Identity Services no se ha cargado. Comprueba tu conexión.'));
      }
    }, 100);
  });
}

function driveRequestToken() {
  if (driveUsesNativeAuthorization()) {
    return new Promise((resolve, reject) => {
      if (driveNativeAuthorizationResolver) {
        reject(new Error('Ya hay una autorización de Google en curso.'));
        return;
      }
      driveNativeAuthorizationResolver = { resolve, reject };
      window.location.href = 'https://appassets.androidplatform.net/native/drive/connect';
    });
  }
  return new Promise((resolve, reject) => {
    driveTokenClient = google.accounts.oauth2.initTokenClient({
      client_id: DRIVE_CLIENT_ID,
      scope: DRIVE_SCOPE,
      callback: (response) => {
        if (response && response.access_token) {
          resolve(response);
          return;
        }
        const code = response && (response.error_description || response.error);
        reject(new Error(code || 'La autorización de Google fue cancelada.'));
      },
      error_callback: (response) => {
        const reason = response && (response.message || response.type);
        reject(new Error(reason || 'No se pudo abrir la autorización de Google.'));
      }
    });

    driveTokenClient.requestAccessToken();
  });
}

async function driveConnect() {
  driveBeginOAuthGuard();
  driveSetUiState('syncing');
  let retry = false;

  try {
    if (!driveUsesNativeAuthorization()) await driveWaitForGoogleIdentity();
    const response = await driveRequestToken();
    driveSaveToken(response);
    driveSyncUI();
    driveToast('✅ Google Drive conectado. No se ha creado ninguna copia automáticamente.', 'ok');
    console.info('Drive connected');
    return true;
  } catch (error) {
    driveClearToken();
    driveSyncUI();
    console.error('Drive: No se pudo conectar con Google Drive', error);

    if (typeof vkConfirm === 'function') {
      retry = await vkConfirm(
        'No se pudo conectar con Google Drive',
        'No hemos podido establecer la conexión.\n\nComprueba tu conexión a Internet e inténtalo de nuevo.',
        {
          variant: 'drive-connect-error',
          confirmText: 'Reintentar'
        }
      );
    }
  } finally {
    driveEndOAuthGuard();
  }

  if (retry) return driveConnect();
  return false;
}

// ---------- Drive API: buscar / subir / descargar ----------
async function driveFetchJson(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  let body = null;

  if (text) {
    try { body = JSON.parse(text); } catch (_) { body = text; }
  }

  if (!response.ok) {
    const apiMessage = body && body.error && body.error.message;
    const error = new Error(apiMessage || `Google Drive respondió ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return body;
}

async function driveFindBackup(accessToken, fileName) {
  const escapedName = fileName.replace(/'/g, "\\'");
  const query = encodeURIComponent(`name='${escapedName}' and trashed=false`);
  const fields = encodeURIComponent('files(id,name,modifiedTime)');
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&spaces=drive&fields=${fields}&pageSize=1`;

  const result = await driveFetchJson(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  return result && Array.isArray(result.files) ? result.files[0] || null : null;
}

async function driveFindLatestBackup(accessToken) {
  const query = encodeURIComponent("name contains 'VaultKey_Backup_' and trashed=false");
  const fields = encodeURIComponent('files(id,name,modifiedTime)');
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&spaces=drive&orderBy=modifiedTime desc&fields=${fields}&pageSize=1`;

  const result = await driveFetchJson(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  return result && Array.isArray(result.files) ? result.files[0] || null : null;
}

// Lista todas las copias de seguridad existentes en Drive, de más reciente a más antigua.
// Variante de driveFindLatestBackup con pageSize mayor — no modifica esa función.
async function driveListAllBackups(accessToken) {
  const query = encodeURIComponent("name contains 'VaultKey_Backup_' and trashed=false");
  const fields = encodeURIComponent('files(id,name,createdTime,modifiedTime,size,md5Checksum)');
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&spaces=drive&orderBy=modifiedTime desc&fields=${fields}&pageSize=100`;

  const result = await driveFetchJson(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  return result && Array.isArray(result.files)
    ? result.files.filter(file => typeof file.name === 'string' && file.name.endsWith('.vkbak'))
    : [];
}

// Mueve a la papelera de Drive las copias que sobran, manteniendo solo las
// `keep` más recientes. Nunca lanza: cada borrado se intenta por separado y
// un fallo aislado no interrumpe los siguientes ni afecta a la sincronización
// que ya se completó con éxito.
async function driveTrimOldBackups(accessToken, keep = DRIVE_KEEP_BACKUPS) {
  let files;
  try {
    files = await driveListAllBackups(accessToken);
  } catch (error) {
    console.warn('Drive: no se pudo listar copias para limpiar', error);
    return;
  }

  const toTrash = files.slice(keep);
  if (!toTrash.length) return;

  for (const file of toTrash) {
    try {
      await driveFetchJson(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ trashed: true })
      });
    } catch (error) {
      console.warn('Drive: no se pudo mover a la papelera una copia antigua', file.name, error);
    }
  }
}

// Lee la boveda cifrada actual, sea cual sea el sistema de guardado activo.
async function driveReadVaultPayload() {
  if (typeof window.vkStore !== 'undefined' && window.vkStore.hasVault()) {
    if (typeof window.vkBackup === 'undefined' || typeof window.vkBackup.validateBlob !== 'function') {
      throw new Error('vkBackup.validateBlob no esta disponible');
    }
    if (typeof window.vkAttachments === 'undefined' || typeof window.vkAttachments.exportAll !== 'function') {
      throw new Error('vkAttachments.exportAll no esta disponible');
    }

    const blob = window.vkStore.loadBlob();
    window.vkBackup.validateBlob(blob);
    const attachments = await window.vkAttachments.exportAll();

    return { format: 'vk2_blob', data: blob, attachments: attachments };
  }

  const legacy = localStorage.getItem('vk_data_v1');
  if (legacy) return { format: 'legacy', data: legacy };
  return null;
}

async function driveUploadBackup(accessToken, fileName, payload) {
  const timestamp = Date.now();
  const backupData = payload.format === 'vk2_blob'
    ? window.vkBackup.createEnvelope({
        blob: payload.data,
        attachments: payload.attachments,
        createdAt: new Date(timestamp).toISOString()
      })
    : {
        app: 'VaultKey',
        format: 'vkbak',
        version: 2,
        vaultFormat: payload.format,
        createdAt: new Date(timestamp).toISOString(),
        vk_data_v1: payload.format === 'legacy' ? payload.data : undefined
      };
  const backup = JSON.stringify(backupData);

  const metadata = { name: fileName, mimeType: 'application/octet-stream' };
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', new Blob([backup], { type: 'application/octet-stream' }), fileName);

  // Las copias son inmutables: cada subida crea un archivo nuevo. Nunca se
  // sobrescribe una copia anterior buscando por nombre.
  const endpoint = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,createdTime,modifiedTime,size,md5Checksum';

  return driveFetchJson(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form
  });
}

function driveFormatBackupSize(rawSize) {
  const size = Number(rawSize);
  if (!Number.isFinite(size) || size < 0) return 'Tamaño no disponible';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function driveChooseBackup(files) {
  return new Promise((resolve) => {
    const existing = document.getElementById('driveBackupPickerModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'driveBackupPickerModal';
    modal.className = 'modal open vk-drive-picker';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'driveBackupPickerTitle');

    const sheet = document.createElement('div');
    sheet.className = 'sheet vk-drive-picker__sheet';
    const title = document.createElement('h2');
    title.id = 'driveBackupPickerTitle';
    title.textContent = 'Elegir copia de seguridad';
    const subtitle = document.createElement('p');
    subtitle.className = 'vk-drive-picker__subtitle';
    subtitle.textContent = 'Selecciona la copia que quieres restaurar.';
    const list = document.createElement('div');
    list.className = 'vk-drive-picker__list';

    let settled = false;
    const close = (value) => {
      if (settled) return;
      settled = true;
      document.removeEventListener('keydown', onKeyDown);
      modal.remove();
      resolve(value);
    };
    const onKeyDown = (event) => { if (event.key === 'Escape') close(null); };

    files.forEach((file, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'vk-drive-picker__item';
      const date = document.createElement('strong');
      date.textContent = driveFormatDate(Date.parse(file.modifiedTime), true);
      const details = document.createElement('small');
      details.textContent = `${driveFormatBackupSize(file.size)} · ${file.name}`;
      button.append(date, details);
      button.addEventListener('click', () => close(file));
      list.appendChild(button);
      if (index === 0) setTimeout(() => button.focus(), 0);
    });

    const actions = document.createElement('div');
    actions.className = 'vk-drive-picker__actions';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'vk-drive-picker__cancel';
    cancel.textContent = 'Cancelar';
    cancel.addEventListener('click', () => close(null));

    actions.append(cancel);
    sheet.append(title, subtitle, list, actions);
    modal.appendChild(sheet);
    const appRoot = document.querySelector('.app');
    (appRoot || document.body).appendChild(modal);
    document.addEventListener('keydown', onKeyDown);
  });
}

async function driveSyncNow(silent = false) {
  const accessToken = driveGetValidAccessToken();
  if (!accessToken) {
    driveSyncUI();
    if (!silent) driveToast('❌ Conecta Google Drive antes de sincronizar', 'err');
    return false;
  }

  let payload;
  try {
    payload = await driveReadVaultPayload();
  } catch (error) {
    driveSyncUI();
    if (!silent) await driveShowError('No se pudo preparar el respaldo', error);
    else console.error('Drive auto-sync error', error);
    return false;
  }
  if (!payload) {
    if (!silent) driveToast('❌ No hay una bóveda cifrada para sincronizar', 'err');
    return false;
  }

  driveSetUiState('syncing');
  try {
    console.info('Sync started', payload.format);
    const timestamp = Date.now();
    const fileName = driveBackupFileName(timestamp);
    await driveUploadBackup(accessToken, fileName, payload);

    localStorage.setItem(DRIVE_LAST_SYNC_KEY, String(timestamp));
    driveSyncUI();

    if (!silent) {
      driveToast(`✅ Respaldo sincronizado ${driveFormatDate(timestamp, true)}`, 'ok');
    }
    console.info('VaultKey backup enviado', fileName);

    // Limpieza de copias antiguas — solo tras subida confirmada con éxito.
    // Un fallo aquí nunca afecta al resultado de la sincronización ya completada.
    try {
      await driveTrimOldBackups(accessToken);
    } catch (error) {
      console.warn('Drive: limpieza de copias antiguas no completada', error);
    }

    return true;
  } catch (error) {
    if (error && error.status === 401) {
      driveClearToken();
      driveSyncUI();
      const expiredError = new Error('Vuelve a conectar Google Drive para continuar.');
      if (!silent) await driveShowError('La sesión de Google Drive ha caducado', expiredError, { variant: 'drive-connect-error', confirmText: 'Entendido' });
      else console.error('Drive auto-sync token expired', error);
      return false;
    }
    driveSyncUI();

    if (!silent) await driveShowError('Error sync', error);
    else console.error('Drive auto-sync error', error);
    return false;
  }
}

// ---------- Restaurar copia desde Drive ----------
let _drivePinResolver = null;

function resolveDrivePin(value) {
  const modal = document.getElementById('drivePinModal');
  if (modal) modal.classList.remove('open');
  const input = document.getElementById('drivePinInput');
  if (input) input.value = '';
  if (_drivePinResolver) { _drivePinResolver(value); _drivePinResolver = null; }
}

function askDrivePin() {
  return new Promise((res) => {
    _drivePinResolver = res;
    const input = document.getElementById('drivePinInput');
    if (input) input.value = '';
    const modal = document.getElementById('drivePinModal');
    if (modal) {
      modal.classList.add('open');
      setTimeout(() => { if (input) input.focus(); }, 150);
    } else {
      const val = prompt('Introduce el PIN con el que se cifró este respaldo:');
      res(val);
    }
  });
}

async function driveRestore(allowAuthorizationRetry = true) {
  const accessToken = driveGetValidAccessToken();
  if (!accessToken) { driveToast('❌ Primero conecta Google Drive', 'err'); return false; }

  driveSetUiState('restoring');
  try {
    const files = await driveListAllBackups(accessToken);
    if (!files.length) {
      driveSyncUI();
      driveToast('No se encontró ningún respaldo en Drive', 'err');
      return false;
    }

    const file = await driveChooseBackup(files);
    if (!file) { driveSyncUI(); return false; }

    const ok = await vkConfirm(
      'Restaurar copia',
      `Esta acción reemplazará los datos actuales por la copia del ${driveFormatDate(Date.parse(file.modifiedTime), true)} (${driveFormatBackupSize(file.size)}).`,
      { variant: 'drive-restore', confirmText: 'Restaurar' }
    );
    if (!ok) { driveSyncUI(); return false; }

    const download = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?alt=media`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!download.ok) {
      const error = new Error(`No se pudo descargar el respaldo (HTTP ${download.status})`);
      error.status = download.status;
      throw error;
    }

    const raw = await download.json();

    if (raw && raw.app === 'VaultKey' && raw.format === 'vkbak' && Number(raw.version) >= 2 && raw.vaultFormat === 'vk2_blob') {
      if (typeof window.vkBackup === 'undefined' || typeof window.vkBackup.restore !== 'function') {
        throw new Error('vkBackup.restore no está disponible');
      }
      if (typeof window.vkStore === 'undefined' || typeof window.vkAttachments === 'undefined') {
        throw new Error('vkStore o vkAttachments no están disponibles');
      }

      let credential = null;
      const credentialText = await (typeof window.openRestoreCredentialModal === 'function'
        ? window.openRestoreCredentialModal({
            title: 'Restaurar copia',
            label: 'Contraseña maestra o kit',
            helper: 'Introduce tu contraseña maestra o kit de emergencia.',
            placeholder: 'Introduce tu contraseña maestra o kit...',
            confirmText: 'Restaurar',
            cancelText: 'Cancelar',
            onValidate: async (text) => {
              const cred = typeof window.normalizeRestoreCredentialInput === 'function'
                ? window.normalizeRestoreCredentialInput(text)
                : (/^VK2/i.test(String(text).trim())
                    ? { kitCode: String(text).trim() }
                    : { master: String(text).trim() });
              await window.vkCrypto.openVaultBlob(raw.vk2_blob, cred);
              credential = cred;
            }
          })
        : Promise.resolve(prompt('Introduce tu contraseña maestra o kit de emergencia:')));

      if (credentialText === null || credentialText === undefined) {
        driveSyncUI();
        return false;
      }

      if (!credential) {
        credential = typeof window.normalizeRestoreCredentialInput === 'function'
          ? window.normalizeRestoreCredentialInput(credentialText)
          : (/^VK2/i.test(String(credentialText).trim())
              ? { kitCode: String(credentialText).trim() }
              : { master: String(credentialText).trim() });
      }

      const pin = await (typeof window.openRestorePinModal === 'function'
        ? window.openRestorePinModal({
            title: 'PIN de restauración',
            label: 'PIN',
            helper: 'Debe tener 6 dígitos.',
            placeholder: 'Introduce 6 dígitos',
            confirmText: 'Restaurar',
            cancelText: 'Atrás'
          })
        : Promise.resolve(prompt('Introduce el PIN de 6 dígitos para este dispositivo:')));

      if (pin === null || pin === undefined) {
        driveSyncUI();
        return false;
      }

      await window.vkBackup.restore(raw, {
        credential,
        pin,
        store: window.vkStore,
        attachments: window.vkAttachments,
        crypto: window.vkCrypto
      });
    } else if (raw && raw.app === 'VaultKey' && typeof raw.vk_data_v1 === 'string' && raw.vk_data_v1.length > 20) {
      localStorage.setItem('vk_data_v1', raw.vk_data_v1);
    } else {
      throw new Error('La copia no tiene un formato válido de VaultKey');
    }

    driveSyncUI();
    driveToast('✅ Respaldo restaurado. Vuelve a desbloquear con tu PIN.', 'ok');
    console.info('Drive restore OK', file.name);

    if (typeof lock === 'function') lock();
    return true;
  } catch (error) {
    if (error && error.status === 401) {
      driveClearToken();
      driveSyncUI();
      if (allowAuthorizationRetry) {
        const reconnected = await driveConnect();
        if (reconnected) return driveRestore(false);
      }
      await driveShowError('La sesión de Google Drive ha caducado', new Error('Vuelve a conectar Google Drive para continuar.'), { variant: 'drive-connect-error', confirmText: 'Entendido' });
      return false;
    }
    driveSyncUI();
    console.error('Drive: No se pudo restaurar el respaldo', error);
    const message = (typeof window.vkBackup !== 'undefined' && typeof window.vkBackup.restoreErrorMessage === 'function')
      ? window.vkBackup.restoreErrorMessage(error)
      : null;
    const retry = await driveShowRestoreErrorModal(message);
    if (retry) return driveRestore();
    return false;
  }
}

let _driveRestoreErrorResolver = null;

function driveShowRestoreErrorModal(message) {
  return new Promise((resolve) => {
    _driveRestoreErrorResolver = resolve;
    const modal = document.getElementById('driveRestoreErrorModal');
    const cancelBtn = document.getElementById('driveRestoreErrorCancel');
    const retryBtn = document.getElementById('driveRestoreErrorRetry');
    const bodyEl = document.getElementById('driveRestoreErrorBody');
    if (!modal || !cancelBtn || !retryBtn) { resolve(false); return; }

    if (bodyEl && message) {
      bodyEl.textContent = message;
    }

    function close(result) {
      modal.classList.remove('open');
      cancelBtn.removeEventListener('click', onCancel);
      retryBtn.removeEventListener('click', onRetry);
      if (_driveRestoreErrorResolver) { _driveRestoreErrorResolver(result); _driveRestoreErrorResolver = null; }
    }
    function onCancel() { close(false); }
    function onRetry() { close(true); }

    cancelBtn.addEventListener('click', onCancel);
    retryBtn.addEventListener('click', onRetry);
    modal.classList.add('open');
  });
}

// ---------- Desconectar ----------
function driveRevokeToken(accessToken) {
  return new Promise((resolve) => {
    if (!accessToken || !window.google || !google.accounts || !google.accounts.oauth2) {
      resolve({ attempted: false, revoked: false, error: 'Google Identity Services no disponible' });
      return;
    }

    google.accounts.oauth2.revoke(accessToken, (response) => {
      const revoked = Boolean(response && (response.successful === true || response.error === 'invalid_token'));
      resolve({
        attempted: true,
        revoked,
        error: revoked ? null : ((response && (response.error_description || response.error)) || 'revocación no confirmada')
      });
    });
  });
}

async function driveDisconnect() {
  try {
    if (typeof vkConfirm === 'function') {
      const confirmed = await vkConfirm(
        '¿Desconectar Google Drive?',
        'Se detendrá la sincronización con Google Drive. Las copias guardadas en Drive no se eliminarán.',
        { variant: 'drive-disconnect', confirmText: 'Desconectar' }
      );
      if (!confirmed) return false;
    }

    const accessToken = driveReadToken();
    const revocation = driveUsesNativeAuthorization()
      ? (await driveRequestNativeDisconnect(), { attempted: true, revoked: true, error: null })
      : await driveRevokeToken(accessToken && accessToken.access_token);
    driveClearToken();
    driveSyncUI();
    if (revocation.revoked) {
      driveToast('✅ Desconectado de Drive y permiso revocado', 'ok');
      console.info('Drive disconnected and grant revoked');
      return true;
    }
    driveToast('⚠️ Desconectado en este dispositivo. Google no confirmó la revocación del permiso.', 'err');
    console.warn('Drive disconnected locally; grant revocation not confirmed', revocation.error);
    return false;
  } catch (error) {
    driveClearToken();
    driveSyncUI();
    await driveShowError('Drive se desconectó localmente, pero no se pudo revocar el token', error);
    return false;
  }
}

// ---------- Sync automática (al guardar/borrar entradas) ----------
async function driveAutoSync() {
  if (localStorage.getItem(DRIVE_AUTO_KEY) !== '1') return false;
  if (!driveGetValidAccessToken()) return false;
  return driveSyncNow(true);
}

window.driveInit = driveInit;
window.driveConnect = driveConnect;
window.driveSyncNow = driveSyncNow;
window.driveRestore = driveRestore;
window.driveDisconnect = driveDisconnect;
window.driveAutoSync = driveAutoSync;
