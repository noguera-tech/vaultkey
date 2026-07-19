# VAULTKEY — REGISTRO DE DECISIONES VISUALES

**Versión:** 1.0-rc1
**Estado:** CANDIDATO A CONGELACIÓN — pendiente de revisión final antes de commit.
**Fecha:** 2026-07-19
**Autoría:** análisis Sonnet + verificación manual del propietario en el panel de Figma
**Revisión obligatoria antes del commit.**

Registro histórico y acumulativo. Ninguna entrada se borra: cuando una decisión se sustituye, la entrada
antigua cambia de estado a **sustituida** y queda enlazada a la nueva, con el motivo del cambio. Este
documento es el único lugar donde se explica *por qué* algo quedó fijado así — el "qué" vigente vive en
`VAULTKEY_VISUAL_MASTER_v1.0.md`.

Estados posibles: **congelada** · **pendiente** · **sustituida**.

---

### DEC-001 — Degradado único para todas las pantallas completas

- **Fecha:** 2026-07-19
- **Decisión:** Toda pantalla completa (412×917) usa exclusivamente `linear-gradient(180deg, #111827 17%, #182F4E 67%)` como fondo.
- **Motivo:** Es el único degradado presente en el archivo Figma vigente para pantallas completas.
- **Evidencia:** Hash idéntico de la función PostScript de degradado en 58 de las 62 pantallas exportadas (`VaultKey_Cierre_Decisiones_Visuales.md`, §0); confirmado directamente en el panel de Figma por el propietario.
- **Alternativas rechazadas:** Ninguna — no había alternativas reales en el archivo, solo desviaciones del código (`#0F172A` sólido en Dashboard, degradado distinto `#111827→#162b48` en la integración provisional de Ajustes, degradado distinto `#060e1f→#020810` en PIN) que nunca tuvieron respaldo en Figma.
- **Impacto:** Afecta a las 58 pantallas completas. Las 4 tarjetas de diálogo (300×240) quedan fuera por no ser pantallas completas (ver DEC-002).
- **Estado:** **congelada**

### DEC-002 — Prohibición de degradados propios por pantalla

- **Fecha:** 2026-07-19
- **Decisión:** Ninguna pantalla nueva puede declarar su propio degradado o color de fondo distinto del de DEC-001.
- **Motivo:** Consecuencia directa de DEC-001 — es la regla que impide que vuelva a repetirse la fragmentación de fondos observada en el código actual.
- **Evidencia:** `Auditoria_Visual_Maestra_VaultKey.md`, hallazgo estructural principal (`style.css` con 0 usos de `var(--vk-...)`).
- **Alternativas rechazadas:** Permitir variaciones "casi iguales" por pantalla — descartado explícitamente por instrucción directa del propietario.
- **Impacto:** Regla de cumplimiento obligatorio, ver `VAULTKEY_VISUAL_CHECKLIST.md`.
- **Estado:** **congelada**

### DEC-003 — Familia tipográfica: Inter

- **Fecha:** 2026-07-19
- **Decisión:** La familia tipográfica de VaultKey es **Inter**, con fallback `Inter, system-ui, -apple-system, "Segoe UI", sans-serif`.
- **Motivo:** Confirmación directa en el panel de Figma (Text → nombre de fuente).
- **Evidencia:** Verificación manual aportada por el propietario tras `VaultKey_Cierre_Decisiones_Visuales.md`, que había dejado este dato explícitamente como "no extraíble".
- **Alternativas rechazadas:** `Roboto` (declarada en `components.css`, sin respaldo en Figma) y `system-ui` como intención por defecto (declarada en `style.css`).
- **Impacto:** Corrige la contradicción de tres declaraciones de `font-family` distintas encontrada en la auditoría inicial.
- **Estado:** **congelada**

### DEC-004 — Ausencia real de sombras en Figma

- **Fecha:** 2026-07-19
- **Decisión:** Ningún componente lleva `box-shadow` por defecto. Cualquier sombra futura es una decisión de producto nueva, documentada aparte.
- **Motivo:** Búsqueda explícita de sombras en 9+ pantallas, sin ningún resultado positivo. Confirmado directamente en el panel de Figma.
- **Evidencia:** `VaultKey_Segunda_Pasada_Vectorial.md`, §B.
- **Alternativas rechazadas:** Mantener las sombras ya presentes en el código actual.
- **Impacto:** Afecta a tarjetas, botones, diálogos, bottom sheet, FAB.
- **Estado:** **congelada**

### DEC-005 — Ausencia de cajas de fondo detrás de iconos

