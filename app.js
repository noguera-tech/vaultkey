let confirmResolver=null;
let appBooted=false;
const LS_META='vk_meta_v1',LS_DATA='vk_data_v1',LS_REC='vk_recovery_v1';let pin='',mode='unlock',tempPin='',unlocked=false,vault=[],current=null,editId=null,lastKey=null,useGenTarget=false,autoLockTimer=null,lockCountdownTimer=null,_entryType='password',_catFilter='',_vaultTab='todas';
function setEntryType(type){
  _entryType=type;
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
    btn.style.border=active?'2px solid var(--cyan)':'1px solid rgba(0,210,255,.2)';
    btn.style.background=active?'rgba(0,210,255,.12)':'rgba(0,14,32,.6)';
    btn.style.color=active?'#00e5ff':'#7aa0c8';
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
  // No auto-asignar categoría — el usuario la elige
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
}const byId=$;const enc=new TextEncoder(),dec=new TextDecoder();
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
function vibe(ms=40){try{if(localStorage.getItem('vk_vibe')==='0')return;navigator.vibrate&&navigator.vibrate(ms)}catch(e){}}

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
function toggleVibration(){
  const on=localStorage.getItem('vk_vibe')!=='0';
  localStorage.setItem('vk_vibe',on?'0':'1');
  syncPreferencesUI();
  if(!on)navigator.vibrate&&navigator.vibrate(40);
}
function toggleSound(){
  const on=localStorage.getItem('vk_sound')==='1';
  localStorage.setItem('vk_sound',on?'0':'1');
  syncPreferencesUI();
}
function setSoundStyle(v){
  localStorage.setItem('vk_sound_style',v);
  syncPreferencesUI();
  setTimeout(()=>soundPinOk(),100);
}
function syncPreferencesUI(){
  const vibeOn=localStorage.getItem('vk_vibe')!=='0';
  const soundOn=localStorage.getItem('vk_sound')==='1';
  const style=getSoundStyle();
  const styleNames={suave:'Suave',cristal:'Cristal',retro:'Retro',minimo:'Mínimo'};
  const vt=$('vibeToggle'); if(vt){vt.textContent=vibeOn?'●':'○';vt.style.color=vibeOn?'var(--cyan)':'var(--t4)';}
  const st=$('soundToggle'); if(st){st.textContent=soundOn?'●':'○';st.style.color=soundOn?'var(--cyan)':'var(--t4)';}
  const vh=$('vibeSettingHint'); if(vh)vh.textContent=vibeOn?'Feedback háptico activado':'Feedback háptico desactivado';
  const sh=$('soundSettingHint'); if(sh)sh.textContent=soundOn?'Sonidos activados':'Sonidos desactivados';
  const sr=$('soundStyleRow'); if(sr)sr.style.display=soundOn?'flex':'none';
  const ss=$('soundStyleSelect'); if(ss)ss.value=style;
  const ssh=$('soundStyleHint'); if(ssh)ssh.textContent=styleNames[style]||style;
}
function vkConfirm(title,msg){return new Promise(res=>{confirmResolver=res;$('confirmTitle').textContent=title;$('confirmMsg').textContent=msg;$('confirmModal').classList.add('open')})}
function resolveConfirm(ok){$('confirmModal').classList.remove('open');if(confirmResolver){confirmResolver(!!ok);confirmResolver=null}}
function initPin(){let m=defaultSecurity(meta());mode=(m&&m.hash)?'unlock':'setup1';let left=lockRemaining();const plen=getPinLen();$('pinMsg').className='pinSub';$('pinMsg').textContent=mode==='unlock'?(left?'Bóveda bloqueada. Espera '+left+' s':'Introduce tu PIN'):'Crea un PIN de '+plen+' dígitos';if(left)$('pinMsg').classList.add('pinLocked');renderDots();renderKeys();syncSettingsUI();updateLockCountdown()}
function getPinLen(){const m=meta();return(m&&m.pinLen===8)?8:6;}
function renderDots(){const len=getPinLen();let d=$('dots');d.innerHTML='';d.className='dots'+(len===8?' dots8':'');for(let i=0;i<len;i++){let x=document.createElement('div');x.className='dot'+(i<pin.length?' on':'');d.appendChild(x)}}
function renderKeys(){let k=$('keys');k.innerHTML='';['1','2','3','4','5','6','7','8','9','bio','0','del'].forEach(n=>{let b=document.createElement('button');b.className='key';if(n==='bio'){b.innerHTML='<svg class="fingerIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 11c0 5-2 7-2 10"/><path d="M16 8a4 4 0 0 0-8 0c0 1.3.5 2.7 1 4"/><path d="M6 12c.5 2.5 1.5 4 3 5"/><path d="M18 12c-.4 3.2-1.4 5.4-3.2 7"/><path d="M8 6.5A6 6 0 0 1 18 11"/><path d="M5 9a8 8 0 0 1 14.5-4"/><path d="M20 14c-.4 2.4-1.2 4.4-2.5 6"/></svg>';b.classList.add('bioKey');b.onclick=tryBio;b.title='Huella / biometría';b.setAttribute('aria-label','Biometría')}else if(n==='del'){b.innerHTML='<svg class="delIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 4H8l-7 8 7 8h13z"/><path d="M18 9l-6 6M12 9l6 6"/></svg>';b.onclick=delPin;b.setAttribute('aria-label','Borrar')}else{b.textContent=n;b.onclick=()=>pressPin(n)}k.appendChild(b)})}
async function pressPin(n){vibe(28);soundPin();let left=lockRemaining();if(left){$('pinMsg').textContent='Bóveda bloqueada. Espera '+left+' s';$('pinMsg').className='pinSub pinLocked';updateLockCountdown();return;}const len=getPinLen();if(pin.length>=len)return;pin+=n;renderDots();if(pin.length===len)await handlePin()}
function delPin(){vibe(18);soundPinDel();pin=pin.slice(0,-1);renderDots()}
async function handlePin(){return window.handlePin?window.handlePin():undefined;}
async function unlockOk(p){return window.unlockOk?window.unlockOk(p):undefined;}
async function tryBioRegister(pinKey){
  const LS_BIO_CRED='vk_bio_cred_id';
  const LS_BIO_BLOB='vk_bio_blob';
  const b64e=buf=>btoa(String.fromCharCode(...new Uint8Array(buf)));
  try{
    const challenge=crypto.getRandomValues(new Uint8Array(32));
    const cred=await navigator.credentials.create({publicKey:{
      challenge,
      rp:{name:'VaultKey',id:location.hostname||'localhost'},
      user:{id:crypto.getRandomValues(new Uint8Array(16)),name:'vaultkey_user',displayName:'VaultKey'},
      pubKeyCredParams:[{type:'public-key',alg:-7},{type:'public-key',alg:-257}],
      authenticatorSelection:{authenticatorAttachment:'platform',userVerification:'required'},
      timeout:60000
    }});
    localStorage.setItem(LS_BIO_CRED,b64e(cred.rawId));
    const baseKey=await crypto.subtle.importKey('raw',new Uint8Array(cred.rawId),'PBKDF2',false,['deriveKey']);
    const aesKey=await crypto.subtle.deriveKey(
      {name:'PBKDF2',salt:new TextEncoder().encode('vaultkey-bio-salt'),iterations:100000,hash:'SHA-256'},
      baseKey,{name:'AES-GCM',length:256},false,['encrypt']
    );
    const iv=crypto.getRandomValues(new Uint8Array(12));
    const enc=await crypto.subtle.encrypt({name:'AES-GCM',iv},aesKey,new TextEncoder().encode(pinKey));
    localStorage.setItem(LS_BIO_BLOB,JSON.stringify({iv:b64e(iv),data:b64e(enc)}));
    vibe([30,20,60,20,80]);soundPinOk();
    toast('✓ Huella activada. Úsala la próxima vez que abras la app.');
  }catch(e){
    localStorage.removeItem(LS_BIO_CRED);
    vibe([40,30,40]);soundPinErr();
    if(e.name==='NotAllowedError')toast('Registro de huella cancelado.');
    else toast('No se pudo activar la huella. Inténtalo de nuevo.');
  }
}
async function persist(p=lastKey){if(!p)return;localStorage.setItem(LS_DATA,JSON.stringify(await encryptData(vault,p)))}
const NAV_ORDER=['vault','fav','home','settings'];
function show(id,dir){
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
  syncSettingsUI();
  if(id!=='pin')resetAutoLockTimer();
}
/* Swipe lateral entre pantallas principales */
(function(){
  let sx=0,sy=0,stime=0;
  const SWIPEABLE=['vault','fav','home','settings'];
  document.addEventListener('touchstart',e=>{
    sx=e.touches[0].clientX;
    sy=e.touches[0].clientY;
    stime=Date.now();
  },{passive:true});
  document.addEventListener('touchend',e=>{
    const cur=document.querySelector('.screen.active');
    if(!cur||!SWIPEABLE.includes(cur.id))return;
    const dx=e.changedTouches[0].clientX-sx;
    const dy=e.changedTouches[0].clientY-sy;
    const dt=Date.now()-stime;
    if(Math.abs(dx)<60||Math.abs(dy)>Math.abs(dx)*0.8||dt>400)return;
    const idx=SWIPEABLE.indexOf(cur.id);
    if(dx<0&&idx<SWIPEABLE.length-1)show(SWIPEABLE[idx+1],'right');
    else if(dx>0&&idx>0)show(SWIPEABLE[idx-1],'left');
  },{passive:true});
})();
function lock(){vibe(30);soundLock();unlocked=false;lastKey=null;pin='';clearAutoLockTimer();closeModals();initPin();show('pin');hidePrivacyOverlay()}
async function wipe(){if(await vkConfirm('Borrar todos los datos','⚠️ Se eliminarán el PIN, todas las contraseñas y el código de recuperación. Esta acción es irreversible. ¿Continuar?')){soundError();vibe([60,30,60,30,100]);localStorage.removeItem(LS_META);localStorage.removeItem(LS_DATA);localStorage.removeItem(LS_REC);vault=[];lock()}}
function closeModals(){
  document.querySelectorAll('.modal').forEach(m=>{
    if(m.id==='recoveryModal'){
      const btn=$('recoveryCloseBtn');
      if(btn&&btn.style.display==='none')return;
    }
    m.classList.remove('open');
  });
  editId=null;useGenTarget=false;selectedEntryIcon='';
}
function confirmRecoverySaved(){
  vibe([30,20,60]);
  const btn=$('recoveryCloseBtn');
  if(btn)btn.style.display='';
  localStorage.setItem('vk_recovery_saved','1');
  closeModals();
}

