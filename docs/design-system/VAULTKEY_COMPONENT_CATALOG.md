# VAULTKEY — CATÁLOGO DE COMPONENTES

**Versión:** 1.0-rc1
**Estado:** CANDIDATO A CONGELACIÓN — pendiente de revisión final antes de commit.
**Fecha:** 2026-07-19
**Autoría:** análisis Sonnet + verificación manual del propietario en el panel de Figma
**Revisión obligatoria antes del commit.**

Ficha técnica de cada componente visual confirmado. Cada valor cita su origen; donde no hay dato, se dice
expresamente "PENDIENTE — ver BACKLOG VISUAL PENDIENTE en el documento maestro" en vez de rellenarlo con
una suposición. Ningún valor "asumido por extensión/analogía/coherencia" aparece aquí como confirmado. La
jerarquía de fuentes y las reglas de conflicto están en `VAULTKEY_VISUAL_MASTER_v1.0.md` §Metodología.

---

## Pantalla raíz

- **Finalidad:** contenedor base de cualquier pantalla completa.
- **Dimensiones:** 412×917px (viewport de referencia).
- **Fondo:** `linear-gradient(180deg, #111827 17%, #182F4E 67%)` — CONFIRMADO DIRECTAMENTE EN FIGMA (DEC-001).
- **Opacidad:** 100%.
- **Radio / borde:** no aplica.
- **Estados:** ninguno propio.
- **Variantes:** ninguna.
- **Responsive:** PENDIENTE.
- **Ejemplos:** Splash, Bienvenida, Dashboard, Contraseñas, Ajustes, PIN, y el resto de las 58 pantallas completas.
- **Reglas de uso:** toda pantalla nueva parte de este fondo.
- **Reglas prohibidas:** ningún color o degradado de fondo distinto (DEC-002).

---

## AppBar

- **Finalidad:** cabecera superior de una pantalla interna.
- **Dimensiones:** ancho completo (412px) × altura — PENDIENTE, sin valor único confirmado (64px en Contraseñas/Dashboard/Detalle/Bottom Sheet/Añadir contraseña; 75px en Ajustes/Seguridad).
- **Color:** `#243246`.
- **Opacidad:** PENDIENTE — sin valor único (0.6/0.8/1.0 según pantalla, sin patrón funcional identificado).
- **Radio / borde:** ninguno.
- **Icono:** puede incluir flecha atrás (AppBar secundaria) o Favoritos+Ajustes (AppBar principal), distinción ya establecida en la Especificación Final del proyecto, fuera del alcance de esta auditoría visual.
- **Estados:** PENDIENTE.
- **Variantes:** AppBar principal vs. AppBar secundaria (definidas por la Especificación Final del proyecto).
- **Responsive:** PENDIENTE.
- **Ejemplos:** Ajustes (75px/1.0), Seguridad (75px/1.0), Contraseñas (64px/0.6), Dashboard (64px/0.6), Detalle contraseña (64px/0.8).
- **Reglas de uso:** ninguna regla normativa hasta cerrar el pendiente — no se ofrece aquí una recomendación "por analogía" para no presentar un dato abierto como práctica aprobada.
- **Reglas prohibidas:** inventar una tercera altura u opacidad sin verificarla en Figma.

---

## Título de pantalla

- **Finalidad:** texto principal identificativo de una pantalla.
- **Tipografía:** Inter Bold, 20px, line-height automático, letter-spacing 0%.
- **Color:** `#FFFFFF`.
- **Opacidad:** 100%.
- **Alineación:** centrada.
- **Fuente:** CONFIRMADO DIRECTAMENTE EN FIGMA.
- **Variante — título de AppBar interna / diálogo:** 24px, mismo color y opacidad, peso PENDIENTE.
- **Estados:** ninguno.
- **Responsive:** PENDIENTE.
- **Ejemplos:** "Ajustes", "Seguridad", "Información", "Zona de peligro", "Bloqueo automático" (20px); "Google" en AppBar de Detalle, "¿Eliminar 'Google'?" en diálogo (24px).
- **Reglas prohibidas:** ningún otro tamaño para este rol.

---

## Tarjeta / fila estándar

