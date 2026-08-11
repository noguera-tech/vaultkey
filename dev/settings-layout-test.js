const fs=require('fs');
const path=require('path');

const root=path.resolve(__dirname,'..');
const css=fs.readFileSync(path.join(root,'style.css'),'utf8');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');

function expect(pattern,message,source=css){
  if(!pattern.test(source)){
    console.error('FALLO:',message);
    process.exitCode=1;
  }
}

expect(
  /#settings \.vk-settings-content\s*\{[\s\S]*?overflow-y:\s*hidden;/,
  'Ajustes debe impedir el scroll vertical residual.'
);
expect(
  /CACHE_VERSION\s*=\s*54\s*;/,
  'La caché debe renovarse para entregar la corrección a las instalaciones existentes.',
  sw
);
expect(
  /#settings \.vk-settings-content\s*\{[\s\S]*?calc\(12px \+ env\(safe-area-inset-bottom, 0px\)\)/,
  'Ajustes debe reservar solo la zona segura inferior real.'
);
expect(
  /#settings \.vk-settings-version\s*\{[\s\S]*?transform:\s*none;/,
  'La versión debe permanecer dentro del espacio disponible.'
);

if(!process.exitCode)console.log('OK: Ajustes no genera scroll vertical residual');
