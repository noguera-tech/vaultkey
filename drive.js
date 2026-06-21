

// ============================================================
// GOOGLE DRIVE SYNC — VaultKey
// ============================================================
const DRIVE_CLIENT_ID = '299016319331-5it6s2gdts517jnehshfc1hkfpjgd4ku.apps.googleusercontent.com';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const DRIVE_FILE_NAME = 'vaultkey-backup.json';
const LS_DRIVE_TOKEN = 'vk_drive_token'; // sesión únicamente
const LS_DRIVE_AUTO = 'vk_drive_auto';
const LS_DRIVE_LAST = 'vk_drive_last_sync';

let driveToken = null;

// Inicializar Drive al arrancar
function driveInit() {
  driveSyncUI(false);
  const sub = document.getElementById('driveStatusSub');
  if(sub) sub.textContent = '🔄 Reconecta Drive al abrir la app';
  // Auto sync por defecto activado
  const auto = localStorage.getItem(LS_DRIVE_AUTO);
  if(auto === null) localStorage.setItem(LS_DRIVE_AUTO, '1');
  const toggle = document.getElementById('driveAutoToggle');
  if(toggle) toggle.checked = localStorage.getItem(LS_DRIVE_AUTO) !== '0';
}

// Actualizar UI según estado conexión
function driveSyncUI(connected) {
  const rows = ['driveConnectRow','driveStatusRow','driveSyncRow','driveRestoreRow','driveAutoRow','driveDisconnectRow'];
  rows.forEach(id => {
    const el = document.getElementById(id);
    if(el) el.style.display = 'none';
  });
  if(!connected) {
    const r = document.getElementById('driveConnectRow');
    if(r) r.style.display = '';
  } else {
    ['driveStatusRow','driveSyncRow','driveRestoreRow','driveAutoRow','driveDisconnectRow'].forEach(id => {
      const el = document.getElementById(id);
      if(el) el.style.display = '';
    });
    // Update last sync time
    const last = localStorage.getItem(LS_DRIVE_LAST);
    const sub = document.getElementById('driveStatusSub');
    if(sub) sub.textContent = last ? 'Última sync: ' + new Date(parseInt(last)).toLocaleString('es-ES') : '🔄 Conecta Drive para sincronizar';
  }
}

// Conectar con Google
function driveConnect() {
  if(!window.google || !google.accounts) {
    // Esperar hasta 5 segundos a que cargue el script de Google
    let attempts = 0;
    const wait = setInterval(() => {
      attempts++;
      if(window.google && google.accounts) {
        clearInterval(wait);
        driveConnectNow();
      } else if(attempts > 10) {
        clearInterval(wait);
        toast('No se pudo conectar con Google. Comprueba tu conexión.');
      }
    }, 500);
    toast('Conectando con Google...');
    return;
  }
  driveConnectNow();
}
function driveConnectNow() {
  const client = google.accounts.oauth2.initTokenClient({
    client_id: DRIVE_CLIENT_ID,
    scope: DRIVE_SCOPE,
    callback: async (resp) => {
      if(resp.error) { toast('Error al conectar con Google'); return; }
      driveToken = resp.access_token;
      driveSyncUI(true);
      soundSuccess(); vibe([30,20,60]);
      toast('✅ Google Drive conectado');
      // Auto sync inmediata al conectar
      await driveSyncNow(true);
    }
  });
  client.requestAccessToken();
}

// Subir respaldo a Drive
async function driveSyncNow(silent) {
  if(!driveToken) { if(!silent) toast('Primero conecta Google Drive'); return; }
  try {
    const pack = localStorage.getItem(LS_DATA);
    if(!pack) { if(!silent) toast('No hay datos para sincronizar'); return; }
    const localEntries = vault ? vault.length : 0;
    const data = {app:'VaultKey',version:1,exported:Date.now(),entries:localEntries,payload:JSON.parse(pack)};
    const content_str = JSON.stringify(data);

    // Buscar si ya existe el archivo
    const search = await fetch(
      `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='${DRIVE_FILE_NAME}'&fields=files(id)`,
      {headers: {Authorization: 'Bearer ' + driveToken}}
    );
    const searchData = await search.json();
    const existingId = searchData.files && searchData.files[0] ? searchData.files[0].id : null;

    const metadata = {name: DRIVE_FILE_NAME, parents: ['appDataFolder']};
    let response;

    if(existingId) {
      // Actualizar archivo existente
      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify({})], {type:'application/json'}));
      form.append('file', new Blob([content_str], {type:'application/json'}));
      response = await fetch(
        `https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=multipart`,
        {method:'PATCH', headers:{Authorization:'Bearer '+driveToken}, body:form}
      );
    } else {
      // Crear archivo nuevo
      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], {type:'application/json'}));
      form.append('file', new Blob([content_str], {type:'application/json'}));
      response = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
        {method:'POST', headers:{Authorization:'Bearer '+driveToken}, body:form}
      );
    }

    if(response.ok) {
      const now = Date.now();
      localStorage.setItem(LS_DRIVE_LAST, String(now));
      driveSyncUI(true);
      if(!silent) { soundSuccess(); vibe([20,10,40]); toast('✅ Sincronizado con Google Drive'); }
    } else if(response.status === 401) {
      // Token expirado
      driveToken = null;
      driveSyncUI(false);
      toast('Sesión de Drive expirada. Vuelve a conectar');
    } else {
      if(!silent) toast('Error al sincronizar con Drive');
    }
  } catch(e) {
    console.error('Drive sync error:', e);
    if(!silent) toast('Error de conexión con Drive');
  }
}


