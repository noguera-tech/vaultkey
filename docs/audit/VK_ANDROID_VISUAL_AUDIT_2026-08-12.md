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

### H-05 — La altura de contenido depende de constantes duplicadas

Varias pantallas calculan su zona de contenido restando una altura fija de cabecera a `100dvh`, por ejemplo `calc(100dvh - 64px)` o equivalentes. Si se añade safe-area únicamente a la cabecera, el contenido puede quedar demasiado alto y generar scroll residual o recorte inferior.

Decisión: cada familia que use una resta fija debe migrar conjuntamente a `altura visual + safe-area`, no solo su cabecera.

### H-06 — Existen al menos cinco alturas visuales de cabecera activas

La implementación real contiene alturas de 56, 62, 64, 72 y 74 px según familia/pantalla. No son solo diferencias entre “principal” y “secundaria”; también existen implementaciones históricas distintas para configuraciones y formularios.

Ejemplos confirmados:

- Contraseña detalle/editar/crear: 56 px.
- Cambio de contraseña maestra: 62 px.
- Notas/Tarjetas/Documentos y múltiples ajustes: 64 px.
- Interacción: 72 px.
- Notificaciones: 74 px.

Esto impide una corrección ingenua de altura única y refuerza la necesidad de una capa común de safe-area independiente de la altura visual.

### H-07 — Notas, Tarjetas y Documentos ya forman familias reutilizables, pero no comparten una abstracción superior común

Notas y Tarjetas reutilizan una cabecera de 64 px para lista y una cabecera de editor de 64 px para detalle/crear/editar. Documentos hace lo mismo con `vk-documents-topbar` y `vk-document-editor-topbar`, también de 64 px.

Oportunidad: estas familias pueden migrar a una clase/variable común de AppBar secundaria Android-safe sin modificar el diseño interno de cada pantalla.

### H-08 — Acciones inferiores de formularios dependen de `margin-top:auto` y padding fijo

Notas, Tarjetas y Documentos colocan sus acciones inferiores mediante `margin-top:auto`, con botones de 48 px. Documentos además usa formularios `overflow-y:auto` y padding inferior fijo de 28 px.

Riesgo Android: al cambiar altura de cabecera o aparecer teclado/safe-area, estos pies pueden quedar cortados o introducir scroll mínimo, exactamente el tipo de defecto ya observado en Generador y Editar contraseña.

Decisión: auditar las acciones inferiores como una familia propia (`form-actions`) y no corregir cada formulario por separado.

### H-09 — Bottom sheets/document sheets usan geometría fija y no siempre incorporan safe-area inferior

El selector de origen de documentos usa `min-height:494px` y `padding:18px 24px 28px` sin sumar explícitamente `safe-area-inset-bottom`. Existen otros bottom sheets posteriores en `csp-overrides.css` con reglas propias.

Riesgo: botones inferiores correctos en web pueden quedar demasiado cerca de navegación Android o provocar recortes en determinados dispositivos.

Decisión: inventariar todos los sheets y separar claramente `panel`, `scroll-body` y `actions/footer`, usando safe-area solo una vez.

### H-10 — Existe una capa visual legacy todavía activa en `style.css`

`style.css` conserva un sistema visual anterior con tokens, fondos, sombras, `.top`, `.card`, `.primary`, `.ghost`, etc., mientras `components.css` y la documentación maestra definen el sistema R1/actual. Aunque muchas reglas nuevas sobrescriben las antiguas, esta convivencia aumenta el riesgo de cascada inesperada y hace que un componente aparentemente igual pueda heredar reglas distintas según el orden de carga.

Decisión: no borrar legacy durante la corrección funcional. Primero identificar qué selectores legacy siguen alcanzando DOM activo; la limpieza debe ser una fase separada y verificable.

### H-11 — Conviven al menos tres sistemas de overlay/modal

El DOM y CSS activos muestran tres arquitecturas distintas para superposiciones:

1. Modal legacy genérico: `.modal > .sheet`, usado por `urlModal`, `noteModal`, `quickModal`, `recoveryModal` y onboarding histórico.
2. Sistema de componentes: `.vk-sheet` / `.vk-dialog` definido en `components.css`.
3. Sistema documental/generador: `.vk-document-modal`, `.vk-document-source-sheet`, `.vk-generator-sheet`.

Estas arquitecturas tienen reglas diferentes de altura, overflow, padding, radio y safe-area. El problema de botones cortados no puede darse por cerrado mientras estas tres familias sigan sin una política común de viewport y safe-area.