- **Finalidad:** elemento de navegación o de lista, con icono + texto + chevron opcional.
- **Dimensiones:** 365×72px de referencia.
- **Relleno:** `#243246` @ **100%** (DEC-010).
- **Borde:** `#3A4A60` @ 60%, 1px, interior (`Stroke` real confirmado en Figma — DEC-020).
- **Radio:** 16px.
- **Tipografía interior:** título de fila (Inter Semi Bold 16px `#FFFFFF`) + subtítulo de fila (Inter Regular 13px `#A7B6C9`).
- **Icono:** 24×24, estándar (`#3B82F6`) o warning (`#F59E0B`) según contexto, sin caja de fondo.
- **Estados:** PENDIENTE.
- **Variantes:** ninguna real — la fila de Ajustes, la fila de Contraseñas y la fila de acceso a Zona de peligro son **el mismo componente** (DEC-015).
- **Responsive:** PENDIENTE.
- **Ejemplos:** Ajustes (5 filas), Seguridad (filas de opciones), Contraseñas (filas de la lista), Zona de peligro (5 filas).
- **Reglas de uso:** es el componente por defecto para cualquier lista de opciones o entradas.
- **Reglas prohibidas:** crear una tarjeta nueva con otras dimensiones/radio para el mismo propósito en vez de reutilizar esta.

---

## Tarjeta grande

- **Finalidad:** contenedor de resumen o de contenido extenso.
- **Dimensiones:** variable según contenido — ejemplo confirmado 364×520px (dato manual); también observados 366×120 (Dashboard, "Tu bóveda") y 364×320 (Detalle contraseña) en vector.
- **Relleno:** `#243246` @ 100%.
- **Borde:** `#3A4A60` @ 60%, 1px interior.
- **Radio:** **16px** (DEC-011).
- **Sombra:** ninguna.
- **Tipografía:** título de tarjeta de resumen a 18px; el resto de contenido sigue los roles estándar de §9 del documento maestro.
- **Estados:** PENDIENTE.
- **Variantes:** una sola — el tamaño se adapta al contenido, relleno/borde/radio son constantes.
- **Responsive:** PENDIENTE.
- **Ejemplos:** "Tu bóveda" (Dashboard), tarjeta de contenido de Detalle contraseña.
- **Reglas de uso:** usar cuando el contenido no encaja en la fila estándar de 72px.
- **Reglas prohibidas:** usar 20px de radio salvo que una pantalla concreta lo confirme expresamente en Figma.

---

## Fila de navegación

Es el mismo componente que "Tarjeta / fila estándar" cuando su función es llevar a otra pantalla. No tiene ficha propia. Se nombra aquí solo para dejar constancia explícita de que **no es un componente distinto**.

---

## Fila de lista

Es el mismo componente que "Tarjeta / fila estándar" cuando su función es mostrar una entrada de una colección. Tampoco tiene ficha propia — ver "Tarjeta / fila estándar". Confirmado en DEC-015.

---

## Tile de Dashboard

- **Finalidad:** acceso rápido a una categoría, en cuadrícula 2×2.
- **Dimensiones:** 174×100px.
- **Relleno:** `#243246`, opacidad **PENDIENTE** (no reconfirmada de forma independiente tras la corrección de DEC-010 — no se asume 100% "por extensión").
- **Borde:** `#3A4A60` @ 60%.
- **Radio:** 16px.
- **Tipografía:** título de fila (16px) + caption de conteo (tamaño exacto PENDIENTE).
- **Icono:** 24×24 estándar, sin caja de fondo.
- **Estados:** PENDIENTE.
- **Variantes:** ninguna.
- **Responsive:** PENDIENTE.
- **Ejemplos:** Contraseñas/Notas/Tarjetas/Documentos en Dashboard.
- **Reglas de uso:** solo dentro de una cuadrícula 2×2 de acceso rápido.
- **Reglas prohibidas:** usarlo como sustituto de la fila estándar en una lista vertical.

---

## Input estándar

- **Finalidad:** campo de formulario de una línea con más contenido (usuario, contraseña).
- **Dimensiones:** 363×53px de referencia.
- **Relleno:** `#243246`.
- **Borde:** `#3A4A60`, 1px interior.
- **Radio:** 16px.
- **Tipografía:** valor/placeholder Inter Regular 16px `#FFFFFF` 100%; label asociado Inter Regular 14px `#A7B6C9` 80%, posicionado sobre el campo, alineado a su mismo margen izquierdo.
- **Inset del placeholder:** 10px horizontal, 16px vertical desde el techo del campo.
- **Estados:** PENDIENTE (focus, error).
- **Variantes:** ver "Input compacto" y "Textarea" — son variantes de tamaño/uso distintas.
- **Responsive:** PENDIENTE.
- **Ejemplos:** campos "Usuario"/"Contraseña" en Añadir contraseña.
- **Reglas prohibidas:** ningún radio ni relleno distinto del documentado aquí.

---

## Input compacto

