'use strict';

const fs=require('fs');
const path=require('path');

const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'app.html'),'utf8');
const css=fs.readFileSync(path.join(root,'components.css'),'utf8');
const style=fs.readFileSync(path.join(root,'style.css'),'utf8');
const overrides=fs.readFileSync(path.join(root,'csp-overrides.css'),'utf8');

function expect(condition,message){
  if(!condition){
    console.error('FALLO:',message);
    process.exitCode=1;
  }
}

function screen(id,nextId){
  const start=html.indexOf(`<section id="${id}"`);
  const end=nextId?html.indexOf(`<section id="${nextId}"`,start):html.indexOf('</section>',start)+10;
  return html.slice(start,end);
}

const security=screen('securitySettings','masterPasswordSettings');
const settings=screen('settings','securitySettings');
const favorites=screen('fav','settings');

expect((html.match(/vk-section-header/g)||[]).length===7,
  'Las siete cabeceras principales deben usar el mismo contrato visual.');
expect(/aria-label="Favoritos"/.test(security),
  'Seguridad debe conservar el acceso a Favoritos.');
expect(!/aria-current="page"/.test(settings),
  'Ajustes no debe repetir un engranaje inactivo para la pantalla actual.');
expect(/aria-label="Favoritos"/.test(settings)&&/aria-label="Ajustes"/.test(favorites),
  'Ajustes y Favoritos deben enlazarse mutuamente con una sola acción.');

for(const id of ['passwords','notes','cards','documents']){
  const markup=screen(id);
  expect(/aria-label="Favoritos"/.test(markup)&&/aria-label="Ajustes"/.test(markup),
    `${id} debe conservar los accesos generales a Favoritos y Ajustes.`);
}

expect(/\.vk-section-header\s*\{[\s\S]*?height:\s*64px\s*!important;/.test(css),
  'Las cabeceras deben medir 64 px.');
expect(/\.vk-section-header \.vk-note-back,[\s\S]*?width:\s*48px\s*!important;[\s\S]*?height:\s*48px\s*!important;/.test(css),
  'Las acciones deben tener una zona táctil de 48 px.');
expect(/\.vk-section-header \.vk-note-back svg,[\s\S]*?width:\s*24px\s*!important;[\s\S]*?height:\s*24px\s*!important;/.test(css),
  'Los glifos visibles deben medir 24 px.');
expect(/\.vk-section-header\s*\{[\s\S]*?height:\s*calc\(64px \+ env\(safe-area-inset-top,\s*0px\)\)\s*!important;[\s\S]*?min-height:\s*calc\(64px \+ env\(safe-area-inset-top,\s*0px\)\)\s*!important;/.test(overrides),
  'Las cabeceras principales deben conservar la safe-area superior de Android.');

if(!process.exitCode){
  console.log('OK: cabeceras y accesos superiores siguen una regla visual única');
}