- **Fecha:** 2026-07-19
- **Decisión:** Los iconos se dibujan directamente (trazo de color), sin contenedor/caja de fondo propia.
- **Motivo:** Búsqueda explícita en 5 pantallas distintas, sin encontrar ninguna forma de fondo independiente detrás de un icono. Confirmado directamente en el panel de Figma.
- **Evidencia:** `VaultKey_Segunda_Pasada_Vectorial.md`, Tarea A.
- **Alternativas rechazadas:** El contenedor de icono con degradado propio ya implementado en código (`.vk-settings-card__icon`, `.vk-dash-tile__icon`).
- **Impacto:** Afecta a todos los componentes que muestran un icono junto a texto.
- **Estado:** **congelada**

### DEC-006 — Iconos SVG lineales, stroke 2px, extremos redondos

- **Fecha:** 2026-07-19
- **Decisión:** Todo icono es SVG de trazo lineal, `stroke-width` 2px, `linecap`/`linejoin` redondos, caja de referencia 24×24px.
- **Motivo:** Confirmación directa en el panel de Figma.
- **Evidencia:** Corrige el estado "no extraíble" de `VaultKey_Cierre_Decisiones_Visuales.md` §4.
- **Alternativas rechazadas:** Ninguna.
- **Impacto:** Estándar único de iconografía.
- **Estado:** **congelada**

### DEC-007 — Icono normal azul, icono de advertencia ámbar, rojo solo en confirmación final

- **Fecha:** 2026-07-19
- **Decisión:** `#3B82F6` para iconos estándar; `#F59E0B` para el icono de entrada a Zona de peligro; `#DC2626` reservado exclusivamente para el botón de confirmación destructiva final.
- **Motivo:** Patrón real y consistente en las dos únicas apariciones del icono de Zona de peligro.
- **Evidencia:** `VaultKey_Tercera_Pasada_Vectorial.md`, Tarea 4 — confirmado también en el panel de Figma.
- **Alternativas rechazadas:** Rojo en el icono de entrada — no encontrado ni una sola vez.
- **Impacto:** Regla explícita para Zona de peligro y cualquier jerarquía de advertencia/destructivo.
- **Estado:** **congelada**

### DEC-008 — Botón primario compacto y CTA ancho completo son variantes distintas

- **Fecha:** 2026-07-19
- **Decisión:** No son el mismo componente con dos tamaños — son dos variantes con relleno, contexto de uso y peso de texto distintos.
- **Motivo:** Confirmación directa del propietario.
- **Evidencia:** `VaultKey_Tercera_Pasada_Vectorial.md`, Tarea 1 — geometría y relleno distintos medidos de forma independiente.
- **Alternativas rechazadas:** Unificar ambos en un único componente con una prop de tamaño.
- **Impacto:** `VAULTKEY_COMPONENT_CATALOG.md` los documenta como dos fichas separadas.
- **Estado:** **congelada**

### DEC-009 — Dos azules primarios reales, no un error a unificar

- **Fecha:** 2026-07-19
- **Decisión:** `#3B82F6` (icono / botón compacto) y `#2F6FEA` (CTA ancho completo) son ambos válidos, cada uno en su rol.
- **Motivo:** Ambos confirmados de forma independiente y repetida.
- **Evidencia:** `VaultKey_Tercera_Pasada_Vectorial.md`, tabla del punto 1.
- **Alternativas rechazadas:** Forzar un único azul.
- **Impacto:** Ver tabla de color en `VAULTKEY_VISUAL_MASTER_v1.0.md` §2.
- **Estado:** **congelada**

### DEC-010 — Opacidad del relleno de tarjeta: 100%, no 60% (dato sustituido)

- **Fecha:** 2026-07-19
- **Decisión:** El relleno de toda tarjeta/fila/input/diálogo es **100% opaco**. Solo el borde se queda al 60%.
- **Motivo:** Verificación manual directa en el panel de Figma.
- **Evidencia:** Dato manual del propietario. **Contradice** la lectura de `VaultKey_Segunda_Pasada_Vectorial.md` y `VaultKey_Tercera_Pasada_Vectorial.md`, que habían medido el relleno a 60% de opacidad en 9+ tarjetas de forma consistente.
- **Dato anterior (sustituido):** Relleno de tarjeta @ 60% de opacidad.
- **Alternativas rechazadas:** Mantener el 60% del vector.
- **Alcance de esta decisión — corregido en la ronda de revisión:** DEC-010 fija el relleno de **tarjeta/fila/input/diálogo** al 100%. **No se extiende automáticamente** a otras superficies visualmente parecidas (tile de Dashboard, AppBar, Bottom Sheet) que no se remidieron de forma independiente tras esta corrección — esas superficies quedan en el BACKLOG del documento maestro hasta que se confirmen una a una, en vez de heredar este valor "por extensión".
- **Impacto:** Afecta a la especificación de relleno de tarjeta/fila/input/diálogo (§4 y §7 del documento maestro). No decide por sí sola el relleno de otras superficies.
- **Estado:** **congelada** (para tarjeta/fila/input/diálogo; la versión "60%" queda **sustituida** para ese ámbito, no como alternativa vigente)

