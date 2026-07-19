# VAULTKEY — SISTEMA VISUAL MAESTRO v1.0

**Versión:** 1.0-rc1
**Estado:** CANDIDATO A CONGELACIÓN — pendiente de revisión final antes de commit. No es todavía normativo definitivo.
**Fecha:** 2026-07-19
**Autoría:** análisis Sonnet + verificación manual del propietario en el panel de Figma
**Revisión obligatoria antes del commit.**

Este documento es candidato a ser la fuente de verdad visual de VaultKey. Contiene **únicamente datos
confirmados o decisiones de producto explícitas** — cualquier valor todavía abierto vive exclusivamente en
la sección final **BACKLOG VISUAL PENDIENTE**, nunca mezclado dentro de una tabla normativa. Un valor del
backlog **no es de uso obligatorio** hasta que se cierre y se traslade a la sección correspondiente.

---

## Propósito

Evitar de forma permanente:
- volver a auditar las mismas pantallas;
- deducir colores por capturas o por aspecto visual;
- inventar degradados, radios, sombras o pesos tipográficos;
- mezclar emojis y SVG;
- diseñar cada pantalla nueva de forma aislada, sin consultar este sistema;
- depender de que alguien "recuerde" una conversación anterior;
- presentar un valor asumido, extrapolado por analogía o "por coherencia" como si fuera un dato confirmado.

## Alcance

Cubre el sistema visual — color, tipografía, iconografía, espaciado, componentes de superficie — de las 62 pantallas del archivo Figma vigente de VaultKey 2.0. **No cubre** lógica funcional, criptografía, storage, sesión, autenticación, PIN/master/kit ni Drive — ninguno de esos sistemas se ha tocado ni se toca al escribir este documento.

## Fuentes examinadas

1. `Auditoria_Visual_Maestra_VaultKey.md` — primera auditoría, código real (`app.html`/`style.css`) vs. tokens existentes.
2. `VaultKey_Cierre_Decisiones_Visuales.md` — primera extracción vectorial de los 62 PDF (fondo, tamaños de texto).
3. `VaultKey_Segunda_Pasada_Vectorial.md` — extracción vectorial de tarjetas, filas, botones, AppBars, FAB, bordes, radios, opacidades, espaciado.
4. `VaultKey_Tercera_Pasada_Vectorial.md` — extracción vectorial de botón primario, textarea, diálogo, bottom sheet y Zona de peligro.
5. Verificación manual directa en el panel de Figma (aportada por el propietario en dos rondas: la de consolidación inicial y la de corrección final) — **prevalece sobre cualquier lectura de PDF cuando hay conflicto**, según se detalla en cada sección y se registra íntegramente en `VAULTKEY_VISUAL_DECISIONS.md`.
6. `VaultKey_2_0 (1).fig` (binario, no decodificable directamente) y su export de 62 pantallas en PDF — fuente vectorial.

## Metodología

- **Vector PDF:** lectura del *content stream* real de cada PDF exportado por Figma (operadores `m/l/c/re/f/gs/rg/g`) con `pikepdf`, más coordenadas absolutas de texto/forma con `pdfplumber`. El radio de esquina se calculó midiendo el desplazamiento Δx/Δy real de cada curva Bézier respecto al punto recto anterior — nunca estimado por aspecto.
- **Panel de Figma:** selección manual de capas y lectura literal de los paneles Text/Fill/Stroke, aportada por el propietario. Es la fuente de mayor autoridad de las dos.
- **Regla de conflicto:** cuando el panel de Figma contradice una lectura de PDF, prevalece el panel de Figma; la lectura de PDF queda marcada como **sustituida** en `VAULTKEY_VISUAL_DECISIONS.md`, nunca borrada silenciosamente.
- **Regla contra la extrapolación (corrección de la ronda de revisión):** ningún valor "asumido por extensión", "por analogía" o "por coherencia" con otro dato aparece en este documento como confirmado. Si no hay medición o confirmación directa para un componente concreto, el valor va al **BACKLOG VISUAL PENDIENTE**, aunque un componente visualmente parecido sí esté confirmado.
- **Sobre el aplanado de trazos en el PDF:** el export vectorial de Figma convierte los `stroke` reales en formas rellenas duplicadas (una técnica propia del exportador a PDF). Esto es un artefacto del formato de exportación, **no la especificación de implementación**. Donde el panel de Figma confirma un `Stroke` real (color, opacidad, peso, posición), ese es el dato normativo — ver §5.