Decisión: no fusionarlas a ciegas en un único componente durante esta auditoría. Primero normalizar el contrato geométrico común: `max-height`, cuerpo scrollable, footer de acciones y safe-area inferior.

### H-12 — El sistema legacy de modales contiene geometría inline y estilos que anulan la centralización

`app.html` conserva ejemplos como `style="max-height:50dvh"`, `style="max-height:60dvh"`, `style="height:100dvh;max-height:none..."` y otros estilos inline en elementos activos. Esto hace que una regla CSS global de modal pueda no surtir efecto o comportarse de manera distinta según el elemento.

La checklist visual ya prohíbe estilos inline cuando existe un token/componente reutilizable. Esta deuda debe registrarse y eliminarse en una fase controlada después de estabilizar Android.

### H-13 — Persisten emojis en UI legacy y overlays

En `app.html` siguen existiendo emojis usados como iconografía/texto decorativo en modales y onboarding legacy (`🔗`, `📝`, `⚠️`, `💡`, `🔐`, etc.). La checklist visual exige cero emojis y el sistema actual prescribe SVG lineales.

No es la causa del recorte Android, pero sí es una inconsistencia objetiva de pulido y forma parte de la auditoría completa solicitada.

Decisión: separar esta limpieza visual del parche de safe-area para no mezclar una corrección de geometría con sustituciones iconográficas masivas.

### H-14 — Los sheets de componentes también carecen de safe-area inferior en su contrato base

El componente `.vk-sheet__panel` usa `padding:8px 16px 24px` y `max-height:85vh`, sin incorporar `env(safe-area-inset-bottom)`. Por tanto, incluso el sistema de componentes más moderno no garantiza por sí mismo una distancia segura respecto a la navegación Android.

Decisión: el contrato común de sheet deberá reservar el inset inferior exactamente una vez, preferentemente en el panel/footer, y usar `dvh` donde el comportamiento de viewport móvil lo requiera.

### H-15 — El generador demuestra que el patrón correcto es “vista compacta fija + expansión scrollable” cuando el contenido tiene dos estados

La corrección ya verificada físicamente del generador confirma que activar `overflow-y:auto` de forma permanente crea scroll residual incluso cuando el contenido cabe. La solución validada mantiene la vista normal sin scroll y habilita scroll únicamente en estado expandido.

Esta regla no debe copiarse indiscriminadamente, pero sí usarse como criterio para paneles con contenido colapsable: el scroll debe responder a necesidad real, no estar activo por defecto.

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

### Overlays / modales / sheets
- Modal URL legacy
- Modal Nota legacy
- Quick modal fullscreen
- Código de recuperación
- Onboarding legacy y onboarding actual
- Generador de contraseñas
- Selector de tipo/origen de documento
- Bottom sheets de componentes (`vk-sheet`)
- Diálogos de componentes (`vk-dialog`)
- Confirmaciones/restauración y credenciales (pendiente de cerrar inventario exacto por DOM dinámico)

## Clasificación provisional de cabeceras

### Familia A — Secciones principales de 64 px
- Contraseñas lista
- Notas lista
- Tarjetas lista
- Documentos lista
- Favoritos
- Ajustes
- Seguridad

Estado: prueba safe-area positiva en Android para las que usan `vk-section-header`.

### Familia B — Formularios/detalle de contraseña de 56 px
- Detalle contraseña
- Editar contraseña
- Crear contraseña

Estado: pendiente de prueba Android-safe. Requiere ajustar simultáneamente contenido/flex restante.

### Familia C — Editores de contenido de 64 px
- Nota detalle/crear/editar
- Tarjeta detalle/crear/editar
- Documento vista previa/crear/detalle/editar

Estado: candidatos claros a una abstracción común de AppBar secundaria 64 px + safe-area.

### Familia D — Seguridad avanzada / utilidades
- Cambio contraseña maestra: 62 px
- Cambio PIN: 64 px
- Kit de emergencia: 64 px
- Zona de peligro: 64 px
- Información: 64 px
- Drive/Copia local: 64 px
- Interacción: 72 px
- Notificaciones: 74 px
- Autobloqueo: altura propia pendiente de cerrar en inventario

Estado: no normalizar altura visual sin referencia de diseño; sí normalizar la forma de sumar safe-area.

### Exclusiones de la abstracción de AppBar de pantalla
- Cabeceras internas de modales.
- Cabeceras de bottom sheets.
- Onboarding/unlock cuando su composición sea específica.