### DEC-011 — Radio de contenedores grandes: 16px, no 20px (dato sustituido)

- **Fecha:** 2026-07-19
- **Decisión:** Los contenedores grandes (tarjeta de resumen, tarjeta de contenido de detalle) usan el mismo radio de 16px que el resto del sistema. El radio de 20px solo se admite si Figma lo confirma expresamente para un caso concreto.
- **Motivo:** Verificación manual directa en el panel de Figma.
- **Evidencia:** Dato manual del propietario. **Contradice** la lectura de `VaultKey_Segunda_Pasada_Vectorial.md`, Tarea B, que había medido 20px de forma geométrica en dos casos independientes.
- **Dato anterior (sustituido):** Radio 20px para contenedores grandes.
- **Alternativas rechazadas:** Mantener dos radios distintos según tamaño de tarjeta.
- **Impacto:** Simplifica la escala de radios a un único valor dominante (16px) para prácticamente todos los componentes de superficie.
- **Estado:** **congelada** (la versión "20px como estándar de tarjeta grande" queda **sustituida**; el valor 20px se conserva aquí como medición real de un PDF que ya no se considera representativo del estándar)

### DEC-012 — Label de textarea normalizado a 14px (anomalía de 13px no conservada)

- **Fecha:** 2026-07-19
- **Decisión:** El label de cualquier campo de formulario, incluido el textarea, es Inter Regular 14px.
- **Motivo:** Decisión de producto explícita del propietario: no conservar como estándar una anomalía puntual detectada en una sola pantalla.
- **Evidencia:** `VaultKey_Tercera_Pasada_Vectorial.md`, Tarea 2.
- **Dato anterior (sustituido):** 13px como tamaño de label específico de textarea.
- **Alternativas rechazadas:** Formalizar 13px como "tamaño de label para campos multilínea".
- **Impacto:** Unifica la especificación de label de formulario en `VAULTKEY_COMPONENT_CATALOG.md`.
- **Estado:** **congelada**

### DEC-013 — CTA de ancho completo: altura y radio comunes; ancho dependiente del contexto (corregida — ya no se congela un único ancho universal)

- **Fecha:** 2026-07-19 · **Revisada:** 2026-07-19 (ronda de corrección)
- **Decisión vigente:** El CTA primario de ancho completo tiene **altura 56px y radio 16px confirmados como comunes** en todas sus apariciones. El **ancho depende del contexto/frame** y **no se congela un único valor universal**: existen dos referencias reales confirmadas — **320×56px** ("Comenzar" en Bienvenida, "Desbloquear" en PIN, medido de forma vectorial repetida e idéntica en ambos) y **360×56px** ("Guardar cambios", dato de verificación manual). La regla de cuándo usar cada ancho queda como pendiente (BACKLOG, punto 14 del documento maestro).
- **Motivo de la revisión:** la primera versión de esta decisión (ver "Historial de esta entrada" abajo) declaró 360px como sustituto universal de 320px, tratando ambos como el mismo dato en conflicto. La corrección posterior del propietario aclaró que **no es un conflicto entre un dato correcto y uno erróneo, sino dos anchos reales usados en contextos distintos** — no hay evidencia de que uno sustituya al otro.
- **Evidencia:** `VaultKey_Tercera_Pasada_Vectorial.md` (320×56, dos mediciones independientes idénticas) + verificación manual del propietario (360×56, "Guardar cambios").
- **Historial de esta entrada (versión sustituida):** la redacción original de DEC-013 declaraba "360px como ancho de referencia" y marcaba 320px como dato íntegramente sustituido. Esa redacción queda **retirada** — no se trataba de una corrección de un error, sino de una generalización indebida a partir de un solo dato manual nuevo, contraria a la regla de no presentar valores extrapolados como confirmados. Se conserva aquí únicamente como registro de que existió.
- **Alternativas rechazadas:** Forzar un único ancho universal sin evidencia que lo respalde — rechazado explícitamente en la ronda de corrección.
- **Impacto:** `VAULTKEY_COMPONENT_CATALOG.md` documenta el CTA con altura/radio/relleno fijos y ancho como dato abierto de contexto.
- **Estado:** **congelada** para altura/radio/relleno; **pendiente** la regla de ancho (ver BACKLOG punto 14 del documento maestro)