---

## 1. Jerarquía de fuentes de verdad

1. Verificación manual en el panel de Figma (máxima autoridad).
2. Extracción vectorial de PDF (autoridad alta, salvo contradicción con 1, y siempre que no se esté usando para deducir la técnica de implementación — ver nota sobre aplanado de trazos arriba).
3. Tokens ya existentes en `theme.css`/`components.css` (referencia, útil cuando coincide con 1/2).
4. Código actual de `style.css`/`app.html` (la fuente **menos** fiable — es precisamente lo que este sistema corrige).

---

## 2. Sistema de color

| Token de referencia | Valor | Uso | Fuente |
|---|---|---|---|
| Superficie de tarjeta/fila/AppBar | `#243246` | Relleno de toda tarjeta, fila, input, diálogo, bottom sheet, AppBar | CONFIRMADO DIRECTAMENTE EN FIGMA |
| Borde | `#3A4A60` | Borde de tarjetas, filas, inputs, diálogos, contenedores grandes, **y botón secundario outline** | CONFIRMADO DIRECTAMENTE EN FIGMA |
| Primario (icono, botón compacto) | `#3B82F6` | Iconos estándar, botón primario compacto (174×48) | CONFIRMADO DIRECTAMENTE EN FIGMA |
| Primario R1 (CTA ancho completo) | `#2F6FEA` | CTA de ancho completo, en sus dos anchos de referencia confirmados (ver §12) | CONFIRMADO MEDIANTE VECTOR PDF — variante de azul distinta y deliberada del botón compacto (DEC-009) |
| Advertencia / Zona de peligro (icono) | `#F59E0B` | Icono de entrada a Zona de peligro (fila de Ajustes y pantalla propia) | CONFIRMADO MEDIANTE VECTOR PDF, verificado 2 veces de forma independiente |
| Destructivo (solo confirmación final) | `#DC2626` | Únicamente el botón de confirmación irreversible dentro de un diálogo o pantalla | CONFIRMADO MEDIANTE VECTOR PDF |
| Texto principal | `#FFFFFF` | Títulos, valores | CONFIRMADO DIRECTAMENTE EN FIGMA |
| Texto secundario/subtítulo | `#A7B6C9` | Subtítulos de fila, placeholders, labels | CONFIRMADO DIRECTAMENTE EN FIGMA |
| Neutro claro (thumb de switch, dots de PIN) | `#D9D9D9` | Elementos circulares pequeños | CONFIRMADO MEDIANTE VECTOR PDF |
| Éxito (estado seguro) | `#22C55E` | Indicador de estado en Dashboard | CONFIRMADO MEDIANTE VECTOR PDF |
| Borde de botón destructivo | `#475569` | Borde del botón destructivo, **mientras no exista una verificación manual que lo sustituya** | CONFIRMADO MEDIANTE VECTOR PDF — distinto del borde `#3A4A60` de superficies y del botón secundario outline |

**Regla:** `#3B82F6` (icono / botón compacto) y `#2F6FEA` (CTA ancho completo) son dos colores reales, cada uno con su rol propio — no se sustituyen entre sí (DEC-009).

---

## 3. Degradado global

```
linear-gradient(180deg, #111827 17%, #182F4E 67%)
```

**CONFIRMADO DIRECTAMENTE EN FIGMA** (dato manual, dado como fondo global de todas las pantallas completas), y coincide exactamente con la función PostScript de degradado extraída de 58 de las 62 pantallas del export vectorial (hash idéntico byte a byte en las 58).

**Regla sin excepciones:** ninguna pantalla completa usa un degradado propio. Las únicas pantallas sin este fondo son las 4 tarjetas de diálogo (300×240), que no tienen fondo de página propio porque no son pantallas completas — se apoyan sobre lo que haya detrás (ver §13).

---

## 4. Superficies

