

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
    if(!confirm(confirmMsg)) return;

    // Descargar archivo
    const dl = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      {headers: {Authorization: 'Bearer ' + driveToken}}
    );
    const text = await dl.text();
    const pinForImport = prompt('Introduce el PIN con el que se cifró este respaldo:');
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
function driveDisconnect() {
  if(!confirm('¿Desconectar Google Drive? No se borrarán los datos guardados en Drive.')) return;
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

// Category filter — moved to app.js

// ============================================================
// PANEL DE SALUD DE CONTRASEÑAS
// ============================================================
function showHealthPanel() {
  const modal = document.getElementById('healthModal');
  if(!modal) return;
  modal.classList.add('open');
  renderHealthPanel();
}

function renderHealthPanel() {
  const content = document.getElementById('healthContent');
  if(!content) return;

  const entries = vault || [];
  if(!entries.length) {
    content.innerHTML = '<div style="text-align:center;padding:30px;color:#4a7090"><div style="font-size:48px;margin-bottom:12px">🔐</div><p>No hay entradas en tu bóveda todavía.</p></div>';
    return;
  }

  // Analysis
  const total = entries.length;
  const weak = entries.filter(e => score(e.pass) < 3);
  const strong = entries.filter(e => score(e.pass) >= 4);

  // Duplicate passwords
  const passCounts = {};
  entries.forEach(e => {
    if(e.pass && e.pass.length > 0) {
      passCounts[e.pass] = (passCounts[e.pass] || []);
      passCounts[e.pass].push(e);
    }
  });
  const duplicated = Object.values(passCounts).filter(group => group.length > 1).flat();

  // Old passwords (> 180 days)
  const now = Date.now();
  const old180 = entries.filter(e => e.updated && (now - e.updated) > 180 * 24 * 60 * 60 * 1000);

  // No URL
  const noUrl = entries.filter(e => !e.url || !e.url.trim());

  // No user/email
  const noUser = entries.filter(e => (!e.user || !e.user.trim()) && (!e.email || !e.email.trim()));

  // Score
  let healthScore = 100;
  healthScore -= weak.length * 10;
  healthScore -= duplicated.length * 8;
  healthScore -= old180.length * 3;
  healthScore = Math.max(0, Math.min(100, healthScore));

  const scoreColor = healthScore >= 80 ? '#22c55e' : healthScore >= 50 ? '#f59e0b' : '#ff4444';
  const scoreLabel = healthScore >= 80 ? 'Buena' : healthScore >= 50 ? 'Mejorable' : 'Crítica';
  const scoreEmoji = healthScore >= 80 ? '✅' : healthScore >= 50 ? '⚠️' : '🔴';

  // Update home summary
  const summaryEl = document.getElementById('healthSummaryText');
  if(summaryEl) {
    if(weak.length === 0 && duplicated.length === 0) {
      summaryEl.textContent = '✅ Todo en orden';
    } else {
      const issues = [];
      if(weak.length) issues.push(weak.length + ' débil' + (weak.length>1?'es':''));
      if(duplicated.length) issues.push(duplicated.length + ' duplicada' + (duplicated.length>1?'s':''));
      summaryEl.textContent = '⚠️ ' + issues.join(', ');
    }
  }

  const makeSection = (title, items, color, emptyMsg, showPass) => {
    if(!items.length) return `<div style="background:rgba(34,197,94,.06);border:1px solid rgba(34,197,94,.15);border-radius:12px;padding:12px;margin-bottom:12px"><p style="color:#22c55e;font-size:13px">✅ ${emptyMsg}</p></div>`;
    return `<div style="background:rgba(${color},.08);border:1px solid rgba(${color},.2);border-radius:12px;padding:12px;margin-bottom:12px">
      <p style="font-weight:700;font-size:13px;margin-bottom:8px;color:rgb(${color})">${title} (${items.length})</p>
      ${items.map(e => `<div onclick="closeModals();setTimeout(()=>quick('${e.id}'),300)" style="padding:8px;background:rgba(0,14,32,.4);border-radius:8px;margin-bottom:6px;cursor:pointer">
        <div style="font-weight:700;font-size:13px;color:#e0f0ff">${safeEsc(e.service)}</div>
        ${showPass ? `<div style="font-size:11px;color:#4a7090;font-family:monospace">${e.pass ? '••••••••' : 'Sin contraseña'}</div>` : ''}
      </div>`).join('')}
    </div>`;
  };

  content.innerHTML = `
    <!-- Score -->
    <div style="text-align:center;padding:20px 0 16px">
      <div style="font-size:64px;font-weight:900;color:${scoreColor};line-height:1">${healthScore}</div>
      <div style="font-size:16px;color:${scoreColor};font-weight:700;margin-top:4px">${scoreEmoji} Salud ${scoreLabel}</div>
      <div style="font-size:12px;color:#4a7090;margin-top:4px">${total} entradas analizadas</div>
    </div>

    <!-- Stats grid -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">
      <div style="background:rgba(0,14,32,.6);border:1px solid rgba(0,210,255,.1);border-radius:12px;padding:12px;text-align:center">
        <div style="font-size:24px;font-weight:900;color:#22c55e">${strong.length}</div>
        <div style="font-size:11px;color:#4a7090">Fuertes</div>
      </div>
      <div style="background:rgba(0,14,32,.6);border:1px solid rgba(0,210,255,.1);border-radius:12px;padding:12px;text-align:center">
        <div style="font-size:24px;font-weight:900;color:#ff4444">${weak.length}</div>
        <div style="font-size:11px;color:#4a7090">Débiles</div>
      </div>
      <div style="background:rgba(0,14,32,.6);border:1px solid rgba(0,210,255,.1);border-radius:12px;padding:12px;text-align:center">
        <div style="font-size:24px;font-weight:900;color:#f59e0b">${duplicated.length}</div>
        <div style="font-size:11px;color:#4a7090">Duplicadas</div>
      </div>
      <div style="background:rgba(0,14,32,.6);border:1px solid rgba(0,210,255,.1);border-radius:12px;padding:12px;text-align:center">
        <div style="font-size:24px;font-weight:900;color:#8b5cf6">${old180.length}</div>
        <div style="font-size:11px;color:#4a7090">+6 meses</div>
      </div>
    </div>

    <!-- Weak passwords -->
    ${makeSection('🔴 Contraseñas débiles', weak, '255,68,68', 'Sin contraseñas débiles', true)}
    
    <!-- Duplicated -->
    ${makeSection('🟡 Contraseñas duplicadas', duplicated, '245,158,11', 'Sin contraseñas duplicadas', true)}
    
    <!-- Old -->
    ${makeSection('🟣 Más de 6 meses sin cambiar', old180, '139,92,246', 'Todas actualizadas recientemente', false)}

    <!-- No URL -->
    ${noUrl.length ? makeSection('ℹ️ Sin URL registrada', noUrl, '74,112,144', 'Todas tienen URL', false) : ''}

    <button class="btn" onclick="closeModals()" style="width:100%;margin-top:8px">Cerrar</button>
  `;
}

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