function driveAskPin(title, msg) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'modal open';

    const sheet = document.createElement('div');
    sheet.className = 'sheet';

    const head = document.createElement('div');
    head.className = 'sheetHead';

    const titleEl = document.createElement('div');
    titleEl.className = 'sheetTitle';
    titleEl.textContent = title;

    const spacer = document.createElement('div');
    spacer.className = 'spacer';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'iconBtn';
    closeBtn.textContent = '\u2715';

    const msgEl = document.createElement('p');
    msgEl.className = 'sub';
    msgEl.textContent = msg;

    const input = document.createElement('input');
    input.className = 'inp';
    input.type = 'password';
    input.inputMode = 'numeric';
    input.autocomplete = 'current-password';
    input.placeholder = 'PIN del respaldo';

    const row = document.createElement('div');
    row.className = 'rowBtns';

    const cancel = document.createElement('button');
    cancel.className = 'ghost';
    cancel.textContent = 'Cancelar';

    const ok = document.createElement('button');
    ok.className = 'primary';
    ok.textContent = 'Continuar';

    function close(value) {
      overlay.remove();
      resolve(value);
    }

    closeBtn.onclick = () => close(null);
    cancel.onclick = () => close(null);
    ok.onclick = () => {
      const value = input.value.trim();
      if(!value) {
        toast('Introduce el PIN del respaldo');
        input.focus();
        return;
      }
      close(value);
    };

    input.addEventListener('keydown', e => {
      if(e.key === 'Enter') ok.click();
      if(e.key === 'Escape') close(null);
    });

    head.append(titleEl, spacer, closeBtn);
    row.append(cancel, ok);
    sheet.append(head, msgEl, input, row);
    overlay.appendChild(sheet);
    document.body.appendChild(overlay);
    setTimeout(() => input.focus(), 50);
  });
}

// Restaurar desde Drive
async function driveRestore() {
  if(!driveToken) { toast('Primero conecta Google Drive'); return; }
  try {
    // Buscar archivo
    const search = await fetch(
      `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='${DRIVE_FILE_NAME}'&fields=files(id,modifiedTime)`,
      {headers: {Authorization: 'Bearer ' + driveToken}}
    );
    const searchData = await search.json();
    if(!searchData.files || !searchData.files[0]) {
      toast('No se encontró respaldo en Drive'); return;
    }
    const fileId = searchData.files[0].id;
    const modified = new Date(searchData.files[0].modifiedTime).toLocaleString('es-ES');
    const localCount = vault ? vault.length : 0;
    const confirmMsg = `Respaldo de Drive del ${modified}\n\n• Entradas locales actuales: ${localCount}\n\nSi restauras se reemplazarán todas las entradas locales con las del respaldo.\n\n¿Continuar?`;
    const okRestore = await vkConfirm('Restaurar desde Drive', confirmMsg);
    if(!okRestore) return;

    // Descargar archivo
    const dl = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      {headers: {Authorization: 'Bearer ' + driveToken}}
    );
    const text = await dl.text();
    const pinForImport = await driveAskPin('PIN del respaldo', 'Introduce el PIN con el que se cifr\u00f3 este respaldo.');
    if(pinForImport === null) return;
    const data = JSON.parse(text);
    if(!data.payload) throw new Error('Sin payload');
    const decrypted = await decryptData(data.payload, pinForImport);
    if(!decrypted || !Array.isArray(decrypted)) throw new Error('PIN incorrecto o datos inválidos');
    vault = decrypted;
    await persist();
    render();
    soundSuccess(); vibe([30,20,60,20,80]);
    toast(`✅ ${vault.length} entradas restauradas desde Drive`);
  } catch(e) {
    soundError();
    toast('No se pudo restaurar el respaldo. Comprueba tu PIN e inténtalo de nuevo.');
  }
}

// Desconectar Drive
async function driveDisconnect() {
  const okDisconnect = await vkConfirm('Desconectar Google Drive', 'No se borrar\u00e1n los datos guardados en Drive. \u00bfContinuar?');
  if(!okDisconnect) return;
  driveToken = null;
  localStorage.removeItem(LS_DRIVE_LAST);
  driveSyncUI(false);
  toast('Drive desconectado');
}

// Toggle auto sync
function driveToggleAuto(checked) {
  localStorage.setItem(LS_DRIVE_AUTO, checked ? '1' : '0');
  const sub = document.getElementById('driveAutoSub');
  if(sub) sub.textContent = checked ? 'Al guardar cada entrada' : 'Desactivada';
  toast(checked ? 'Sync automática activada' : 'Sync automática desactivada');
}

// Sync automática — llamar desde saveEntry
async function driveAutoSync() {
  if(!driveToken) return;
  if(localStorage.getItem(LS_DRIVE_AUTO) === '0') return;
  await driveSyncNow(true); // silencioso
}
// ============================================================


function showSecurityInfo(){
  const m = document.getElementById('securityModal');
  if(m){ m.classList.add('open'); }
}

// Nota P0: el filtro de categorías y el panel de salud viven en app.js.
// drive.js debe quedar reservado para Google Drive y utilidades relacionadas.

function toggleHistPass(btn) {
  const el = btn.previousElementSibling && btn.previousElementSibling.querySelector('.histPassEl') 
             || btn.parentElement.querySelector('.histPassEl');
  if(!el) return;
  const pass = el.dataset.pass || '';
  if(el.textContent === '••••••••') {
    el.textContent = pass || '(vacía)';
    btn.textContent = 'Ocultar';
  } else {
    el.textContent = '••••••••';
    btn.textContent = 'Ver';
  }
}