| Superficie | Relleno | Opacidad | Fuente |
|---|---|---|---|
| Tarjeta / fila estándar | `#243246` | **100%** | CONFIRMADO DIRECTAMENTE EN FIGMA (DEC-010) |
| Borde de tarjeta/fila | `#3A4A60` | 60% | CONFIRMADO DIRECTAMENTE EN FIGMA |
| Diálogo | `#243246` | 100% | CONFIRMADO DIRECTAMENTE EN FIGMA |
| Bottom Sheet | `#243246` | Ver BACKLOG — la opacidad de esta superficie concreta no tiene verificación manual propia; no se asume por extensión de la tarjeta estándar | CONFIRMADO MEDIANTE VECTOR PDF solo el color; opacidad PENDIENTE |
| AppBar | `#243246` | Ver BACKLOG — sin valor único confirmado | PENDIENTE |
| Tile de Dashboard | `#243246` | Ver BACKLOG — no reverificada de forma independiente tras la corrección de DEC-010 | PENDIENTE |

---

## 5. Bordes

El panel de Figma confirma que el borde **es un `Stroke` real del componente**, no una forma duplicada:

- **Color:** según componente — `#3A4A60` para superficies (tarjetas, filas, inputs, diálogos, contenedores grandes) y para el botón secundario outline; `#475569` para el botón destructivo (mientras no se verifique lo contrario).
- **Opacidad:** 60% para superficies. La del botón destructivo no está reconfirmada manualmente — BACKLOG.
- **Peso:** 1px.
- **Posición:** interior.

**Nota técnica, no normativa:** el PDF exportado por Figma representa este `Stroke` como una segunda forma rellena, 1-2px mayor, superpuesta detrás del relleno — es una técnica propia del exportador a PDF, no la especificación. **La implementación real puede usar `border` o `stroke` de CSS/SVG directamente**, sin obligación de replicar la técnica de doble forma del PDF.

---

## 6. Radios

| Radio | Uso | Fuente |
|---|---|---|
| **6px** | Input compacto de una línea (excepcional) | CONFIRMADO DIRECTAMENTE EN FIGMA |
| **12px** | Bottom Sheet | CONFIRMADO DIRECTAMENTE EN FIGMA |
| **16px** | Radio estándar dominante: tarjetas, filas, tiles, botones, inputs, diálogos, tabs, y contenedores grandes | CONFIRMADO DIRECTAMENTE EN FIGMA |
| **20px** | Únicamente donde Figma lo confirme expresamente pantalla a pantalla — no es el radio por defecto de "tarjeta grande" | INCONSISTENCIA DEL FIGMA, corregida — ver DEC-011 |
| **28px** | FAB (mitad exacta de 56px) | CONFIRMADO DIRECTAMENTE EN FIGMA / VECTOR (coincidentes) |
| **999px (píldora)** | Solo cuando el elemento sea circular/cápsula por definición (ej. dot de estado, thumb de switch) | DECISIÓN DE PRODUCTO |

**Regla prohibida:** no crear ningún radio nuevo fuera de esta lista sin confirmarlo primero en el panel de Figma y añadirlo aquí.

---

## 7. Opacidades

| Elemento | Opacidad | Fuente |
|---|---|---|
| Relleno de tarjeta/fila/diálogo/input | 100% | CONFIRMADO DIRECTAMENTE EN FIGMA |
| Borde (superficies) | 60% | CONFIRMADO DIRECTAMENTE EN FIGMA |
| Texto de título (pantalla y fila) | 100% | CONFIRMADO DIRECTAMENTE EN FIGMA |
| Label de formulario | 80% | CONFIRMADO DIRECTAMENTE EN FIGMA |
| Subtítulo de fila | 100% (el color `#A7B6C9` ya es en sí un tono atenuado) | CONFIRMADO DIRECTAMENTE EN FIGMA |
| Scrim de guía de exportación en las esquinas del marco | 20% | CONFIRMADO MEDIANTE VECTOR PDF — artefacto de exportación de Figma, no un elemento de diseño a replicar |

Todo lo demás (AppBar, Bottom Sheet, scrim de diálogo, tile de Dashboard, botón destructivo) va al BACKLOG.

---

## 8. Ausencia de sombras