Estas no deben recibir automáticamente el safe-area de las pantallas completas.

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
16. Ausencia de estilos inline que impidan reutilización/cascada controlada.
17. Ausencia de iconografía emoji donde el sistema visual exige SVG.
18. Overlays: scrim, foco, cierre, scroll interno y acciones siempre accesibles.

## Arquitectura propuesta para safe-area (provisional)

No usar un `header { ... }` global.

Modelo previsto:

- Variable/clase de `--vk-appbar-visual-height` por familia.
- Altura total: `calc(var(--vk-appbar-visual-height) + env(safe-area-inset-top, 0px))`.
- `padding-top: env(safe-area-inset-top, 0px)` en el contenedor de AppBar de pantalla.
- Zona visual interna conserva su altura original (56/62/64/72/74 según corresponda).
- Contenido con `flex:1; min-height:0` preferido frente a `height:calc(100dvh - Npx)` cuando sea viable.
- Donde una resta explícita sea necesaria, restar también el safe-area.
- Safe-area inferior se aplica una sola vez en el footer/acciones o contenedor raíz, nunca duplicado.

Esta arquitectura debe probarse primero en representantes de Familia A, B, C y D antes de generalizar.

## Contrato geométrico provisional para overlays

Para cualquier bottom sheet/diálogo de pantalla completa o anclado al borde inferior:

- El panel define `max-height` respecto al viewport dinámico.
- El cuerpo, no el panel completo, es la región scrollable cuando existen acciones fijas.
- El footer de acciones debe permanecer visible cuando sea posible.
- `safe-area-inset-bottom` se consume exactamente una vez.
- Cabeceras internas de sheet no reciben automáticamente `safe-area-inset-top` salvo que el sheet llegue deliberadamente al borde superior del viewport.
- Los modos compactos no deben mostrar scrollbar/scroll residual si todo el contenido cabe.

## Estrategia de corrección

### Fase A — Inventario y clasificación

- Enumerar todas las pantallas, overlays, modales y bottom sheets.
- Mapear cada una a una familia de componentes.
- Localizar CSS duplicado y reglas tardías/overrides.
- Identificar causas raíz comunes.

### Fase B — Normalización de infraestructura visual

- Crear una abstracción común de AppBar Android-safe-area.
- Normalizar contenedores scrollables y acciones inferiores.
- Centralizar el contrato geométrico de bottom sheet/modal donde sea posible.
- Mantener variantes documentadas (56/62/64/72/74 px u otras confirmadas), sin inventar valores.

### Fase C — Auditoría pantalla por pantalla

Usar `VAULTKEY_VISUAL_CHECKLIST.md` como control de aceptación, pero corregir por familia para evitar repetir trabajo.

### Fase D — Reconciliación Android/Web

- Comparar hashes y diffs de la capa web.
- Documentar diferencias específicas del wrapper Android.
- Definir procedimiento reproducible de actualización de assets web en el prototipo.

### Fase E — Limpieza visual/arquitectónica no funcional

Una vez estabilizada la geometría Android:

- retirar estilos inline sustituibles por clases/tokens;
- sustituir emojis de UI por SVG del sistema;
- identificar y retirar selectores legacy que ya no alcancen DOM necesario;
- reducir duplicación entre familias sin cambiar decisiones visuales confirmadas.

### Fase F — APK de auditoría final

Pasada física completa en dispositivo Android con datos ficticios, incluyendo alturas normales y pequeñas, teclado, scroll, modales, navegación, bloqueo y capturas protegidas.

## Correcciones ya verificadas durante esta sesión

- Generador normal: sin scroll residual.
- Generador avanzado: scroll activo y acceso visible.
- Botones `Cancelar / Usar`: visibles completos.
- Editar contraseña: acciones inferiores ajustadas.
- Safe-area en `vk-section-header`: prueba física positiva; pendiente generalizar correctamente al resto de familias.

## Próxima fase inmediata

1. Cerrar inventario exacto de confirmaciones/restauración y overlays generados dinámicamente.
2. Completar mapa de `100dvh - Npx` y contenidos con altura fija.
3. Diseñar el primer parche estructural de AppBar para representantes de familias A/B/C/D.
4. Incorporar un contrato común de safe-area inferior para sheets sin tocar todavía iconografía/legacy.
5. Preparar una única APK de prueba con matriz de pantallas, evitando nuevos parches locales hasta validar el patrón.

## Regla de cierre

No se marcará una familia como terminada por una sola pantalla correcta. Deben quedar cubiertas todas sus variantes y documentadas las excepciones. No se hará merge del bloque global de safe-area hasta terminar el inventario y validar la arquitectura común en el prototipo Android.