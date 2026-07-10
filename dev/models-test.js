/* ============================================================
   VaultKey 2.0 — dev/models-test.js
   Batería automática de la 1.8. Ejecutar: node dev/models-test.js
   HERRAMIENTA INTERNA — fuera del deploy. Sin datos reales.
   ============================================================ */
'use strict';

var vk = require('../models.js');
var pass = 0, fail = 0;

function t(name, cond) {
  if (cond) { pass++; console.log('  ✔ ' + name); }
  else { fail++; console.log('  ✘ FALLO: ' + name); }
}

console.log('== create ==');
var pw = vk.create('password', { title: 'Correo demo', username: 'demo', password: 'x1', url: 'https://ejemplo.test' });
t('password: id generado', typeof pw.id === 'string' && pw.id.length >= 32);
t('password: subtype por defecto web (decisión congelada)', pw.subtype === 'web');
t('password: fav false por defecto', pw.fav === false);
t('password: timestamps numéricos', typeof pw.createdAt === 'number' && pw.updatedAt === pw.createdAt);
t('password: passHistory array vacío', Array.isArray(pw.passHistory) && pw.passHistory.length === 0);

var nt = vk.create('note', { title: 'Nota demo', body: 'texto' });
t('note: body presente', nt.body === 'texto');

var cd = vk.create('card', { title: 'Tarjeta demo', holder: 'Demo', number: '0000', expiry: '12/30', cvv: '000' });
t('card: campos presentes', cd.holder === 'Demo' && cd.brand === '');

var dc = vk.create('document', { title: 'Documento demo', docType: 'pasaporte' });
t('document: docType respetado', dc.docType === 'pasaporte');
t('document: docType por defecto otro', vk.create('document', { title: 'x' }).docType === 'otro');

var ids = {};
for (var i = 0; i < 200; i++) { ids[vk.create('note', { title: 'n' }).id] = 1; }
t('ids únicos (200/200)', Object.keys(ids).length === 200);

var threw = false;
try { vk.create('perfil', {}); } catch (e) { threw = true; }
t('tipo desconocido lanza error', threw);

console.log('== validate ==');
t('password web válida', vk.validate(pw).ok);
t('note válida', vk.validate(nt).ok);
t('card válida', vk.validate(cd).ok);
t('document válida', vk.validate(dc).ok);

var bad = vk.create('password', { title: 'X', password: 'p' }); bad.subtype = 'passkey';
t('subtype inválido rechazado', !vk.validate(bad).ok);

var noTitle = vk.create('note', { title: '   ', body: 'b' });
t('title vacío rechazado', !vk.validate(noTitle).ok);

var noPass = vk.create('password', { title: 'X', subtype: 'wifi' });
t('wifi sin password rechazada', !vk.validate(noPass).ok);

var rec = vk.create('password', { title: 'Códigos', subtype: 'recovery', codes: 'AAA-BBB\nCCC-DDD' });
t('recovery con codes válida', vk.validate(rec).ok);
var recBad = vk.create('password', { title: 'Códigos', subtype: 'recovery' });
t('recovery sin codes rechazada', !vk.validate(recBad).ok);

var badDoc = vk.create('document', { title: 'X' }); badDoc.docType = 'contrato';
t('docType fuera de UX-012 rechazado', !vk.validate(badDoc).ok);

var badFav = vk.create('note', { title: 'X', body: '' }); badFav.fav = 'si';
t('fav no booleano rechazado', !vk.validate(badFav).ok);

console.log('== serialize / deserialize ==');
var lote = [pw, nt, cd, dc, rec];
var json = vk.serialize(lote);
var out = vk.deserialize(json);
t('round-trip ok', out.ok && out.entries.length === 5);
t('round-trip conserva ids', out.entries[0].id === pw.id && out.entries[4].id === rec.id);
t('schemaVersion presente', JSON.parse(json).schemaVersion === 2);
t('wrapper app presente', JSON.parse(json).app === 'VaultKey');