**No existe ninguna sombra real en ninguna pantalla inspeccionada.** Se buscó explícitamente: formas duplicadas desplazadas con blur, `ExtGState` con `/SMask` de tipo sombra, cualquier técnica habitual de simulación de `box-shadow`. Resultado: cero en las 9+ pantallas de la segunda/tercera pasada, y confirmado directamente en el panel de Figma.

**Regla:** no se crea ningún `box-shadow` por defecto en ningún componente. Cualquier sombra que se quiera introducir en el futuro es una **decisión de producto nueva**, no una corrección de una omisión — debe documentarse como tal en `VAULTKEY_VISUAL_DECISIONS.md` antes de usarse.

---

## 9. Tipografía

**Familia:** `Inter` — CONFIRMADO DIRECTAMENTE EN FIGMA.
**Fallback aprobado:** `Inter, system-ui, -apple-system, "Segoe UI", sans-serif`.

| Rol | Peso | Tamaño | Line-height | Letter-spacing | Color | Opacidad | Alineación | Fuente |
|---|---|---|---|---|---|---|---|---|
| Título de pantalla | Bold | 20px | Automático | 0% | `#FFFFFF` | 100% | Centrada | CONFIRMADO DIRECTAMENTE EN FIGMA |
| Título de fila | Semi Bold | 16px | Automático | 0% | `#FFFFFF` | 100% | — | CONFIRMADO DIRECTAMENTE EN FIGMA |
| Subtítulo de fila | Regular | 13px | Automático | 0% | `#A7B6C9` | 100% | — | CONFIRMADO DIRECTAMENTE EN FIGMA |
| Label de formulario | Regular | 14px | Automático | 0% | `#A7B6C9` | 80% | — | CONFIRMADO DIRECTAMENTE EN FIGMA |
| Texto/placeholder de input | Regular | 16px | Automático | 0% | `#FFFFFF` | 100% | — | CONFIRMADO DIRECTAMENTE EN FIGMA |
| Texto de botón compacto y de botón secundario outline | Regular | 14px | Automático | 0% | `#FFFFFF` | 100% | Centrada | CONFIRMADO DIRECTAMENTE EN FIGMA |
| Texto de CTA ancho completo | Ver BACKLOG (peso) | 20px | — | — | `#FFFFFF` | 100% | Centrada | Tamaño CONFIRMADO MEDIANTE VECTOR PDF (medido dos veces); peso PENDIENTE |
| Título de AppBar interna / título de diálogo | Ver BACKLOG (peso) | 24px | — | — | `#FFFFFF` | 100% | — | Tamaño CONFIRMADO MEDIANTE VECTOR PDF; peso PENDIENTE |
| Título de tarjeta de resumen (ej. "Tu bóveda") | — | 18px | — | — | `#FFFFFF` | 100% | — | CONFIRMADO MEDIANTE VECTOR PDF |
| Caption menor | — | 12px | — | — | `#A7B6C9`/similar | — | — | CONFIRMADO MEDIANTE VECTOR PDF, uso puntual (Dashboard) |

**Label de textarea:** normalizado a 14px (mismo estándar que cualquier label de formulario) — DECISIÓN DE PRODUCTO (DEC-012). La medición de 13px encontrada en el campo "Descripción" de Añadir nota es una anomalía puntual y **no se conserva como estándar**.

**Peso prohibido:** cualquier valor fuera de la escala estándar de 100 en 100 (100/200/.../900). El peso `850` detectado en el código de la integración provisional de Ajustes no tiene respaldo tipográfico real y queda expresamente prohibido.

---

## 10. Iconografía

| Propiedad | Valor | Fuente |
|---|---|---|
| Caja de referencia | 24×24px | CONFIRMADO DIRECTAMENTE EN FIGMA |
| Estilo | SVG lineal | CONFIRMADO DIRECTAMENTE EN FIGMA |
| Stroke-width | 2px | CONFIRMADO DIRECTAMENTE EN FIGMA |
| Extremos de línea | Redondos (`linecap`/`linejoin` round) | CONFIRMADO DIRECTAMENTE EN FIGMA |
| Color — icono estándar | `#3B82F6` | CONFIRMADO DIRECTAMENTE EN FIGMA |
| Color — icono de advertencia | `#F59E0B` | CONFIRMADO DIRECTAMENTE EN FIGMA |
| Caja/fondo detrás del icono | **No existe** | CONFIRMADO DIRECTAMENTE EN FIGMA — contradice directamente el código actual (`.vk-settings-card__icon`, `.vk-dash-tile__icon`), que sí dibuja un contenedor con degradado propio |
| Biblioteca de origen | — | PENDIENTE — ver BACKLOG |