- **Finalidad:** campo de una sola línea, corto.
- **Dimensiones:** 363×27px (campo de nombre) o 364×45px (barra de búsqueda) — dos alturas observadas para el mismo rol, sin resolver cuál es la referencia única. PENDIENTE.
- **Relleno:** `#243246`.
- **Borde:** `#3A4A60`, 1px interior.
- **Radio:** **6px** — excepcional, CONFIRMADO DIRECTAMENTE EN FIGMA.
- **Tipografía:** igual que Input estándar.
- **Estados:** PENDIENTE.
- **Variantes:** ver nota de dimensiones arriba.
- **Responsive:** PENDIENTE.
- **Ejemplos:** campo "Nombre del servicio" en Añadir contraseña; barra de búsqueda en Contraseñas.
- **Reglas prohibidas:** no confundir con el input estándar — el radio es distinto (6px, no 16px).

---

## Textarea

- **Finalidad:** campo de formulario multilínea.
- **Dimensiones:** 363×96px de referencia.
- **Relleno:** `#243246`.
- **Borde:** `#3A4A60`, 1px interior.
- **Radio:** 16px — igual que el input estándar.
- **Tipografía:** valor/placeholder igual que input estándar (16px); **label normalizado a 14px** (DEC-012).
- **Inset del placeholder:** 10px horizontal, **8px vertical** (distinto del input de una línea, 16px — PENDIENTE, sin normalizar).
- **Altura de línea visible:** PENDIENTE.
- **Estados:** PENDIENTE.
- **Variantes:** ninguna.
- **Responsive:** PENDIENTE.
- **Ejemplos:** campo "Descripción" en Añadir nota.
- **Reglas prohibidas:** usar 13px para el label (DEC-012).

---

## Botón primario compacto

- **Finalidad:** acción principal en un contexto de espacio reducido (ej. junto a "Cancelar").
- **Dimensiones:** 174×48px.
- **Relleno:** `#3B82F6` @ 100%.
- **Borde:** ninguno.
- **Radio:** 16px.
- **Sombra:** ninguna.
- **Tipografía:** Inter Regular 14px `#FFFFFF`, centrado.
- **Icono:** no lleva.
- **Estados:** PENDIENTE.
- **Variantes:** distinto de "CTA primario de ancho completo" (DEC-008) — no reescalar uno para obtener el otro.
- **Responsive:** PENDIENTE.
- **Ejemplos:** "Crear" en Añadir nota.
- **Reglas prohibidas:** no usar `#2F6FEA` en esta variante — ese color es exclusivo del CTA de ancho completo (DEC-009).

---

## CTA primario de ancho completo

- **Finalidad:** única acción principal de la pantalla, a ancho completo.
- **Dimensiones:** altura **56px** y radio **16px** confirmados como comunes. **Ancho dependiente del contexto/frame, sin valor único congelado** (DEC-013, revisada): dos referencias reales confirmadas — **320×56px** ("Comenzar", "Desbloquear", medido de forma vectorial repetida) y **360×56px** ("Guardar cambios", dato manual). La regla de cuándo usar cada ancho es PENDIENTE (ver BACKLOG del documento maestro, punto 14).
- **Relleno:** `#2F6FEA` @ 100%.
- **Borde:** ninguno.
- **Radio:** 16px.
- **Sombra:** ninguna.
- **Tipografía:** 20px `#FFFFFF`, centrado; peso PENDIENTE.
- **Estados:** confirmado un estado inactivo — relleno `#243246` en vez de `#2F6FEA` cuando la acción no está disponible aún (observado en "Desbloquear" del PIN antes de introducir el código). El resto de estados, PENDIENTE.
- **Variantes:** distinto del botón primario compacto (DEC-008).
- **Responsive:** PENDIENTE — puede estar relacionado con la variación de ancho (320 vs. 360), sin confirmar.
- **Ejemplos:** "Comenzar" (Bienvenida, 320px), "Desbloquear" (PIN, 320px), "Guardar cambios" (360px).
- **Reglas prohibidas:** no usar `#3B82F6` en esta variante (DEC-009); no reducir su ancho para convertirlo en el botón compacto; no tratar 320 o 360 como el único ancho válido mientras el pendiente siga abierto.

---

## Botón secundario outline