var conBasura = JSON.parse(json);
conBasura.entries[0].campoMalicioso = 'inyectado';
conBasura.entries[0].__proto__x = 'x';
var limpio = vk.deserialize(JSON.stringify(conBasura));
t('campos desconocidos descartados', limpio.ok && !('campoMalicioso' in limpio.entries[0]));

var v1 = JSON.stringify({ app: 'VaultKey', version: 1, payload: {} });
t('blob 1.x (version:1) rechazado con error claro', !vk.deserialize(v1).ok);
t('JSON corrupto rechazado sin excepción', !vk.deserialize('{{{').ok);

var mixto = JSON.parse(json);
mixto.entries.push({ type: 'password', title: '' }); /* inválida */
var mres = vk.deserialize(JSON.stringify(mixto));
t('lote mixto: válidas pasan, inválida reporta error', mres.entries.length === 5 && mres.errors.length === 1 && !mres.ok);

console.log('== favorites ==');
pw.fav = true; dc.fav = true;
var favs = vk.favorites(lote);
t('favoritos filtra fav === true', favs.length === 2 && favs.indexOf(pw) !== -1 && favs.indexOf(dc) !== -1);
t('favoritos con entrada no-array devuelve []', Array.isArray(vk.favorites(null)) && vk.favorites(null).length === 0);


console.log('== ajustes checkpoint Figma (08-07) ==');
var dc2 = vk.create('document', { title: 'Pasaporte', docType: 'pasaporte', issuer: 'Ministerio', country: 'España' });
t('document: issuer y country presentes', dc2.issuer === 'Ministerio' && dc2.country === 'España');
t('document con issuer/country válido', vk.validate(dc2).ok);
var dcOld = JSON.parse(JSON.stringify(dc2)); delete dcOld.issuer; delete dcOld.country;
t('document sin issuer/country (esquema previo) sigue válido', vk.validate(dcOld).ok);
var dcBadI = vk.create('document', { title: 'X' }); dcBadI.issuer = 123;
t('document con issuer no-string rechazado', !vk.validate(dcBadI).ok);
var cdNoTitle = vk.create('card', { holder: 'Demo', number: '4111', expiry: '12/30', cvv: '123' });
t('card sin title es válida (Figma no muestra título)', vk.validate(cdNoTitle).ok);
var ntNoTitle = vk.create('note', { body: 'x' });
t('note sin title sigue siendo inválida', !vk.validate(ntNoTitle).ok);
var cdParcial = JSON.parse(JSON.stringify(cdNoTitle)); delete cdParcial.brand;
t('card sin campo opcional brand sigue válida', vk.validate(cdParcial).ok);
var rt = vk.deserialize(vk.serialize([dc2, cdNoTitle]));
t('round-trip con campos nuevos ok', rt.ok && rt.entries[0].country === 'España');
var dcH = vk.create('document', { title: 'DNI', docType: 'dni', holder: 'Nombre del titular' });
t('document.holder presente y respetado', dcH.holder === 'Nombre del titular');
t('document.holder default vacío', vk.create('document', { title: 'x' }).holder === '');
var dcHold = JSON.parse(JSON.stringify(dcH)); delete dcHold.holder;
t('document sin holder sigue válido (opcional)', vk.validate(dcHold).ok);
var dcHBad = vk.create('document', { title: 'x' }); dcHBad.holder = 99;
t('document.holder no-string rechazado', !vk.validate(dcHBad).ok);
var rtH = vk.deserialize(vk.serialize([dcH]));
t('round-trip conserva holder', rtH.ok && rtH.entries[0].holder === 'Nombre del titular');
t('schemaVersion sigue en 2', vk.SCHEMA_VERSION === 2);

console.log('');
console.log('Resultado: ' + pass + ' correctas, ' + fail + ' fallos');
process.exit(fail === 0 ? 0 : 1);