**Regla prohibida:** emojis como iconos, en cualquier pantalla nueva.

---

## 11. Espaciados

| Espaciado | Valor | Fuente |
|---|---|---|
| Margen lateral de pantalla (tarjetas) | 24px | CONFIRMADO DIRECTAMENTE EN FIGMA |
| Separación entre tarjetas/filas | 15px | CONFIRMADO DIRECTAMENTE EN FIGMA |
| Alto de fila/tarjeta estándar | 72px | CONFIRMADO DIRECTAMENTE EN FIGMA |
| Alto de tile de cuadrícula (Dashboard) | 100px | CONFIRMADO MEDIANTE VECTOR PDF |
| Padding superior de diálogo | 45px | CONFIRMADO MEDIANTE VECTOR PDF |
| Padding lateral de diálogo | 34px, simétrico | CONFIRMADO MEDIANTE VECTOR PDF, verificado 2 veces |
| Inset horizontal de placeholder dentro de input | 10px | CONFIRMADO MEDIANTE VECTOR PDF |
| Inset vertical de placeholder — input de 1 línea | 16px | CONFIRMADO MEDIANTE VECTOR PDF |

El resto de espaciados medidos una sola vez o sin patrón claro (padding superior de Bottom Sheet, inset vertical de placeholder en textarea, separación de filas dentro de Bottom Sheet) van al BACKLOG.

**No existe una escala matemática limpia (4/8/12/16/24/32) que explique todos estos valores.** Se documentan como constantes fijas confirmadas, no como una progresión deducida.

---

## 12. Botones

Ver detalle completo de cada variante en `VAULTKEY_COMPONENT_CATALOG.md`. Resumen normativo:

| Variante | Dimensión | Radio | Relleno | Borde | Texto |
|---|---|---|---|---|---|
| Primario compacto | 174×48 | 16px | `#3B82F6` @ 100% | Ninguno | Inter Regular 14px blanco |
| CTA primario ancho completo | Altura 56px, radio 16px, fondo `#2F6FEA` — **ancho dependiente del contexto: 320px y 360px son ambas referencias confirmadas, sin una regla responsive única todavía** (ver BACKLOG) | 16px | `#2F6FEA` @ 100% | Ninguno | 20px blanco (peso en BACKLOG) |
| Secundario outline (incluye "Cancelar") | 174×48 (formulario) / 85×42.58 (diálogo) — mismo componente, dos anchos de contexto confirmados | 16px | Transparente | `#3A4A60`, 1px interior | Inter Regular 14px blanco |
| Destructivo | 43px alto confirmado (Detalle contraseña "Eliminar": 120×43; diálogos "Borrar"/"Eliminar": 85×43) | 16px | `#DC2626` @ 80% (opacidad no reconfirmada manualmente — BACKLOG) | `#475569`, mientras no exista verificación manual que lo sustituya | Blanco |

**Botón primario compacto y CTA ancho completo son variantes distintas, no la misma con tamaños diferentes** (DEC-008).

---

## 13. Diálogos

- Tamaño de referencia: 300×240px.
- Radio: 16px.
- Superficie: `#243246` @ 100%.
- Sin sombra.
- Padding superior 45px, lateral 34px simétrico, separación título→cuerpo 19px.
- Título del diálogo: 24px (peso en BACKLOG).
- Botón destructivo (rojo) reservado exclusivamente para la acción irreversible final del diálogo — nunca para el punto de entrada.
- Botón "Cancelar": secundario outline, 85×42.58px, radio 16px, borde `#3A4A60` — ver §12.
- No tiene fondo de página propio: es una tarjeta flotante que se apoya sobre lo que haya detrás (scrim de fondo: BACKLOG).

---

## 14. Bottom Sheets

