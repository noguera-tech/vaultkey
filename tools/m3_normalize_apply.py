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

if old1 not in s:
    raise SystemExit("ERROR: no encontrado adaptador")

if old2 not in s:
    raise SystemExit("ERROR: no encontrada carga vault")

s = s.replace(old1, new1)
s = s.replace(old2, new2)

p.write_text(s, encoding="utf-8")

print("OK — parche M3 normalize aplicado")