### DEC-014 — Botón "Cancelar": secundario outline, con dos anchos de contexto confirmados

- **Fecha:** 2026-07-19 · **Revisada:** 2026-07-19 (ronda de corrección, cierra PEND-004)
- **Decisión vigente:** "Cancelar" es una instancia del componente **botón secundario outline** — fondo transparente, borde `#3A4A60` de 1px interior, radio 16px, texto Inter Regular 14px `#FFFFFF` — con **dos anchos de contexto confirmados directamente en Figma**: **174×48px** en formulario y **85×42.58px** en diálogo. Ya no es un dato parcialmente pendiente: la geometría completa está cerrada para ambos contextos.
- **Motivo:** Verificación manual directa en el panel de Figma, aportada en la ronda de corrección final.
- **Evidencia:** Dato manual del propietario, con dimensiones exactas para ambos contextos. **Contradice** el hallazgo vectorial de `VaultKey_Tercera_Pasada_Vectorial.md`, Tarea 1, que había confirmado —dos veces, de forma independiente— la ausencia total de cualquier forma rellena o delimitada asociada al texto "Cancelar".
- **Dato anterior (sustituido):** "Cancelar" sin contenedor propio (solo texto, sin borde ni relleno) — confirmado dos veces por el vector, corregido por la verificación manual.
- **Alternativas rechazadas:** Mantener "Cancelar" como texto suelto.
- **Impacto:** Se documenta como botón secundario outline en `VAULTKEY_COMPONENT_CATALOG.md`, con sus dos variantes de ancho.
- **Estado:** **congelada** — **PEND-004 queda cerrado y retirado de la lista de pendientes.**

### DEC-015 — Tarjeta de Ajustes y fila de Contraseñas son el mismo componente

- **Fecha:** 2026-07-19
- **Decisión:** No son componentes distintos — es un único componente "tarjeta/fila estándar" reutilizado en ambos contextos.
- **Motivo:** Coinciden en dimensiones (365-366×72), radio (16px), relleno y borde, medidos de forma independiente en Ajustes, Seguridad, Contraseñas, y también en Zona de peligro.
- **Evidencia:** `VaultKey_Segunda_Pasada_Vectorial.md` §E; confirmado y ampliado en `VaultKey_Tercera_Pasada_Vectorial.md` §4.
- **Alternativas rechazadas:** Tratarlos como componentes separados con la misma apariencia por coincidencia.
- **Impacto:** Reduce el catálogo de componentes.
- **Estado:** **congelada**

### DEC-016 — El radio dominante del sistema es 16px

- **Fecha:** 2026-07-19
- **Decisión:** 16px es el radio por defecto de cualquier componente de superficie nuevo, salvo los 4 casos excepcionales documentados (6/12/20/28px).
- **Motivo:** Es, con diferencia, el radio más repetido de forma independiente en el sistema, reforzado por DEC-011.
- **Evidencia:** `VaultKey_Segunda_Pasada_Vectorial.md` §B.
- **Alternativas rechazadas:** Ninguna.
- **Impacto:** Radio por defecto para cualquier componente nuevo no listado explícitamente.
- **Estado:** **congelada**

### DEC-017 — No se permiten emojis en ninguna pantalla

- **Fecha:** 2026-07-19
- **Decisión:** Prohibido usar emojis como iconos o como parte del contenido visual de cualquier pantalla nueva.
- **Motivo:** Los emojis no forman parte del sistema de iconografía confirmado (DEC-006).
- **Evidencia:** `Auditoria_Visual_Maestra_VaultKey.md`, §A.8 y A.4.
- **Alternativas rechazadas:** Ninguna.
- **Impacto:** Regla de cumplimiento obligatorio en la checklist.
- **Estado:** **congelada**

### DEC-018 — No se permiten valores visuales nuevos fuera de tokens

- **Fecha:** 2026-07-19
- **Decisión:** Ningún color, radio, tamaño tipográfico, opacidad o espaciado nuevo puede introducirse en una pantalla sin antes añadirse a este sistema documental.
- **Motivo:** Causa raíz identificada en la primera auditoría.
- **Evidencia:** `Auditoria_Visual_Maestra_VaultKey.md`, hallazgo estructural principal.
- **Alternativas rechazadas:** Permitir "pequeñas excepciones justificadas caso a caso".
- **Impacto:** Regla general que sostiene todo el sistema.
- **Estado:** **congelada**

### DEC-019 — Ninguna pantalla se diseña sin consultar estos documentos