function registerFailedPin(){vibe([40,30,40]);soundPinErr();let m=defaultSecurity(meta());if(!m){$('pinMsg').textContent='PIN incorrecto';pin='';renderDots();return}m.failedAttempts=(m.failedAttempts||0)+1;m.totalFailed=(m.totalFailed||0)+1;m.lastFail=Date.now();let msg='PIN incorrecto';const remaining=m.autoWipe?Math.max(0,10-m.totalFailed):null;if(m.autoWipe&&remaining<=3&&remaining>0)msg='PIN incorrecto. '+(remaining===1?'⚠️ Último intento antes del borrado':'⚠️ Quedan '+remaining+' intentos antes del borrado');if(m.autoWipe&&m.totalFailed>=10){saveMeta(m);soundError();vibe([80,40,80,40,120]);localStorage.removeItem(LS_META);localStorage.removeItem(LS_DATA);localStorage.removeItem(LS_REC);vault=[];$('pinMsg').className='pinSub pinWarn';$('pinMsg').textContent='Demasiados intentos. Bóveda borrada.';pin='';renderDots();setTimeout(()=>lock(),1800);return;}if(m.failedAttempts===4&&!m.autoWipe)msg='PIN incorrecto. Te quedan 2 intentos';if(m.failedAttempts===5&&!m.autoWipe)msg='PIN incorrecto. Te queda 1 intento';if(m.failedAttempts>=6){const levels=[30000,60000,300000,900000];let idx=Math.min(m.lockLevel||0,levels.length-1);let ms=levels[idx];m.lockedUntil=Date.now()+ms;m.lockLevel=Math.min(idx+1,levels.length-1);m.failedAttempts=0;if(!m.autoWipe)msg='Demasiados intentos. Bóveda bloqueada '+Math.ceil(ms/1000)+' s';else msg='Bóveda bloqueada '+Math.ceil(ms/1000)+' s · Quedan '+(Math.max(0,10-m.totalFailed))+' intentos antes del borrado';}
saveMeta(m);$('pinMsg').className='pinSub '+(m.lockedUntil>Date.now()?'pinLocked':'pinWarn');$('pinMsg').textContent=msg;pin='';renderDots();updateLockCountdown();}
function updateLockCountdown(){clearInterval(lockCountdownTimer);let left=lockRemaining();if(!left)return;lockCountdownTimer=setInterval(()=>{let s=lockRemaining();if(!s){clearInterval(lockCountdownTimer);$('pinMsg').className='pinSub';$('pinMsg').textContent='Introduce tu PIN';return}$('pinMsg').textContent='Bóveda bloqueada. Espera '+s+' s';},1000)}
function getAutoLockMs(){let m=defaultSecurity(meta());return m?Number(m.autoLockMs||0):0}
function setAutoLock(v){let m=defaultSecurity(meta());if(!m)return;m.autoLockMs=Number(v);saveMeta(m);syncSettingsUI();toast(m.autoLockMs===0?'Bloqueo inmediato al salir activado':'Autobloqueo inteligente actualizado');resetAutoLockTimer()}
function syncSettingsUI(){
  try{driveInit();}catch(e){}
  syncPreferencesUI();
  let sel=$('autoLockSelect');let m=meta();
  if(sel&&m){defaultSecurity(m);const ms=Number(m.autoLockMs||0);sel.value=String(ms);// Forzar opción visible
  if(!sel.querySelector('option[value="'+ms+'"]'))sel.value='30000';}
  // Estado de huella
  const bioActive=!!(localStorage.getItem('vk_bio_cred_id')&&localStorage.getItem('vk_bio_blob'));
  const span=$('bioSettingsSpan');const pill=$('bioSettingsPill');
  if(span)span.textContent=bioActive?'Activa — pulsa para desactivar':'Introduce el PIN una vez para activarla';
  if(pill){pill.textContent=bioActive?'Activa':'Inactiva';pill.style.background=bioActive?'rgba(0,210,100,.15)':'';pill.style.borderColor=bioActive?'rgba(0,210,100,.4)':'';pill.style.color=bioActive?'#00d46a':'';}
  // Estado borrado automático
  const awToggle=$('autoWipeToggle');if(awToggle&&m)awToggle.checked=!!(m.autoWipe);
  // Longitud PIN
  const plen=(m&&m.pinLen===8)?8:6;
  const sp=$('pinLenSpan');if(sp)sp.textContent='PIN de '+plen+' dígitos'+(m&&m.hash?' (activo)':' (pendiente)');
  const b6=$('pinLen6Btn');const b8=$('pinLen8Btn');
  if(b6){b6.style.background=plen===6?'rgba(0,210,255,.2)':'';b6.style.borderColor=plen===6?'var(--cyan)':'';}
  if(b8){b8.style.background=plen===8?'rgba(0,210,255,.2)':'';b8.style.borderColor=plen===8?'var(--cyan)':'';}
}
async function setPinLen(len){
  const m=defaultSecurity(meta());
  const currentLen=(m&&m.pinLen===8)?8:6;
  if(len===currentLen){toast('Ya estás usando PIN de '+len+' dígitos');return;}
  const hasPin=!!(m&&m.hash);
  if(hasPin){
    const ok=await vkConfirm('Cambiar a PIN de '+len+' dígitos','Se cerrará la sesión y deberás crear un nuevo PIN de '+len+' dígitos. Tus entradas guardadas NO se borran. ¿Continuar?');
    if(!ok){syncSettingsUI();return;}
    m.pinLen=len;m.hash=null;m.pinSalt=null;
    saveMeta(m);
    lock();
    return;
  }
  m.pinLen=len;saveMeta(m);syncSettingsUI();
  toast('PIN de '+len+' dígitos seleccionado');
}
function setAutoWipe(val){let m=defaultSecurity(meta());if(!m)return;m.autoWipe=val;saveMeta(m);syncSettingsUI();toast(val?'⚠️ Borrado automático activado tras 10 intentos fallidos':'Borrado automático desactivado');}
async function confirmAutoWipe(checked){if(checked){const ok=await vkConfirm('Activar borrado automático','⚠️ Tras 10 intentos fallidos de PIN, toda la bóveda se borrará sin posibilidad de recuperación. Asegúrate de tener un respaldo cifrado. ¿Activar?');if(ok){setAutoWipe(true);}else{const t=$('autoWipeToggle');if(t)t.checked=false;}}else{setAutoWipe(false);}}
async function bioSettingsAction(){
  const bioActive=!!(localStorage.getItem('vk_bio_cred_id')&&localStorage.getItem('vk_bio_blob'));
  if(bioActive){
    const ok=await vkConfirm('Desactivar huella','¿Desactivar la huella dactilar? Tendrás que usar el PIN para entrar.');
    if(ok){localStorage.removeItem('vk_bio_cred_id');localStorage.removeItem('vk_bio_blob');localStorage.removeItem('vk_bio_offer_dismissed');syncSettingsUI();toast('Huella desactivada.');}
  } else if(lastKey){
    await tryBioRegister(lastKey);syncSettingsUI();
  } else {
    toast('Introduce el PIN primero para activar la huella.');
  }
}
function clearAutoLockTimer(){if(autoLockTimer){clearTimeout(autoLockTimer);autoLockTimer=null}}
function resetAutoLockTimer(){clearAutoLockTimer();if(!unlocked||document.hidden)return;let ms=getAutoLockMs();if(ms>0){autoLockTimer=setTimeout(()=>{if(unlocked&&!document.hidden){soundLock();lock()}},ms)}}
function toggleHomeMenu(){const m=$('homeMenu');if(m)m.style.display=m.style.display==='none'?'block':'none';}
document.addEventListener('click',e=>{const m=$('homeMenu');if(m&&m.style.display==='block'&&!e.target.closest('#homeMenu')&&!e.target.closest('[onclick*="toggleHomeMenu"]'))m.style.display='none';});
function openBackup(){show('settings');setTimeout(()=>{document.querySelector('[onclick*="exportBackup"]')?.closest('.settingsRow')?.scrollIntoView({behavior:'smooth',block:'center'})},200)}
function markActivity(){if(unlocked){hidePrivacyOverlay();resetAutoLockTimer()}}
function showPrivacyOverlay(){let o=$('privacyOverlay');if(o)o.classList.add('show');document.body.classList.add('vk-locked')}
function hidePrivacyOverlay(){let o=$('privacyOverlay');if(o)o.classList.remove('show');document.body.classList.remove('vk-locked')}
function handleVisibilityChange(){
  if(!appBooted)return;
  // BUG5 FIX: ignorar si estamos en medio de compartir app
  if(window._vkSharing)return;
  if(document.hidden){
    if(unlocked){
      // Guardar borrador del formulario si está abierto
      const entryModal=document.getElementById('entryModal');
      if(entryModal&&entryModal.classList.contains('open')){
        const draft={
          service:document.getElementById('eService')?.value||'',
          user:document.getElementById('eUser')?.value||'',
          email:document.getElementById('eEmail')?.value||'',
          pass:document.getElementById('ePass')?.value||'',
          url:document.getElementById('eUrl')?.value||'',
          icon:selectedEntryIcon||''
        };
        sessionStorage.setItem('vk_entry_draft',JSON.stringify(draft));
      }
      showPrivacyOverlay();
      const ms=getAutoLockMs();
      if(ms===0){unlocked=false;lastKey=null;pin='';clearAutoLockTimer();closeModals();}
      else{clearAutoLockTimer();autoLockTimer=setTimeout(()=>{if(!unlocked)return;soundLock();unlocked=false;lastKey=null;pin='';closeModals();},ms);}
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
    } else if(autoLockTimer){
      // Había un timer corriendo — bloquear directamente al volver
      clearTimeout(autoLockTimer);autoLockTimer=null;
      unlocked=false;lastKey=null;pin='';
      closeModals();
      hidePrivacyOverlay();
      const pinScreen=$('pin');
      if(pinScreen){
        document.querySelectorAll('.screen').forEach(s=>{s.classList.remove('active');s.style.cssText='';s.style.display='none';});
        pinScreen.style.display='flex';pinScreen.classList.add('active');
      }
      setTimeout(()=>initPin(),50);
    } else {
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
  if(!appBooted || !unlocked || window._vkSharing) return;
  showPrivacyOverlay();
});
window.addEventListener('pagehide',()=>{if(unlocked){unlocked=false;lastKey=null;pin='';showPrivacyOverlay();}});
['pointerdown','touchstart','keydown','input','scroll','click'].forEach(ev=>document.addEventListener(ev,markActivity,{capture:true,passive:true}));

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

function iconObjHTML(ic,cls='logo'){return `<div class="${cls}" style="background:${ic.bg};${ic.svg?'padding:0':''}">${ic.svg||ic.emoji||''}</div>`}
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
  onboardStep=0;
  renderOnboarding();
  const modal=$('onboardingModal');
  if(modal){
    modal.classList.add('open');
    modal.style.display='flex';
  }
}
function finishOnboarding(){
  localStorage.setItem('vaultkey_onboarding_v130','1');
  const modal=$('onboardingModal');
  if(modal){modal.classList.remove('open');modal.style.display='none';}
  resetScreensForBoot();
  initPin();
  show('pin');
}
function maybeShowOnboarding(){
  if(!localStorage.getItem('vaultkey_onboarding_v130')) openOnboardingHard();
}
function serviceIcon(s){const n=(s||'').toLowerCase().trim();const map=[{k:['gmail'],bg:'#EA4335',svg:'<svg viewBox="0 0 48 48" width="28" height="28"><path fill="#4285F4" d="M6 40h8V23L4 15v21a4 4 0 0 0 2 4z"/><path fill="#34A853" d="M34 40h8a4 4 0 0 0 4-4V15l-10 8z"/><path fill="#FBBC05" d="M34 10l-10 8-10-8H6l18 14L42 10z"/><path fill="#EA4335" d="M4 15l10 8V10H6a2 2 0 0 0-2 5z"/><path fill="#C5221F" d="M44 10h-8v8l10-8a2 2 0 0 0-2 0z"/></svg>'},{k:['outlook','hotmail'],bg:'#0078D4',svg:'<svg viewBox="0 0 48 48" width="28" height="28"><rect width="48" height="48" rx="6" fill="#0078D4"/><rect x="6" y="14" width="22" height="20" rx="3" fill="#fff"/><text x="17" y="29" font-size="13" font-weight="900" fill="#0078D4" text-anchor="middle">O</text><path d="M28 18l14-6v24l-14-6z" fill="#50D9FF"/></svg>'},{k:['yahoo','yahoo mail'],bg:'#6001D2',svg:'<svg viewBox="0 0 48 48" width="28" height="28"><rect width="48" height="48" rx="10" fill="#6001D2"/><text x="24" y="30" font-size="18" font-weight="900" fill="#fff" text-anchor="middle">Y!</text></svg>'},{k:['google drive','drive'],bg:'#0F9D58',svg:'<svg viewBox="0 0 48 48" width="28" height="28"><rect width="48" height="48" rx="10" fill="#fff"/><path d="M18 8h12l14 24H32z" fill="#4285F4"/><path d="M18 8L4 32h14L32 8z" fill="#0F9D58"/><path d="M4 32h28l-6 8H10z" fill="#F4B400"/></svg>'},{k:['google photos','photos'],bg:'#4285F4',svg:'<svg viewBox="0 0 48 48" width="28" height="28"><rect width="48" height="48" rx="10" fill="#fff"/><path d="M24 6a10 10 0 0 1 10 10H24z" fill="#EA4335"/><path d="M42 24a10 10 0 0 1-10 10V24z" fill="#4285F4"/><path d="M24 42a10 10 0 0 1-10-10h10z" fill="#34A853"/><path d="M6 24a10 10 0 0 1 10-10v10z" fill="#FBBC05"/></svg>'},{k:['facebook','fb'],bg:'#1877F2',svg:'<svg viewBox="0 0 48 48" width="28" height="28"><circle cx="24" cy="24" r="22" fill="#1877F2"/><path d="M29 14h-4c-2.2 0-3 1-3 3v3h7l-1 7h-6v17h-7V27h-5v-7h5v-4c0-5 3-8 8-8h6z" fill="#fff"/></svg>'},{k:['instagram','insta'],bg:'#C13584',svg:'<svg viewBox="0 0 48 48" width="28" height="28"><defs><radialGradient id="ig" cx="30%" cy="107%" r="150%"><stop offset="0%" stop-color="#fdf497"/><stop offset="50%" stop-color="#fd5949"/><stop offset="68%" stop-color="#d6249f"/><stop offset="100%" stop-color="#285AEB"/></radialGradient></defs><rect width="48" height="48" rx="12" fill="url(#ig)"/><rect x="12" y="12" width="24" height="24" rx="6" fill="none" stroke="#fff" stroke-width="2.5"/><circle cx="24" cy="24" r="6" fill="none" stroke="#fff" stroke-width="2.5"/><circle cx="33" cy="15" r="1.8" fill="#fff"/></svg>'},{k:['tiktok'],bg:'#010101',svg:'<svg viewBox="0 0 48 48" width="28" height="28"><rect width="48" height="48" rx="10" fill="#010101"/><path d="M33 10h-5v19a5 5 0 1 1-5-5v-5a10 10 0 1 0 10 10V20a16 16 0 0 0 8 2v-5a8 8 0 0 1-8-7z" fill="#fff"/></svg>'},{k:['netflix'],bg:'#E50914',svg:'<svg viewBox="0 0 48 48" width="28" height="28"><rect width="48" height="48" fill="#141414"/><path d="M14 10h5l-5 28H9zm12 0h5L19 38h-5zm-12 0l10 28h-5L8 10z" fill="#E50914"/></svg>'},{k:['youtube'],bg:'#FF0000',svg:'<svg viewBox="0 0 48 48" width="28" height="28"><rect width="48" height="48" rx="10" fill="#FF0000"/><path d="M20 16l14 8-14 8z" fill="#fff"/></svg>'},{k:['spotify'],bg:'#1DB954',svg:'<svg viewBox="0 0 48 48" width="28" height="28"><circle cx="24" cy="24" r="22" fill="#1DB954"/><path d="M33 31c-5-3-11-3-16-1" stroke="#fff" stroke-width="2.5" stroke-linecap="round" fill="none"/><path d="M35 25c-6-4-14-4-20-1" stroke="#fff" stroke-width="2.5" stroke-linecap="round" fill="none"/><path d="M37 19c-7-4-17-4-24-1" stroke="#fff" stroke-width="2.5" stroke-linecap="round" fill="none"/></svg>'},{k:['amazon'],bg:'#FF9900',svg:'<svg viewBox="0 0 48 48" width="28" height="28"><rect width="48" height="48" rx="8" fill="#FF9900"/><text x="24" y="29" font-size="22" font-weight="900" fill="#131921" text-anchor="middle">a</text><path d="M10 34c6 4 14 6 22 2" stroke="#131921" stroke-width="2.5" stroke-linecap="round" fill="none"/><path d="M36 32l4 2-2 4" stroke="#131921" stroke-width="2" fill="none" stroke-linecap="round"/></svg>'},{k:['paypal'],bg:'#003087',svg:'<svg viewBox="0 0 48 48" width="28" height="28"><rect width="48" height="48" rx="8" fill="#009CDE"/><path d="M18 12h10c5 0 8 3 7 8-1 6-6 9-11 9h-3l-2 9H13z" fill="#fff"/><path d="M20 14h9c4 0 7 2 6 7-1 5-5 8-10 8h-2l-2 9H15z" fill="#003087"/></svg>'},{k:['discord'],bg:'#5865F2',svg:'<svg viewBox="0 0 48 48" width="28" height="28"><rect width="48" height="48" rx="10" fill="#5865F2"/><path d="M32 14s-5-2-9-2-9 2-9 2c-2 4-3 8-3 10 2 2 5 4 8 4l2-3c2 0 3 0 4 0l2 3c3 0 6-2 8-4 0-2-1-6-3-10zm-12 9a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5zm8 0a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z" fill="#fff"/></svg>'},{k:['github'],bg:'#24292F',svg:'<svg viewBox="0 0 48 48" width="28" height="28"><circle cx="24" cy="24" r="22" fill="#24292F"/><path d="M24 8a16 16 0 0 0-5 31c1 0 1-1 1-1v-4c-6 1-7-2-7-2-1-3-3-3-3-3-2-2 0-2 0-2 3 0 4 2 4 2 2 3 5 2 6 2 0-1 1-2 2-3-5 0-10-2-10-10 0-2 1-4 2-6-1-1-2-4 0-7 0 0 2-1 7 2a21 21 0 0 1 12 0c5-3 7-2 7-2 2 3 1 6 0 7 1 2 2 4 2 6 0 8-5 10-10 10 1 1 2 3 2 5v7s0 1 1 1A16 16 0 0 0 24 8z" fill="#fff"/></svg>'},{k:['steam'],bg:'#1B2838',svg:'<svg viewBox="0 0 48 48" width="28" height="28"><circle cx="24" cy="24" r="22" fill="#1B2838"/><circle cx="24" cy="24" r="8" fill="none" stroke="#C7D5E0" stroke-width="3"/><circle cx="24" cy="24" r="3" fill="#C7D5E0"/><path d="M24 10v4M24 34v4M10 24h4M34 24h4" stroke="#C7D5E0" stroke-width="2.5" stroke-linecap="round"/></svg>'},{k:['twitter','x.com'],bg:'#000',svg:'<svg viewBox="0 0 48 48" width="28" height="28"><rect width="48" height="48" rx="10" fill="#000"/><path d="M8 10h8l7 10 9-10h5L26 24l13 14h-8l-8-10-10 10H8l13-15z" fill="#fff"/></svg>'},{k:['google'],bg:'#4285F4',svg:'<svg viewBox="0 0 48 48" width="28" height="28"><path fill="#EA4335" d="M24 9.5c3.6 0 6.4 1.5 8.4 3.3l6.2-6.2C34.5 3 29.7 1 24 1 14.7 1 6.7 6.5 3 14.3l7.2 5.6C12 14 17.5 9.5 24 9.5z"/><path fill="#34A853" d="M46.5 24c0-1.5-.1-3-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.4 5.7c4.3-4 6.8-9.9 6.8-17.4z"/><path fill="#FBBC05" d="M10.2 28.4A15 15 0 0 1 9.5 24c0-1.5.3-3 .7-4.4L3 14C1.1 17.5 0 21.6 0 26c0 4.3 1.1 8.4 3 11.9z"/><path fill="#4285F4" d="M24 47c5.8 0 10.6-1.9 14.1-5.1l-7.4-5.7c-1.9 1.3-4.3 2-6.7 2-6.5 0-12-4.4-14-10.4l-7.1 5.4C6.7 41.3 14.7 47 24 47z"/></svg>'},{k:['whatsapp','whats app'],bg:'#25D366',svg:'<svg viewBox="0 0 48 48" width="28" height="28"><circle cx="24" cy="24" r="22" fill="#25D366"/><path d="M34 14a13 13 0 0 0-22 13l-2 7 7-2a13 13 0 0 0 17-18zm-10 18a9 9 0 0 1-5-2l-4 1 1-4a9 9 0 1 1 8 5z" fill="#fff"/></svg>'},{k:['linkedin'],bg:'#0A66C2',svg:'<svg viewBox="0 0 48 48" width="28" height="28"><rect width="48" height="48" rx="8" fill="#0A66C2"/><rect x="8" y="18" width="7" height="22" fill="#fff"/><circle cx="11.5" cy="12" r="4" fill="#fff"/><path d="M22 18h7v3s2-4 7-4c7 0 8 5 8 10v13h-7V29c0-3-1-5-4-5s-4 3-4 5v11h-7z" fill="#fff"/></svg>'},{k:['wallapop'],bg:'#13C1AC',svg:'<svg viewBox="0 0 48 48" width="28" height="28"><rect width="48" height="48" rx="10" fill="#13C1AC"/><text x="24" y="33" font-size="26" font-weight="900" fill="#fff" text-anchor="middle">W</text></svg>'},{k:['twitch'],bg:'#9146FF',svg:'<svg viewBox="0 0 48 48" width="28" height="28"><rect width="48" height="48" rx="10" fill="#9146FF"/><path d="M12 8l-4 8v24h10v6l6-6h8l10-10V8zm22 20l-6 6h-8l-4 4v-4H10V12h24z" fill="#fff"/><rect x="28" y="16" width="3" height="10" rx="1.5" fill="#9146FF"/><rect x="20" y="16" width="3" height="10" rx="1.5" fill="#9146FF"/></svg>'},{k:['telegram'],bg:'#229ED9',svg:'<svg viewBox="0 0 48 48" width="28" height="28"><circle cx="24" cy="24" r="22" fill="#229ED9"/><path d="M10 24l27-11-5 26-8-7-5 5 1-8z" fill="#fff"/></svg>'},{k:['reddit'],bg:'#FF4500',svg:'<svg viewBox="0 0 48 48" width="28" height="28"><circle cx="24" cy="24" r="22" fill="#FF4500"/><circle cx="17" cy="25" r="3" fill="#fff"/><circle cx="31" cy="25" r="3" fill="#fff"/><path d="M17 32c4 3 10 3 14 0" stroke="#fff" stroke-width="3" stroke-linecap="round" fill="none"/></svg>'},{k:['binance'],bg:'#F3BA2F',svg:'<svg viewBox="0 0 48 48" width="28" height="28"><rect width="48" height="48" rx="10" fill="#F3BA2F"/><path d="M24 8l6 6-6 6-6-6zm-10 10l6 6-6 6-6-6zm20 0l6 6-6 6-6-6zM24 28l6 6-6 6-6-6zm0-8l4 4-4 4-4-4z" fill="#111827"/></svg>'},{k:['mercadolibre','mercado libre'],bg:'#FFE600',svg:'<svg viewBox="0 0 48 48" width="28" height="28"><rect width="48" height="48" rx="10" fill="#FFE600"/><text x="24" y="30" font-size="18" font-weight="900" fill="#2D3277" text-anchor="middle">ML</text></svg>'},{k:['aliexpress','ali express'],bg:'#E62E04',svg:'<svg viewBox="0 0 48 48" width="28" height="28"><rect width="48" height="48" rx="10" fill="#E62E04"/><text x="24" y="31" font-size="18" font-weight="900" fill="#fff" text-anchor="middle">Ali</text></svg>'},{k:['banco','bbva','santander','caixabank','sabadell','ing ','bankinter','venezuela','banesco','mercantil','provincial'],bg:'#1A3A6B',svg:'<svg viewBox="0 0 48 48" width="28" height="28"><rect width="48" height="48" rx="8" fill="#1A3A6B"/><rect x="8" y="20" width="4" height="16" fill="#FFD700"/><rect x="16" y="20" width="4" height="16" fill="#FFD700"/><rect x="24" y="20" width="4" height="16" fill="#FFD700"/><rect x="32" y="20" width="4" height="16" fill="#FFD700"/><polygon points="4,20 24,8 44,20" fill="#FFD700"/><rect x="4" y="36" width="40" height="3" fill="#FFD700"/></svg>'},{k:['wifi','wi-fi','router'],bg:'#00B4D8',svg:'<svg viewBox="0 0 48 48" width="28" height="28"><rect width="48" height="48" rx="10" fill="#00B4D8"/><path d="M8 20c9-9 23-9 32 0" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/><path d="M13 26c6-6 16-6 22 0" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/><path d="M18 32c3-3 9-3 12 0" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/><circle cx="24" cy="38" r="2.5" fill="#fff"/></svg>'},
{k:['pinterest'],bg:'#E60023',svg:'<svg viewBox="0 0 48 48" width="28" height="28"><circle cx="24" cy="24" r="22" fill="#E60023"/><path d="M24 6C14 6 6 14 6 24c0 7.6 4.6 14.1 11.2 17-.2-1.4-.3-3.5.1-5l2.5-10.6s-.6-1.3-.6-3.2c0-3 1.7-5.2 3.8-5.2 1.8 0 2.7 1.4 2.7 3 0 1.8-1.2 4.6-1.8 7.1-.5 2.1 1 3.8 3.1 3.8 3.7 0 6.5-3.9 6.5-9.5 0-5-3.6-8.5-8.7-8.5-5.9 0-9.4 4.5-9.4 9.1 0 1.8.7 3.7 1.6 4.8.2.2.2.4.1.6l-.6 2.4c-.1.4-.3.5-.7.3-2.6-1.2-4.2-5-4.2-8.1 0-6.6 4.8-12.6 13.8-12.6 7.2 0 12.9 5.1 12.9 12 0 7.1-4.5 12.9-10.7 12.9-2.1 0-4-1.1-4.7-2.4l-1.3 4.9c-.5 1.8-1.7 4-2.6 5.4.2.1.4.1.6.1 10 0 18-8.1 18-18S34 6 24 6z" fill="#fff"/></svg>'},
{k:['snapchat','snap'],bg:'#FFFC00',svg:'<svg viewBox="0 0 48 48" width="28" height="28"><rect width="48" height="48" rx="10" fill="#FFFC00"/><path d="M24 8c-5 0-9 4-9 9v2c-1 0-3 1-3 2s1 2 3 3c-1 2-3 4-6 5 1 1 3 2 7 2 1 2 3 3 8 3s7-1 8-3c4 0 6-1 7-2-3-1-5-3-6-5 2-1 3-2 3-3s-2-2-3-2v-2c0-5-4-9-9-9z" fill="#111"/></svg>'},
{k:['threads'],bg:'#000',svg:'<svg viewBox="0 0 48 48" width="28" height="28"><rect width="48" height="48" rx="10" fill="#000"/><path d="M30 17c-3-2-8-2-11 1-2 2-3 5-2 8 1 2 3 4 6 4 4 0 7-3 7-7 0-1 0-2-1-3-1 0-2-1-3-1-2 0-3 1-3 3s1 3 3 3" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/><path d="M32 14v20" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></svg>'},
{k:['twitch'],bg:'#9146FF',svg:'<svg viewBox="0 0 48 48" width="28" height="28"><rect width="48" height="48" rx="10" fill="#9146FF"/><path d="M12 8l-4 8v24h10v6l6-6h8l10-10V8zm22 20l-6 6h-8l-4 4v-4H10V12h24z" fill="#fff"/><rect x="28" y="16" width="3" height="10" rx="1.5" fill="#9146FF"/><rect x="20" y="16" width="3" height="10" rx="1.5" fill="#9146FF"/></svg>'},
{k:['stripe'],bg:'#635BFF',svg:'<svg viewBox="0 0 48 48" width="28" height="28"><rect width="48" height="48" rx="10" fill="#635BFF"/><path d="M22 19c0-2 1-3 4-3 4 0 8 1 11 3v-9c-3-1-7-2-11-2-8 0-14 4-14 12 0 11 16 9 16 14 0 2-2 3-5 3-4 0-9-2-12-4v9c4 2 8 3 12 3 9 0 15-4 15-12 0-12-16-10-16-14z" fill="#fff"/></svg>'},
{k:['klarna'],bg:'#FFB3C7',svg:'<svg viewBox="0 0 48 48" width="28" height="28"><rect width="48" height="48" rx="10" fill="#FFB3C7"/><text x="24" y="31" font-size="18" font-weight="900" fill="#1B0033" text-anchor="middle">K</text></svg>'},
{k:['monzo'],bg:'#FF4F64',svg:'<svg viewBox="0 0 48 48" width="28" height="28"><rect width="48" height="48" rx="10" fill="#FF4F64"/><text x="24" y="31" font-size="16" font-weight="900" fill="#fff" text-anchor="middle">monzo</text></svg>'},
{k:['revolut'],bg:'#191C1F',svg:'<svg viewBox="0 0 48 48" width="28" height="28"><rect width="48" height="48" rx="10" fill="#191C1F"/><path d="M16 12h10c4 0 7 3 7 7s-3 7-7 7h-4l8 10h-6l-7-10h-1v10h-5V12zm5 4v6h5c2 0 3-1 3-3s-1-3-3-3z" fill="#fff"/></svg>'},
{k:['wise','transferwise'],bg:'#9FE870',svg:'<svg viewBox="0 0 48 48" width="28" height="28"><rect width="48" height="48" rx="10" fill="#9FE870"/><text x="24" y="31" font-size="16" font-weight="900" fill="#163300" text-anchor="middle">wise</text></svg>'},
{k:['bizum'],bg:'#0073CE',svg:'<svg viewBox="0 0 48 48" width="28" height="28"><rect width="48" height="48" rx="10" fill="#0073CE"/><text x="24" y="31" font-size="13" font-weight="900" fill="#fff" text-anchor="middle">bizum</text></svg>'},
{k:['cashapp','cash app'],bg:'#00D632',svg:'<svg viewBox="0 0 48 48" width="28" height="28"><rect width="48" height="48" rx="10" fill="#00D632"/><text x="24" y="31" font-size="20" font-weight="900" fill="#fff" text-anchor="middle">$</text></svg>'},
{k:['venmo'],bg:'#008CFF',svg:'<svg viewBox="0 0 48 48" width="28" height="28"><rect width="48" height="48" rx="10" fill="#008CFF"/><text x="24" y="31" font-size="13" font-weight="900" fill="#fff" text-anchor="middle">venmo</text></svg>'},
{k:['ethereum','eth'],bg:'#627EEA',svg:'<svg viewBox="0 0 48 48" width="28" height="28"><rect width="48" height="48" rx="10" fill="#627EEA"/><polygon points="24,8 14,26 24,31 34,26" fill="#fff" opacity=".8"/><polygon points="24,33 14,28 24,40 34,28" fill="#fff"/></svg>'},
{k:['steam'],bg:'#1B2838',svg:'<svg viewBox="0 0 48 48" width="28" height="28"><circle cx="24" cy="24" r="22" fill="#1B2838"/><circle cx="24" cy="24" r="8" fill="none" stroke="#C7D5E0" stroke-width="3"/><circle cx="24" cy="24" r="3" fill="#C7D5E0"/><path d="M24 10v4M24 34v4M10 24h4M34 24h4" stroke="#C7D5E0" stroke-width="2.5" stroke-linecap="round"/></svg>'},
{k:['nintendo'],bg:'#E4000F',svg:'<svg viewBox="0 0 48 48" width="28" height="28"><rect width="48" height="48" rx="10" fill="#E4000F"/><rect x="6" y="16" width="16" height="16" rx="8" fill="#fff"/><rect x="26" y="16" width="16" height="16" rx="3" fill="#fff"/><circle cx="34" cy="20" r="2" fill="#E4000F"/><circle cx="38" cy="24" r="2" fill="#E4000F"/><circle cx="30" cy="24" r="2" fill="#E4000F"/><circle cx="34" cy="28" r="2" fill="#E4000F"/><circle cx="14" cy="24" r="4" fill="#E4000F"/></svg>'},
{k:['playstation','ps5','ps4'],bg:'#003791',svg:'<svg viewBox="0 0 48 48" width="28" height="28"><rect width="48" height="48" rx="10" fill="#003791"/><path d="M18 32V14l4 1v13l12-4v4l-12 5zm16-8l-4 1V14l4 4z" fill="#fff"/></svg>'},
{k:['xbox'],bg:'#107C10',svg:'<svg viewBox="0 0 48 48" width="28" height="28"><circle cx="24" cy="24" r="22" fill="#107C10"/><path d="M14 16c3 3 6 7 10 12 4-5 7-9 10-12-2-2-5-4-10-4s-8 2-10 4zm-4 4c-2 3-2 7 0 10 2-3 4-5 6-8zm28 0l-6 2c2 3 4 5 6 8 2-3 2-7 0-10zm-14 16c-3-4-6-8-8-11-1 2-2 5-2 7 0 4 4 7 10 7s10-3 10-7c0-2-1-5-2-7-2 3-5 7-8 11z" fill="#fff"/></svg>'},
{k:['docker'],bg:'#2496ED',svg:'<svg viewBox="0 0 48 48" width="28" height="28"><rect width="48" height="48" rx="10" fill="#2496ED"/><rect x="6" y="22" width="6" height="6" rx="1" fill="#fff"/><rect x="14" y="22" width="6" height="6" rx="1" fill="#fff"/><rect x="22" y="22" width="6" height="6" rx="1" fill="#fff"/><rect x="14" y="14" width="6" height="6" rx="1" fill="#fff"/><rect x="22" y="14" width="6" height="6" rx="1" fill="#fff"/><path d="M38 24c-1-2-3-3-5-2l-1-3c-2 0-4 2-4 4H10c0 5 4 9 9 9h10c4 0 7-3 9-7z" fill="#fff"/></svg>'},
{k:['aws','amazon web'],bg:'#FF9900',svg:'<svg viewBox="0 0 48 48" width="28" height="28"><rect width="48" height="48" rx="10" fill="#232F3E"/><text x="24" y="24" font-size="10" font-weight="900" fill="#FF9900" text-anchor="middle">amazon</text><text x="24" y="36" font-size="10" font-weight="900" fill="#FF9900" text-anchor="middle">web services</text></svg>'},
{k:['firebase'],bg:'#FFCA28',svg:'<svg viewBox="0 0 48 48" width="28" height="28"><rect width="48" height="48" rx="10" fill="#1C1C1C"/><path d="M12 36l6-22 7 13-3 9zm14-4l-4-20 10 14zm6 4L20 18l6 4 6-10v24z" fill="#FFCA28"/></svg>'},
{k:['supabase'],bg:'#3ECF8E',svg:'<svg viewBox="0 0 48 48" width="28" height="28"><rect width="48" height="48" rx="10" fill="#1C1C1C"/><path d="M28 6l-16 24h14v12l16-24H28z" fill="#3ECF8E"/></svg>'},
{k:['notion'],bg:'#111827',svg:'<svg viewBox="0 0 48 48" width="28" height="28"><rect width="48" height="48" rx="10" fill="#fff"/><path d="M14 12h14l8 8v16H14zm0 0v24M28 12v8h8" fill="none" stroke="#111827" stroke-width="2.5" stroke-linejoin="round"/></svg>'},
{k:['figma'],bg:'#A259FF',svg:'<svg viewBox="0 0 48 48" width="28" height="28"><rect width="48" height="48" rx="10" fill="#1E1E1E"/><rect x="16" y="8" width="8" height="8" rx="4" fill="#FF7262"/><rect x="24" y="8" width="8" height="8" rx="4" fill="#1ABCFE"/><rect x="16" y="16" width="8" height="8" rx="0" fill="#FF7262"/><rect x="16" y="24" width="8" height="8" rx="4" fill="#0ACF83"/><circle cx="28" cy="28" r="4" fill="#A259FF"/></svg>'},
{k:['slack'],bg:'#4A154B',svg:'<svg viewBox="0 0 48 48" width="28" height="28"><rect width="48" height="48" rx="10" fill="#4A154B"/><rect x="10" y="22" width="10" height="5" rx="2.5" fill="#E01E5A"/><rect x="10" y="16" width="5" height="10" rx="2.5" fill="#E01E5A"/><rect x="22" y="33" width="10" height="5" rx="2.5" fill="#36C5F0"/><rect x="27" y="28" width="5" height="10" rx="2.5" fill="#36C5F0"/><rect x="33" y="16" width="5" height="10" rx="2.5" fill="#2EB67D"/><rect x="28" y="16" width="10" height="5" rx="2.5" fill="#2EB67D"/><rect x="16" y="10" width="5" height="10" rx="2.5" fill="#ECB22E"/><rect x="16" y="10" width="10" height="5" rx="2.5" fill="#ECB22E"/></svg>'},
{k:['zoom'],bg:'#2D8CFF',svg:'<svg viewBox="0 0 48 48" width="28" height="28"><rect width="48" height="48" rx="10" fill="#2D8CFF"/><rect x="6" y="16" width="24" height="16" rx="4" fill="#fff"/><path d="M30 20l12-6v20l-12-6z" fill="#fff"/></svg>'},
{k:['zalando'],bg:'#FF6900',svg:'<svg viewBox="0 0 48 48" width="28" height="28"><rect width="48" height="48" rx="10" fill="#FF6900"/><text x="24" y="31" font-size="18" font-weight="900" fill="#fff" text-anchor="middle">Z</text></svg>'},
{k:['vinted'],bg:'#09B1BA',svg:'<svg viewBox="0 0 48 48" width="28" height="28"><rect width="48" height="48" rx="10" fill="#09B1BA"/><text x="24" y="31" font-size="12" font-weight="900" fill="#fff" text-anchor="middle">vinted</text></svg>'},
{k:['ikea'],bg:'#0058A3',svg:'<svg viewBox="0 0 48 48" width="28" height="28"><rect width="48" height="48" rx="10" fill="#0058A3"/><ellipse cx="24" cy="24" rx="18" ry="12" fill="#FFDA1A"/><text x="24" y="28" font-size="12" font-weight="900" fill="#0058A3" text-anchor="middle">IKEA</text></svg>'},
{k:['decathlon'],bg:'#0082C8',svg:'<svg viewBox="0 0 48 48" width="28" height="28"><rect width="48" height="48" rx="10" fill="#0082C8"/><text x="24" y="28" font-size="9" font-weight="900" fill="#fff" text-anchor="middle">DECATHLON</text></svg>'},
{k:['leroy','leroy merlin'],bg:'#78BE20',svg:'<svg viewBox="0 0 48 48" width="28" height="28"><rect width="48" height="48" rx="10" fill="#78BE20"/><text x="24" y="28" font-size="9" font-weight="900" fill="#fff" text-anchor="middle">LEROY</text></svg>'}
];
for(const m of map){if(m.k.some(k=>n.includes(k))){return{bg:m.bg,svg:m.svg};}}const manualHit=MANUAL_ICONS.find(ic=>ic.id!=='auto' && (n.includes(ic.id)||n.includes((ic.label||'').toLowerCase())));if(manualHit)return{bg:manualHit.bg,svg:null,emoji:manualHit.emoji};const colors=['#e11d48','#f97316','#0ea5e9','#2563eb','#16a34a','#9333ea','#334155','#f59e0b'];const sum=[...s].reduce((a,c)=>a+c.charCodeAt(0),0);return{bg:colors[sum%colors.length],svg:null};}
function serviceColor(s){return serviceIcon(s).bg;}
function esc(s=''){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
let _entryFav=false;
function toggleFavEntry(){_entryFav=!_entryFav;const btn=$('favToggleBtn');const thumb=$('favThumb');if(btn){btn.style.background=_entryFav?'var(--cyan)':'rgba(255,255,255,.15)';}if(thumb){thumb.style.left=_entryFav?'25px':'3px';}if($('eFav'))$('eFav').value=String(_entryFav);}
function openUrlModal(){$('urlModal')?.classList.add('open');}
function closeUrlModal(){$('urlModal')?.classList.remove('open');}
function openNoteModal(){$('noteModal')?.classList.add('open');}
function closeNoteModal(){$('noteModal')?.classList.remove('open');}
/* Icon strip - ordered by brand recognition */


function renderIconStrip(){
  const strip=byId('iconStripRow');
  if(!strip)return;
  vkBuildIconMap();
  const q=normService(byId('eIconSearch')?.value||'');
  let list=(MANUAL_ICONS||[]).filter(ic=>ic&&ic.id);
  if(!q){
    const pri=['auto','gmail','google','facebook','instagram','whatsapp','telegram','youtube','netflix','spotify','amazon','paypal','github','discord','linkedin','x','microsoft','apple','chatgpt','bank','bbva','santander','caixa','ing','tiktok','revolut','wise','binance','coinbase','wifi','cloud','card','shopping','work','vpn','token','safe','zelle','stripe','outlook','yahoo','drive','dropbox','chrome','safari','firefox','twitch','reddit','pinterest','snapchat','signal'];
    const priSet=new Set(pri);
    list=[...pri.map(id=>list.find(ic=>ic.id===id)).filter(Boolean),...list.filter(ic=>!priSet.has(ic.id))].slice(0,120);
  }else{
    list=list.filter(ic=>[ic.id,ic.label,ic.emoji||''].join(' ').toLowerCase().includes(q)).slice(0,120);
    if(!list.length)list=[{id:'custom',label:byId('eIconSearch')?.value||'Servicio',bg:'#0a84ff'}];
  }
  strip.innerHTML=list.map(ic=>{
    const active=(selectedEntryIcon||'auto')===ic.id;
    const obj=vkGetIcon(ic.id,ic.label,ic.bg);
    const safeId=String(ic.id||'').replace(/'/g,"\'");
    const svgStr=obj.svg.replace(/<svg ([^>]*?)width="[^"]*"\s*/g,'<svg $1').replace(/<svg ([^>]*?)height="[^"]*"\s*/g,'<svg $1').replace(/<svg /g,'<svg style="width:100%;height:100%;display:block" ');
    return `<button type="button" class="vkStripIconBtn ${active?'active':''}" title="${safeEsc(ic.label||ic.id)}" onclick="selectEntryIcon('${safeId}');renderIconStrip()">${svgStr}</button>`;
  }).join('');
}function updateEntryIconPreview(){renderIconStrip();}
function entryShowStep(n){$('entryStep1').style.display=n===1?'block':'none';$('entryStep2').style.display=n===2?'block':'none';$('dot1').style.width=n===1?'32px':'8px';$('dot1').style.background=n===1?'var(--cyan)':'rgba(255,255,255,.2)';$('dot1').style.boxShadow=n===1?'0 0 14px rgba(0,210,255,.7)':'none';$('dot2').style.width=n===2?'32px':'8px';$('dot2').style.background=n===2?'var(--cyan)':'rgba(255,255,255,.2)';$('dot2').style.boxShadow=n===2?'0 0 14px rgba(0,210,255,.7)':'none';$('entryBackBtn').textContent=n===1?'Cancelar':'\u2190 Atr\xe1s';$('entryNextBtn').textContent=n===2?'Guardar':'Siguiente \u2192';if(n===2){updateEntryStep2Header();renderIconStrip();}$('entryModal')?.querySelector('.sheet')?.scrollTo({top:0,behavior:'smooth'});}
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
function serviceRequiresEmail(){return true}
function toggleQvPass(){let el=$('qvPass');el.textContent=el.textContent.startsWith('•')?current.pass:'••••••••••••'}
function toggleQvNote(){const el=$('qvNote');if(!el)return;if(el.textContent==='••••••••'){el.textContent=current.note;el.style.whiteSpace='pre-wrap';el.style.fontSize='14px';el.style.lineHeight='1.6';}else{el.textContent='••••••••';el.style.whiteSpace='';el.style.fontSize='';el.style.lineHeight='';}}

function toggleQvCard(){const el=$('qvCardNum');if(!el)return;if(el.textContent.includes('•')){el.textContent=current.cardNumber;}else{el.textContent='•••• •••• •••• '+current.cardNumber.slice(-4);}}
function toggleQvCvv(){const el=$('qvCvv');if(!el)return;el.textContent=el.textContent==='•••'?current.cardCvv:'•••';}
function toggleQvWifiPass(){const el=$('qvWifiPass');if(!el)return;el.textContent=el.textContent==='••••••••'?current.wifiPass:'••••••••';}
async function toggleFav(id){let e=vault.find(x=>x.id===id);if(e){e.fav=!e.fav;await persist();closeModals();render();toast('Actualizado')}}
async function delEntry(id){vibe([40,20,40]);soundDelete();if(await vkConfirm('Eliminar entrada','¿Eliminar esta entrada de la bóveda?')){vault=vault.filter(e=>e.id!==id);await persist();closeModals();render();toast('Entrada eliminada');try{driveAutoSync();}catch(e){}}}
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
function openUrl(u){vibe(20);if(!/^https?:\/\//.test(u))u='https://'+u;window.open(u,'_blank')}
function openGen(target=false,targetField='ePass'){useGenTarget=target;window._genTargetField=targetField;$('genModal').classList.add('open');syncRanges(false);if($('genOut').textContent==='Pulsa generar')markGeneratorDirty()}
function setGenLen(n){$('gLen').value=n;syncRanges(true)}
function markGeneratorDirty(){syncRanges(false);$('genOut').textContent='Pulsa generar';}
function generatePass(){
  vibe(40);soundGen();
  syncRanges();
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
    $('entryModal').classList.add('open');
    toast('Contraseña añadida a la entrada');
  }else{
    closeModals();
    openEntry();
    $('ePass').value=v;updateStrength();
    toast('Ahora completa servicio y usuario, luego Guardar');
  }
}
async function exportBackup(){let pack=localStorage.getItem(LS_DATA);if(!pack){vibe([30,30]);soundError();toast('No hay datos');return}let data={app:'VaultKey',version:1,exported:Date.now(),payload:JSON.parse(pack)};let blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});let a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='VaultKey-respaldo-cifrado.json';a.click();let m=meta();m.lastBackup=Date.now();localStorage.setItem(LS_META,JSON.stringify(m));render();soundSuccess();toast('Respaldo cifrado exportado. Solo se restaura con tu PIN')}

// ============================================================
// IMPORTACIÓN CON PANTALLA PROPIA
// ============================================================
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
  // Reset file input
  const fi = document.getElementById('importFile');
  if(fi) fi.value = '';
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

async function doImportConfirm() {
  if(!_importDecrypted) { closeImportModal(); return; }
  try {
    vault = _importDecrypted.filter(e=>e&&typeof e==='object').map(e=>({
      id: String(e.id||crypto.randomUUID()),
      service: String(e.service||''),
      entryType: String(e.entryType||'password'),
      user: String(e.user||''),
      email: String(e.email||''),
      pass: String(e.pass||''),
      url: String(e.url||''),
      note: String(e.note||''),
      category: String(e.category||'general'),
      fav: !!e.fav,
      used: Number(e.used||0),
      updated: Number(e.updated||0),
      passHistory: Array.isArray(e.passHistory)?e.passHistory:[],
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
    render();
    const count = vault.length;
    closeImportModal();
    soundSuccess(); vibe([30,20,60]);
    toast('✓ Respaldo importado — ' + count + ' entradas restauradas');
    try{ driveAutoSync(); }catch(e){}
  } catch(e) {
    soundError();
    toast('Error al importar el respaldo');
  }
}

async function importBackup(file) {
  if(!file) return;
  openImportModal(file);
}


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
  vibe(25);
  const LS_BIO_CRED='vk_bio_cred_id';
  const LS_BIO_BLOB='vk_bio_blob';
  const b64e=buf=>btoa(String.fromCharCode(...new Uint8Array(buf)));
  const b64d=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
  if(!window.PublicKeyCredential){toast('Tu dispositivo no soporta biometría.');return;}
  const m=meta();
  if(!m||!m.hash){toast('Configura primero un PIN.');return;}
  const storedCredId=localStorage.getItem(LS_BIO_CRED);
  if(!storedCredId||!localStorage.getItem(LS_BIO_BLOB)){
    toast('Introduce el PIN una vez para activar la huella.');return;
  }
  // Verificar huella y desbloquear
  try{
    const challenge=crypto.getRandomValues(new Uint8Array(32));
    const rawId=b64d(storedCredId);
    const assertion=await navigator.credentials.get({publicKey:{
      challenge,
      allowCredentials:[{type:'public-key',id:rawId}],
      userVerification:'required',
      timeout:60000
    }});
    const blob=localStorage.getItem(LS_BIO_BLOB);
    const {iv,data}=JSON.parse(blob);
    const baseKey=await crypto.subtle.importKey('raw',new Uint8Array(assertion.rawId),'PBKDF2',false,['deriveKey']);
    const aesKey=await crypto.subtle.deriveKey(
      {name:'PBKDF2',salt:new TextEncoder().encode('vaultkey-bio-salt'),iterations:100000,hash:'SHA-256'},
      baseKey,{name:'AES-GCM',length:256},false,['decrypt']
    );
    const dec=await crypto.subtle.decrypt({name:'AES-GCM',iv:b64d(iv)},aesKey,b64d(data));
    const recoveredPin=new TextDecoder().decode(dec);
    const pinOk=m.pinSalt?(await hashPin(recoveredPin,m.pinSalt))===m.hash:(await digest(recoveredPin))===m.hash;
    if(!pinOk){
      toast('Error de verificación. Vuelve a entrar con el PIN para reactivar la huella.');
      localStorage.removeItem(LS_BIO_CRED);localStorage.removeItem(LS_BIO_BLOB);return;
    }
    await unlockOk(recoveredPin);
  }catch(e){
    if(e.name==='NotAllowedError')toast('Verificación cancelada.');
    else{toast('Huella no reconocida. Usa el PIN.');localStorage.removeItem(LS_BIO_CRED);localStorage.removeItem(LS_BIO_BLOB);}
  }
}
function shareApp(){
  const url=location.origin&&location.origin!=='null'?location.origin:location.href;
  if(navigator.share){
    // BUG5 FIX: marcar que estamos compartiendo para ignorar visibilitychange
    window._vkSharing=true;
    navigator.share({title:'VaultKey',text:'VaultKey - Tu bóveda digital privada',url})
      .catch(()=>{})
      .finally(()=>{setTimeout(()=>{window._vkSharing=false;},500);});
  }else toast('Enlace de VaultKey: '+url)
}
function showAppInfo(){
  const m=meta();
  const creado=m&&m.created?new Date(m.created).toLocaleDateString('es-ES'):'—';
  const backup=m&&m.lastBackup?new Date(m.lastBackup).toLocaleDateString('es-ES'):'Nunca';
  const total=vault?vault.length:0;
  const favs=vault?vault.filter(e=>e.fav).length:0;
  const debiles=vault?vault.filter(e=>e.entryType==='password'&&score(e.pass)<3).length:0;
  vkConfirm(
    'VaultKey V2.2.1 Clean',
    `📦 Entradas guardadas: ${total}\n⭐ Favoritos: ${favs}\n⚠️ Contraseñas débiles: ${debiles}\n📅 PIN creado: ${creado}\n☁️ Último respaldo: ${backup}\n\n🔒 Cifrado AES-GCM 256 bits\n🔑 PBKDF2 · 200.000 iteraciones`
  ).catch(()=>{});
}

/* Easter egg: 7 toques en la versión → reiniciar intro/onboarding */
(function(){
  let tapCount=0,tapTimer=null;
  document.addEventListener('DOMContentLoaded',()=>{
    const row=document.getElementById('versionRow');
    if(!row)return;
    row.addEventListener('click',()=>{
      tapCount++;
      clearTimeout(tapTimer);
      const hint=document.getElementById('versionRowHint');
      if(tapCount>=7){
        tapCount=0;
        if(hint)hint.textContent='Pulsa para ver información de la bóveda';
        localStorage.removeItem('vk_splash_v1');
        localStorage.removeItem('vaultkey_onboarding_v130');
        toast('🎬 Demo reiniciada — recargando...');
        setTimeout(()=>location.reload(),1200);
      } else {
        const left=7-tapCount;
        if(hint)hint.textContent=left===1?'¡Un toque más!':left+' toques para reiniciar demo';
        tapTimer=setTimeout(()=>{
          tapCount=0;
          if(hint)hint.textContent='Pulsa para ver información de la bóveda';
        },2000);
        if(tapCount===1)showAppInfo();
      }
    });
  });
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

function vkSvgBrand(label,bg,fg='#fff'){return {bg,svg:`<svg viewBox="0 0 48 48" width="48" height="48"><rect width="48" height="48" rx="10" fill="${bg}"/><text x="24" y="31" font-size="18" font-weight="900" fill="${fg}" text-anchor="middle" font-family="Arial, sans-serif">${label}</text></svg>`}}
function vkGenericServiceIcon(){return {bg:'#06213f',svg:'<svg class="vkGenericLogo" viewBox="0 0 48 48" width="48" height="48"><defs><linearGradient id="vkg" x1="0" x2="1"><stop stop-color="#00c8ff"/><stop offset="1" stop-color="#0a84ff"/></linearGradient></defs><rect width="48" height="48" rx="12" fill="#061a33"/><path d="M24 6l16 6v11c0 10-6.7 16.7-16 20-9.3-3.3-16-10-16-20V12z" fill="none" stroke="url(#vkg)" stroke-width="3"/><path d="M19 23a5 5 0 1 1 10 0v2h1.5v10h-13V25H19z" fill="#dff6ff"/><path d="M21 25v-2a3 3 0 1 1 6 0v2z" fill="#061a33"/></svg>'}}





/* renderIconPicker redefined below */

function clearFieldError(id){
  const el=$(id); if(!el)return;
  el.classList.remove('fieldError');
  const next=el.nextElementSibling;
  if(next&&next.classList&&next.classList.contains('fieldErrorNote'))next.remove();
}
function firstScrollableEntrySheet(){return $('entryModal')?.querySelector('.sheet')||null}
function showFieldError(id,msg){
  const el=$(id); if(!el)return;
  clearFieldError(id);
  el.classList.add('fieldError');
  el.insertAdjacentHTML('afterend',`<span class="fieldErrorNote">${esc(msg)}</span>`);
  setTimeout(()=>{
    try{el.scrollIntoView({behavior:'smooth',block:'center'});}catch(e){}
    try{el.focus({preventScroll:true});}catch(e){try{el.focus();}catch(_){}}
  },30);
}
function manualIconLabel(id){const ic=MANUAL_ICONS.find(x=>x.id===id&&x.id!=='auto');return ic?(ic.label||ic.id):''}
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
['eService','eUser','eUrl','ePass'].forEach(id=>document.addEventListener('input',ev=>{if(ev.target&&ev.target.id===id)clearFieldError(id)},true));

function legacyEmailFromEntry(e){return (!e?.email && isValidEmail(e?.user||'')) ? (e.user||'') : (e?.email||'')}
function userFromEntry(e){return (!e?.email && isValidEmail(e?.user||'')) ? '' : (e?.user||'')}
function entryMainIdentity(e){
  if(e?.entryType==='note') return '📝 Nota segura';
  if(e?.entryType==='card') return '💳 '+(e.cardType?e.cardType.charAt(0).toUpperCase()+e.cardType.slice(1):'Tarjeta')+(e.cardNumber?' ••'+e.cardNumber.slice(-2):'');
  if(e?.entryType==='id') return '🪪 '+(e.idType?e.idType.toUpperCase():'Documento')+(e.idNumber?' ••'+e.idNumber.slice(-3):'');
  if(e?.entryType==='license') return '🚗 Licencia'+(e.licCategory?' ('+e.licCategory+')':'');
  if(e?.entryType==='medical') return '🏥 Datos médicos'+(e.medBlood?' · '+e.medBlood:'');
  if(e?.entryType==='wifi') return '📶 '+(e.wifiSsid||e.service||'WiFi')+(e.wifiSec?' · '+e.wifiSec:'');
  return '••••••••';
}
function entrySearchText(e){return [e.service,userFromEntry(e),legacyEmailFromEntry(e),e.url,e.note,e.type,e.wifiSsid,e.wifiRouter,e.idName,e.idNumber,e.idType,e.licName,e.licNumber,e.medName,e.medSS,e.cardName].filter(Boolean).join(' ').toLowerCase()}
function clearEntryErrors(){document.querySelectorAll('.fieldErrorNote').forEach(x=>x.remove());['eService','eUser','eEmail','eUrl','ePass'].forEach(id=>$(id)?.classList.remove('fieldError'))}
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
          if(d.pass)document.getElementById('ePass')&&(document.getElementById('ePass').value=d.pass);
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
  if($('eCategory'))$('eCategory').value=e?.category||'general';
  const btn=$('favToggleBtn');const thumb=$('favThumb');
  if(btn)btn.style.background=_entryFav?'var(--cyan)':'rgba(255,255,255,.15)';
  if(thumb)thumb.style.left=_entryFav?'25px':'3px';
  document.querySelectorAll('.fieldErrorNote').forEach(x=>x.remove());
  ['eService','eUser','eEmail','eUrl','ePass'].forEach(id=>$(id)?.classList.remove('fieldError'));
  updateStrength();renderIconStrip();
  $('entryModal').classList.add('open');
  setTimeout(()=>{$('entryModal')?.querySelector('.sheet')?.scrollTo({top:0,behavior:'auto'});},30);
  resetAutoLockTimer();
}
async function saveEntry(){
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
  let entry={id:editId||crypto.randomUUID(),service:serviceVal,entryType:_entryType,...cardData,...idData,...licData,...medData,...wifiData,type:'Cuenta',category:($('eCategory')?.value||'general'),user:isPassType?userVal:'',email:isPassType?emailVal:'',pass:isPassType?pass:'',url:isPassType?urlVal:'',note:_entryType==='note'?secureNoteVal:($('eNote')?.value||'').trim(),icon:selectedEntryIcon||'',fav:_entryFav,updated:Date.now(),used:editId?(vault.find(x=>x.id===editId)?.used||0):0,passHistory:_newHistory};
  let i=vault.findIndex(x=>x.id===entry.id);
  if(i>=0)vault[i]=entry;else vault.unshift(entry);
  _catFilter='';_vaultTab='todas';document.querySelectorAll('.catChip').forEach(c=>c.classList.remove('active'));const _fc=document.querySelectorAll('.catChip')[0];if(_fc)_fc.classList.add('active');
  await persist();closeModals();show('vault');render();try{driveAutoSync();}catch(e){}toast('Guardado \u2713');
}
// Tab switcher para Recientes
function switchVaultTab(tab, btn){
  _vaultTab=tab;
  document.querySelectorAll('.vaultTabs button').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  render();
}
function render(){let q=($('search')?.value||'').toLowerCase();
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
    const _cf=_catFilter||'';const _catMatch=(e)=>{if(!_cf)return true;if((e.category||'general')===_cf)return true;if(e.entryType==='wifi'&&_cf==='wifi')return true;if((e.entryType==='id'||e.entryType==='license'||e.entryType==='medical')&&_cf==='otros')return true;return false;};let list=vault.filter(e=>entrySearchText(e).includes(q)&&_catMatch(e));$('entryList')&&( $('entryList').innerHTML='', list.length?list.forEach(e=>$('entryList').appendChild(row(e))):$('entryList').innerHTML='<div class="empty"><div class="emptyVault"><svg viewBox="0 0 80 80" width="90" height="90" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="8" y="16" width="64" height="52" rx="10" stroke="#1a6fff" stroke-width="2.5" fill="rgba(0,80,200,.08)"/><rect x="8" y="16" width="64" height="14" rx="10" stroke="#1a6fff" stroke-width="2.5" fill="rgba(0,100,255,.15)"/><circle cx="40" cy="50" r="11" stroke="#00d4ff" stroke-width="2.5" fill="rgba(0,210,255,.06)"/><circle cx="40" cy="50" r="4" fill="#00d4ff" opacity=".7"/><line x1="40" y1="39" x2="40" y2="43" stroke="#00d4ff" stroke-width="2.5" stroke-linecap="round"/><line x1="40" y1="57" x2="40" y2="61" stroke="#00d4ff" stroke-width="2.5" stroke-linecap="round"/><line x1="29" y1="50" x2="33" y2="50" stroke="#00d4ff" stroke-width="2.5" stroke-linecap="round"/><line x1="47" y1="50" x2="51" y2="50" stroke="#00d4ff" stroke-width="2.5" stroke-linecap="round"/><rect x="62" y="40" width="8" height="16" rx="4" stroke="#1a6fff" stroke-width="2" fill="rgba(0,80,200,.1)"/></svg></div><b style="color:#e0f0ff;font-size:16px">Tu bóveda está vacía</b><p style="color:#4a7090;margin-top:6px;font-size:13px">Crea tu primera credencial con el botón +</p></div>');
  }
  renderFav();let recent=[...vault].sort((a,b)=>(b.used||0)-(a.used||0)).slice(0,4);$('recentList')&&( $('recentList').innerHTML='', recent.length?recent.forEach(e=>$('recentList').appendChild(row(e))):$('recentList').innerHTML='<p class="sub">Todavía no has usado entradas.</p>');$('vaultSub')&&($('vaultSub').textContent=vault.length+' entradas');$('statTotal')&&($('statTotal').textContent=vault.length);$('statFav')&&($('statFav').textContent=vault.filter(e=>e.fav).length);$('statWeak')&&($('statWeak').textContent=vault.filter(e=>e.entryType==='password'&&score(e.pass)<3).length);let m=meta();$('statBackup')&&($('statBackup').textContent=m?.lastBackup?new Date(m.lastBackup).toLocaleDateString():'Nunca')}

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
serviceIcon=function(s){const n=(s||'').toLowerCase().trim();if(!n)return vk128Shield();for(const item of VK128_BRAND_ICONS){if(item.k.some(k=>vk128Match(n,k)))return item.v;}return vk128Shield();}
function iconFromKey(id){
  if(!id||id==='auto')return null;
  const ic=MANUAL_ICONS.find(x=>x.id===id);
  if(!ic)return null;
  return {bg:ic.bg||'#0a84ff',label:ic.label||ic.id,id:ic.id};
}function iconForEntry(e){
  if(e?.icon&&e.icon!=='auto'){const m=iconFromKey(e.icon);if(m&&m.svg)return m;}
  const byName=_iconByServiceName(e?.service);
  if(byName)return byName;
  return serviceIcon([e?.service,e?.url,e?.type].filter(Boolean).join(' '));
}
function vkLogoHTML(ic,cls='logo',sz=null){ic=ic&&ic.svg?ic:vk128Shield();const svg=ic.svg.replace(/<svg ([^>]*?)width="[^"]*"\s*/,'<svg $1').replace(/<svg ([^>]*?)height="[^"]*"\s*/,'<svg $1').replace(/<svg /,'<svg style="width:100%;height:100%;display:block" ');const sizeStyle=sz?`width:${sz}px;height:${sz}px;`:'' ;return `<div class="${cls}" style="background:${ic.bg};padding:0;overflow:hidden;${sizeStyle}">${svg}</div>`}
let currentIconCat='todos';
window._setIconCat=function(cat,btn){currentIconCat=cat;document.querySelectorAll('.iconCat').forEach(b=>b.classList.remove('active'));if(btn)btn.classList.add('active');const s=$('eIconSearch');if(s)s.value='';if(typeof renderIconPicker==='function')renderIconPicker();};
function setIconCat(cat,btn){window._setIconCat(cat,btn);}
document.addEventListener('click',function(e){const btn=e.target.closest('[data-cat]');if(btn&&btn.classList.contains('iconCat')){e.stopPropagation();window._setIconCat(btn.dataset.cat,btn);}});


function row(e){let div=document.createElement('div');div.className='entry';div.onclick=()=>quick(e.id);let ic=iconForEntry(e);const weak=e?.entryType==='password'&&score(e.pass)<3;const typeEmoji=e?.entryType==='note'?'📝':e?.entryType==='card'?'💳':e?.entryType==='id'?'🪪':e?.entryType==='license'?'🚗':e?.entryType==='medical'?'🏥':e?.entryType==='wifi'?'📶':'🔑';div.innerHTML=`${vkLogoHTML(ic)}<div style="flex:1;min-width:0"><h3 style="display:flex;align-items:center;gap:6px">${esc(e.service)}${e.fav?'<span style="font-size:11px">⭐</span>':''} ${weak?'<span style="font-size:9px;background:rgba(255,77,85,.2);color:#ff8c94;border:1px solid rgba(255,77,85,.3);border-radius:6px;padding:1px 5px;font-weight:900;letter-spacing:.3px">DÉBIL</span>':''}</h3><p style="color:#7a9ec0">${esc(entryMainIdentity(e))}</p></div><div style="display:flex;flex-direction:column;align-items:center;gap:6px"><span style="font-size:14px;opacity:.7">${typeEmoji}</span><div class="go" style="color:rgba(0,210,255,.4);font-size:18px">›</div></div>`;return div}

function renderFav(){
  const grid=$('favGrid');
  const countEl=$('favCount');
  if(!grid)return;
  const favs=vault.filter(e=>e.fav);
  if(countEl)countEl.textContent=favs.length?favs.length+' favorito'+(favs.length===1?'':'s'):'';
  if(!favs.length){
    grid.innerHTML='<div class="empty" style="padding:40px 0 20px;text-align:center"><div style="margin:0 auto 14px;filter:drop-shadow(0 0 18px rgba(0,180,255,.5))"><svg viewBox="0 0 80 80" width="80" height="80" fill="none"><polygon points="40,10 48,30 70,32 54,47 58,68 40,57 22,68 26,47 10,32 32,30" stroke="#00d4ff" stroke-width="2.5" stroke-linejoin="round" fill="rgba(0,180,255,.08)"/><polygon points="40,18 46,32 62,34 51,44 54,60 40,52 26,60 29,44 18,34 34,32" fill="rgba(0,210,255,.12)"/></svg></div><b style="color:#e0f0ff;font-size:16px;display:block;margin-bottom:6px">Sin favoritos aún</b><p style="color:#3a6888;margin:0 0 16px;font-size:13px">Marca entradas como favoritas para acceder más rápido</p><button class="primary" onclick="show(\'vault\')" style="width:auto;padding:10px 24px">Ver entradas</button></div>';
    return;
  }
  grid.innerHTML='';
  favs.forEach(e=>{
    const ic=iconForEntry(e);
    const weak=e?.entryType==='password'&&score(e.pass)<3;
    const identity=entryMainIdentity(e);
    const row=document.createElement('div');
    row.className='favRow';
    row.onclick=()=>quick(e.id);
    const userVal=e.user||e.email||'';
    row.innerHTML=`<div class="favRowIco">${vkLogoHTML(ic,'logo',48)}</div><div class="favRowInfo"><div class="favRowName">${esc(e.service)}${weak?'<span class="favRowWeak">DÉBIL</span>':''}</div>${identity?'<div class="favRowId">'+esc(identity)+'</div>':''}</div><div class="favRowBtns"><button class="favRowBtn2" onclick="event.stopPropagation();vibe(25);soundCopy();copyText(${JSON.stringify(userVal)});toast('Usuario copiado')">👤</button><button class="favRowBtn" onclick="event.stopPropagation();vibe(25);soundCopy();copyText(${JSON.stringify(e.pass||'')});toast('Contraseña copiada')">🔑</button></div>`;
    grid.appendChild(row);
  });
}
function quick(id){let e=vault.find(x=>x.id===id);if(!e)return;e.used=Date.now();persist();current=e;let ic=iconForEntry(e);const u=userFromEntry(e);const em=legacyEmailFromEntry(e);

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
h+='<div style="font-size:26px;font-weight:950;color:#fff;letter-spacing:-.5px;margin-bottom:8px">'+esc(e.service)+'</div>';
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
  function isShieldVK94(v){return !v || !v.svg || String(v.bg||'').toLowerCase()==='#061a33' || String(v.svg||'').includes('vk128shield');}
  function initialsVK94(label,id){
    const raw=String(label||id||'').replace(/\+/g,' plus').trim();
    const parts=raw.split(/\s+|\/|-/).filter(Boolean);
    let txt=parts.length>=2 ? (parts[0][0]+parts[1][0]) : raw.slice(0,3);
    txt=txt.replace(/[^a-zA-Z0-9+]/g,'').toUpperCase();
    return txt || 'VK';
  }
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
    const r=document.getElementById('glowRange');
    if(r){
      const pct=((v-60)/80)*100;
      r.style.setProperty('--fill',pct.toFixed(1)+'%');
      r.value=String(v);
    }
    const val=document.getElementById('glowValue'); if(val) val.textContent=v+'%';
  }


  document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{applyGlow103();paintSettingsIcons();},80));
  window.addEventListener('load',()=>setTimeout(()=>{applyGlow103();paintSettingsIcons();},180));
})();

