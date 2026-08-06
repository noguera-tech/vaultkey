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

let driveTokenClient = null;
let driveUiState = 'disconnected';
let driveNetworkListenersBound = false;

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

// ---------- Token (persistente, con expiración) ----------
function driveReadToken() {
  try {
    const raw = localStorage.getItem(DRIVE_TOKEN_KEY);
    if (!raw) return null;

    // Compatibilidad con una posible versión antigua que guardase solo el string.
    if (raw.charAt(0) !== '{') {
      return { access_token: raw, expires_at: 0 };
    }

    const token = JSON.parse(raw);
    if (!token || typeof token.access_token !== 'string') return null;
    return token;
  } catch (error) {
    console.warn('Drive: token local inválido', error);
    return null;
  }
}

function driveGetValidAccessToken() {
  const token = driveReadToken();
  if (!token) return null;

  if (token.expires_at && Date.now() >= token.expires_at - DRIVE_TOKEN_SAFETY_MS) {
    localStorage.removeItem(DRIVE_TOKEN_KEY);
    return null;
  }

  return token.access_token;
}

function driveSaveToken(response) {
  const expiresInSeconds = Number(response.expires_in || 3600);
  const token = {
    access_token: response.access_token,
    token_type: response.token_type || 'Bearer',
    scope: response.scope || DRIVE_SCOPE,
    expires_at: Date.now() + expiresInSeconds * 1000
  };
  localStorage.setItem(DRIVE_TOKEN_KEY, JSON.stringify(token));
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
  return `VaultKey_Backup_${dd}${mm}${yyyy}.vkbak`;
}

function driveToast(message, sound) {
  if (typeof toast === 'function') toast(message, sound);
}

async function driveShowError(title, error) {
  const message = error && error.message ? error.message : String(error || 'Error desconocido');
  console.error(`Drive: ${title}`, error);
  driveToast(`❌ ${title}: ${message}`, 'err');

  if (typeof vkConfirm === 'function') {
    try {
      await vkConfirm(title, message, { okText: 'Entendido', cancelText: null });
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

    driveTokenClient.requestAccessToken({ prompt: 'consent' });
  });
}

