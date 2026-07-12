import sys

p = 'app.js'

js = open(p,'rb').read().decode('utf-8')

anchor = "function row(e){"

if "service: e.service || e.title" in js:
    sys.exit("ERROR: parche row ya aplicado")

if anchor not in js:
    sys.exit("ERROR: ancla row() no encontrada")

insert = (
"function row(e){\n"
"  e = Object.assign({}, e, {\n"
"    service: e.service || e.title || '',\n"
"    user: e.user || e.username || e.email || '',\n"
"    pass: e.pass || e.password || '',\n"
"    entryType: e.entryType || e.type || 'password'\n"
"  });\n"
)

new = js.replace(anchor, insert, 1)

old_lines = js.splitlines()
new_lines = new.splitlines()

added=[x for x in new_lines if x not in old_lines]
removed=[x for x in old_lines if x not in new_lines]

print("PREVIEW — NO ESCRITO")
print("Eliminadas:",len(removed))
print("Añadidas:",len(added))
print()
print("AÑADIDAS:")
for x in added:
    print("+",x)

open(p,'wb').write(new.encode('utf-8'))