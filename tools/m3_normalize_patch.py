from pathlib import Path

p = Path("app.js")
s = p.read_text(encoding="utf-8")

old1 = """function vk2EntryUrl(e){   return e.url||''; }"""

new1 = """function vk2EntryUrl(e){   return e.url||''; }

function normalizeVK2Entry(e){
  if(!e || typeof e!=='object') return e;

  return Object.assign({}, e, {
    service: e.service || e.title || e.wifiSsid || '',
    user: e.user || e.username || e.email || '',
    pass: e.pass || e.password || '',
    note: e.note || e.notes || '',
    url: e.url || ''
  });
}"""

old2 = """vault=Array.isArray(_pl.entries)?_pl.entries:[];"""

new2 = """vault=Array.isArray(_pl.entries)
        ? _pl.entries.map(normalizeVK2Entry)
        : [];"""

changes = []

if old1 in s:
    changes.append(("ADAPTADOR", new1))
else:
    print("NO encontrado adaptador VK2")

if old2 in s:
    changes.append(("CARGA VAULT", new2))
else:
    print("NO encontrada carga vault")

print("PREVIEW — NO ESCRITO")
print("Cambios:", len(changes))

for name, txt in changes:
    print("\n+", name)
    print(txt)