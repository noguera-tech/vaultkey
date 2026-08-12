# VaultKey — Matriz de cabeceras y cascada Android/WebView

Fecha: 2026-08-12
Rama: `fix/android-header-safe-area`
Estado: auditoría estática; sin cambios funcionales.

## Objetivo

Mapear qué selector gobierna cada cabecera activa, qué altura visual declara, qué tamaño táctil usa, qué contenedor de contenido depende de esa altura y qué riesgo de cascada existe entre `csp-base.css`, `components.css`, `style.css` y `csp-overrides.css`.

## Orden real de carga CSS

`app.html` carga en este orden:

1. `csp-base.css`
2. `theme.css`
3. `components.css`
4. `style.css`
5. `csp-overrides.css`

Consecuencia: a igual especificidad gana `style.css` sobre `components.css`, y `csp-overrides.css` es la última capa. Sin embargo, reglas con `!important` en `components.css` pueden prevalecer sobre reglas posteriores no importantes.

## Hallazgo crítico C-01 — La unificación de cabeceras introduce una sobreescritura fuerte

`components.css` contiene `.vk-section-header` con `height:64px !important`, `min-height:64px !important`, `flex:0 0 64px` y además fuerza zonas táctiles de 48 px.

Varias pantallas tienen una clase visual propia además de `vk-section-header`. Por ejemplo Seguridad tiene una regla específica en `style.css` que declara 75 px, pero al llevar también `vk-section-header`, la altura de 64 px con `!important` gana sobre la altura de 75 px no importante. Esto significa que el diseño específico y la capa de unificación están en conflicto.

Decisión: no añadir otro override global encima. Primero hay que decidir por familia qué altura visual es la fuente de verdad y retirar la contradicción, no ocultarla con más `!important`.

## Familia A — Secciones principales con `vk-section-header`

Pantallas conocidas: Contraseñas, Notas, Tarjetas, Documentos, Favoritos, Ajustes y Seguridad.

### Contrato actual compartido

- Selector: `.vk-section-header`
- Archivo: `components.css`
- Altura efectiva: 64 px por `!important`
- Zona táctil compartida: 48×48 px
- Riesgo: sobreescribe alturas específicas posteriores.

### Seguridad

- Clase específica: `.vk-security-header`
- Archivo específico: `style.css`
- Altura declarada por diseño: 75 px
- Clase adicional en DOM: `vk-section-header`
- Altura efectiva actual: 64 px por la regla `!important` compartida.
- Contenido: `.vk-security-content` usa `min-height:calc(100dvh - 64px)`.
- Diagnóstico: inconsistencia entre intención visual (75) y geometría efectiva (64). La resta del contenido coincide con la altura forzada, no con la declarada por `.vk-security-header`.

### Contraseñas

- La capa compartida también redefine `#passwords .vk-passwords-content` con `height:calc(100% - 64px)`.
- Diagnóstico: la propia regla de unificación no solo modifica la cabecera; también altera la geometría del contenido de Contraseñas. Cualquier nuevo cambio global puede tener radio de impacto mayor de lo que parece.

## Familia B — Contraseñas detalle / editar / crear

### Detalle

- Selector: `.vk-password-detail-header`
- Archivo: `components.css`
- Altura: 56 px
- Padding: horizontal mediante token R1.
- No usa el contrato `vk-section-header`.

### Editar

- Selector: `.vk-password-edit-header`
- Archivo: `components.css`
- Altura: 56 px
- `flex:0 0 56px`.
- Riesgo: el formulario inferior ya ha requerido corrección Android específica en `csp-overrides.css`; no mezclar esta familia con la Familia A.

### Crear

- Selector: `.vk-password-create-topbar`
- Archivo: `components.css`
- Altura: 56 px
- `flex:0 0 56px`.
- Tiene media query Android/teclado `max-height:640px` que oculta la topbar para ganar espacio.
- Diagnóstico: esta pantalla ya tiene una estrategia específica para IME. Aplicar safe-area superior sin respetar esa estrategia puede duplicar o invalidar su modo compacto.

## Familia C — Notas, Tarjetas y Documentos

### Notas

- Selectores: `.vk-notes-topbar`, `.vk-note-editor-topbar`
- Archivo: `style.css`
- Altura: 64 px
- `min-height:64px`
- Estructura flex.

### Tarjetas

- Selectores: `.vk-cards-topbar`, `.vk-card-editor-topbar`
- Archivo: `style.css`
- Altura: 64 px
- `min-height:64px`
- `flex-shrink:0`.

### Documentos

- Selectores: `.vk-documents-topbar`, `.vk-document-editor-topbar`, `.vk-document-modal-header`
- Archivo: `style.css`
- Altura: 64 px
- `min-height:64px`
- `flex-shrink:0`.
- Contenido de lista: `.vk-documents-content{flex:1;overflow-y:auto;...}`.
- Diagnóstico: Documentos es una buena referencia porque ya usa `flex:1` en contenido y no depende de una resta fija para la lista. Sin embargo, `vk-document-modal-header` es cabecera interna de modal y no debe recibir automáticamente el safe-area de pantalla.

## Familia D — Ajustes y seguridad avanzada

### Zona de peligro

