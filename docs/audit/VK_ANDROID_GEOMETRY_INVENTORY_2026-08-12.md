# VaultKey — Inventario geométrico Android/WebView

Fecha: 2026-08-12
Rama: `fix/android-header-safe-area`
Estado: EN CURSO

Este documento complementa `VK_ANDROID_VISUAL_AUDIT_2026-08-12.md` y concentra únicamente geometría de viewport, cabeceras, contenido, scroll, acciones inferiores, modales y sheets.

## 1. Patrón crítico: pantalla 100dvh + cabecera fija + contenido restado

Se han confirmado varias pantallas que usan el patrón:

- raíz `height:100dvh; overflow:hidden`;
- cabecera de altura fija;
- contenido con `height:calc(100dvh - <altura cabecera>)`;
- safe-area inferior aplicada dentro del contenido;
- safe-area superior no incluida en la resta.

Pantallas confirmadas:

### Autobloqueo
- Cabecera: 64 px (`.vk-auto-header`).
- Contenido: `height:calc(100dvh - 64px)`.
- Contenido: `overflow:hidden`.
- Safe-area inferior: sí.
- Safe-area superior: no.

### Kit de emergencia
- Cabecera: 64 px (`.vk-kit-header`).
- Contenido: `height:calc(100dvh - 64px)`.
- Contenido: `overflow:hidden`.
- Safe-area inferior: sí.
- Safe-area superior: no.

### Cambiar PIN
- Cabecera: 64 px (`.vk-pin-header`).
- Contenido: `height:calc(100dvh - 64px)`.
- Contenido: `overflow:hidden`.
- Botón guardar anclado mediante `margin:auto auto 0`.
- Safe-area inferior: sí.
- Safe-area superior: no.

### Cambiar contraseña maestra
- Cabecera: 62 px (`.vk-master-header`).
- Contenido: `height:calc(100dvh - 62px)`.
- Contenido: `overflow:hidden`.
- Acciones inferiores ancladas con `margin-top:auto`.
- Existe media query que reduce alturas/márgenes en pantallas bajas.
- Safe-area inferior: sí.
- Safe-area superior: no.

## 2. Consecuencia arquitectónica

Estas pantallas NO pueden corregirse añadiendo únicamente `padding-top: env(safe-area-inset-top)` a la cabecera.

Si la cabecera total pasa, por ejemplo, de 64 a `64 + inset-top` pero el contenido continúa midiendo `100dvh - 64`, la suma cabecera + contenido supera el viewport visual. El resultado esperado es uno o varios de estos defectos:

- recorte inferior;
- scroll residual;
- botones inferiores desplazados o inaccesibles;
- contenido oculto por `overflow:hidden`;
- compresión inesperada en layouts flex.

Regla de migración para esta familia:

1. La altura visual existente se conserva.
2. La cabecera total suma `safe-area-inset-top`.
3. El contenido debe pasar preferentemente a `flex:1; min-height:0`.
4. Si se mantiene una resta explícita, debe usar la misma altura total de cabecera.
5. La safe-area inferior se conserva una sola vez.

## 3. Riesgo por `overflow:hidden`

Las cuatro pantallas anteriores usan `overflow:hidden` en la zona principal o raíz. Esto eleva su prioridad de prueba física porque un error de pocos píxeles no se manifiesta necesariamente como scrollbar: puede cortar contenido silenciosamente.

Prioridad de validación:

- P0: Cambiar PIN / Cambiar contraseña maestra (acciones de guardado al fondo).
- P1: Kit de emergencia (tarjeta fija + acciones).
- P1: Autobloqueo (lista de opciones fija en altura).

## 4. Familias de formularios ya auditadas

### Notas
- Cabecera de editor: 64 px.
- Acciones: `margin-top:auto`, dos botones de 48 px.
- Requiere prueba de safe-area superior + acciones inferiores.

### Tarjetas
- Cabecera de editor: 64 px.
- Acciones: `margin-top:auto`, `padding-top:16px`, dos botones de 48 px.
- Requiere prueba con teclado y campos largos.

### Documentos
- Cabecera de editor: 64 px.
- Formularios: `flex:1; min-height:0; overflow-y:auto`.
- Padding inferior fijo de 28 px.
- Acciones: `margin-top:auto; padding-top:18px`.
- Mejor base estructural que las pantallas de seguridad, pero el padding inferior debe armonizarse con safe-area.

## 5. Sistemas de overlay confirmados

### Legacy `.modal > .sheet`
Ejemplos: URL, nota, quick modal, recuperación, onboarding histórico.

Problemas:
- alturas inline (`50dvh`, `60dvh`, fullscreen `100dvh`);
- geometría distribuida entre HTML inline y CSS;
- difícil centralización;
- iconografía emoji en algunos casos.

### Componentes `.vk-sheet` / `.vk-dialog`
Problema confirmado:
- `.vk-sheet__panel` usa `max-height:85vh` y padding inferior fijo de 24 px;
- no incorpora safe-area inferior en el contrato base.

### Documentos / Generador
- `.vk-document-source-sheet` usa geometría propia.
- `.vk-generator-sheet` usa `max-height:92dvh` y cuerpo scrollable separado.
- La corrección ya validada del generador demuestra que scroll siempre activo no es deseable cuando el contenido compacto cabe.

## 6. Contrato objetivo para overlays

Todo overlay que sobreviva a la fase de normalización debe cumplir:

- viewport dinámico (`dvh`) donde proceda;
- panel con `max-height` coherente;
- cuerpo scrollable separado de acciones;
- acciones siempre visibles y accesibles;
- safe-area inferior aplicada exactamente una vez;
- sin scroll residual cuando el contenido cabe;
- sin estilos inline geométricos salvo excepción documentada;
- cabeceras internas de modal excluidas de la safe-area superior de pantalla completa.

## 7. Primer lote de representantes para APK estructural

La primera APK de prueba de arquitectura debe cubrir al menos:

1. Familia A: Contraseñas lista (`vk-section-header`, 64 px).
2. Familia B: Editar contraseña (56 px, formulario y acciones inferiores).
3. Familia C: Nota editar o Documento editar (64 px, contenido scrollable/form-actions).
4. Familia D-64: Cambiar PIN o Kit de emergencia (`100dvh - 64px`).
5. Familia D-no64: Cambiar contraseña maestra (62 px) y Notificaciones (74 px).
6. Overlay: Generador normal/avanzado.
7. Overlay legacy: un modal de confirmación/restauración.

No se generalizará la arquitectura al resto hasta que estos representantes queden correctos en dispositivo físico.

## 8. Criterio de aceptación geométrica

Para cada representante:

- ningún icono bajo la barra de estado;
- altura visual original conservada dentro de la AppBar;
- ausencia de scroll en pantallas que caben completas;
- scroll únicamente en el contenedor que lo necesita;
- botones inferiores completos;
- teclado no tapa el campo activo ni acciones necesarias;
- navegación inferior/safe-area no toca botones;
- no aparece una franja vacía artificial por aplicar el inset dos veces;
- layout correcto con opciones avanzadas/expandibles abiertas y cerradas.