- **Finalidad:** acción secundaria, incluida "Cancelar".
- **Dimensiones:** **174×48px en contexto de formulario; 85×42.58px en contexto de diálogo** — mismo componente, dos anchos de contexto, ambos CONFIRMADOS DIRECTAMENTE EN FIGMA (DEC-014).
- **Relleno:** transparente.
- **Borde:** `#3A4A60`, 1px, interior (`Stroke` real — DEC-020).
- **Radio:** 16px.
- **Tipografía:** Inter Regular 14px `#FFFFFF`.
- **Estados:** PENDIENTE.
- **Variantes:** "Cancelar" es una instancia de este componente en cualquiera de sus dos contextos (DEC-014).
- **Responsive:** PENDIENTE.
- **Ejemplos:** "Cancelar" en Añadir nota (174×48) y en diálogos (85×42.58).
- **Reglas prohibidas:** no implementarlo como texto sin borde ni fondo.

---

## Botón destructivo

- **Finalidad:** confirmar una acción irreversible final (nunca el punto de entrada).
- **Dimensiones:** 43px de alto confirmado (Detalle contraseña "Eliminar": 120×43; diálogos "Borrar"/"Eliminar": 85×43) — el ancho se adapta al texto/contexto, igual que el resto de botones; no se extrapola ningún otro alto "por coherencia" con el botón secundario.
- **Relleno:** `#DC2626`.
- **Opacidad del relleno:** 80% medido en vector — PENDIENTE de reconfirmación manual.
- **Borde:** `#475569` — mientras no exista verificación manual que lo sustituya (distinto del `#3A4A60` de tarjetas y del botón secundario outline).
- **Opacidad del borde:** PENDIENTE de reconfirmación manual.
- **Radio:** 16px.
- **Tipografía:** `#FFFFFF`, mismo tamaño que el resto de botones de su contexto.
- **Estados:** PENDIENTE.
- **Variantes:** una sola — el mismo componente aparece igual dentro de pantalla completa (Detalle contraseña) y dentro de diálogo.
- **Responsive:** PENDIENTE.
- **Ejemplos:** "Eliminar" (Detalle contraseña), "Borrar"/"Eliminar" (diálogos).
- **Reglas de uso:** solo para la acción final irreversible, nunca para el icono o fila de entrada a una zona de peligro (DEC-007).
- **Reglas prohibidas:** usar `#DC2626` en cualquier icono de punto de entrada; usar el borde `#3A4A60` de superficies en este botón.

---

## Icono estándar

- **Finalidad:** representar visualmente una fila, tarjeta o botón.
- **Dimensiones:** caja de referencia 24×24px (geometría real del trazo entre 20-27px según el glifo, dentro de esa caja).
- **Color:** `#3B82F6`.
- **Estilo:** SVG lineal, `stroke-width` 2px, extremos redondos.
- **Fondo:** ninguno (DEC-005).
- **Opacidad:** 100%.
- **Estados:** PENDIENTE.
- **Variantes:** ver "Icono warning".
- **Ejemplos:** iconos de Seguridad, Google Drive, Notificaciones, Información en el menú de Ajustes.
- **Reglas prohibidas:** emoji en vez de SVG (DEC-017); caja de fondo (DEC-005).

---

## Icono warning

- **Finalidad:** señalar el punto de entrada a una acción sensible (Zona de peligro).
- **Dimensiones:** 24-25px según geometría del path, misma caja de referencia que el icono estándar.
- **Color:** `#F59E0B`.
- **Estilo:** igual que icono estándar.
- **Fondo:** ninguno.
- **Estados:** PENDIENTE.
- **Variantes:** es una variante de color del icono estándar, no un componente distinto en estructura.
- **Ejemplos:** icono de "Zona de peligro" en el menú de Ajustes y en su propia pantalla.
- **Reglas prohibidas:** usar rojo en vez de ámbar para este rol (DEC-007).

---

## Chevron

- **Finalidad:** indicar que una fila navega a otra pantalla.
- **Dimensiones / color / estilo:** no aislado con precisión geométrica propia — PENDIENTE en su totalidad.
- **Reglas de uso:** acompaña a toda fila de navegación (no a filas de solo-información).
- **Reglas prohibidas:** ninguna documentada todavía por falta de dato — no inventar un tamaño.

---

## FAB

- **Finalidad:** acción flotante de creación rápida, visible solo en pantallas de colección.
- **Dimensiones:** 56×56px, circular (radio 28px = mitad exacta).
- **Relleno:** `#3B82F6` @ 100%.
- **Borde:** ninguno.
- **Sombra:** ninguna confirmada.
- **Icono:** blanco, centrado.
- **Estados:** PENDIENTE.
- **Variantes:** ninguna — geometría idéntica confirmada en dos pantallas independientes.
- **Responsive:** PENDIENTE.
- **Ejemplos:** Dashboard, Contraseñas.
- **Reglas prohibidas:** añadir sombra sin que sea una decisión de producto documentada aparte (DEC-004).