- Selector: `.vk-danger-header`
- Archivo: `csp-base.css`
- Altura: 64 px; `flex:0 0 64px`
- Contenido: `.vk-danger-content` usa `height:calc(100dvh - 64px)` y `overflow:hidden`, cambiando a scroll solo en `max-height:760px`.
- Riesgo alto de recorte si se incrementa cabecera sin ajustar contenido.

### Información

- Selector: `.vk-info-header`
- Archivo: `csp-base.css`
- Altura: 64 px
- Botón atrás: 44×44 px
- Contenido: `height:calc(100dvh - 64px)`, con `overflow-y:auto`.

### Notificaciones

- Selector: `.vk-notif-header`
- Archivo: `csp-base.css`
- Altura: 74 px
- Botón atrás: 44×44 px
- Contenido: `height:calc(100dvh - 74px)`.
- Diagnóstico: altura propia consistente con su contenido. No debe normalizarse a 64 px sin una decisión de diseño explícita.

### Interacción

- Selector: `.vk-interaction-header`
- Archivo: `csp-base.css`
- Altura: 72 px
- Botón atrás: 44×44 px
- Contenido: `height:calc(100dvh - 72px)` y `overflow:hidden`.
- Riesgo: cualquier crecimiento superior requiere revisar simultáneamente el contenido.

### Google Drive / Copia local

- Selector: `.vk-drive-header`
- Archivo: `csp-base.css`
- Altura: 64 px
- Botón atrás: 44×44 px
- Contenido: `height:calc(100dvh - 64px)` y `overflow-y:auto`.

### Autobloqueo

- Selector: `.vk-auto-header`
- Archivo: `csp-base.css`
- Altura: 64 px
- Botón atrás: 32×32 px
- Contenido: `height:calc(100dvh - 64px)` y `overflow:hidden`.
- Diagnóstico: zona táctil menor que otras familias y contenido rígido. Debe auditarse por separado.

### Cambio de PIN

- Selector: `.vk-pin-header`
- Archivo: `csp-base.css`
- Altura: 64 px
- Botón atrás: 32×32 px
- Contenido: `height:calc(100dvh - 64px)` y `overflow:hidden`.
- El botón Guardar se empuja al final mediante `margin:auto auto 0`.
- Riesgo alto de recorte inferior si se altera la altura superior.

### Cambio de contraseña maestra

- Selector: `.vk-master-header`
- Archivo: `csp-base.css`
- Altura: 62 px
- Botón atrás: 32×32 px
- Contenido: `height:calc(100dvh - 62px)` y `overflow:hidden`.
- Acciones: `margin-top:auto`.
- Riesgo alto de recorte inferior y conflicto con teclado.

## Hallazgo C-02 — Existen tres tamaños táctiles de botón atrás

En la implementación activa aparecen al menos:

- 48×48 px en `vk-section-header`.
- 44×44 px en Información, Notificaciones, Interacción y Drive.
- 32×32 px en PIN, contraseña maestra, kit/autobloqueo y otras pantallas de seguridad.

No se debe cambiar simultáneamente tamaño táctil y safe-area. Son dos problemas distintos. Primero se corrige la posición respecto a la barra de estado; la normalización táctil se evalúa después contra Figma/checklist.

## Hallazgo C-03 — La cascada es parte del problema, no solo el safe-area

La combinación actual es:

- `csp-base.css`: muchas pantallas de Ajustes/Seguridad con geometría completa y restas fijas.
- `components.css`: componentes R1 y una regla posterior `.vk-section-header` con `!important`.
- `style.css`: módulos visuales específicos de Notas/Tarjetas/Documentos/Seguridad y sistema legacy.
- `csp-overrides.css`: parches finales Android/generador/formularios.

Por tanto, una regla nueva al final puede parecer una solución local pero modificar indirectamente varios contratos previos. El próximo parche debe evitar `!important` salvo que exista una razón documentada y debe apuntar a un selector de una sola familia.

## Hallazgo C-04 — El fallo de codificación del piloto no provenía del CSS de la app

La corrupción de textos observada en la prueba se produjo al reescribir `app.html` local completo desde PowerShell. El repositorio ya muestra mojibake en algunos comentarios/textos al ser interpretado por ciertas rutas de lectura, pero el estado restaurado en el dispositivo confirma que el archivo original local era funcional. Decisión: no volver a serializar HTML completo mediante `Get-Content/Set-Content` para insertar una etiqueta de prueba.

## Estrategia segura a partir de esta matriz

1. No tocar `app.html` para pruebas visuales.
2. No crear una capa global de geometría.
3. Primera corrección: únicamente Familia A y únicamente safe-area superior, manteniendo la altura visual efectiva actual y sin cambiar tamaños táctiles.
4. Probar en 2–3 pantallas de Familia A antes de extender.
5. Si Familia A queda estable, repetir por Familia C, que es internamente coherente a 64 px.
6. Familia B y D se dejan para después porque contienen teclado, alturas fijas y acciones inferiores sensibles.
7. Modales y bottom sheets quedan fuera de la fase de cabeceras.

## Criterio del próximo parche

El siguiente parche debe poder describirse así: “desplaza la zona visual de la cabecera de una familia por debajo del inset superior sin cambiar tipografía, iconos, botones, contenido, scroll, JavaScript ni encoding”. Si no puede cumplir esa frase, todavía es demasiado amplio para probarlo.