async function driveConnect() {
  driveBeginOAuthGuard();
  driveSetUiState('syncing');
  let retry = false;

  try {
    await driveWaitForGoogleIdentity();
    const response = await driveRequestToken();
    driveSaveToken(response);
    driveToast('✅ Conectado a Drive', 'ok');
    console.info('Drive connected');

    // Primer respaldo automático tras conectar (silencioso; si falla no bloquea la conexión)
    const synced = await driveSyncNow(true);
    driveSyncUI();
    if (!synced) driveToast('Drive conectado, pero no se pudo crear la copia inicial', 'err');
    return true;
  } catch (error) {
    localStorage.removeItem(DRIVE_TOKEN_KEY);
    driveSyncUI();
    console.error('Drive: No se pudo conectar con Google Drive', error);

    if (typeof vkConfirm === 'function') {
      retry = await vkConfirm(
        'No se pudo conectar con Google Drive',
        'No hemos podido establecer la conexi?n.\n\nComprueba tu conexi?n a Internet e int?ntalo de nuevo.',
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

// Valida la forma mínima del vk2_blob antes de subirlo — mismas condiciones
// esenciales que ya usa exportBackup() en app.js (no se reutiliza esa función
// para mantener drive.js aislado, solo se replica la comprobación).
function driveIsValidVk2Blob(blob) {
  return Boolean(
    blob && typeof blob === 'object' && !Array.isArray(blob)
    && blob.app === 'VaultKey'
    && Number(blob.schemaVersion) === 2
    && typeof blob.cryptoVersion === 'number'
    && blob.kdf && typeof blob.kdf === 'object'
    && blob.wraps && typeof blob.wraps === 'object'
    && blob.wraps.master
    && blob.wraps.kit
    && blob.vault && typeof blob.vault === 'object'
  );
}

// Lee la bóveda cifrada actual, sea cual sea el sistema de guardado activo:
// VaultKey 2.0 usa vkStore (localStorage 'vk2_blob'); el legacy usa 'vk_data_v1'.
// Para vk2_blob valida su estructura y adjunta los adjuntos cifrados
// (vkAttachments.exportAll()) antes de que el backup se suba a Drive.
async function driveReadVaultPayload() {
  if (typeof window.vkStore !== 'undefined' && window.vkStore.hasVault()) {
    const blob = window.vkStore.loadBlob();
    if (!driveIsValidVk2Blob(blob)) {
      throw new Error('La bóveda VaultKey 2.0 no tiene un formato válido');
    }
    if (typeof window.vkAttachments === 'undefined' || typeof window.vkAttachments.exportAll !== 'function') {
      throw new Error('vkAttachments.exportAll no está disponible');
    }
    const attachments = await window.vkAttachments.exportAll();
    return { format: 'vk2_blob', data: blob, attachments: attachments };
  }
  const legacy = localStorage.getItem('vk_data_v1');
  if (legacy) return { format: 'legacy', data: legacy };
  return null;
}

async function driveUploadBackup(accessToken, fileName, payload) {
  const timestamp = Date.now();
  const backup = JSON.stringify(payload.format === 'vk2_blob' ? {
    app: 'VaultKey',
    format: 'vkbak',
    version: 3,
    vaultFormat: 'vk2_blob',
    createdAt: new Date(timestamp).toISOString(),
    vk2_blob: payload.data,
    attachments: payload.attachments
  } : {
    app: 'VaultKey',
    format: 'vkbak',
    version: 2,
    vaultFormat: payload.format,
    createdAt: new Date(timestamp).toISOString(),
    vk_data_v1: payload.format === 'legacy' ? payload.data : undefined,
    vk2_blob: payload.format === 'vk2_blob' ? payload.data : undefined
  });

  const existing = await driveFindBackup(accessToken, fileName);
  const metadata = { name: fileName, mimeType: 'application/octet-stream' };
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', new Blob([backup], { type: 'application/octet-stream' }), fileName);

  const endpoint = existing
    ? `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(existing.id)}?uploadType=multipart&fields=id,name,modifiedTime`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime';

  return driveFetchJson(endpoint, {
    method: existing ? 'PATCH' : 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form
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
    return true;
  } catch (error) {
    if (error && error.status === 401) {
      localStorage.removeItem(DRIVE_TOKEN_KEY);
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

async function driveRestore() {
  const accessToken = driveGetValidAccessToken();
  if (!accessToken) { driveToast('❌ Primero conecta Google Drive', 'err'); return false; }

  driveSetUiState('syncing');
  try {
    const file = await driveFindLatestBackup(accessToken);
    if (!file) {
      driveSyncUI();
      driveToast('No se encontró ningún respaldo en Drive', 'err');
      return false;
    }

    const ok = await vkConfirm(
      'Restaurar copia',
      'Esta acción reemplazará los datos actuales de este dispositivo por la copia seleccionada.',
      { variant: 'drive-restore', confirmText: 'Restaurar' }
    );
    if (!ok) { driveSyncUI(); return false; }

    const download = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?alt=media`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!download.ok) throw new Error(`No se pudo descargar el respaldo (HTTP ${download.status})`);

    const raw = await download.json();
    const currentVk2 = localStorage.getItem('vk2_blob');
    const currentLegacy = localStorage.getItem('vk_data_v1');
    let restoredKey = null;

    try {
      if (raw && raw.app === 'VaultKey' && raw.format === 'vkbak' && Number(raw.version) >= 2 && raw.vaultFormat === 'vk2_blob') {
        const blob = raw.vk2_blob;
        const validBlob = blob && typeof blob === 'object' && !Array.isArray(blob)
          && blob.app === 'VaultKey' && Number(blob.schemaVersion) === 2
          && typeof blob.cryptoVersion === 'number'
          && blob.kdf && typeof blob.kdf === 'object'
          && blob.wraps && typeof blob.wraps === 'object'
          && blob.wraps.master && blob.wraps.kit
          && blob.vault && typeof blob.vault === 'object';
        if (!validBlob) throw new Error('La copia está dañada o no pertenece a VaultKey 2.0');

        if (raw.attachments) {
          if (typeof window.vkAttachments === 'undefined' || typeof window.vkAttachments.importAll !== 'function') {
            throw new Error('vkAttachments.importAll no está disponible');
          }
          await window.vkAttachments.importAll(raw.attachments, { mode: 'replace' });
        } else {
          const confirmedOldCopy = await vkConfirm(
            'Copia antigua sin adjuntos',
            'Esta copia es de una versión anterior y no incluye los archivos adjuntos de los documentos. Se restaurarán los datos disponibles, pero algunas imágenes o archivos podrían no recuperarse.',
            { variant: 'drive-restore-legacy-attachments', confirmText: 'Continuar' }
          );
          if (!confirmedOldCopy) { driveSyncUI(); return false; }
        }

        if (typeof window.vkStore !== 'undefined') window.vkStore.saveBlob(blob);
        else localStorage.setItem('vk2_blob', JSON.stringify(blob));
        restoredKey = 'vk2_blob';
      } else if (raw && raw.app === 'VaultKey' && typeof raw.vk_data_v1 === 'string' && raw.vk_data_v1.length > 20) {
        localStorage.setItem('vk_data_v1', raw.vk_data_v1);
        restoredKey = 'vk_data_v1';
      } else {
        throw new Error('La copia no tiene un formato válido de VaultKey');
      }

      if (!localStorage.getItem(restoredKey)) throw new Error('No se pudo guardar la copia restaurada');
    } catch (restoreError) {
      if (currentVk2 === null) localStorage.removeItem('vk2_blob');
      else localStorage.setItem('vk2_blob', currentVk2);
      if (currentLegacy === null) localStorage.removeItem('vk_data_v1');
      else localStorage.setItem('vk_data_v1', currentLegacy);
      throw restoreError;
    }

    driveSyncUI();
    driveToast('✅ Respaldo restaurado. Vuelve a desbloquear con tu PIN.', 'ok');
    console.info('Drive restore OK', file.name);

    if (typeof lock === 'function') lock();
    return true;
  } catch (error) {
    driveSyncUI();
    await driveShowError('No se pudo restaurar el respaldo', error);
    return false;
  }
}

// ---------- Desconectar ----------
function driveRevokeToken(accessToken) {
  return new Promise((resolve) => {
    if (!accessToken || !window.google || !google.accounts || !google.accounts.oauth2) {
      resolve(false);
      return;
    }

    google.accounts.oauth2.revoke(accessToken, () => resolve(true));
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
    await driveRevokeToken(accessToken && accessToken.access_token);

    localStorage.removeItem(DRIVE_TOKEN_KEY);
    driveSyncUI();
    driveToast('✅ Desconectado de Drive', 'ok');
    console.info('Drive disconnected');
    return true;
  } catch (error) {
    localStorage.removeItem(DRIVE_TOKEN_KEY);
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
