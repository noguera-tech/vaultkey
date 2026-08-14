# Relación lógica con la base web

## Origen

- Repositorio: `noguera-tech/vaultkey`.
- Commit web de referencia: `785985817cd93d2a72261357bd7cda4411bfb915`.
- Rama local observada: `refactor/unify-appbar-family-a`.
- `main` conocido durante la auditoría: `dbf10ba61606499f7b1c541f2f2750d7edbbc552`.

La relación se conserva documentalmente y mediante hashes. No se usó 7859858 como padre Git del repositorio Android porque el checkpoint fue construido mediante copia manual de activos y su árbol raíz representa otra arquitectura.

## Activos coincidentes con 7859858

La auditoría encontró coincidencia byte a byte en la mayoría de los activos web, incluidos:

- Los tres CSS Android/safe-area.
- `drive.js` y `csp-base.css`.
- `components.js`.
- Módulos de bóveda, backup, adjuntos y criptografía.
- Iconos e identidad visual.

## Activos divergentes en el checkpoint validado

El checkpoint contiene ajustes posteriores o específicos de Android/WebView en:

- `app.html`
- `app.js`
- `components.css`
- `csp-overrides.css`
- `onboarding.js`
- `style.css`
- `unlock.js`

`build-info.json` y las copias `.bak` eran metadatos o auxiliares locales, no fuente web canónica.

## Regla de integración futura

Cualquier integración con el repositorio web debe partir de 7859858, reconstruir explícitamente las diferencias anteriores y revisar cada cambio. No se debe sustituir en bloque la fuente validada por `main`, por el candidato anterior ni por el proyecto TWA.

