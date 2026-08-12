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

## Hallazgos estructurales

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

### H-05 — Hay más de un sistema de AppBar activo

La base compartida de `components.css` define:

- `.vk-header` con altura 56 px;
- `.vk-appbar` con altura 56 px.

Pero otras familias declaran su propia geometría en reglas posteriores. Ejemplos confirmados en el código actual:

- `vk-password-detail-header`: 56 px;
- `vk-password-edit-header`: 56 px;
- `vk-password-create-topbar`: 56 px;
- `vk-master-header`: 62 px;
- `vk-pin-header`: 64 px;
- `vk-kit-header`: 64 px;
- `vk-danger-header`: 64 px;
- `vk-info-header`: 64 px;
- `vk-drive-header`: 64 px;
- `vk-interaction-header`: 72 px;
- `vk-notif-header`: 74 px.

Por tanto, el problema no es únicamente “falta safe-area”: la implementación ha acumulado varias familias con alturas y reglas independientes. La solución debe preservar la altura visual documentada por familia y añadir una capa común de insets, en lugar de reemplazar toda la geometría por un único valor.

### H-06 — La altura del contenido depende de la altura del header en múltiples pantallas

Varias pantallas calculan su zona de contenido con expresiones como `height: calc(100dvh - 64px)` o equivalentes. Ejemplos confirmados: Zona de peligro, Información, Drive, cambio de PIN y cambio de contraseña maestra.

Consecuencia: añadir `padding-top` al header sin actualizar el contrato de altura del contenido puede provocar desbordamiento, scroll residual o recorte inferior. La abstracción común debe exponer una altura total de AppBar = altura visual + safe-area y hacer que el contenido consuma exactamente el espacio restante.

### H-07 — El sistema visual compartido existe, pero las pantallas históricas no convergieron completamente a él

`components.css` contiene componentes base reutilizables (`vk-header`, `vk-appbar`, botones, filas, inputs, sheets y diálogos), mientras que numerosas pantallas posteriores conservan componentes específicos. La auditoría debe decidir, familia por familia, qué puede converger al componente común sin alterar el diseño confirmado y qué debe mantenerse como variante explícita.

No se hará una refactorización masiva solo por “limpieza”: primero se probará equivalencia visual y funcional.

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

## Matriz inicial de familias de cabecera

| Familia | Pantallas confirmadas | Altura visual actual conocida | Safe-area superior común | Riesgo asociado |
|---|---|---:|---|---|
| `vk-section-header` | Contraseñas, Notas, Tarjetas, Documentos, Favoritos, Ajustes, Seguridad | 64 px forzada por capa de consistencia | No en `main`; prueba Android positiva | Medio |
| Header principal `vk-header` | Dashboard y Ajustes como clase combinada | 56 px base; Ajustes recibe otras reglas | No centralizada | Alto |
| Password detail/edit/create | Detalle, Editar, Crear contraseña | 56 px | No centralizada | Alto |
| Note editor | Detalle, Crear, Editar nota | pendiente de extracción completa | No centralizada | Alto |
| Card editor | Detalle, Crear, Editar tarjeta | pendiente de extracción completa | No centralizada | Alto |
| Document editor | Vista previa, Crear, Detalle, Editar documento | pendiente de extracción completa | No centralizada | Alto |
| Seguridad avanzada | Master, PIN, Kit, Autobloqueo | 62/64 px y variantes | No centralizada | Alto |
| Ajustes secundarios | Peligro, Información, Notificaciones, Interacción | 64/64/74/72 px | No centralizada | Alto |
| Drive / copia local | Drive, backup local | 64 px | No centralizada | Alto |

Esta tabla es de inventario, no de normalización: los valores distintos no se consideran errores por sí solos mientras el sistema visual no declare que deban ser iguales.

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

## Estrategia técnica propuesta para AppBar + Android safe-area

No se integrará todavía; debe validarse primero en la rama y en APK.

1. Definir un contrato común de inset superior, separado de la altura visual del AppBar.
2. Aplicarlo mediante una clase/atributo común a todas las cabeceras de pantalla completa, no a modales que no deban tocar la barra de estado.
3. Mantener por familia una variable de altura visual (`56`, `62`, `64`, `72`, `74`, `75` solo cuando el diseño/código vigente lo justifique).
4. Calcular altura total y `flex-basis` como `altura visual + safe-area-inset-top`.
5. Ajustar los contenedores que actualmente restan una constante fija de `100dvh` para que resten también el inset superior o, preferiblemente, migren a layout flex cuando sea seguro.
6. No usar un parche global sobre todos los `header` porque también existen cabeceras de modales/bottom sheets con un contrato distinto.

## Estrategia de corrección general

### Fase A — Inventario y clasificación

- Enumerar todas las pantallas, overlays, modales y bottom sheets.
- Mapear cada una a una familia de componentes.
- Localizar CSS duplicado y reglas tardías/overrides.
- Identificar causas raíz comunes.

### Fase B — Normalización de infraestructura visual

- Crear una abstracción común de AppBar Android-safe-area.
- Normalizar contenedores scrollables y acciones inferiores.
- Centralizar reglas de bottom sheet/modal donde sea posible.
- Mantener variantes documentadas, sin inventar valores.

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

## Pendientes visuales ya conocidos que deben entrar en esta auditoría

- Cabeceras e iconos superiores tapados por barra de estado.
- Márgenes/insets y controles cortados en pantallas y avisos.
- Notificación/pantalla “Restaurar copia”.
- “PIN de restauración”.
- “Estado de tu bóveda”: scroll/fondo/consistencia de bottom sheet.
- Vibración del generador.
- Diálogos y acciones inferiores con riesgo de recorte.
- Scroll residual donde el contenido cabe completo.

## Regla de cierre

No se marcará una familia como terminada por una sola pantalla correcta. Deben quedar cubiertas todas sus variantes y documentadas las excepciones. No se hará merge del bloque global de safe-area hasta terminar el inventario y validar la arquitectura común en el prototipo Android.