(function(){
  const LS_SPLASH='vk_splash_v1';
  const lines=[
    'Iniciando cifrado AES-256...',
    'Generando clave segura...',
    'Aplicando PBKDF2 × 200.000...',
    'Protegiendo tu bóveda...',
    'Listo. Bóveda cifrada ✓'
  ];
  function runSplash(cb){
    const splash=$('vkSplash');
    const lineEl=$('vkSplashLine');
    const fillEl=$('vkSplashFill');
    if(!splash||!lineEl||!fillEl){cb();return;}
    splash.classList.add('vkSplashVisible');
    splash.style.opacity='1';
    let li=0;
    const totalMs=2800;
    const stepMs=totalMs/lines.length;
    let pct=0;
    const pctStep=100/lines.length;
    lineEl.textContent=lines[0];
    fillEl.style.width='0%';
    function nextLine(){
      if(li>=lines.length){
        setTimeout(()=>{
          splash.classList.add('vkSplashOut');
          setTimeout(()=>{
            hideSplashHard();
            cb();
          },520);
        },300);
        return;
      }
      lineEl.textContent=lines[li];
      pct=Math.min(100,(li+1)*pctStep);
      fillEl.style.width=pct+'%';
      li++;
      setTimeout(nextLine,stepMs);
    }
    setTimeout(nextLine,stepMs);
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
    if('serviceWorker'in navigator){
      navigator.serviceWorker.register('./sw.js').catch(()=>{});
      navigator.serviceWorker.addEventListener('message',e=>{
        if(e.data&&e.data.type==='SW_UPDATED'&&!unlocked)window.location.reload();
      });
    }
    if(!localStorage.getItem('vaultkey_onboarding_v130') || !localStorage.getItem('vk_meta_v1')){
      // Nuevo usuario: sin onboarding visto O sin PIN configurado → mostrar bienvenida
      localStorage.removeItem('vaultkey_onboarding_v130'); // limpiar flag si no hay PIN
      openOnboardingHard();
    } else {
      initPin();
      show('pin');
    }
  }

  window.addEventListener('load',()=>{
    const isNewUser = !localStorage.getItem('vk_meta_v1');
    const splashSeen = localStorage.getItem(LS_SPLASH);
    localStorage.setItem(LS_SPLASH,'1');
    if(!splashSeen){
      runSplash(bootApp);
    } else {
      bootApp();
    }
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
function rankIcon(ic){
  const order=['auto','bank','banco','bbva','santander','caixa','ing','banesco','mercantil','gmail','outlook','hotmail','yahoo','icloud','proton','google','facebook','instagram','whatsapp','telegram','youtube','netflix','amazon','paypal','spotify','tiktok','discord','github','linkedin','x','microsoft','apple','chatgpt','canva','notion','zoom','binance','coinbase','zelle','revolut','wise','wifi','cloud','safe'];
  const idx=order.indexOf(String(ic.id));
  return idx>=0?idx:999;
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

  function maybeOfferBioAfterRecovery(){
    try{
      if(!lastKey) return;
      if(localStorage.getItem(REC_SAVED)!=='1') return;
      if(!window.PublicKeyCredential) return;
      if(localStorage.getItem('vk_bio_cred_id')||localStorage.getItem('vk_bio_offer_dismissed')) return;
      setTimeout(async()=>{
        if(localStorage.getItem(REC_PENDING)==='1') return;
        const ok=await vkConfirm('Activar huella dactilar','¿Quieres usar tu huella para desbloquear VaultKey la próxima vez?');
        if(ok){await tryBioRegister(lastKey)} else {localStorage.setItem('vk_bio_offer_dismissed','1')}
      },650);
    }catch(e){}
  }

  window.showRecoveryCode=async function(first=false){
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
    maybeOfferBioAfterRecovery();
  };

  const oldUnlockOk=window.unlockOk;
  window.unlockOk=async function(p){
    let m=defaultSecurity(meta());
    if(m){m.failedAttempts=0;m.totalFailed=0;m.lockedUntil=0;m.lockLevel=0;m.lastOk=Date.now();saveMeta(m)}
    try{vibe([30,20,60]);soundPinOk()}catch(e){}
    lastKey=p;unlocked=true;pin='';renderDots();hidePrivacyOverlay();show('home');render();syncSettingsUI();resetAutoLockTimer();
    if(localStorage.getItem(REC_PENDING)==='1' || (localStorage.getItem(LS_REC)&&localStorage.getItem(REC_SAVED)!=='1')){
      setTimeout(()=>showRecoveryCode(true),120);
    }else{
      maybeOfferBioAfterRecovery();
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
        // Preservar metadatos existentes (respaldo, autoLock, etc.) si los hay
        const existingMeta=meta()||{};
        saveMeta({...existingMeta,hash:hp.hash,pinSalt:hp.salt,pinLen:getPinLen(),created:existingMeta.created||Date.now(),lastBackup:existingMeta.lastBackup||null,autoLockMs:existingMeta.autoLockMs||30000,failedAttempts:0,lockLevel:0,lockedUntil:0,lastOk:null,lastFail:null,autoWipe:existingMeta.autoWipe||false,totalFailed:0});
        // BUG1 FIX: Si ya había datos cifrados con otra clave (cambio de PIN),
        // re-cifrar la vault existente con el nuevo PIN en lugar de borrarla.
        const existingData=localStorage.getItem(LS_DATA);
        if(existingData && vault && vault.length>0){
          // vault ya está en memoria (cargada antes del cambio de PIN), re-cifrar con nuevo PIN
          await persist(typedPin);
        } else if(existingData && (!vault || vault.length===0)){
          // vault vacía en memoria pero hay datos — podría ser primer setup real
          vault=[];await persist(typedPin);
        } else {
          vault=[];await persist(typedPin);
        }
        const rec=makeRecoveryCode();
        const recEnc=await encryptRec(rec,typedPin);
        localStorage.setItem(LS_REC,JSON.stringify(recEnc));
        localStorage.removeItem(REC_SAVED);
        localStorage.setItem(REC_PENDING,'1');
        // Entramos a la bóveda solo para presentar el recovery como paso bloqueante. No se ofrece huella todavía.
        lastKey=typedPin;unlocked=true;pin='';renderDots();hidePrivacyOverlay();show('home');render();syncSettingsUI();resetAutoLockTimer();
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