- **Fecha:** 2026-07-19
- **Decisión:** Antes de integrar o diseñar cualquier pantalla, es obligatorio consultar `VAULTKEY_VISUAL_MASTER_v1.0.md` y `VAULTKEY_COMPONENT_CATALOG.md`, y pasar `VAULTKEY_VISUAL_CHECKLIST.md`.
- **Motivo:** Propósito explícito de esta consolidación.
- **Evidencia:** Encargo directo del propietario.
- **Alternativas rechazadas:** Ninguna.
- **Impacto:** Regla de proceso.
- **Estado:** **congelada**

### DEC-020 — El borde es un `Stroke` real de Figma; el aplanado en PDF es un artefacto de exportación, no la especificación

- **Fecha:** 2026-07-19 (ronda de corrección)
- **Decisión:** Los bordes de tarjetas/filas/inputs/diálogos/botones se especifican como `Stroke` real (color, opacidad, peso 1px, posición interior), y la implementación técnica **puede usar `border`/`stroke` de CSS/SVG directamente**.
- **Motivo:** El panel de Figma confirmó el `Stroke` real de forma directa; la lectura vectorial anterior, que documentaba el borde como "forma duplicada, sin `stroke` real", describía correctamente el **PDF exportado**, no la especificación de Figma — el exportador a PDF de Figma aplana los `stroke` en formas rellenas como parte de su propio proceso, algo ajeno a la intención de diseño.
- **Evidencia:** Verificación manual del propietario (Stroke `#3A4A60`, opacidad 60%, peso 1px, posición interior) vs. `VaultKey_Segunda_Pasada_Vectorial.md` §B (hallazgo correcto sobre el PDF, pero que se había redactado de forma que sonaba a restricción de implementación).
- **Dato anterior (matizado, no exactamente sustituido):** "No existe stroke real, debe implementarse como forma duplicada" — la observación sobre el PDF era correcta; lo que se retira es su tratamiento como regla normativa de implementación.
- **Alternativas rechazadas:** Mantener la prohibición de usar `border`/`stroke` CSS — retirada explícitamente.
- **Impacto:** `VAULTKEY_VISUAL_MASTER_v1.0.md` §5 y `VAULTKEY_VISUAL_CHECKLIST.md` corregidos para no prohibir `border`/`stroke` CSS.
- **Estado:** **congelada**

---

## Pendientes abiertos (no son decisiones — son huecos de información reales)

| ID | Pendiente | Motivo |
|---|---|---|
| PEND-001 | Altura y opacidad única de AppBar | No cubierto por la verificación manual |
| PEND-002 | Peso tipográfico del texto de CTA ancho completo (20px) y del título de AppBar/diálogo (24px) | No incluido en los datos manuales aportados |
| PEND-003 | Scrim de fondo detrás de un diálogo abierto sobre una pantalla real | El export de diálogo no incluye la pantalla de detrás |
| ~~PEND-004~~ | ~~Dimensiones y grosor de borde exactos del botón "Cancelar" outline~~ | **Cerrado por DEC-014** — dato confirmado directamente en Figma para ambos contextos (formulario y diálogo). Retirado de la lista de pendientes. |
| PEND-005 | Scrim de fondo del Bottom Sheet (35%, una sola lectura) | No reconfirmado en el panel de Figma |
| PEND-006 | Biblioteca de origen de los iconos (¿Lucide u otra?) | No es un dato recuperable de la geometría vectorial |
| PEND-007 | Estados pressed/hover/focus/error/disabled de la mayoría de componentes | Un export estático de Figma no expone interacción |
| PEND-008 | Comportamiento responsive fuera del viewport de referencia (412×917) | No evaluado |
| PEND-009 | Altura de fila de opción dentro de Bottom Sheet (84.8px) y su separación | Detectado, no resuelto |
| PEND-010 | Inset vertical de placeholder en textarea (8px) frente a input de una línea (16px) | Detectado, no resuelto — sin instrucción de normalización, a diferencia del label (DEC-012) |
| PEND-011 | Regla responsive exacta de cuándo usar 320px vs. 360px en el CTA de ancho completo | Abierto por DEC-013 revisada |
| PEND-012 | Opacidad de relleno de superficies no reconfirmadas tras DEC-010 (tile de Dashboard, AppBar, Bottom Sheet) | DEC-010 no se extiende "por extensión" a estas superficies — ver nota de alcance en DEC-010 |
| PEND-013 | Opacidad de relleno y de borde del botón destructivo | Medidos en vector (80% relleno), no reconfirmados manualmente |
| PEND-014 | Chevron, switch desactivado, tabs inactivas | Nunca aislados con medición propia |

