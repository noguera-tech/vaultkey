let _searchDebounce=null;
let confirmResolver=null;
let appBooted=false;
const APP_VERSION='VaultKey 2.7.0';
window.APP_VERSION=APP_VERSION;
function applyAppVersion(){
  document.querySelectorAll('[data-app-version]').forEach(function(el){
    el.textContent=APP_VERSION;
  });
}
const LS_META='vk_meta_v1',LS_DATA='vk_data_v1',LS_REC='vk_recovery_v1';let pin='',mode='unlock',tempPin='',unlocked=false,vault=[],current=null,editId=null,lastKey=null,useGenTarget=false,autoLockTimer=null,hiddenSince=null,lockCountdownTimer=null,_entryType='password',_catFilter='',_vaultTab='todas';

// Category filter — IDs estables + compatibilidad con categorías legacy
const CATEGORY_ALIASES={
  '':'',all:'',todas:'',todos:'',
  general:'general',otros:'otros',other:'otros',others:'otros',misc:'otros',miscellaneous:'otros',
  banco:'banco',bank:'banco',banking:'banco',finanzas:'banco',finance:'banco',financial:'banco',inversion:'banco',investment:'banco',seguro:'banco',insurance:'banco',card:'banco',cards:'banco',tarjeta:'banco',tarjetas:'banco',
  correo:'correo',correos:'correo',email:'correo',emails:'correo',mail:'correo',gmail:'correo',outlook:'correo',
  social:'social',redes:'social','redes sociales':'social',rrss:'social',socialmedia:'social','social-media':'social','social_networks':'social',mensajeria:'social',messaging:'social',chat:'social',
  trabajo:'trabajo',work:'trabajo',job:'trabajo',empresa:'trabajo',business:'trabajo',office:'trabajo',
  streaming:'streaming',stream:'streaming',ocio:'streaming',musica:'streaming',music:'streaming',entertainment:'streaming',video:'streaming',
  compras:'compras',shopping:'compras',shop:'compras',ecommerce:'compras','e-commerce':'compras',tienda:'compras',tiendas:'compras',
  gaming:'gaming',game:'gaming',games:'gaming',juegos:'gaming',videojuegos:'gaming',
  cripto:'cripto',crypto:'cripto',cryptocurrency:'cripto',bitcoin:'cripto',btc:'cripto',
  wifi:'wifi','wi-fi':'wifi',red:'wifi',redeswifi:'wifi',network:'wifi',networks:'wifi',
  gobierno:'gobierno',gov:'gobierno',government:'gobierno',administracion:'gobierno',admin:'gobierno',
  salud:'salud',health:'salud',medical:'salud',medico:'salud',médico:'salud',sanidad:'salud',
  documentos:'documentos',documento:'documentos',documents:'documentos',docs:'documentos',identity:'documentos',identidad:'documentos',id:'documentos',licencia:'documentos',license:'documentos',
  viajes:'viajes',travel:'viajes',transport:'viajes',transporte:'viajes',
  educacion:'educacion',educación:'educacion',education:'educacion',edu:'educacion',school:'educacion',
  familia:'familia',family:'familia',personal:'familia',
  servidor:'servidor',server:'servidor',servers:'servidor',hosting:'servidor',devops:'servidor',cloud:'servidor',nube:'servidor',dominio:'servidor',dominios:'servidor',domain:'servidor',domains:'servidor',dns:'servidor',desarrollo:'servidor',development:'servidor',developer:'servidor',dev:'servidor',codigo:'servidor',code:'servidor'
};
const CATEGORY_LABELS={
  '':'Todas',general:'General',otros:'Otros',banco:'Banco',correo:'Correo',social:'Social',trabajo:'Trabajo',streaming:'Stream',compras:'Compras',gaming:'Gaming',cripto:'Cripto',wifi:'WiFi',gobierno:'Gobierno',salud:'Salud',documentos:'Documentos',viajes:'Viajes',educacion:'Educación',familia:'Familia',servidor:'Servidor'
};
function normalizeCategoryId(cat){
  let k=String(cat||'').trim().toLowerCase();
  if(!k)return '';
  k=k.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[\s_]+/g,' ').replace(/-/g,'-');
  return CATEGORY_ALIASES[k]||k;
}
function catFromChip(btn){
  if(!btn)return '';
  if(btn.dataset&&Object.prototype.hasOwnProperty.call(btn.dataset,'cat'))return btn.dataset.cat||'';
  const onclick=btn.getAttribute&&btn.getAttribute('onclick');
  const m=onclick&&onclick.match(/setCatFilter\('([^']*)'/);
  return m?m[1]:'';
}
function categoryLabelFromId(cat){return CATEGORY_LABELS[normalizeCategoryId(cat)]||String(cat||'Todas');}
function categoryKeysForEntry(e){
  const keys=new Set();
  const rawCat=(e&&Object.prototype.hasOwnProperty.call(e,'category'))?e.category:'';
  const cat=normalizeCategoryId(rawCat);

  // La categoría asignada en el formulario es la fuente de verdad.
  // No mezclar automáticamente por entryType, porque descoordina el filtro:
  // una tarjeta asignada a "Correo" no debe aparecer en "Banco" solo por ser tipo card.
  if(cat){
    keys.add(cat);
    return keys;
  }

  // Fallback solo para entradas antiguas que no tengan categoría guardada.
  if(e?.entryType==='wifi')keys.add('wifi');
  else if(e?.entryType==='card')keys.add('banco');
  else if(e?.entryType==='id'||e?.entryType==='license')keys.add('documentos');
  else if(e?.entryType==='medical')keys.add('salud');
  else keys.add('general');
  return keys;
}
function categoryMatchesFilter(e, filterCat){
  const f=normalizeCategoryId(filterCat);
  return !f || categoryKeysForEntry(e).has(f);
}
window.vkDebugCategories=function(){
  return (vault||[]).map(e=>({service:e.service,entryType:e.entryType,category:e.category,normalized:normalizeCategoryId(e.category),filterKeys:[...categoryKeysForEntry(e)]}));
};
function setCatFilter(cat, btn) {
  _catFilter = normalizeCategoryId(cat);
  vibe(18);
  document.querySelectorAll('.catChip').forEach(b=>{
    b.classList.remove('active');
    b.setAttribute('aria-pressed','false');
  });
  const buttons=[...document.querySelectorAll('.catChip')];
  const target=btn||buttons.find(b=>normalizeCategoryId(catFromChip(b))===_catFilter);
  if(target){
    target.classList.add('active');
    target.setAttribute('aria-pressed','true');
  }
  if(typeof renderCategoryPage==='function')setTimeout(()=>renderCategoryPage(true),0);
  render();
}
window.setCatFilter=setCatFilter;

// Click robusto para chips de categorías: evita que el carrusel bloquee el onclick.
// Si el usuario arrastra el carrusel, NO debe seleccionarse ningún chip por accidente.
document.addEventListener('click', function(e){
  const chip = e.target.closest && e.target.closest('#catFilterRow .catChip');
  if(!chip) return;

  const row = chip.closest('#catFilterRow');

  if(row && (row.dataset.dragging === '1' || row.dataset.suppressClick === '1')){
    e.preventDefault();
    e.stopImmediatePropagation();
    return;
  }

  e.preventDefault();
  e.stopImmediatePropagation();

  setCatFilter(catFromChip(chip), chip);
}, true);
function setEntryType(type){
  _entryType=type;
  vibe(18);
  const isNote=type==='note';
  const isCard=type==='card';
  const isPass=type==='password';
  const isId=type==='id';
  const isLic=type==='license';
  const isMed=type==='medical';
  const isWifi=type==='wifi';
  const isSpecial=isNote||isCard||isId||isLic||isMed||isWifi;
  // Botones - resaltar activo
  const btnMap={'typeBtnPass':'password','typeBtnNote':'note','typeBtnCard':'card','typeBtnId':'id','typeBtnLicense':'license','typeBtnMedical':'medical','typeBtnWifi':'wifi'};
  Object.entries(btnMap).forEach(([id,t])=>{
    const btn=$(id);if(!btn)return;
    const active=t===type;
    btn.classList.toggle('entryTypeActive',active);
    btn.style.border='';
    btn.style.background='';
    btn.style.color='';
    btn.style.boxShadow='';
  });
  // Iconos siempre visibles
  const iconSection=$('iconStripRow')?.parentElement;
  if(iconSection)iconSection.style.display='';
  // Campos comunes password
  ['fieldUser','fieldEmail','fieldPass'].forEach(id=>{const el=$(id);if(el)el.style.display=isPass?'':'none'});
  // Bloques específicos
  const fieldNote=$('fieldSecureNote');if(fieldNote)fieldNote.style.display=isNote?'':'none';
  const fieldCard=$('fieldCard');if(fieldCard)fieldCard.style.display=isCard?'':'none';
  const fieldId=$('fieldId');if(fieldId)fieldId.style.display=isId?'':'none';
  const fieldLic=$('fieldLicense');if(fieldLic)fieldLic.style.display=isLic?'':'none';
  const fieldMed=$('fieldMedical');if(fieldMed)fieldMed.style.display=isMed?'':'none';
  const fieldWifi=$('fieldWifi');if(fieldWifi)fieldWifi.style.display=isWifi?'':'none';
  // Extras (URL/Nota) solo en password
  const extraBtns=$('fieldExtraBtns');if(extraBtns)extraBtns.style.display=isPass?'':'none';
  // Placeholder y label
  const eService=$('eService');const eServiceLabel=$('eServiceLabel');
  const placeholders={password:'Gmail, Banco, Netflix...',note:'Título de la nota...',card:'Nombre identificativo (ej: Visa BBVA)...',id:'Nombre identificativo (ej: DNI personal)...',license:'Nombre identificativo (ej: Carnet B)...',medical:'Nombre identificativo (ej: Datos de Juan)...',wifi:'Nombre de la red WiFi (ej: Movistar_Casa)...'};
  const labels={password:'Nombre del servicio *',note:'Título de la nota *',card:'Nombre identificativo *',id:'Nombre identificativo *',license:'Nombre identificativo *',medical:'Nombre identificativo *',wifi:'Nombre de la red (SSID) *'};
  if(eService)eService.placeholder=placeholders[type]||'Nombre...';
  if(eServiceLabel)eServiceLabel.textContent=labels[type]||'Nombre *';
  // Sugerir categoría por tipo (solo si está en 'general' o vacío)
  const eCat=$('eCategory');
  if(eCat&&(eCat.value===''||eCat.value==='general')){
    const suggest={password:'general',note:'general',card:'banco',
      id:'documentos',license:'documentos',medical:'salud',wifi:'wifi'};
    if(suggest[type]&&suggest[type]!=='general')eCat.value=suggest[type];
  }
}
const $=id=>document.getElementById(id);
function fmtDate(el){
  let v=el.value.replace(/[^0-9]/g,'');
  // Limitar día (01-31) y mes (01-12) al escribir
  if(v.length>=2){
    let dd=parseInt(v.slice(0,2),10);
    if(dd<1)dd=1; if(dd>31)dd=31;
    v=String(dd).padStart(2,'0')+v.slice(2);
  }
  if(v.length>=4){
    let mm=parseInt(v.slice(2,4),10);
    if(mm<1)mm=1; if(mm>12)mm=12;
    v=v.slice(0,2)+String(mm).padStart(2,'0')+v.slice(4);
  }
  if(v.length>2&&v.length<=4)v=v.slice(0,2)+'/'+v.slice(2);
  else if(v.length>4)v=v.slice(0,2)+'/'+v.slice(2,4)+'/'+v.slice(4,8);
  el.value=v;
}
function fmtExpiry(el){
  let v=el.value.replace(/[^0-9]/g,'');
  if(v.length>=3) v=v.substring(0,2)+'/'+v.substring(2,4);
  else if(v.length===2 && el._lastLen!==1) v=v+'/';
  el._lastLen=el.value.length;
  el.value=v;
}const enc=new TextEncoder(),dec=new TextDecoder();
function b64(buf){return btoa(String.fromCharCode(...new Uint8Array(buf)))}function ub64(s){return Uint8Array.from(atob(s),c=>c.charCodeAt(0))}
async function digest(s){let h=await crypto.subtle.digest('SHA-256',enc.encode(s));return b64(h)}
async function hashPin(p,salt){const key=await crypto.subtle.importKey('raw',enc.encode(p),'PBKDF2',false,['deriveBits']);const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:ub64(salt),iterations:200000,hash:'SHA-256'},key,256);return b64(bits);}
async function makeHashedPin(p){const salt=b64(crypto.getRandomValues(new Uint8Array(16)));const hash=await hashPin(p,salt);return {hash,salt};}
async function encryptRec(code,p){return encryptData({code},p);}
async function decryptRec(pack,p){try{const d=await decryptData(pack,p);return d.code||null;}catch{return null;}}
async function derive(p,salt){return crypto.subtle.deriveKey({name:'PBKDF2',salt:ub64(salt),iterations:150000,hash:'SHA-256'},await crypto.subtle.importKey('raw',enc.encode(p),'PBKDF2',false,['deriveKey']),{name:'AES-GCM',length:256},false,['encrypt','decrypt'])}
async function encryptData(data,p){let salt=b64(crypto.getRandomValues(new Uint8Array(16)));let iv=crypto.getRandomValues(new Uint8Array(12));let key=await derive(p,salt);let ct=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,enc.encode(JSON.stringify(data)));return{salt,iv:b64(iv),ct:b64(ct)}}
async function decryptData(pack,p){let key=await derive(p,pack.salt);let pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:ub64(pack.iv)},key,ub64(pack.ct));return JSON.parse(dec.decode(pt))}
function meta(){try{return JSON.parse(localStorage.getItem(LS_META)||'null')}catch{return null}}
function saveMeta(m){localStorage.setItem(LS_META,JSON.stringify(m))}
function defaultSecurity(m){if(!m)return null;let changed=false;if(m.autoLockMs===undefined){m.autoLockMs=30000;changed=true;}if(m.failedAttempts===undefined){m.failedAttempts=0;changed=true;}if(m.lockLevel===undefined){m.lockLevel=0;changed=true;}if(m.lockedUntil===undefined){m.lockedUntil=0;changed=true;}if(m.lastOk===undefined){m.lastOk=null;changed=true;}if(m.lastFail===undefined){m.lastFail=null;changed=true;}if(m.autoWipe===undefined){m.autoWipe=false;changed=true;}if(m.totalFailed===undefined){m.totalFailed=0;changed=true;}if(m.pinLen===undefined){m.pinLen=6;changed=true;}if(changed)saveMeta(m);return m}
function lockRemaining(){
  let m=defaultSecurity(meta());
  if(!m) return 0;
  const now=Date.now();
  // Protección contra reloj manipulado: si lockLevel>0 y lockedUntil ya pasó
  // pero el nivel sigue activo, reaplica el bloqueo mínimo
  if(m.lockLevel>0 && m.lockedUntil>0 && m.lockedUntil<=now){
    const levels=[30000,60000,300000,900000];
    const minWait=levels[Math.min(m.lockLevel-1,levels.length-1)];
    // Si el lastFail es muy reciente (menos de minWait ms) el reloj fue manipulado
    if(m.lastFail && (now-m.lastFail)<minWait){
      m.lockedUntil=m.lastFail+minWait;
      saveMeta(m);
    }
  }
  return m.lockedUntil>now?Math.ceil((m.lockedUntil-now)/1000):0;
}
function toast(t,snd){const el=$('toast');if(!el)return;el.textContent=t;el.style.opacity='1';clearTimeout(el._t);el._t=setTimeout(()=>{el.style.opacity='0'},2200);if(snd==='ok'||(!snd&&(t.startsWith('✓')||t.startsWith('✅')||t.includes('activad')||t.includes('guardad')||t.includes('importad')||t.includes('exportad')||t.includes('restaurad')||t.includes('desactivad')))){soundSuccess&&soundSuccess();}else if(snd==='err'||(!snd&&(t.includes('obligatorio')||t.includes('inválido')||t.includes('no tiene formato')||t.includes('no es válida')||t.includes('mínimo')||t.includes('No se pudo')||t.includes('no soporta')||t.includes('no reconocida')))){soundError&&soundError();}}
const VK_HAPTIC_PATTERNS=Object.freeze({
  tap:18,
  key:28,
  backspace:18,
  navigation:18,
  success:[30,20,60],
  error:[40,30,40],
  delete:[40,20,40],
  lock:30
});
let _vkPendingHapticTimer=null;
let _vkLastHapticAt=0;
function haptic(pattern='tap'){
  try{
    if(_vkPendingHapticTimer){clearTimeout(_vkPendingHapticTimer);_vkPendingHapticTimer=null;}
    if(localStorage.getItem('vk_vibe')==='0')return false;
    if(!navigator.vibrate)return false;
    const now=Date.now();
    if(now-_vkLastHapticAt<45)return false;
    const value=Object.prototype.hasOwnProperty.call(VK_HAPTIC_PATTERNS,pattern)
      ? VK_HAPTIC_PATTERNS[pattern]
      : pattern;
    if(typeof value!=='number'&&!Array.isArray(value))return false;
    _vkLastHapticAt=now;
    return navigator.vibrate(value);
  }catch(e){return false;}
}
function queueHaptic(pattern='tap'){
  try{
    if(_vkPendingHapticTimer)clearTimeout(_vkPendingHapticTimer);
    _vkPendingHapticTimer=setTimeout(()=>{
      _vkPendingHapticTimer=null;
      haptic(pattern);
    },24);
  }catch(e){}
}
function inferHapticPattern(el){
  const declared=el?.dataset?.haptic;
  if(declared&&Object.prototype.hasOwnProperty.call(VK_HAPTIC_PATTERNS,declared))return declared;
  const signature=((el?.getAttribute?.('onclick')||'')+' '+(el?.id||'')+' '+(el?.className||'')+' '+(el?.textContent||'')).toLowerCase();
  if(/delete|remove|eliminar|borrar|vaciar|wipe|reset/.test(signature))return 'delete';
  if(/back|volver|cancel|cerrar|close/.test(signature))return 'navigation';
  return 'tap';
}
window.vkHaptics=Object.freeze({
  trigger:haptic,
  queue:queueHaptic,
  tap:()=>haptic('tap'),
  key:()=>haptic('key'),
  backspace:()=>haptic('backspace'),
  navigation:()=>haptic('navigation'),
  success:()=>haptic('success'),
  error:()=>haptic('error'),
  delete:()=>haptic('delete'),
  lock:()=>haptic('lock')
});
function vibe(ms=40){return haptic(ms);}
document.addEventListener('click',function(event){
  const target=event.target?.closest?.('button,a[href],[role="button"],summary,select,input[type="checkbox"],input[type="radio"],[onclick]');
  if(!target||target.disabled||target.getAttribute?.('aria-disabled')==='true'||target.dataset?.haptic==='none')return;
  haptic(inferHapticPattern(target));
},true);

document.addEventListener('input',function(event){
  const target=event.target;
  if(!target?.matches?.('textarea,input:not([type="hidden"]):not([type="file"]):not([type="range"]):not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="reset"])'))return;
  if(target.disabled||target.getAttribute?.('aria-disabled')==='true'||target.dataset?.haptic==='none')return;
  const inputType=String(event.inputType||'').toLowerCase();
  haptic(inputType.startsWith('delete')?'backspace':'key');
},true);

// ── SISTEMA DE SONIDOS ──────────────────────────────────────
let _actx=null;
function getACtx(){if(!_actx)try{_actx=new(window.AudioContext||window.webkitAudioContext)()}catch(e){}return _actx;}
function soundEnabled(){return localStorage.getItem('vk_sound')==='1';}
function getSoundStyle(){return localStorage.getItem('vk_sound_style')||'suave';}

// Estilos disponibles
const SOUND_STYLES={
  suave:{
    pin:    [{freq:480,vol:0.10,decay:0.07}],
    pinDel: [{freq:320,vol:0.08,decay:0.06}],
    pinOk:  [{freq:520,vol:0.12,decay:0.08,t:0},{freq:660,vol:0.12,decay:0.10,t:90},{freq:880,vol:0.10,decay:0.14,t:180}],
    pinErr: [{freq:300,vol:0.12,decay:0.10,t:0},{freq:260,vol:0.10,decay:0.14,t:120}],
    copy:   [{freq:600,vol:0.10,decay:0.07,t:0},{freq:800,vol:0.09,decay:0.09,t:80}],
    save:   [{freq:440,vol:0.10,decay:0.07,t:0},{freq:560,vol:0.10,decay:0.09,t:80},{freq:720,vol:0.09,decay:0.12,t:160}],
    del:    [{freq:340,vol:0.10,decay:0.08,t:0},{freq:280,vol:0.09,decay:0.12,t:100}],
    nav:    [{freq:500,vol:0.07,decay:0.05}],
    gen:    [{freq:400,vol:0.09,decay:0.07,t:0},{freq:600,vol:0.09,decay:0.10,t:90}],
    open:   [{freq:420,freq2:520,vol:0.08,decay:0.09}],
    success:[{freq:520,vol:0.09,decay:0.07,t:0},{freq:700,vol:0.09,decay:0.10,t:80},{freq:880,vol:0.08,decay:0.14,t:160}],
    error:  [{freq:280,vol:0.11,decay:0.10,t:0},{freq:240,vol:0.09,decay:0.14,t:110}],
    lock:   [{freq:360,vol:0.10,decay:0.09,t:0},{freq:280,vol:0.09,decay:0.14,t:100},{freq:220,vol:0.08,decay:0.18,t:200}],
    empty:  [{freq:380,vol:0.09,decay:0.07,t:0},{freq:320,vol:0.08,decay:0.10,t:90}],
  },
  cristal:{
    pin:    [{freq:1200,type:'sine',vol:0.08,attack:0.002,decay:0.08}],
    pinDel: [{freq:900,type:'sine',vol:0.07,decay:0.06}],
    pinOk:  [{freq:880,vol:0.10,decay:0.10,t:0},{freq:1100,vol:0.09,decay:0.12,t:80},{freq:1320,vol:0.08,decay:0.16,t:160}],
    pinErr: [{freq:440,vol:0.10,decay:0.12,t:0},{freq:370,vol:0.09,decay:0.16,t:110}],
    copy:   [{freq:1100,vol:0.08,decay:0.08,t:0},{freq:1400,vol:0.07,decay:0.10,t:70}],
    save:   [{freq:660,vol:0.09,decay:0.08,t:0},{freq:880,vol:0.09,decay:0.10,t:70},{freq:1100,vol:0.08,decay:0.14,t:140}],
    del:    [{freq:550,vol:0.09,decay:0.09,t:0},{freq:440,vol:0.08,decay:0.14,t:90}],
    nav:    [{freq:1000,vol:0.06,attack:0.002,decay:0.05}],
    gen:    [{freq:880,vol:0.08,decay:0.08,t:0},{freq:1100,vol:0.08,decay:0.12,t:80}],
    open:   [{freq:800,freq2:1000,vol:0.07,decay:0.09}],
    success:[{freq:880,vol:0.08,decay:0.09,t:0},{freq:1100,vol:0.08,decay:0.12,t:75},{freq:1400,vol:0.07,decay:0.16,t:150}],
    error:  [{freq:440,vol:0.10,decay:0.12,t:0},{freq:330,vol:0.08,decay:0.16,t:100}],
    lock:   [{freq:700,vol:0.09,decay:0.10,t:0},{freq:550,vol:0.08,decay:0.14,t:90},{freq:400,vol:0.07,decay:0.20,t:180}],
    empty:  [{freq:660,vol:0.08,decay:0.08,t:0},{freq:500,vol:0.07,decay:0.12,t:85}],
  },
  retro:{
    pin:    [{freq:440,type:'square',vol:0.07,decay:0.05}],
    pinDel: [{freq:280,type:'square',vol:0.06,decay:0.04}],
    pinOk:  [{freq:392,type:'square',vol:0.08,decay:0.06,t:0},{freq:523,type:'square',vol:0.08,decay:0.06,t:80},{freq:659,type:'square',vol:0.07,decay:0.08,t:160}],
    pinErr: [{freq:196,type:'square',vol:0.08,decay:0.10,t:0},{freq:185,type:'square',vol:0.07,decay:0.12,t:100}],
    copy:   [{freq:523,type:'square',vol:0.07,decay:0.06,t:0},{freq:659,type:'square',vol:0.07,decay:0.07,t:70}],
    save:   [{freq:330,type:'square',vol:0.07,decay:0.05,t:0},{freq:440,type:'square',vol:0.07,decay:0.06,t:70},{freq:523,type:'square',vol:0.06,decay:0.08,t:140}],
    del:    [{freq:220,type:'square',vol:0.07,decay:0.08,t:0},{freq:196,type:'square',vol:0.06,decay:0.10,t:90}],
    nav:    [{freq:392,type:'square',vol:0.05,decay:0.04}],
    gen:    [{freq:440,type:'square',vol:0.07,decay:0.06,t:0},{freq:523,type:'square',vol:0.07,decay:0.08,t:80}],
    open:   [{freq:330,freq2:440,type:'square',vol:0.06,decay:0.07}],
    success:[{freq:330,type:'square',vol:0.07,decay:0.06,t:0},{freq:440,type:'square',vol:0.07,decay:0.07,t:75},{freq:523,type:'square',vol:0.06,decay:0.09,t:150}],
    error:  [{freq:196,type:'square',vol:0.08,decay:0.10,t:0},{freq:175,type:'square',vol:0.07,decay:0.14,t:100}],
    lock:   [{freq:294,type:'square',vol:0.07,decay:0.08,t:0},{freq:220,type:'square',vol:0.06,decay:0.12,t:90},{freq:175,type:'square',vol:0.06,decay:0.16,t:180}],
    empty:  [{freq:262,type:'square',vol:0.07,decay:0.07,t:0},{freq:220,type:'square',vol:0.06,decay:0.10,t:85}],
  },
  minimo:{
    pin:    [{freq:440,vol:0.06,attack:0.001,decay:0.04}],
    pinDel: [{freq:330,vol:0.05,decay:0.03}],
    pinOk:  [{freq:600,vol:0.08,decay:0.06,t:0},{freq:800,vol:0.07,decay:0.10,t:100}],
    pinErr: [{freq:250,vol:0.08,decay:0.12,t:0}],
    copy:   [{freq:700,vol:0.07,decay:0.06}],
    save:   [{freq:500,vol:0.07,decay:0.05,t:0},{freq:700,vol:0.07,decay:0.09,t:90}],
    del:    [{freq:280,vol:0.07,decay:0.10}],
    nav:    [{freq:480,vol:0.05,decay:0.03}],
    gen:    [{freq:550,vol:0.07,decay:0.08}],
    open:   [{freq:460,vol:0.06,decay:0.06}],
    success:[{freq:520,vol:0.07,decay:0.07,t:0},{freq:680,vol:0.06,decay:0.11,t:90}],
    error:  [{freq:260,vol:0.08,decay:0.12,t:0}],
    lock:   [{freq:340,vol:0.07,decay:0.08,t:0},{freq:260,vol:0.06,decay:0.14,t:100}],
    empty:  [{freq:360,vol:0.07,decay:0.09,t:0}],
  },
};

function playTone({freq=440,freq2=null,type='sine',vol=0.18,attack=0.01,decay=0.08,duration=0.12}={}){
  if(!soundEnabled())return;
  const ctx=getACtx();if(!ctx)return;
  const g=ctx.createGain();g.connect(ctx.destination);
  g.gain.setValueAtTime(0,ctx.currentTime);
  g.gain.linearRampToValueAtTime(vol,ctx.currentTime+attack);
  g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+attack+decay);
  const o=ctx.createOscillator();o.type=type||'sine';o.frequency.setValueAtTime(freq,ctx.currentTime);
  if(freq2)o.frequency.linearRampToValueAtTime(freq2,ctx.currentTime+duration);
  o.connect(g);o.start(ctx.currentTime);o.stop(ctx.currentTime+duration);
}

function playStyle(action){
  const style=SOUND_STYLES[getSoundStyle()]||SOUND_STYLES.suave;
  const tones=style[action];if(!tones)return;
  tones.forEach(t=>setTimeout(()=>playTone(t),t.t||0));
}

function soundPin()    { playStyle('pin'); }
function soundPinDel() { playStyle('pinDel'); }
function soundPinOk()  { playStyle('pinOk'); }
function soundPinErr() { playStyle('pinErr'); }
function soundCopy()   { playStyle('copy'); }
function soundSave()   { playStyle('save'); }
function soundDelete() { playStyle('del'); }
function soundNav()    { playStyle('nav'); }
function soundGen()    { playStyle('gen'); }
function soundOpen()   { playStyle('open'); }
function soundSuccess(){ playStyle('success'); }
function soundError()  { playStyle('error'); }
function soundLock()   { playStyle('lock'); }
function soundEmpty()  { playStyle('empty'); }
// ────────────────────────────────────────────────────────────
function vkConfirm(title,msg,options){
  options=options||{};
  return new Promise(function(resolve){
    const modal=$('confirmModal');
    const okButton=$('confirmOk');
    confirmResolver=resolve;
    $('confirmTitle').textContent=title;
    $('confirmMsg').textContent=msg;
    const msg2El=$('confirmMsg2');
    if(msg2El){msg2El.textContent=options.msg2||'';msg2El.hidden=!options.msg2;}
    modal.classList.remove('vk-confirm--standard','vk-confirm--reset','vk-confirm--wipe','vk-confirm--drive-disconnect','vk-confirm--drive-restore','vk-confirm--drive-connect-error','vk-confirm--delete-password','vk-confirm--backup-create','vk-confirm--backup-restore');
    if(['reset','wipe','drive-disconnect','drive-restore','drive-connect-error','delete-password','backup-create','backup-restore'].indexOf(options.variant)===-1){
      modal.classList.add('vk-confirm--standard');
    }
    if(options.variant==='reset')modal.classList.add('vk-confirm--reset');
    if(options.variant==='wipe')modal.classList.add('vk-confirm--wipe');
    if(options.variant==='drive-disconnect')modal.classList.add('vk-confirm--drive-disconnect');
    if(options.variant==='drive-restore')modal.classList.add('vk-confirm--drive-restore');
    if(options.variant==='drive-connect-error')modal.classList.add('vk-confirm--drive-connect-error');
    if(options.variant==='delete-password')modal.classList.add('vk-confirm--delete-password');
    if(options.variant==='backup-create')modal.classList.add('vk-confirm--backup-create');
    if(options.variant==='backup-restore')modal.classList.add('vk-confirm--backup-restore');
    if(okButton)okButton.textContent=options.confirmText||'Aceptar';
    modal.classList.add('open');
  });
}
function resolveConfirm(ok){
  const modal=$('confirmModal');
  const okButton=$('confirmOk');
  const msg2El=$('confirmMsg2');
  if(msg2El){msg2El.hidden=true;msg2El.textContent='';}
  modal.classList.remove('open','vk-confirm--standard','vk-confirm--reset','vk-confirm--wipe','vk-confirm--drive-disconnect','vk-confirm--drive-restore','vk-confirm--drive-connect-error','vk-confirm--delete-password','vk-confirm--backup-create','vk-confirm--backup-restore');
  if(okButton)okButton.textContent='Aceptar';
  if(confirmResolver){confirmResolver(!!ok);confirmResolver=null;}
}
function initPin(){
  // VK 2.0 — montar vkUnlock si hay boveda 2.0
  if(typeof vkUnlock!=='undefined'&&typeof vkStore!=='undefined'&&vkStore.hasVault()){
    const _c=$('pin');
    if(_c){
      const _ctx={
        router:{navigate:function(){},replace:function(p){if(p==='/unlock')lock();else if(p==='/welcome')window.location.reload();},back:function(){},current:function(){return{name:'unlock'};}},
        crypto:vkCrypto,store:vkStore,
        onUnlocked:function(s){window._vk2UnlockOk&&window._vk2UnlockOk(s.dekKey);}
      };
      vkUnlock.render({name:'unlock',path:'/unlock',params:{},meta:{root:false},transitionMs:300},_c,_ctx);
      if(_c._ulClick) _c.removeEventListener('click',_c._ulClick);
      _c._ulClick=function(e){const el=e.target.closest('[data-ul]');if(el)vkUnlock.handleAction(el.getAttribute('data-ul'),_ctx);};
      _c.addEventListener('click',_c._ulClick);
      if(_c._ulInput) _c.removeEventListener('input',_c._ulInput);
      _c._ulInput=function(e){
        if(e.target&&e.target.id==='ul-master'){
          const btn=_c.querySelector('[data-ul="submit-master"]');
          if(btn) btn.disabled=!e.target.value.trim();
        }
      };
      _c.addEventListener('input',_c._ulInput);
      return;
    }
  }

  // Legacy 1.x: usar UI VK2 sin migrar ni alterar datos antiguos
  if(typeof vkUnlock!=='undefined' && typeof vkStore!=='undefined' && !vkStore.hasVault()){
    const _legacyMeta=defaultSecurity(meta());
    if(_legacyMeta && _legacyMeta.hash){
      const _c=$('pin');
      if(_c){
        const _ctx={
          router:{navigate:function(){},replace:function(){},back:function(){},current:function(){return{name:'unlock'};}},
          allowMaster:false,
          pinLength:getPinLen(),
          unlockWithPin:async function(p){
            let m=defaultSecurity(meta());
            if(!m || !m.hash) throw Error('PIN no configurado');

            let pinOk=false;
            if(m.pinSalt){
              pinOk=(await hashPin(p,m.pinSalt))===m.hash;
            }else{
              pinOk=(await digest(p))===m.hash;
            }

            if(!pinOk){
  registerFailedPin();
  let left=lockRemaining();
  throw Error(left ? 'BÃ³veda bloqueada. Espera '+left+' s' : 'PIN incorrecto');
}

            let pack=JSON.parse(localStorage.getItem(LS_DATA)||'null');
            vault=pack?await decryptData(pack,p):[];
            await unlockOk(p);
          }
        };

        vkUnlock.render({name:'unlock',path:'/unlock',params:{},meta:{root:false},transitionMs:300},_c,_ctx);

        if(_c._ulClick) _c.removeEventListener('click',_c._ulClick);
        _c._ulClick=function(e){
          const el=e.target.closest('[data-ul]');
          if(el)vkUnlock.handleAction(el.getAttribute('data-ul'),_ctx);
        };
        _c.addEventListener('click',_c._ulClick);

        return;
      }
    }
  }

  let m=defaultSecurity(meta());mode=(m&&m.hash)?'unlock':'setup1';let left=lockRemaining();const plen=getPinLen();if($('pinMsg')){$('pinMsg').className='pinSub';$('pinMsg').textContent=mode==='unlock'?(left?'Bóveda bloqueada. Espera '+left+' s':'Introduce tu PIN'):'Crea un PIN de '+plen+' dígitos';if(left)$('pinMsg').classList.add('pinLocked');}renderDots();renderKeys();updateLockCountdown()}
function getPinLen(){const m=meta();return(m&&m.pinLen===8)?8:6;}
function renderDots(){const len=getPinLen();let d=$('dots');if(!d)return;d.innerHTML='';d.className='dots'+(len===8?' dots8':'');for(let i=0;i<len;i++){let x=document.createElement('div');x.className='dot'+(i<pin.length?' on':'');d.appendChild(x)}}
function renderKeys(){let k=$('keys');k.innerHTML='';['1','2','3','4','5','6','7','8','9','bio','0','del'].forEach(n=>{let b=document.createElement('button');b.className='key';if(n==='bio'){b.innerHTML='<svg class="fingerIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 11c0 5-2 7-2 10"/><path d="M16 8a4 4 0 0 0-8 0c0 1.3.5 2.7 1 4"/><path d="M6 12c.5 2.5 1.5 4 3 5"/><path d="M18 12c-.4 3.2-1.4 5.4-3.2 7"/><path d="M8 6.5A6 6 0 0 1 18 11"/><path d="M5 9a8 8 0 0 1 14.5-4"/><path d="M20 14c-.4 2.4-1.2 4.4-2.5 6"/></svg>';b.classList.add('bioKey');b.onclick=tryBio;b.title='Biometría del dispositivo';b.setAttribute('aria-label','Biometría del dispositivo')}else if(n==='del'){b.innerHTML='<svg class="delIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 4H8l-7 8 7 8h13z"/><path d="M18 9l-6 6M12 9l6 6"/></svg>';b.onclick=delPin;b.setAttribute('aria-label','Borrar')}else{b.textContent=n;b.setAttribute('aria-label','Dígito '+n);b.onclick=()=>pressPin(n)}k.appendChild(b)})}
async function pressPin(n){vibe(28);soundPin();let left=lockRemaining();if(left){$('pinMsg').textContent='Bóveda bloqueada. Espera '+left+' s';$('pinMsg').className='pinSub pinLocked';updateLockCountdown();return;}const len=getPinLen();if(pin.length>=len)return;pin+=n;renderDots();if(pin.length===len)await handlePin()}
function delPin(){vibe(18);soundPinDel();pin=pin.slice(0,-1);renderDots()}
async function handlePin(){return window.handlePin?window.handlePin():undefined;}
async function unlockOk(p){return window.unlockOk?window.unlockOk(p):undefined;}
async function persist(p=lastKey){
  // VK 2.0 bridge: cifrar en vk2_blob; return para no escribir LS_DATA
  if(typeof vkSession!=='undefined'&&vkSession.isActive()){
    try{
      const _dek=vkSession.getDEK();
      if(!_dek)throw new Error('No hay una DEK activa para persistir la bóveda VK2');
      const _ct=await vkCrypto.encryptVault(_dek,
        JSON.stringify({app:'VaultKey',schemaVersion:2,entries:vault||[]}));
      const _blob=vkStore.loadBlob();
      if(!_blob)throw new Error('vk2_blob no existe, no se puede persistir');
      _blob.vault=_ct;_blob.updatedAt=Date.now();
      vkStore.saveBlob(_blob);
    }catch(e){
      console.warn('VK2 persist:',e);
      throw e;
    }
    return;
  }
  if(!p)return;localStorage.setItem(LS_DATA,JSON.stringify(await encryptData(vault,p)));}
const NAV_ORDER=['home','passwords','fav','settings'];

function hasOpenModal(){
  return !!document.querySelector('.modal.open');
}

// VK 2.0 — callback tras desbloqueo real con vkUnlock
window._vk2UnlockOk=async function(dekKey){
  if(typeof vkSession!=='undefined'){
    vkSession.start({dekKey:dekKey,store:vkStore,
      router:{replace:function(p){if(p==='/unlock')lock();}},
      manageLifecycle:false});
  }
  try{
    const _blob=vkStore.loadBlob();
    if(_blob&&_blob.vault&&typeof vkCrypto!=='undefined'){
      const _raw=await vkCrypto.decryptVault(dekKey,_blob.vault);
      const _pl=JSON.parse(_raw);
      vault=Array.isArray(_pl.entries)
        ? _pl.entries.map(normalizeVK2Entry)
        : [];
    }
  }catch(e){console.warn('VK2 vault decrypt:',e);vault=[];}
  unlocked=true;lastKey=null;pin='';renderDots();hidePrivacyOverlay();
  show('home');render();resetAutoLockTimer();
  setTimeout(function(){try{checkVaultReminders();}catch(e){}},2000);
  setTimeout(function(){try{maybeShowAutofillPicker();}catch(e){}},300);
  setTimeout(function(){try{checkAutofillSetupBanner();}catch(e){}},1500);
};
// VK 2.0 — cambio de credenciales
window.vk2ChangeMaster=async function(){
  if(typeof vkCredentials==='undefined'||!vkStore.hasVault()){toast('No disponible.');return;}
  const cur=prompt('Contraseña maestra actual:');if(!cur)return;
  const nxt=prompt('Nueva contraseña maestra (mín. 12 caracteres):');
  if(!nxt||nxt.length<12){toast('Contraseña demasiado corta.');return;}
  const nxt2=prompt('Confirma la nueva contraseña:');
  if(nxt!==nxt2){toast('Las contraseñas no coinciden.');return;}
  vkCredentials.changeMaster({store:vkStore,crypto:vkCrypto,currentMaster:cur,newMaster:nxt})
    .then(function(){toast('Contraseña maestra cambiada.');})
    .catch(function(){toast('Contraseña actual incorrecta.');});
};
window.vk2ChangePIN=async function(){
  if(typeof vkCredentials==='undefined'||!vkStore.hasVault()){toast('No disponible.');return;}
  const m=prompt('Contraseña maestra:');if(!m)return;
  const np=prompt('Nuevo PIN (6 dígitos):');
  if(!np||!/^[0-9]{6}$/.test(np)){toast('PIN inválido.');return;}
  const np2=prompt('Confirma el nuevo PIN:');
  if(np!==np2){toast('Los PIN no coinciden.');return;}
  vkCredentials.changePIN({store:vkStore,crypto:vkCrypto,master:m,newPin:np})
    .then(function(){toast('PIN cambiado.');})
    .catch(function(){toast('Contraseña maestra incorrecta.');});
};
// VK2 — adaptadores de display (Módulo 3)
function vk2EntryTitle(e){ return e.title||e.service||e.wifiSsid||''; }
function vk2EntryUser(e){  return e.username||e.user||e.email||''; }
function vk2EntryPass(e){  return e.password||e.pass||''; }
function vk2EntryNotes(e){ return e.notes||e.note||''; }
function vk2EntryUrl(e){   return e.url||''; }

function normalizeVK2Entry(e){
  if(!e || typeof e!=='object') return e;

  if(String(e.type||e.entryType||'').toLowerCase()==='document'){
    return Object.assign({}, e, {
      type:'document',
      entryType:'document'
    });
  }

  return Object.assign({}, e, {
    service: e.service || e.title || e.wifiSsid || '',
    user: e.user || e.username || e.email || '',
    pass: e.pass || e.password || '',
    note: e.note || e.notes || '',
    url: e.url || ''
  });
}
function show(id,dir){
  // VK2 security guard: bloquear navegacion si hay boveda pero sesion inactiva
  if(typeof vkStore!=='undefined'&&vkStore.hasVault()&&
     typeof vkSession!=='undefined'&&!vkSession.isActive()&&id!=='pin'){
    initPin();show('pin');return;
  }

  const activeBefore=document.querySelector('.screen.active');
  if(hasOpenModal()&&id!=='pin'&&activeBefore&&activeBefore.id!==id){
    return;
  }

  vibe(18);soundNav();
  if(id==='settings') try{driveInit();}catch(e){}
  const current=document.querySelector('.screen.active');
  const next=$(id);
  if(!next||current===next)return;
  const fromIdx=NAV_ORDER.indexOf(current?.id);
  const toIdx=NAV_ORDER.indexOf(id);
  let goRight=dir==='right'||(dir===undefined&&toIdx>fromIdx);
  if(dir===undefined&&(fromIdx===-1||toIdx===-1))goRight=true;
  current?.classList.remove('active');
  next.style.display='flex';
  next.classList.remove('slide-in-right','slide-in-left','slide-out-right','slide-out-left');
  current?.classList.remove('slide-in-right','slide-in-left','slide-out-right','slide-out-left');
  if(id==='pin'||current?.id==='pin'){
    next.classList.add('active');
    current&&(current.style.display='none');
  } else {
    next.classList.add(goRight?'slide-in-right':'slide-in-left');
    current?.classList.add(goRight?'slide-out-left':'slide-out-right');
    setTimeout(()=>{
      next.classList.remove('slide-in-right','slide-in-left');
      next.classList.add('active');
      current&&(current.style.display='none');
      current?.classList.remove('slide-out-right','slide-out-left');
    },250);
  }
  if(id!=='pin')render();
  if(id!=='pin')resetAutoLockTimer();
}
/* Swipe lateral entre pantallas principales */
(function(){
  let sx=0,sy=0,stime=0;
  const SWIPEABLE=['home','passwords','fav','settings'];
  document.addEventListener('touchstart',e=>{
    sx=e.touches[0].clientX;
    sy=e.touches[0].clientY;
    stime=Date.now();
  },{passive:true});
  document.addEventListener('touchend',e=>{
    if(hasOpenModal())return;
    const cur=document.querySelector('.screen.active');
    if(!cur||!SWIPEABLE.includes(cur.id))return;
    const dx=e.changedTouches[0].clientX-sx;
    const dy=e.changedTouches[0].clientY-sy;
    const dt=Date.now()-stime;
    // Umbral: 50px mínimo, no demasiado vertical, no demasiado lento
    if(Math.abs(dx)<50||Math.abs(dy)>Math.abs(dx)*0.75||dt>500)return;
    // No swipear si hay un modal abierto
    if(document.querySelector('.modal.open'))return;
    // No swipear si el toque empezó en un elemento scrollable horizontal
    const target=e.target;
    if(target.closest('#catFilterRow,.genSliders,#iconStripRow'))return;
    const idx=SWIPEABLE.indexOf(cur.id);
    if(dx<0&&idx<SWIPEABLE.length-1){vibe(10);show(SWIPEABLE[idx+1],'right');}
    else if(dx>0&&idx>0){vibe(10);show(SWIPEABLE[idx-1],'left');}
  },{passive:true});

  // Fallback escritorio: navegación con flechas izquierda/derecha
  document.addEventListener('keydown', e => {
    if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    if (hasOpenModal()) return;

    const t = e.target;
    if (t && (t.closest('input, textarea, select, button') || t.isContentEditable)) return;

    const cur = document.querySelector('.screen.active');
    if (!cur || !SWIPEABLE.includes(cur.id)) return;

    const idx = SWIPEABLE.indexOf(cur.id);

    if (e.key === 'ArrowRight' && idx < SWIPEABLE.length - 1) {
      e.preventDefault();
      vibe(10);
      show(SWIPEABLE[idx + 1], 'right');
    }

    if (e.key === 'ArrowLeft' && idx > 0) {
      e.preventDefault();
      vibe(10);
      show(SWIPEABLE[idx - 1], 'left');
    }
  });

})();
function lock(){if(typeof vkSession!=='undefined'&&vkSession.isActive())vkSession.stop();vibe(30);soundLock();unlocked=false;lastKey=null;pin='';vault=[];clearAutoLockTimer();closeModals();initPin();show('pin');hidePrivacyOverlay()}
/* ============================================================
   Borrado total — almacenes fragmentados (notas/tarjetas/documentos
   legacy) y borradores sensibles de sessionStorage.
   Se usa desde wipe(). unlock.js mantiene su propia copia (aislamiento
   de módulo, ver cabecera de unlock.js). Cada clave se intenta de
   forma independiente y nunca lanza: el resultado se recopila para
   que el llamador decida si el borrado quedó completo. */
function wipeFragmentedLocalStores(){
  var results={};
  [
    ['notes','vaultkey_notes'],
    ['cards','vaultkey_cards'],
    ['documents','vaultkey_documents'],
    /* Copia transitoria de la boveda legacy durante un cambio de PIN. */
    ['pinChangeBackup','vk_pin_change_backup'],
    /* La conexion OAuth y sus marcas pertenecen a la boveda local borrada.
       Las copias remotas de Drive no se tocan. */
    ['driveToken','vk_drive_token'],
    ['driveLastSync','vk_drive_last_sync'],
    ['localBackupLast','vk_local_backup_last'],
    /* Estado del flujo de recuperacion; no contiene el codigo, pero no debe
       sobrevivir y contaminar el onboarding de una boveda nueva. */
    ['recoveryPending','vk_recovery_pending'],
    ['recoverySaved','vk_recovery_saved']
  ].forEach(function(pair){
    try{ localStorage.removeItem(pair[1]); results[pair[0]]={ok:true}; }
    catch(err){ results[pair[0]]={ok:false,error:err}; }
  });
  try{ sessionStorage.removeItem('vk_entry_draft'); results.sessionDraft={ok:true}; }
  catch(err){ results.sessionDraft={ok:false,error:err}; }
  return results;
}

/* Verificación posterior al borrado: qué queda realmente en localStorage/
   sessionStorage tras intentar borrarlo todo. No asumir éxito solo porque
   las claves centrales VK2 ya se intentaron borrar. */
function wipeCheckRemaining(){
  var remaining=[];
  var keys=['vk2_blob','vk2_pinwrap','vk2_meta',LS_META,LS_DATA,LS_REC,
    'vaultkey_notes','vaultkey_cards','vaultkey_documents',
    'vk_pin_change_backup','vk_drive_token','vk_drive_last_sync',
    'vk_local_backup_last','vk_recovery_pending','vk_recovery_saved'];
  keys.forEach(function(k){
    try{ if(localStorage.getItem(k)!==null) remaining.push(k); }
    catch(e){ remaining.push(k+' (no verificable)'); }
  });
  try{ if(sessionStorage.getItem('vk_entry_draft')!==null) remaining.push('sessionStorage:vk_entry_draft'); }
  catch(e){ remaining.push('sessionStorage:vk_entry_draft (no verificable)'); }
  return remaining;
}

async function wipe(options){
  options=options||{};
  if(!options.skipConfirm){
    const firstConfirmed=await vkConfirm(
      'Borrar la bóveda local',
      'Se eliminará la bóveda de este dispositivo. Las copias de Drive y los archivos descargados se conservarán.',
      {variant:'wipe',confirmText:'Continuar'}
    );
    if(!firstConfirmed)return false;
    const finalConfirmed=await vkConfirm(
      '¿Borrar definitivamente?',
      'Esta acción no se puede deshacer. Confirma de nuevo para borrar todos los datos locales de la bóveda.',
      {variant:'wipe',confirmText:'Borrar ahora'}
    );
    if(!finalConfirmed)return false;
  }

  soundError();vibe([60,30,60,30,100]);
  const isVk2=typeof vkStore!=='undefined'&&vkStore.hasVault();
  const results={};

  /* Paso 1 — adjuntos IndexedDB. Independiente de VK2: pueden existir
     adjuntos aunque la bóveda actual sea legacy o ya no exista. */
  if(typeof vkAttachments!=='undefined'&&typeof vkAttachments.deleteAll==='function'){
    try{ await vkAttachments.deleteAll(); results.attachments={ok:true}; }
    catch(err){ console.error('wipe: fallo al borrar adjuntos IndexedDB',err); results.attachments={ok:false,error:err}; }
  }else{
    results.attachments={ok:false,error:'vkAttachments no disponible'};
  }

  /* Paso 2 — modelo central VK2 (vk2_blob, vk2_pinwrap, vk2_meta, pepper).
     Se ejecuta aunque ya no haya blob: un intento anterior interrumpido pudo
     borrar localStorage y dejar el pepper del dispositivo. */
  if(typeof vkStore!=='undefined'&&typeof vkStore.wipeLocal==='function'){
    try{
      const r=await vkStore.wipeLocal();
      const pepperDeleted=!!(r&&r.pepperDeleted);
      results.vk2Store={ok:pepperDeleted,pepperDeleted:pepperDeleted};
      if(r&&r.pepperDeleted===false){
        console.error('wipe: el pepper del dispositivo no se pudo borrar',r.pepperError);
        results.vk2Store.error=r.pepperError||'pepper no eliminado';
      }
    }catch(err){
      console.error('wipe: fallo al borrar la bóveda VK2',err);
      results.vk2Store={ok:false,error:err};
    }
  }else results.vk2Store={ok:false,error:'vkStore.wipeLocal no disponible'};

  /* Paso 3 — claves legacy 1.x, independientes de si hay bóveda VK2 */
  [['legacyMeta',LS_META],['legacyData',LS_DATA],['legacyRecovery',LS_REC]].forEach(function(pair){
    try{ localStorage.removeItem(pair[1]); results[pair[0]]={ok:true}; }
    catch(err){ results[pair[0]]={ok:false,error:err}; }
  });

  /* Paso 4 — almacenes fragmentados (notas/tarjetas/documentos) y
     borrador de sessionStorage — SIEMPRE, con o sin VK2 activo */
  Object.assign(results,wipeFragmentedLocalStores());

  /* Paso 5 — estado en memoria: se limpia siempre, se haya podido
     borrar o no todo lo anterior, para no dejar la sesión actual viva */
  if(typeof vkSession!=='undefined'&&vkSession.isActive())vkSession.stop();
  unlocked=false;lastKey=null;pin='';vault=[];clearAutoLockTimer();closeModals();

  /* Paso 6 — verificación final: qué queda realmente tras intentar todo */
  const remaining=wipeCheckRemaining();
  const coreOk=!isVk2||(results.vk2Store&&results.vk2Store.ok!==false); // solo diagnóstico — NUNCA autoriza navegación
  const fullyClean=remaining.length===0&&Object.keys(results).every(function(k){return results[k].ok!==false;});

  if(!fullyClean){
    console.error('wipe: borrado incompleto',{results:results,remaining:remaining,coreOk:coreOk});
    toast('El borrado no se completó del todo. Revisa la consola y vuelve a intentarlo.','err');
    lock();
    return false;
  }

  /* Solo se avanza a onboarding (o se cierra sesión en modo legacy) cuando el
     borrado quedó completo de verdad: ningún almacén sensible —ni el modelo
     central ni los fragmentados (notas/tarjetas/documentos) ni el borrador de
     sessionStorage— puede sobrevivir a "Borrar todos los datos". coreOk se
     conserva arriba solo para depurar, nunca decide si se avanza. */
  localStorage.removeItem('vaultkey_onboarding_v130');
  if(options.deferNavigation)return true;
  if(isVk2){ openOnboardingHard(); }
  else{ lock(); }
  return true;
}

/* ============================================================
   Zona de peligro — /settings/danger (pantalla dangerZoneSettings)
   ============================================================ */

function resetDangerActionState(){
  document.querySelectorAll('[data-danger-action]').forEach(function(button){
    button.disabled=false;
    delete button.dataset.dangerBusy;
  });
}

window.openDangerZoneSettings=function(){
  var screen=document.getElementById('dangerZoneSettings');
  if(!screen)return;
  resetDangerActionState();
  try{
    if(typeof window.show==='function'){
      screen.hidden=false;
      window.show('dangerZoneSettings','right');
    }
  }catch(error){
    console.error('No se pudo abrir Zona de peligro',error);
  }
};

/* ============================================================
   Información
   ============================================================ */

window.openInformationSettings=function(){
  var screen=document.getElementById('informationSettings');
  if(!screen)return;
  try{
    if(typeof window.show==='function'){
      screen.hidden=false;
      window.show('informationSettings','right');
    }
  }catch(error){
    console.error('No se pudo abrir Información',error);
  }
};

if(!window.__vkInformationActionsBound){
  window.__vkInformationActionsBound=true;
  document.addEventListener('click',function(event){
    var target=event.target.closest('[data-info-action]');
    if(!target)return;
    var screen=target.closest('#informationSettings');
    if(!screen)return;
    var action=target.getAttribute('data-info-action');
    if(!action)return;
    event.preventDefault();
    switch(action){
      case 'help':
        toast('Próximamente');
        break;
      case 'manual':
        toast('Próximamente');
        break;
      case 'privacy':
        if(/VaultKeyWebViewPrototype\//.test(navigator.userAgent||'')){
          window.location.href='privacy.html?from=vaultkey';
        }else{
          window.open('https://nogueratech.app/privacy.html','_blank','noopener');
        }
        break;
      case 'licenses':
        toast('Próximamente');
        break;
      case 'rate':
        toast('Próximamente');
        break;
      default:
        console.warn('Acción de Información desconocida:',action);
    }
  });
}

/* ============================================================
   Notificaciones
   ============================================================ */

function getNotificationsMasterStatus(){
  if(!('Notification' in window)){
    return 'unavailable';
  }
  if(Notification.permission==='denied'){
    return 'blocked';
  }
  if(Notification.permission==='granted'){
    return localStorage.getItem('vk_notifications_enabled')==='1'
      ? 'enabled'
      : 'disabled';
  }
  return 'disabled';
}

function syncNotificationsMasterStatus(){
  var subtitle=document.getElementById('notificationsMasterStatus');
  if(!subtitle)return;
  var status=getNotificationsMasterStatus();
  switch(status){
    case 'enabled':
      subtitle.textContent='Activadas';
      break;
    case 'blocked':
      subtitle.textContent='Bloqueadas';
      break;
    case 'unavailable':
      subtitle.textContent='No disponibles';
      break;
    default:
      subtitle.textContent='Desactivadas';
  }
}

/* ============================================================
   Interacción
   ============================================================ */

window.openInteractionSettings=function(){
  var screen=document.getElementById('interactionSettings');
  if(!screen)return;
  try{
    syncInteractionHapticSwitch();
    if(typeof window.show==='function'){
      screen.hidden=false;
      window.show('interactionSettings','right');
    }
  }catch(error){
    console.error('No se pudo abrir Interacción',error);
  }
};

function syncInteractionHapticSwitch(){
  var btn=document.getElementById('interactionHapticSwitch');
  if(!btn)return;
  var enabled=localStorage.getItem('vk_vibe')!=='0';
  btn.setAttribute('aria-checked',enabled?'true':'false');
}

window.toggleHapticFeedback=function(){
  var btn=document.getElementById('interactionHapticSwitch');
  var enabled=localStorage.getItem('vk_vibe')!=='0';
  var next=!enabled;
  localStorage.setItem('vk_vibe',next?'1':'0');
  if(btn)btn.setAttribute('aria-checked',next?'true':'false');
  if(next&&typeof vibe==='function')vibe(30);
};

window.openNotificationsSettings=function(){
  var screen=document.getElementById('notificationsSettings');
  if(!screen)return;
  try{
    syncNotificationsMasterStatus();
    if(typeof window.show==='function'){
      screen.hidden=false;
      window.show('notificationsSettings','right');
    }
  }catch(error){
    console.error('No se pudo abrir Notificaciones',error);
  }
};

async function toggleMasterNotifications(){
  var subtitle=document.getElementById('notificationsMasterStatus');

  if(!('Notification' in window)){
    if(subtitle){subtitle.textContent='No disponibles';}
    toast('Las notificaciones no están disponibles en este navegador','err');
    return;
  }

  if(Notification.permission==='denied'){
    localStorage.setItem('vk_notifications_enabled','0');
    if(subtitle){subtitle.textContent='Bloqueadas';}
    toast('Las notificaciones están bloqueadas en los ajustes de tu dispositivo/navegador');
    return;
  }

  if(Notification.permission==='default'){
    try{
      var permission=await Notification.requestPermission();
      if(permission==='granted'){
        localStorage.setItem('vk_notifications_enabled','1');
        if(subtitle){subtitle.textContent='Activadas';}
        toast('Notificaciones activadas','ok');
        return;
      }
      localStorage.setItem('vk_notifications_enabled','0');
      if(subtitle){subtitle.textContent='Desactivadas';}
      toast('Notificaciones desactivadas');
      return;
    }catch(error){
      console.error('No se pudo solicitar permiso de notificaciones',error);
      localStorage.setItem('vk_notifications_enabled','0');
      syncNotificationsMasterStatus();
      toast('No se pudo solicitar el permiso de notificaciones','err');
      return;
    }
  }

  var currentlyEnabled=localStorage.getItem('vk_notifications_enabled')==='1';
  if(currentlyEnabled){
    localStorage.setItem('vk_notifications_enabled','0');
    if(subtitle){subtitle.textContent='Desactivadas';}
    toast('Notificaciones desactivadas');
    return;
  }
  localStorage.setItem('vk_notifications_enabled','1');
  if(subtitle){subtitle.textContent='Activadas';}
  toast('Notificaciones activadas','ok');
}

if(!window.__vkNotificationsActionsBound){
  window.__vkNotificationsActionsBound=true;
  document.addEventListener('click',function(event){
    var target=event.target.closest('[data-notif-action]');
    if(!target)return;
    var screen=target.closest('#notificationsSettings');
    if(!screen)return;
    var action=target.getAttribute('data-notif-action');
    if(!action)return;
    event.preventDefault();
    switch(action){
      case 'master':
        toggleMasterNotifications();
        break;
      case 'reminders':
        toast('Próximamente');
        break;
      case 'expiry':
        toast('Próximamente');
        break;
      case 'sync':
        toast('Próximamente');
        break;
      case 'silent':
        toast('Próximamente');
        break;
      default:
        console.warn('Acción de Notificaciones desconocida:',action);
    }
  });
}


/* ============================================================
   Google Drive — UI rica conectada a drive.js
   ============================================================ */
function formatDriveLastSync(){
  var raw=localStorage.getItem('vk_drive_last_sync');
  if(!raw)return 'Nunca';
  var stamp=parseInt(raw,10);
  if(!Number.isFinite(stamp))return 'Nunca';
  return new Date(stamp).toLocaleString('es-ES',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
}

window.syncDriveSettingsUI=function(state){
  var screen=document.getElementById('driveSettings');
  if(!screen)return;
  state=state||((typeof window.driveGetUiState==='function')?window.driveGetUiState():'disconnected');
  var ids=['driveConnectCard','driveStatusCard','driveBackupCard','driveRestoreCard','driveRetryCard','driveDisconnectCard'];
  ids.forEach(function(id){var el=document.getElementById(id);if(el)el.hidden=true;});
  var accountSub=document.getElementById('driveAccountSub');
  var statusCard=document.getElementById('driveStatusCard');
  var statusText=document.getElementById('driveStatusText');
  var statusIcon=document.getElementById('driveStatusIcon');
  var lastText=document.getElementById('driveLastText');
  if(lastText)lastText.textContent=formatDriveLastSync();
  screen.classList.toggle('vk-drive-busy',state==='syncing');
  if(statusCard)statusCard.classList.remove('vk-drive-card--warning');
  if(state==='disconnected'){
    if(accountSub)accountSub.textContent='Cuenta no conectada';
    document.getElementById('driveConnectCard').hidden=false;
    return;
  }
  if(accountSub){
    accountSub.textContent=state==='offline'?'Los cambios se sincronizarán cuando vuelvas a tener Internet.':'Cuenta conectada';
    accountSub.classList.toggle('vk-drive-copy--wrap',state==='offline');
  }
  if(statusCard)statusCard.hidden=false;
  if(statusIcon){
    if(state==='syncing')statusIcon.innerHTML='<svg class="vk-drive-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 4v5h5"/><path d="M4 13a8.1 8.1 0 0 0 15.5 2M20 20v-5h-5"/></svg>';
    else if(state==='offline')statusIcon.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.7-9h1.8a4.5 4.5 0 0 1 0 9Z"/></svg>';
    else statusIcon.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 4 4L19 6"/></svg>';
  }
  if(state==='offline'){
    if(statusText)statusText.textContent='Sin conexión';
    if(statusCard)statusCard.classList.add('vk-drive-card--warning');
    document.getElementById('driveRestoreCard').hidden=false;
    document.getElementById('driveRetryCard').hidden=false;
    return;
  }
  if(statusText){
    const hasSync=Boolean(localStorage.getItem('vk_drive_last_sync'));
    statusText.textContent=state==='syncing'
      ?'Creando copia...'
      :state==='restoring'
        ?'Preparando restauración...'
        :hasSync
          ?'Copia de seguridad actualizada'
          :'Conectado · aún no hay copias creadas';
  }
  document.getElementById('driveBackupCard').hidden=false;
  document.getElementById('driveRestoreCard').hidden=false;
  if(state==='connected')document.getElementById('driveDisconnectCard').hidden=false;
};

window.openDriveSettings=function(){
  var screen=document.getElementById('driveSettings');
  if(!screen)return;
  try{
    if(typeof driveInit==='function')driveInit();
    window.syncDriveSettingsUI();
    if(typeof window.show==='function'){
      screen.hidden=false;
      window.show('driveSettings','right');
    }
  }catch(error){console.error('No se pudo abrir Google Drive',error);}
};

if(!window.__vkDriveActionsBound){
  window.__vkDriveActionsBound=true;
  document.addEventListener('click',async function(event){
    var target=event.target.closest('[data-drive-action]');
    if(!target||!target.closest('#driveSettings'))return;
    event.preventDefault();
    var action=target.getAttribute('data-drive-action');
    try{
      if(action==='connect'&&typeof driveConnect==='function')driveConnect();
      else if((action==='sync'||action==='retry')&&typeof driveSyncNow==='function')await driveSyncNow(false);
      else if(action==='restore'&&typeof driveRestore==='function')await driveRestore();
      else if(action==='disconnect'&&typeof driveDisconnect==='function')await driveDisconnect();
    }catch(error){console.error('Error en acción de Google Drive',error);toast('No se pudo completar la acción de Google Drive','err');}
  });
}

function resetDriveSync(){
  localStorage.removeItem('vk_drive_last_sync');
  // Conservados deliberadamente: token OAuth en memoria de sesión y vk_drive_auto
  toast('Sincronización reiniciada. Próxima sync será completa.');
}

function resetVaultConfig(){
  const m=meta();
  if(!m)return false;
  m.failedAttempts=0;
  m.totalFailed=0;
  m.lockLevel=0;
  m.lockedUntil=0;
  m.lastOk=null;
  m.lastFail=null;
  m.autoLockMs=30000;
  m.autoWipe=false;
  saveMeta(m);
  // Conservados deliberadamente: m.hash, m.pinSalt, m.pinLen, m.created, m.lastBackup
  return true;
}

async function executeDangerAction(action){
  switch(action){
    case 'wipe':
      // wipe() ya muestra su propia confirmación destructiva — no añadir otra
      await wipe();
      break;
    case 'disconnect-drive':
      if(typeof driveDisconnect!=='function'){
        console.error('Zona de peligro: driveDisconnect() no está disponible.');
        toast('No se pudo desconectar Google Drive.','err');
        return;
      }
      await Promise.resolve(driveDisconnect());
      break;
    case 'reset-sync':
      resetDriveSync();
      break;
    case 'lock':
      lock();
      break;
    case 'reset-config':{
      const confirmed=await vkConfirm(
        'Restablecer VaultKey',
        'Se restablecerán el autobloqueo, el borrado automático y los contadores de seguridad. El PIN y los datos de la bóveda se conservarán.',
        {variant:'reset',confirmText:'Restablecer'}
      );
      if(!confirmed)return;
      const resetCompleted=resetVaultConfig();
      if(!resetCompleted){
        toast('No se encontró la configuración de VaultKey.','err');
        return;
      }
      resetAutoLockTimer();
      toast('Configuración de VaultKey restablecida.');
      break;
    }
    default:
      console.warn('Zona de peligro: acción desconocida:',action);
      return;
  }
}

if(!window.__vkDangerActionsBound){
  window.__vkDangerActionsBound=true;
  document.addEventListener('click',async function(event){
    const button=event.target&&event.target.closest?event.target.closest('[data-danger-action]'):null;
    if(!button)return;
    if(button.dataset.dangerBusy==='1')return;
    const action=button.dataset.dangerAction;
    event.preventDefault();
    event.stopPropagation();
    button.dataset.dangerBusy='1';
    if(action==='reset-sync'||action==='reset-config'){vibe(18);}
    try{
      await executeDangerAction(action);
    }catch(error){
      console.error('Zona de peligro: error ejecutando "'+action+'".',error);
      toast('No se pudo completar la acción.','err');
    }finally{
      delete button.dataset.dangerBusy;
    }
  });
}

function closeModals(){
  document.body.classList.remove('vk-health-open');
  document.querySelectorAll('.modal').forEach(m=>{
    if(m.id==='recoveryModal'){
      const btn=$('recoveryCloseBtn');
      if(btn&&btn.style.display==='none')return;
    }
    m.classList.remove('open');
  });
  if(typeof window.closeCreatePicker==='function')window.closeCreatePicker();
  if(typeof window.closeDocumentTypePicker==='function')window.closeDocumentTypePicker();
  if(typeof window.closeDocumentSourceSheet==='function')window.closeDocumentSourceSheet();
  if(typeof window.closeEmergencyKitRegenerateDialog==='function'){
    window.closeEmergencyKitRegenerateDialog(true);
  }
  if(typeof window.closeGenSheet==='function')window.closeGenSheet();
  editId=null;useGenTarget=false;selectedEntryIcon='';try{resetNoteReminder();}catch(e){}try{resetEntryTags();}catch(e){}
}

// ══ RECORDATORIO EN NOTAS ══
let _reminderActive = false;

function toggleNoteReminder(){
  _reminderActive = !_reminderActive;
  const toggle = $('reminderToggle');
  const thumb  = $('reminderThumb');
  const fields = $('reminderFields');
  const hint   = $('reminderHint');
  if(_reminderActive){
    if(toggle){ toggle.style.background='rgba(0,210,255,.35)'; toggle.style.borderColor='rgba(0,210,255,.7)'; }
    if(thumb) { thumb.style.background='#00d9ff'; thumb.style.left='22px'; }
    if(fields){ fields.style.display=''; }
    if(hint)  { hint.textContent='Recordatorio activado'; hint.style.color='#00d9ff'; }
    // Poner fecha de hoy por defecto si está vacía
    const dateEl=$('eReminderDate');
    if(dateEl&&!dateEl.value){
      const d=new Date();
      dateEl.value=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
    }
    // Hora por defecto = hora actual local redondeada a media hora
    const timeEl=$('eReminderTime');
    if(timeEl&&(timeEl.value==='09:00'||!timeEl.value)){
      const n=new Date();
      const h=n.getHours();
      const m=Math.ceil(n.getMinutes()/5)*5;
      const hf=m>=60?h+1:h;
      const mf=m>=60?0:m;
      timeEl.value=String(hf%24).padStart(2,'0')+':'+String(mf).padStart(2,'0');
    }
  } else {
    if(toggle){ toggle.style.background='rgba(0,100,180,.3)'; toggle.style.borderColor='rgba(0,180,255,.3)'; }
    if(thumb) { thumb.style.background='#7ab0d0'; thumb.style.left='2px'; }
    if(fields){ fields.style.display='none'; }
    if(hint)  { hint.textContent='Avisa al abrir la app'; hint.style.color='rgba(160,210,240,.6)'; }
  }
}

function resetNoteReminder(){
  _reminderActive=false;
  const toggle=$('reminderToggle');const thumb=$('reminderThumb');const fields=$('reminderFields');const hint=$('reminderHint');
  if(toggle){toggle.style.background='rgba(0,100,180,.3)';toggle.style.borderColor='rgba(0,180,255,.3)';}
  if(thumb){thumb.style.background='#7ab0d0';thumb.style.left='2px';}
  if(fields)fields.style.display='none';
  if(hint){hint.textContent='Avisa al abrir la app';hint.style.color='rgba(160,210,240,.6)';}
  const dateEl=$('eReminderDate');if(dateEl)dateEl.value='';
  const timeEl=$('eReminderTime');if(timeEl)timeEl.value='';
  const msgEl=$('eReminderMsg');if(msgEl)msgEl.value='';
}

function loadNoteReminder(e){
  resetNoteReminder();
  if(!e||!e.reminder||!e.reminder.active)return;
  const r=e.reminder;
  // Activar directamente sin pasar por toggleNoteReminder (que invertiría el valor)
  _reminderActive=true;
  const toggle=$('reminderToggle'),thumb=$('reminderThumb'),fields=$('reminderFields'),hint=$('reminderHint');
  if(toggle){toggle.style.background='rgba(0,210,255,.35)';toggle.style.borderColor='rgba(0,210,255,.7)';}
  if(thumb){thumb.style.background='#00d9ff';thumb.style.left='22px';}
  if(fields)fields.style.display='';
  if(hint){hint.textContent='Recordatorio activado';hint.style.color='#00d9ff';}
  const dateEl=$('eReminderDate');if(dateEl&&r.date)dateEl.value=r.date;
  const timeEl=$('eReminderTime');if(timeEl&&r.time)timeEl.value=r.time;
  const msgEl=$('eReminderMsg');if(msgEl&&r.msg)msgEl.value=r.msg;
}

function confirmRecoverySaved(){
  vibe([30,20,60]);
  const btn=$('recoveryCloseBtn');
  if(btn)btn.style.display='';
  localStorage.setItem('vk_recovery_saved','1');
  closeModals();
}

function registerFailedPin(){
  vibe([40,30,40]);soundPinErr();
  let m=defaultSecurity(meta());
  if(!m){$('pinMsg').textContent='PIN incorrecto';pin='';renderDots();return;}
  m.failedAttempts=(m.failedAttempts||0)+1;
  m.totalFailed=(m.totalFailed||0)+1;
  m.lastFail=Date.now();
  let msg='PIN incorrecto';
  const remaining=m.autoWipe?Math.max(0,10-m.totalFailed):null;
  if(m.autoWipe&&remaining<=3&&remaining>0){
    msg='PIN incorrecto. '+(remaining===1?'⚠️ Último intento antes del borrado':'⚠️ Quedan '+remaining+' intentos antes del borrado');
  }
  if(m.autoWipe&&m.totalFailed>=10){
    saveMeta(m);soundError();vibe([80,40,80,40,120]);
    pin='';renderDots();
    $('pinMsg').className='pinSub pinWarn';
    $('pinMsg').textContent='Décimo intento fallido. Borrando datos locales…';
    Promise.resolve(wipe({skipConfirm:true,deferNavigation:true})).then(function(complete){
      const msgEl=$('pinMsg');
      if(complete){
        if(msgEl){msgEl.className='pinSub pinWarn';msgEl.textContent='Demasiados intentos. Bóveda local borrada.';}
        setTimeout(function(){window.location.reload();},1800);
      }else if(msgEl){
        msgEl.className='pinSub pinWarn';
        msgEl.textContent='No se pudo completar el borrado. La aplicación permanece bloqueada.';
      }
    }).catch(function(err){
      console.error('auto-wipe legacy: error inesperado',err);
      lock();
      const msgEl=$('pinMsg');
      if(msgEl){msgEl.className='pinSub pinWarn';msgEl.textContent='No se pudo completar el borrado. La aplicación permanece bloqueada.';}
    });
    return;
  }
  if(m.failedAttempts===4&&!m.autoWipe)msg='PIN incorrecto. Te quedan 2 intentos';
  if(m.failedAttempts===5&&!m.autoWipe)msg='PIN incorrecto. Te queda 1 intento';
  if(m.failedAttempts>=6){
    const levels=[30000,60000,300000,900000];
    let idx=Math.min(m.lockLevel||0,levels.length-1);
    let ms=levels[idx];
    m.lockedUntil=Date.now()+ms;
    m.lockLevel=Math.min(idx+1,levels.length-1);
    m.failedAttempts=0;
    if(!m.autoWipe)msg='Demasiados intentos. Bóveda bloqueada '+Math.ceil(ms/1000)+' s';
    else msg='Bóveda bloqueada '+Math.ceil(ms/1000)+' s · Quedan '+Math.max(0,10-m.totalFailed)+' intentos antes del borrado';
  }
  saveMeta(m);
  $('pinMsg').className='pinSub '+(m.lockedUntil>Date.now()?'pinLocked':'pinWarn');
  $('pinMsg').textContent=msg;pin='';renderDots();updateLockCountdown();
}
function updateLockCountdown(){clearInterval(lockCountdownTimer);let left=lockRemaining();if(!left)return;lockCountdownTimer=setInterval(()=>{let s=lockRemaining();if(!s){clearInterval(lockCountdownTimer);$('pinMsg').className='pinSub';$('pinMsg').textContent='Introduce tu PIN';return}$('pinMsg').textContent='Bóveda bloqueada. Espera '+s+' s';},1000)}
function getAutoLockMs(){let m=defaultSecurity(meta());return m?Number(m.autoLockMs||0):0}
function setAutoLock(v){let m=defaultSecurity(meta());if(!m)return;m.autoLockMs=Number(v);saveMeta(m);toast(m.autoLockMs===0?'Bloqueo inmediato al salir activado':'Autobloqueo inteligente actualizado');resetAutoLockTimer()}
function clearAutoLockTimer(){if(autoLockTimer){clearTimeout(autoLockTimer);autoLockTimer=null}}
function resetAutoLockTimer(){clearAutoLockTimer();if(!unlocked||document.hidden)return;let ms=getAutoLockMs();if(ms>0){autoLockTimer=setTimeout(()=>{if(unlocked&&!document.hidden){soundLock();lock()}},ms)}}
function markActivity(){if(unlocked){hidePrivacyOverlay();resetAutoLockTimer()}}
function showPrivacyOverlay(){let o=$('privacyOverlay');if(o)o.classList.add('show');document.body.classList.add('vk-locked')}
function hidePrivacyOverlay(){let o=$('privacyOverlay');if(o)o.classList.remove('show');document.body.classList.remove('vk-locked')}
function lockForBackground(){
  unlocked=false;
  lastKey=null;
  pin='';
  hiddenSince=null;
  clearAutoLockTimer();
  if(typeof vkSession!=='undefined'&&vkSession.isActive())vkSession.stop();
  closeModals();
}
function startBackgroundAutoLock(){
  if(!unlocked)return;
  showPrivacyOverlay();
  const ms=getAutoLockMs();
  if(ms===0){lockForBackground();return;}
  if(hiddenSince===null)hiddenSince=Date.now();
  const remaining=Math.max(0,ms-(Date.now()-hiddenSince));
  clearAutoLockTimer();
  autoLockTimer=setTimeout(()=>{if(!unlocked)return;soundLock();lockForBackground();},remaining);
}
window.isFilePickerGuardActive=function(){
  return window._vkFilePickerOpen===true ||
    Date.now()<Number(window._vkFilePickerGraceUntil||0) ||
    window._vkLocalBackupPickerOpen===true ||
    Date.now()<Number(window._vkLocalBackupPickerGraceUntil||0) ||
    window._vkGoogleOAuthOpen===true ||
    Date.now()<Number(window._vkGoogleOAuthGraceUntil||0);
};
window.finishFilePicker=function(){
  window._vkFilePickerOpen=false;
  window._vkFilePickerGraceUntil=Date.now()+500;
  if(window._vkFilePickerFocusFallbackTimer){
    clearTimeout(window._vkFilePickerFocusFallbackTimer);
    window._vkFilePickerFocusFallbackTimer=null;
  }
};
function handleVisibilityChange(){
  if(!appBooted)return;
  if(window._vkSharing||window._vkBiometricFlow||window.isFilePickerGuardActive())return;
  if(document.hidden){
    if(unlocked){
      // Guardar borrador del formulario si está abierto
      const entryModal=document.getElementById('entryModal');
      if(entryModal&&entryModal.classList.contains('open')){
        const draft={
          service:document.getElementById('eService')?.value||'',
          user:document.getElementById('eUser')?.value||'',
          email:document.getElementById('eEmail')?.value||'',
          url:document.getElementById('eUrl')?.value||'',
          icon:selectedEntryIcon||''
        };
        sessionStorage.setItem('vk_entry_draft',JSON.stringify(draft));
      }
      startBackgroundAutoLock();
    }
  } else {
    if(!unlocked){
      // Volvemos con la app bloqueada — mostrar PIN
      clearTimeout(autoLockTimer);autoLockTimer=null;
      hidePrivacyOverlay();
      const pinScreen=$('pin');
      if(pinScreen){
        document.querySelectorAll('.screen').forEach(s=>{s.classList.remove('active');s.style.cssText='';s.style.display='none';});
        pinScreen.style.display='flex';pinScreen.classList.add('active');
      }
      setTimeout(()=>initPin(),50);
    } else if(autoLockTimer && hiddenSince && (Date.now()-hiddenSince) >= getAutoLockMs()){
      // Había un timer corriendo Y ya pasó el tiempo real configurado — bloquear al volver
      clearTimeout(autoLockTimer);autoLockTimer=null;hiddenSince=null;
      lockForBackground();
      hidePrivacyOverlay();
      const pinScreen=$('pin');
      if(pinScreen){
        document.querySelectorAll('.screen').forEach(s=>{s.classList.remove('active');s.style.cssText='';s.style.display='none';});
        pinScreen.style.display='flex';pinScreen.classList.add('active');
      }
      setTimeout(()=>initPin(),50);
    } else {
      // O no había timer, o volvimos antes de que se cumpliera el tiempo configurado —
      // no bloquear, solo reiniciar el contador normal de inactividad
      clearAutoLockTimer();hiddenSince=null;
      hidePrivacyOverlay();resetAutoLockTimer();
    }
  }
}
document.addEventListener('visibilitychange',handleVisibilityChange);
window.addEventListener('pageshow',(e)=>{
  if(!appBooted)return;
  if(!document.hidden&&!unlocked&&localStorage.getItem('vaultkey_onboarding_v130')){
    hidePrivacyOverlay();
    setTimeout(()=>initPin(),50);
  }
});
// Mostrar privacy overlay inmediatamente en blur/pagehide
// para evitar que Android capture contenido sensible en recientes
window.addEventListener('blur', () => {
  if(window.isFilePickerGuardActive()) return;
  if(!appBooted || !unlocked || window._vkSharing || window._vkBiometricFlow) return;
  startBackgroundAutoLock();
});
// Recuperar overlay al volver el foco cuando NO hay cambio de pestaña
// (ej. abrir/usar DevTools en la misma ventana no dispara visibilitychange)
window.addEventListener('focus', () => {
  if(window.isFilePickerGuardActive()){
    if(window._vkFilePickerOpen&&window._vkFilePickerCancelSupported===false){
      clearTimeout(window._vkFilePickerFocusFallbackTimer);
      window._vkFilePickerFocusFallbackTimer=setTimeout(()=>{
        if(window._vkFilePickerOpen)window.finishFilePicker();
      },250);
    }
    return;
  }
  if(!appBooted || window._vkSharing || window._vkBiometricFlow) return;
  handleVisibilityChange();
});
window.addEventListener('pagehide',()=>{if(window.isFilePickerGuardActive())return;if(unlocked){showPrivacyOverlay();lockForBackground();}});
['pointerdown','keydown','input','scroll'].forEach(ev=>document.addEventListener(ev,markActivity,{capture:true,passive:true}));

let selectedEntryIcon='';
const MANUAL_ICONS=[
 {id:'auto',label:'Auto',emoji:'✨',bg:'#0a84ff'},
 {id:'mail',label:'Correo',emoji:'📧',bg:'#EA4335'},
 {id:'bank',label:'Banco',emoji:'🏦',bg:'#1d4ed8'},
 {id:'card',label:'Tarjeta',emoji:'💳',bg:'#0f766e'},
 {id:'wifi',label:'Wi‑Fi',emoji:'📶',bg:'#7c3aed'},
 {id:'cloud',label:'Cloud',emoji:'☁️',bg:'#0284c7'},
 {id:'shopping',label:'Compras',emoji:'🛒',bg:'#16a34a'},
 {id:'social',label:'Social',emoji:'💬',bg:'#db2777'},
 {id:'work',label:'Trabajo',emoji:'💼',bg:'#475569'},
 {id:'game',label:'Gaming',emoji:'🎮',bg:'#9333ea'},
 {id:'stream',label:'Streaming',emoji:'▶️',bg:'#dc2626'},
 {id:'note',label:'Nota',emoji:'📝',bg:'#ca8a04'},
 {id:'key',label:'Clave',emoji:'🔑',bg:'#0891b2'},
 {id:'safe',label:'Bóveda',emoji:'🛡️',bg:'#0a84ff'},
 {id:'google',label:'Google',emoji:'G',bg:'#4285F4'},
 {id:'facebook',label:'Facebook',emoji:'f',bg:'#1877F2'},
 {id:'instagram',label:'Instagram',emoji:'📸',bg:'#C13584'},
 {id:'whatsapp',label:'WhatsApp',emoji:'☎️',bg:'#25D366'},
 {id:'telegram',label:'Telegram',emoji:'✈️',bg:'#229ED9'},
 {id:'youtube',label:'YouTube',emoji:'▶️',bg:'#FF0000'},
 {id:'netflix',label:'Netflix',emoji:'N',bg:'#E50914'},
 {id:'spotify',label:'Spotify',emoji:'🎵',bg:'#1DB954'},
 {id:'paypal',label:'PayPal',emoji:'P',bg:'#003087'},
 {id:'amazon',label:'Amazon',emoji:'a',bg:'#FF9900'},
 {id:'github',label:'GitHub',emoji:'🐙',bg:'#24292F'},
 {id:'discord',label:'Discord',emoji:'🎧',bg:'#5865F2'},
 {id:'reddit',label:'Reddit',emoji:'👽',bg:'#FF4500'},
 {id:'x',label:'X / Twitter',emoji:'𝕏',bg:'#000'},
 {id:'linkedin',label:'LinkedIn',emoji:'in',bg:'#0A66C2'},
 {id:'binance',label:'Binance',emoji:'₿',bg:'#F3BA2F'},
 {id:'crypto',label:'Crypto',emoji:'₿',bg:'#f59e0b'},
 {id:'wallet',label:'Wallet',emoji:'👛',bg:'#7c3aed'},
 {id:'mercadolibre',label:'MercadoLibre',emoji:'📦',bg:'#FFE600'},
 {id:'aliexpress',label:'AliExpress',emoji:'🛍️',bg:'#E62E04'},
 {id:'apple',label:'Apple',emoji:'🍎',bg:'#111827'},
 {id:'microsoft',label:'Microsoft',emoji:'⊞',bg:'#00A4EF'},
 {id:'drive',label:'Drive',emoji:'📁',bg:'#0F9D58'},
 {id:'dropbox',label:'Dropbox',emoji:'📦',bg:'#0061FF'},
 {id:'school',label:'Estudio',emoji:'🎓',bg:'#2563eb'},
 {id:'health',label:'Salud',emoji:'🏥',bg:'#dc2626'},
 {id:'home',label:'Casa',emoji:'🏠',bg:'#16a34a'},
 {id:'car',label:'Coche',emoji:'🚗',bg:'#334155'},
 {id:'travel',label:'Viajes',emoji:'✈️',bg:'#0284c7'},
 {id:'music',label:'Música',emoji:'🎧',bg:'#9333ea'},
 {id:'photo',label:'Fotos',emoji:'🖼️',bg:'#db2777'}
];

MANUAL_ICONS.push(

 {id:'gmail',label:'Gmail',emoji:'M',bg:'#EA4335'}, {id:'outlook',label:'Outlook',emoji:'O',bg:'#0078D4'}, {id:'hotmail',label:'Hotmail',emoji:'O',bg:'#0078D4'}, {id:'wallapop',label:'Wallapop',emoji:'W',bg:'#13C1AC'},
 {id:'yahoo_mail',label:'Yahoo Mail',emoji:'Y!',bg:'#6001D2'}, {id:'x_twitter',label:'X / Twitter',emoji:'𝕏',bg:'#000'}, {id:'googlephotos',label:'Google Photos',emoji:'✹',bg:'#4285F4'}, {id:'googledrive2',label:'Google Drive',emoji:'▶',bg:'#0F9D58'},
 {id:'chrome',label:'Chrome',emoji:'🌐',bg:'#4285F4'}, {id:'safari',label:'Safari',emoji:'🧭',bg:'#0A84FF'}, {id:'firefox',label:'Firefox',emoji:'🦊',bg:'#FF7139'}, {id:'edge',label:'Edge',emoji:'🌊',bg:'#0078D7'},
 {id:'opera',label:'Opera',emoji:'O',bg:'#FF1B2D'}, {id:'proton',label:'Proton',emoji:'✉️',bg:'#6D4AFF'}, {id:'icloud',label:'iCloud',emoji:'☁️',bg:'#0A84FF'}, {id:'yahoo',label:'Yahoo',emoji:'Y!',bg:'#6001D2'},
 {id:'bank_es',label:'Banco España',emoji:'🏦',bg:'#0f3b70'}, {id:'bbva',label:'BBVA',emoji:'B',bg:'#004481'}, {id:'santander',label:'Santander',emoji:'S',bg:'#EC0000'}, {id:'caixa',label:'CaixaBank',emoji:'★',bg:'#0066A1'},
 {id:'ing',label:'ING',emoji:'ING',bg:'#FF6200'}, {id:'revolut',label:'Revolut',emoji:'R',bg:'#191C1F'}, {id:'wise',label:'Wise',emoji:'W',bg:'#9FE870'}, {id:'n26',label:'N26',emoji:'N26',bg:'#48AC98'},
 {id:'banesco',label:'Banesco',emoji:'B',bg:'#00853E'}, {id:'mercantil',label:'Mercantil',emoji:'M',bg:'#005BAC'}, {id:'bancovenezuela',label:'Banco Venezuela',emoji:'BV',bg:'#B91C1C'}, {id:'zelle',label:'Zelle',emoji:'Z',bg:'#6D1ED4'},
 {id:'coinbase',label:'Coinbase',emoji:'C',bg:'#0052FF'}, {id:'kraken',label:'Kraken',emoji:'K',bg:'#5841D8'}, {id:'metamask',label:'MetaMask',emoji:'🦊',bg:'#F6851B'}, {id:'trustwallet',label:'Trust Wallet',emoji:'🛡️',bg:'#3375BB'},
 {id:'chatgpt',label:'ChatGPT',emoji:'◎',bg:'#10A37F'}, {id:'openai',label:'OpenAI',emoji:'AI',bg:'#111827'}, {id:'claude',label:'Claude',emoji:'C',bg:'#D97757'}, {id:'gemini',label:'Gemini',emoji:'✦',bg:'#4285F4'},
 {id:'datadog',label:'Datadog',emoji:'DD',bg:'#632CA6'}, {id:'github2',label:'GitHub 2',emoji:'GH',bg:'#24292F'}, {id:'gitlab',label:'GitLab',emoji:'🦊',bg:'#FC6D26'}, {id:'bitbucket',label:'Bitbucket',emoji:'B',bg:'#0052CC'},
 {id:'netlify',label:'Netlify',emoji:'N',bg:'#00C7B7'}, {id:'vercel',label:'Vercel',emoji:'▲',bg:'#000000'}, {id:'wordpress',label:'WordPress',emoji:'W',bg:'#21759B'}, {id:'shopify',label:'Shopify',emoji:'S',bg:'#7AB55C'},
 {id:'canva',label:'Canva',emoji:'C',bg:'#00C4CC'}, {id:'figma',label:'Figma',emoji:'F',bg:'#A259FF'}, {id:'adobe',label:'Adobe',emoji:'A',bg:'#FF0000'}, {id:'notion',label:'Notion',emoji:'N',bg:'#111827'},
 {id:'trello',label:'Trello',emoji:'T',bg:'#0079BF'}, {id:'slack',label:'Slack',emoji:'#',bg:'#4A154B'}, {id:'zoom',label:'Zoom',emoji:'Z',bg:'#2D8CFF'}, {id:'meet',label:'Google Meet',emoji:'🎥',bg:'#00897B'},
 {id:'uber',label:'Uber',emoji:'U',bg:'#000000'}, {id:'airbnb',label:'Airbnb',emoji:'A',bg:'#FF5A5F'}, {id:'booking',label:'Booking',emoji:'B',bg:'#003B95'}, {id:'ryanair',label:'Ryanair',emoji:'✈️',bg:'#073590'},
 {id:'shein',label:'Shein',emoji:'S',bg:'#111827'}, {id:'temu',label:'Temu',emoji:'T',bg:'#F97316'}, {id:'ebay',label:'eBay',emoji:'e',bg:'#86B817'}, {id:'etsy',label:'Etsy',emoji:'E',bg:'#F1641E'},
 {id:'playstation',label:'PlayStation',emoji:'PS',bg:'#003791'}, {id:'xbox',label:'Xbox',emoji:'X',bg:'#107C10'}, {id:'epic',label:'Epic Games',emoji:'E',bg:'#313131'}, {id:'riot',label:'Riot',emoji:'R',bg:'#D13639'},
 {id:'disney',label:'Disney+',emoji:'D+',bg:'#113CCF'}, {id:'primevideo',label:'Prime Video',emoji:'PV',bg:'#00A8E1'}, {id:'hbo',label:'HBO Max',emoji:'HBO',bg:'#5A31F4'}, {id:'tiktok2',label:'TikTok 2',emoji:'♪',bg:'#010101'},
 {id:'phone',label:'Teléfono',emoji:'📱',bg:'#0ea5e9'}, {id:'pin',label:'PIN',emoji:'•••',bg:'#334155'}, {id:'license',label:'Licencia',emoji:'📄',bg:'#475569'}, {id:'server',label:'Servidor',emoji:'🖥️',bg:'#2563eb'},
 {id:'database',label:'Base de datos',emoji:'🗄️',bg:'#0f766e'}, {id:'router',label:'Router',emoji:'📡',bg:'#7c3aed'}, {id:'camera',label:'Cámara',emoji:'📷',bg:'#db2777'}, {id:'alarm',label:'Alarma',emoji:'🚨',bg:'#dc2626'},
 {id:'insurance',label:'Seguro',emoji:'🛡️',bg:'#0a84ff'}, {id:'tax',label:'Impuestos',emoji:'🧾',bg:'#ca8a04'}, {id:'medical',label:'Médico',emoji:'⚕️',bg:'#dc2626'}, {id:'family',label:'Familia',emoji:'👨‍👩‍👧',bg:'#16a34a'},
 // ── Redes sociales ──
 {id:'pinterest',label:'Pinterest',emoji:'P',bg:'#E60023'},
 {id:'snapchat',label:'Snapchat',emoji:'👻',bg:'#FFFC00'},
 {id:'threads',label:'Threads',emoji:'@',bg:'#000000'},
 {id:'bluesky',label:'Bluesky',emoji:'🦋',bg:'#0085FF'},
 {id:'mastodon',label:'Mastodon',emoji:'🐘',bg:'#6364FF'},
 {id:'bereal',label:'BeReal',emoji:'BR',bg:'#000000'},
 {id:'tumblr',label:'Tumblr',emoji:'t',bg:'#35465C'},
 {id:'vimeo',label:'Vimeo',emoji:'V',bg:'#1AB7EA'},
 {id:'flickr',label:'Flickr',emoji:'f',bg:'#FF0084'},
 {id:'quora',label:'Quora',emoji:'Q',bg:'#B92B27'},
 {id:'medium',label:'Medium',emoji:'M',bg:'#000000'},
 {id:'devto',label:'Dev.to',emoji:'DEV',bg:'#0A0A0A'},
 // ── Bancos España / Europa ──
 {id:'sabadell',label:'Sabadell',emoji:'S',bg:'#007ABF'},
 {id:'bankinter',label:'Bankinter',emoji:'bk',bg:'#FF6600'},
 {id:'unicaja',label:'Unicaja',emoji:'U',bg:'#004A99'},
 {id:'kutxabank',label:'Kutxabank',emoji:'K',bg:'#E30613'},
 {id:'abanca',label:'Abanca',emoji:'A',bg:'#009B3A'},
 {id:'monzo',label:'Monzo',emoji:'M',bg:'#FF4F64'},
 {id:'starling',label:'Starling',emoji:'S',bg:'#6935D3'},
 {id:'bunq',label:'Bunq',emoji:'b',bg:'#00A0DF'},
 {id:'bizum',label:'Bizum',emoji:'Bz',bg:'#0073CE'},
 {id:'stripe',label:'Stripe',emoji:'S',bg:'#635BFF'},
 {id:'klarna',label:'Klarna',emoji:'K',bg:'#FFB3C7'},
 {id:'transferwise',label:'TransferWise',emoji:'TW',bg:'#9FE870'},
 {id:'cashapp',label:'Cash App',emoji:'$',bg:'#00D632'},
 {id:'venmo',label:'Venmo',emoji:'V',bg:'#008CFF'},
 // ── Crypto ampliado ──
 {id:'ethereum',label:'Ethereum',emoji:'Ξ',bg:'#627EEA'},
 {id:'ledger',label:'Ledger',emoji:'L',bg:'#000000'},
 {id:'phantom',label:'Phantom',emoji:'👻',bg:'#AB9FF2'},
 {id:'kucoin',label:'KuCoin',emoji:'KCS',bg:'#23AF91'},
 {id:'bybit',label:'Bybit',emoji:'B',bg:'#F7A600'},
 {id:'okx',label:'OKX',emoji:'OKX',bg:'#000000'},
 // ── Streaming / Entretenimiento ──
 {id:'appletv',label:'Apple TV+',emoji:'🍎',bg:'#000000'},
 {id:'crunchyroll',label:'Crunchyroll',emoji:'CR',bg:'#F47521'},
 {id:'plex',label:'Plex',emoji:'▶',bg:'#E5A00D'},
 {id:'dazn',label:'DAZN',emoji:'D',bg:'#F8FF00'},
 {id:'mubi',label:'MUBI',emoji:'M',bg:'#2C2C2C'},
 {id:'movistar',label:'Movistar+',emoji:'M+',bg:'#019DF4'},
 {id:'atresplayer',label:'Atresplayer',emoji:'A3',bg:'#E30613'},
 {id:'rtve',label:'RTVE Play',emoji:'RTVE',bg:'#0056A2'},
 {id:'filmin',label:'Filmin',emoji:'f',bg:'#FF6B35'},
 {id:'rakuten',label:'Rakuten TV',emoji:'R',bg:'#BF0000'},
 {id:'skyshowtime',label:'SkyShowtime',emoji:'Sky',bg:'#003DA5'},
 // ── Gaming ampliado ──
 {id:'steam',label:'Steam',emoji:'S',bg:'#1B2838'},
   {id:'nintendo',label:'Nintendo',emoji:'N',bg:'#E4000F'},
 {id:'gog',label:'GOG',emoji:'GOG',bg:'#5C2D91'},
 {id:'battlenet',label:'Battle.net',emoji:'B',bg:'#009AE4'},
 {id:'ea',label:'EA',emoji:'EA',bg:'#FF6600'},
 {id:'ubisoft',label:'Ubisoft',emoji:'U',bg:'#0070D1'},
 {id:'roblox',label:'Roblox',emoji:'R',bg:'#E53935'},
 {id:'minecraft',label:'Minecraft',emoji:'⛏',bg:'#4CAF50'},
 // ── Tecnología / Dev ──
 {id:'jira',label:'Jira',emoji:'J',bg:'#0052CC'},
 {id:'confluence',label:'Confluence',emoji:'C',bg:'#0052CC'},
 {id:'linear',label:'Linear',emoji:'L',bg:'#5E6AD2'},
 {id:'asana',label:'Asana',emoji:'A',bg:'#FC636B'},
 {id:'monday',label:'Monday',emoji:'M',bg:'#FF3D57'},
 {id:'clickup',label:'ClickUp',emoji:'C',bg:'#7B68EE'},
 {id:'salesforce',label:'Salesforce',emoji:'SF',bg:'#00A1E0'},
 {id:'hubspot',label:'HubSpot',emoji:'HS',bg:'#FF7A59'},
 {id:'airtable',label:'Airtable',emoji:'AT',bg:'#2D7FF9'},
 {id:'miro',label:'Miro',emoji:'M',bg:'#FFD02F'},
 {id:'loom',label:'Loom',emoji:'L',bg:'#625DF5'},
 {id:'intercom',label:'Intercom',emoji:'i',bg:'#1F8DED'},
 {id:'aws',label:'AWS',emoji:'AWS',bg:'#FF9900'},
 {id:'azure',label:'Azure',emoji:'Az',bg:'#0078D4'},
 {id:'gcloud',label:'Google Cloud',emoji:'GC',bg:'#4285F4'},
 {id:'docker',label:'Docker',emoji:'🐳',bg:'#2496ED'},
 {id:'heroku',label:'Heroku',emoji:'H',bg:'#430098'},
 {id:'railway',label:'Railway',emoji:'R',bg:'#0B0D0E'},
 {id:'supabase',label:'Supabase',emoji:'S',bg:'#3ECF8E'},
 {id:'firebase',label:'Firebase',emoji:'🔥',bg:'#FFCA28'},
 {id:'mongodb',label:'MongoDB',emoji:'M',bg:'#47A248'},
 {id:'planetscale',label:'PlanetScale',emoji:'PS',bg:'#000000'},
 {id:'sentry',label:'Sentry',emoji:'S',bg:'#362D59'},
 {id:'postman',label:'Postman',emoji:'P',bg:'#FF6C37'},
 {id:'vscode',label:'VS Code',emoji:'</>',bg:'#007ACC'},
 // ── Compras / Retail ──
 {id:'zalando',label:'Zalando',emoji:'Z',bg:'#FF6900'},
 {id:'zara',label:'Zara',emoji:'Z',bg:'#000000'},
 {id:'hm',label:'H&M',emoji:'H&M',bg:'#CC0000'},
 {id:'ikea',label:'IKEA',emoji:'IKEA',bg:'#0058A3'},
 {id:'elcorteingles',label:'El Corte Inglés',emoji:'ECI',bg:'#006633'},
 {id:'fnac',label:'Fnac',emoji:'f',bg:'#F0A500'},
 {id:'mediamarkt',label:'MediaMarkt',emoji:'MM',bg:'#CC0000'},
 {id:'pccomponentes',label:'PcComponentes',emoji:'PC',bg:'#FF6600'},
 {id:'lidl',label:'Lidl',emoji:'L',bg:'#0050AA'},
 {id:'decathlon',label:'Decathlon',emoji:'D',bg:'#0082C8'},
 {id:'leroy',label:'Leroy Merlin',emoji:'LM',bg:'#78BE20'},
 {id:'wish',label:'Wish',emoji:'W',bg:'#2FB7EC'},
 {id:'vinted',label:'Vinted',emoji:'V',bg:'#09B1BA'},
 {id:'depop',label:'Depop',emoji:'D',bg:'#FF2300'},
 // ── Utilidades / Genéricos ──
 {id:'vpn',label:'VPN',emoji:'🔒',bg:'#0f766e'},
 {id:'ssh',label:'SSH',emoji:'SSH',bg:'#1e293b'},
 {id:'ftp',label:'FTP',emoji:'FTP',bg:'#334155'},
 {id:'nas',label:'NAS',emoji:'NAS',bg:'#2563eb'},
 {id:'token',label:'Token 2FA',emoji:'🔐',bg:'#7c3aed'},
 {id:'api',label:'API Key',emoji:'API',bg:'#0891b2'},
 {id:'printer',label:'Impresora',emoji:'🖨️',bg:'#475569'},
 {id:'smarttv',label:'Smart TV',emoji:'📺',bg:'#1e293b'},
 {id:'gym',label:'Gimnasio',emoji:'💪',bg:'#dc2626'},
 {id:'sport',label:'Deporte',emoji:'⚽',bg:'#16a34a'},
 {id:'pet',label:'Mascota',emoji:'🐾',bg:'#ca8a04'},
 {id:'bike',label:'Bicicleta',emoji:'🚴',bg:'#16a34a'},
 {id:'electric',label:'Electricidad',emoji:'⚡',bg:'#f59e0b'},
 {id:'gas',label:'Gas',emoji:'🔥',bg:'#f97316'},
 {id:'water',label:'Agua',emoji:'💧',bg:'#0284c7'},
 {id:'internet',label:'Internet',emoji:'🌐',bg:'#0ea5e9'},
 {id:'mobile',label:'Móvil/Tarifa',emoji:'📶',bg:'#7c3aed'},
 {id:'rent',label:'Alquiler',emoji:'🏘️',bg:'#475569'},
 {id:'mortgage',label:'Hipoteca',emoji:'🏠',bg:'#1d4ed8'},
 {id:'pension',label:'Pensión',emoji:'👴',bg:'#0f766e'},
 {id:'kids',label:'Niños',emoji:'👶',bg:'#db2777'},
 {id:'charity',label:'Donación',emoji:'❤️',bg:'#e11d48'}
);

// ============================================================
// VKICONS V3 — Sistema limpio. Un solo punto de verdad.
// ============================================================
function vkMakeIconSvg(bg,text,fontSize){
  const s=String(text||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  return {bg,type:'initials',svg:`<svg viewBox="0 0 48 48" width="48" height="48"><rect width="48" height="48" rx="12" fill="${bg}"/><text x="24" y="32" font-size="${fontSize||20}" font-weight="900" fill="#fff" text-anchor="middle" font-family="Arial,sans-serif">${s}</text></svg>`};
}
function vkInitials(label,id){
  const s=String(label||id||'').trim();
  const parts=s.split(/[\s\-_\/]+/).filter(Boolean);
  if(parts.length>=2)return(parts[0][0]+parts[1][0]).toUpperCase();
  return s.slice(0,2).toUpperCase()||'VK';
}
function vkFontSize(text){const l=String(text||'').length;return l>=4?13:l===3?16:l===2?20:24;}
function vkIsShield(v){return!v||!v.svg||String(v.bg||'').toLowerCase()==='#061a33';}
let vkIconMap=null;
const VK_ICON_VER='v4b';
function vkBuildIconMap(){
  if(vkIconMap&&window._vkIconVer===VK_ICON_VER)return;
  window._vkIconVer=VK_ICON_VER;
  vkIconMap={};
  // IDs que deben usar iniciales propias (no el icono genérico de banco de VK128)
  const FORCE_INITIALS=new Set(['bank','bank_es','bbva','santander','caixa','ing','revolut','wise','n26','banesco','mercantil','bancovenezuela','zelle','sabadell','bankinter','unicaja','kutxabank','abanca','monzo','starling','bunq','stripe','klarna','transferwise','cashapp','venmo','game','stream','shopping','apple','appletv']);
  const CUSTOM_TEXT={'bbva':'BBVA','santander':'SAN','caixa':'CX','ing':'ING','revolut':'REV','wise':'WISE','n26':'N26','banesco':'BAN','mercantil':'MER','bancovenezuela':'BdV','zelle':'ZL','sabadell':'SAB','bankinter':'BKI','unicaja':'UNI','kutxabank':'KUT','abanca':'ABA','monzo':'MON','starling':'STL','bunq':'BQ','stripe':'STR','klarna':'KL','transferwise':'TW','cashapp':'CA','venmo':'VM'};
  try{
    (MANUAL_ICONS||[]).forEach(function(ic){
      if(!ic||!ic.id||ic.id==='auto')return;
      // Forzar iniciales para IDs que matchean el icono genérico de banco
      if(FORCE_INITIALS.has(ic.id)){
        const customTxt=CUSTOM_TEXT[ic.id];
        const emoji=String(ic.emoji||'').trim();
        if(!customTxt&&emoji&&emoji.length<=4&&!/^[A-Za-z]+$/.test(emoji)){
          vkIconMap[ic.id]=vkMakeIconSvg(ic.bg||'#0a84ff',emoji,24);return;
        }
        const txt=customTxt||vkInitials(ic.label,ic.id);
        vkIconMap[ic.id]=vkMakeIconSvg(ic.bg||'#0a84ff',txt,vkFontSize(txt));return;
      }
      let v=serviceIcon(ic.id);
      if(!vkIsShield(v)){v.type='brand';vkIconMap[ic.id]=v;return;}
      v=serviceIcon(String(ic.label||'').toLowerCase());
      if(!vkIsShield(v)){v.type='brand';vkIconMap[ic.id]=v;return;}
      v=serviceIcon(ic.id+' '+(ic.label||''));
      if(!vkIsShield(v)){v.type='brand';vkIconMap[ic.id]=v;return;}
      const emoji=String(ic.emoji||'').trim();
      if(emoji&&emoji.length<=4&&!/^[A-Za-z]+$/.test(emoji)){
        vkIconMap[ic.id]=vkMakeIconSvg(ic.bg||'#0a84ff',emoji,24);return;
      }
      const txt=vkInitials(ic.label,ic.id);
      vkIconMap[ic.id]=vkMakeIconSvg(ic.bg||'#0a84ff',txt,vkFontSize(txt));
    });
    vkIconMap['auto']={bg:'#0a84ff',type:'brand',svg:'<svg viewBox="0 0 48 48" width="48" height="48"><rect width="48" height="48" rx="12" fill="#0a84ff"/><path d="M17 12l2 6 6 2-6 2-2 6-2-6-6-2 6-2zM31 21l1.5 4.5L37 27l-4.5 1.5L31 33l-1.5-4.5L25 27l4.5-1.5z" fill="#fff"/></svg>'};
  }catch(e){console.warn('vkBuildIconMap',e);}
}
function vkGetIcon(id,label,bg){
  vkBuildIconMap();
  if(id&&vkIconMap[id])return vkIconMap[id];
  if(label){const v=serviceIcon(String(label).toLowerCase());if(!vkIsShield(v))return v;}
  const useBg=bg||'#0a84ff';
  const txt=vkInitials(label||id||'VK',id);
  return vkMakeIconSvg(useBg,txt,vkFontSize(txt));
}function logoForIcon(ic){
  if(!ic)return vkGetIcon('','VK','#0a84ff');
  return vkGetIcon(ic.id,ic.label,ic.bg);
}
// ============================================================


let onboardStep=0;
function renderOnboarding(){document.querySelectorAll('.onboardSlide').forEach((x,i)=>x.classList.toggle('active',i===onboardStep));document.querySelectorAll('.onDot').forEach((x,i)=>x.classList.toggle('on',i===onboardStep));let b=$('onboardBtn');if(b)b.textContent=onboardStep>=3?'Comenzar':'Siguiente'}
function nextOnboarding(){if(onboardStep<4){onboardStep++;renderOnboarding();startOnboardAnim(onboardStep);return}finishOnboarding()}
function startOnboardAnim(step){
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789#@$!&*%';
  function randStr(len){let s='';for(let i=0;i<len;i++)s+=chars[Math.floor(Math.random()*chars.length)];return s;}
  if(step===1){
    const el=document.getElementById('obPassValue');
    const fill=document.getElementById('obStrengthFill');
    const lbl=document.getElementById('obStrengthLabel');
    const final='K#9mP$xL2@nQ8vR!';
    if(!el)return;
    el.style.opacity='1';
    let t=0;
    const iv=setInterval(()=>{
      t++;
      if(t<18)el.textContent=randStr(16);
      else{el.textContent=final;clearInterval(iv);
        if(fill){fill.style.transition='width 1s ease';fill.style.width='100%';}
        setTimeout(()=>{if(lbl){lbl.style.opacity='1';}},1000);
      }
    },80);
  }
  if(step===2){
    const e1=document.getElementById('obCipherEnc1');
    const e2=document.getElementById('obCipherEnc2');
    const badge=document.getElementById('obCipherBadge');
    const v1=document.getElementById('obCipherVal1');
    const v2=document.getElementById('obCipherVal2');
    if(!e1)return;
    let t=0;
    const iv=setInterval(()=>{
      t++;
      if(t<12){if(v1)v1.style.opacity=String(1-(t/14));}
      else{if(v1){v1.style.opacity='0';}
        if(e1){e1.textContent=randStr(12);e1.style.opacity='1';}
        if(t<24){if(v2)v2.style.opacity=String(1-((t-12)/14));}
        else{if(v2)v2.style.opacity='0';
          if(e2){e2.textContent=randStr(12);e2.style.opacity='1';}
          if(t>28){clearInterval(iv);if(badge)badge.style.opacity='1';}
        }
      }
    },80);
  }
  if(step===3){
    const checks=[
      document.getElementById('obCheck1'),
      document.getElementById('obCheck2'),
      document.getElementById('obCheck3')
    ];
    const badge=document.getElementById('obCheckBadge');
    checks.forEach((c,i)=>{
      if(!c)return;
      setTimeout(()=>{
        c.style.opacity='1';c.style.transition='opacity .4s';
        const ico=c.querySelector('.obCheckIco');
        setTimeout(()=>{if(ico)ico.textContent='✓';c.style.color='#2ee66f';},400);
      },i*700);
    });
    setTimeout(()=>{if(badge)badge.style.opacity='1';},2800);
  }
  if(step===4){
    const rows=document.querySelectorAll('.onboardSlide[data-step="4"] .obCheckRow');
    rows.forEach((c,i)=>{
      if(!c)return;
      setTimeout(()=>{
        c.style.opacity='1';c.style.transition='opacity .5s';
        const ico=c.querySelector('.obCheckIco');
        setTimeout(()=>{if(ico){ico.style.color='#00e5ff';}},400);
      },i*600);
    });
  }
}
function resetScreensForBoot(){
  document.querySelectorAll('.screen').forEach(s=>{
    s.classList.remove('active','slide-in-right','slide-in-left','slide-out-right','slide-out-left');
    s.style.display='none';
  });
}
function openOnboardingHard(){
  if(window.hideSplashHard) window.hideSplashHard();
  hidePrivacyOverlay&&hidePrivacyOverlay();
  resetScreensForBoot();
  const modal=$('onboardingModal');
  if(modal){ modal.classList.add('open'); modal.style.display='flex'; }
  // VK 2.0 — onboarding real
  if(typeof vkOnboarding !== 'undefined' && modal){
    let _obRoute={name:'welcome',path:'/welcome',params:{},meta:{root:true,placeholder:false},transitionMs:300};
    let _obCtx=null;
    function _obNav(path){
      const n=(path||'').split('/').filter(Boolean).join('-')||'welcome';
      _obRoute={name:n,path,params:{},meta:{root:n==='welcome'||n==='splash',placeholder:false},transitionMs:300};
      if(n==='dashboard'){
        // Boveda creada — cerrar modal y pedir desbloqueo (Fase 4 conecta vkUnlock)
        modal.classList.remove('open','vk2-onboarding'); modal.style.display='none';
        if(typeof _host!=='undefined'&&_host){_host.innerHTML='';_host.remove();}
        unlocked=false; pin='';
        initPin(); show('pin');
        return;
      }
      if(vkOnboarding.handlesRoute(n)) vkOnboarding.render(_obRoute,_host,_obCtx);
    }
    _obCtx={
      router:{navigate:_obNav,replace:_obNav,back:function(){_obNav('/welcome');},current:function(){return _obRoute;}},
      crypto:vkCrypto,
      store:vkStore,
      onCreated:function(s){
        modal.classList.remove('open','vk2-onboarding');
        modal.style.display='none';
        if(typeof _host!=='undefined'&&_host){_host.innerHTML='';_host.remove();}
        unlocked=false;
        pin='';
        if(s&&s.dekKey&&typeof window._vk2UnlockOk==='function'){
          window._vk2UnlockOk(s.dekKey);
          return;
        }
        initPin();
        show('pin');
      }
    };
    if(modal._obClick) modal.removeEventListener('click',modal._obClick);
    modal._obClick=function(e){const el=e.target.closest('[data-ob]');if(el)vkOnboarding.handleAction(el.getAttribute('data-ob'),_obCtx);};
    modal.addEventListener('click',modal._obClick);
    // VK2 layout host: aísla vkOnboarding del flex-column legacy
    modal.innerHTML='';
    let _host=document.createElement('div');
    _host.className='vk2-onboarding-host';
    modal.appendChild(_host);
    modal.classList.add('vk2-onboarding');
    _obNav('/welcome');
    return;
  }
  // Fallback legacy (vkOnboarding no disponible)
  onboardStep=0; renderOnboarding();
}
function finishOnboarding(){
  localStorage.setItem('vaultkey_onboarding_v130','1');
  const modal=$('onboardingModal');
  if(modal){modal.classList.remove('open');modal.style.display='none';}
  resetScreensForBoot();
  initPin();
  show('pin');
}
// serviceIcon — defined below after VK128_BRAND_ICONS (line ~1860)
// Stub so calls before the real definition don't throw
function serviceIcon(s){ return vk128Shield ? vk128Shield() : {bg:'#061a33',svg:''}; }
function esc(s=''){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
let _entryFav=false;
function toggleFavEntry(){_entryFav=!_entryFav;const btn=$('favToggleBtn');if(btn){btn.dataset.fav=String(_entryFav);}}
function openUrlModal(){$('urlModal')?.classList.add('open');}
function closeUrlModal(){$('urlModal')?.classList.remove('open');}
function openNoteModal(){$('noteModal')?.classList.add('open');}
function closeNoteModal(){$('noteModal')?.classList.remove('open');}
/* Icon strip - ordered by brand recognition */


function initIconStripDesktopScroll(){
  // Solo activar en PC — en móvil el carrusel paginado gestiona todo
  if(window.matchMedia('(pointer:coarse)').matches)return;
  const strip=document.getElementById('iconStripRow');
  if(!strip || strip.dataset.pcScrollReady==='1')return;
  strip.dataset.pcScrollReady='1';

  // PC-friendly: mouse wheel scrolls the horizontal icon strip.
  strip.addEventListener('wheel',function(e){
    if(Math.abs(e.deltaY)>Math.abs(e.deltaX)){
      e.preventDefault();
      strip.scrollLeft += e.deltaY;
    }
  },{passive:false});

  // PC-friendly: allow both click selection and drag-scroll.
  // Important: do NOT use pointer capture on the strip, because it can steal
  // the final click from the icon button on desktop browsers.
  let down=false,startX=0,startScroll=0,moved=false;
  strip.addEventListener('pointerdown',function(e){
    if(e.button!==0)return;
    down=true;moved=false;startX=e.clientX;startScroll=strip.scrollLeft;
    strip.classList.add('dragging');
  });
  strip.addEventListener('pointermove',function(e){
    if(!down)return;
    const dx=e.clientX-startX;
    if(Math.abs(dx)>6){
      moved=true;
      strip.scrollLeft=startScroll-dx;
    }
  });
  function endDrag(){down=false;strip.classList.remove('dragging');}
  strip.addEventListener('pointerup',endDrag);
  strip.addEventListener('pointercancel',endDrag);
  strip.addEventListener('pointerleave',endDrag);
}

function initIconStripClickHandler(){
  const strip=document.getElementById('iconStripRow');
  if(!strip || strip.dataset.clickReady==='1')return;
  strip.dataset.clickReady='1';
  let moved=false;
  strip.addEventListener('pointermove',function(e){
    if(Math.abs((e.clientX||0))>6) moved=true;
  });
  strip.addEventListener('pointerdown',function(){moved=false;});
  strip.addEventListener('click',function(e){
    const btn=e.target.closest&&e.target.closest('.vkStripIconBtn');
    if(!btn || !strip.contains(btn))return;
    if(moved){e.preventDefault();e.stopPropagation();moved=false;return;}
    const iconId=btn.getAttribute('data-icon');
    if(iconId){
      e.preventDefault();
      e.stopPropagation();
      selectEntryIcon(iconId);
      renderIconStrip();
    }
  },true);
}

function renderIconStrip(){
  const strip=$('iconStripRow');
  if(!strip)return;
  initIconStripDesktopScroll();
  initIconStripClickHandler();
  vkBuildIconMap();
  const q=normService($('eIconSearch')?.value||'');
  let list=(MANUAL_ICONS||[]).filter(ic=>ic&&ic.id);
  if(!q){
    const pri=['auto','gmail','google','facebook','instagram','whatsapp','telegram','youtube','netflix','spotify','amazon','paypal','github','discord','linkedin','x','microsoft','apple','chatgpt','bank','bbva','santander','caixa','ing','tiktok','revolut','wise','binance','coinbase','wifi','cloud','card','shopping','work','vpn','token','safe','zelle','stripe','outlook','yahoo','drive','dropbox','chrome','safari','firefox','twitch','reddit','pinterest','snapchat','signal'];
    const priSet=new Set(pri);
    list=[...pri.map(id=>list.find(ic=>ic.id===id)).filter(Boolean),...list.filter(ic=>!priSet.has(ic.id))].slice(0,120);
  }else{
    list=list.filter(ic=>[ic.id,ic.label,ic.emoji||''].join(' ').toLowerCase().includes(q)).slice(0,120);
    if(!list.length)list=[{id:'custom',label:$('eIconSearch')?.value||'Servicio',bg:'#0a84ff'}];
  }
  strip.innerHTML=list.map(ic=>{
    const active=(selectedEntryIcon||'auto')===ic.id;
    const obj=vkGetIcon(ic.id,ic.label,ic.bg);
    const dataIcon=safeEsc(String(ic.id||''));
    const svgStr=obj.svg.replace(/<svg ([^>]*?)width="[^"]*"\s*/g,'<svg $1').replace(/<svg ([^>]*?)height="[^"]*"\s*/g,'<svg $1').replace(/<svg /g,'<svg style="width:100%;height:100%;display:block" ');
    return `<button type="button" class="vkStripIconBtn ${active?'active':''}" data-icon="${dataIcon}" title="${safeEsc(ic.label||ic.id)}">${svgStr}</button>`;
  }).join('');
  // After rendering, re-init paged carousel
  if(typeof initIconPagedCarousel==='function') initIconPagedCarousel();
}function updateEntryIconPreview(){renderIconStrip();}

function initIconPagedCarousel(){
  const row=document.getElementById('iconStripRow');
  if(!row)return;

  // Reset on each renderIconStrip call so new icons are paginated
  row.dataset.vkIconCarouselReady='0';

  if(row.dataset.vkIconCarouselReady==='1') return;
  row.dataset.vkIconCarouselReady='1';

  let currentPage=0;
  const PER_PAGE=6;

  const btns=()=>[...row.children].filter(el=>el.nodeType===1);

  function pages(){
    const list=btns();
    const out=[];
    for(let i=0;i<list.length;i+=PER_PAGE) out.push(list.slice(i,i+PER_PAGE));
    return out;
  }

  function activePageIndex(allPages){
    const active=row.querySelector('.active');
    if(!active)return -1;
    return allPages.findIndex(p=>p.includes(active));
  }

  function renderIconPage(forceActive=false){
    const allPages=pages();
    if(!allPages.length)return;

    if(forceActive){
      const idx=activePageIndex(allPages);
      if(idx>=0)currentPage=idx;
    }

    currentPage=Math.max(0,Math.min(currentPage,allPages.length-1));
    const visible=new Set(allPages[currentPage]);

    btns().forEach(btn=>{
      btn.style.display=visible.has(btn)?'':'none';
      btn.style.flex='0 0 auto';
    });

    row.dataset.iconPage=String(currentPage+1);
    row.dataset.iconPages=String(allPages.length);
  }

  function pageBy(delta){
    const allPages=pages();
    if(allPages.length<=1)return;
    const next=Math.max(0,Math.min(currentPage+delta,allPages.length-1));
    if(next===currentPage)return;
    currentPage=next;
    renderIconPage();
  }

  window.renderIconPage=renderIconPage;
  window.pageBy=pageBy;

  // Wheel
  row.addEventListener('wheel',e=>{
    const allPages=pages();
    if(allPages.length<=1)return;
    const delta=Math.abs(e.deltaY)>=Math.abs(e.deltaX)?e.deltaY:e.deltaX;
    if(Math.abs(delta)<8)return;
    e.preventDefault();
    pageBy(delta>0?1:-1);
  },{passive:false});

  // Swipe/drag
  let startX=0,dragging=false;
  row.addEventListener('pointerdown',e=>{
    const allPages=pages();
    if(allPages.length<=1)return;
    dragging=true;
    startX=e.clientX;
    row.setPointerCapture?.(e.pointerId);
  });
  row.addEventListener('pointermove',e=>{
    if(!dragging)return;
    if(Math.abs(e.clientX-startX)>10) row.dataset.dragging='1';
  });
  row.addEventListener('pointerup',e=>{
    if(!dragging)return;
    dragging=false;
    row.releasePointerCapture?.(e.pointerId);
    const dx=e.clientX-startX;
    if(Math.abs(dx)>25){
      pageBy(dx<0?1:-1);
      setTimeout(()=>{delete row.dataset.dragging;},120);
    }
  });
  row.addEventListener('pointercancel',()=>{dragging=false;});

  // Click on icon — keep selection, re-render to show active page
  row.addEventListener('click',e=>{
    if(row.dataset.dragging==='1'){e.preventDefault();e.stopPropagation();return;}
    setTimeout(()=>renderIconPage(true),0);
  },true);

  // Keyboard
  row.setAttribute('tabindex','0');
  row.addEventListener('keydown',e=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
    e.preventDefault();
    const allPages=pages();
    if(e.key==='Home'){currentPage=0;renderIconPage();return;}
    if(e.key==='End'){currentPage=Math.max(0,allPages.length-1);renderIconPage();return;}
    if(e.key==='ArrowRight')pageBy(1);
    if(e.key==='ArrowLeft')pageBy(-1);
  });

  renderIconPage(true);
}
$('ePass')?.addEventListener('input',updateStrength);

// Vibración al enfocar campos del formulario de entrada
['eService','eUser','eEmail','ePass'].forEach(id=>{
  document.getElementById(id)?.addEventListener('focus',()=>vibe(15));
});

// Vibración en botones de acción de entradas
document.getElementById('entryModal')?.addEventListener('click',e=>{
  const btn=e.target.closest('button');
  if(btn && !btn.classList.contains('key')) vibe(20);
},true);
function score(p=''){let s=0;if(p.length>=6)s++;if(p.length>=8)s++;if(p.length>=14)s++;if(/[A-Z]/.test(p)&&/[a-z]/.test(p))s++;if(/\d/.test(p))s++;if(/[^A-Za-z0-9]/.test(p))s++;return Math.min(s,5)}
function updateStrength(){let p=$('ePass').value,s=score(p),w=s*20;$('strBar').style.width=w+'%';$('strBar').style.background=s<2?'var(--red)':s<5?'var(--yellow)':'var(--green)';$('strTxt').textContent=!p?'Mínimo 6 caracteres. Se permite guardar PIN y códigos cortos.':p.length<6?'Demasiado corta: mínimo 6 caracteres':p.length<8?'Débil, pero permitida':'Buena'}
function isValidEmail(v){return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v||'').trim())}
function toggleQvPass(){let el=$('qvPass');el.textContent=el.textContent.startsWith('•')?current.pass:'••••••••••••'}
function toggleQvNote(){const el=$('qvNote');if(!el)return;if(el.textContent==='••••••••'){el.textContent=current.note;el.style.whiteSpace='pre-wrap';el.style.fontSize='14px';el.style.lineHeight='1.6';}else{el.textContent='••••••••';el.style.whiteSpace='';el.style.fontSize='';el.style.lineHeight='';}}

function toggleQvCard(){const el=$('qvCardNum');if(!el)return;if(el.textContent.includes('•')){el.textContent=current.cardNumber;}else{el.textContent='•••• •••• •••• '+current.cardNumber.slice(-4);}}
function toggleQvCvv(){const el=$('qvCvv');if(!el)return;el.textContent=el.textContent==='•••'?current.cardCvv:'•••';}
function toggleQvWifiPass(){const el=$('qvWifiPass');if(!el)return;el.textContent=el.textContent==='••••••••'?current.wifiPass:'••••••••';}
async function toggleFav(id){let e=vault.find(x=>x.id===id);if(e){const _prevFav=e.fav;e.fav=!e.fav;try{await persist();closeModals();render();toast('Actualizado')}catch(err){e.fav=_prevFav;console.error('toggleFav:',err);toast('No se pudo actualizar','err')}}}
async function delEntry(id){vibe([40,20,40]);soundDelete();if(await vkConfirm('Eliminar entrada','¿Eliminar esta entrada de la bóveda?')){const _delIdx=vault.findIndex(e=>e.id===id);if(_delIdx===-1)return;const _delEntry=vault[_delIdx];vault.splice(_delIdx,1);try{await persist();closeModals();render();toast('Entrada eliminada');try{driveAutoSync();}catch(e){}}catch(err){vault.splice(_delIdx,0,_delEntry);console.error('delEntry:',err);toast('No se pudo eliminar la entrada','err')}}}
function copyText(t='',btn=null){
  navigator.clipboard?.writeText(t).then(()=>{
    vibe(35);soundCopy();
    scheduleClipboardClear(t);
    if(btn){
      const orig=btn.textContent;
      btn.textContent='✓';
      btn.style.background='linear-gradient(135deg,#16a34a,#22c55e)';
      btn.style.color='#fff';
      setTimeout(()=>{btn.textContent=orig;btn.style.background='';btn.style.color='';},1800);
    } else {
      toast('✓ Copiado');
    }
  }).catch(()=>toast('No se pudo copiar'))
}
function scheduleClipboardClear(value){setTimeout(async()=>{try{const txt=await navigator.clipboard.readText?.();if(txt===value)await navigator.clipboard.writeText('');}catch(e){}},30000)}
function openUrl(u){vibe(20);if(!/^https?:\/\//.test(u))u='https://'+u;if(/VaultKeyWebViewPrototype\//.test(navigator.userAgent||'')){window.location.href=u}else{window.open(u,'_blank','noopener')}}
function openGen(target=false,targetField='ePass'){useGenTarget=target;window._genTargetField=targetField;$('genModal').classList.add('open');syncRanges(false);if($('genOut').textContent==='Pulsa generar')markGeneratorDirty()}
function markGeneratorDirty(){syncRanges(false);$('genOut').textContent='Pulsa generar';}
function generatePass(){
  vibe(40);soundGen();
  syncRanges();
  // Modo PIN numérico
  if($('gPinMode')?.checked){
    const plen=Math.max(4,Math.min(12,+$('gLen').value||6));
    $('gLen').value=plen;
    let pin='';const nu='0123456789';
    const arr=new Uint32Array(plen);
    crypto.getRandomValues(arr);
    arr.forEach(v=>pin+=nu[v%10]);
    $('genOut').textContent=pin;
    $('genOut').className='genOut';
    return;
  }
  let up='ABCDEFGHIJKLMNOPQRSTUVWXYZ',lo='abcdefghijklmnopqrstuvwxyz',nu='0123456789',sy=($('gSymbols')?.value||'!@#$%&*-_+=?/');
  if($('gNoSimilar')?.checked){up=up.replace(/[IO]/g,'');lo=lo.replace(/[lo]/g,'');nu=nu.replace(/[01]/g,'')}
  let len=Math.max(6,Math.min(64,+$('gLen').value||12));
  $('gLen').value=len;
  let counts={up:+$('gUpper').value||0,lo:+$('gLower').value||0,nu:+$('gNum').value||0,sy:+$('gSym').value||0};
  if(!sy) counts.sy=0;
  let total=counts.up+counts.lo+counts.nu+counts.sy;
  const order=['sy','nu','lo','up'];
  for(const k of order){while(total>len && counts[k]>0){counts[k]--;total--;}}
  $('gUpper').value=counts.up;$('gLower').value=counts.lo;$('gNum').value=counts.nu;$('gSym').value=counts.sy;syncRanges();

  const cryptoRand=(max)=>{
    if(max<=0)return 0;
    const a=new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0]%max;
  };
  const pick=(set)=>set[cryptoRand(set.length)];
  let arr=[];
  const add=(set,n)=>{for(let i=0;i<n;i++)arr.push(pick(set));};

  let selected='';
  if(counts.up>0)selected+=up;
  if(counts.lo>0)selected+=lo;
  if(counts.nu>0)selected+=nu;
  if(counts.sy>0)selected+=sy;
  if(!selected)selected=up+lo+nu;

  if($('gExact')?.checked){
    add(up,counts.up);add(lo,counts.lo);add(nu,counts.nu);add(sy,counts.sy);
    while(arr.length<len)arr.push(pick(selected));
  }else{
    for(let i=0;i<len;i++)arr.push(pick(selected));
  }

  arr=arr.sort(()=>cryptoRand(1000000)/1000000-.5);
  $('genOut').textContent=arr.join('');
}

function useGen(){
  vibe(35);
  let v=$('genOut').textContent;
  if(!v || v==='Pulsa generar'){generatePass();v=$('genOut').textContent;}
  if(useGenTarget){
    const fieldId=window._genTargetField||'ePass';
    const el=$(fieldId);
    if(el){el.value=v;if(fieldId==='ePass')updateStrength();}
    $('genModal').classList.remove('open');
    if(fieldId==='vkPasswordCreateSecret'){
      _passwordCreateGenerated=true;
      show('passwordCreate');
      toast('Contraseña añadida');
    }else if(fieldId==='passwordEditNewSecret'){
      const input=$('passwordEditNewSecret');
      if(input)input.type='password';
      $('passwordEditNewEyeOpen')?.classList.remove('vk-password-edit-hidden');
      $('passwordEditNewEyeOff')?.classList.add('vk-password-edit-hidden');
      toast('Nueva contraseña añadida');
    }else{
      $('entryModal').classList.add('open');
      toast('Contraseña añadida a la entrada');
    }
  }else{
    closeModals();
    openEntry();
    $('ePass').value=v;updateStrength();
    toast('Ahora completa servicio y usuario, luego Guardar');
  }
}
async function saveBackupFile(fileName, content, mimeType) {
  if(window.VaultKeyAndroid&&typeof window.VaultKeyAndroid.saveLocalBackup==='function'){
    window._vkLocalBackupPickerOpen=true;
    window._vkLocalBackupPickerGraceUntil=0;
    const saved=await new Promise((resolve)=>{
      window.__vaultKeyLocalBackupResult=(ok,message)=>{
        delete window.__vaultKeyLocalBackupResult;
        window._vkLocalBackupPickerOpen=false;
        window._vkLocalBackupPickerGraceUntil=Date.now()+500;
        resolve({ok:Boolean(ok),message:String(message||'')});
      };
      try{
        window.VaultKeyAndroid.saveLocalBackup(fileName,content);
      }catch(error){
        delete window.__vaultKeyLocalBackupResult;
        window._vkLocalBackupPickerOpen=false;
        window._vkLocalBackupPickerGraceUntil=Date.now()+500;
        resolve({ok:false,message:error&&error.message?String(error.message):'No se pudo abrir el selector de copia local'});
      }
    });
    if(!saved.ok){
      if(saved.message==='Guardado cancelado') return false;
      throw new Error(saved.message||'No se pudo guardar la copia local');
    }
    return true;
  }

  const fileBlob=new Blob([content],{type:mimeType||'application/octet-stream'});
  const url=URL.createObjectURL(fileBlob);
  const a=document.createElement('a');
  a.href=url;
  a.download=fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function(){URL.revokeObjectURL(url);},1000);
  return true;
}

async function exportBackup(){
  if(typeof vkStore!=='undefined'&&vkStore.hasVault()){
    try{
      if(typeof vkBackup==='undefined'||typeof vkBackup.createEnvelope!=='function'){
        throw new Error('vkBackup.createEnvelope no esta disponible');
      }
      if(typeof vkAttachments==='undefined'||typeof vkAttachments.exportAll!=='function'){
        throw new Error('vkAttachments.exportAll no esta disponible');
      }

      const vk2Blob=vkStore.loadBlob();
      const attachments=await vkAttachments.exportAll();
      const now=Date.now();
      const date=new Date(now);
      const dd=String(date.getDate()).padStart(2,'0');
      const mm=String(date.getMonth()+1).padStart(2,'0');
      const yyyy=date.getFullYear();

      const data=vkBackup.createEnvelope({
        blob:vk2Blob,
        attachments:attachments,
        createdAt:new Date(now).toISOString()
      });

      const fileName='VaultKey_Backup_'+dd+mm+yyyy+'.vkbak';
      const content=JSON.stringify(data,null,2);
      if(!(await saveBackupFile(fileName,content,'application/octet-stream'))) return false;

      soundSuccess();
      toast('Respaldo local cifrado exportado correctamente','ok');
      return true;
    }catch(err){
      console.error('exportBackup VK2:',err);
      soundError();
      toast('No se pudo exportar el respaldo local','err');
      return false;
    }
  }

  let pack=localStorage.getItem(LS_DATA);
  if(!pack){
    vibe([30,30]);
    soundError();
    toast('No hay datos');
    return;
  }
  let data={
    app:'VaultKey',
    version:1,
    exported:Date.now(),
    payload:JSON.parse(pack)
  };
  try{
    const saved=await saveBackupFile(
      'VaultKey-respaldo-cifrado.json',
      JSON.stringify(data,null,2),
      'application/json'
    );
    if(!saved)return false;
  }catch(err){
    console.error('exportBackup legacy:',err);
    soundError();
    toast('No se pudo exportar el respaldo local','err');
    return false;
  }
  let m=meta();
  m.lastBackup=Date.now();
  localStorage.setItem(LS_META,JSON.stringify(m));
  render();
  soundSuccess();
  toast('Respaldo cifrado exportado. Solo se restaura con tu PIN');
  return true;
}

// ============================================================
// IMPORTACIÓN CON PANTALLA PROPIA
// ============================================================

let _restoreCredentialResolver = null;
let _restorePinResolver = null;

function normalizeRestoreCredentialInput(value) {
  const text = String(value || '').trim();
  const compact = text.replace(/[\s-]/g, '').toUpperCase();
  if (/^VK2[A-Z0-9]{26}$/.test(compact)) {
    return { kitCode: text };
  }
  return { master: text };
}

function setRestoreFieldVisibility(inputId, buttonId, visible) {
  const input = $(inputId);
  const button = $(buttonId);
  if (!input || !button) return;

  if (input.tagName === 'TEXTAREA') {
    input.style.webkitTextSecurity = visible ? 'none' : 'disc';
  } else {
    input.type = visible ? 'text' : 'password';
  }
  button.setAttribute('aria-pressed', visible ? 'true' : 'false');
  button.setAttribute('aria-label', (visible ? 'Ocultar ' : 'Mostrar ') +
    (inputId === 'restorePinInput' ? 'PIN' : 'contraseña maestra o kit'));
}

function bindRestoreVisibility(inputId, buttonId) {
  const input = $(inputId);
  const button = $(buttonId);
  if (!input || !button) return;
  setRestoreFieldVisibility(inputId, buttonId, false);
  button.hidden = !input.value;
  button.onclick = () => {
    const visible = button.getAttribute('aria-pressed') !== 'true';
    setRestoreFieldVisibility(inputId, buttonId, visible);
  };
}

function updateRestoreVisibilityButton(inputId, buttonId) {
  const input = $(inputId);
  const button = $(buttonId);
  if (!input || !button) return;
  const hasValue = input.value.length > 0;
  button.hidden = !hasValue;
  if (!hasValue) setRestoreFieldVisibility(inputId, buttonId, false);
}

function closeRestoreCredentialModal(value) {
  const modal = $('restoreCredentialModal');
  if (modal) modal.classList.remove('open');
  const input = $('restoreCredentialInput');
  if (input) input.value = '';
  setRestoreFieldVisibility('restoreCredentialInput', 'restoreCredentialVisibility', false);
  if (_restoreCredentialResolver) {
    const resolver = _restoreCredentialResolver;
    _restoreCredentialResolver = null;
    resolver(value);
  }
}

function openRestoreCredentialModal(options = {}) {
  return new Promise((resolve) => {
    _restoreCredentialResolver = resolve;
    const modal = $('restoreCredentialModal');
    const title = $('restoreCredentialTitle');
    const label = $('restoreCredentialLabel');
    const helper = $('restoreCredentialHelper');
    const input = $('restoreCredentialInput');
    const ok = $('restoreCredentialOk');
    const cancel = $('restoreCredentialCancel');
    bindRestoreVisibility('restoreCredentialInput', 'restoreCredentialVisibility');

    if (title) title.textContent = options.title || 'Restaurar copia';
    if (label) label.textContent = options.label || 'Contraseña maestra o kit';
    if (helper) helper.textContent = options.helper || 'Introduce tu contraseña maestra o kit de emergencia.';
    if (input) {
      if (input.tagName === 'TEXTAREA') {
        input.removeAttribute('type');
        input.rows = 2;
      } else {
        input.type = 'password';
      }
      input.setAttribute('value', '');
      input.value = '';
      input.placeholder = ' '; // el texto real lo muestra el <span> superpuesto en app.html, no el placeholder nativo
      input.autocomplete = 'new-password';
      input.oninput = () => {
        if (input.tagName === 'TEXTAREA') {
          input.value = input.value.replace(/\n/g, ' ');
        }
        updateRestoreVisibilityButton('restoreCredentialInput', 'restoreCredentialVisibility');
      };
      input.onkeydown = (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          if (ok) ok.click();
        } else if (event.key === 'Escape') {
          event.preventDefault();
          if (cancel) cancel.click();
        }
      };
    }

    const okDefaultText = options.confirmText || 'Restaurar';
    if (ok) ok.textContent = okDefaultText;
    if (cancel) cancel.textContent = options.cancelText || 'Cancelar';

    if (ok) ok.onclick = async () => {
      const raw = String(input && input.value || '').trim();
      if (!raw) {
        if (typeof toast === 'function') toast('Introduce tu contraseña maestra o kit de emergencia', 'err');
        if (input) input.focus();
        return;
      }

      // Si el llamador pide verificación (options.onValidate), se intenta
      // descifrar con la credencial antes de cerrar el modal. Si falla, el
      // modal se queda abierto con el error, sin llegar a pedir el PIN.
      if (typeof options.onValidate === 'function') {
        ok.disabled = true;
        ok.textContent = 'Verificando...';
        if (cancel) cancel.disabled = true;
        if (input) input.disabled = true;
        try {
          await options.onValidate(raw);
        } catch (err) {
          ok.disabled = false;
          ok.textContent = okDefaultText;
          if (cancel) cancel.disabled = false;
          if (input) { input.disabled = false; input.focus(); }
          const msg = (typeof vkBackup !== 'undefined' && typeof vkBackup.restoreErrorMessage === 'function')
            ? vkBackup.restoreErrorMessage(err)
            : 'Contraseña o kit incorrectos.';
          if (typeof toast === 'function') toast(msg, 'err');
          return;
        }
        ok.disabled = false;
        ok.textContent = okDefaultText;
        if (cancel) cancel.disabled = false;
        if (input) input.disabled = false;
      }

      closeRestoreCredentialModal(raw);
    };

    if (cancel) cancel.onclick = () => { if (!cancel.disabled) closeRestoreCredentialModal(null); };

    if (modal) {
      modal.classList.add('open');
      setTimeout(() => { if (input) input.focus(); }, 150);
    }
  });
}

function closeRestorePinModal(value) {
  const modal = $('restorePinModal');
  if (modal) modal.classList.remove('open');
  const input = $('restorePinInput');
  if (input) input.value = '';
  setRestoreFieldVisibility('restorePinInput', 'restorePinVisibility', false);
  if (_restorePinResolver) {
    const resolver = _restorePinResolver;
    _restorePinResolver = null;
    resolver(value);
  }
}

function openRestorePinModal(options = {}) {
  return new Promise((resolve) => {
    _restorePinResolver = resolve;
    const modal = $('restorePinModal');
    const title = $('restorePinTitle');
    const label = $('restorePinLabel');
    const helper = $('restorePinHelper');
    const input = $('restorePinInput');
    const ok = $('restorePinOk');
    const cancel = $('restorePinCancel');
    bindRestoreVisibility('restorePinInput', 'restorePinVisibility');

    if (title) title.textContent = options.title || 'PIN de restauración';
    if (label) label.textContent = options.label || 'PIN';
    if (helper) helper.textContent = options.helper || 'Debe tener 6 dígitos.';
    if (input) {
      input.type = 'password';
      input.setAttribute('value', '');
      input.value = '';
      input.placeholder = options.placeholder || 'Introduce 6 dígitos';
      input.autocomplete = 'new-password';
      input.oninput = () => {
        input.value = input.value.replace(/\D/g, '').slice(0, 6);
        updateRestoreVisibilityButton('restorePinInput', 'restorePinVisibility');
      };
      input.onkeydown = (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          if (ok) ok.click();
        } else if (event.key === 'Escape') {
          event.preventDefault();
          if (cancel) cancel.click();
        }
      };
    }

    if (ok) ok.textContent = options.confirmText || 'Restaurar';
    if (cancel) cancel.textContent = options.cancelText || 'Atrás';

    if (ok) ok.onclick = () => {
      const pin = String(input && input.value || '').replace(/\D/g, '').slice(0, 6);
      if (!/^\d{6}$/.test(pin)) {
        if (typeof toast === 'function') toast('Introduce un PIN de 6 dígitos', 'err');
        if (input) input.focus();
        return;
      }
      closeRestorePinModal(pin);
    };

    if (cancel) cancel.onclick = () => closeRestorePinModal(null);

    if (modal) {
      modal.classList.add('open');
      setTimeout(() => { if (input) input.focus(); }, 150);
    }
  });
}

window.normalizeRestoreCredentialInput = normalizeRestoreCredentialInput;
window.openRestoreCredentialModal = openRestoreCredentialModal;
window.openRestorePinModal = openRestorePinModal;
window.closeRestoreCredentialModal = closeRestoreCredentialModal;
window.closeRestorePinModal = closeRestorePinModal;

let _importFile = null;
let _importDecrypted = null;

function openImportModal(file) {
  if(!file) return;
  _importFile = file;
  _importDecrypted = null;
  // Reset UI
  document.getElementById('importStep1').style.display = '';
  document.getElementById('importStep2').style.display = 'none';
  document.getElementById('importPinError').style.display = 'none';
  document.getElementById('importPinInput').value = '';
  document.getElementById('importFileName').textContent = file.name || 'respaldo.json';
  document.getElementById('importFileInfo').textContent = 'Tamaño: ' + (file.size ? Math.round(file.size/1024*10)/10 + ' KB' : '—');
  const modal = document.getElementById('importModal');
  if(modal) { modal.classList.add('open'); setTimeout(()=>document.getElementById('importPinInput').focus(),300); }
}

function closeImportModal() {
  const modal = document.getElementById('importModal');
  if(modal) modal.classList.remove('open');
  _importFile = null;
  _importDecrypted = null;
}

async function doImportStep1() {
  const pinInput = document.getElementById('importPinInput');
  const pinErr = document.getElementById('importPinError');
  const pin = (pinInput.value || '').trim();
  
  if(!pin) { pinErr.textContent = '❌ Introduce el PIN'; pinErr.style.display = ''; return; }
  if(!_importFile) { closeImportModal(); return; }
  
  pinErr.style.display = 'none';
  const btn = document.querySelector('#importStep1 .btn');
  if(btn) { btn.textContent = 'Verificando...'; btn.disabled = true; }
  
  try {
    const text = await _importFile.text();
    const data = JSON.parse(text);
    if(!data.payload) throw new Error('Sin payload');
    
    const decrypted = await decryptData(data.payload, pin);
    if(!decrypted || !Array.isArray(decrypted)) throw new Error('PIN incorrecto');
    
    _importDecrypted = decrypted;
    const count = decrypted.length;
    const currentCount = vault ? vault.length : 0;
    const exported = data.exported ? esc(new Date(data.exported).toLocaleString('es-ES')) : 'Desconocida';
    
    // Show summary
    document.getElementById('importSummary').innerHTML = 
      `• Entradas en el respaldo: <b>${count}</b><br>` +
      `• Entradas actuales en tu bóveda: <b>${currentCount}</b><br>` +
      `• Fecha del respaldo: <b>${exported}</b>`;
    
    // Warning if current vault has entries
    const warn = document.getElementById('importWarning');
    const warnTxt = document.getElementById('importWarningText');
    if(currentCount > 0) {
      warnTxt.textContent = `Tienes ${currentCount} entrada${currentCount!==1?'s':''} actuales que serán reemplazadas por las ${count} del respaldo. Esta acción no se puede deshacer.`;
      warn.style.display = '';
    } else {
      warn.style.display = 'none';
    }
    
    document.getElementById('importStep1').style.display = 'none';
    document.getElementById('importStep2').style.display = '';
    
  } catch(e) {
    pinErr.textContent = '❌ PIN incorrecto o archivo inválido';
    pinErr.style.display = '';
    soundError(); vibe([40,30,40]);
  } finally {
    if(btn) { btn.textContent = 'Verificar respaldo'; btn.disabled = false; }
  }
}

function normalizeEntryId(id){
  const v=String(id||'').trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
    ? v
    : crypto.randomUUID();
}

async function doImportConfirm() {
  if(!_importDecrypted) { closeImportModal(); return; }
  const _prevVault = vault;
  try {
    vault = _importDecrypted.filter(e=>e&&typeof e==='object').map(e=>({
      id: normalizeEntryId(e.id),
      service: vk2EntryTitle(e),
      entryType: String(e.entryType||e.type||'password'),
      user: vk2EntryUser(e),
      email: String(e.email||''),
      pass: vk2EntryPass(e),
      url: vk2EntryUrl(e),
      note: vk2EntryNotes(e),
      category: String(e.category||'general'),
      fav: !!e.fav,
      used: Number(e.used||0),
      updated: Number(e.updated||0),
      passHistory: Array.isArray(e.passHistory)?e.passHistory:[],
      reminder: e.reminder||null,
      tags: Array.isArray(e.tags)?e.tags.filter(t=>typeof t==='string').slice(0,10):[],
      
      cardName: String(e.cardName||''),
      cardNumber: String(e.cardNumber||''),
      cardExpiry: String(e.cardExpiry||''),
      cardCvv: String(e.cardCvv||''),
      cardType: String(e.cardType||''),
      idName: String(e.idName||''), idNumber: String(e.idNumber||''), idDob: String(e.idDob||''),
      idExpiry: String(e.idExpiry||''), idCountry: String(e.idCountry||''), idType: String(e.idType||''),
      licName: String(e.licName||''), licNumber: String(e.licNumber||''), licIssued: String(e.licIssued||''),
      licExpiry: String(e.licExpiry||''), licCountry: String(e.licCountry||''), licCategory: String(e.licCategory||''),
      medName: String(e.medName||''), medSS: String(e.medSS||''), medBlood: String(e.medBlood||''),
      medAllergies: String(e.medAllergies||''), medMeds: String(e.medMeds||''),
      medDoctor: String(e.medDoctor||''), medNotes: String(e.medNotes||''),
      wifiSsid: String(e.wifiSsid||''), wifiPass: String(e.wifiPass||''),
      wifiSec: String(e.wifiSec||''), wifiRouter: String(e.wifiRouter||''), wifiIp: String(e.wifiIp||''),
        }));
    await persist();
    render();
    const count = vault.length;
    closeImportModal();
    soundSuccess(); vibe([30,20,60]);
    toast('✓ Respaldo importado — ' + count + ' entradas restauradas. Google Drive no se ha sincronizado.');
  } catch(e) {
    vault = _prevVault;
    soundError();
    toast('Error al importar el respaldo');
  }
}

async function importBackup(file) {
  if(!file) return;

  const maxBackupBytes=100*1024*1024;
  if(Number(file.size)>maxBackupBytes){
    toast('La copia supera el límite de 100 MB','err');
    return;
  }
  try {
    const raw = await file.text();
    const data = JSON.parse(raw);

    // VaultKey 2.0 backup con blob cifrado + adjuntos
    if(
      data &&
      data.app==='VaultKey' &&
      data.format==='vkbak' &&
      data.vaultFormat==='vk2_blob' &&
      data.vk2_blob &&
      typeof vkStore!=='undefined'
    ){
      if(typeof vkBackup==='undefined' || typeof vkBackup.restore!=='function'){
        throw new Error('vkBackup.restore no está disponible');
      }

      if(typeof vkStore.hasVault==='function' && vkStore.hasVault()){
        const ok = await vkConfirm(
          'Restaurar Boveda Vaultkey',
          'Se sustituirá la bóveda local actual por el respaldo elegido.',
          {variant:'drive-restore',confirmText:'Restaurar'}
        );
        if(!ok) return;
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
              await vkCrypto.openVaultBlob(data.vk2_blob, cred);
              credential = cred;
            }
          })
        : Promise.resolve(prompt('Introduce tu contraseña maestra o kit de emergencia:')));

      if (credentialText === null) {
        return;
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

      if (pin === null) {
        return;
      }

      if(!/^[0-9]{6}$/.test(pin)){
        throw new Error('El PIN de restauración debe tener 6 dígitos');
      }

      await vkBackup.restore(data, {
        credential,
        pin,
        store: vkStore,
        attachments: vkAttachments,
        crypto: vkCrypto
      });

      toast('✓ Respaldo VaultKey 2.0 restaurado. Google Drive no se ha sincronizado.','ok');
      if(typeof lock==='function') lock();
      return;
    }

    // Flujo legacy existente
    if(typeof vkStore!=='undefined'&&vkStore.hasVault()){
      toast('No puedes importar un respaldo legacy mientras tienes una bóveda VaultKey 2.0 activa.');
      return;
    }

    openImportModal(file);
  }catch(err){
    console.error('importBackup:',err);
    const msg=(typeof vkBackup!=='undefined'&&typeof vkBackup.restoreErrorMessage==='function')
      ?vkBackup.restoreErrorMessage(err)
      :'No se pudo importar el respaldo';
    toast(msg,'err');
  }
}


/* ============================================================
   Copias de seguridad — conecta la interfaz (Figma node-id
   578:533, 596:51, 596:74, 596:129, 596:145) con exportBackup()/
   importBackup()/openDriveSettings() ya existentes. No se ha
   tocado ninguna de esas tres funciones ni drive.js.
   ============================================================ */
window.openBackupSheet=function(){
  const modal=$('backupSheet');
  if(modal)modal.classList.add('open');
};

function renderBackupLocalStatus(){
  const text=$('backupLocalLastText');
  const check=$('backupLocalLastCheck');
  if(!text)return;
  const ts=Number(localStorage.getItem('vk_local_backup_last')||0);
  if(ts){
    text.textContent='Última copia: '+new Date(ts).toLocaleString('es-ES');
    if(check)check.hidden=false;
  }else{
    text.textContent='Todavía no has creado ninguna copia';
    if(check)check.hidden=true;
  }
}

window.openBackupLocalSettings=function(){
  closeModals();
  renderBackupLocalStatus();
  show('backupLocalSettings','right');
};

window.openBackupCreateModal=async function(){
  const ok=await vkConfirm(
    'Crear copia de seguridad',
    'Se creará una copia cifrada de tu bóveda.',
    {
      variant:'backup-create',
      confirmText:'Crear copia',
      msg2:'Guarda este archivo en un lugar seguro. Solo podrás restaurarlo con tu PIN.'
    }
  );
  if(!ok)return;
  const exported=await exportBackup();
  if(exported){
    localStorage.setItem('vk_local_backup_last',String(Date.now()));
    renderBackupLocalStatus();
  }
};

window.openBackupRestoreModal=async function(){
  const ok=await vkConfirm(
    'Restaurar copia',
    'La restauración reemplazará los datos actuales de VaultKey.',
    {
      variant:'backup-restore',
      confirmText:'Restaurar',
      msg2:'Asegúrate de tener una copia reciente antes de continuar.'
    }
  );
  if(!ok)return;
  const input=$('backupRestoreInput');
  if(input)input.click();
};

window.handleBackupRestoreFile=function(ev){
  const input=ev&&ev.target,file=input&&input.files&&input.files[0];
  if(!file)return;
  importBackup(file);
  input.value='';
};


function makeRecoveryCode(){const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let out='VK';for(let block=0;block<4;block++){out+='-';for(let i=0;i<4;i++){let a=new Uint32Array(1);crypto.getRandomValues(a);out+=chars[a[0]%chars.length]}}return out}
async function ensureRecoveryCode(){
  const raw=localStorage.getItem(LS_REC);
  if(!raw){const code=makeRecoveryCode();if(lastKey){const enc=await encryptRec(code,lastKey);localStorage.setItem(LS_REC,JSON.stringify(enc));}else{localStorage.setItem(LS_REC,JSON.stringify({plain:code}));}return code;}
  try{const parsed=JSON.parse(raw);
    if(parsed.plain){const code=parsed.plain;if(lastKey){const enc=await encryptRec(code,lastKey);localStorage.setItem(LS_REC,JSON.stringify(enc));}return code;}
    if(parsed.ct&&lastKey){return await decryptRec(parsed,lastKey)||'(error)';}
    if(parsed.ct&&!lastKey){return '(bloqueado)';}
  }catch{}
  if(lastKey){const enc=await encryptRec(raw,lastKey);localStorage.setItem(LS_REC,JSON.stringify(enc));return raw;}
  return raw;
}

function downloadRecoveryTxt(code){
  try{
    if(!code||code==='----')return;
    const BOM='\uFEFF';const text=BOM+'VaultKey - Código de recuperación\n\nCódigo: '+code+'\n\nGuarda este archivo fuera del móvil. Este código sirve para identificar tu bóveda si necesitas recuperar acceso.';const blob=new Blob([text],{type:'text/plain;charset=utf-8'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download='VaultKey-codigo-recuperacion.txt';
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  }catch(e){console.warn(e)}
}

async function showRecoveryCode(first=false){
  let code=await ensureRecoveryCode();
  document.querySelectorAll('.modal').forEach(m=>{if(m.id!=='recoveryModal')m.classList.remove('open')});
  $('recoveryText').textContent=code;
  const btn=$('recoveryCloseBtn');
  if(btn)btn.style.display=first?'none':'';
  $('recoveryModal').classList.add('open');
  if(first)toast('📋 Guarda este código como identificador de tu bóveda. Recuerda: sin tu PIN, las contraseñas no se pueden recuperar.');
}
async function regenerateRecoveryCode(){
  // VK 2.0: regenerar kit via vkKitManager
  if(typeof vkStore!=='undefined'&&vkStore.hasVault()&&typeof vkKitManager!=='undefined'){
    const m=prompt('Contraseña maestra para regenerar el kit:');
    if(!m)return;
    vkKitManager.regenerateKit({store:vkStore,crypto:vkCrypto,master:m})
      .then(function(r){prompt('Nuevo kit de emergencia (cópialo ahora):',r.kitCode);toast('Kit regenerado. El anterior ha quedado invalidado.');})
      .catch(function(){toast('Contraseña incorrecta o error al regenerar.');});
    return;
  }
  if(!lastKey)return;
  const ok=await vkConfirm('Regenerar código de recuperación','El código actual quedará inválido. Asegúrate de guardar el nuevo en un lugar seguro. ¿Continuar?');
  if(!ok)return;
  const code=makeRecoveryCode();
  const enc=await encryptRec(code,lastKey);
  localStorage.setItem(LS_REC,JSON.stringify(enc));
  localStorage.removeItem('vk_recovery_saved');
  await showRecoveryCode(true);
}
async function tryBio(){
  // Seguridad V2.3.1: no desbloquear la bóveda recuperando el PIN desde localStorage.
  toast('Biometría web desactivada por seguridad. Introduce tu PIN de VaultKey.');
}
/* Toque en la fila de versión → mostrar info de la bóveda */
(function(){
  function initCategoryPagedCarousel(){
  const row=document.getElementById('catFilterRow');
  if(!row)return;

  if(row.dataset.vkPagedCarouselReady==='1'){
    renderCategoryPage();
    return;
  }

  row.dataset.vkPagedCarouselReady='1';
  row.setAttribute('tabindex','0');
  row.setAttribute('aria-label','Carrusel de categorías');

  let currentPage=0;
  const PER_PAGE=4;

  const chips=()=>[...row.children].filter(el=>el.nodeType===1);

  function pages(){
    const list=chips();
    const out=[];
    for(let i=0;i<list.length;i+=PER_PAGE){
      out.push(list.slice(i,i+PER_PAGE));
    }
    return out;
  }

  function activeChip(){
    return row.querySelector('.active,.selected,[aria-pressed="true"]');
  }

  function activePageIndex(allPages){
    const active=activeChip();
    if(!active)return -1;
    return allPages.findIndex(page=>page.includes(active));
  }

  function renderCategoryPage(forceActive=false){
    const allPages=pages();
    if(!allPages.length)return;

    if(forceActive){
      const idx=activePageIndex(allPages);
      if(idx>=0)currentPage=idx;
    }

    currentPage=Math.max(0,Math.min(currentPage,allPages.length-1));

    const visible=new Set(allPages[currentPage]);

    chips().forEach(chip=>{
      chip.style.display=visible.has(chip)?'':'none';
      chip.style.flex='0 0 auto';
      if(!chip.hasAttribute('tabindex'))chip.setAttribute('tabindex','0');
    });

    row.dataset.catPage=String(currentPage+1);
    row.dataset.catPages=String(allPages.length);
  }

  function pageBy(delta){
    const allPages=pages();
    if(allPages.length<=1)return;

    const next=Math.max(0,Math.min(currentPage+delta,allPages.length-1));
    if(next===currentPage)return;

    currentPage=next;
    renderCategoryPage();
  }

    window.renderCategoryPage=renderCategoryPage;

  let startX=0,startY=0,dragging=false;
  let moved=false;
  let startChip=null;

  row.addEventListener('wheel',e=>{
    const allPages=pages();
    if(allPages.length<=1)return;

    const delta=Math.abs(e.deltaY)>=Math.abs(e.deltaX)?e.deltaY:e.deltaX;
    if(Math.abs(delta)<8)return;

    e.preventDefault();
    pageBy(delta>0?1:-1);
  },{passive:false});

  row.addEventListener('pointerdown', e => {
    dragging = true;
    moved = false;
    startX = e.clientX;
    startY = e.clientY;
    startChip = e.target.closest && e.target.closest('#catFilterRow .catChip');

    delete row.dataset.dragging;
    delete row.dataset.suppressClick;
  });

  row.addEventListener('pointermove', e => {
    if(!dragging) return;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    if(Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.2){
      moved = true;
      row.dataset.dragging = '1';
    }
  });

  row.addEventListener('pointerup', e => {
    if(!dragging) return;

    dragging = false;

    const dx = e.clientX - startX;

    if(!moved){
      delete row.dataset.dragging;

      if(startChip){
        e.preventDefault();
        e.stopPropagation();

        row.dataset.suppressClick = '1';
        setCatFilter(catFromChip(startChip), startChip);

        setTimeout(() => {
          delete row.dataset.suppressClick;
        }, 180);
      }

      startChip = null;
      return;
    }

    if(Math.abs(dx) > 35){
      pageBy(dx < 0 ? 1 : -1);
    }

    startChip = null;
    row.dataset.suppressClick = '1';

    setTimeout(() => {
      delete row.dataset.dragging;
      delete row.dataset.suppressClick;
    }, 180);
  });

  row.addEventListener('pointercancel', () => {
    dragging = false;
    startChip = null;
    delete row.dataset.dragging;

    row.dataset.suppressClick = '1';

    setTimeout(() => {
      delete row.dataset.suppressClick;
    }, 180);
  });

  row.addEventListener('click', e => {
    if(row.dataset.dragging === '1' || row.dataset.suppressClick === '1'){
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation?.();
      return;
    }

    const chip = e.target.closest && e.target.closest('#catFilterRow .catChip');
    if(chip){
      e.preventDefault();
      e.stopPropagation();
      setCatFilter(catFromChip(chip), chip);
    }
  }, true);
 
  row.addEventListener('pointerup', e => {
    if(!dragging) return;

    dragging = false;

    try{
      row.releasePointerCapture?.(e.pointerId);
    }catch(err){}

    if(!moved){
      delete row.dataset.dragging;
      return;
    }

    const dx = e.clientX - startX;

    if(Math.abs(dx) > 35){
      pageBy(dx < 0 ? 1 : -1);
    }

    row.dataset.suppressClick = '1';

    setTimeout(() => {
      delete row.dataset.dragging;
      delete row.dataset.suppressClick;
    }, 180);
  });

  row.addEventListener('pointercancel', () => {
    dragging = false;
    delete row.dataset.dragging;

    row.dataset.suppressClick = '1';

    setTimeout(() => {
      delete row.dataset.suppressClick;
    }, 180);
  });

  row.addEventListener('click', e => {
    if(row.dataset.dragging === '1' || row.dataset.suppressClick === '1'){
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation?.();
      return;
    }

    if(e.target.closest && e.target.closest('.catChip')){
      setTimeout(() => renderCategoryPage(true), 0);
    }
  }, true);

  row.addEventListener('keydown',e=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;

    e.preventDefault();

    const allPages=pages();

    if(e.key==='Home'){
      currentPage=0;
      renderCategoryPage();
      return;
    }

    if(e.key==='End'){
      currentPage=Math.max(0,allPages.length-1);
      renderCategoryPage();
      return;
    }

    if(e.key==='ArrowRight')pageBy(1);
    if(e.key==='ArrowLeft')pageBy(-1);
  });

  new MutationObserver(()=>setTimeout(()=>renderCategoryPage(true),0))
    .observe(row,{childList:true,subtree:true,characterData:true});

  setTimeout(()=>renderCategoryPage(true),0);
}


document.addEventListener('DOMContentLoaded',()=>{
  initCategoryPagedCarousel();
  });
  if(document.readyState==='complete'||document.readyState==='interactive'){
    setTimeout(()=>{initCategoryPagedCarousel();},0);
  }
})();
function setGeneratorRangeFill(el){
  if(!el) return;
  const min=Number(el.min||0), max=Number(el.max||100), val=Number(el.value||0);
  const pct=max>min ? ((val-min)/(max-min))*100 : 0;
  el.style.setProperty('--fill', Math.max(0,Math.min(100,pct)).toFixed(1)+'%');
}
function syncRanges(dirty=false){
  if(dirty) vibe(12);
  const lenEl=$('gLen'); if(!lenEl)return;
  const len=Math.max(6,Math.min(64,+lenEl.value||12)); lenEl.value=len;
  const keys=['Upper','Lower','Num','Sym'];
  let total=0;
  for(const k of keys){const el=$('g'+k); if(el){el.max=len; el.value=Math.max(0,Math.min(len,+el.value||0)); total+=+el.value||0;}}
  const reduceOrder=['Sym','Num','Lower','Upper'];
  for(const k of reduceOrder){const el=$('g'+k); while(total>len && el && +el.value>0){el.value=(+el.value)-1; total--;}}
  ['Len','Upper','Lower','Num','Sym'].forEach(k=>{let el=$('g'+k),v=$('g'+k+'Val');if(el&&v){v.textContent=el.value;setGeneratorRangeFill(el);}});
  const info=$('genInfo'); if(info)info.textContent='Mínimos: '+total+' fijos + '+(len-total)+' aleatorios = '+len+' caracteres totales.';
  if(dirty) $('genOut').textContent='Pulsa generar';
}








/* renderIconPicker redefined below */

function clearFieldError(id){
  const el=$(id); if(!el)return;
  el.classList.remove('fieldError');
  const next=el.nextElementSibling;
  if(next&&next.classList&&next.classList.contains('fieldErrorNote'))next.remove();
}
function manualIconLabel(id){const ic=MANUAL_ICONS.find(x=>x.id===id&&x.id!=='auto');return ic?(ic.label||ic.id):''}

function categoryFromEntryIconId(iconId){
  const id = normService(iconId);
  const label = normService((typeof serviceLabel === 'function' ? serviceLabel(iconId) : '') || manualIconLabel(iconId) || '');
  const text = (id + ' ' + label).trim();

  const groups = [
    ['correo', ['gmail','outlook','hotmail','yahoo','proton','icloud','mail','correo','email','google']],
    ['banco', ['bank','banco','bbva','santander','caixa','ing','revolut','wise','n26','banesco','mercantil','bancovenezuela','zelle','paypal','stripe','klarna','cashapp','venmo','card','tarjeta','bizum']],
    ['social', ['facebook','instagram','whatsapp','telegram','x_twitter','twitter','x','linkedin','discord','reddit','tiktok','tiktok2','pinterest','snapchat','threads','bluesky','mastodon','bereal','tumblr','signal','social']],
    ['streaming', ['netflix','spotify','youtube','disney','primevideo','hbo','appletv','crunchyroll','plex','dazn','mubi','movistar','atresplayer','rtve','filmin','rakuten','skyshowtime','stream','streaming']],
    ['cripto', ['binance','coinbase','kraken','metamask','trustwallet','ethereum','ledger','phantom','kucoin','bybit','okx','crypto','cripto','wallet','bitcoin','btc']],
    ['wifi', ['wifi','wi-fi','router','internet','network','red']],
    ['compras', ['amazon','mercadolibre','aliexpress','wallapop','ebay','etsy','shein','temu','zalando','zara','hm','ikea','elcorteingles','fnac','mediamarkt','pccomponentes','lidl','decathlon','leroy','wish','vinted','depop','shopping','compras']],
    ['gaming', ['gaming','game','steam','playstation','xbox','epic','riot','nintendo','gog','battlenet','ea','ubisoft','roblox','minecraft']],
    ['servidor', ['github','github2','gitlab','bitbucket','datadog','netlify','vercel','aws','azure','gcloud','docker','heroku','railway','supabase','firebase','mongodb','sentry','postman','vscode','server','servidor','cloud','api','ssh','ftp','nas','database']],
    ['salud', ['medical','medico','salud','health','hospital','clinica','farmacia','doctor']],
    ['documentos', ['license','licencia','document','documento','documents','docs','dni','nie','pasaporte','cedula','identity','id','tax','impuestos']],
    ['viajes', ['travel','viajes','airbnb','booking','ryanair','iberia','vueling','renfe','uber']],
    ['educacion', ['school','educacion','education','estudio','universidad','campus','coursera','udemy']],
    ['familia', ['family','familia','kids','ninos','pet','mascota']]
  ];

  for (const [cat, keys] of groups) {
    if (keys.some(k => text.includes(k))) return cat;
  }

  return '';
}

function suggestCategoryFromSelectedIcon(iconId){
  if (!iconId) return;
  if (editId) return;

  const sel = $('eCategory');
  if (!sel) return;

  const suggested = categoryFromEntryIconId(iconId);
  if (!suggested) return;

  const opt = Array.from(sel.options).find(o => normalizeCategoryId(o.value) === suggested);
  if (!opt) return;

  const current = normalizeCategoryId(sel.value || 'general') || 'general';
  const lastAuto = normalizeCategoryId(sel.dataset.vkAutoCategory || '');

  if (current !== 'general' && current !== lastAuto) return;

  sel.value = opt.value;
  sel.dataset.vkAutoCategory = suggested;
}


/* ==========================================================================
   VAULTKEY v9 — Aviso suave si icono y categoría no coinciden
   No bloquea. No cambia la categoría manual. Solo confirma antes de guardar.
   ========================================================================== */

function iconCategoryMismatchInfo(iconId, selectedCat){
  if (!iconId) return null;

  const suggested = normalizeCategoryId(categoryFromEntryIconId(iconId) || '');
  const actual = normalizeCategoryId(selectedCat || 'general') || 'general';

  if (!suggested) return null;
  if (!actual) return null;
  if (suggested === actual) return null;

  const iconLabel =
    (typeof serviceLabel === 'function' ? serviceLabel(iconId) : '') ||
    (typeof manualIconLabel === 'function' ? manualIconLabel(iconId) : '') ||
    iconId;

  return {
    iconLabel,
    suggested,
    actual,
    suggestedLabel: categoryLabelFromId(suggested),
    actualLabel: categoryLabelFromId(actual)
  };
}

async function confirmIconCategoryMismatch(){
  const sel = $('eCategory');
  if (!sel) return true;

  const info = iconCategoryMismatchInfo(selectedEntryIcon, sel.value);
  if (!info) return true;

  const ok = await vkConfirm(
    'Revisar categoría',
    `El icono "${info.iconLabel}" suele pertenecer a "${info.suggestedLabel}", pero elegiste "${info.actualLabel}".

Puedes guardar así si es intencional. ¿Quieres continuar?`
  );

  if (!ok) {
    try { sel.focus(); } catch(e) {}
    return false;
  }

  return true;
}
function selectEntryIcon(id){
  vibe(18);
  selectedEntryIcon=(id==='auto'||id==='custom')?'':id;
  if(selectedEntryIcon){
    const label=serviceLabel(selectedEntryIcon)||manualIconLabel(selectedEntryIcon);
    if(label){
      if($('eService')) {$('eService').value=label; clearFieldError('eService');}
      if($('eIconSearch')) $('eIconSearch').value=label;
    }
  }
  suggestCategoryFromSelectedIcon(selectedEntryIcon);
  renderIconStrip();
  renderIconPicker();
  updateEntryIconPreview();
}
function normalizeUrl(v){
  v=String(v||'').trim().replace(/\s+/g,'');
  if(!v)return '';
  if(isValidEmail(v))return v;
  if(!/^https?:\/\//i.test(v))v='https://'+v;
  return v;
}
function isLikelyUrl(v){
  v=String(v||'').trim();
  if(!v)return true;
  if(isValidEmail(v))return false;
  const clean=v.replace(/\s+/g,'');
  return /^(https?:\/\/)?(www\.)?([a-z0-9-]+\.)+[a-z]{2,}([\/\?#].*)?$/i.test(clean);
}
function legacyEmailFromEntry(e){return (!e?.email && isValidEmail(e?.user||'')) ? (e.user||'') : (e?.email||'')}
function userFromEntry(e){return (!e?.email && isValidEmail(e?.user||'')) ? '' : (e?.user||'')}
function entryMainIdentity(e){
  if(e?.entryType==='note') return '📝 Nota segura';
  if(e?.entryType==='card') return '💳 '+((e.cardType&&typeof e.cardType==='string')?e.cardType.charAt(0).toUpperCase()+e.cardType.slice(1):'Tarjeta')+(e.cardNumber&&typeof e.cardNumber==='string'?' ••'+e.cardNumber.slice(-2):'');
  if(e?.entryType==='id') return '🪪 '+(e.idType?e.idType.toUpperCase():'Documento')+(e.idNumber?' ••'+e.idNumber.slice(-3):'');
  if(e?.entryType==='license') return '🚗 Licencia'+(e.licCategory?' ('+e.licCategory+')':'');
  if(e?.entryType==='medical') return '🏥 Datos médicos'+(e.medBlood?' · '+e.medBlood:'');
  if(e?.entryType==='wifi') return '📶 '+(e.wifiSsid||e.service||'WiFi')+(e.wifiSec?' · '+e.wifiSec:'');
  return '••••••••';
}
function entrySearchText(e){return [e.service,userFromEntry(e),legacyEmailFromEntry(e),e.url,e.note,e.type,e.wifiSsid,e.wifiRouter,e.idName,e.idNumber,e.idType,e.licName,e.licNumber,e.medName,e.medSS,e.cardName,e.cardNumber?'••'+e.cardNumber.slice(-4):''].filter(Boolean).join(' ').toLowerCase()}
document.addEventListener('input',ev=>{if(ev.target&&['eService','eUser','eEmail','eUrl','ePass'].includes(ev.target.id))clearFieldError(ev.target.id)},true);
function openEntry(e=null){
  vibe(28);soundOpen();
  // Restaurar borrador si es nueva entrada y existe borrador
  if(!e){
    const draftStr=sessionStorage.getItem('vk_entry_draft');
    if(draftStr){
      try{
        const d=JSON.parse(draftStr);
        sessionStorage.removeItem('vk_entry_draft');
        setTimeout(()=>{
          if(d.service)document.getElementById('eService')&&(document.getElementById('eService').value=d.service);
          if(d.user)document.getElementById('eUser')&&(document.getElementById('eUser').value=d.user);
          if(d.email)document.getElementById('eEmail')&&(document.getElementById('eEmail').value=d.email);
          if(d.url)document.getElementById('eUrl')&&(document.getElementById('eUrl').value=d.url);
          if(d.icon){selectedEntryIcon=d.icon;typeof renderIconStrip==='function'&&renderIconStrip();}
          toast('Borrador restaurado ✓');
        },400);
      }catch(err){}
    }
  }
  editId=e?.id||null;selectedEntryIcon=e?.icon||'';
  _entryFav=!!(e?.fav);
  $('entryTitle').textContent=e?'Editar entrada':'Nueva entrada';
  // Resetear tipo de entrada
  const entryType=e?.entryType||'password';
  setEntryType(entryType);
  $('eService').value=e?.service||'';
  if($('eUser'))$('eUser').value=e?.user||'';
  if($('eEmail'))$('eEmail').value=e?.email||'';
  if($('ePass'))$('ePass').value=e?.pass||'';
  if($('eUrl'))$('eUrl').value=e?.url||'';
  if($('eNote'))$('eNote').value=e?.note||'';
  if($('eSecureNote'))$('eSecureNote').value=(e?.entryType==='note'?e?.note:'')||'';
  // Cargar recordatorio si existe
  try{ loadNoteReminder(e?.entryType==='note'?e:null); }catch(err){}
  // Cargar etiquetas
  try{ _loadTagsForEntry(e); }catch(err){}
  // Restaurar campos de tarjeta
  if($('eCardName'))$('eCardName').value=e?.cardName||'';
  if($('eCardNumber'))$('eCardNumber').value=e?.cardNumber||'';
  if($('eCardExpiry'))$('eCardExpiry').value=e?.cardExpiry||'';
  if($('eCardCvv'))$('eCardCvv').value=e?.cardCvv||'';
  if($('eCardType'))$('eCardType').value=e?.cardType||'visa';
  // Restaurar campos de documento
  if($('eIdName'))$('eIdName').value=e?.idName||'';
  if($('eIdNumber'))$('eIdNumber').value=e?.idNumber||'';
  if($('eIdDob'))$('eIdDob').value=e?.idDob||'';
  if($('eIdExpiry'))$('eIdExpiry').value=e?.idExpiry||'';
  if($('eIdCountry'))$('eIdCountry').value=e?.idCountry||'';
  if($('eIdType'))$('eIdType').value=e?.idType||'dni';
  // Restaurar campos de licencia
  if($('eLicName'))$('eLicName').value=e?.licName||'';
  if($('eLicNumber'))$('eLicNumber').value=e?.licNumber||'';
  if($('eLicIssued'))$('eLicIssued').value=e?.licIssued||'';
  if($('eLicExpiry'))$('eLicExpiry').value=e?.licExpiry||'';
  if($('eLicCountry'))$('eLicCountry').value=e?.licCountry||'';
  if($('eLicCategory'))$('eLicCategory').value=e?.licCategory||'';
  // Restaurar campos médicos
  if($('eMedName'))$('eMedName').value=e?.medName||'';
  if($('eMedSS'))$('eMedSS').value=e?.medSS||'';
  if($('eMedBlood'))$('eMedBlood').value=e?.medBlood||'';
  if($('eMedAllergies'))$('eMedAllergies').value=e?.medAllergies||'';
  if($('eMedMeds'))$('eMedMeds').value=e?.medMeds||'';
  if($('eMedDoctor'))$('eMedDoctor').value=e?.medDoctor||'';
  if($('eMedNotes'))$('eMedNotes').value=e?.medNotes||'';
  // Restaurar campos WiFi
  if(_entryType==='wifi'&&e?.wifiSsid&&$('eService'))$('eService').value=e.wifiSsid;
  if($('eWifiSsid'))$('eWifiSsid').value=e?.wifiSsid||'';
  if($('eWifiPass'))$('eWifiPass').value=e?.wifiPass||'';
  if($('eWifiSec'))$('eWifiSec').value=e?.wifiSec||'WPA2';
  if($('eWifiRouter'))$('eWifiRouter').value=e?.wifiRouter||'';
  if($('eWifiIp'))$('eWifiIp').value=e?.wifiIp||'';
  if($('eIconSearch'))$('eIconSearch').value='';
  // FIX: Resetear categoría a 'general' en nueva entrada, o restaurar la guardada
  if($('eCategory')){
    const rawCat=e?.category||'general';
    $('eCategory').value=rawCat;
    if($('eCategory').value!==rawCat){
      $('eCategory').value=normalizeCategoryId(rawCat)||'general';
    }
  }
  const btn=$('favToggleBtn');
  if(btn)btn.dataset.fav=String(_entryFav);
  document.querySelectorAll('.fieldErrorNote').forEach(x=>x.remove());
  ['eService','eUser','eEmail','eUrl','ePass'].forEach(id=>$(id)?.classList.remove('fieldError'));
  updateStrength();renderIconStrip();
  $('entryModal').classList.add('open');
  setTimeout(()=>{$('entryModal')?.querySelector('.sheet')?.scrollTo({top:0,behavior:'auto'});},30);
  resetAutoLockTimer();
}
async function saveEntry(){
  // VK2 saveEntry: objeto formato VK2 si hay bóveda 2.0
  if(typeof vkStore!=='undefined'&&vkStore.hasVault()&&typeof vkModels!=='undefined'){
    const _svc=($( 'eService')?.value||'').trim();
    const _usr=($( 'eUser')?.value||$('eEmail')?.value||'').trim();
    const _pwd=($( 'ePass')?.value||'');
    const _url=($( 'eUrl')?.value||'').trim();
    const _note=$('eSecureNote')?.value||'';
    const entry=vkModels.create('password',{
      title:_svc, username:_usr, password:_pwd,
      url:_url, notes:_note, subtype:'web'
    });
    vault.push(entry);
    try{
      await persist();
      vibe([30,20,60]);soundSave();
      closeModals();render();
    }catch(err){
      const _idx=vault.indexOf(entry);
      if(_idx!==-1)vault.splice(_idx,1);
      console.error('saveEntry VK2:',err);
      toast('No se pudo guardar la entrada','err');
    }
    return;
  }
  vibe([30,20,60]);soundSave();
  // Auto-detectar icono desde busqueda si no hay seleccionado
  const _sv=(($('eIconSearch'))?.value||'').trim();
  if(!selectedEntryIcon && _sv){
    const _q=normService(_sv);
    const _found=allIcons().find(ic=>normService(ic.label||ic.id)===_q||normService(ic.id)===_q||iconMatches(ic,_q));
    if(_found && _found.id!=='auto') selectedEntryIcon=_found.id;
  }
  if($('eService')&&!$('eService').value.trim()&&_sv){
    $('eService').value=(selectedEntryIcon?serviceLabel(selectedEntryIcon):_sv)||_sv;
  }
  let pass=($('ePass')?.value||'');
  let serviceVal=($('eService')?.value||'').trim();
  let userVal=($('eUser')?.value||'').trim();
  let emailVal=($('eEmail')?.value||'').trim();
  let urlRaw=($('eUrl')?.value||'').trim();
  document.querySelectorAll('.fieldErrorNote').forEach(x=>x.remove());
  ['eService','eUser','eEmail','eUrl','ePass'].forEach(id=>$(id)?.classList.remove('fieldError'));
  // Icon is optional — auto-detect from service name if not selected
  if(!selectedEntryIcon){
    const _svcNorm=normService(serviceVal);
    const _autoFound=allIcons().find(ic=>normService(ic.label||ic.id)===_svcNorm||normService(ic.id)===_svcNorm);
    if(_autoFound && _autoFound.id!=='auto') selectedEntryIcon=_autoFound.id;
  }
  if(!serviceVal){
    $('eService')?.classList.add('fieldError');
    vibe([30,30]);soundEmpty();
    toast('El nombre del servicio es obligatorio.');
    $('eService')?.focus();return;
  }
  // ── Validaciones por tipo ──────────────────────────────────
  if(_entryType==='note'){
    const noteVal=($('eSecureNote')?.value||'').trim();
    if(!noteVal){vibe([30,30]);soundEmpty();toast('El contenido de la nota no puede estar vacío.');$('eSecureNote')?.focus();return;}
  } else if(_entryType==='card'){
    const cardNum=($('eCardNumber')?.value||'').replace(/\s/g,'');
    const cardName=($('eCardName')?.value||'').trim();
    const cardExp=($('eCardExpiry')?.value||'').trim();
    if(!cardName){vibe([30,30]);soundEmpty();toast('El titular de la tarjeta es obligatorio.');$('eCardName')?.focus();return;}
    if(!cardNum||cardNum.length<16){vibe([30,30]);soundEmpty();toast('El número debe tener 16 dígitos (tiene '+cardNum.length+').');$('eCardNumber')?.focus();return;}
    if(!cardExp||!/^\d{2}\/\d{2}$/.test(cardExp)){vibe([30,30]);soundEmpty();toast('La caducidad debe tener formato MM/AA.');$('eCardExpiry')?.focus();return;}
    const [expM,expY]=cardExp.split('/').map(Number);
    if(expM<1||expM>12){vibe([30,30]);soundError();toast('El mes debe estar entre 01 y 12.');$('eCardExpiry')?.focus();return;}
    const _now=new Date();const _nowY=_now.getFullYear()%100;const _nowM=_now.getMonth()+1;
    if(expY<_nowY||(expY===_nowY&&expM<_nowM)){vibe([30,30]);soundError();toast('La tarjeta está caducada. Revisa la fecha.');$('eCardExpiry')?.focus();return;}
  } else if(_entryType==='id'){
    if(!($('eIdName')?.value||'').trim()){vibe([30,30]);soundEmpty();toast('El nombre completo es obligatorio.');$('eIdName')?.focus();return;}
    if(!($('eIdNumber')?.value||'').trim()){vibe([30,30]);soundEmpty();toast('El número de documento es obligatorio.');$('eIdNumber')?.focus();return;}
    const _idExp=($('eIdExpiry')?.value||'').trim();
    if(_idExp&&!/^\d{2}\/\d{2}\/\d{4}$/.test(_idExp)){vibe([30,30]);soundError();toast('Caducidad: formato DD/MM/AAAA');$('eIdExpiry')?.focus();return;}
  } else if(_entryType==='license'){
    if(!($('eLicName')?.value||'').trim()){vibe([30,30]);soundEmpty();toast('El nombre completo es obligatorio.');$('eLicName')?.focus();return;}
    if(!($('eLicNumber')?.value||'').trim()){vibe([30,30]);soundEmpty();toast('El número de licencia es obligatorio.');$('eLicNumber')?.focus();return;}
    const _licExp=($('eLicExpiry')?.value||'').trim();
    if(_licExp&&!/^\d{2}\/\d{2}\/\d{4}$/.test(_licExp)){vibe([30,30]);soundError();toast('Caducidad: formato DD/MM/AAAA');$('eLicExpiry')?.focus();return;}
    if(_licExp){const[_ld,_lm,_ly]=_licExp.split('/').map(Number);if(new Date(_ly,_lm-1,_ld)<new Date()){vibe([30,30]);soundError();toast('⚠️ La licencia está caducada.');$('eLicExpiry')?.focus();return;}}
  } else if(_entryType==='medical'){
    if(!($('eMedName')?.value||'').trim()){vibe([30,30]);soundEmpty();toast('El nombre del paciente es obligatorio.');$('eMedName')?.focus();return;}
  } else if(_entryType==='wifi'){
    if(!serviceVal){vibe([30,30]);soundEmpty();toast('El nombre de la red (SSID) es obligatorio.');$('eService')?.focus();return;}
    if(!($('eWifiPass')?.value||'').trim()){vibe([30,30]);soundEmpty();toast('La contraseña WiFi es obligatoria.');$('eWifiPass')?.focus();return;}
  } else {
    // password — validaciones estándar
    if(!userVal && !emailVal){$('eUser')?.classList.add('fieldError');$('eEmail')?.classList.add('fieldError');vibe([30,30]);soundEmpty();toast('El usuario o el correo son obligatorios.');$('eUser')?.focus();return;}
    if(emailVal && !isValidEmail(emailVal)){$('eEmail')?.classList.add('fieldError');vibe([30,30]);soundError();toast('El correo no tiene formato válido. Ej: usuario@gmail.com');$('eEmail')?.focus();return;}
    if(urlRaw && !isLikelyUrl(urlRaw)){$('eUrl')?.classList.add('fieldError');vibe([30,30]);soundError();toast('La URL no es válida. Ej: https://google.com');$('eUrl')?.focus();return;}
    if(pass.length<6){$('ePass')?.classList.add('fieldError');vibe([30,30]);soundError();toast('La contraseña debe tener mínimo 6 caracteres');$('ePass')?.focus();updateStrength();return;}
  }
  if (!(await confirmIconCategoryMismatch())) return;

  let urlVal=normalizeUrl?normalizeUrl(urlRaw):urlRaw;
  // Preservar historial de contraseñas (máx 3 versiones anteriores)
  const _prevEntry = editId ? vault.find(x=>x.id===editId) : null;
  const _prevHistory = _prevEntry ? (_prevEntry.passHistory||[]) : [];
  let _newHistory = _prevHistory;
  if(_prevEntry && _prevEntry.pass && _prevEntry.pass !== pass) {
    // La contraseña cambió — guardar la anterior en el historial
    const histEntry = {pass:_prevEntry.pass, date:_prevEntry.updated||Date.now()};
    _newHistory = [histEntry, ..._prevHistory].slice(0,3); // máximo 3
  }
  const secureNoteVal=_entryType==='note'?($('eSecureNote')?.value||'').trim():'';
  const reminderData=(_entryType==='note'&&_reminderActive)?{
    date:($('eReminderDate')?.value||''),
    time:($('eReminderTime')?.value||''),
    msg:($('eReminderMsg')?.value||'').trim()||secureNoteVal.slice(0,60),
    active:true,
  }:null;
  const cardData=_entryType==='card'?{
    cardName:($('eCardName')?.value||'').trim(),
    cardNumber:($('eCardNumber')?.value||'').replace(/\s/g,''),
    cardExpiry:($('eCardExpiry')?.value||'').trim(),
    cardCvv:($('eCardCvv')?.value||'').trim(),
    cardType:($('eCardType')?.value||'visa'),
  }:{};
  const idData=_entryType==='id'?{
    idName:($('eIdName')?.value||'').trim(),
    idNumber:($('eIdNumber')?.value||'').trim(),
    idDob:($('eIdDob')?.value||'').trim(),
    idExpiry:($('eIdExpiry')?.value||'').trim(),
    idCountry:($('eIdCountry')?.value||'').trim(),
    idType:($('eIdType')?.value||'dni'),
  }:{};
  const licData=_entryType==='license'?{
    licName:($('eLicName')?.value||'').trim(),
    licNumber:($('eLicNumber')?.value||'').trim(),
    licIssued:($('eLicIssued')?.value||'').trim(),
    licExpiry:($('eLicExpiry')?.value||'').trim(),
    licCountry:($('eLicCountry')?.value||'').trim(),
    licCategory:($('eLicCategory')?.value||'').trim(),
  }:{};
  const medData=_entryType==='medical'?{
    medName:($('eMedName')?.value||'').trim(),
    medSS:($('eMedSS')?.value||'').trim(),
    medBlood:($('eMedBlood')?.value||''),
    medAllergies:($('eMedAllergies')?.value||'').trim(),
    medMeds:($('eMedMeds')?.value||'').trim(),
    medDoctor:($('eMedDoctor')?.value||'').trim(),
    medNotes:($('eMedNotes')?.value||'').trim(),
  }:{};
  const wifiData=_entryType==='wifi'?{
    wifiSsid:serviceVal,
    wifiPass:($('eWifiPass')?.value||'').trim(),
    wifiSec:($('eWifiSec')?.value||'WPA2'),
    wifiRouter:($('eWifiRouter')?.value||'').trim(),
    wifiIp:($('eWifiIp')?.value||'').trim(),
  }:{};
  const isPassType=_entryType==='password';
  let entry={id:editId||crypto.randomUUID(),service:serviceVal,entryType:_entryType,...cardData,...idData,...licData,...medData,...wifiData,type:'Cuenta',category:normalizeCategoryId($('eCategory')?.value||'general')||'general',user:isPassType?userVal:'',email:isPassType?emailVal:'',pass:isPassType?pass:'',url:isPassType?urlVal:'',note:_entryType==='note'?secureNoteVal:($('eNote')?.value||'').trim(),reminder:reminderData||null,tags:_getEntryTags(),icon:selectedEntryIcon||'',fav:_entryFav,updated:Date.now(),used:editId?(vault.find(x=>x.id===editId)?.used||0):0,passHistory:_newHistory};
  let i=vault.findIndex(x=>x.id===entry.id);
  const _prevLegacyEntry=i>=0?vault[i]:null;
  if(i>=0)vault[i]=entry;else vault.unshift(entry);
  _catFilter='';_vaultTab='todas';document.querySelectorAll('.catChip').forEach(c=>c.classList.remove('active'));const _fc=document.querySelectorAll('.catChip')[0];if(_fc)_fc.classList.add('active');
  try{
    await persist();closeModals();show('vault');render();try{driveAutoSync();}catch(e){}toast('Guardado \u2713');
  }catch(err){
    if(_prevLegacyEntry){vault[i]=_prevLegacyEntry;}else{const _idx=vault.indexOf(entry);if(_idx!==-1)vault.splice(_idx,1);}
    console.error('saveEntry legacy:',err);
    toast('No se pudo guardar la entrada','err');
  }
}
// Tab switcher para Recientes
function switchVaultTab(tab, btn){
  _vaultTab=tab;
  ['tabTodas','tabFav','tabRecientes'].forEach(id=>{
    const b=$(id);if(!b)return;
    const active=b===btn;
    b.style.color=active?'#00d9ff':'#4a7090';
    b.style.borderBottomColor=active?'#00d9ff':'transparent';
    b.style.fontWeight=active?'800':'700';
  });
  render();
}
let _sortOrder='updated'; // 'updated' | 'name' | 'used'
function toggleSortMenu(){
  const m=$('sortMenu');
  if(!m)return;
  m.style.display=m.style.display==='none'?'block':'none';
  // Cerrar al hacer clic fuera
  if(m.style.display==='block'){
    setTimeout(()=>document.addEventListener('click',_closeSortMenu,{once:true}),10);
  }
}
function _closeSortMenu(){const m=$('sortMenu');if(m)m.style.display='none';}

function setSortOrder(v){
  _sortOrder=v;
  // Actualizar visual del menú
  ['updated','name','used'].forEach(k=>{
    const btn=$('sort_'+k);
    if(!btn)return;
    if(k===v){
      btn.style.background='rgba(0,210,255,.08)';
      btn.style.color='#00d9ff';
    } else {
      btn.style.background='transparent';
      btn.style.color='#7ab0d0';
    }
  });
  // Actualizar icono del botón
  const labels={updated:'🕐',name:'🔤',used:'⭐'};
  const btn=$('sortMenuBtn');
  if(btn)btn.textContent=labels[v]||'⇅';
  render();
}
function isPasswordFamilyEntry(e){
  /* Regla explícita (auditoría documentos, punto 5): solo type/entryType
     'password' (o sus subtipos legacy planos wifi/pin/recovery) cuentan
     como contraseña. Nunca por defecto — un documento con campos
     service/user/pass no debe colarse aquí. */
  const type=(e?.entryType||e?.type||'').toLowerCase();
  return type==='password'||type==='wifi'||type==='pin'||type==='recovery';
}
function passwordFamilyIdentity(e){
  return e?.user||e?.username||e?.email||e?.url||e?.ssid||'';
}
function passwordFamilyKeySvg(){
  return '<svg viewBox="0 0 26 26" fill="none" aria-hidden="true"><path d="M1.70186 19.5073C1.2526 19.9564 1.00014 20.5656 1 21.2009V23.8023C1 24.1199 1.12619 24.4246 1.3508 24.6492C1.57542 24.8738 1.88006 25 2.19771 25H5.79084C6.10849 25 6.41313 24.8738 6.63775 24.6492C6.86236 24.4246 6.98855 24.1199 6.98855 23.8023V22.6046C6.98855 22.2869 7.11474 21.9823 7.33935 21.7577C7.56396 21.5331 7.86861 21.4069 8.18626 21.4069H9.38397C9.70162 21.4069 10.0063 21.2807 10.2309 21.0561C10.4555 20.8315 10.5817 20.5268 10.5817 20.2092V19.0115C10.5817 18.6938 10.7079 18.3892 10.9325 18.1645C11.1571 17.9399 11.4617 17.8137 11.7794 17.8137H11.9854C12.6206 17.8136 13.2298 17.5611 13.679 17.1119L14.6539 16.137C16.3185 16.7168 18.1306 16.7146 19.7938 16.1307C21.457 15.5467 22.8728 14.4156 23.8096 12.9224C24.7464 11.4293 25.1487 9.66234 24.9507 7.91077C24.7528 6.15919 23.9662 4.52666 22.7198 3.28022C21.4733 2.03379 19.8408 1.24724 18.0892 1.04927C16.3377 0.851295 14.5708 1.25361 13.0776 2.19039C11.5844 3.12717 10.4533 4.54297 9.86934 6.20617C9.2854 7.86936 9.28319 9.68149 9.86305 11.3461L1.70186 19.5073Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M18.2 7.8h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
}
function renderPasswordFamilyList(){
  const host=$('passwordFamilyList');
  if(!host)return;
  const search=$('passwordSearch');
  const query=(search?.value||'').trim().toLowerCase();
  const passwords=vault.filter(isPasswordFamilyEntry);
  const visible=passwords.filter(e=>!query||entrySearchText(e).includes(query));
  host.innerHTML='';
  if(visible.length){
    visible.forEach(e=>{
      const button=document.createElement('button');
      button.type='button';
      button.className='vk-passwords-row';
      button.setAttribute('aria-label','Abrir '+(e.service||e.title||'contraseña'));
      button.onclick=()=>openPasswordDetail(e.id);
      const title=safeEsc(e.service||e.title||'Sin título');
      const identity=safeEsc(passwordFamilyIdentity(e)||'Sin usuario');
      button.innerHTML='<span class="vk-passwords-row__icon">'+passwordFamilyKeySvg()+'</span><span class="vk-passwords-row__copy"><strong>'+title+'</strong><span>'+identity+'</span></span><svg class="vk-passwords-row__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>';
      host.appendChild(button);
    });
    return;
  }
  const noResults=Boolean(query&&passwords.length);
  const section=document.createElement('section');
  section.className='vk-passwords-empty';
  section.innerHTML='<div class="vk-passwords-empty__icon" aria-hidden="true">'+passwordFamilyKeySvg()+'</div><h2>'+(noResults?'No se encontraron contraseñas':'Aún no tienes contraseñas')+'</h2><p>'+(noResults?'Prueba con otra palabra o revisa la búsqueda.':'Guarda aquí tus accesos para tenerlos protegidos y siempre a mano.')+'</p><button type="button">'+(noResults?'Limpiar búsqueda':'Añadir contraseña')+'</button>';
  section.querySelector('button').onclick=()=>{if(noResults){if(search)search.value='';render();}else openPasswordCreate();};
  host.appendChild(section);
}


function passwordDetailIcon(name){
  const icons={
    globe:'<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    eye:'<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M2.1 12a10 10 0 0 1 19.8 0 10 10 0 0 1-19.8 0" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/></svg>',
    copy:'<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2" stroke="currentColor" stroke-width="2"/><path d="M4 16V6a2 2 0 0 1 2-2h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    external:'<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14 4h6v6M10 14 20 4M20 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    edit:'<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    trash:'<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };
  return icons[name]||'';
}


function openPasswordEdit(){
  if(!current||!isPasswordFamilyEntry(current))return;

  $('passwordEditUser').value=
    current.user||current.username||current.email||'';

  const currentSecret=$('passwordEditCurrentSecret');
  currentSecret.type='password';
  currentSecret.value=current.pass||current.password||current.wifiPass||'';

  const newSecret=$('passwordEditNewSecret');
  newSecret.type='password';
  newSecret.value='';

  $('passwordEditUrl').value=current.url||'';
  $('passwordEditNotes').value=current.note||current.notes||'';
  setFavoriteSwitch($('passwordEditFavorite'),current.fav===true);


  $('passwordEditCurrentEyeOpen')?.classList.remove('vk-password-edit-hidden');
  $('passwordEditCurrentEyeOff')?.classList.add('vk-password-edit-hidden');
  $('passwordEditNewEyeOpen')?.classList.remove('vk-password-edit-hidden');
  $('passwordEditNewEyeOff')?.classList.add('vk-password-edit-hidden');

  const sourceGeneratorImage=$('vkPasswordCreateGenerator')?.querySelector('img');
  const editGeneratorImage=$('passwordEditGeneratorImage');
  if(sourceGeneratorImage&&editGeneratorImage){
    editGeneratorImage.src=sourceGeneratorImage.src;
  }

  show('passwordEdit','right');
}

function cancelPasswordEdit(){
  if(!current)return;
  renderPasswordDetail();
  show('passwordDetail','left');
}

function togglePasswordEditSecret(target='current'){
  const isNew=target==='new';
  const input=$(isNew?'passwordEditNewSecret':'passwordEditCurrentSecret');
  if(!input)return;

  const reveal=input.type==='password';
  input.type=reveal?'text':'password';

  $(isNew?'passwordEditNewEyeOpen':'passwordEditCurrentEyeOpen')
    ?.classList.toggle('vk-password-edit-hidden',reveal);

  $(isNew?'passwordEditNewEyeOff':'passwordEditCurrentEyeOff')
    ?.classList.toggle('vk-password-edit-hidden',!reveal);
}

function openPasswordEditUrl(){
  const value=($('passwordEditUrl')?.value||'').trim();
  if(!value){
    toast('No hay sitio web para abrir.');
    return;
  }
  openUrl(value);
}

function setFavoriteSwitch(button,value){
  if(!button)return;
  button.setAttribute('aria-checked',value?'true':'false');
}

function togglePasswordCreateFavorite(){
  const button=$('vkPasswordCreateFavorite');
  if(!button)return;
  const value=button.getAttribute('aria-checked')!=='true';
  _passwordCreateFavorites[_passwordCreateType]=value;
  setFavoriteSwitch(button,value);
}

function togglePasswordEditFavorite(){
  const button=$('passwordEditFavorite');
  if(!button)return;
  setFavoriteSwitch(
    button,
    button.getAttribute('aria-checked')!=='true'
  );
}

async function savePasswordEdit(){
  if(!current||!isPasswordFamilyEntry(current))return;

  const service=(current.service||current.title||current.wifiSsid||'').trim();
  const identity=($('passwordEditUser')?.value||'').trim();
  const newSecret=$('passwordEditNewSecret')?.value||'';
  const rawUrl=($('passwordEditUrl')?.value||'').trim();
  const notes=($('passwordEditNotes')?.value||'').trim();
  const fav=
    $('passwordEditFavorite')?.getAttribute('aria-checked')==='true';

  if(!identity){
    toast('El usuario es obligatorio.');
    $('passwordEditUser')?.focus();
    return;
  }

  if(newSecret&&newSecret.length<6){
    toast('La contraseña debe tener mínimo 6 caracteres.');
    $('passwordEditNewSecret')?.focus();
    return;
  }

  if(rawUrl&&typeof isLikelyUrl==='function'&&!isLikelyUrl(rawUrl)){
    toast('La URL no es válida. Ej: https://google.com');
    $('passwordEditUrl')?.focus();
    return;
  }

  const urlValue=
    rawUrl&&typeof normalizeUrl==='function'
      ? normalizeUrl(rawUrl)
      : rawUrl;

  const index=vault.findIndex(entry=>entry.id===current.id);
  if(index<0)return;

  const previous=vault[index];
  const next={...previous};
  next.fav=fav;

  const oldSecret=
    previous.pass||previous.password||previous.wifiPass||'';
  const secret=newSecret||oldSecret;

  if(Object.prototype.hasOwnProperty.call(next,'title')){
    next.title=service;
  }

  if(Object.prototype.hasOwnProperty.call(next,'service')||
     !Object.prototype.hasOwnProperty.call(next,'title')){
    next.service=service;
  }

  if(Object.prototype.hasOwnProperty.call(next,'username')){
    next.username=identity;
  }

  if(Object.prototype.hasOwnProperty.call(next,'user')||
     !Object.prototype.hasOwnProperty.call(next,'username')){
    next.user=identity;
  }

  if(Object.prototype.hasOwnProperty.call(next,'password')){
    next.password=secret;
  }

  if(Object.prototype.hasOwnProperty.call(next,'wifiPass')){
    next.wifiPass=secret;
  }

  if(Object.prototype.hasOwnProperty.call(next,'pass')||
     !Object.prototype.hasOwnProperty.call(next,'password')){
    next.pass=secret;
  }

  if(Object.prototype.hasOwnProperty.call(next,'notes')){
    next.notes=notes;
  }

  if(Object.prototype.hasOwnProperty.call(next,'note')||
     !Object.prototype.hasOwnProperty.call(next,'notes')){
    next.note=notes;
  }

  next.url=urlValue;
  next.updated=Date.now();

  if(oldSecret&&oldSecret!==secret){
    const history=Array.isArray(previous.passHistory)
      ? previous.passHistory
      : [];

    next.passHistory=[
      {
        pass:oldSecret,
        date:previous.updated||Date.now()
      },
      ...history
    ].slice(0,3);
  }

  vault[index]=next;
  current=next;

  try{
    await persist();

    render();
    show('passwords','left');
    toast('Cambios guardados');

    try{driveAutoSync();}catch(error){}
  }catch(error){
    vault[index]=previous;
    current=previous;
    console.error('savePasswordEdit:',error);
    toast('No se pudo guardar la contraseña','err');
  }
}

function openCreatePicker(){
  const picker=$('createPicker');
  if(!picker)return;

  picker.hidden=false;
  document.body.classList.add('vk-create-picker-open');

  setTimeout(()=>{
    picker.querySelector('.vk-create-picker__options button')?.focus();
  },0);
}

function closeCreatePicker(){
  const picker=$('createPicker');
  if(!picker)return;

  picker.hidden=true;
  document.body.classList.remove('vk-create-picker-open');
}

function selectCreateType(type){
  closeCreatePicker();

  if(type==='password'){
    openPasswordCreate();
    return;
  }

  if(type==='note'){
    if(typeof window.openCreateNote==='function'){
      window.openCreateNote();
    }
    return;
  }

  if(type==='card'){
    if(typeof window.openCreateCard==='function'){
      window.openCreateCard();
    }
    return;
  }

  if(type==='document'&&typeof window.openTypePicker==='function'){
    window.openTypePicker();
  }
}

window.openCreatePicker=openCreatePicker;
window.closeCreatePicker=closeCreatePicker;
window.selectCreateType=selectCreateType;

let _passwordCreateType='web';
let _passwordCreateGenerated=false;
let _passwordCreateFavorites={
  web:false,
  wifi:false,
  pin:false,
  recovery:false
};

function passwordCreateNameIcon(name){
  const icons={
    wifi:'<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 9.5a11 11 0 0 1 14 0M8 13a6.5 6.5 0 0 1 8 0M11 16.5a2 2 0 0 1 2 0" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    device:'<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="7" y="2" width="10" height="20" rx="2" stroke="currentColor" stroke-width="2"/><path d="M11 18h2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    key:'<svg viewBox="0 0 26 26" fill="none" aria-hidden="true"><path d="M1.70186 19.5073C1.2526 19.9564 1.00014 20.5656 1 21.2009V23.8023C1 24.1199 1.12619 24.4246 1.3508 24.6492C1.57542 24.8738 1.88006 25 2.19771 25H5.79084C6.10849 25 6.41313 24.8738 6.63775 24.6492C6.86236 24.4246 6.98855 24.1199 6.98855 23.8023V22.6046C6.98855 22.2869 7.11474 21.9823 7.33935 21.7577C7.56396 21.5331 7.86861 21.4069 8.18626 21.4069H9.38397C9.70162 21.4069 10.0063 21.2807 10.2309 21.0561C10.4555 20.8315 10.5817 20.5268 10.5817 20.2092V19.0115C10.5817 18.6938 10.7079 18.3892 10.9325 18.1645C11.1571 17.9399 11.4617 17.8137 11.7794 17.8137H11.9854C12.6206 17.8136 13.2298 17.5611 13.679 17.1119L14.6539 16.137C16.3185 16.7168 18.1306 16.7146 19.7938 16.1307C21.457 15.5467 22.8728 14.4156 23.8096 12.9224C24.7464 11.4293 25.1487 9.66234 24.9507 7.91077C24.7528 6.15919 23.9662 4.52666 22.7198 3.28022C21.4733 2.03379 19.8408 1.24724 18.0892 1.04927C16.3377 .851295 14.5708 1.25361 13.0776 2.19039C11.5844 3.12717 10.4533 4.54297 9.86934 6.20617C9.2854 7.86936 9.28319 9.68149 9.86305 11.3461L1.70186 19.5073Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };
  return icons[name]||'';
}

function openPasswordCreate(type='web'){
  _passwordCreateType=['web','wifi','pin','recovery'].includes(type)?type:'web';

  const name=$('vkPasswordCreateName');
  const user=$('vkPasswordCreateUser');
  const secret=$('vkPasswordCreateSecret');
  const note=$('vkPasswordCreateNote');
  const noteButton=$('vkPasswordCreateAddNote');

  if(name)name.value='';
  if(user)user.value='';
  if(secret){
    secret.value='';
    secret.type='password';
  }
  if(note)note.value='';
  if(noteButton)noteButton.textContent='+ Añadir nota';

  _passwordCreateFavorites={
    web:false,
    wifi:false,
    pin:false,
    recovery:false
  };

  _passwordCreateGenerated=false;

  $('vkPasswordCreateEyeOpen')?.classList.remove('vk-password-create-hidden');
  $('vkPasswordCreateEyeOff')?.classList.add('vk-password-create-hidden');
  $('vkPasswordCreateNoteField')?.classList.remove('is-visible');

  setPasswordCreateType(_passwordCreateType);

  if(secret&&!secret.dataset.passwordCreateManualBound){
    secret.addEventListener('input',()=>{
      _passwordCreateGenerated=false;
    });
    secret.dataset.passwordCreateManualBound='true';
  }

  show('passwordCreate','right');
  setTimeout(()=>{
    name?.focus({preventScroll:true});

    const createForm=document.querySelector('.vk-password-create-form');
    if(createForm)createForm.scrollTop=0;
  },120);
}
function setPasswordCreateType(type){
  const config={
    web:{
      title:'Añadir contraseña - Web',
      nameLabel:'Sitio web',
      namePlaceholder:'Google, Gmail, Amazon...',
      userVisible:true,
      nameIcon:'',
      secretLabel:'Contraseña',
      secretPlaceholder:'Introduce la contraseña',
      generatorVisible:true
    },
    wifi:{
      title:'Añadir contraseña - WiFi',
      nameLabel:'Nombre de la red',
      namePlaceholder:'Nombre de la red',
      userVisible:false,
      nameIcon:'wifi',
      secretLabel:'Contraseña',
      secretPlaceholder:'Introduce la contraseña',
      generatorVisible:true
    },
    pin:{
      title:'Añadir contraseña - PIN',
      nameLabel:'Nombre del dispositivo',
      namePlaceholder:'Nombre del dispositivo',
      userVisible:false,
      nameIcon:'device',
      secretLabel:'PIN',
      secretPlaceholder:'Introduce el PIN',
      generatorVisible:false
    },
    recovery:{
      title:'Añadir contraseña - Recuperación',
      nameLabel:'Servicio',
      namePlaceholder:'Servicio',
      userVisible:false,
      nameIcon:'key',
      secretLabel:'Código',
      secretPlaceholder:'Introduce el código',
      generatorVisible:false
    }
  };

  const next=config[type];
  if(!next)return;
  _passwordCreateType=type;
  const passwordCreateRoot=document.getElementById('passwordCreate');
  if(passwordCreateRoot)passwordCreateRoot.dataset.passwordCreateType=type;
  setFavoriteSwitch(
    $('vkPasswordCreateFavorite'),
    _passwordCreateFavorites[type]===true
  );

  const noteField=$('vkPasswordCreateNoteField');
  const noteButton=$('vkPasswordCreateAddNote');
  const createForm=document.querySelector('.vk-password-create-form');

  noteField?.classList.remove('is-visible');
  if(noteButton)noteButton.textContent='+ Añadir nota';
  if(createForm)createForm.scrollTop=0;

  document.querySelectorAll('[data-password-create-type]').forEach(button=>{
    button.setAttribute('aria-selected',String(button.dataset.passwordCreateType===type));
  });

  const title=$('vkPasswordCreateTitle');
  const nameLabel=$('vkPasswordCreateNameLabel');
  const name=$('vkPasswordCreateName');
  const userField=$('vkPasswordCreateUserField');
  const nameIcon=$('vkPasswordCreateNameIcon');
  const secretLabel=$('vkPasswordCreateSecretLabel');
  const secret=$('vkPasswordCreateSecret');
  const generator=$('vkPasswordCreateGenerator');

  if(title)title.textContent=next.title;
  if(nameLabel)nameLabel.textContent=next.nameLabel;
  if(name){
    name.placeholder=next.namePlaceholder;
    name.classList.toggle('vk-password-create-input--plain',!next.nameIcon);
  }
  if(userField)userField.style.display=next.userVisible?'block':'none';
  if(nameIcon){
    nameIcon.hidden=!next.nameIcon;
    nameIcon.innerHTML=next.nameIcon?passwordCreateNameIcon(next.nameIcon):'';
  }
  if(secretLabel)secretLabel.textContent=next.secretLabel;
  if(secret){
    secret.placeholder=next.secretPlaceholder;
    secret.type='password';
    secret.value='';
  }
  _passwordCreateGenerated=false;
  if(generator)generator.style.display=next.generatorVisible?'grid':'none';

  $('vkPasswordCreateEyeOpen')?.classList.remove('vk-password-create-hidden');
  $('vkPasswordCreateEyeOff')?.classList.add('vk-password-create-hidden');
}

function togglePasswordCreateSecret(){
  const input=$('vkPasswordCreateSecret');
  if(!input)return;

  const reveal=input.type==='password';
  input.type=reveal?'text':'password';

  $('vkPasswordCreateEyeOpen')?.classList.toggle('vk-password-create-hidden',reveal);
  $('vkPasswordCreateEyeOff')?.classList.toggle('vk-password-create-hidden',!reveal);
}

function togglePasswordCreateNote(){
  const field=$('vkPasswordCreateNoteField');
  const button=$('vkPasswordCreateAddNote');
  if(!field||!button)return;

  const open=field.classList.toggle('is-visible');
  button.textContent=open?'− Ocultar nota':'+ Añadir nota';

  if(open){
    setTimeout(()=>{
      field.scrollIntoView({
        behavior:'smooth',
        block:'center'
      });
    },60);
  }
}

function cancelPasswordCreate(){
  show('passwords','left');
}

async function savePasswordCreate(){
  if(typeof vkModels==='undefined'||typeof vkModels.create!=='function'){
    toast('No se pudo crear la contraseña.');
    return;
  }

  const title=($('vkPasswordCreateName')?.value||'').trim();
  const username=($('vkPasswordCreateUser')?.value||'').trim();
  const secret=$('vkPasswordCreateSecret')?.value||'';
  const notes=($('vkPasswordCreateNote')?.value||'').trim();
  const fav=
    $('vkPasswordCreateFavorite')?.getAttribute('aria-checked')==='true';

  if(!title){
    toast(_passwordCreateType==='wifi'?'El nombre de la red es obligatorio.':'El nombre es obligatorio.');
    $('vkPasswordCreateName')?.focus();
    return;
  }

  if(_passwordCreateType==='web'&&!username){
    toast('El usuario es obligatorio.');
    $('vkPasswordCreateUser')?.focus();
    return;
  }

  if(!secret.trim()){
    const message=_passwordCreateType==='pin'
      ?'El PIN es obligatorio.'
      :_passwordCreateType==='recovery'
        ?'El código es obligatorio.'
        :'La contraseña es obligatoria.';
    toast(message);
    $('vkPasswordCreateSecret')?.focus();
    return;
  }
  if((_passwordCreateType==='web'||_passwordCreateType==='wifi')&&!_passwordCreateGenerated){
    const confirmed=await vkConfirm(
      '¿Confirmar contraseña?',
      'Has escrito la contraseña manualmente. Revísala antes de guardar. ¿Quieres continuar?',
      {variant:'wipe',confirmText:'Continuar'}
    );

    if(!confirmed){
      $('vkPasswordCreateSecret')?.focus();
      return;
    }
  }

  let entry;
  try{
    const data={
      title,
      subtype:_passwordCreateType,
      username:_passwordCreateType==='web'?username:'',
      password:_passwordCreateType==='recovery'?'':secret,
      url:'',
      notes,
      fav,
      codes:_passwordCreateType==='recovery'?[secret]:[],
      passHistory:[]
    };

    entry=vkModels.create('password',data);
    vault.push(entry);
    await persist();

    render();
    show('passwords','left');
    toast('Contraseña creada');

    try{driveAutoSync();}catch(error){}
  }catch(error){
    if(entry){
      const _idx=vault.indexOf(entry);
      if(_idx!==-1)vault.splice(_idx,1);
    }
    console.error('savePasswordCreate',error);
    toast('No se pudo crear la contraseña.');
  }
}
function openPasswordDetail(id){
  const e=vault.find(x=>x.id===id);
  if(!e)return;
  e.used=Date.now();
  persist().catch(err=>console.warn('openPasswordDetail persist:',err));
  current=e;
  renderPasswordDetail();
  show('passwordDetail','right');
}

function renderPasswordDetail(){
  const host=$('passwordDetailBody');
  const titleHost=$('passwordDetailHeaderTitle');
  if(!host||!current||!isPasswordFamilyEntry(current))return;

  const e=current;
  const title=safeEsc(e.service||e.title||e.wifiSsid||'Contraseña');
  const user=safeEsc(passwordFamilyIdentity(e)||'Sin usuario');
  const url=safeEsc(e.url||'');
  const note=safeEsc(e.note||e.notes||'Sin notas');

  if(titleHost)titleHost.textContent=e.service||e.title||e.wifiSsid||'Detalle';

  host.innerHTML=
    '<section class="vk-password-detail-card">'+
      '<div class="vk-password-detail-card__title">'+passwordDetailIcon('globe')+'<strong>'+title+'</strong></div>'+
      '<div class="vk-password-detail-row"><div><small>Usuario</small><span>'+user+'</span></div></div>'+
      '<div class="vk-password-detail-row vk-password-detail-row--actions"><div><small>Contraseña</small><span id="passwordDetailSecret" data-visible="false">••••••••••••</span></div><div class="vk-password-detail-icons"><button type="button" aria-label="Mostrar u ocultar contraseña" onclick="togglePasswordDetailSecret()">'+passwordDetailIcon('eye')+'</button><button type="button" aria-label="Copiar contraseña" onclick="copyPasswordDetailSecret()">'+passwordDetailIcon('copy')+'</button></div></div>'+
      (url?'<div class="vk-password-detail-row vk-password-detail-row--actions"><div><small>Sitio web</small><span>'+url+'</span></div><button type="button" aria-label="Copiar sitio web" onclick="copyPasswordDetailUrl()">'+passwordDetailIcon('copy')+'</button></div>':'')+
      '<div class="vk-password-detail-row vk-password-detail-row--actions"><div><small>Notas</small><span>'+note+'</span></div>'+(url?'<button type="button" aria-label="Abrir sitio web" onclick="openUrl(current.url)">'+passwordDetailIcon('external')+'</button>':'')+'</div>'+
    '</section>'+
    '<div class="vk-password-detail-actions">'+
      '<button type="button" class="vk-password-detail-edit" onclick="openPasswordEdit()">'+passwordDetailIcon('edit')+'<span>Editar</span></button>'+
      '<button type="button" class="vk-password-detail-delete" onclick="deletePasswordFromDetail()">'+passwordDetailIcon('trash')+'<span>Eliminar</span></button>'+
    '</div>';
}

function togglePasswordDetailSecret(){
  const el=$('passwordDetailSecret');
  if(!el||!current)return;
  const visible=el.dataset.visible==='true';
  el.dataset.visible=visible?'false':'true';
  el.textContent=visible?'••••••••••••':(current.pass||current.password||'');
}

function copyPasswordDetailSecret(){
  if(!current)return;
  copyText(current.pass||current.password||'');
  toast('Contraseña copiada');
}

function copyPasswordDetailUrl(){
  if(!current)return;
  copyText(current.url||'');
  toast('Sitio web copiado');
}

async function deletePasswordFromDetail(){
  if(!current)return;
  const id=current.id;
  if(await vkConfirm('¿Eliminar contraseña?','Se eliminará de la bóveda y no podrás recuperarla.',{variant:'delete-password',confirmText:'Eliminar'})){
    const _delIdx=vault.findIndex(e=>e.id===id);
    if(_delIdx===-1)return;
    const _delEntry=vault[_delIdx];
    vault.splice(_delIdx,1);
    try{
      await persist();
      current=null;
      render();
      show('passwords','left');
      toast('Contraseña eliminada');
      try{driveAutoSync();}catch(e){}
    }catch(err){
      vault.splice(_delIdx,0,_delEntry);
      console.error('deletePasswordFromDetail:',err);
      toast('No se pudo eliminar la contraseña','err');
    }
  }
}

function render(){
  // Saludo según hora
  try{
    const _h=new Date().getHours();
    const _g=_h<6?'Buenas noches \u{1F44B}':_h<13?'Buenos d\u00edas \u{1F44B}':_h<20?'Buenas tardes \u{1F44B}':'Buenas noches \u{1F44B}';
    const _gel=$('homeGreeting');if(_gel)_gel.textContent=_g;
  }catch(e){}
  renderVaultHealthDashboard();
  renderPasswordFamilyList();
  let q=($('search')?.value||'').toLowerCase();
  let _visibleEntryCount=null;
  const rvault=$('recentListVault');
  const elist=$('entryList');
  // Mostrar/ocultar listas según tab activo
  if(_vaultTab==='recientes'){
    if(elist) elist.style.display='none';
    if(rvault) rvault.style.display='';
    const recents=[...vault].filter(e=>(e.used||0)>0).sort((a,b)=>(b.used||0)-(a.used||0)).slice(0,20);
    if(rvault){
      rvault.innerHTML='';
      if(recents.length){
        recents.forEach(e=>rvault.appendChild(row(e)));
      } else {
        rvault.innerHTML='<div class="empty"><b>Sin recientes todavía</b><p>Abre una entrada para que aparezca aquí</p></div>';
      }
    }
  } else {
    if(elist) elist.style.display='';
    if(rvault) rvault.style.display='none';
    const _cf=normalizeCategoryId(_catFilter||'');
    let list=vault.filter(e=>entrySearchText(e).includes(q)&&categoryMatchesFilter(e,_cf));
    // Filtrar por etiqueta activa
    if(_activeTagFilter) list=list.filter(e=>(e.tags||[]).includes(_activeTagFilter));
    _visibleEntryCount=list.length;
    // Ordenar según preferencia
    if(_sortOrder==='name') list.sort((a,b)=>(a.service||'').localeCompare(b.service||'','es',{sensitivity:'base'}));
    else if(_sortOrder==='used') list.sort((a,b)=>(b.used||0)-(a.used||0));
    else list.sort((a,b)=>(b.updated||0)-(a.updated||0));$('entryList')&&( $('entryList').innerHTML='', list.length?list.forEach(e=>{try{$('entryList').appendChild(row(e))}catch(err){console.warn('row error',e?.id,err)}}):$('entryList').innerHTML=(()=>{
    const _q=($('search')?.value||'').trim();
    const SVG_VAULT='<div class="emptyVault"><svg viewBox="0 0 80 80" width="90" height="90" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="8" y="16" width="64" height="52" rx="10" stroke="#1a6fff" stroke-width="2.5" fill="rgba(0,80,200,.08)"/><rect x="8" y="16" width="64" height="14" rx="10" stroke="#1a6fff" stroke-width="2.5" fill="rgba(0,100,255,.15)"/><circle cx="40" cy="50" r="11" stroke="#00d4ff" stroke-width="2.5" fill="rgba(0,210,255,.06)"/><circle cx="40" cy="50" r="4" fill="#00d4ff" opacity=".7"/><line x1="40" y1="39" x2="40" y2="43" stroke="#00d4ff" stroke-width="2.5" stroke-linecap="round"/><line x1="40" y1="57" x2="40" y2="61" stroke="#00d4ff" stroke-width="2.5" stroke-linecap="round"/><line x1="29" y1="50" x2="33" y2="50" stroke="#00d4ff" stroke-width="2.5" stroke-linecap="round"/><line x1="47" y1="50" x2="51" y2="50" stroke="#00d4ff" stroke-width="2.5" stroke-linecap="round"/><rect x="62" y="40" width="8" height="16" rx="4" stroke="#1a6fff" stroke-width="2" fill="rgba(0,80,200,.1)"/></svg></div>';
    const BTN_STYLE='margin-top:16px;padding:8px 20px;border-radius:10px;background:rgba(0,210,255,.1);border:1px solid rgba(0,210,255,.2);color:var(--cyan);font-size:13px;font-weight:700;cursor:pointer';
    const WRAP='<div class="empty" style="padding:40px 16px;text-align:center">';
    if(_q && vault.length>0){
      return WRAP+'<div style="font-size:40px;margin-bottom:12px">\uD83D\uDD0D</div><b style="color:#e0f0ff;font-size:15px">Sin resultados para \u00ab'+safeEsc(_q)+'\u00bb</b><p style="color:#4a7090;margin-top:8px;font-size:13px">Prueba con otro t\u00e9rmino o revisa la ortograf\u00eda</p><button style="'+BTN_STYLE+'" onclick="if($(\'search\'))$(\'search\').value=\'\';render()">\u2715 Limpiar b\u00fasqueda</button></div>';
    } else if(_catFilter && vault.length>0){
      return WRAP+'<div style="font-size:40px;margin-bottom:12px">\uD83D\uDCC2</div><b style="color:#e0f0ff;font-size:15px">Nada en esta categor\u00eda</b><p style="color:#4a7090;margin-top:8px;font-size:13px">No tienes entradas en \u00ab'+safeEsc(categoryLabelFromId(_catFilter))+'\u00bb todav\u00eda</p><button style="'+BTN_STYLE+'" onclick="setCatFilter(\'\',null)">\u2715 Quitar filtro</button></div>';
    } else if(_activeTagFilter && vault.length>0){
      return WRAP+'<div style="font-size:40px;margin-bottom:12px">\uD83C\uDFF7\uFE0F</div><b style="color:#e0f0ff;font-size:15px">Nada con esta etiqueta</b><p style="color:#4a7090;margin-top:8px;font-size:13px">No hay entradas con la etiqueta \u00ab'+safeEsc(_activeTagFilter)+'\u00bb</p><button style="'+BTN_STYLE+'" onclick="window._activeTagFilter=\'\';render()">\u2715 Quitar etiqueta</button></div>';
    } else {
      return '<div class="empty">'+SVG_VAULT+'<b style="color:#e0f0ff;font-size:16px">Tu b\u00f3veda est\u00e1 vac\u00eda</b><p style="color:#4a7090;margin-top:6px;font-size:13px">Crea tu primera credencial con el bot\u00f3n +</p></div>';
    }
  })());
  }
  renderFav();try{renderTagFilterChips();}catch(e){}try{updateCatChipCounts();}catch(e){}let recent=[...vault].sort((a,b)=>(b.used||0)-(a.used||0)).slice(0,4);
  if($('recentList')){
    $('recentList').innerHTML='';
    if(recent.length){
      const hdr=document.createElement('div');
      hdr.style.cssText='font-size:11px;font-weight:900;color:rgba(0,210,255,.5);letter-spacing:.8px;text-transform:uppercase;padding:4px 2px 8px;margin-top:4px';
      hdr.textContent='Usadas recientemente';
      $('recentList').appendChild(hdr);
      recent.forEach(e=>{try{$('recentList').appendChild(row(e))}catch(err){console.warn('row fav error',e?.id,err)}});
    }
  }$('vaultSub')&&($('vaultSub').textContent=(_visibleEntryCount!==null&&(_catFilter||_activeTagFilter||q)?_visibleEntryCount+' filtradas':vault.length+' entradas'));$('statTotal')&&($('statTotal').textContent=vault.length);
  // Empty states
  const _ves=$('vaultEmptyState');
  if(_ves)_ves.style.display=vault.length===0?'block':'none';
  const _fes=$('favEmptyState');
  if(_fes)_fes.style.display=vault.filter(e=>e.fav).length===0?'block':'none';$('statFav')&&($('statFav').textContent=vault.filter(e=>e.fav).length);$('statWeak')&&($('statWeak').textContent=vault.filter(e=>e.entryType==='password'&&score(e.pass)<3).length);
  const _dashPasswords=vault.filter(isPasswordFamilyEntry).length;
  const _dashNotes=(typeof window.vkNotes!=='undefined'&&window.vkNotes.read)?window.vkNotes.read().length:vault.filter(e=>e.entryType==='note').length;
  const _dashCards=(typeof window.vkCards!=='undefined'&&window.vkCards.read)?window.vkCards.read().length:vault.filter(e=>e.entryType==='card').length;
  const _dashDocuments=(typeof window.vkDocuments!=='undefined'&&window.vkDocuments.read)?window.vkDocuments.read().length:vault.filter(e=>['id','license','medical'].includes(e.entryType)).length;
  const _setDashCount=(id,count,singular,plural)=>{const el=$(id);if(el)el.textContent=count+' '+(count===1?singular:plural)};
  _setDashCount('statPasswords',_dashPasswords,'elemento','elementos');
  _setDashCount('statNotes',_dashNotes,'nota','notas');
  _setDashCount('statCards',_dashCards,'tarjeta','tarjetas');
  _setDashCount('statDocuments',_dashDocuments,'documento','documentos');
}

function vk128SvgText(label,bg,fg='#fff',fs=18){return {bg,svg:`<svg viewBox="0 0 48 48" width="48" height="48" aria-hidden="true"><rect width="48" height="48" rx="12" fill="${bg}"/><text x="24" y="31" font-size="${fs}" font-weight="900" fill="${fg}" text-anchor="middle" font-family="Arial, sans-serif">${label}</text></svg>`}}
function vk128Match(n,k){k=(k||'').toLowerCase().trim();if(!k)return false;if(k.length<=2)return n===k;return n===k||n.includes(k)}
function vk128Icon(label,bg,fg='#fff',fs=18){return vk128SvgText(label,bg,fg,fs)}
function vk128Shield(){return {bg:'#061a33',svg:'<svg viewBox="0 0 48 48" width="48" height="48" aria-hidden="true"><defs><linearGradient id="vk128shield" x1="0" x2="1"><stop stop-color="#00d5ff"/><stop offset="1" stop-color="#0a84ff"/></linearGradient></defs><rect width="48" height="48" rx="12" fill="#061a33"/><path d="M24 5.5l16.5 6.2v11.1c0 10.5-7 17.4-16.5 20.7C14.5 40.2 7.5 33.3 7.5 22.8V11.7z" fill="none" stroke="url(#vk128shield)" stroke-width="3"/><path d="M18.7 23.8a5.3 5.3 0 0 1 10.6 0v2h1.6v10.5H17.1V25.8h1.6z" fill="#dff6ff"/><path d="M21.2 25.8v-2a2.8 2.8 0 1 1 5.6 0v2z" fill="#061a33"/></svg>'}}
const VK128_BRAND_ICONS=[
 {k:['google'],v:{bg:'#fff',svg:'<svg viewBox="0 0 48 48" width="48" height="48"><rect width="48" height="48" rx="24" fill="#fff"/><path fill="#EA4335" d="M24 9.4c3.6 0 6.4 1.4 8.5 3.3l6-6C34.7 3.2 29.7 1 24 1 14.7 1 6.7 6.4 3 14.2l7.3 5.6C12 13.9 17.5 9.4 24 9.4z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.6h12.7c-.6 3-2.3 5.5-4.8 7.2l7.4 5.7c4.3-4 7.2-9.8 7.2-17z"/><path fill="#FBBC05" d="M10.3 28.2A14.7 14.7 0 0 1 9.5 24c0-1.5.3-2.9.8-4.2L3 14.2a23 23 0 0 0 0 19.6z"/><path fill="#34A853" d="M24 47c6.2 0 11.4-2 15.3-5.5l-7.4-5.7c-2 1.3-4.6 2.1-7.9 2.1-6.5 0-12-4.4-13.7-10.3L3 33.8C6.7 41.6 14.7 47 24 47z"/></svg>'}},
 {k:['gmail','mail','correo'],v:{bg:'#fff',svg:'<svg viewBox="0 0 48 48" width="48" height="48"><rect width="48" height="48" rx="12" fill="#fff"/><path fill="#4285F4" d="M6 39h8V23L4 15v22a2 2 0 0 0 2 2z"/><path fill="#34A853" d="M34 39h8a2 2 0 0 0 2-2V15l-10 8z"/><path fill="#FBBC05" d="M34 10L24 18 14 10H6l18 14 18-14z"/><path fill="#EA4335" d="M4 15l10 8V10H7a3 3 0 0 0-3 5z"/><path fill="#C5221F" d="M44 15l-10 8V10h7a3 3 0 0 1 3 5z"/></svg>'}},
 {k:['facebook','fb'],v:vk128Icon('f','#1877F2','#fff',28)},
 {k:['instagram','insta'],v:{bg:'#C13584',svg:'<svg viewBox="0 0 48 48" width="48" height="48"><defs><radialGradient id="vk128ig" cx="30%" cy="107%" r="150%"><stop stop-color="#fdf497"/><stop offset=".45" stop-color="#fd5949"/><stop offset=".68" stop-color="#d6249f"/><stop offset="1" stop-color="#285AEB"/></radialGradient></defs><rect width="48" height="48" rx="12" fill="url(#vk128ig)"/><rect x="12" y="12" width="24" height="24" rx="7" fill="none" stroke="#fff" stroke-width="3"/><circle cx="24" cy="24" r="6" fill="none" stroke="#fff" stroke-width="3"/><circle cx="33" cy="15" r="2" fill="#fff"/></svg>'}},
 {k:['whatsapp','whats app'],v:{bg:'#25D366',svg:'<svg viewBox="0 0 48 48" width="48" height="48"><circle cx="24" cy="24" r="22" fill="#25D366"/><path d="M34 14a13 13 0 0 0-22 13l-2 7 7-2a13 13 0 0 0 17-18zm-10 18a9 9 0 0 1-5-1.5L15 31l1-4a9 9 0 1 1 8 5z" fill="#fff"/><path d="M19 19c1 5 5 8 10 10l2-3-3-2-1.5 1.2c-2.2-1.1-3.7-2.6-4.8-4.8L23 19l-2.8-2z" fill="#25D366"/></svg>'}},
 {k:['telegram'],v:{bg:'#229ED9',svg:'<svg viewBox="0 0 48 48" width="48" height="48"><circle cx="24" cy="24" r="22" fill="#229ED9"/><path d="M9 23.5l29-11.3c1.4-.5 2.5.4 2.1 2L35.5 37c-.3 1.6-1.4 2-2.8 1.2l-7.7-5.7-3.7 3.6c-.4.4-.8.8-1.6.8l.6-8.3 15.1-13.7c.7-.6-.1-.9-1-.4L15.7 26.3 8 23.9c-1.6-.5-1.6-1.6 1-.4z" fill="#fff"/></svg>'}},
 {k:['youtube'],v:{bg:'#FF0000',svg:'<svg viewBox="0 0 48 48" width="48" height="48"><rect width="48" height="48" rx="12" fill="#FF0000"/><path d="M20 15.5l15 8.5-15 8.5z" fill="#fff"/></svg>'}},
 {k:['netflix'],v:vk128Icon('N','#141414','#E50914',28)},
 {k:['amazon'],v:vk128Icon('a','#FF9900','#131921',27)},
 {k:['paypal'],v:vk128Icon('P','#009CDE','#fff',25)},
 {k:['tiktok'],v:vk128Icon('♪','#010101','#fff',27)},
 {k:['spotify'],v:{bg:'#1DB954',svg:'<svg viewBox="0 0 48 48" width="48" height="48"><circle cx="24" cy="24" r="22" fill="#1DB954"/><path d="M14 18c7-2 15-1.6 21.5 2" stroke="#fff" stroke-width="3" stroke-linecap="round" fill="none"/><path d="M15.5 25c5.8-1.6 12.4-1.3 17.5 1.7" stroke="#fff" stroke-width="3" stroke-linecap="round" fill="none"/><path d="M17 31.5c4.4-1.2 9.2-1 13 1.2" stroke="#fff" stroke-width="3" stroke-linecap="round" fill="none"/></svg>'}},
 {k:['discord'],v:vk128Icon('☯','#5865F2','#fff',25)},
 {k:['reddit'],v:{bg:'#FF4500',svg:'<svg viewBox="0 0 48 48" width="48" height="48"><circle cx="24" cy="24" r="22" fill="#FF4500"/><circle cx="17" cy="25" r="3" fill="#fff"/><circle cx="31" cy="25" r="3" fill="#fff"/><path d="M17 32c4 3 10 3 14 0" stroke="#fff" stroke-width="3" stroke-linecap="round" fill="none"/></svg>'}},
 {k:['github','github2','git'],v:{bg:'#24292F',svg:'<svg viewBox="0 0 48 48" width="48" height="48"><circle cx="24" cy="24" r="22" fill="#24292F"/><path d="M24 8a16 16 0 0 0-5 31c1 0 1-1 1-1v-4c-6 1-7-2-7-2-1-3-3-3-3-3-2-2 0-2 0-2 3 0 4 2 4 2 2 3 5 2 6 2 0-1 1-2 2-3-5 0-10-2-10-10 0-2 1-4 2-6-1-1-2-4 0-7 0 0 2-1 7 2a21 21 0 0 1 12 0c5-3 7-2 7-2 2 3 1 6 0 7 1 2 2 4 2 6 0 8-5 10-10 10 1 1 2 3 2 5v7s0 1 1 1A16 16 0 0 0 24 8z" fill="#fff"/></svg>'}},
 {k:['linkedin'],v:vk128Icon('in','#0A66C2','#fff',20)},
 {k:['dropbox'],v:vk128Icon('◆','#0061FF','#fff',25)},
 {k:['banco','bank','bbva','santander','caixa','mercantil','banesco','venezuela','revolut','wise','n26','ing','zelle','bancovenezuela'],v:{bg:'#1A3A6B',svg:'<svg viewBox="0 0 48 48" width="48" height="48"><rect width="48" height="48" rx="12" fill="#1A3A6B"/><polygon points="5,20 24,8 43,20" fill="#FFD700"/><rect x="9" y="21" width="5" height="15" fill="#FFD700"/><rect x="18" y="21" width="5" height="15" fill="#FFD700"/><rect x="27" y="21" width="5" height="15" fill="#FFD700"/><rect x="36" y="21" width="5" height="15" fill="#FFD700"/><rect x="6" y="37" width="36" height="4" fill="#FFD700"/></svg>'}},
 {k:['wifi','wi-fi','router'],v:{bg:'#00B4D8',svg:'<svg viewBox="0 0 48 48" width="48" height="48"><rect width="48" height="48" rx="12" fill="#00B4D8"/><path d="M8 20c9-9 23-9 32 0M13 27c6-6 16-6 22 0M19 34c3-3 7-3 10 0" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/><circle cx="24" cy="39" r="2.5" fill="#fff"/></svg>'}},
 {k:['cloud','icloud','drive','google drive','respaldo','backup'],v:{bg:'#0A84FF',svg:'<svg viewBox="0 0 48 48" width="48" height="48"><rect width="48" height="48" rx="12" fill="#0A84FF"/><path d="M17 34h18a7 7 0 0 0 0-14 11 11 0 0 0-21-2A8 8 0 0 0 17 34z" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>'}},
 {k:['compras','shopping','shop','tienda'],v:{bg:'#16A34A',svg:'<svg viewBox="0 0 48 48" width="48" height="48"><rect width="48" height="48" rx="12" fill="#16A34A"/><path d="M15 18h26l-4 13H18z" fill="none" stroke="#fff" stroke-width="3" stroke-linejoin="round"/><path d="M15 18l-2-6H8" stroke="#fff" stroke-width="3" stroke-linecap="round" fill="none"/><circle cx="20" cy="37" r="2.5" fill="#fff"/><circle cx="35" cy="37" r="2.5" fill="#fff"/></svg>'}},
 {k:['trabajo','work','empresa','office'],v:vk128Icon('💼','#475569','#fff',22)},
 {k:['boveda','bóveda','safe','vault','vaultkey'],v:vk128Shield()},
 {k:['binance','crypto','bitcoin','cripto','coinbase','kraken','metamask','trustwallet','solana','ethereum','wallet'],v:{bg:'#F3BA2F',svg:'<svg viewBox="0 0 48 48" width="48" height="48"><rect width="48" height="48" rx="12" fill="#F3BA2F"/><path d="M24 8l4 4-4 4-4-4zM14 18l4 4-4 4-4-4zM34 18l4 4-4 4-4-4zM24 28l4 4-4 4-4-4z" fill="#fff"/><rect x="20" y="20" width="8" height="8" transform="rotate(45 24 24)" fill="#fff"/></svg>'}},
 {k:['proton','protonmail'],v:{bg:'#6D4AFF',svg:'<svg viewBox="0 0 48 48" width="48" height="48"><rect width="48" height="48" rx="12" fill="#6D4AFF"/><path d="M10 12h16a12 12 0 0 1 0 24H10z" fill="#fff" fill-opacity=".9"/><rect x="10" y="24" width="8" height="12" rx="2" fill="#fff"/></svg>'}},
 {k:['card','tarjeta','visa','mastercard'],v:{bg:'#0f766e',svg:'<svg viewBox="0 0 48 48" width="48" height="48"><rect width="48" height="48" rx="12" fill="#0f766e"/><rect x="6" y="14" width="36" height="20" rx="3" fill="none" stroke="#fff" stroke-width="2.5"/><rect x="6" y="21" width="36" height="6" fill="#FFD700" opacity=".7"/><rect x="10" y="27" width="10" height="3" rx="1" fill="#fff"/></svg>'}}
];
// Deduplicar VK128_BRAND_ICONS — elimina entradas con claves ya registradas
(function(){
  const seen=new Set();
  const deduped=[];
  for(const item of VK128_BRAND_ICONS){
    const newKeys=(item.k||[]).filter(k=>!seen.has(k));
    if(newKeys.length){
      newKeys.forEach(k=>seen.add(k));
      deduped.push({k:newKeys,v:item.v});
    }
  }
  VK128_BRAND_ICONS.length=0;
  deduped.forEach(x=>VK128_BRAND_ICONS.push(x));
})();
serviceIcon=function(s){const n=(s||'').toLowerCase().trim();if(!n)return vk128Shield();for(const item of VK128_BRAND_ICONS){if(item.k.some(k=>vk128Match(n,k)))return item.v;}return vk128Shield();}
function iconFromKey(id){
  if(!id||id==='auto')return null;
  // Buscar primero en VK128_BRAND_ICONS (tienen svg real)
  if(typeof VK128_BRAND_ICONS!=='undefined'){
    for(const b of VK128_BRAND_ICONS){
      if(b.k&&b.k.includes(id))return b.v;
    }
  }
  // Buscar en MANUAL_ICONS y generar SVG desde emoji o label
  const ic=MANUAL_ICONS.find(x=>x.id===id);
  if(!ic)return null;
  const label=ic.emoji||ic.label||ic.id||'?';
  const fs=String(label).length>2?14:String(label).length===2?20:24;
  const {svg}=vk128SvgText(label,ic.bg||'#0a84ff','#fff',fs);
  return {bg:ic.bg||'#0a84ff',svg,id:ic.id,label:ic.label||ic.id};
}function _iconByServiceName(s){try{return serviceIcon(s||"");}catch(e){return null;}}
function iconForEntry(e){
  if(e?.icon&&e.icon!=='auto'){const m=iconFromKey(e.icon);if(m&&m.svg)return m;}
  const byName=_iconByServiceName(e?.service);
  if(byName)return byName;
  return serviceIcon([e?.service,e?.url,e?.type].filter(Boolean).join(' '));
}
function vkLogoHTML(ic,cls='logo',sz=null){ic=ic&&ic.svg?ic:vk128Shield();const svg=ic.svg.replace(/<svg ([^>]*?)width="[^"]*"\s*/,'<svg $1').replace(/<svg ([^>]*?)height="[^"]*"\s*/,'<svg $1').replace(/<svg /,'<svg style="width:100%;height:100%;display:block" ');const sizeStyle=sz?`width:${sz}px;height:${sz}px;`:'' ;return `<div class="${cls}" style="background:${ic.bg};padding:0;overflow:hidden;${sizeStyle}">${svg}</div>`}
let currentIconCat='todos';
window._setIconCat=function(cat,btn){currentIconCat=cat;document.querySelectorAll('.iconCat').forEach(b=>b.classList.remove('active'));if(btn)btn.classList.add('active');const s=$('eIconSearch');if(s)s.value='';if(typeof renderIconPicker==='function')renderIconPicker();};
document.addEventListener('click',function(e){const btn=e.target.closest('[data-cat]');if(btn&&btn.classList.contains('iconCat')){e.stopPropagation();window._setIconCat(btn.dataset.cat,btn);}});


function currentPassFor(id){const e=vault.find(x=>x.id===id);return e&&e.pass?e.pass:'';}
function currentUserFor(id){const e=vault.find(x=>x.id===id);return e&&(e.user||e.email)?e.user||e.email:'';}
function row(e){
  e = Object.assign({}, e, {
    service: e.service || e.title || '',
    user: e.user || e.username || e.email || '',
    pass: e.pass || e.password || '',
    entryType: e.entryType || e.type || 'password'
  });

  let div=document.createElement('div');
  div.className='entry';
  div.onclick=()=>openFavoriteEntry(e);
  let ic=iconForEntry(e);
  const weak=e?.entryType==='password'&&score(e.pass)<3;
  const isPass=!e?.entryType||e?.entryType==='password';
  const typeEmoji=e?.entryType==='note'?'📝':e?.entryType==='card'?'💳':e?.entryType==='id'?'🪷':e?.entryType==='license'?'🚗':e?.entryType==='medical'?'🏥':e?.entryType==='wifi'?'📶':'🔑';
  const hasUser=!!(e.user||e.email);
  const hasPass=!!e.pass;
  const eid=e.id;
  const BTN='cursor:pointer;border:none;border-radius:8px;padding:5px 7px;font-size:13px;display:flex;align-items:center;justify-content:center;transition:.15s;background:rgba(0,180,255,.08);color:#4a9ec0;';
  let rightCol;
  if(isPass){
    const uBtn=document.createElement('button');
    uBtn.title='Copiar usuario';
    uBtn.setAttribute('aria-label','Copiar usuario');
    uBtn.style.cssText=BTN+(hasUser?'':'opacity:.25;pointer-events:none;');
    uBtn.textContent='👤';
    uBtn.onclick=ev=>{ev.stopPropagation();if(!hasUser)return;vibe(25);soundCopy();copyText(currentUserFor(eid));toast('👤 Usuario copiado');};
    const pBtn=document.createElement('button');
    pBtn.title='Copiar contraseña';
    pBtn.setAttribute('aria-label','Copiar contraseña');
    pBtn.style.cssText=BTN+(hasPass?'':'opacity:.25;pointer-events:none;');
    pBtn.textContent='🔑';
    pBtn.onclick=ev=>{ev.stopPropagation();if(!hasPass)return;vibe(25);soundCopy();copyText(currentPassFor(eid));toast('🔑 Contraseña copiada');};
    rightCol=document.createElement('div');
    rightCol.style.cssText='display:flex;flex-direction:column;gap:5px;flex-shrink:0';
    rightCol.appendChild(uBtn);
    rightCol.appendChild(pBtn);
  } else {
    rightCol=document.createElement('div');
    rightCol.style.cssText='display:flex;flex-direction:column;align-items:center;gap:6px';
    rightCol.innerHTML='<span style="font-size:14px;opacity:.7">'+typeEmoji+'</span><div class="go" style="color:rgba(0,210,255,.4);font-size:18px">›</div>';
  }
  div.innerHTML=`${vkLogoHTML(ic)}<div style="flex:1;min-width:0"><h3 style="display:flex;align-items:center;gap:6px">${safeEsc(e.service)}${e.fav?'<span style="font-size:11px">⭐</span>':''} ${weak?'<span style="font-size:9px;background:rgba(255,77,85,.2);color:#ff8c94;border:1px solid rgba(255,77,85,.3);border-radius:6px;padding:1px 5px;font-weight:900;letter-spacing:.3px">DÉBIL</span>':''}</h3><p style="color:#7a9ec0">${esc(entryMainIdentity(e))}</p></div>`;
  div.appendChild(rightCol);
  return div}

let _favoriteSearchQuery='';
function favoriteEntryKind(e){
  const type=(e?.entryType||e?.type||'password').toLowerCase();
  if(type==='password'){
    const subtype=(e?.subtype||'web').toLowerCase();
    return ['web','wifi','pin','recovery'].includes(subtype)?subtype:'web';
  }
  return type;
}
function openFavoriteEntry(e){
  if(isPasswordFamilyEntry(e))openPasswordDetail(e.id);
  else if(e.type==='note')window.showNoteDetail(e.id);
  else if(e.type==='card')window.showCardDetail(e.id);
  else if(e.type==='document')window.showDocumentDetail(e.id);
  else quick(e.id);
}
function favoriteSearchMarkup(){
  return '<label class="vk-favorites-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg><input id="favoriteSearch" type="search" aria-label="Buscar favorito" placeholder="Buscar favorito..." value="'+safeEsc(_favoriteSearchQuery)+'"></label>';
}
function bindFavoriteSearch(){
  const input=$('favoriteSearch');
  if(!input)return;
  input.addEventListener('input',()=>{_favoriteSearchQuery=input.value;renderFav();const next=$('favoriteSearch');if(next){next.focus();next.setSelectionRange(next.value.length,next.value.length);}});
}
function renderFav(){
  const grid=$('favGrid');
  const countEl=$('favCount');
  if(!grid)return;
  const allFavs=vault.filter(e=>e.fav);
  const query=_favoriteSearchQuery.trim().toLowerCase();
  const favs=allFavs.filter(e=>!query||entrySearchText(e).includes(query));
  const root=$('fav');
  if(root){
    root.classList.toggle('vk-favorites-root--empty',!favs.length);
    root.classList.toggle('vk-favorites-root--content',Boolean(favs.length));
  }
  if(countEl)countEl.textContent=favs.length?favs.length+' favorito'+(favs.length===1?'':'s'):'';
  if(!favs.length){
    const hasFavorites=allFavs.length>0;
    grid.innerHTML='<section id="favEmptyState" class="vk-favorites-empty">'+favoriteSearchMarkup()+'<div class="vk-favorites-empty__message"><h2>'+(hasFavorites?'No se encontraron favoritos':'Aún no tienes favoritos')+'</h2><p>'+(hasFavorites?'Prueba con otra palabra o revisa la búsqueda.':'Marca elementos importantes para encontrarlos más rápido.')+'</p><svg class="vk-favorites-empty__icon" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m32 6 8.03 16.27L58 24.88 45 37.55 48.07 55 32 46.55 15.93 55 19 37.55 6 24.88l17.97-2.61L32 6Z"/></svg></div></section>';
    bindFavoriteSearch();
    return;
  }
  grid.innerHTML=favoriteSearchMarkup();
  bindFavoriteSearch();
  favs.forEach(e=>{
    const type=favoriteEntryKind(e);
    const icons={
      web:passwordFamilyKeySvg(),
      pin:passwordFamilyKeySvg(),
      recovery:passwordFamilyKeySvg(),
      wifi:'<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 9.5a11 11 0 0 1 14 0M8 13a6.5 6.5 0 0 1 8 0M11 16.5a2 2 0 0 1 2 0" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="19" r="1" fill="currentColor"/></svg>',
      card:'<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="2"/><path d="M3 10h18M7 15h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
      id:'<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" stroke-width="2"/><circle cx="8" cy="10" r="2" stroke="currentColor" stroke-width="2"/><path d="M5.5 16a3 3 0 0 1 5 0M14 9h4M14 13h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
      license:'<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" stroke-width="2"/><circle cx="8" cy="10" r="2" stroke="currentColor" stroke-width="2"/><path d="M5.5 16a3 3 0 0 1 5 0M14 9h4M14 13h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
      note:'<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 3h9l3 3v15H6Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M14 3v4h4M9 11h6M9 15h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
      medical:'<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 4h6v5h5v6h-5v5H9v-5H4V9h5Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>'
    };
    const subtitles={
      web:e.user||e.username||e.email||e.url||'Contraseña web',
      pin:'PIN',
      recovery:'Código de recuperación',
      wifi:e.wifiSsid||e.service||'Red Wi-Fi',
      card:[e.cardType,e.cardNumber?'•••• '+String(e.cardNumber).slice(-4):''].filter(Boolean).join(' · ')||'Tarjeta',
      id:[e.idType,e.idNumber?'••• '+String(e.idNumber).slice(-3):''].filter(Boolean).join(' · ')||'Documento',
      license:e.licCategory?'Licencia · '+e.licCategory:'Licencia',
      note:'Nota segura',
      medical:e.medBlood?'Datos médicos · '+e.medBlood:'Datos médicos'
    };
    const row=document.createElement('button');
    row.type='button';
    row.className='vk-favorites-row';
    row.setAttribute('aria-label','Abrir '+(e.service||e.title||'favorito'));
    row.onclick=()=>openFavoriteEntry(e);
    row.innerHTML=`<span class="vk-favorites-row__icon">${icons[type]||icons.web}</span><span class="vk-favorites-row__copy"><strong>${safeEsc(e.service||e.title||'Sin título')}</strong><span>${safeEsc(subtitles[type]||'Elemento protegido')}</span></span><svg class="vk-favorites-row__star" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg><svg class="vk-favorites-row__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>`;
    grid.appendChild(row);
  });
}
function quick(id){let e=vault.find(x=>x.id===id);if(!e)return;e.used=Date.now();persist().catch(err=>console.warn('quick persist:',err));current=e;let ic=iconForEntry(e);const u=userFromEntry(e);const em=legacyEmailFromEntry(e);

/* ── Top bar ── */
let h='<div style="height:58px;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;padding:0 4px">';
h+='<button class="linkBtn" onclick="closeModals()" style="text-align:left;padding:8px 12px">\u2190 Atr\u00e1s</button>';
h+='<span style="font-size:16px;font-weight:900;color:#fff">Detalle</span>';
h+='<button class="linkBtn" onclick="closeModals();openEntry(current)" style="text-align:right;padding:8px 12px;color:var(--cyan);font-weight:900">Editar</button></div>';

/* ── Hero ── */
h+='<div style="display:flex;flex-direction:column;align-items:center;padding:28px 0 30px;position:relative">';
h+='<div class="qvHeroGlow"></div>';
h+='<div style="position:relative;margin-bottom:18px">';
h+='<div style="width:100px;height:100px;border-radius:28px;overflow:hidden;box-shadow:0 0 0 3px rgba(0,210,255,.22),0 16px 48px rgba(0,0,0,.7),0 0 40px rgba(0,130,255,.15)">'+vkLogoHTML(ic,'logo',100)+'</div>';
if(e.fav)h+='<div style="position:absolute;bottom:-7px;right:-7px;width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#ffd447,#ffb020);display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 2px 10px rgba(0,0,0,.5)">\u2b50</div>';
h+='</div>';
h+='<div style="font-size:26px;font-weight:950;color:#fff;letter-spacing:-.5px;margin-bottom:8px">'+safeEsc(e.service)+'</div>';
h+='<div style="font-size:11px;color:#4a7898;font-weight:800;letter-spacing:.8px;text-transform:uppercase;background:rgba(0,150,255,.08);border:1px solid rgba(0,150,255,.15);border-radius:20px;padding:4px 12px">'+esc(e.type||'Cuenta')+'</div>';
h+='</div>';

/* ── Campo helper ── */
function qvRow(label,icon,value,actions,last){
  return '<div class="qvFieldRow'+(last?' qvFieldRowLast':'')+'"><div class="qvFieldIcon">'+icon+'</div><div style="flex:1;min-width:0"><div class="qvFieldLabel">'+label+'</div><div class="qvFieldValue">'+value+'</div></div>'+(actions?'<div style="display:flex;gap:6px;margin-left:8px">'+actions+'</div>':'')+'</div>';
}
function qvBtn(label,onclick){
  return '<button onclick="'+onclick+'" class="qvActionBtn">'+label+'</button>';
}

/* ── Campos ── */
h+='<div style="border-radius:20px;overflow:hidden;border:1px solid rgba(0,180,255,.14);margin-bottom:6px;box-shadow:0 4px 24px rgba(0,0,0,.35)">';
if(e.entryType==='note'){
  h+=qvRow('Nota segura','📝','<span id="qvNote" style="font-family:ui-monospace,monospace;letter-spacing:.5px">••••••••</span>',qvBtn('Ver','toggleQvNote()')+qvBtn('Copiar','copyText(current.note,this)'),true);
} else if(e.entryType==='card'){
  const maskedNum=e.cardNumber?'•••• •••• •••• '+e.cardNumber.slice(-4):'—';
  if(e.cardName)h+=qvRow('Titular','👤',esc(e.cardName),qvBtn('Copiar','copyText(current.cardName,this)'));
  h+=qvRow('Número','💳','<span id="qvCardNum" style="font-family:ui-monospace,monospace;letter-spacing:.5px">'+esc(maskedNum)+'</span>',qvBtn('Ver','toggleQvCard()')+qvBtn('Copiar','copyText(current.cardNumber,this)'));
  if(e.cardExpiry)h+=qvRow('Caducidad','📅',esc(e.cardExpiry),'');
  if(e.cardCvv)h+=qvRow('CVV','🔒','<span id="qvCvv">•••</span>',qvBtn('Ver','toggleQvCvv()'));
  if(e.cardType)h+=qvRow('Tipo','💳',esc(e.cardType.charAt(0).toUpperCase()+e.cardType.slice(1)),'',true);
} else if(e.entryType==='id'){
  if(e.idName)h+=qvRow('Nombre','👤',esc(e.idName),qvBtn('Copiar','copyText(current.idName,this)'));
  if(e.idNumber)h+=qvRow('Número','🪪','<span style="font-family:ui-monospace,monospace">'+esc(e.idNumber)+'</span>',qvBtn('Copiar','copyText(current.idNumber,this)'));
  if(e.idType)h+=qvRow('Tipo','📄',esc(e.idType.toUpperCase()),'');
  if(e.idDob)h+=qvRow('Nacimiento','🎂',esc(e.idDob),'');
  if(e.idExpiry)h+=qvRow('Caducidad','📅',esc(e.idExpiry),'');
  if(e.idCountry)h+=qvRow('País','🌍',esc(e.idCountry),'',true);
} else if(e.entryType==='license'){
  if(e.licName)h+=qvRow('Nombre','👤',esc(e.licName),qvBtn('Copiar','copyText(current.licName,this)'));
  if(e.licNumber)h+=qvRow('Número','🚗','<span style="font-family:ui-monospace,monospace">'+esc(e.licNumber)+'</span>',qvBtn('Copiar','copyText(current.licNumber,this)'));
  if(e.licCategory)h+=qvRow('Categorías','🏷️',esc(e.licCategory),'');
  if(e.licIssued)h+=qvRow('Emisión','📅',esc(e.licIssued),'');
  if(e.licExpiry)h+=qvRow('Caducidad','📅',esc(e.licExpiry),'');
  if(e.licCountry)h+=qvRow('País','🌍',esc(e.licCountry),'',true);
} else if(e.entryType==='medical'){
  if(e.medName)h+=qvRow('Paciente','👤',esc(e.medName),qvBtn('Copiar','copyText(current.medName,this)'));
  if(e.medSS)h+=qvRow('Nº SS / SIP','🏥','<span style="font-family:ui-monospace,monospace">'+esc(e.medSS)+'</span>',qvBtn('Copiar','copyText(current.medSS,this)'));
  if(e.medBlood)h+=qvRow('Grupo sanguíneo','🩸',esc(e.medBlood),'');
  if(e.medAllergies)h+=qvRow('Alergias','⚠️',esc(e.medAllergies),'');
  if(e.medMeds)h+=qvRow('Medicación','💊',esc(e.medMeds),'');
  if(e.medDoctor)h+=qvRow('Médico / Centro','🩺',esc(e.medDoctor),'');
  if(e.medNotes)h+=qvRow('Notas','📝',esc(e.medNotes),'',true);
} else if(e.entryType==='wifi'){
  if(e.wifiSsid)h+=qvRow('Red (SSID)','📶',esc(e.wifiSsid),qvBtn('Copiar','copyText(current.wifiSsid,this)'));
  h+=qvRow('Contraseña','🔒','<span id="qvWifiPass" style="font-family:ui-monospace,monospace;letter-spacing:.5px">••••••••</span>',qvBtn('Ver','toggleQvWifiPass()')+qvBtn('Copiar','copyText(current.wifiPass,this)'));
  if(e.wifiSec)h+=qvRow('Seguridad','🔐',esc(e.wifiSec),'');
  if(e.wifiRouter)h+=qvRow('Router / ISP','📡',esc(e.wifiRouter),'');
  if(e.wifiIp)h+=qvRow('IP','🌐',esc(e.wifiIp),qvBtn('Copiar','copyText(current.wifiIp,this)'),true);
} else {
if(u)h+=qvRow('Usuario','\ud83d\udc64',esc(u),qvBtn('Copiar','copyText(userFromEntry(current),this)'));
if(em)h+=qvRow('Correo','\u2709\ufe0f',esc(em),qvBtn('Copiar','copyText(legacyEmailFromEntry(current),this)'));
h+=qvRow('Contrase\u00f1a','\ud83d\udd11','<span id="qvPass" style="font-family:ui-monospace,monospace;letter-spacing:.5px">\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022</span>',qvBtn('Ver','toggleQvPass()')+qvBtn('Copiar','copyText(current.pass,this)'));
if(e.url)h+=qvRow('Sitio web','\ud83c\udf10','<span style="color:#00d4ff;font-size:14px">'+esc(e.url)+'</span>',qvBtn('Abrir','openUrl(current.url)'));
if(e.note)h+=qvRow('Nota','\ud83d\udcdd','<span style="color:#b0cce8;font-size:14px;line-height:1.4">'+esc(e.note)+'</span>','',true);
}
h+='</div>';

/* ── Etiquetas ── */
if(e.tags&&e.tags.length){
  h+='<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;padding:0 2px">';
  e.tags.forEach(function(t){
    h+='<span style="display:inline-flex;align-items:center;background:rgba(0,180,255,.1);border:1px solid rgba(0,180,255,.25);border-radius:20px;padding:3px 10px;font-size:11px;font-weight:700;color:#00b8e6;cursor:pointer" onclick="setTagFilter(this.dataset.tag);closeModals();show(\u0027vault\u0027)" data-tag="'+esc(t)+'">#'+esc(t)+'</span>';
  });
  h+='</div>';
}
/* ── Timestamp ── */
const updated=e.updated?new Date(e.updated).toLocaleDateString('es-ES',{day:'numeric',month:'short',year:'numeric'}):'--';
h+='<div class="qvTimestamp">Actualizado el '+updated+'</div>';

/* ── Boton editar principal ── */
h+='<button class="qvBotEdit" onclick="closeModals();openEntry(current)" style="width:100%;margin-bottom:10px">\u270e Editar entrada</button>';

/* ── Historial de contraseñas ── */
if(e.entryType!=='note' && e.passHistory && e.passHistory.length > 0) {
  h += '<div style="margin-bottom:12px;background:rgba(0,14,32,.6);border:1px solid rgba(0,210,255,.1);border-radius:14px;padding:14px">';
  h += '<div style="font-size:11px;font-weight:900;color:var(--cyan);letter-spacing:.6px;margin-bottom:10px">🕐 HISTORIAL DE CONTRASEÑAS</div>';
  e.passHistory.forEach(function(h_item, idx_h) {
    const dateStr = h_item.date ? new Date(h_item.date).toLocaleDateString('es-ES') : '—';
    // Store pass in data attribute to avoid escaping issues
    h += '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px;background:rgba(255,255,255,.03);border-radius:8px;margin-bottom:6px">';
    h += '<div style="flex:1;min-width:0">';
    h += '<div style="font-size:12px;color:#4a7090;margin-bottom:2px">Anterior ' + (idx_h+1) + ' · ' + dateStr + '</div>';
    h += '<div class="histPassEl" style="font-family:monospace;font-size:13px;color:#7aa0c8" data-pass="' + safeEsc(h_item.pass||'') + '">••••••••</div>';
    h += '</div>';
    h += '<button onclick="toggleHistPass(this)" style="font-size:11px;padding:4px 8px;margin-left:8px;background:rgba(0,210,255,.1);border:1px solid rgba(0,210,255,.2);border-radius:6px;color:var(--cyan);flex-shrink:0">Ver</button>';
    h += '</div>';
  });
  h += '</div>';
}

/* ── Acciones secundarias ── */
h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">';
h+='<button class="qvBotBtn '+(e.fav?'qvBotFavActive':'qvBotFav')+'" onclick="toggleFav(current.id)">'+(e.fav?'\u2736 Quitar fav':'\u2606 Favorito')+'</button>';
h+='<button class="qvBotBtn qvBotDel" onclick="delEntry(current.id)">\ud83d\uddd1 Eliminar</button>';
h+='</div>';

$('quickBody').innerHTML=h;$('quickModal').classList.add('open');render();}

(function(){
  function normVK(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();}
  const extraBrands=[
    ['outlook,hotmail,live mail,microsoft mail', vk128Icon('O','#0078D4','#fff',25)],
    ['yahoo,yahoo mail', vk128Icon('Y!','#6001D2','#fff',20)],
    ['icloud,apple cloud', vk128Icon('☁','#6DB8FF','#fff',25)],
    ['google drive,drive', vk128Icon('D','#0F9D58','#fff',25)],
    ['onedrive,one drive', vk128Icon('☁','#0078D4','#fff',25)],
    ['mega,mega nz', vk128Icon('M','#D9272E','#fff',25)],
    ['microsoft,office,outlook office', vk128Icon('MS','#F25022','#fff',17)],
    ['apple,apple id,app store', vk128Icon('A','#111827','#fff',25)],
    ['adobe', vk128Icon('A','#FA0F00','#fff',25)],
    ['canva', vk128Icon('C','#00C4CC','#fff',25)],
    ['notion', vk128Icon('N','#ffffff','#111827',25)],
    ['slack', vk128Icon('S','#4A154B','#fff',25)],
    ['trello', vk128Icon('T','#0079BF','#fff',25)],
    ['zoom', vk128Icon('Z','#2D8CFF','#fff',25)],
    ['chatgpt,openai', vk128Icon('AI','#10A37F','#fff',18)],
    ['x,twitter,x.com', vk128Icon('X','#000000','#fff',25)],
    ['snapchat,snap', vk128Icon('S','#FFFC00','#111827',25)],
    ['pinterest', vk128Icon('P','#E60023','#fff',25)],
    ['threads', vk128Icon('@','#000000','#fff',25)],
    ['messenger,facebook messenger', vk128Icon('M','#00B2FF','#fff',25)],
    ['signal', vk128Icon('S','#3A76F0','#fff',25)],
    ['twitch', vk128Icon('T','#9146FF','#fff',25)],
    ['gitlab', vk128Icon('GL','#FC6D26','#fff',16)],
    ['bitbucket', vk128Icon('BB','#0052CC','#fff',16)],
    ['steam', vk128Icon('S','#1B2838','#C7D5E0',25)],
    ['epic games,epic', vk128Icon('EP','#313131','#fff',18)],
    ['playstation,psn,ps plus', vk128Icon('PS','#003791','#fff',18)],
    ['xbox', vk128Icon('X','#107C10','#fff',25)],
    ['nintendo', vk128Icon('N','#E60012','#fff',25)],
    ['roblox', vk128Icon('R','#111827','#fff',25)],
    ['minecraft', vk128Icon('MC','#62B541','#fff',17)],
    ['disney,disney plus,disney+', vk128Icon('D+','#113CCF','#fff',18)],
    ['hbo,max,hbo max', vk128Icon('MAX','#5822B4','#fff',14)],
    ['prime video,amazon prime', vk128Icon('PV','#00A8E1','#fff',16)],
    ['hulu', vk128Icon('H','#1CE783','#111827',25)],
    ['crunchyroll', vk128Icon('CR','#F47521','#fff',16)],
    ['revolut', vk128Icon('R','#111827','#fff',25)],
    ['wise,transferwise', vk128Icon('W','#9FE870','#111827',25)],
    ['zelle', vk128Icon('Z','#6D1ED4','#fff',25)],
    ['payoneer', vk128Icon('PY','#FF4800','#fff',17)],
    ['binance', vk128Icon('BN','#F3BA2F','#111827',17)],
    ['coinbase', vk128Icon('C','#0052FF','#fff',25)],
    ['mercado pago,mercadopago', vk128Icon('MP','#00AEEF','#fff',16)],
    ['mercado libre,mercadolibre', vk128Icon('ML','#FFE600','#2D3277',17)],
    ['bbva', vk128Icon('BBVA','#004481','#fff',13)],
    ['santander', vk128Icon('S','#EC0000','#fff',25)],
    ['banesco', vk128Icon('B','#00843D','#fff',25)],
    ['chase', vk128Icon('C','#117ACA','#fff',25)],
    ['bank of america,boa', vk128Icon('BOA','#E31837','#fff',14)],
    ['wells fargo', vk128Icon('WF','#D71E28','#FFD200',17)],
    ['aliexpress,ali express', vk128Icon('Ali','#E62E04','#fff',18)],
    ['shein', vk128Icon('SH','#111827','#fff',18)],
    ['temu', vk128Icon('T','#FF6A00','#fff',25)],
    ['ebay', vk128Icon('eB','#E53238','#fff',18)],
    ['wallapop', vk128Icon('W','#13C1AC','#fff',25)],
    ['uber', vk128Icon('U','#000000','#fff',25)],
    ['uber eats,ubereats', vk128Icon('UE','#06C167','#111827',17)],
    ['glovo', vk128Icon('G','#F2CC38','#111827',25)],
    ['pedidosya,pedidos ya', vk128Icon('PY','#E31B23','#fff',17)],
    ['rappi', vk128Icon('R','#FF441F','#fff',25)],
    ['booking,booking.com', vk128Icon('B','#003B95','#fff',25)],
    ['dni,nie,pasaporte,cedula,documento,documento de identidad,identity', vk128Icon('ID','#1e40af','#fff',17)],
    ['licencia,carnet,permiso,conducir,driving license', vk128Icon('DL','#166534','#fff',17)],
    ['medico,salud,hospital,clinica,health,medical,seguridad social,sip', vk128Icon('MED','#991b1b','#fff',14)],
    ['wifi,wi-fi,router,red,ssid,internet casa,fibra', vk128Icon('WiFi','#0369a1','#fff',13)],
    ['airbnb', vk128Icon('A','#FF5A5F','#fff',25)],
    ['dgt,dirección general de tráfico,trafico,tráfico,permiso conducir', vk128Icon('DGT','#c00','#fff',13)],
    ['sgt,sección de gestión tributaria,gestión tributaria', vk128Icon('SGT','#1d4ed8','#fff',13)],
    ['hacienda,agencia tributaria,aeat,tax,impuestos,renta,irpf', vk128Icon('AEAT','#c00','#fff',13)],
    ['seguridad social,seg social,inss,tesoreria,tesorería', vk128Icon('SS','#003f8c','#fff',16)],
    ['mutua,mutua madrileña,mutua universal,mutualia,asisa,sanitas', vk128Icon('MUT','#0066cc','#fff',14)],
    ['dni electronico,dni electrónico,clave pin,cl@ve,clave permanente', vk128Icon('CL@','#005eb8','#fff',14)],
    ['ayuntamiento,municipio,padron,padrón,empadronamiento', vk128Icon('AYT','#4a7c3f','#fff',14)],
    ['correos,correos de españa,correos express', vk128Icon('COR','#ffcc00','#333',14)],
    ['renfe,cercanias,cercanías,ave,tren,feve', vk128Icon('RNF','#c00','#fff',14)],
    ['seat,sepe,inem,desempleo,paro,erte', vk128Icon('SEPE','#004691','#fff',13)],
    ['consejeria,consejería,junta,generalitat,xunta,diputacion', vk128Icon('GOB','#2563eb','#fff',14)],
    ['hospital,clinica,clínica,medico,médico,cita previa,sanidad', vk128Icon('SAN','#dc2626','#fff',14)],
    ['universidad,uned,campus,matricula,matrícula,expediente', vk128Icon('UNI','#7c3aed','#fff',14)],
    ['catastro,registro,notaria,notaría,escritura', vk128Icon('REG','#0f766e','#fff',14)],
    ['skype', vk128Icon('S','#00AFF0','#fff',25)],
    ['wordpress', vk128Icon('W','#21759B','#fff',25)],
    ['wix', vk128Icon('W','#111827','#fff',25)],
    ['shopify', vk128Icon('S','#7AB55C','#fff',25)]
  ];
  const brandSeen=new Set();
  try{VK128_BRAND_ICONS.forEach(b=>(b.k||[]).forEach(k=>brandSeen.add(normVK(k))));}catch(e){}
  extraBrands.forEach(([keys,v])=>{
    const k=keys.split(',').map(x=>x.trim()).filter(Boolean);
    if(!k.some(x=>brandSeen.has(normVK(x)))){
      VK128_BRAND_ICONS.push({k,v});
      k.forEach(x=>brandSeen.add(normVK(x)));
    }
  });
  const manualExtras=[
    ['outlook','Outlook'],['yahoo','Yahoo'],['icloud','iCloud'],['drive','Google Drive'],['onedrive','OneDrive'],['mega','Mega'],
    ['microsoft','Microsoft'],['apple','Apple'],['adobe','Adobe'],['canva','Canva'],['notion','Notion'],['slack','Slack'],['trello','Trello'],['zoom','Zoom'],['chatgpt','ChatGPT'],
    ['x','X / Twitter'],['snapchat','Snapchat'],['pinterest','Pinterest'],['threads','Threads'],['messenger','Messenger'],['signal','Signal'],['twitch','Twitch'],
    ['gitlab','GitLab'],['bitbucket','Bitbucket'],['steam','Steam'],['epic','Epic Games'],['playstation','PlayStation'],['xbox','Xbox'],['nintendo','Nintendo'],['roblox','Roblox'],['minecraft','Minecraft'],
    ['disney','Disney+'],['max','HBO Max'],['primevideo','Prime Video'],['hulu','Hulu'],['crunchyroll','Crunchyroll'],
    ['revolut','Revolut'],['wise','Wise'],['zelle','Zelle'],['payoneer','Payoneer'],['binance','Binance'],['coinbase','Coinbase'],['mercadopago','Mercado Pago'],['mercadolibre','Mercado Libre'],['bbva','BBVA'],['santander','Santander'],['banesco','Banesco'],['chase','Chase'],['boa','Bank of America'],['wellsfargo','Wells Fargo'],
    ['aliexpress','AliExpress'],['shein','Shein'],['temu','Temu'],['ebay','eBay'],['wallapop','Wallapop'],['uber','Uber'],['ubereats','Uber Eats'],['glovo','Glovo'],['pedidosya','PedidosYa'],['rappi','Rappi'],['booking','Booking'],['airbnb','Airbnb'],
    ['skype','Skype'],['wordpress','WordPress'],['wix','Wix'],['shopify','Shopify']
  ];
  const iconSeen=new Set(MANUAL_ICONS.map(x=>String(x.id)));
  manualExtras.forEach(([id,label])=>{if(!iconSeen.has(id)){MANUAL_ICONS.push({id,label,emoji:'',bg:'#0a84ff'});iconSeen.add(id);}});
})();
(function(){
  function normVK94(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();}
  const brandFixes=[
    ['datadog,datadog dd', vk128Icon('DD','#632CA6','#fff',18)],
    ['edge,microsoft edge', vk128Icon('e','#0078D7','#fff',27)],
    ['etsy', vk128Icon('E','#F1641E','#fff',27)],
    ['figma', vk128Icon('F','#A259FF','#fff',27)],
    ['family,familia', vk128Icon('FAM','#16a34a','#fff',15)],
    ['crypto,criptomoneda,cripto', vk128Icon('₿','#F7931A','#fff',25)],
    ['school,estudio', vk128Icon('EDU','#2563eb','#fff',14)],
    ['bank,banco', vk128Icon('BANK','#1d4ed8','#fff',12)],
    ['wifi,wi-fi', vk128Icon('WiFi','#7c3aed','#fff',12)],
    ['safe,boveda,bóveda,vault', vk128Icon('VK','#0a84ff','#fff',20)]
  ];
  try{
    const seen=new Set();
    VK128_BRAND_ICONS.forEach(x=>(x.k||[]).forEach(k=>seen.add(normVK94(k))));
    brandFixes.forEach(([keys,v])=>{
      const ks=keys.split(',').map(x=>x.trim()).filter(Boolean);
      if(!ks.some(k=>seen.has(normVK94(k)))) VK128_BRAND_ICONS.push({k:ks,v});
    });
  }catch(e){}
  window.logoForManualIconVK94=function(ic){return vkGetIcon(ic&&ic.id,ic&&ic.label,ic&&ic.bg);};
;
  renderIconPicker=function(){
    const box=$('eIconPicker'); if(!box)return;
    const q=normVK94($('eIconSearch')?.value||'');
    let list=[...MANUAL_ICONS];
    if(q){list=list.filter(ic=>normVK94([ic.id,ic.label,ic.emoji].join(' ')).includes(q));}
    const order=['auto','google','gmail','outlook','yahoo','icloud','drive','onedrive','dropbox','facebook','instagram','whatsapp','telegram','youtube','netflix','amazon','paypal','spotify','discord','github','linkedin','x','microsoft','apple','adobe','canva','figma','notion','slack','trello','zoom','chatgpt','datadog','edge','ebay','etsy','binance','coinbase','bank','bbva','santander','banesco','zelle','wifi','cloud','safe','family'];
    list.sort((a,b)=>{const ia=order.indexOf(a.id),ib=order.indexOf(b.id);return (ia<0?999:ia)-(ib<0?999:ib)||String(a.label||a.id).localeCompare(String(b.label||b.id));});
    const total=list.length;
    box.innerHTML=list.map(ic=>{
      const safeId=String(ic.id||'').replace(/'/g,"\\'");
      return `<button type="button" class="iconChoice ${((selectedEntryIcon||'auto')===ic.id)?'active':''}" onclick="selectEntryIcon('${safeId}')">${vkLogoHTML(logoForManualIconVK94(ic),'logo')}<span class="tiny">${esc(ic.label||ic.id)}</span></button>`;
    }).join('') + `<div class="tiny" style="grid-column:1/-1;text-align:center;opacity:.72;padding:8px 0">${total} iconos disponibles</div>`;
  };
  iconFromKey=function(id){const ic=MANUAL_ICONS.find(x=>x.id===id&&x.id!=='auto'); if(!ic)return null; return {...ic,...logoForManualIconVK94(ic),emoji:null};};
  try{document.addEventListener('DOMContentLoaded',()=>{renderIconPicker();});}catch(e){}
})();



/* init gestionado por splash screen */


(function(){
  function coloredSvg(kind, inner){
    const id='vk103_'+kind+'_'+Math.random().toString(36).slice(2,7);
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="${id}" x1="3" y1="2" x2="21" y2="22"><stop stop-color="#ffffff"/><stop offset=".42" stop-color="rgb(var(--sico-rgb,0,220,255))"/><stop offset="1" stop-color="#0a84ff"/></linearGradient></defs><g fill="url(#${id})">${inner}</g></svg>`;
  }
  const P={
    lock:'<path d="M7 10V7.8a5 5 0 0 1 10 0V10h.3A2.7 2.7 0 0 1 20 12.7v5.6a2.7 2.7 0 0 1-2.7 2.7H6.7A2.7 2.7 0 0 1 4 18.3v-5.6A2.7 2.7 0 0 1 6.7 10H7Zm2.2 0h5.6V7.8a2.8 2.8 0 0 0-5.6 0V10Zm3.9 4.1a1.35 1.35 0 1 0-2.2 1.04V18h2.2v-2.86c.37-.24.62-.62.62-1.04Z"/>',
    finger:'<path d="M12 2.7a7.1 7.1 0 0 1 7.1 7.1v1.1h-2.2V9.8a4.9 4.9 0 0 0-9.8 0v2.7c0 2.4-.58 4.65-1.75 6.75l-1.9-1.1A11.3 11.3 0 0 0 4.9 12.5V9.8A7.1 7.1 0 0 1 12 2.7Zm0 4a3.1 3.1 0 0 1 3.1 3.1v2.5c0 3.7-1.25 6.6-3.75 8.7l-1.42-1.68c2-1.7 2.97-4.02 2.97-7.02V9.8a.9.9 0 0 0-1.8 0v2.7c0 3.2-.82 5.95-2.45 8.25l-1.78-1.27c1.35-1.9 2.03-4.23 2.03-6.98V9.8A3.1 3.1 0 0 1 12 6.7Zm5.6 6.2h2.2c0 3.05-.9 5.65-2.7 7.8l-1.7-1.42c1.46-1.74 2.2-3.86 2.2-6.38Z"/>',
    recovery:'<path d="M12 2.8a9.2 9.2 0 1 0 9.2 9.2H19a7 7 0 1 1-2.05-4.95L14 10h7V3l-2.48 2.48A9.15 9.15 0 0 0 12 2.8Zm-1.2 6h2.4v2.4h2.4v2.4h-2.4V16h-2.4v-2.4H8.4v-2.4h2.4V8.8Z"/>',
    clock:'<path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm1.1 4.2v4.45l3.35 2.02-1.1 1.82-4.45-2.67V7.2h2.2Z"/>',
    export:'<path d="M12 3 7 8h3v7h4V8h3l-5-5ZM5 14h3v4h8v-4h3v5.2A1.8 1.8 0 0 1 17.2 21H6.8A1.8 1.8 0 0 1 5 19.2V14Z"/>',
    import:'<path d="M10 3h4v7h3l-5 5-5-5h3V3ZM5 14h3v4h8v-4h3v5.2A1.8 1.8 0 0 1 17.2 21H6.8A1.8 1.8 0 0 1 5 19.2V14Z"/>',
    share:'<path d="M18 16.1a3 3 0 0 0-2.35 1.14L9.8 13.9a3.1 3.1 0 0 0 0-1.8l5.84-3.34A3 3 0 1 0 14.7 7l-5.84 3.34a3 3 0 1 0 0 5.32L14.7 19A3 3 0 1 0 18 16.1Z"/>',
    privacy:'<path d="M12 3.2 19 6v5.2c0 4.35-2.75 7.8-7 9.6-4.25-1.8-7-5.25-7-9.6V6l7-2.8Zm3.8 6.6-4.6 4.6-2-2-1.4 1.4 3.4 3.4 6-6-1.4-1.4Z"/>',
    info:'<path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm1.1 14h-2.2v-6.2h2.2V17Zm0-8h-2.2V6.8h2.2V9Z"/>'
  };
  function kindFromText(t){
    t=(t||'').toLowerCase();
    if(t.includes('huella')||t.includes('biometr')) return 'finger';
    if(t.includes('recuperación')||t.includes('recuperacion')) return 'recovery';
    if(t.includes('auto bloqueo')||t.includes('autobloqueo')) return 'clock';
    if(t.includes('bloquear')) return 'lock';
    if(t.includes('exportar')) return 'export';
    if(t.includes('importar')) return 'import';
    if(t.includes('compartir')) return 'share';
    if(t.includes('privacidad')) return 'privacy';
    return 'info';
  }
  function paintSettingsIcons(){
    document.querySelectorAll('.settingsRow').forEach(row=>{
      const k=kindFromText(row.textContent);
      row.dataset.vkKind=k;
      const ico=row.querySelector('.sico');
      if(ico) ico.innerHTML=coloredSvg(k,P[k]||P.info);
    });
  }
  function applyGlow103(){
    const raw=Number(localStorage.getItem('vaultkey_visual_glow')||110);
    const v=Math.max(60,Math.min(140,raw));
    const mult=(0.72 + ((v-60)/80)*0.78).toFixed(2);   // 60=0.72, 140=1.50
    const bright=(0.94 + ((v-60)/80)*0.24).toFixed(2); // 60=0.94, 140=1.18
    document.documentElement.style.setProperty('--vk-live-glow',mult);
    document.documentElement.style.setProperty('--vk-live-bright',bright);
  }


  document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{applyGlow103();paintSettingsIcons();},80));
  window.addEventListener('load',()=>setTimeout(()=>{applyGlow103();paintSettingsIcons();},180));
})();

(function(){
  const LS_SPLASH='vk_splash_v1';
  function updatePinScale(){
    const scale=Math.min(1,window.innerWidth/412,window.innerHeight/917);
    document.documentElement.style.setProperty('--vk-pin-scale',String(scale));
  }
  updatePinScale();
  window.addEventListener('resize',updatePinScale);
  function runSplash(cb){
  const splash=$('vkSplash');
  if(!splash){cb();return;}
  splash.classList.add('vkSplashVisible');
  splash.style.opacity='1';
  setTimeout(()=>{
    hideSplashHard();
    cb();
  },600);
}

  function hideSplashHard(){
    const splash=$('vkSplash');
    if(!splash)return;
    splash.classList.remove('vkSplashVisible','vkSplashOut');
    splash.style.opacity='';
    splash.style.display='none';
    splash.style.pointerEvents='none';
  }
  window.hideSplashHard=hideSplashHard;

  function bootApp(){
  try{vkBuildIconMap();}catch(e){console.warn(e);}
  try{driveInit();}catch(e){console.warn(e);}
    hideSplashHard();
    if(window.resetScreensForBoot) window.resetScreensForBoot();
    if(window.applyVisualLook) window.applyVisualLook();
    appBooted=true;
    applyAppVersion();
    const _nativeAndroid=/VaultKeyWebViewPrototype\//.test(navigator.userAgent||'');
    if(_nativeAndroid&&'serviceWorker'in navigator){
      navigator.serviceWorker.getRegistrations()
        .then(registrations=>Promise.all(registrations.map(reg=>reg.unregister())))
        .catch(()=>{});
      if('caches'in window){
        caches.keys().then(keys=>Promise.all(keys.map(key=>caches.delete(key)))).catch(()=>{});
      }
    }else if('serviceWorker'in navigator){
      const _swInstallTime = Date.now();
      navigator.serviceWorker.register('./sw.js').catch(()=>{});
      navigator.serviceWorker.addEventListener('message',e=>{
        if(!e.data)return;
        // Nueva versión detectada
        if(e.data.type==='SW_UPDATED'){
          // Ignorar si han pasado menos de 8 segundos — es la primera instalación
          const _swAge = Date.now() - _swInstallTime;
          if(_swAge < 8000) return;
          if(!unlocked){
            // App bloqueada — recargar silenciosamente
            window.location.reload();
          } else {
            // App desbloqueada — avisar sin interrumpir
            const v=e.data.version||'';
            toast('✨ VaultKey actualizado'+(v?' (v'+v+')':'')+'  — reinicia para aplicar',5000);
          }
        }
        // Respuesta a GET_VERSION
        if(e.data.type==='SW_VERSION'){
          console.log('SW version:',e.data.version);
        }
      });
      // Pedir versión del SW al arrancar (útil para debug)
      navigator.serviceWorker.ready.then(reg=>{
        reg.active?.postMessage({type:'GET_VERSION'});
      }).catch(()=>{});
    }
    // VK 2.0 — arranque: bóveda 2.0 tiene prioridad sobre rutas legacy
    if(typeof vkStore !== 'undefined' && vkStore.hasVault()){
      // Bóveda 2.0 detectada → desbloqueo. vkUnlock se conecta aquí en Fase 4.
      const urlParams = new URLSearchParams(window.location.search);
      if(urlParams.get('autofill')==='1' && window.VaultKeyBridge){
        initPin(); show('pin'); window._autofillPickerMode=true;
      } else {
        initPin(); show('pin');
      }
    } else if(!localStorage.getItem('vaultkey_onboarding_v130') || !localStorage.getItem('vk_meta_v1')){
      // Sin bóveda 2.0 ni meta legacy → nuevo usuario
      localStorage.removeItem('vaultkey_onboarding_v130');
      openOnboardingHard();
    } else {
      // Usuario legacy con PIN configurado → desbloqueo legacy (intacto hasta Fase 4)
      const urlParams = new URLSearchParams(window.location.search);
      if(urlParams.get('autofill')==='1' && window.VaultKeyBridge){
        initPin(); show('pin'); window._autofillPickerMode=true;
      } else {
        initPin(); show('pin');
      }
    }
  }

  document.addEventListener('DOMContentLoaded',()=>{
    runSplash(bootApp);
  });

  // visibilitychange gestionado por handleVisibilityChange arriba
})();

// Funciones helper globales — usadas en renderIconStrip, selectEntryIcon y otros
function safeEsc(v){try{return esc(v)}catch(e){return String(v||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}}
function normService(v){return String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim()}
function serviceLabel(id){
  const ic=(window.MANUAL_ICONS||MANUAL_ICONS||[]).find(x=>String(x.id)===String(id)&&x.id!=='auto');
  return ic?(ic.label||ic.id):'';
}function allIcons(){
  let arr=[];
  try{arr=Array.isArray(MANUAL_ICONS)?MANUAL_ICONS.slice():[]}catch(e){}
  if(!arr.length) arr=[{id:'bank',label:'Banco',bg:'#1A3A6B'},{id:'gmail',label:'Gmail',bg:'#EA4335'},{id:'netflix',label:'Netflix',bg:'#E50914'}];
  const seen=new Set();
  return arr.filter(ic=>{if(!ic||!ic.id)return false;const id=String(ic.id);if(seen.has(id))return false;seen.add(id);return true;});
}
const _synonymMap={
  banco:['bank','bbva','santander','caixa','ing','banesco','mercantil','banco','chase','boa','wellsfargo','zelle','revolut','wise'],
  gobierno:['dgt','sgt','aeat','hacienda','seguridad social','mutua','clave','ayuntamiento','correos','renfe','sepe','inem','diputacion','consejeria','junta','generalitat'],
  salud:['hospital','clinica','medico','sanidad','mutua','asisa','sanitas','farmacia','cita previa'],
  documentos:['dni','nie','pasaporte','cedula','licencia','carnet','permiso','catastro','registro','notaria'],
  viajes:['airbnb','booking','renfe','iberia','ryanair','vueling','aena','trivago','kayak','hotels'],
  educacion:['universidad','uned','campus','escuela','instituto','coursera','udemy','khan'],
  familia:['pediatra','colegio','guarderia','seguro escolar'],
  desarrollo:['github','gitlab','bitbucket','vercel','netlify','aws','gcp','azure','cloudflare','digitalocean','hetzner'],
  bancos:['bank','bbva','santander','caixa','ing','banesco','mercantil','banco','chase','boa','wellsfargo','zelle','revolut','wise'],
  bank:['bank','bbva','santander','caixa','ing','banesco','mercantil','chase','boa','wellsfargo','zelle','revolut','wise'],
  correo:['gmail','outlook','hotmail','yahoo','icloud','proton','google'],
  mail:['gmail','outlook','hotmail','yahoo','icloud','proton','google'],
  email:['gmail','outlook','hotmail','yahoo','icloud','proton','google'],
  streaming:['netflix','youtube','spotify','disney','primevideo','hulu','max','twitch'],
  crypto:['binance','coinbase','crypto','kraken','metamask','trustwallet']
};
function iconMatches(ic,q){
  if(!q) return true;
  const n=normService([ic.id,ic.label,ic.emoji].join(' '));
  if(n.includes(q)) return true;
  const ids=_synonymMap[q];
  return !!(ids&&ids.includes(String(ic.id)));
}

(function(){
  const REC_PENDING='vk_recovery_pending';
  const REC_SAVED='vk_recovery_saved';
  const ONBOARD='vaultkey_onboarding_v130';

  function byId(id){return document.getElementById(id)}


  // Oculta visualmente el campo duplicado "Nombre del servicio" sin romper la validación interna.
  function hideDuplicatedServiceField(){
    const e=byId('eService');
    const f=e&&e.closest('.field');
    if(f) f.classList.add('vkHiddenServiceField');
    const search=byId('eIconSearch');
    if(search){
      search.placeholder='Buscar servicio: Gmail, banco, Netflix...';
      if(!search.dataset.vkBind){
        search.dataset.vkBind='1';
        search.addEventListener('input',()=>{
          if(byId('eService') && !selectedEntryIcon) byId('eService').value=search.value.trim();
          window.renderIconStrip();
        });
      }
    }
  }

  window.showRecoveryCode=async function(first=false){
    // VK 2.0: el kit no se almacena en la app
    if(typeof vkStore!=='undefined'&&vkStore.hasVault()){
      toast('El kit de emergencia no se guarda en la app. Si lo perdiste, regenerálo desde este menú.');
      return;
    }
    const code=await ensureRecoveryCode();
    document.querySelectorAll('.modal').forEach(m=>{ if(m.id!=='recoveryModal') m.classList.remove('open'); });
    const txt=byId('recoveryText'); if(txt) txt.textContent=code;
    const btn=byId('recoveryCloseBtn');
    if(btn) btn.style.display=first?'none':'';
    const modal=byId('recoveryModal');
    if(modal){
      modal.classList.toggle('vkRecoveryBlocking',!!first);
      modal.classList.add('open');
      modal.style.display='flex';
    }
    if(first) localStorage.setItem(REC_PENDING,'1');
  };

  window.confirmRecoverySaved=function(){
    const btn=byId('recoveryCloseBtn'); if(btn) btn.style.display='';
    localStorage.setItem(REC_SAVED,'1');
    localStorage.removeItem(REC_PENDING);
    const modal=byId('recoveryModal');
    if(modal){modal.classList.remove('open','vkRecoveryBlocking');modal.style.display='';}
  };

  const oldUnlockOk=window.unlockOk;
  window.unlockOk=async function(p){
    let m=defaultSecurity(meta());
    if(m){m.failedAttempts=0;m.totalFailed=0;m.lockedUntil=0;m.lockLevel=0;m.lastOk=Date.now();saveMeta(m)}
    try{vibe([30,20,60]);soundPinOk()}catch(e){}
    lastKey=p;unlocked=true;pin='';renderDots();hidePrivacyOverlay();show('home');render();resetAutoLockTimer();
    setTimeout(()=>{try{checkVaultReminders();}catch(e){}},2000);
    setTimeout(()=>{try{maybeShowAutofillPicker();}catch(e){}},300);
    setTimeout(()=>{try{checkAutofillSetupBanner();}catch(e){}},1500);
    if(localStorage.getItem(REC_PENDING)==='1' || (localStorage.getItem(LS_REC)&&localStorage.getItem(REC_SAVED)!=='1')){
      setTimeout(()=>showRecoveryCode(true),120);
    }else{
    }
  };

  window.handlePin=async function(){
    const typedPin=pin;
    try{
      let locked=lockRemaining();
      if(locked){$('pinMsg').textContent='Bóveda bloqueada. Espera '+locked+' s';$('pinMsg').className='pinSub pinLocked';pin='';renderDots();updateLockCountdown();return;}
      if(mode==='setup1'){
        tempPin=typedPin;pin='';mode='setup2';$('pinMsg').className='pinSub';$('pinMsg').textContent='Repite el PIN de '+getPinLen()+' dígitos';renderDots();return;
      }
      if(mode==='setup2'){
        if(typedPin!==tempPin){pin='';mode='setup1';tempPin='';$('pinMsg').className='pinSub pinWarn';$('pinMsg').textContent='No coincide. Crea un PIN de '+getPinLen()+' dígitos';renderDots();return;}
        const hp=await makeHashedPin(typedPin);
        // ── Re-cifrado atómico de PIN ────────────────────────────────────────
        // Fase 1: backup de los datos actuales antes de tocar nada
        const LS_PIN_BACKUP='vk_pin_change_backup';
        const existingData=localStorage.getItem(LS_DATA);
        if(existingData) localStorage.setItem(LS_PIN_BACKUP, existingData);
        // Fase 2: re-cifrar la bóveda con el PIN nuevo
        // (persist() escribe en LS_DATA — si falla aquí, el backup sigue intacto
        //  y el hash TODAVÍA NO se ha actualizado, por lo que el PIN viejo sigue funcionando)
        try{
          if(vault && vault.length>0){
            await persist(typedPin);
          } else {
            vault=[];await persist(typedPin);
          }
        }catch(persistErr){
          // Re-cifrado fallido — restaurar backup y abortar
          if(existingData) localStorage.setItem(LS_DATA, existingData);
          localStorage.removeItem(LS_PIN_BACKUP);
          throw persistErr;
        }
        // Fase 3: commit — solo ahora actualizamos el hash (operación atómica final)
        const existingMeta=meta()||{};
        saveMeta({...existingMeta,hash:hp.hash,pinSalt:hp.salt,pinLen:getPinLen(),created:existingMeta.created||Date.now(),lastBackup:existingMeta.lastBackup||null,autoLockMs:existingMeta.autoLockMs||30000,failedAttempts:0,lockLevel:0,lockedUntil:0,lastOk:null,lastFail:null,autoWipe:existingMeta.autoWipe||false,totalFailed:0});
        // Fase 4: limpiar backup — cambio completado con éxito
        localStorage.removeItem(LS_PIN_BACKUP);
        const rec=makeRecoveryCode();
        const recEnc=await encryptRec(rec,typedPin);
        localStorage.setItem(LS_REC,JSON.stringify(recEnc));
        localStorage.removeItem(REC_SAVED);
        localStorage.setItem(REC_PENDING,'1');
        // Entramos a la bóveda solo para presentar el recovery como paso bloqueante. No se ofrece huella todavía.
        lastKey=typedPin;unlocked=true;pin='';renderDots();hidePrivacyOverlay();show('home');render();resetAutoLockTimer();
        soundPinOk();vibe([30,20,60,20,80]);
        await showRecoveryCode(true);
        return;
      }
      let m=defaultSecurity(meta());
      if(!m || !m.hash)throw Error('PIN no configurado');
      let pinOk=false;
      if(m.pinSalt){pinOk=(await hashPin(typedPin,m.pinSalt))===m.hash;}else{pinOk=(await digest(typedPin))===m.hash;}
      if(!pinOk)throw Error('PIN incorrecto');
      if(!m.pinSalt){const hp=await makeHashedPin(typedPin);m.hash=hp.hash;m.pinSalt=hp.salt;saveMeta(m);}
      let pack=JSON.parse(localStorage.getItem(LS_DATA)||'null');
      vault=pack?await decryptData(pack,typedPin):[];
      ensureRecoveryCode();
      await window.unlockOk(typedPin);
    }catch(e){pin='';renderDots();registerFailedPin();}
  };

  // Si la app venía de una instalación nueva, nunca permitas Home sin completar el recovery.
  document.addEventListener('DOMContentLoaded',()=>{
    hideDuplicatedServiceField();
    setTimeout(()=>{try{window.renderIconStrip()}catch(e){}},300);
  });
})();




// ══════════════════════════════════════════════════════
//  BANNER DE CONFIGURACIÓN DE AUTOFILL
// ══════════════════════════════════════════════════════

function checkAutofillSetupBanner() {
  // Detectar si LauncherActivity pasó el flag vk_autofill_setup=1
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('vk_autofill_setup') !== '1') return;

  // No mostrar si ya fue descartado en esta sesión
  if (sessionStorage.getItem('vk_autofill_banner_dismissed')) return;

  // Esperar a que la app esté desbloqueada antes de mostrar
  const waitForUnlock = setInterval(() => {
    if (!unlocked) return;
    clearInterval(waitForUnlock);
    showAutofillSetupBanner();
  }, 500);
}

function showAutofillSetupBanner() {
  // No mostrar si ya existe
  if (document.getElementById('vkAutofillBanner')) return;

  const banner = document.createElement('div');
  banner.id = 'vkAutofillBanner';
  banner.style.cssText = [
    'position:fixed;bottom:80px;left:12px;right:12px;z-index:8000',
    'background:linear-gradient(135deg,rgba(0,80,200,.95),rgba(0,40,120,.95))',
    'border:1px solid rgba(0,180,255,.4);border-radius:16px',
    'padding:14px 16px;box-shadow:0 8px 32px rgba(0,0,0,.5)',
    'animation:vkSlideUp .3s ease'
  ].join(';');

  banner.innerHTML = `
    <div style="display:flex;align-items:flex-start;gap:12px">
      <div style="font-size:24px;flex-shrink:0;margin-top:2px">🔐</div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:900;color:#e0f0ff;font-size:14px;margin-bottom:4px">
          Activa el autocompletado
        </div>
        <div style="font-size:12px;color:#7ab0d0;line-height:1.5;margin-bottom:10px">
          VaultKey puede rellenar usuarios y contraseñas automáticamente en cualquier app.
        </div>
        <div style="display:flex;gap:8px">
          <button onclick="openAutofillSettings()"
            style="flex:1;padding:8px;border-radius:10px;border:none;
                   background:rgba(0,210,255,.2);color:#00d2ff;
                   font-size:12px;font-weight:800;cursor:pointer">
            ⚡ Activar ahora
          </button>
          <button onclick="dismissAutofillBanner()"
            style="padding:8px 12px;border-radius:10px;border:none;
                   background:rgba(255,255,255,.06);color:#4a7090;
                   font-size:12px;font-weight:700;cursor:pointer">
            Ahora no
          </button>
        </div>
      </div>
      <button onclick="dismissAutofillBanner()"
        style="background:none;border:none;color:#4a7090;
               font-size:18px;cursor:pointer;flex-shrink:0;padding:0">✕</button>
    </div>`;

  // Añadir animación si no existe
  if (!document.getElementById('vkAutofillBannerStyle')) {
    const st = document.createElement('style');
    st.id = 'vkAutofillBannerStyle';
    st.textContent = '@keyframes vkSlideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}';
    document.head.appendChild(st);
  }

  document.body.appendChild(banner);
}

function openAutofillSettings() {
  // Abrir ajustes de autocompletado de Android directamente
  try {
    // Intent ACTION_REQUEST_SET_AUTOFILL_SERVICE — abre la pantalla correcta
    window.location.href = /VaultKeyWebViewPrototype\//.test(navigator.userAgent||'')
      ? 'https://appassets.androidplatform.net/native/settings/autofill'
      : 'intent:#Intent;action=android.settings.REQUEST_SET_AUTOFILL_SERVICE;package=com.nogueratech.vaultkey;end';
  } catch(e) {
    // Fallback: ajustes generales
    try {
      window.location.href = /VaultKeyWebViewPrototype\//.test(navigator.userAgent||'')
        ? 'https://appassets.androidplatform.net/native/settings/system'
        : 'intent:#Intent;action=android.settings.SETTINGS;end';
    } catch(e2) {}
  }
  dismissAutofillBanner();
}

function dismissAutofillBanner() {
  sessionStorage.setItem('vk_autofill_banner_dismissed', '1');
  const banner = document.getElementById('vkAutofillBanner');
  if (banner) {
    banner.style.animation = 'vkSlideUp .2s ease reverse';
    setTimeout(() => banner.remove(), 200);
  }
}

// ══════════════════════════════════════════════════════
//  MODO AUTOFILL PICKER
// ══════════════════════════════════════════════════════

// Llamado después de desbloquear cuando estamos en modo autofill
function maybeShowAutofillPicker() {
  if (!window._autofillPickerMode) return;
  if (!window.VaultKeyBridge) return;
  showAutofillPicker();
}

function showAutofillPicker() {
  // Construir UI de selección simplificada sobre la bóveda
  const overlay = document.createElement('div');
  overlay.id = 'autofillPickerOverlay';
  overlay.style.cssText = [
    'position:fixed;top:0;left:0;right:0;bottom:0;z-index:9999',
    'background:#071428;display:flex;flex-direction:column;overflow:hidden'
  ].join(';');

  const entries = (vault || []).filter(e =>
    !e.entryType || e.entryType === 'password'
  );

  let rows = '';
  entries.forEach(e => {
    const ic = iconForEntry(e);
    const user = e.user || e.email || '';
    rows += `<div onclick="autofillSelectEntry('${safeEsc(e.id)}')"
      style="display:flex;align-items:center;gap:12px;padding:14px 16px;
             border-bottom:1px solid rgba(0,180,255,.08);cursor:pointer;
             transition:.15s;background:rgba(0,14,32,.4)"
      onmousedown="this.style.background='rgba(0,100,255,.15)'"
      onmouseup="this.style.background='rgba(0,14,32,.4)'">
      ${vkLogoHTML(ic, 'logo', 40)}
      <div style="flex:1;min-width:0">
        <div style="font-weight:800;color:#e0f0ff;font-size:14px">${safeEsc(e.service)}</div>
        ${user ? `<div style="font-size:12px;color:#4a7090;margin-top:2px">${safeEsc(user)}</div>` : ''}
      </div>
      <div style="color:rgba(0,210,255,.4);font-size:20px">›</div>
    </div>`;
  });

  overlay.innerHTML = `
    <div style="padding:16px;background:rgba(0,14,32,.9);
                border-bottom:1px solid rgba(0,180,255,.15);
                display:flex;align-items:center;gap:12px;flex-shrink:0">
      <div style="font-size:24px">🔐</div>
      <div>
        <div style="font-weight:900;color:#e0f0ff;font-size:15px">VaultKey</div>
        <div style="font-size:12px;color:#4a7090">Selecciona una credencial para autocompletar</div>
      </div>
      <button onclick="autofillCancel()"
        style="margin-left:auto;background:none;border:none;
               color:#4a7090;font-size:22px;cursor:pointer;padding:4px">✕</button>
    </div>
    <div style="flex:1;overflow-y:auto">
      ${entries.length ? rows :
        '<div style="text-align:center;padding:40px 16px;color:#4a7090">' +
        '<div style="font-size:40px;margin-bottom:12px">🔐</div>' +
        '<p>No tienes contraseñas guardadas todavía</p></div>'}
    </div>`;

  document.body.appendChild(overlay);
}

function autofillSelectEntry(id) {
  const e = vault.find(x => x.id === id);
  if (!e) { autofillCancel(); return; }
  const username = e.user || e.email || '';
  const password = e.pass || '';
  try {
    window.VaultKeyBridge.onEntrySelected(username, password);
  } catch(err) {
    console.error('AutofillBridge error:', err);
    autofillCancel();
  }
}

function autofillCancel() {
  try {
    if (window.VaultKeyBridge) window.VaultKeyBridge.onCancel();
  } catch(err) {}
  const overlay = document.getElementById('autofillPickerOverlay');
  if (overlay) overlay.remove();
}

// ══════════════════════════════════════════════════════
//  SISTEMA DE NOTIFICACIONES LOCALES — VaultKey
// ══════════════════════════════════════════════════════


// ══ BANNER DE RECORDATORIO ═══════════════════════════════
function showReminderBanner(msg, id){
  const prev=document.getElementById('vkReminderBanner');
  if(prev)prev.remove();

  // Inyectar estilos una vez
  if(!document.getElementById('vkBannerStyle')){
    const st=document.createElement('style');
    st.id='vkBannerStyle';
    st.textContent=`
      @keyframes vkBannerIn{
        from{transform:translateY(-110%);opacity:0}
        to{transform:translateY(0);opacity:1}
      }
      @keyframes vkBannerOut{
        from{transform:translateY(0);opacity:1}
        to{transform:translateY(-110%);opacity:0}
      }
      @keyframes vkBell{
        0%,100%{transform:rotate(0)}
        15%{transform:rotate(18deg)}
        30%{transform:rotate(-16deg)}
        45%{transform:rotate(12deg)}
        60%{transform:rotate(-8deg)}
        75%{transform:rotate(4deg)}
      }
      #vkReminderBanner{
        position:fixed;top:0;left:0;right:0;z-index:99999;
        background:linear-gradient(135deg,#00122e 0%,#001f4a 60%,#001533 100%);
        border-bottom:2px solid rgba(0,200,255,.45);
        box-shadow:0 6px 32px rgba(0,0,0,.7), 0 0 60px rgba(0,120,255,.15);
        animation:vkBannerIn .35s cubic-bezier(.22,1,.36,1) both;
        overflow:hidden;
      }
      #vkReminderBanner::before{
        content:'';position:absolute;top:0;left:0;right:0;height:2px;
        background:linear-gradient(90deg,transparent,#00d9ff,#7b5fff,#00d9ff,transparent);
        animation:vkShimmer 2.5s infinite;
      }
      @keyframes vkShimmer{
        0%{background-position:-200% center}
        100%{background-position:200% center}
      }
      #vkReminderBanner.hiding{animation:vkBannerOut .28s cubic-bezier(.4,0,1,1) forwards}
      .vkBannerBell{display:inline-block;animation:vkBell .7s .4s ease both}
      .vkBannerBtn{
        display:inline-flex;align-items:center;gap:6px;
        margin-top:10px;padding:8px 16px;border-radius:10px;
        border:1px solid rgba(0,210,255,.45);
        background:linear-gradient(135deg,rgba(0,100,255,.2),rgba(0,60,180,.15));
        color:#00d9ff;font-size:13px;font-weight:800;cursor:pointer;
        box-shadow:0 0 14px rgba(0,150,255,.2);
        transition:all .15s;
      }
      .vkBannerBtn:active{transform:scale(.96);background:rgba(0,120,255,.3)}
      .vkBannerClose{
        position:absolute;top:10px;right:12px;
        width:30px;height:30px;border-radius:50%;
        border:1px solid rgba(255,255,255,.15);
        background:rgba(255,255,255,.07);
        color:#7a9ec0;font-size:15px;cursor:pointer;
        display:flex;align-items:center;justify-content:center;
        transition:all .15s;
      }
      .vkBannerClose:active{background:rgba(255,255,255,.18);color:#fff}
    `;
    document.head.appendChild(st);
  }

  const now=new Date();
  const timeStr=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
  const safeMsg=safeEsc(msg);

  const banner=document.createElement('div');
  banner.id='vkReminderBanner';
  banner.innerHTML=`
    <button class="vkBannerClose" onclick="hideReminderBanner()">✕</button>
    <div style="padding:16px 48px 16px 16px;display:flex;gap:14px;align-items:flex-start">
      <div style="
        width:48px;height:48px;border-radius:14px;flex-shrink:0;
        background:linear-gradient(135deg,rgba(0,150,255,.25),rgba(100,50,255,.2));
        border:1px solid rgba(0,180,255,.3);
        display:flex;align-items:center;justify-content:center;font-size:24px;
        box-shadow:0 0 20px rgba(0,150,255,.25)">
        <span class="vkBannerBell">🔔</span>
      </div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
          <span style="font-size:10px;font-weight:900;letter-spacing:1.2px;color:#00d9ff;text-transform:uppercase">Recordatorio</span>
          <span style="font-size:10px;color:rgba(0,200,255,.45);font-weight:600">${timeStr}</span>
        </div>
        <div style="font-size:15px;font-weight:700;color:#e8f6ff;line-height:1.45;word-break:break-word">${safeMsg}</div>
        ${id?`<button class="vkBannerBtn" onclick="closeModals();hideReminderBanner();setTimeout(()=>quick('${id}'),200)">
          <span>Ver nota</span><span style="opacity:.7">→</span>
        </button>`:''}
      </div>
    </div>
  `;
  document.body.appendChild(banner);
  // NO auto-cierra — el usuario lo cierra manualmente
}

function hideReminderBanner(){
  const b=document.getElementById('vkReminderBanner');
  if(!b)return;
  b.classList.add('hiding');
  setTimeout(()=>b.remove(),280);
}
// ═════════════════════════════════════════════════════════

// ══ Comprobar recordatorios al desbloquear ══
function checkVaultReminders(){
  if(!vault||!vault.length)return;
  const now=Date.now();
  const _td=new Date();
  const todayStr=_td.getFullYear()+'-'+String(_td.getMonth()+1).padStart(2,'0')+'-'+String(_td.getDate()).padStart(2,'0');
  const reminders=[];

  vault.forEach(e=>{
    // Recordatorio de nota con fecha
    if(e.entryType==='note'&&e.reminder&&e.reminder.active&&e.reminder.date){
      if(e.reminder.date<=todayStr){
        reminders.push({type:'note',service:e.service,msg:e.reminder.msg||e.service,id:e.id,date:e.reminder.date});
      }
      return;
    }
    // Contraseñas antiguas >90 días
    if(e.entryType==='password'&&e.pass){
      const age=Math.floor((now-(e.updated||now))/(1000*60*60*24));
      if(age>=90) reminders.push({type:'oldpass',service:e.service,age,id:e.id});
    }
    // Tarjetas caducadas o próximas
    if(e.entryType==='card'&&e.cardExpiry){
      const[mm,yy]=e.cardExpiry.split('/').map(Number);
      if(mm&&yy){
        const exp=new Date(2000+yy,mm-1,1);
        const days=Math.floor((exp-now)/(1000*60*60*24));
        if(days<0) reminders.push({type:'cardexpired',service:e.service,id:e.id});
        else if(days<=30) reminders.push({type:'cardexpiring',service:e.service,days,id:e.id});
      }
    }
    // Documentos caducados o próximos
    if(['id','license'].includes(e.entryType)){
      const expStr=e.idExpiry||e.licExpiry||'';
      if(expStr&&expStr.length===10){
        const[dd,mm,yyyy]=expStr.split('/').map(Number);
        if(dd&&mm&&yyyy){
          const exp=new Date(yyyy,mm-1,dd);
          const days=Math.floor((exp-now)/(1000*60*60*24));
          if(days<0) reminders.push({type:'docexpired',service:e.service,id:e.id});
          else if(days<=60) reminders.push({type:'docexpiring',service:e.service,days,id:e.id});
        }
      }
    }
  });

  if(!reminders.length)return;
  // Mostrar recordatorios como banners — primero el más importante
  reminders.slice(0,1).forEach((r,i)=>{
    setTimeout(()=>{
      let msg='';
      if(r.type==='note')            msg=r.msg||r.service;
      else if(r.type==='oldpass')    msg=`${r.service}: contraseña con ${r.age} días sin cambiar`;
      else if(r.type==='cardexpired')msg=`Tarjeta ${r.service} caducada`;
      else if(r.type==='cardexpiring')msg=`${r.service}: caduca en ${r.days} días`;
      else if(r.type==='docexpired') msg=`${r.service}: documento caducado`;
      else if(r.type==='docexpiring')msg=`${r.service}: caduca en ${r.days} días`;
      if(msg) showReminderBanner(msg, r.id||null);
    },2000+i*4000);
  });
  // Los demás como toast normal si hay más de uno
  if(reminders.length>1){
    setTimeout(()=>toast(`+${reminders.length-1} recordatorio${reminders.length>2?'s':''} más pendiente${reminders.length>2?'s':''}`,4000),7000);
  }
}

window._checkVaultReminders=checkVaultReminders;

/* Estado de salud: lectura normalizada, sin modificar datos persistidos. */
const VK_HEALTH_LEVELS={
  protected:0,
  good:1,
  attention:2,
  risk:3
};

function healthReadJson(key,fallback=null){
  try{
    const raw=localStorage.getItem(key);
    return raw===null?fallback:JSON.parse(raw);
  }catch(error){
    return fallback;
  }
}

function healthEntryType(entry){
  /* Regla explícita: nunca clasificar por defecto como contraseña.
     Solo cuenta como tal lo que la propia entrada declara. */
  return String(entry?.entryType||entry?.type||'').toLowerCase();
}

function healthPasswordSubtype(entry){
  const type=healthEntryType(entry);

  if(type==='wifi'||type==='pin'||type==='recovery'){
    return type;
  }

  const subtype=String(entry?.subtype||'web').toLowerCase();
  return ['web','wifi','pin','recovery'].includes(subtype)?subtype:'web';
}

function healthRecoverySecret(codes){
  if(Array.isArray(codes)){
    const value=codes.find(code=>typeof code==='string'&&code.trim());
    return value?value.trim():'';
  }

  return typeof codes==='string'?codes.trim():'';
}

function healthPasswordSecret(entry,subtype){
  if(subtype==='recovery'){
    return healthRecoverySecret(entry?.codes);
  }

  if(subtype==='wifi'){
    return String(entry?.password||entry?.pass||entry?.wifiPass||'');
  }

  return String(entry?.password||entry?.pass||'');
}

function healthEntryTitle(entry,fallback){
  return String(
    entry?.title||
    entry?.service||
    entry?.wifiSsid||
    entry?.holder||
    entry?.name||
    fallback||
    ''
  ).trim();
}

function healthEntryUpdatedAt(entry){
  const value=Number(entry?.updatedAt||entry?.updated||entry?.createdAt||0);
  return Number.isFinite(value)&&value>0?value:0;
}

function healthReadPasswords(){
  if(!Array.isArray(vault))return [];

  return vault
    .filter(isPasswordFamilyEntry)
    .map(entry=>{
      const subtype=healthPasswordSubtype(entry);

      return {
        id:String(entry.id||''),
        source:'vault',
        kind:'password',
        subtype,
        title:healthEntryTitle(entry,subtype==='wifi'?'WiFi':'Contrase\u00f1a'),
        secret:healthPasswordSecret(entry,subtype),
        updatedAt:healthEntryUpdatedAt(entry),
        raw:entry
      };
    })
    .filter(item=>item.id);
}

function healthReadNotes(){
  const moduleNotes=
    window.vkNotes&&typeof window.vkNotes.read==='function'
      ?window.vkNotes.read()
      :null;

  const source=Array.isArray(moduleNotes)
    ?moduleNotes
    :Array.isArray(vault)
      ?vault.filter(entry=>healthEntryType(entry)==='note')
      :[];

  return source
    .filter(note=>note&&typeof note==='object'&&note.id)
    .map(note=>({
      id:String(note.id),
      source:Array.isArray(moduleNotes)?'notes':'vault',
      kind:'note',
      title:healthEntryTitle(note,'Nota'),
      updatedAt:healthEntryUpdatedAt(note),
      raw:note
    }));
}

function healthReadCards(){
  const items=[];
  const seenCardIds={};
  const moduleCards=window.vkCards&&typeof window.vkCards.read==='function'
    ?window.vkCards.read()
    :[];

  if(Array.isArray(moduleCards)){
    moduleCards.forEach(card=>{
      if(!card||typeof card!=='object'||!card.id)return;
      const id=String(card.id);
      if(seenCardIds[id])return;
      seenCardIds[id]=true;

      items.push({
        id,
        source:'cards',
        kind:'card',
        title:healthEntryTitle(card,'Tarjeta'),
        expiry:String(card.expiry||'').trim(),
        updatedAt:healthEntryUpdatedAt(card),
        raw:card
      });
    });
  }

  if(Array.isArray(vault)){
    vault
      .filter(entry=>healthEntryType(entry)==='card')
      .forEach(card=>{
        if(!card?.id)return;
        const id=String(card.id);
        if(seenCardIds[id])return;
        seenCardIds[id]=true;

        items.push({
          id,
          source:'vault',
          kind:'card',
          title:healthEntryTitle(card,'Tarjeta'),
          expiry:String(card.cardExpiry||card.expiry||'').trim(),
          updatedAt:healthEntryUpdatedAt(card),
          raw:card
        });
      });
  }

  return items;
}

function healthReadDocuments(){
  const items=[];
  const moduleDocuments=window.vkDocuments&&typeof window.vkDocuments.read==='function'
    ?window.vkDocuments.read()
    :[];

  if(Array.isArray(moduleDocuments)){
    moduleDocuments.forEach(documentEntry=>{
      if(!documentEntry||typeof documentEntry!=='object'||!documentEntry.id)return;

      items.push({
        id:String(documentEntry.id),
        source:'documents',
        kind:'document',
        subtype:String(documentEntry.category||'other'),
        title:healthEntryTitle(documentEntry,'Documento'),
        expiry:String(documentEntry.expiry||'').trim(),
        updatedAt:healthEntryUpdatedAt(documentEntry),
        raw:documentEntry
      });
    });
  }

  if(Array.isArray(vault)){
    vault
      .filter(entry=>['id','license'].includes(healthEntryType(entry)))
      .forEach(documentEntry=>{
        if(!documentEntry?.id)return;

        const type=healthEntryType(documentEntry);

        items.push({
          id:String(documentEntry.id),
          source:'vault',
          kind:'document',
          subtype:type,
          title:healthEntryTitle(documentEntry,'Documento'),
          expiry:String(
            type==='license'
              ?documentEntry.licExpiry||''
              :documentEntry.idExpiry||''
          ).trim(),
          updatedAt:healthEntryUpdatedAt(documentEntry),
          raw:documentEntry
        });
      });
  }

  return items;
}

// ══ PANEL DE SALUD ══════════════════════════════════════
function healthWorstLevel(items,fallback='protected'){
  return items.reduce((worst,item)=>{
    const level=item&&item.level in VK_HEALTH_LEVELS?item.level:fallback;
    return VK_HEALTH_LEVELS[level]>VK_HEALTH_LEVELS[worst]?level:worst;
  },fallback);
}

function healthSecretKey(value){
  return String(value||'').trim();
}

function healthCharacterGroups(value){
  const secret=String(value||'');
  let groups=0;
  if(/[a-z]/.test(secret))groups++;
  if(/[A-Z]/.test(secret))groups++;
  if(/\d/.test(secret))groups++;
  if(/[^A-Za-z0-9]/.test(secret))groups++;
  return groups;
}

function healthHasObviousPasswordPattern(value){
  const secret=String(value||'').trim();
  const lower=secret.toLowerCase();

  if(!secret)return true;
  if(/^(.)\1+$/.test(secret))return true;
  if(/^(0123456789|1234567890|9876543210|0987654321)/.test(secret))return true;
  if(/^(abcdefghijklmnopqrstuvwxyz|zyxwvutsrqponmlkjihgfedcba)/i.test(secret))return true;
  if(/^(password|contrase(?:n|\u00f1)a|qwerty|admin|welcome|bienvenido|letmein|iloveyou|abc123|123456)/i.test(lower))return true;
  if(/^(19|20)\d{2}$/.test(secret))return true;

  return false;
}

function healthHasObviousPinPattern(value){
  const pin=String(value||'').trim();

  if(!/^\d+$/.test(pin))return true;
  if(/^(.)\1+$/.test(pin))return true;
  if(['0123','1234','2345','3456','4567','5678','6789','9876','8765','7654','6543','5432','4321','3210','0000','1111'].includes(pin))return true;

  let ascending=true;
  let descending=true;

  for(let index=1;index<pin.length;index++){
    const previous=Number(pin[index-1]);
    const current=Number(pin[index]);

    if(current!==previous+1)ascending=false;
    if(current!==previous-1)descending=false;
  }

  return ascending||descending;
}

function healthPasswordBaseAssessment(item){
  const secret=healthSecretKey(item.secret);
  const length=secret.length;

  if(item.subtype==='pin'){
    if(!secret){
      return {level:'risk',reason:'El PIN est\u00e1 vac\u00edo.'};
    }

    if(length<4||healthHasObviousPinPattern(secret)){
      return {level:'risk',reason:'El PIN es demasiado corto o predecible.'};
    }

    if(length<6){
      return {level:'attention',reason:'Conviene utilizar un PIN de al menos 6 d\u00edgitos.'};
    }

    return {
      level:length>=8?'protected':'good',
      reason:length>=8?'PIN largo y sin patrones evidentes.':'PIN correcto y sin patrones evidentes.'
    };
  }

  if(item.subtype==='recovery'){
    if(!secret){
      return {level:'risk',reason:'El c\u00f3digo de recuperaci\u00f3n est\u00e1 vac\u00edo.'};
    }

    return {
      level:'good',
      reason:'C\u00f3digo de recuperaci\u00f3n presente.'
    };
  }

  if(!secret){
    return {level:'risk',reason:'La contrase\u00f1a est\u00e1 vac\u00eda.'};
  }

  if(length<8||healthHasObviousPasswordPattern(secret)){
    return {level:'risk',reason:'La contrase\u00f1a es demasiado corta o predecible.'};
  }

  const groups=healthCharacterGroups(secret);

  if(length<12||groups<2){
    return {level:'attention',reason:'Conviene aumentar la longitud o la variedad.'};
  }

  if(length>=16&&groups>=3){
    return {level:'protected',reason:'Contrase\u00f1a larga, variada y sin patrones evidentes.'};
  }

  return {level:'good',reason:'Contrase\u00f1a adecuada y sin patrones evidentes.'};
}

function healthAnalyzePasswords(passwords){
  const counts=new Map();

  passwords.forEach(item=>{
    const key=healthSecretKey(item.secret);
    if(key)counts.set(key,(counts.get(key)||0)+1);
  });

  const items=passwords.map(item=>{
    const assessment=healthPasswordBaseAssessment(item);
    const key=healthSecretKey(item.secret);
    const duplicate=!!key&&counts.get(key)>1;

    if(duplicate){
      return {
        ...item,
        level:'risk',
        issue:'duplicate',
        reason:item.subtype==='recovery'
          ?'Este c\u00f3digo de recuperaci\u00f3n est\u00e1 repetido.'
          :'Este secreto se utiliza en m\u00e1s de una entrada.'
      };
    }

    const ageMonths=item.updatedAt?(Date.now()-item.updatedAt)/(30.44*864e5):null;
    const ageLevel=ageMonths===null?null:(ageMonths>12?'risk':(ageMonths>=6?'attention':null));
    const ageIsWorse=ageLevel&&VK_HEALTH_LEVELS[ageLevel]>VK_HEALTH_LEVELS[assessment.level];

    if(ageIsWorse){
      return {
        ...item,
        level:ageLevel,
        issue:'age',
        reason:ageLevel==='risk'
          ?'Esta contrase\u00f1a lleva m\u00e1s de 12 meses sin actualizarse.'
          :'Esta contrase\u00f1a lleva m\u00e1s de 6 meses sin actualizarse.'
      };
    }

    return {
      ...item,
      level:assessment.level,
      issue:assessment.level==='protected'||assessment.level==='good'?'none':'strength',
      reason:assessment.reason
    };
  });

  return {
    level:items.length?healthWorstLevel(items,'protected'):'good',
    items,
    counts:{
      total:items.length,
      protected:items.filter(item=>item.level==='protected').length,
      good:items.filter(item=>item.level==='good').length,
      attention:items.filter(item=>item.level==='attention').length,
      risk:items.filter(item=>item.level==='risk').length
    }
  };
}

function healthParseCardExpiry(value){
  const match=String(value||'').trim().match(/^(0[1-9]|1[0-2])\/(\d{2})$/);
  if(!match)return null;

  const month=Number(match[1]);
  const year=2000+Number(match[2]);
  return new Date(year,month,0,23,59,59,999);
}

function healthParseDocumentExpiry(value){
  const raw=String(value||'').trim();
  let match=raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if(match){
    const year=Number(match[1]);
    const month=Number(match[2]);
    const day=Number(match[3]);
    const date=new Date(year,month-1,day,23,59,59,999);

    return date.getFullYear()===year&&date.getMonth()===month-1&&date.getDate()===day
      ?date
      :null;
  }

  match=raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if(match){
    const day=Number(match[1]);
    const month=Number(match[2]);
    const year=Number(match[3]);
    const date=new Date(year,month-1,day,23,59,59,999);

    return date.getFullYear()===year&&date.getMonth()===month-1&&date.getDate()===day
      ?date
      :null;
  }

  return null;
}

function healthDaysUntil(date,now=Date.now()){
  return Math.ceil((date.getTime()-now)/864e5);
}

function healthExpiryBadge(days){
  if(days==null)return '';
  if(days<0)return '<small class="vk-expiry-badge vk-expiry-badge--risk">Caducado</small>';
  if(days<=90)return '<small class="vk-expiry-badge vk-expiry-badge--attention">Caduca en '+days+' d\u00edas</small>';
  return '';
}

function healthAnalyzeMaintenance(cards,documents,now=Date.now()){
  const cardItems=cards.map(item=>{
    const expiry=healthParseCardExpiry(item.expiry);

    if(!expiry){
      return {...item,level:'attention',days:null,reason:'La fecha de caducidad no es v\u00e1lida.'};
    }

    const days=healthDaysUntil(expiry,now);

    if(days<0)return {...item,level:'risk',days,reason:'La tarjeta est\u00e1 caducada.'};
    if(days<=90)return {...item,level:'attention',days,reason:'La tarjeta caduca en 90 d\u00edas o menos.'};

    return {...item,level:'protected',days,reason:'La tarjeta no caduca pr\u00f3ximamente.'};
  });

  const documentItems=documents.map(item=>{
    if(!item.expiry){
      return {...item,level:'good',days:null,reason:'Sin fecha de caducidad registrada.'};
    }

    const expiry=healthParseDocumentExpiry(item.expiry);

    if(!expiry){
      return {...item,level:'attention',days:null,reason:'La fecha de caducidad no es v\u00e1lida.'};
    }

    const days=healthDaysUntil(expiry,now);

    if(days<0)return {...item,level:'risk',days,reason:'El documento est\u00e1 caducado.'};
    if(days<=90)return {...item,level:'attention',days,reason:'El documento caduca en 90 d\u00edas o menos.'};

    return {...item,level:'protected',days,reason:'El documento no caduca pr\u00f3ximamente.'};
  });

  const items=[...cardItems,...documentItems];

  return {
    level:items.length?healthWorstLevel(items,'protected'):'good',
    cards:cardItems,
    documents:documentItems,
    items
  };
}

const VK_HEALTH_LEVEL_META={
  empty:{
    label:'Sin datos',
    short:'A\u00fan no hay datos en la b\u00f3veda.'
  },
  protected:{
    label:'Protegida',
    short:'Todo está correctamente protegido.'
  },
  good:{
    label:'Buena',
    short:'La bóveda está bien, con mejoras preventivas.'
  },
  attention:{
    label:'Atención',
    short:'Hay elementos que conviene revisar.'
  },
  risk:{
    label:'Riesgo crítico',
    short:'Hay problemas importantes que requieren revisión.'
  }
};

function healthReadLocalSecurity(){
  let mode='legacy';
  let hasVault=false;
  let pinConfigured=false;
  let onboardingDone=false;
  let autolockOption='';
  let legacyMeta=null;

  try{
    if(window.vkStore&&
       typeof window.vkStore.hasVault==='function'&&
       window.vkStore.hasVault()){
      mode='vk2';
      hasVault=true;
      pinConfigured=typeof window.vkStore.hasPinWrap==='function'
        ?window.vkStore.hasPinWrap()
        :false;

      const storeMeta=typeof window.vkStore.getMeta==='function'
        ?window.vkStore.getMeta()
        :{};

      onboardingDone=storeMeta?.onboardingDone===true;
      autolockOption=String(storeMeta?.autolockOption||'');
    }
  }catch(error){}

  if(mode==='legacy'){
    try{
      legacyMeta=typeof meta==='function'?meta():null;
    }catch(error){
      legacyMeta=null;
    }

    hasVault=!!legacyMeta;
    pinConfigured=!!(
      legacyMeta&&
      typeof legacyMeta.hash==='string'&&legacyMeta.hash&&
      typeof legacyMeta.pinSalt==='string'&&legacyMeta.pinSalt
    );

    const autoLockMs=legacyMeta&&
      Object.prototype.hasOwnProperty.call(legacyMeta,'autoLockMs')
      ?Number(legacyMeta.autoLockMs)
      :NaN;

    if(autoLockMs===0)autolockOption='immediate';
    else if(autoLockMs>0&&autoLockMs<=30000)autolockOption='30s';
    else if(autoLockMs>30000&&autoLockMs<=60000)autolockOption='1m';
    else if(autoLockMs>60000&&autoLockMs<=300000)autolockOption='5m';
  }

  const pin={
    configured:pinConfigured,
    level:pinConfigured?'protected':'risk',
    reason:pinConfigured
      ?'El acceso mediante PIN está configurado.'
      :'No se ha podido confirmar un PIN configurado.'
  };

  let autolock;

  if(autolockOption==='immediate'||autolockOption==='30s'){
    autolock={
      option:autolockOption,
      level:'protected',
      reason:autolockOption==='immediate'
        ?'La bóveda se bloquea inmediatamente al salir.'
        :'La bóveda se bloquea tras 30 segundos.'
    };
  }else if(autolockOption==='1m'||autolockOption==='5m'){
    autolock={
      option:autolockOption,
      level:'good',
      reason:autolockOption==='1m'
        ?'La bóveda se bloquea tras 1 minuto.'
        :'La bóveda se bloquea tras 5 minutos.'
    };
  }else{
    autolock={
      option:autolockOption,
      level:'attention',
      reason:'No se ha podido confirmar una configuración de autobloqueo válida.'
    };
  }

  return {
    mode,
    hasVault,
    onboardingDone,
    pin,
    autolock,
    level:healthWorstLevel([pin,autolock],'protected')
  };
}

function healthReadContinuity(hasContent,now=Date.now()){
  const rawDriveSync=localStorage.getItem('vk_drive_last_sync');
  const driveSync=Number(rawDriveSync);
  const validDriveSync=Number.isFinite(driveSync)&&driveSync>0&&driveSync<=now;

  const rawLocalBackup=localStorage.getItem('vk_local_backup_last');
  const localBackup=Number(rawLocalBackup);
  const validLocalBackup=Number.isFinite(localBackup)&&localBackup>0&&localBackup<=now;

  const lastSync=Math.max(validDriveSync?driveSync:0,validLocalBackup?localBackup:0);
  const validLastSync=lastSync>0;
  const ageDays=validLastSync?Math.floor((now-lastSync)/864e5):null;

  let backup;

  if(!validLastSync){
    if(!hasContent){
      backup={
        level:'good',
        lastSync:0,
        ageDays:null,
        reason:'La b\u00f3veda todav\u00eda no contiene datos que necesiten respaldo.'
      };
    }else{
      backup={
        level:'attention',
        lastSync:0,
        ageDays:null,
        reason:'A\u00fan no has creado ninguna copia de seguridad.'
      };
    }
  }else if(ageDays<=7){
    backup={
      level:'protected',
      lastSync,
      ageDays,
      reason:'Existe un respaldo confirmado de los últimos 7 días.'
    };
  }else if(ageDays<=30){
    backup={
      level:'good',
      lastSync,
      ageDays,
      reason:'Existe un respaldo confirmado de los últimos 30 días.'
    };
  }else{
    backup={
      level:'attention',
      lastSync,
      ageDays,
      reason:'El último respaldo confirmado tiene más de 30 días.'
    };
  }

  let kitConfigured=false;

  try{
    if(window.vkStore&&
       typeof window.vkStore.hasVault==='function'&&
       typeof window.vkStore.hasPinWrap==='function'&&
       typeof window.vkStore.getMeta==='function'){
      const storeMeta=window.vkStore.getMeta();

      kitConfigured=
        window.vkStore.hasVault()&&
        window.vkStore.hasPinWrap()&&
        storeMeta?.onboardingDone===true;
    }
  }catch(error){}

  const kit={
    configured:kitConfigured,
    level:kitConfigured?'good':'attention',
    reason:kitConfigured
      ?'El kit de emergencia fue configurado durante el alta.'
      :'No se ha podido confirmar un kit de emergencia configurado.'
  };

  return {
    level:backup.level,
    backup,
    kit
  };
}

function healthCountActions(security,continuity,maintenance){
  const securityItems=[
    ...security.passwords.items,
    security.local.pin,
    security.local.autolock
  ];

  const maintenanceItems=maintenance.items;

  return [...securityItems,...maintenanceItems]
    .filter(item=>item.level==='attention'||item.level==='risk')
    .length;
}

function buildVaultHealthReport(now=Date.now()){
  const passwords=healthReadPasswords();
  const notes=healthReadNotes();
  const cards=healthReadCards();
  const documents=healthReadDocuments();
  const hasContent=
    passwords.length+notes.length+cards.length+documents.length>0;

  const passwordAnalysis=healthAnalyzePasswords(passwords);
  const localSecurity=healthReadLocalSecurity();
  const maintenance=healthAnalyzeMaintenance(cards,documents,now);
  const continuity=healthReadContinuity(hasContent,now);

  const security={
    level:healthWorstLevel(
      [
        {level:passwordAnalysis.level},
        {level:localSecurity.level}
      ],
      'protected'
    ),
    passwords:passwordAnalysis,
    local:localSecurity
  };

  const overallLevel=hasContent?healthWorstLevel(
    [
      {level:security.level},
      {level:maintenance.level}
    ],
    'protected'
  ):'empty';

  const actionCount=healthCountActions(
    security,
    continuity,
    maintenance
  );

  return {
    generatedAt:now,
    level:overallLevel,
    label:VK_HEALTH_LEVEL_META[overallLevel].label,
    summary:VK_HEALTH_LEVEL_META[overallLevel].short,
    actionCount,
    security,
    continuity,
    maintenance,
    sources:{
      passwords:passwords.length,
      notes:notes.length,
      cards:cards.length,
      documents:documents.length
    }
  };
}

function healthDashboardActionText(report){
  if(report.level==='empty'){
    return 'A\u00f1ade tu primera entrada para comenzar el an\u00e1lisis.';
  }

  if(report.actionCount===0){
    return 'No hay acciones pendientes.';
  }

  if(report.actionCount===1){
    return 'Hay 1 elemento que conviene revisar.';
  }

  return 'Hay '+report.actionCount+' elementos que conviene revisar.';
}

function healthSetAreaLevel(id,level){
  const element=$(id);
  if(element)element.dataset.healthLevel=level;
}

function renderVaultHealthDashboard(){
  const card=$('healthStatusCard');
  if(!card)return;

  try{
    const report=buildVaultHealthReport();
    const label=$('healthStatusLabel');
    const description=$('healthStatusDesc');
    const action=$('healthStatusAction');

    card.dataset.healthLevel=report.level;
    card.setAttribute(
      'aria-label',
      'Estado de tu bóveda: '+report.label+'. '+healthDashboardActionText(report)
    );

    if(label)label.textContent=report.label;
    if(description)description.textContent=report.summary;
    if(action)action.textContent=healthDashboardActionText(report);

    healthSetAreaLevel('healthAreaSecurity',report.security.level);
    healthSetAreaLevel('healthAreaContinuity',report.continuity.level);
    healthSetAreaLevel('healthAreaMaintenance',report.maintenance.level);

    healthSetAreaLevel('dashTilePasswords',report.security.passwords.items.length?report.security.passwords.level:'empty');
    healthSetAreaLevel('dashTileNotes','empty');
    healthSetAreaLevel('dashTileCards',report.maintenance.cards.length?healthWorstLevel(report.maintenance.cards,'protected'):'empty');
    healthSetAreaLevel('dashTileDocuments',report.maintenance.documents.length?healthWorstLevel(report.maintenance.documents,'protected'):'empty');
  }catch(error){
    console.warn('Vault health dashboard:',error);
    card.dataset.healthLevel='attention';

    const label=$('healthStatusLabel');
    const description=$('healthStatusDesc');
    const action=$('healthStatusAction');

    if(label)label.textContent='Atención';
    if(description)description.textContent='No se ha podido completar el análisis.';
    if(action)action.textContent='Abre el panel para volver a intentarlo.';

    healthSetAreaLevel('healthAreaSecurity','attention');
    healthSetAreaLevel('healthAreaContinuity','attention');
    healthSetAreaLevel('healthAreaMaintenance','attention');

    healthSetAreaLevel('dashTilePasswords','attention');
    healthSetAreaLevel('dashTileNotes','attention');
    healthSetAreaLevel('dashTileCards','attention');
    healthSetAreaLevel('dashTileDocuments','attention');
  }
}

function healthPanelStatus(level){
  const meta=VK_HEALTH_LEVEL_META[level]||VK_HEALTH_LEVEL_META.attention;

  return '<span class="vk-health-status" data-health-level="'+safeEsc(level)+'">'+
    '<span class="vk-health-status__dot" aria-hidden="true"></span>'+
    '<span>'+safeEsc(meta.label)+'</span>'+
  '</span>';
}

function healthPanelMetric(label,value){
  return '<div class="vk-health-metric">'+
    '<span class="vk-health-metric__value">'+safeEsc(String(value))+'</span>'+
    '<span class="vk-health-metric__label">'+safeEsc(label)+'</span>'+
  '</div>';
}

function healthPanelDetail(title,reason,level){
  return '<div class="vk-health-detail">'+
    '<div class="vk-health-detail__top">'+
      '<span class="vk-health-detail__title">'+safeEsc(title)+'</span>'+
      healthPanelStatus(level)+
    '</div>'+
    '<p class="vk-health-detail__reason">'+safeEsc(reason)+'</p>'+
  '</div>';
}

function healthPanelArea(title,body){
  return '<section class="vk-health-area">'+
    '<h3 class="vk-health-area__title">'+safeEsc(title)+'</h3>'+
    body+
  '</section>';
}

function showHealthPanel(){
  const modal=$('healthModal');
  if(!modal)return;

  document.body.classList.add('vk-health-open');
  modal.classList.add('open');
  renderHealthPanel();
}

function renderHealthPanel(){
  const element=$('healthContent');
  if(!element)return;

  try{
    const report=buildVaultHealthReport();
    const passwordCounts=report.security.passwords.counts;
    const passwordIssues=passwordCounts.attention+passwordCounts.risk;
    const maintenanceIssues=report.maintenance.items.filter(
      item=>item.level==='attention'||item.level==='risk'
    ).length;

    const passwordRiskItems=report.security.passwords.items
      .filter(item=>item.level==='attention'||item.level==='risk')
      .sort((a,b)=>(a.level==='risk'?0:1)-(b.level==='risk'?0:1));

    const passwordRiskBody=passwordRiskItems.length
      ?passwordRiskItems.slice(0,5).map(item=>
          healthPanelDetail(item.title||'Sin nombre',item.reason,item.level)
        ).join('')+
        (passwordRiskItems.length>5
          ?'<p class="vk-health-detail__reason">y '+(passwordRiskItems.length-5)+' m\u00e1s.</p>'
          :'')
      :'';

    const securityBody=
      '<div class="vk-health-metrics vk-health-metrics--two">'+
        healthPanelMetric('Contrase\u00f1as',passwordCounts.total)+
        healthPanelMetric('A revisar',passwordIssues)+
      '</div>'+
      healthPanelDetail(
        'Contrase\u00f1as y secretos',
        passwordCounts.total
          ?passwordCounts.risk+' en riesgo y '+passwordCounts.attention+' que necesitan atenci\u00f3n.'
          :'Todav\u00eda no hay secretos guardados para analizar.',
        report.security.passwords.level
      )+
      healthPanelDetail(
        'Acceso mediante PIN',
        report.security.local.pin.level==='protected'
          ?'PIN configurado correctamente.'
          :report.security.local.pin.reason,
        report.security.local.pin.level
      )+
      healthPanelDetail(
        'Autobloqueo',
        report.security.local.autolock.level==='protected'
          ?'Bloqueo autom\u00e1tico activo.'
          :report.security.local.autolock.reason,
        report.security.local.autolock.level
      )+
      (passwordRiskItems.length
        ?healthPanelArea('Elementos que requieren atenci\u00f3n',passwordRiskBody)
        :'');

    const continuityBody=
      healthPanelDetail(
        'Respaldo en Google Drive',
        report.continuity.backup.level==='risk'
          ?'No hay ninguna copia de seguridad configurada.'
          :report.continuity.backup.reason,
        report.continuity.backup.level
      )+
      healthPanelDetail(
        'Kit de emergencia',
        report.continuity.kit.level==='good'||report.continuity.kit.level==='protected'
          ?'Kit de recuperaci\u00f3n disponible.'
          :report.continuity.kit.reason,
        report.continuity.kit.level
      );

    const maintenanceRiskItems=report.maintenance.items
      .filter(item=>item.level==='attention'||item.level==='risk')
      .sort((a,b)=>(a.level==='risk'?0:1)-(b.level==='risk'?0:1));

    const maintenanceRiskBody=maintenanceRiskItems.length
      ?maintenanceRiskItems.slice(0,5).map(item=>
          healthPanelDetail(
            (item.kind==='document'?'Documento \u00b7 ':'Tarjeta \u00b7 ')+(item.title||'Sin nombre'),
            item.reason,
            item.level
          )
        ).join('')+
        (maintenanceRiskItems.length>5
          ?'<p class="vk-health-detail__reason">y '+(maintenanceRiskItems.length-5)+' m\u00e1s.</p>'
          :'')
      :'';

    const maintenanceBody=
      '<div class="vk-health-metrics vk-health-metrics--three">'+
        healthPanelMetric('Tarjetas',report.maintenance.cards.length)+
        healthPanelMetric('Documentos',report.maintenance.documents.length)+
        healthPanelMetric('A revisar',maintenanceIssues)+
      '</div>'+
      healthPanelDetail(
        'Caducidades',
        maintenanceIssues
          ?maintenanceIssues+' elemento'+(maintenanceIssues===1?'':'s')+' requiere'+(maintenanceIssues===1?'':'n')+' revisi\u00f3n.'
          :'No hay caducidades pendientes.',
        report.maintenance.level
      )+
      (maintenanceRiskItems.length
        ?healthPanelArea('Caducidades detectadas',maintenanceRiskBody)
        :'');

    element.innerHTML=
      '<section class="vk-health-overview" data-health-level="'+safeEsc(report.level)+'">'+
        '<div class="vk-health-overview__row">'+
          '<svg class="vk-health-overview__shield" viewBox="0 0 24 28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 1.5c3.4 2.8 6.6 4.1 10 4.1v8.2c0 6-4.3 9.9-10 12.7C6.3 23.7 2 19.8 2 13.8V5.6c3.4 0 6.6-1.3 10-4.1Z"/></svg>'+
          healthPanelStatus(report.level)+
        '</div>'+
        '<p class="vk-health-overview__summary">'+safeEsc(report.summary)+'</p>'+
        '<p class="vk-health-overview__action">'+safeEsc(healthDashboardActionText(report))+'</p>'+
      '</section>'+
      '<div class="vk-health-inventory vk-health-metrics vk-health-metrics--four">'+
        healthPanelMetric('Contrase\u00f1as',report.sources.passwords)+
        healthPanelMetric('Notas',report.sources.notes)+
        healthPanelMetric('Tarjetas',report.sources.cards)+
        healthPanelMetric('Documentos',report.sources.documents)+
      '</div>'+
      '<div class="vk-health-areas">'+
        healthPanelArea('Seguridad',securityBody)+
        healthPanelArea('Continuidad',continuityBody)+
        healthPanelArea('Mantenimiento',maintenanceBody)+
      '</div>';
  }catch(error){
    console.warn('Vault health panel:',error);

    element.innerHTML=
      '<div class="vk-health-error">'+
        '<strong>No se ha podido completar el an\u00e1lisis.</strong>'+
        '<p>Cierra el panel y vuelve a intentarlo.</p>'+
      '</div>';
  }
}

// ============================================================
//  IMPORTADOR CSV - LastPass, Bitwarden, 1Password, Chrome
// ============================================================
function detectCsvFormat(headers){
  const h = headers.map(x=>x.toLowerCase().trim());
  // LastPass: url,username,password,totp,extra,name,grouping,fav
  if(h.includes('grouping') && h.includes('extra')) return 'lastpass';
  // Bitwarden: type,name,notes,fields,reprompt,login_uri,login_username,login_password,login_totp
  if(h.includes('login_username') || h.includes('login_password')) return 'bitwarden';
  // 1Password: title,username,password,url,notes,type
  if(h.includes('type') && h.includes('title') && h.includes('notes')) return '1password';
  // Chrome / Edge: name,url,username,password
  if(h.includes('name') && h.includes('url') && h.includes('username') && h.includes('password') && h.length<=5) return 'chrome';
  // Genérico
  return 'generic';
}

function parseCsvLine(line){
  const result=[];let cur='';let inQ=false;
  for(let i=0;i<line.length;i++){
    const c=line[i];
    if(c==='"'){
      if(inQ && line[i+1]==='"'){cur+='"';i++;}
      else inQ=!inQ;
    } else if(c===','&&!inQ){result.push(cur);cur='';}
    else cur+=c;
  }
  result.push(cur);
  return result;
}

function parseCsv(text){
  const lines=text.split(/\r?\n/).filter(l=>l.trim());
  if(!lines.length)return[];
  const headers=parseCsvLine(lines[0]);
  return lines.slice(1).map(line=>{
    const vals=parseCsvLine(line);
    const obj={};
    headers.forEach((h,i)=>obj[h.trim()]=vals[i]?.trim()||'');
    return obj;
  }).filter(row=>Object.values(row).some(v=>v));
}

function mapCsvRow(row, format){
  let service='',user='',pass='',url='',note='',category='general';
  
  if(format==='lastpass'){
    service = row['name']||row['grouping']||'';
    user    = row['username']||'';
    pass    = row['password']||'';
    url     = row['url']||'';
    note    = row['extra']||'';
    const g = (row['grouping']||'').toLowerCase();
    if(g.includes('bank')||g.includes('banco')) category='banco';
    else if(g.includes('email')||g.includes('mail')) category='correo';
    else if(g.includes('social')) category='social';
    else if(g.includes('work')||g.includes('trabajo')) category='trabajo';
  } else if(format==='bitwarden'){
    service = row['name']||'';
    user    = row['login_username']||row['username']||'';
    pass    = row['login_password']||row['password']||'';
    url     = row['login_uri']||row['uri']||'';
    note    = row['notes']||'';
    const type=(row['type']||'').toLowerCase();
    if(type==='login') category='general';
  } else if(format==='1password'){
    service = row['title']||'';
    user    = row['username']||'';
    pass    = row['password']||'';
    url     = row['url']||row['website']||'';
    note    = row['notes']||'';
  } else if(format==='chrome'){
    service = row['name']||'';
    user    = row['username']||'';
    pass    = row['password']||'';
    url     = row['url']||'';
  } else {
    // Genérico — intentar detectar columnas comunes
    service = row['name']||row['title']||row['service']||row['sitename']||Object.values(row)[0]||'';
    user    = row['username']||row['user']||row['login']||row['email']||'';
    pass    = row['password']||row['pass']||row['passwd']||'';
    url     = row['url']||row['website']||row['uri']||'';
    note    = row['notes']||row['note']||row['comment']||'';
  }
  
  return {service:service.trim(),user:user.trim(),pass:pass.trim(),
          url:url.trim(),note:note.trim(),category};
}

async function importFromCSV(file){
  if(!file)return;
  if(file.size > 5 * 1024 * 1024){ toast('Archivo demasiado grande (máx. 5 MB)'); return; }
  if(!unlocked){toast('Desbloquea la bóveda primero');return;}
  
  const text = await file.text().catch(()=>{toast('Error al leer el archivo');return null;});
  if(!text)return;
  
  const rows = parseCsv(text);
  if(!rows.length){toast('El archivo CSV está vacío o no tiene el formato correcto');return;}
  
  const headers = Object.keys(rows[0]);
  const format  = detectCsvFormat(headers);
  
  // Mapear todas las filas
  const mapped = rows.map(r=>mapCsvRow(r,format)).filter(r=>r.service||r.user||r.pass);
  
  if(!mapped.length){toast('No se encontraron entradas válidas en el CSV');return;}
  
  // Mostrar preview en modal
  renderCsvImportModal(mapped, format, file.name);
}

function renderCsvImportModal(entries, format, filename){
  const formatLabels={lastpass:'LastPass',bitwarden:'Bitwarden','1password':'1Password',chrome:'Chrome/Edge',generic:'Genérico'};
  const fLabel = formatLabels[format]||format;
  
  let h='';
  
  // Header info
  h+=`<div style="background:rgba(0,180,255,.07);border:1px solid rgba(0,180,255,.15);border-radius:12px;padding:12px 14px;margin-bottom:16px">
    <div style="font-size:13px;font-weight:800;color:#00d9ff;margin-bottom:4px">Formato detectado: ${fLabel}</div>
    <div style="font-size:12px;color:#7ab0d0">Archivo: ${esc(filename)}</div>
    <div style="font-size:12px;color:#7ab0d0;margin-top:2px">${entries.length} entradas encontradas</div>
  </div>`;
  
  // Aviso duplicados
  const existing = new Set(vault.map(e=>e.service.toLowerCase()));
  const dupes = entries.filter(e=>existing.has(e.service.toLowerCase()));
  if(dupes.length){
    h+=`<div style="background:rgba(255,180,0,.07);border:1px solid rgba(255,180,0,.2);border-radius:10px;padding:10px 14px;margin-bottom:12px;font-size:12px;color:#f59e0b">
      ⚠️ ${dupes.length} entrada${dupes.length>1?'s':''} ya existe${dupes.length>1?'n':''} en tu bóveda (se añadirán de todas formas)
    </div>`;
  }
  
  // Preview (primeras 5)
  h+=`<div style="font-size:11px;font-weight:900;color:rgba(0,210,255,.6);letter-spacing:.6px;margin-bottom:8px">VISTA PREVIA (${Math.min(5,entries.length)} de ${entries.length})</div>`;
  entries.slice(0,5).forEach(e=>{
    h+=`<div style="background:rgba(0,14,32,.6);border:1px solid rgba(0,180,255,.1);border-radius:10px;padding:10px 12px;margin-bottom:6px">
      <div style="font-size:13px;font-weight:700;color:#e8f4ff">${safeEsc(e.service)||'(sin nombre)'}</div>
      <div style="font-size:11px;color:#4a7090;margin-top:2px">${esc(e.user||e.url||'')}</div>
    </div>`;
  });
  if(entries.length>5){
    h+=`<div style="font-size:12px;color:#4a7090;text-align:center;padding:8px 0">...y ${entries.length-5} más</div>`;
  }
  
  // Botones
  h+=`<div style="display:flex;gap:10px;margin-top:16px">
    <button onclick="closeModals()" style="flex:1;padding:13px;border-radius:12px;border:1px solid rgba(0,180,255,.2);background:none;color:#7ab0d0;font-weight:700;font-size:14px">Cancelar</button>
    <button onclick="confirmCsvImport()" id="csvImportConfirmBtn"
      style="flex:2;padding:13px;border-radius:12px;border:0;background:linear-gradient(135deg,#6A35FF,#007BFF);color:#fff;font-weight:900;font-size:14px">
      Importar ${entries.length} entradas
    </button>
  </div>`;
  
  // Guardar referencia global
  window._csvImportEntries = entries;
  
  const body = document.getElementById('csvImportBody');
  if(body) body.innerHTML = h;
  
  const modal = document.getElementById('csvImportModal');
  if(modal) modal.classList.add('open');
}

async function confirmCsvImport(){
  const entries = window._csvImportEntries;
  if(!entries||!entries.length){closeModals();return;}
  
  const btn = document.getElementById('csvImportConfirmBtn');
  const _btnOrigText = btn?btn.textContent:'';
  if(btn){btn.disabled=true;btn.textContent='Importando...';}
  
  let imported=0;
  for(const e of entries){
    if(!e.service && !e.user && !e.pass) continue;
    const entry={
      id: crypto.randomUUID(),
      service: e.service||e.url||e.user||'Importado',
      entryType: 'password',
      type: 'Cuenta',
      category: e.category||'general',
      user: e.user||'',
      email: '',
      pass: e.pass||'',
      url: e.url||'',
      note: e.note||'',
      icon: '',
      fav: false,
      updated: Date.now(),
      used: 0,
      passHistory: [],
      reminder: null,
    };
    vault.unshift(entry);
    imported++;
  }
  
  try{
    await persist();
    window._csvImportEntries = null;
    closeModals();
    render();
    vibe([30,20,60]);
    soundSuccess?.();
    toast(`✅ ${imported} entradas importadas correctamente`);
  }catch(err){
    vault.splice(0,imported);
    console.error('confirmCsvImport:',err);
    toast('No se pudo importar el CSV','err');
  }finally{
    if(btn){btn.disabled=false;btn.textContent=_btnOrigText;}
  }
}
// ═════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════
//  SISTEMA DE ETIQUETAS PERSONALIZADAS
// ══════════════════════════════════════════════════════════════

let _entryTags = []; // etiquetas de la entrada en edición
let _activeTagFilter = null; // etiqueta activa en el filtro

// ── Editor de etiquetas en el formulario ──────────────────────
function handleTagInput(e){
  const input = $('tagInput');
  if(!input) return;
  const val = input.value.trim().replace(/,$/,'').trim();
  if((e.key === 'Enter' || e.key === ',') && val){
    e.preventDefault();
    addEntryTag(val);
    input.value = '';
    input.style.width = '120px';
  } else if(e.key === 'Backspace' && !input.value && _entryTags.length){
    removeEntryTag(_entryTags[_entryTags.length-1]);
  }
}

function addEntryTag(tag){
  const t = tag.toLowerCase().trim().replace(/[^a-záéíóúüñA-ZÁÉÍÓÚÜÑ0-9\s\-_]/g,'').trim();
  if(!t || _entryTags.includes(t)) return;
  if(_entryTags.length >= 10){ toast('Máximo 10 etiquetas por entrada'); return; }
  _entryTags.push(t);
  renderTagChipsEdit();
}

function removeEntryTag(tag){
  _entryTags = _entryTags.filter(t => t !== tag);
  renderTagChipsEdit();
}

function renderTagChipsEdit(){
  const el = $('tagChipsEdit');
  if(!el) return;
  el.innerHTML = '';
  _entryTags.forEach(tag => {
    const chip = document.createElement('span');
    chip.style.cssText = 'display:inline-flex;align-items:center;gap:4px;background:rgba(0,180,255,.15);border:1px solid rgba(0,180,255,.35);border-radius:20px;padding:3px 10px 3px 10px;font-size:12px;color:#00d9ff;font-weight:700;cursor:default';
    const chipText = document.createTextNode('#'+tag+' ');
    const chipBtn = document.createElement('button');
    chipBtn.textContent = '✕';
    chipBtn.style.cssText = 'border:0;background:none;color:#00d9ff;font-size:12px;cursor:pointer;padding:0;line-height:1;margin-left:2px';
    chipBtn.onclick = (function(t){return function(){removeEntryTag(t);};})(tag);
    chip.appendChild(chipText);
    chip.appendChild(chipBtn);
    el.appendChild(chip);
  });
}

function resetEntryTags(){
  _entryTags = [];
  renderTagChipsEdit();
  const input = $('tagInput');
  if(input){ input.value=''; input.style.width='120px'; }
}

function loadEntryTags(e){
  _entryTags = Array.isArray(e?.tags) ? [...e.tags] : [];
  renderTagChipsEdit();
}

// ── Filtro por etiqueta en la lista ──────────────────────────
function setTagFilter(tag){
  _activeTagFilter = _activeTagFilter === tag ? null : tag;
  renderTagFilterChips();
  render();
}

function updateCatChipCounts(){
  const buttons=[...document.querySelectorAll('.catChip')];
  if(!buttons.length)return;

  const cleanCounts={};
  (vault||[]).forEach(e=>{
    categoryKeysForEntry(e).forEach(k=>{
      cleanCounts[k]=(cleanCounts[k]||0)+1;
    });
  });

  buttons.forEach(btn=>{
    if(!btn.dataset.baseLabel){
      btn.dataset.baseLabel=btn.textContent.replace(/\s*\(\d+\)$/,'').trim();
    }
    if(!Object.prototype.hasOwnProperty.call(btn.dataset,'cat')){
      btn.dataset.cat=catFromChip(btn);
    }

    const cat=normalizeCategoryId(btn.dataset.cat||'');
    const n=cat===''?(vault||[]).length:(cleanCounts[cat]||0);
    const base=btn.dataset.baseLabel||btn.textContent.replace(/\s*\(\d+\)$/,'').trim();
    btn.textContent=n?base+' ('+n+')':base;
  });
}
function renderTagFilterChips(){
  // Recoger todas las etiquetas del vault
  const allTags = {};
  vault.forEach(e => {
    (e.tags||[]).forEach(t => { allTags[t] = (allTags[t]||0)+1; });
  });

  const row = $('tagFilterRow');
  const chips = $('tagFilterChips');
  if(!row || !chips) return;

  if(!Object.keys(allTags).length){
    row.style.display = 'none';
    return;
  }

  row.style.display = '';
  chips.innerHTML = '';

  // Chip "Sin filtro" si hay uno activo
  if(_activeTagFilter){
    const clear = document.createElement('button');
    clear.onclick = () => setTagFilter(null);
    clear.style.cssText = 'padding:4px 10px;border-radius:20px;border:1px solid rgba(255,100,100,.4);background:rgba(255,100,100,.08);color:#ff8a8a;font-size:11px;font-weight:800;cursor:pointer';
    clear.textContent = '✕ Quitar filtro';
    chips.appendChild(clear);
  }

  Object.entries(allTags)
    .sort((a,b) => b[1]-a[1])
    .forEach(([tag, count]) => {
      const active = _activeTagFilter === tag;
      const chip = document.createElement('button');
      chip.onclick = () => setTagFilter(tag);
      chip.style.cssText = `padding:4px 12px;border-radius:20px;font-size:11px;font-weight:800;cursor:pointer;transition:.15s;
        border:1px solid ${active?'rgba(0,210,255,.6)':'rgba(0,180,255,.2)'};
        background:${active?'rgba(0,210,255,.15)':'none'};
        color:${active?'#00d9ff':'#4a7090'}`;
      chip.textContent = '#'+tag+' '+count;
      chips.appendChild(chip);
    });
}

// ── Integración con openEntry ─────────────────────────────────
// (se llama desde openEntry al cargar una entrada)
function _loadTagsForEntry(e){
  loadEntryTags(e);
}

// ── Integración con saveEntry ─────────────────────────────────
// (se llama desde saveEntry para obtener las tags actuales)
function _getEntryTags(){
  // Si hay texto sin confirmar en el input, añadirlo
  const input = $('tagInput');
  if(input && input.value.trim()){
    addEntryTag(input.value.trim());
    input.value = '';
  }
  return [..._entryTags];
}

// ── Integración con closeModals ───────────────────────────────
// resetEntryTags ya está definida arriba — se llama desde closeModals

// ══════════════════════════════════════════════════════════════


/* ==========================================================================
   VAULTKEY UI v5.1 — Fix selector de tipos de entrada
   Causa corregida:
   - El selector Contraseña / Nota / Tarjeta / Documento dependía solo de onclick inline.
   - setEntryType existía, pero no estaba expuesto explícitamente como window.setEntryType.
   - Después de los intentos de carrusel/drag, el click podía quedar bloqueado o no llegar al onclick.
   Solución:
   - Exponer setEntryType.
   - Delegar pointerup/click directamente sobre #entryTypeRow.
   - No toca cifrado, guardado, Drive, PIN ni biometría.
   ========================================================================== */

try {
  window.setEntryType = setEntryType;
} catch(e) {}

(function(){
  function initEntryTypeSelectorFix(){
    const row = document.getElementById('entryTypeRow');
    if(!row || row.dataset.vkEntryTypeSelectorFix === '1') return;

    row.dataset.vkEntryTypeSelectorFix = '1';

    const typeById = {
      typeBtnPass: 'password',
      typeBtnNote: 'note',
      typeBtnCard: 'card',
      typeBtnId: 'id',
      typeBtnLicense: 'license',
      typeBtnMedical: 'medical',
      typeBtnWifi: 'wifi'
    };

    let startX = 0;
    let startY = 0;
    let moved = false;

    function buttonFromEvent(e){
      return e.target && e.target.closest
        ? e.target.closest('#entryTypeRow button')
        : null;
    }

    function typeFromButton(btn){
      return btn ? typeById[btn.id] : '';
    }

    row.addEventListener('pointerdown', function(e){
      startX = Number(e.clientX || 0);
      startY = Number(e.clientY || 0);
      moved = false;
    }, true);

    row.addEventListener('pointermove', function(e){
      const dx = Math.abs(Number(e.clientX || 0) - startX);
      const dy = Math.abs(Number(e.clientY || 0) - startY);
      if(dx > 8 || dy > 8) moved = true;
    }, true);

    row.addEventListener('pointerup', function(e){
      const btn = buttonFromEvent(e);
      const type = typeFromButton(btn);

      if(!btn || !type || moved) return;

      e.preventDefault();
      e.stopImmediatePropagation();

      setEntryType(type);
    }, true);

    row.addEventListener('click', function(e){
      const btn = buttonFromEvent(e);
      const type = typeFromButton(btn);

      if(!btn || !type) return;

      e.preventDefault();
      e.stopImmediatePropagation();

      setEntryType(type);
    }, true);
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', initEntryTypeSelectorFix);
  } else {
    initEntryTypeSelectorFix();
  }
})();


/* ============================================================
   VaultKey v1.2 — Módulo Notas (CRUD local)
   Almacenamiento independiente: localStorage["vaultkey_notes"]
   ============================================================ */
(function(){
  'use strict';

  var NOTES_KEY='vaultkey_notes';
  var notesSearchBound=false;

  function notesUseVK2(){
    return typeof vkStore!=='undefined'&&vkStore.hasVault()&&
      typeof vkSession!=='undefined'&&vkSession.isActive();
  }

  function noteFromVK2(entry){
    return {
      id:entry.id,
      title:entry.title||'',
      content:entry.body||'',
      fav:entry.fav===true,
      createdAt:entry.createdAt,
      updatedAt:entry.updatedAt
    };
  }

  function notesRead(){
    if(notesUseVK2()){
      return (vault||[])
        .filter(function(entry){
          return entry&&entry.type==='note'&&typeof entry.id==='string';
        })
        .map(noteFromVK2);
    }

    try{
      var parsed=JSON.parse(localStorage.getItem(NOTES_KEY)||'[]');
      return Array.isArray(parsed)?parsed.filter(function(note){
        return note&&typeof note==='object'&&typeof note.id==='string';
      }):[];
    }catch(error){
      console.warn('VaultKey Notes: JSON inválido',error);
      return [];
    }
  }

  function notesWrite(notes){
    localStorage.setItem(NOTES_KEY,JSON.stringify(notes));
  }

  function noteUuid(){
    if(window.crypto&&typeof window.crypto.randomUUID==='function'){
      return 'uuid-'+window.crypto.randomUUID();
    }
    return 'uuid-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);
  }

  function noteEscape(value){
    return String(value==null?'':value)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#039;');
  }

  function noteFormatDate(timestamp){
    var date=new Date(Number(timestamp)||Date.now());
    return date.toLocaleDateString('es-ES',{
      day:'2-digit',
      month:'2-digit',
      year:'numeric'
    });
  }

  function notePreview(content){
    var normalized=String(content||'').replace(/\s+/g,' ').trim();
    return normalized.length>100?normalized.slice(0,100)+'…':normalized;
  }

  function updateNotesCount(){
    var counter=document.getElementById('statNotes');
    if(!counter)return;
    var count=notesRead().length;
    counter.textContent=count+' nota'+(count===1?'':'s');
  }

  function renderNotesList(){
    var list=document.getElementById('notesList');
    if(!list)return;

    var search=document.getElementById('notesSearch');
    var query=String(search&&search.value||'').trim().toLocaleLowerCase('es');
    var notes=notesRead()
      .filter(function(note){
        return !query||String(note.title||'').toLocaleLowerCase('es').includes(query);
      })
      .sort(function(a,b){
        return Number(b.updatedAt||b.createdAt||0)-Number(a.updatedAt||a.createdAt||0);
      });

    if(!notes.length){
      list.innerHTML='<div class="vk-notes-empty">'+
        '<strong>'+(query?'No se encontraron notas':'Aún no hay notas')+'</strong>'+
        '<span>'+(query?'Prueba con otro título.':'Pulsa + para crear la primera nota.')+'</span>'+
      '</div>';
      return;
    }

    list.innerHTML=notes.map(function(note){
      var preview=notePreview(note.content)||'Sin descripción.';
      return '<button type="button" class="vk-note-row" data-note-id="'+noteEscape(note.id)+'">'+
        '<span class="vk-note-row-main">'+
          '<strong>'+noteEscape(note.title||'Sin título')+'</strong>'+
          '<small>'+noteEscape(preview)+'</small>'+
        '</span>'+
        '<span class="vk-note-row-meta">'+
          '<time datetime="'+new Date(Number(note.updatedAt||note.createdAt||Date.now())).toISOString()+'">'+noteFormatDate(note.updatedAt||note.createdAt)+'</time>'+
          '<svg class="vk-note-row-note-icon" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 2v20M3 6h4M3 10h4M3 14h4M3 18h4"/><rect x="7" y="3" width="14" height="18" rx="2"/><path d="m14 8 4-4 2 2-4 4-3 1 1-3Z"/></svg>'+
          '<svg class="vk-note-row-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>'+
        '</span>'+
      '</button>';
    }).join('');
  }

  window.showNotes=function(dir){
    if(typeof window.show==='function')window.show('notes',dir);
    renderNotesList();
    updateNotesCount();
  };

  window.showNoteDetail=function(id){
    var note=notesRead().find(function(item){return item.id===id;});
    if(!note){
      window.showNotes('left');
      return;
    }

    window.__vkCurrentNoteId=note.id;
    document.getElementById('noteDetailTitle').textContent=note.title||'Sin título';
    document.getElementById('noteDetailCardTitle').textContent=note.title||'Sin título';
    document.getElementById('noteDetailContent').textContent=note.content||'Sin descripción.';
    document.getElementById('noteDetailDate').textContent='Actualizada: '+noteFormatDate(note.updatedAt||note.createdAt);

    if(typeof window.show==='function')window.show('noteDetail','right');
  };

  window.openCreateNote=function(){
    var form=document.getElementById('noteCreateForm');
    if(form)form.reset();
    var favoriteButton=document.getElementById('noteCreateFavorite');
    if(favoriteButton)setFavoriteSwitch(favoriteButton,false);
    window.__vkCurrentNoteId=null;
    if(typeof window.show==='function')window.show('noteCreate','right');
    setTimeout(function(){
      var input=document.getElementById('noteCreateTitleInput');
      if(input)input.focus();
    },280);
  };

  window.toggleNoteCreateFavorite=function(){
    var button=document.getElementById('noteCreateFavorite');
    if(!button)return;
    var value=button.getAttribute('aria-checked')!=='true';
    setFavoriteSwitch(button,value);
  };

  window.openEditNote=function(id){
    var note=notesRead().find(function(item){return item.id===id;});
    if(!note)return;

    window.__vkCurrentNoteId=note.id;
    document.getElementById('noteEditTitleInput').value=note.title||'';
    document.getElementById('noteEditContentInput').value=note.content||'';
    var favoriteButton=document.getElementById('noteEditFavorite');
    if(favoriteButton)setFavoriteSwitch(favoriteButton,note.fav===true);
    if(typeof window.show==='function')window.show('noteEdit','right');
  };

  window.toggleNoteEditFavorite=function(){
    var button=document.getElementById('noteEditFavorite');
    if(!button)return;
    var value=button.getAttribute('aria-checked')!=='true';
    setFavoriteSwitch(button,value);
  };

  window.saveNote=async function(id,title,content,fav){
    title=String(title||'').trim();
    content=String(content||'').trim();

    if(!title){
      if(typeof window.toast==='function')window.toast('El título es obligatorio','err');
      var target=id?'noteEditTitleInput':'noteCreateTitleInput';
      var input=document.getElementById(target);
      if(input)input.focus();
      return false;
    }

    // VK 2.0: crear o actualizar la nota en la bóveda cifrada.
    // Seguridad: nunca escribir notas nuevas o editadas fuera de la bóveda cifrada VK2.
    if(!notesUseVK2()){
      if(typeof window.toast==='function'){
        window.toast('Desbloquea una bóveda VaultKey 2.0 para guardar notas cifradas.','err');
      }
      return false;
    }

    if(typeof vkModels==='undefined'){
      console.error('saveNote: vkModels no esta disponible');
      if(typeof window.toast==='function'){
        window.toast('No se pudo preparar el guardado cifrado de la nota.','err');
      }
      return false;
    }

    {
      var _prevNoteEntry=null,_prevNoteIndex=-1,_pushedNoteEntry=null;
      try{
        var entry;
        if(id){
          var vaultIndex=(vault||[]).findIndex(function(item){
            return item&&item.type==='note'&&item.id===id;
          });
          if(vaultIndex===-1)return false;
          _prevNoteEntry=vault[vaultIndex];
          _prevNoteIndex=vaultIndex;
          entry=Object.assign({},vault[vaultIndex],{
            title:title,
            body:content,
            fav:fav===true,
            updatedAt:Date.now()
          });
          vault[vaultIndex]=entry;
        }else{
          entry=vkModels.create('note',{
            title:title,
            body:content,
            fav:fav===true
          });
          vault.push(entry);
          _pushedNoteEntry=entry;
        }
        await persist();
        if(typeof render==='function')render();
        if(typeof window.toast==='function')window.toast(id?'Nota guardada':'Nota creada','ok');
        window.showNotes('left');
        return true;
      }catch(error){
        if(_pushedNoteEntry){
          var _pushedNoteIdx=vault.indexOf(_pushedNoteEntry);
          if(_pushedNoteIdx!==-1)vault.splice(_pushedNoteIdx,1);
        }else if(_prevNoteIndex!==-1&&_prevNoteEntry){
          vault[_prevNoteIndex]=_prevNoteEntry;
        }
        console.error('saveNote VK2:',error);
        if(typeof window.toast==='function')window.toast('No se pudo guardar la nota','err');
        return false;
      }
    }

    var notes=notesRead();
    var now=Date.now();

    if(id){
      var index=notes.findIndex(function(note){return note.id===id;});
      if(index===-1)return false;
      notes[index]=Object.assign({},notes[index],{
        title:title,
        content:content,
        updatedAt:now
      });
    }else{
      id=noteUuid();
      notes.push({
        id:id,
        title:title,
        content:content,
        createdAt:now,
        updatedAt:now
      });
    }

    notesWrite(notes);
    updateNotesCount();
    if(typeof window.toast==='function')window.toast(id===window.__vkCurrentNoteId?'Nota guardada':'Nota creada','ok');
    window.showNotes('left');
    return true;
  };

  window.deleteNote=async function(id){
    var note=notesRead().find(function(item){return item.id===id;});
    if(!note)return;

    if(!await vkConfirm('¿Eliminar nota?','Se eliminará de la bóveda y no podrás recuperarla.',{variant:'delete-password',confirmText:'Eliminar'}))return;

    if(notesUseVK2()){
      var vaultIndex=(vault||[]).findIndex(function(item){
        return item&&item.type==='note'&&item.id===id;
      });
      if(vaultIndex===-1)return;
      var _removedNoteEntry=vault[vaultIndex];
      vault.splice(vaultIndex,1);
      try{
        await persist();
      }catch(error){
        vault.splice(vaultIndex,0,_removedNoteEntry);
        console.error('deleteNote VK2:',error);
        if(typeof window.toast==='function')window.toast('No se pudo eliminar la nota','err');
        return;
      }
      if(typeof render==='function')render();
    }else{
      notesWrite(notesRead().filter(function(item){return item.id!==id;}));
    }
    window.__vkCurrentNoteId=null;
    updateNotesCount();
    if(typeof window.toast==='function')window.toast('Nota eliminada','ok');
    window.showNotes('left');
  };

  document.addEventListener('click',function(event){
    var row=event.target.closest&&event.target.closest('.vk-note-row[data-note-id]');
    if(!row)return;
    window.showNoteDetail(row.getAttribute('data-note-id'));
  });

  document.addEventListener('DOMContentLoaded',function(){
    var search=document.getElementById('notesSearch');
    if(search&&!notesSearchBound){
      notesSearchBound=true;
      search.addEventListener('input',renderNotesList);
    }
    updateNotesCount();
  });

  window.vkNotes={
    read:notesRead,
    render:renderNotesList,
    updateCount:updateNotesCount
  };
})();

/* ============================================================
   VaultKey v1.2 — Módulo Tarjetas (CRUD local)
   Almacenamiento independiente: localStorage["vaultkey_cards"]
   ============================================================ */
(function(){
  'use strict';

  var CARDS_KEY='vaultkey_cards';
  var cardsSearchBound=false;
  var detailCvvVisible=false;

  function cardsUseVK2(){
    return typeof vkStore!=='undefined'&&vkStore.hasVault()&&
      typeof vkSession!=='undefined'&&vkSession.isActive();
  }

  function cardFromVK2(entry){
    return {
      id:entry.id,
      holder:entry.holder||'',
      number:entry.number||'',
      expiry:entry.expiry||'',
      cvv:entry.cvv||'',
      note:entry.notes||'',
      fav:entry.fav===true,
      createdAt:entry.createdAt,
      updatedAt:entry.updatedAt
    };
  }

  function cardsRead(){
    if(cardsUseVK2()){
      return (vault||[])
        .filter(function(entry){
          return entry&&entry.type==='card'&&typeof entry.id==='string';
        })
        .map(cardFromVK2);
    }

    try{
      var parsed=JSON.parse(localStorage.getItem(CARDS_KEY)||'[]');
      return Array.isArray(parsed)?parsed.filter(function(card){
        return card&&typeof card==='object'&&typeof card.id==='string';
      }):[];
    }catch(error){
      console.warn('VaultKey Cards: JSON inválido',error);
      return [];
    }
  }

  function cardsWrite(cards){
    localStorage.setItem(CARDS_KEY,JSON.stringify(cards));
  }

  function cardUuid(){
    if(window.crypto&&typeof window.crypto.randomUUID==='function'){
      return 'uuid-'+window.crypto.randomUUID();
    }
    return 'uuid-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);
  }

  function cardEscape(value){
    return String(value==null?'':value)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#039;');
  }

  function cardDigits(value){
    return String(value||'').replace(/\D/g,'').slice(0,19);
  }

  function cardNumberGroups(value){
    return cardDigits(value).replace(/(.{4})/g,'$1 ').trim();
  }

  function cardMaskedNumber(value){
    var digits=cardDigits(value);
    var last=digits.slice(-4).padStart(4,'•');
    return '•••• •••• •••• '+last;
  }

  function normalizeExpiry(value){
    var digits=String(value||'').replace(/\D/g,'').slice(0,4);
    if(!digits)return '';
    var month=digits.slice(0,2);
    var year=digits.slice(2,4);
    if(month.length===2){
      var monthNumber=Math.max(1,Math.min(12,Number(month)||1));
      month=String(monthNumber).padStart(2,'0');
    }
    return year?month+'/'+year:month;
  }

  function updateCardsCount(){
    var counter=document.getElementById('statCards');
    if(!counter)return;
    var count=cardsRead().length;
    counter.textContent=count+' tarjeta'+(count===1?'':'s');
  }

  function renderCardsList(){
    var list=document.getElementById('cardsList');
    if(!list)return;

    var search=document.getElementById('cardsSearch');
    var query=String(search&&search.value||'').trim().toLocaleLowerCase('es');
    var cards=cardsRead()
      .filter(function(card){
        return !query||String(card.holder||'').toLocaleLowerCase('es').includes(query);
      })
      .sort(function(a,b){
        return Number(b.updatedAt||b.createdAt||0)-Number(a.updatedAt||a.createdAt||0);
      });

    if(!cards.length){
      list.innerHTML='<div class="vk-cards-empty">'+
        '<strong>'+(query?'No se encontraron tarjetas':'Aún no hay tarjetas')+'</strong>'+
        '<span>'+(query?'Prueba con otro titular.':'Pulsa + para añadir la primera tarjeta.')+'</span>'+
      '</div>';
      return;
    }

    list.innerHTML=cards.map(function(card){
      return '<button type="button" class="vk-card-row" data-card-id="'+cardEscape(card.id)+'">'+
        '<svg class="vk-card-row-icon" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+
          '<rect x="3" y="5" width="18" height="14" rx="2"/>'+
          '<path d="M3 10h18M7 15h4"/>'+
        '</svg>'+
        '<span class="vk-card-row-main">'+
          '<strong>'+cardEscape(card.holder||'Sin titular')+'</strong>'+
          '<small>'+cardEscape(cardMaskedNumber(card.number))+'</small>'+
          (function(){var expiry=card.expiry?healthParseCardExpiry(card.expiry):null;return expiry?healthExpiryBadge(healthDaysUntil(expiry)):'';})()+
        '</span>'+
        '<svg class="vk-card-row-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>'+
      '</button>';
    }).join('');
  }

  window.showCards=function(dir){
    if(typeof window.show==='function')window.show('cards',dir);
    renderCardsList();
    updateCardsCount();
  };

  window.showCardDetail=function(id){
    var card=cardsRead().find(function(item){return item.id===id;});
    if(!card){
      window.showCards('left');
      return;
    }

    window.__vkCurrentCardId=card.id;
    detailCvvVisible=false;

    document.getElementById('cardDetailTitle').textContent=card.holder||'Tarjeta';
    document.getElementById('cardDetailHeading').textContent=card.holder||'Tarjeta';
    document.getElementById('cardDetailHolder').textContent=card.holder||'Sin titular';
    document.getElementById('cardDetailNumber').textContent=cardMaskedNumber(card.number);
    document.getElementById('cardDetailExpiry').textContent=(card.expiry||'--/--').replace('/', ' / ');
    document.getElementById('cardDetailCvv').textContent='•••';

    var noteText=document.getElementById('cardDetailNoteText');
    if(noteText)noteText.textContent=card.note?card.note:'Sin nota';

    var toggle=document.getElementById('cardDetailCvvToggle');
    if(toggle){
      toggle.setAttribute('aria-pressed','false');
      toggle.setAttribute('aria-label','Mostrar CVV');
    }
    document.getElementById('cardDetailEyeOpen')?.classList.remove('vk-card-hidden');
    document.getElementById('cardDetailEyeOff')?.classList.add('vk-card-hidden');

    if(typeof window.show==='function')window.show('cardDetail','right');
  };

  window.openCreateCard=function(){
    var form=document.getElementById('cardCreateForm');
    if(form)form.reset();

    window.__vkCurrentCardId=null;
    var noteField=document.getElementById('cardCreateNoteField');
    var noteButton=document.getElementById('cardCreateAddNote');
    if(noteField)noteField.hidden=true;
    if(noteButton)noteButton.textContent='+ Añadir nota';
    var favoriteButton=document.getElementById('cardCreateFavorite');
    if(favoriteButton)setFavoriteSwitch(favoriteButton,false);

    if(typeof window.show==='function')window.show('cardCreate','right');
    setTimeout(function(){
      document.getElementById('cardCreateHolder')?.focus();
    },280);
  };

  window.toggleCardCreateFavorite=function(){
    var button=document.getElementById('cardCreateFavorite');
    if(!button)return;
    var value=button.getAttribute('aria-checked')!=='true';
    setFavoriteSwitch(button,value);
  };

  window.openEditCard=function(id,openNote){
    var card=cardsRead().find(function(item){return item.id===id;});
    if(!card)return;

    window.__vkCurrentCardId=card.id;
    document.getElementById('cardEditHolder').value=card.holder||'';
    document.getElementById('cardEditNumber').value=cardNumberGroups(card.number);
    document.getElementById('cardEditExpiry').value=normalizeExpiry(card.expiry);
    document.getElementById('cardEditCvv').value=String(card.cvv||'');
    document.getElementById('cardEditCvv').type='password';
    document.getElementById('cardEditNote').value=card.note||'';
    var favoriteButton=document.getElementById('cardEditFavorite');
    if(favoriteButton)setFavoriteSwitch(favoriteButton,card.fav===true);

    var noteField=document.getElementById('cardEditNoteField');
    var noteButton=document.getElementById('cardEditAddNote');
    var showNote=Boolean(openNote||card.note);
    if(noteField)noteField.hidden=!showNote;
    if(noteButton)noteButton.textContent=showNote?'− Ocultar nota':'+ Añadir nota';

    if(typeof window.show==='function')window.show('cardEdit','right');
    if(openNote){
      setTimeout(function(){
        document.getElementById('cardEditNote')?.focus();
      },280);
    }
  };

  window.toggleCardEditFavorite=function(){
    var button=document.getElementById('cardEditFavorite');
    if(!button)return;
    var value=button.getAttribute('aria-checked')!=='true';
    setFavoriteSwitch(button,value);
  };

  window.saveCard=async function(id,holder,number,expiry,cvv,note,fav){
    holder=String(holder||'').trim();
    number=cardDigits(number);
    expiry=normalizeExpiry(expiry);
    cvv=String(cvv||'').replace(/\D/g,'').slice(0,3);
    note=String(note||'').trim();

    if(!holder){
      if(typeof window.toast==='function')window.toast('El titular es obligatorio','err');
      document.getElementById(id?'cardEditHolder':'cardCreateHolder')?.focus();
      return false;
    }

    if(number.length<13){
      if(typeof window.toast==='function')window.toast('El número de tarjeta no es válido','err');
      document.getElementById(id?'cardEditNumber':'cardCreateNumber')?.focus();
      return false;
    }

    if(!/^(0[1-9]|1[0-2])\/\d{2}$/.test(expiry)){
      if(typeof window.toast==='function')window.toast('La fecha debe tener formato MM/AA','err');
      document.getElementById(id?'cardEditExpiry':'cardCreateExpiry')?.focus();
      return false;
    }

    if(!/^\d{3}$/.test(cvv)){
      if(typeof window.toast==='function')window.toast('El CVV debe tener 3 dígitos','err');
      document.getElementById(id?'cardEditCvv':'cardCreateCvv')?.focus();
      return false;
    }

    // VK 2.0: crear o actualizar la tarjeta en la bóveda cifrada.
    // Seguridad: nunca escribir tarjetas nuevas o editadas fuera de la boveda cifrada VK2.
    if(!cardsUseVK2()){
      if(typeof window.toast==='function'){
        window.toast('Desbloquea una boveda VaultKey 2.0 para guardar tarjetas cifradas.','err');
      }
      return false;
    }

    if(typeof vkModels==='undefined'){
      console.error('saveCard: vkModels no esta disponible');
      if(typeof window.toast==='function'){
        window.toast('No se pudo preparar el guardado cifrado de la tarjeta.','err');
      }
      return false;
    }

    {
      var _prevCardEntry=null,_prevCardIndex=-1,_pushedCardEntry=null;
      try{
        var entry;
        if(id){
          var vaultIndex=(vault||[]).findIndex(function(item){
            return item&&item.type==='card'&&item.id===id;
          });
          if(vaultIndex===-1)return false;
          _prevCardEntry=vault[vaultIndex];
          _prevCardIndex=vaultIndex;
          entry=Object.assign({},vault[vaultIndex],{
            holder:holder,
            number:number,
            expiry:expiry,
            cvv:cvv,
            notes:note,
            fav:fav===true,
            updatedAt:Date.now()
          });
          vault[vaultIndex]=entry;
        }else{
          entry=vkModels.create('card',{
            holder:holder,
            number:number,
            expiry:expiry,
            cvv:cvv,
            notes:note,
            fav:fav===true
          });
          vault.push(entry);
          _pushedCardEntry=entry;
        }
        await persist();
        if(typeof render==='function')render();
        if(typeof window.toast==='function')window.toast(id?'Tarjeta guardada':'Tarjeta creada','ok');
        window.showCards('left');
        return true;
      }catch(error){
        if(_pushedCardEntry){
          var _pushedCardIdx=vault.indexOf(_pushedCardEntry);
          if(_pushedCardIdx!==-1)vault.splice(_pushedCardIdx,1);
        }else if(_prevCardIndex!==-1&&_prevCardEntry){
          vault[_prevCardIndex]=_prevCardEntry;
        }
        console.error('saveCard VK2:',error);
        if(typeof window.toast==='function')window.toast('No se pudo guardar la tarjeta','err');
        return false;
      }
    }

    var cards=cardsRead();
    var now=Date.now();

    if(id){
      var index=cards.findIndex(function(card){return card.id===id;});
      if(index===-1){
        window.showCards('left');
        return false;
      }
      cards[index]=Object.assign({},cards[index],{
        holder:holder,
        number:number,
        expiry:expiry,
        cvv:cvv,
        note:note,
        updatedAt:now
      });
    }else{
      id=cardUuid();
      cards.push({
        id:id,
        holder:holder,
        number:number,
        expiry:expiry,
        cvv:cvv,
        note:note,
        createdAt:now,
        updatedAt:now
      });
    }

    cardsWrite(cards);
    if(typeof renderVaultHealthDashboard==='function')renderVaultHealthDashboard();
    updateCardsCount();
    if(typeof window.toast==='function')window.toast('Tarjeta guardada','ok');
    window.showCards('left');
    return true;
  };

  window.deleteCard=async function(id){
    var card=cardsRead().find(function(item){return item.id===id;});
    if(!card){
      window.showCards('left');
      return;
    }

    if(!await vkConfirm('¿Eliminar tarjeta?','Se eliminará de la bóveda y no podrás recuperarla.',{variant:'delete-password',confirmText:'Eliminar'}))return;

    if(cardsUseVK2()){
      var vaultIndex=(vault||[]).findIndex(function(item){
        return item&&item.type==='card'&&item.id===id;
      });
      if(vaultIndex===-1)return;
      var _removedCardEntry=vault[vaultIndex];
      vault.splice(vaultIndex,1);
      try{
        await persist();
      }catch(error){
        vault.splice(vaultIndex,0,_removedCardEntry);
        console.error('deleteCard VK2:',error);
        if(typeof window.toast==='function')window.toast('No se pudo eliminar la tarjeta','err');
        return;
      }
      if(typeof render==='function')render();
    }else{
      cardsWrite(cardsRead().filter(function(item){return item.id!==id;}));
    }
    if(typeof renderVaultHealthDashboard==='function')renderVaultHealthDashboard();
    window.__vkCurrentCardId=null;
    updateCardsCount();
    if(typeof window.toast==='function')window.toast('Tarjeta eliminada','ok');
    window.showCards('left');
  };

  window.toggleCvvVisibility=function(){
    var card=cardsRead().find(function(item){return item.id===window.__vkCurrentCardId;});
    if(!card)return;

    detailCvvVisible=!detailCvvVisible;
    document.getElementById('cardDetailCvv').textContent=detailCvvVisible?String(card.cvv||''):'•••';

    var toggle=document.getElementById('cardDetailCvvToggle');
    if(toggle){
      toggle.setAttribute('aria-pressed',String(detailCvvVisible));
      toggle.setAttribute('aria-label',detailCvvVisible?'Ocultar CVV':'Mostrar CVV');
    }

    document.getElementById('cardDetailEyeOpen')?.classList.toggle('vk-card-hidden',detailCvvVisible);
    document.getElementById('cardDetailEyeOff')?.classList.toggle('vk-card-hidden',!detailCvvVisible);
  };

  window.copyCardNumber=async function(id){
    var card=cardsRead().find(function(item){return item.id===id;});
    if(!card)return;

    try{
      await navigator.clipboard.writeText(card.number);
      if(typeof window.toast==='function')window.toast('Número de tarjeta copiado','ok');
      if(typeof window.soundCopy==='function')window.soundCopy();
    }catch(error){
      var helper=document.createElement('textarea');
      helper.value=card.number;
      helper.setAttribute('readonly','');
      helper.style.position='fixed';
      helper.style.opacity='0';
      document.body.appendChild(helper);
      helper.select();
      document.execCommand('copy');
      helper.remove();
      if(typeof window.toast==='function')window.toast('Número de tarjeta copiado','ok');
    }
  };

  window.formatCardNumberInput=function(input){
    input.value=cardNumberGroups(input.value).slice(0,19);
  };

  window.formatCardExpiryInput=function(input){
    var digits=String(input.value||'').replace(/\D/g,'').slice(0,4);
    if(digits.length>=2){
      var month=Math.max(1,Math.min(12,Number(digits.slice(0,2))||1));
      digits=String(month).padStart(2,'0')+digits.slice(2);
    }
    input.value=digits.length>2?digits.slice(0,2)+'/'+digits.slice(2):digits;
  };

  window.toggleCardFormCvv=function(inputId,button){
    var input=document.getElementById(inputId);
    if(!input)return;
    var visible=input.type==='text';
    input.type=visible?'password':'text';
    if(button)button.setAttribute('aria-label',visible?'Mostrar CVV':'Ocultar CVV');
  };

  window.toggleCardNoteField=function(prefix){
    var field=document.getElementById(prefix+'NoteField');
    var button=document.getElementById(prefix+'AddNote');
    if(!field)return;
    field.hidden=!field.hidden;
    if(button)button.textContent=field.hidden?'+ Añadir nota':'− Ocultar nota';
    if(!field.hidden)setTimeout(function(){document.getElementById(prefix+'Note')?.focus();},0);
  };

  window.pasteCardNumber=async function(inputId){
    var input=document.getElementById(inputId);
    if(!input)return;
    try{
      input.value=await navigator.clipboard.readText();
      window.formatCardNumberInput(input);
    }catch(error){
      if(typeof window.toast==='function')window.toast('No se pudo acceder al portapapeles','err');
    }
  };

  document.addEventListener('click',function(event){
    var row=event.target.closest&&event.target.closest('.vk-card-row[data-card-id]');
    if(!row)return;
    window.showCardDetail(row.getAttribute('data-card-id'));
  });

  document.addEventListener('DOMContentLoaded',function(){
    var search=document.getElementById('cardsSearch');
    if(search&&!cardsSearchBound){
      cardsSearchBound=true;
      search.addEventListener('input',renderCardsList);
    }
    updateCardsCount();
  });

  window.vkCards={
    read:cardsRead,
    render:renderCardsList,
    updateCount:updateCardsCount,
    mask:cardMaskedNumber
  };
})();
/* VaultKey v1.2 — Módulo Documentos */
(function(){
'use strict';
var KEY='vaultkey_documents',category='',image='',mode='import',editingId=null,bound=false;
var labels={dni:'DNI / NIE',passport:'Pasaporte',license:'Permiso de conducir',health:'Tarjeta sanitaria',vaccine:'Vacunas',insurance:'Seguro',other:'Otro'};
var icons={
dni:'<svg viewBox="0 0 24 24" fill="none" stroke="#3B82F6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8" cy="10" r="2"/><path d="M5.5 15c.7-1.7 4.3-1.7 5 0M14 9h4M14 13h4"/></svg>',
passport:'<svg viewBox="0 0 24 24" fill="none" stroke="#3B82F6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"/><circle cx="12" cy="10" r="3"/><path d="M7 17h10M9 10h6M12 7v6"/></svg>',
license:'<svg viewBox="0 0 24 24" fill="none" stroke="#3B82F6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 17h14l-1.5-6h-11Z"/><path d="m7 11 2-4h6l2 4M7 17v2M17 17v2"/><circle cx="8" cy="15" r="1"/><circle cx="16" cy="15" r="1"/></svg>',
health:'<svg viewBox="0 0 24 24" fill="none" stroke="#3B82F6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M12 8v8M8 12h8"/></svg>',
vaccine:'<svg viewBox="0 0 24 24" fill="none" stroke="#3B82F6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m14 4 6 6M17 3l4 4M5 20l7-7M7 8l9 9M4 17l3 3M10 5l9 9"/></svg>',
insurance:'<svg viewBox="0 0 24 24" fill="none" stroke="#3B82F6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 4 5v6c0 5 3.4 8.5 8 11 4.6-2.5 8-6 8-11V5Z"/></svg>',
other:'<svg viewBox="0 0 24 24" fill="#3B82F6" stroke="#3B82F6" stroke-width="1.5"><path d="M3 7h7l2 2h9v11H3Z"/><path d="M3 7V4h7l2 3"/></svg>'};
/* Fuente legacy (compatibilidad, nunca se borra aquí) */
function readLegacy(){try{var x=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(x)?x.filter(function(d){return d&&typeof d.id==='string';}):[];}catch(e){console.warn('VaultKey Documents:',e);return[];}}
/* ¿Hay bóveda VK2 activa? Documentos usa vault[] como fuente principal solo en ese caso. */
function vk2DocsActive(){return typeof vkStore!=='undefined'&&vkStore.hasVault()&&typeof vkSession!=='undefined'&&vkSession.isActive();}
/* Traduce una entry VK2 (vault[], type:'document') al shape que espera este módulo */
function vk2EntryToDocument(e){
  return {
    id:e.id,
    category:e.docType||'other',
    name:e.title||'',
    expiry:e.expiry||'',
    issuedBy:e.issuer||'',
    country:e.country||'',
    attachmentRef:e.attachmentRef||'',
    fav:e.fav===true,
    image:'',
    createdAt:e.createdAt||0,
    updatedAt:e.updatedAt||0
  };
}
/* Fuente única: vault[] VK2 primero; los documentos legacy que aún no se
   hayan editado (y por tanto no se hayan promovido a vault[], ver
   saveDocument) se siguen mostrando para no perder visibilidad de datos
   existentes. Sin bóveda VK2 activa, comportamiento legacy sin cambios. */
function read(){
  var legacy=readLegacy();
  if(!vk2DocsActive()||!Array.isArray(vault))return legacy;
  var vk2Docs=vault.filter(function(e){return e&&(e.type==='document'||e.entryType==='document');}).map(vk2EntryToDocument);
  var vk2Ids={};vk2Docs.forEach(function(d){vk2Ids[d.id]=true;});
  return vk2Docs.concat(legacy.filter(function(d){return !vk2Ids[d.id];}));
}
function write(x){localStorage.setItem(KEY,JSON.stringify(x));}
function id(){return 'uuid-'+(crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+'-'+Math.random().toString(36).slice(2));}
function esc(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');}
function label(c){return labels[c]||labels.other;}
function icon(c){return icons[c]||icons.other;}
function date(v){if(!v)return'';var p=String(v).split('-');return p.length===3?p[2]+'/'+p[1]+'/'+p[0]:String(v);}
function count(){var e=document.getElementById('statDocuments');if(e){var n=read().length;e.textContent=n+' documento'+(n===1?'':'s');}}
function modal(id,on){var e=document.getElementById(id);if(e)e.hidden=!on;document.body.classList.toggle('vk-document-modal-open',!!document.querySelector('.vk-document-modal:not([hidden])'));}
function visual(prefix,c){var a=document.getElementById(prefix+'Category'),b=document.getElementById(prefix+'CategoryIcon');if(a)a.textContent=label(c);if(b)b.innerHTML=icon(c);}
function render(){var list=document.getElementById('documentsList');if(!list)return;var q=String(document.getElementById('documentsSearch')?.value||'').trim().toLowerCase();var items=read().filter(function(d){return !q||String(d.name||'').toLowerCase().includes(q);}).sort(function(a,b){return Number(b.updatedAt||b.createdAt||0)-Number(a.updatedAt||a.createdAt||0);});if(!items.length){list.innerHTML='<div class="vk-documents-empty"><strong>'+(q?'No se encontraron documentos':'Aún no hay documentos')+'</strong><span>'+(q?'Prueba con otro nombre.':'Pulsa + para añadir el primero.')+'</span></div>';return;}list.innerHTML=items.map(function(d){var sub=d.expiry?'Caduca: '+date(d.expiry):(d.issuedBy||d.country||label(d.category));var expiry=d.expiry?healthParseDocumentExpiry(d.expiry):null;var badge=expiry?healthExpiryBadge(healthDaysUntil(expiry)):'';return '<button type="button" class="vk-document-row" data-document-id="'+esc(d.id)+'"><span class="vk-document-row-icon">'+icon(d.category)+'</span><span class="vk-document-row-main"><strong>'+esc(d.name||label(d.category))+'</strong><small>'+esc(sub)+'</small>'+badge+'</span><svg class="vk-document-row-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m9 18 6-6-6-6"/></svg></button>';}).join('');}
window.showDocuments=function(dir){modal('documentTypePicker',false);modal('documentSourceSheet',false);show('documents',dir);render();count();};
function documentDataUrlToBlob(dataUrl){
  var parts=String(dataUrl||'').split(',');
  if(parts.length!==2){throw new Error('Imagen de documento inválida');}
  var mime=(parts[0].match(/data:([^;]+)/)||[])[1]||'image/jpeg';
  var bin=atob(parts[1]);
  var bytes=new Uint8Array(bin.length);
  for(var i=0;i<bin.length;i++){bytes[i]=bin.charCodeAt(i);}
  return new Blob([bytes],{type:mime});
}
function _vkAttachmentDek(){
  return (typeof vkSession!=='undefined'&&vkSession.isActive()&&vkSession.getDEK())||lastKey||null;
}
async function documentImageUrl(d){
  if(d&&d.attachmentRef&&typeof vkAttachments!=='undefined'&&typeof vkAttachments.load==='function'){
    var result=await vkAttachments.load({id:d.attachmentRef,dekKey:_vkAttachmentDek()});
    return URL.createObjectURL(result.blob);
  }
  return d&&d.image?d.image:'';
}
window.showDocumentDetail=async function(docId){var d=read().find(function(x){return x.id===docId;});if(!d){showDocuments('left');return;}window.__vkCurrentDocumentId=d.id;document.getElementById('documentDetailTitle').textContent=d.name||label(d.category);document.getElementById('documentDetailImage').src=await documentImageUrl(d);visual('documentDetail',d.category);var rows=[['Número / Nombre',d.name],['Caduca',date(d.expiry)],['Emitido por',d.issuedBy],['País',d.country]].filter(function(r){return r[1];});document.getElementById('documentDetailFields').innerHTML=rows.map(function(r){return '<div class="vk-document-detail-field"><span>'+esc(r[0])+'</span><strong>'+esc(r[1])+'</strong></div>';}).join('');show('documentDetail','right');};
window.openTypePicker=function(){category='';image='';editingId=null;modal('documentTypePicker',true);};
window.closeDocumentTypePicker=function(){modal('documentTypePicker',false);};
window.selectDocumentType=function(c){if(!labels[c])return;category=c;image='';editingId=null;modal('documentTypePicker',false);modal('documentSourceSheet',true);};
window.closeDocumentSourceSheet=function(){modal('documentSourceSheet',false);};
window.openDocumentSource=function(m){
  mode=m==='scan'?'scan':'import';
  var i=document.getElementById(mode==='scan'?'documentScanInput':'documentImportInput');
  if(!i)return;
  i.setAttribute(
    'accept',
    mode==='scan'
      ? 'image/*,application/x-vaultkey-camera'
      : 'image/*'
  );

  window._vkFilePickerOpen=true;
  window._vkFilePickerGraceUntil=0;
  window._vkFilePickerCancelSupported=('oncancel' in i);

  var finish=function(){
    i.removeEventListener('change',finish);
    i.removeEventListener('cancel',finish);
    window.finishFilePicker();
  };

  i.addEventListener('change',finish,{once:true});
  if(window._vkFilePickerCancelSupported){
    i.addEventListener('cancel',finish,{once:true});
  }

  i.value='';
  try{
    i.click();
  }catch(error){
    finish();
    throw error;
  }
};
window.handleDocumentFile=function(ev){var input=ev&&ev.target,file=input&&input.files&&input.files[0];if(!file)return;if(!file.type||!file.type.startsWith('image/')){toast('Selecciona un archivo de imagen válido','err');input.value='';return;}var r=new FileReader();r.onerror=function(){toast('No se pudo leer la imagen seleccionada','err');input.value='';};r.onload=function(){if(typeof r.result!=='string'||!r.result.startsWith('data:image/')){toast('La imagen seleccionada no es válida','err');input.value='';return;}image=r.result;modal('documentSourceSheet',false);if(editingId){document.getElementById('documentEditImage').src=image;show('documentEdit','right');}else{document.getElementById('documentPreviewImage').src=image;show('documentPreview','right');}input.value='';};r.readAsDataURL(file);};
window.repeatDocumentSelection=function(){modal('documentSourceSheet',true);};
window.openCreateDocumentForm=function(){if(!image||!category){toast('Selecciona primero una imagen','err');openTypePicker();return;}document.getElementById('documentCreateForm').reset();document.getElementById('documentCreateImage').src=image;document.getElementById('documentCreateName').value=label(category);document.getElementById('documentCreateMore').hidden=true;document.getElementById('documentCreateMoreButton').textContent='+ Más información';var favoriteButton=document.getElementById('documentCreateFavorite');if(favoriteButton)setFavoriteSwitch(favoriteButton,false);visual('documentCreate',category);show('documentCreate','right');};
window.toggleDocumentCreateFavorite=function(){var button=document.getElementById('documentCreateFavorite');if(!button)return;var value=button.getAttribute('aria-checked')!=='true';setFavoriteSwitch(button,value);};
window.openEditDocument=async function(docId){var d=read().find(function(x){return x.id===docId;});if(!d)return;editingId=d.id;category=d.category;image=await documentImageUrl(d);window.__vkCurrentDocumentId=d.id;document.getElementById('documentEditImage').src=image;document.getElementById('documentEditName').value=d.name||'';document.getElementById('documentEditExpiry').value=date(d.expiry);document.getElementById('documentEditIssuedBy').value=d.issuedBy||'';document.getElementById('documentEditCountry').value=d.country||'';visual('documentEdit',d.category);var more=!!(d.issuedBy||d.country);document.getElementById('documentEditMore').hidden=!more;document.getElementById('documentEditMoreButton').textContent=more?'− Menos información':'+ Más información';var favoriteButton=document.getElementById('documentEditFavorite');if(favoriteButton)setFavoriteSwitch(favoriteButton,d.fav===true);show('documentEdit','right');};
window.toggleDocumentEditFavorite=function(){var button=document.getElementById('documentEditFavorite');if(!button)return;var value=button.getAttribute('aria-checked')!=='true';setFavoriteSwitch(button,value);};
window.openDocumentEditSource=function(){if(editingId)modal('documentSourceSheet',true);};
window.formatDocumentExpiry=function(el){
  var v=String(el.value||'').replace(/\D/g,'').slice(0,8);
  if(v.length>4){v=v.slice(0,2)+'/'+v.slice(2,4)+'/'+v.slice(4);}
  else if(v.length>2){v=v.slice(0,2)+'/'+v.slice(2);}
  el.value=v;
};

function normalizeDocumentExpiry(v){
  v=String(v||'').trim();
  var m=v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if(m)return m[3]+'-'+m[2]+'-'+m[1];
  return v;
}
/* Validación estricta DD/MM/AAAA: día 01-31, mes 01-12, año 1900-2100,
   y fecha de calendario real (rechaza 31/02, 29/02 en año no bisiesto,
   etc. vía redondeo de Date). Vacío se considera válido (campo opcional). */
function isValidDocumentExpiry(v){
  v=String(v||'').trim();
  if(!v)return true;
  var m=v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if(!m)return false;
  var day=Number(m[1]),month=Number(m[2]),year=Number(m[3]);
  if(year<1900||year>2100)return false;
  if(month<1||month>12)return false;
  if(day<1||day>31)return false;
  var d=new Date(year,month-1,day);
  return d.getFullYear()===year&&d.getMonth()===month-1&&d.getDate()===day;
}

window.saveDocument=async function(docId,name,expiry,issuedBy,country,fav){
  name=String(name||'').trim();
  var rawExpiry=String(expiry||'').trim();
  if(!isValidDocumentExpiry(rawExpiry)){
    toast('Fecha de caducidad no válida. Usa el formato DD/MM/AAAA con una fecha real entre 1900 y 2100.','err');
    document.getElementById(docId?'documentEditExpiry':'documentCreateExpiry')?.focus();
    return false;
  }
  expiry=normalizeDocumentExpiry(rawExpiry);issuedBy=String(issuedBy||'').trim();country=String(country||'').trim();
  if(!name){toast('El nombre es obligatorio','err');document.getElementById(docId?'documentEditName':'documentCreateName')?.focus();return false;}
  if(!image||!image.startsWith('data:image/')){if(!docId){toast('Falta una imagen válida del documento','err');return false;}var existing=read().find(function(x){return x.id===docId;});if(!existing||!existing.attachmentRef){toast('Falta una imagen válida del documento','err');return false;}}
  if(typeof vkAttachments==='undefined'||typeof vkAttachments.save!=='function'||typeof vkAttachments.replace!=='function'){
    toast('No se pudo guardar el documento: almacenamiento de adjuntos no disponible','err');
    return false;
  }
  var _dek=_vkAttachmentDek();
  if(!_dek){
    toast('No hay una clave activa. Desbloquea la bóveda para guardar el documento.','err');
    return false;
  }
  // Seguridad: nunca crear o editar documentos fuera de la boveda cifrada VK2.
  if(!vk2DocsActive()){
    toast('Desbloquea una boveda VaultKey 2.0 para guardar documentos cifrados.','err');
    return false;
  }

  if(typeof vkModels==='undefined'){
    console.error('saveDocument: vkModels no esta disponible');
    toast('No se pudo preparar el guardado cifrado del documento.','err');
    return false;
  }

  var items=read(),now=Date.now();
  try{
    var isEdit=!!docId;
    if(!docId){docId=id();}
    var old=isEdit&&items.find(function(x){return x.id===docId;});
    var attachmentRef=old&&old.attachmentRef;
    if(image&&image.startsWith('data:image/')){
      if(attachmentRef){
        await vkAttachments.replace({id:attachmentRef,file:documentDataUrlToBlob(image),dekKey:_dek});
      }else{
        attachmentRef=crypto.randomUUID();
        await vkAttachments.save({id:attachmentRef,entryId:docId,file:documentDataUrlToBlob(image),dekKey:_dek});
      }
    }else if(!attachmentRef){
      throw new Error('No existe adjunto para el documento');
    }
    if(!attachmentRef){throw new Error('No se generó un identificador de adjunto válido');}
    if(typeof vkStore!=='undefined' &&
       vkStore.hasVault() &&
       typeof vkSession!=='undefined' &&
       vkSession.isActive() &&
       typeof vkModels!=='undefined'){

      var vkEntryIndex=(vault||[]).findIndex(function(e){return e.id===docId;});

      if(isEdit && vkEntryIndex>=0){
        vault[vkEntryIndex]=Object.assign({},vault[vkEntryIndex],{
          title:name,
          docType:category||vault[vkEntryIndex].docType,
          expiry:expiry,
          issuer:issuedBy,
          country:country,
          attachmentRef:attachmentRef,
          fav:fav===true,
          updatedAt:now
        });
      }else{
        var vkEntry=vkModels.create('document',{
          title:name,
          docType:category||'other',
          expiry:expiry,
          issuer:issuedBy,
          country:country,
          attachmentRef:attachmentRef,
          fav:fav===true
        });
        vkEntry.type='document';
        vkEntry.entryType='document';
        vkEntry.id=docId;
        vkEntry.createdAt=now;
        vkEntry.updatedAt=now;
        vault.push(vkEntry);
      }

      await persist();
    }else{
      if(isEdit){
        var i=items.findIndex(function(x){return x.id===docId;});
        if(i<0){showDocuments('left');return false;}
        items[i]=Object.assign({},items[i],{category:category||items[i].category,name:name,expiry:expiry,issuedBy:issuedBy,country:country,attachmentRef:attachmentRef,image:'',updatedAt:now});
      }else{
        items.push({id:docId,category:category,name:name,expiry:expiry,issuedBy:issuedBy,country:country,attachmentRef:attachmentRef,image:'',createdAt:now,updatedAt:now});
      }
      write(items);
    }
    count();editingId=null;toast('Documento guardado','ok');showDocuments('left');return true;
  }catch(e){
    console.error('saveDocument:',e);
    toast('No se pudo guardar el documento','err');
    return false;
  }
};
window.deleteDocument=async function(docId){
  var d=read().find(function(x){return x.id===docId;});
  if(!d){showDocuments('left');return;}
  if(!await vkConfirm('¿Eliminar documento?','Se eliminará de la bóveda y no podrás recuperarla.',{variant:'delete-password',confirmText:'Eliminar'}))return;
  try{
    if(d.attachmentRef&&typeof vkAttachments!=='undefined'&&typeof vkAttachments.delete==='function'){
      await vkAttachments.delete({id:d.attachmentRef});
    }
  }catch(e){console.error('deleteDocument attachment:',e);toast('No se pudo eliminar el adjunto','err');return;}
  var isVk2Doc=vk2DocsActive()&&Array.isArray(vault)&&vault.some(function(e){return e&&e.id===docId&&(e.type==='document'||e.entryType==='document');});
  if(isVk2Doc){
    vault=vault.filter(function(e){return e.id!==docId;});
    try{await persist();}catch(e){console.error('deleteDocument persist:',e);toast('No se pudo eliminar el documento','err');return;}
  }else{
    write(readLegacy().filter(function(x){return x.id!==docId;}));
  }
  window.__vkCurrentDocumentId=null;editingId=null;image='';category='';count();toast('Documento eliminado','ok');showDocuments('left');
};
window.viewDocumentImage=async function(docId){var d=read().find(function(x){return x.id===docId;});if(!d)return;var src=await documentImageUrl(d);if(!src)return;var w=window.open('','_blank');if(!w){toast('El navegador bloqueó la vista del documento','err');return;}w.document.write('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(d.name||'Documento')+'</title><style>html,body{margin:0;min-height:100%;background:#111827;display:grid;place-items:center}img{max-width:100%;max-height:100vh;object-fit:contain}</style></head><body><img src="'+src.replace(/"/g,'&quot;')+'"></body></html>');w.document.close();};
window.toggleDocumentMoreInfo=function(prefix){var b=document.getElementById(prefix+'More'),a=document.getElementById(prefix+'MoreButton');if(!b)return;b.hidden=!b.hidden;if(a)a.textContent=b.hidden?'+ Más información':'− Menos información';};
document.addEventListener('click',function(e){var r=e.target.closest&&e.target.closest('.vk-document-row[data-document-id]');if(r)showDocumentDetail(r.getAttribute('data-document-id'));});
document.addEventListener('DOMContentLoaded',function(){document.querySelectorAll('[data-doc-icon]').forEach(function(n){n.innerHTML=icon(n.getAttribute('data-doc-icon'));});var s=document.getElementById('documentsSearch');if(s&&!bound){bound=true;s.addEventListener('input',render);}count();});
window.vkDocuments={read:read,render:render,updateCount:count};
})();
