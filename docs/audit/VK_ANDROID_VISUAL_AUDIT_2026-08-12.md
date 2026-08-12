# VaultKey — Auditoría visual completa Android/WebView

Fecha: 2026-08-12
Rama de trabajo: `fix/android-header-safe-area`
Estado: EN CURSO — no integrar en `main` hasta completar inventario, correcciones por causa raíz y validación física.

## Objetivo

Cerrar de forma sistemática los problemas de pulido visual introducidos o expuestos por la migración a Android/WebView, evitando correcciones pantalla por pantalla cuando exista una causa raíz común.

La auditoría toma como fuentes de verdad:

1. `docs/design-system/VAULTKEY_VISUAL_MASTER_v1.0.md`
2. `docs/design-system/VAULTKEY_COMPONENT_CATALOG.md`
3. `docs/design-system/VAULTKEY_VISUAL_CHECKLIST.md`
4. Código real de `app.html`, `components.css`, `style.css`, `csp-base.css`, `csp-overrides.css`
5. Validación física en el prototipo Android/WebView

## Hallazgos estructurales iniciales

### H-01 — Cabeceras fragmentadas

`app.html` contiene múltiples familias de cabecera distintas. Solo una parte de las pantallas principales usa la clase compartida `vk-section-header`. Existen además familias propias, entre otras:

- `vk-header`
- `vk-password-detail-header`
- `vk-password-edit-header`
- `vk-password-create-topbar`
- `vk-note-editor-topbar`
- `vk-card-editor-topbar`
- `vk-document-editor-topbar`
- `vk-document-modal-header`
- `vk-master-header`
- `vk-pin-header`
- `vk-kit-header`
- `vk-danger-header`
- `vk-info-header`
- `vk-notif-header`
- `vk-interaction-header`
- `vk-drive-header`
- `vk-auto-header`

Esto explica por qué una corrección de `vk-section-header` arregla solo una parte de la aplicación.

### H-02 — Safe area superior no centralizada

La prueba física en Android confirma que añadir `env(safe-area-inset-top)` a `vk-section-header` hace crecer correctamente la cabecera y evita que los iconos queden bajo la barra de estado. La solución funciona, pero actualmente solo alcanza a las pantallas que usan esa clase.

Decisión provisional: no replicar el mismo parche en 15+ selectores de forma aislada. Primero definir una abstracción común para AppBar/safe-area y clasificar excepciones.

### H-03 — El catálogo visual ya reconoce variantes de AppBar

El catálogo documenta alturas distintas observadas (64 px y 75 px) y deja la altura única de AppBar como pendiente. Por tanto, la auditoría no debe imponer una altura arbitraria global. La safe-area debe sumarse a la altura visual que corresponda a cada variante, no sustituirla.

### H-04 — Divergencia web ↔ prototipo Android

Durante la sesión se verificó que la capa web embebida en `VaultKey_WEBVIEW_PROTOTYPE` no era idéntica a `main`. La auditoría debe distinguir:

- diferencias deliberadas del wrapper Android/WebView;
- divergencias accidentales;
- cambios ya integrados en `main` que todavía no estén embebidos en el prototipo.

No se considerará cerrada la auditoría mientras no exista una reconciliación reproducible entre ambas capas.

## Familias de pantalla detectadas en `app.html`

### Raíz / dashboard
- PIN
- Dashboard/Home

### Contraseñas
- Lista
- Detalle
- Editar
- Crear

### Notas
- Lista
- Detalle
- Crear
- Editar

### Tarjetas
- Lista
- Detalle
- Crear
- Editar

### Documentos
- Lista
- Selector/tipo
- Vista previa
- Crear
- Detalle
- Editar

### Favoritos y Ajustes
- Favoritos
- Ajustes
- Seguridad
- Cambio de contraseña maestra
- Cambio de PIN
- Kit de emergencia
- Zona de peligro
- Información
- Notificaciones
- Interacción
- Google Drive
- Copia local
- Autobloqueo

## Matriz de auditoría obligatoria

Cada familia/pantalla debe revisarse en estos ejes antes de aprobarla:

1. Safe area superior e inferior.
2. AppBar/encabezado: altura visual, alineación, zona táctil e iconos.
3. Scroll: solo cuando el contenido realmente lo requiera.
4. Acciones inferiores: nunca cortadas por navegación/safe area.
5. Teclado: `interactive-widget`, resize y campos visibles.
6. Bottom sheets y diálogos: altura, overflow, botones y fondo.
7. Márgenes laterales y verticales según sistema visual.
8. Fondo/degradado y superficies.
9. Tipografía y títulos.
10. Botones, inputs, tarjetas y radios según catálogo.
11. Iconografía y tamaños táctiles.
12. Orientación/viewport y alturas pequeñas.
13. Web vs Android/WebView: diferencias deliberadas documentadas.
14. Navegación/atrás Android.
15. Regresión funcional: no tocar cripto, storage, sesión, PIN/master/kit/Drive salvo que el hallazgo lo requiera explícitamente.

## Estrategia de corrección

### Fase A — Inventario y clasificación

- Enumerar todas las pantallas, overlays, modales y bottom sheets.
- Mapear cada una a una familia de componentes.
- Localizar CSS duplicado y reglas tardías/overrides.
- Identificar causas raíz comunes.

### Fase B — Normalización de infraestructura visual

- Crear una abstracción común de AppBar Android-safe-area.
- Normalizar contenedores scrollables y acciones inferiores.
- Centralizar reglas de bottom sheet/modal donde sea posible.
- Mantener variantes documentadas (64/75 px u otras confirmadas), sin inventar valores.

### Fase C — Auditoría pantalla por pantalla

Usar `VAULTKEY_VISUAL_CHECKLIST.md` como control de aceptación, pero corregir por familia para evitar repetir trabajo.

### Fase D — Reconciliación Android/Web

- Comparar hashes y diffs de la capa web.
- Documentar diferencias específicas del wrapper Android.
- Definir procedimiento reproducible de actualización de assets web en el prototipo.

### Fase E — APK de auditoría final

Pasada física completa en dispositivo Android con datos ficticios, incluyendo alturas normales y pequeñas, teclado, scroll, modales, navegación, bloqueo y capturas protegidas.

## Correcciones ya verificadas durante esta sesión

- Generador normal: sin scroll residual.
- Generador avanzado: scroll activo y acceso visible.
- Botones `Cancelar / Usar`: visibles completos.
- Editar contraseña: acciones inferiores ajustadas.
- Safe-area en `vk-section-header`: prueba física positiva; pendiente generalizar correctamente al resto de familias.

## Regla de cierre

No se marcará una familia como terminada por una sola pantalla correcta. Deben quedar cubiertas todas sus variantes y documentadas las excepciones. No se hará merge del bloque global de safe-area hasta terminar el inventario y validar la arquitectura común en el prototipo Android.
