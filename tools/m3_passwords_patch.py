# m3_passwords_patch.py v2 — MODO PREVIEW (no escribe todavia)
# Módulo 3 · subbloque Contraseñas:
#   A. Adaptadores vk2Entry* antes de show()
#   B. Bloque de render L1684-1690 usa adaptadores
#   C. Rama VK2 en saveEntry() con closeModals()
import sys

CRLF = '\r\n'
js = open('app.js', 'rb').read().decode('utf-8')

# ── Guardarrailes previos ─────────────────────────────────────
if 'vk2EntryTitle' in js:
    sys.exit('ERROR: adaptadores ya existen')
if 'VK2 saveEntry' in js:
    sys.exit('ERROR: rama VK2 en saveEntry ya existe')

# ── Anclas ────────────────────────────────────────────────────
ANCHOR_SHOW = 'function show(id,dir){'
ANCHOR_RENDER = (
    "      service: String(e.service||'')," + CRLF +
    "      entryType: String(e.entryType||'password')," + CRLF +
    "      user: String(e.user||'')," + CRLF +
    "      email: String(e.email||'')," + CRLF +
    "      pass: String(e.pass||'')," + CRLF +
    "      url: String(e.url||'')," + CRLF +
    "      note: String(e.note||''),"
)
ANCHOR_SAVE = (
    'async function saveEntry(){' + CRLF +
    '  vibe([30,20,60]);soundSave();'
)

for label, anchor, t in [
    ('ANCHOR_SHOW',   ANCHOR_SHOW,   js),
    ('ANCHOR_RENDER', ANCHOR_RENDER, js),
    ('ANCHOR_SAVE',   ANCHOR_SAVE,   js),
]:
    if anchor not in t:
        sys.exit('ERROR: ancla ' + label + ' no encontrada')
    if t.count(anchor) != 1:
        sys.exit('ERROR: ancla ' + label + ' ambigua (' + str(t.count(anchor)) + ')')

# ════════════════════════════════════════════════════════════
# A — adaptadores antes de show()
# ════════════════════════════════════════════════════════════
adapters = (
    '// VK2 \u2014 adaptadores de display (M\u00f3dulo 3)' + CRLF +
    'function vk2EntryTitle(e){ return e.title||e.service||e.wifiSsid||\'\'; }' + CRLF +
    'function vk2EntryUser(e){  return e.username||e.user||e.email||\'\'; }' + CRLF +
    'function vk2EntryPass(e){  return e.password||e.pass||\'\'; }' + CRLF +
    'function vk2EntryNotes(e){ return e.notes||e.note||\'\'; }' + CRLF +
    'function vk2EntryUrl(e){   return e.url||\'\'; }' + CRLF
)
js = js.replace(ANCHOR_SHOW, adapters + ANCHOR_SHOW, 1)

# ════════════════════════════════════════════════════════════
# B — bloque de render L1684-1690 usa adaptadores
# ════════════════════════════════════════════════════════════
js = js.replace(ANCHOR_RENDER,
    "      service: vk2EntryTitle(e)," + CRLF +
    "      entryType: String(e.entryType||e.type||'password')," + CRLF +
    "      user: vk2EntryUser(e)," + CRLF +
    "      email: String(e.email||'')," + CRLF +
    "      pass: vk2EntryPass(e)," + CRLF +
    "      url: vk2EntryUrl(e)," + CRLF +
    "      note: vk2EntryNotes(e),",
    1)

# ════════════════════════════════════════════════════════════
# C — rama VK2 en saveEntry() con closeModals()
# ════════════════════════════════════════════════════════════
js = js.replace(ANCHOR_SAVE,
    'async function saveEntry(){' + CRLF +
    '  // VK2 saveEntry: objeto formato VK2 si hay b\u00f3veda 2.0' + CRLF +
    '  if(typeof vkStore!==\'undefined\'&&vkStore.hasVault()&&typeof vkModels!==\'undefined\'){' + CRLF +
    '    const _svc=($( \'eService\')?.value||\'\').trim();' + CRLF +
    '    const _usr=($( \'eUser\')?.value||$(\'eEmail\')?.value||\'\').trim();' + CRLF +
    '    const _pwd=($( \'ePass\')?.value||\'\');' + CRLF +
    '    const _url=($( \'eUrl\')?.value||\'\').trim();' + CRLF +
    '    const _note=$(\'eSecureNote\')?.value||\'\';' + CRLF +
    '    const entry=vkModels.create(\'password\',{' + CRLF +
    '      title:_svc, username:_usr, password:_pwd,' + CRLF +
    '      url:_url, notes:_note, subtype:\'web\'' + CRLF +
    '    });' + CRLF +
    '    vault.push(entry);' + CRLF +
    '    await persist();' + CRLF +
    '    vibe([30,20,60]);soundSave();' + CRLF +
    '    closeModals();render();' + CRLF +
    '    return;' + CRLF +
    '  }' + CRLF +
    '  vibe([30,20,60]);soundSave();',
    1)

# ── Guardarrailes post ────────────────────────────────────────
assert 'vk2EntryTitle' in js
assert 'VK2 saveEntry' in js
assert 'vk2EntryTitle(e)' in js   # render conectado
assert 'closeModals()' in js       # no closeEntryModal
assert 'closeEntryModal' not in js.split('VK2 saveEntry')[1][:500]

for r in ['window.handlePin=async function()','window.unlockOk=async function(p)',
          'async function encryptData(data,p)','await persist(typedPin)',
          'function finishOnboarding()']:
    if r not in js:
        sys.exit('ERROR: se perdio "' + r + '"')

# PREVIEW — no escribe
old = open('app.js','rb').read().decode('utf-8')
added   = [l for l in js.splitlines()   if l not in old.splitlines()]
removed = [l for l in old.splitlines()  if l not in js.splitlines()]
print(f'PREVIEW — {len(removed)} eliminadas, {len(added)} anadidas')
print()
print('ELIMINADAS:')
for l in removed: print('  -', repr(l))
print()
print('ANADIDAS:')
for l in added:   print('  +', repr(l))
print()
print('Para aplicar: descomenta la linea open() al final del script.')
open('app.js','wb').write(js.encode('utf-8'))