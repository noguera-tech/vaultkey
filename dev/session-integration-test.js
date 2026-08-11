'use strict';

const fs=require('fs');
const path=require('path');

const root=path.resolve(__dirname,'..');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const appHtml=fs.readFileSync(path.join(root,'app.html'),'utf8');
const sessionSource=fs.readFileSync(path.join(root,'session.js'),'utf8');
const vkSession=require(path.join(root,'session.js'));

function expect(condition,message){
  if(!condition){
    console.error('FALLO:',message);
    process.exitCode=1;
  }
}

const fakeKey={type:'secret',extractable:false};
const fakeStore={
  getMeta:()=>({autolockOption:'immediate'}),
  setMeta:()=>{}
};

expect(/manageLifecycle\s*=\s*opts\.manageLifecycle\s*!==\s*false/.test(sessionSource),
  'La sesión debe admitir que la aplicación gestione el ciclo de vida.');
expect(/manageLifecycle:false/.test(app),
  'La integración debe desactivar los listeners duplicados de session.js.');
expect(!/window\.resetAutoLockTimer\s*=\s*function\(\)\s*\{\s*if\(isVK2Vault\(\)\)\s*return/.test(appHtml),
  'VK2 no debe anular el temporizador único gestionado por app.js.');
expect(!/removeEventListener\(["']visibilitychange["'],\s*legacyHandleVisibilityChange\)/.test(appHtml),
  'VK2 no debe retirar el controlador único de visibilitychange de app.js.');
expect(/vkSession\.setAutolockOption\(option\)[\s\S]*?legacyResetAutoLockTimer\(\)/.test(appHtml),
  'Al cambiar la opción VK2 debe reiniciarse el temporizador único de app.js.');

vkSession.start({dekKey:fakeKey,store:fakeStore,router:{replace:()=>{}},manageLifecycle:false});
expect(vkSession.isActive(),'La sesión debe conservar la clave mientras la aplicación está visible.');
expect(vkSession.setAutolockOption('30s'),'Debe poder actualizarse la opción sin instalar listeners duplicados.');
vkSession.stop();
expect(!vkSession.isActive(),'El bloqueo de la aplicación debe retirar la clave de sesión.');

expect(/function lockForBackground\(\)[\s\S]*?vkSession\.stop\(\)[\s\S]*?closeModals\(\)/.test(app),
  'El bloqueo en segundo plano debe limpiar clave, temporizadores y modales una sola vez.');
expect(/function startBackgroundAutoLock\(\)[\s\S]*?hiddenSince===null[\s\S]*?Date\.now\(\)-hiddenSince[\s\S]*?lockForBackground\(\)/.test(app),
  'La salida debe registrar la hora real y retirar la sesión al vencer el plazo.');
expect(/addEventListener\('blur',[\s\S]*?startBackgroundAutoLock\(\)/.test(app),
  'blur debe actuar como respaldo cuando la TWA no emite visibilitychange.');
expect(/if\(document\.hidden\)[\s\S]*?startBackgroundAutoLock\(\)/.test(app),
  'visibilitychange debe compartir el mismo controlador de salida que blur.');
expect(/pagehide[^\n]*showPrivacyOverlay\(\);lockForBackground\(\)/.test(app),
  'pagehide debe ocultar primero la bóveda y después limpiar la sesión.');
expect(/\['pointerdown','keydown','input','scroll'\]/.test(app),
  'La actividad no debe procesar touchstart y click además de pointerdown.');
expect(!/\['pointerdown','touchstart','keydown','input','scroll','click'\]/.test(app),
  'No debe quedar la lista antigua de eventos duplicados.');

if(!process.exitCode){
  console.log('OK: ciclo de salida y regreso usa un único controlador seguro');
}