- Tamaño de referencia: 412×494px.
- Radio: 12px.
- Superficie: `#243246` (opacidad: BACKLOG).
- **No existe handle confirmado en el diseño inspeccionado — no se inventa uno.** Si se necesita un handle, es una decisión de producto nueva, no una omisión a corregir.
- Padding superior ≈19px.
- Las filas de opción interiores y su separación exacta: BACKLOG (medidas una sola vez, sin confirmación manual, con valores distintos de la fila estándar).

---

## 15. FAB

- 56×56px, circular (radio 28px = mitad exacta).
- Relleno `#3B82F6` @ 100%.
- Sin sombra confirmada.
- Confirmado en dos pantallas independientes (Dashboard, Contraseñas), geometría idéntica.

---

## 16. AppBars

- Superficie `#243246`.
- Altura y opacidad únicas: **no hay un valor normativo cerrado** — ver BACKLOG. No se ofrece aquí ninguna regla de uso "por analogía": un dato pendiente no se disfraza de recomendación práctica dentro de la norma.

---

## 17. Zona de peligro

- La fila de acceso desde Ajustes **es la tarjeta/fila estándar sin ninguna variante** — mismas dimensiones, mismo radio, mismo relleno que cualquier otra fila.
- Icono ámbar (`#F59E0B`) en el punto de entrada — confirmado en dos sitios independientes (fila de Ajustes y título de la propia pantalla de Zona de peligro).
- Rojo (`#DC2626`) reservado exclusivamente para el botón de confirmación irreversible final, nunca para el icono de entrada.
- Jerarquía tipográfica idéntica a cualquier otra pantalla de Ajustes (20/16/13px) — no existe un tratamiento tipográfico especial de "peligro".

Fuente: CONFIRMADO DIRECTAMENTE EN FIGMA + CONFIRMADO MEDIANTE VECTOR PDF (coincidentes, sin conflicto).

---

## 18. Estados

Únicamente lo confirmado:

| Estado | Evidencia |
|---|---|
| Botón CTA activo vs. inactivo | Confirmado en vector: "Desbloquear" en PIN cambia de `#243246` (inactivo, sin PIN introducido) a `#2F6FEA` al activarse |
| Toggle/switch activado | Confirmado en vector: pista 48×28, radio 14 (cápsula), color `#3B82F6`; thumb 22×22, radio 11 (círculo), color `#D9D9D9` |

El resto de estados (pressed, hover, focus, error, disabled de la mayoría de componentes, switch desactivado, tabs inactivas) va íntegro al BACKLOG.

---

## 19. Responsive

No verificado. Ver BACKLOG.

---

## 20. Reglas prohibidas

- Emojis como iconos.
- Fondos o degradados distintos del único degradado global (§3) en cualquier pantalla completa nueva.
- Degradados "casi iguales" inventados para una pantalla concreta.
- Sombras no documentadas en este sistema.
- Cajas o fondos decorativos detrás de iconos.
- Pesos tipográficos fuera de la escala estándar (ej. 850).
- Colores nuevos hardcodeados fuera de la tabla de §2.
- Radios nuevos fuera de la tabla de §6.
- `style="..."` inline para cualquier valor que ya tenga token en este sistema.
- Nuevos `!important` para forzar un valor sobre la base — si hace falta, es señal de que la base está mal y hay que corregir la base, no añadir otro `!important`.
- Duplicar un componente que ya existe en `VAULTKEY_COMPONENT_CATALOG.md` con una implementación distinta.
- Presentar un valor aproximado, asumido, extrapolado "por analogía" o "por coherencia" como si fuera un dato confirmado.
- Dar por aprobada visualmente una pantalla sin compararla explícitamente contra este sistema.

**No prohibido:** usar `border`/`stroke` de CSS o SVG para implementar los bordes de §5 — es una técnica de implementación válida; lo único que documenta el PDF exportado es un artefacto de su propio proceso de exportación, no una restricción de implementación.

---

## 21. Criterios de aceptación

Una pantalla nueva o modificada se considera visualmente conforme cuando, y solo cuando:

