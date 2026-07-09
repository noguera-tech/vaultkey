# Inventario de código obsoleto — VaultKey PWA

Fecha: 09/07/2026
Módulo: 1 — Base de proyecto
Tarea: 1.7 — Inventario de código obsoleto PWA

## Biometría web residual

Se localizan referencias residuales a biometría web en app.js:

- 6 referencias LS_BIO_*
- Función maybeOfferBioAfterRecovery()
- Definida aproximadamente en app.js línea 3177
- Invocada aproximadamente en app.js líneas 3213 y 3228

Estas referencias quedan marcadas como candidatas a revisión/borrado en la tarea 2.4.

No se elimina código en este commit.

## Comentarios de versión antigua

Se localizan 2 comentarios antiguos tipo V1 / BUG FIX en app.js.

Quedan inventariados para revisión posterior.

## Regla de este commit

Este commit solo documenta el inventario.
No modifica app.js.
No modifica drive.js.
No cambia comportamiento.
No toca cifrado, PIN, KDF, bridge JS↔Java, WebView sensible ni migración.
