const fs=require('fs');
const path=require('path');

const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'app.html'),'utf8');
const js=fs.readFileSync(path.join(root,'app.js'),'utf8');
const css=fs.readFileSync(path.join(root,'components.css'),'utf8');

function expect(condition,message){
  if(!condition){
    console.error('FALLO:',message);
    process.exitCode=1;
  }
}

expect(
  /id="passwordEditCurrentSecret"[\s\S]*?readonly/.test(html),
  'La contraseña actual debe mostrarse en un campo de solo lectura.'
);
expect(
  /id="passwordEditNewSecret"/.test(html),
  'Debe existir un campo separado para la nueva contraseña.'
);
expect(
  /openGen\(true,'passwordEditNewSecret'\)/.test(html),
  'La varita debe abrir el generador para el campo de nueva contraseña.'
);
expect(
  /fieldId==='passwordEditNewSecret'/.test(js),
  'El generador debe poder devolver su resultado a Editar contraseña.'
);
expect(
  /const secret=newSecret\|\|oldSecret;/.test(js),
  'Dejar la nueva contraseña vacía debe conservar la contraseña actual.'
);
expect(
  /if\(oldSecret&&oldSecret!==secret\)/.test(js),
  'Solo un cambio real de contraseña debe incorporarse al historial.'
);
expect(
  /hasOwnProperty\.call\(next,'wifiPass'\)[\s\S]*?next\.wifiPass=secret;/.test(js),
  'La edición debe conservar compatibilidad con contraseñas Wi-Fi.'
);
expect(
  !/passwordEditName|passwordEditSecret|passwordEditEyeOpen|passwordEditEyeOff/.test(html+js),
  'No deben quedar referencias a los controles antiguos eliminados.'
);
expect(
  /\.vk-password-edit-content\s*\{[\s\S]*?overflow-y:\s*hidden;/.test(css),
  'La pantalla no debe desplazarse con altura normal.'
);
expect(
  /@media \(max-height:\s*640px\)[\s\S]*?\.vk-password-edit-content\s*\{[\s\S]*?overflow-y:\s*auto;/.test(css),
  'La pantalla debe permitir desplazamiento cuando el teclado reduzca la altura.'
);

if(!process.exitCode){
  console.log('OK: Editar contraseña y generador están integrados correctamente');
}