1. Usa el degradado único de §3 (o, si es un diálogo/bottom sheet, la superficie de §13/§14) — sin excepción no documentada.
2. Todo color usado aparece en la tabla de §2.
3. Todo radio usado aparece en la tabla de §6.
4. La tipografía de cada texto coincide con un rol de la tabla de §9 (tamaño, peso si está confirmado, color, opacidad).
5. Todo icono es SVG lineal, 24×24, stroke 2px, sin caja de fondo, en uno de los dos colores de §10.
6. Cero emojis.
7. Cero `style` inline para valores tokenizables.
8. Cero `!important` nuevos.
9. Todo componente reutiliza uno de `VAULTKEY_COMPONENT_CATALOG.md` — si no existe el que hace falta, se propone como componente nuevo en ese catálogo antes de usarse, no se improvisa en la pantalla.
10. Se ha comparado visualmente contra el frame correspondiente del `.fig`/PDF, en Chrome real, no solo con un renderizador automático.
11. Se ha pasado la checklist completa de `VAULTKEY_VISUAL_CHECKLIST.md` con todo "Sí" — ningún ítem del backlog se exige como bloqueante.

---

## BACKLOG VISUAL PENDIENTE

Ningún valor de esta sección es de uso obligatorio ni aparece como bloqueante en `VAULTKEY_VISUAL_CHECKLIST.md`. Se resuelve trasladándolo a la sección normativa correspondiente cuando haya confirmación (manual o, en su defecto, vectorial reconocida como suficiente).

| # | Pendiente | Detalle |
|---|---|---|
| 1 | Altura y opacidad única de AppBar | Hoy 64/75px y 0.6/0.8/1.0 según pantalla, sin patrón claro de opacidad |
| 2 | Peso tipográfico del CTA ancho completo (20px) | No incluido en los datos manuales aportados |
| 3 | Peso tipográfico del título de AppBar interna / diálogo (24px) | No incluido en los datos manuales aportados |
| 4 | Scrim de fondo detrás de un diálogo abierto sobre una pantalla real | El export de diálogo no incluye la pantalla de detrás |
| 5 | Scrim de fondo del Bottom Sheet | Una sola lectura vectorial (35%), no verificada en el panel de Figma |
| 6 | Biblioteca de origen de los iconos (¿Lucide u otra?) | No es un dato recuperable de la geometría vectorial; requiere confirmación de nombre de componente/instancia en Figma |
| 7 | Estados pressed / hover / focus / error / disabled | Un export estático de Figma no expone interacción; solo se confirmaron CTA activo/inactivo y switch activado |
| 8 | Comportamiento responsive fuera del viewport de referencia (412×917) | No evaluado |
| 9 | Filas internas de Bottom Sheet (84.8px de alto, separación) | Medido una sola vez, sin confirmación manual |
| 10 | Inset vertical de placeholder en textarea (8px, no proporcional al del input de 1 línea) | Detectado, sin instrucción de normalización |
| 11 | Chevron (dimensiones, color, estilo) | Nunca aislado con medición propia |
| 12 | Switch desactivado | Solo se verificó el estado activado |
| 13 | Tabs inactivas (geometría y tipografía) | Solo se confirmó la pestaña activa |
| 14 | Regla responsive exacta del ancho del CTA de ancho completo | Dos anchos de referencia confirmados (320px y 360px, contexto/frame distinto) sin regla de cuándo usar cada uno |
| 15 | Opacidad de superficie del Bottom Sheet | Color confirmado (`#243246`), opacidad no reconfirmada manualmente |
| 16 | Opacidad de relleno del tile de Dashboard | No reverificado de forma independiente tras la corrección de DEC-010 (no se asume 100% por extensión) |
| 17 | Opacidad de superficie de AppBar | Sin valor único — ver punto 1 |
| 18 | Opacidad del relleno del botón destructivo (80% medido en vector) | No reconfirmada manualmente |
| 19 | Opacidad del borde del botón destructivo | No reconfirmada manualmente |

---

*Fin del documento candidato a normativo. Para el historial de cada decisión y sus alternativas rechazadas, ver `VAULTKEY_VISUAL_DECISIONS.md`. Para la ficha de cada componente, ver `VAULTKEY_COMPONENT_CATALOG.md`. Para la checklist operativa, ver `VAULTKEY_VISUAL_CHECKLIST.md`.*