---

## Diálogo

- **Finalidad:** confirmación centrada de una acción, generalmente destructiva.
- **Dimensiones:** 300×240px de referencia.
- **Relleno:** `#243246` @ 100%.
- **Radio:** 16px.
- **Borde / sombra:** sin sombra; borde de la superficie del propio diálogo no verificado como elemento separado.
- **Padding:** superior 45px; lateral 34px simétrico; separación título→cuerpo 19px; inferior (a botón) 58px.
- **Tipografía:** título 24px `#FFFFFF` (peso PENDIENTE); cuerpo con los roles estándar de texto.
- **Botones:** botón destructivo (ver ficha) + botón secundario outline 85×42.58px ("Cancelar", DEC-014).
- **Scrim de fondo:** PENDIENTE — el export de diálogo no incluye la pantalla de detrás.
- **Estados:** PENDIENTE.
- **Variantes:** una sola, confirmada en dos diálogos idénticos en estructura.
- **Responsive:** PENDIENTE.
- **Ejemplos:** "Borrar todos los datos", "¿Eliminar 'Google'?".
- **Reglas prohibidas:** ningún radio ni relleno distinto del documentado.

---

## Bottom sheet

- **Finalidad:** panel deslizante desde abajo con opciones o formulario corto.
- **Dimensiones:** 412×494px de referencia.
- **Relleno:** `#243246`, opacidad PENDIENTE (no reconfirmada manualmente).
- **Radio:** 12px — excepcional.
- **Handle:** **no existe confirmado en el diseño inspeccionado — no se inventa uno.**
- **Padding:** superior ≈19px; lateral 24px (igual que el margen estándar de pantalla).
- **Filas interiores:** 84.8px de alto — distinto de las 72px de la fila estándar; PENDIENTE de resolución.
- **Scrim de fondo:** 35% negro — PENDIENTE de reconfirmación manual.
- **Estados:** PENDIENTE.
- **Variantes:** una sola verificada.
- **Responsive:** PENDIENTE.
- **Ejemplos:** "Añadir documento".
- **Reglas prohibidas:** añadir un handle sin que sea una decisión de producto nueva y documentada.

---

## Switch

- **Finalidad:** activar/desactivar una opción (ej. biometría).
- **Dimensiones pista:** 48×28px, radio 14px (cápsula exacta).
- **Color pista (activado):** `#3B82F6`.
- **Dimensiones thumb:** 22×22px, radio 11px (círculo exacto).
- **Color thumb:** `#D9D9D9`.
- **Estados:** solo se verificó el estado **activado** — PENDIENTE el estado desactivado.
- **Ejemplos:** "Desbloqueo biométrico" en Seguridad.
- **Reglas prohibidas:** ninguna documentada más allá de no inventar el estado desactivado sin verificarlo.

---

## Tabs

- **Finalidad:** selector segmentado de categoría dentro de un formulario.
- **Dimensiones del contenedor del grupo:** ~176×50px.
- **Dimensiones de la pestaña activa:** 174×48px, radio 16px, relleno `#3B82F6` @ 100%.
- **Borde:** `#3A4A60`, 1px interior.
- **Tipografía:** PENDIENTE el tamaño exacto del texto de pestaña inactiva.
- **Estados:** activa (documentada arriba); inactiva — PENDIENTE.
- **Ejemplos:** selector Web/WiFi/PIN/Recuperación en Añadir contraseña.
- **Reglas prohibidas:** no confundir con el botón primario compacto — comparten radio y relleno activo, pero el rol es distinto.

---

## Zona de peligro

- **Finalidad:** agrupación de acciones destructivas/irreversibles.
- **Estructura:** usa exclusivamente el componente "Tarjeta / fila estándar" (DEC-015) — no existe una variante de tarjeta propia.
- **Icono:** warning, `#F59E0B` (DEC-007), tanto en la fila de acceso desde Ajustes como en el título de su propia pantalla.
- **Rojo:** reservado exclusivamente para el botón destructivo de confirmación final — nunca en la fila de entrada.
- **Tipografía:** misma jerarquía que cualquier pantalla de Ajustes (título 20px, fila 16px, subtítulo 13px).
- **Ejemplos:** fila "Zona de peligro" en el menú de Ajustes; pantalla propia con 5 filas.
- **Reglas prohibidas:** crear una tarjeta o tipografía especial para esta zona; usar rojo fuera del botón de confirmación final.

