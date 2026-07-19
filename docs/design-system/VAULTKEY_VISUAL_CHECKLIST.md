# VAULTKEY — CHECKLIST VISUAL OBLIGATORIA

**Versión:** 1.0-rc1
**Estado:** CANDIDATO A CONGELACIÓN — pendiente de revisión final antes de commit.
**Fecha:** 2026-07-19
**Autoría:** análisis Sonnet + verificación manual del propietario en el panel de Figma
**Revisión obligatoria antes del commit.**

Se rellena para **cada pantalla** antes de darla por integrada. Cada pregunta se responde **Sí** o **No**.
Cualquier "No" en un ítem normativo bloquea la integración hasta resolverse. **Ningún ítem de esta
checklist exige un valor que esté en el BACKLOG VISUAL PENDIENTE del documento maestro** — donde el sistema
todavía no tiene un dato cerrado, la pregunta correspondiente no aparece aquí como bloqueante.

Referencia normativa: `VAULTKEY_VISUAL_MASTER_v1.0.md` y `VAULTKEY_COMPONENT_CATALOG.md`.

---

**Pantalla:** ______________________ **Fecha:** __________ **Responsable:** ______________________

## Fondo y degradado

- [ ] ¿Usa exactamente `linear-gradient(180deg, #111827 17%, #182F4E 67%)` como fondo de pantalla completa (o la superficie de diálogo/bottom sheet correspondiente si aplica)? Sí/No
- [ ] ¿No declara ningún color o degradado de fondo propio distinto del anterior? Sí/No
- [ ] ¿No existe ningún `!important` nuevo forzando el fondo sobre una regla base? Sí/No

## Tipografía

- [ ] ¿La familia tipográfica es Inter (con el fallback aprobado)? Sí/No
- [ ] ¿Cada texto usa uno de los roles tipográficos de §9 del documento maestro (tamaño, y peso donde esté confirmado)? Sí/No
- [ ] ¿Ningún peso tipográfico está fuera de la escala estándar de 100 en 100 (nada tipo 850)? Sí/No
- [ ] ¿El color y la opacidad del texto coinciden con los de su rol (§9)? Sí/No

## Color

- [ ] ¿Todo color usado aparece en la tabla de §2 del documento maestro? Sí/No
- [ ] ¿No hay ningún hex o rgba nuevo hardcodeado fuera de esa tabla? Sí/No
- [ ] ¿Se ha respetado la separación entre `#3B82F6` (icono/botón compacto) y `#2F6FEA` (CTA completo), sin mezclarlos? Sí/No
- [ ] ¿El rojo (`#DC2626`) aparece únicamente en un botón de confirmación destructiva final, nunca en un icono de entrada? Sí/No

## Radio

- [ ] ¿Todo radio usado está en la lista confirmada (6 / 12 / 16 / 20 / 28 / 999px) de §6? Sí/No
- [ ] ¿Se ha usado 16px salvo que el componente sea uno de los 4 casos excepcionales documentados? Sí/No
- [ ] ¿No se ha creado ningún radio nuevo sin verificarlo antes en Figma y añadirlo al sistema? Sí/No

## Borde

- [ ] ¿El borde de superficies (tarjeta/fila/input/diálogo) y del botón secundario outline usa `#3A4A60`, 1px, interior? Sí/No
- [ ] ¿El borde del botón destructivo usa `#475569` (mientras no exista una verificación manual que lo sustituya)? Sí/No
- [ ] ¿No se ha usado `#475569` en el botón secundario outline, ni `#3A4A60` en el botón destructivo? Sí/No

## Iconos

- [ ] ¿Todos los iconos son SVG lineales, no emoji? Sí/No
- [ ] ¿El `stroke-width` es 2px en todos los iconos? Sí/No
- [ ] ¿Los extremos de línea (`linecap`/`linejoin`) son redondos? Sí/No
- [ ] ¿Ningún icono tiene una caja o fondo decorativo detrás? Sí/No
- [ ] ¿El color del icono es `#3B82F6` (estándar) o `#F59E0B` (warning), según corresponda? Sí/No

## Tarjetas y filas

- [ ] ¿Reutiliza el componente "Tarjeta / fila estándar" del catálogo en vez de crear uno nuevo equivalente? Sí/No
- [ ] ¿El relleno está al 100% de opacidad (no 60%)? Sí/No
- [ ] ¿Las dimensiones coinciden con las del catálogo (365×72 para fila estándar, u otra ficha aplicable)? Sí/No

## Botones

- [ ] ¿Se ha identificado correctamente si el botón es primario compacto, CTA completo, secundario outline o destructivo, usando la ficha correspondiente del catálogo? Sí/No
- [ ] ¿El botón "Cancelar" (si existe) es secundario outline —borde `#3A4A60`, fondo transparente—, en el ancho correcto según su contexto (174×48 en formulario, 85×42.58 en diálogo)? Sí/No
- [ ] ¿No se ha mezclado el color de un botón compacto con el de un CTA completo? Sí/No
- [ ] Si la pantalla usa un CTA de ancho completo, ¿su ancho es uno de los dos confirmados (320px o 360px), justificado por el contexto? Sí/No

## Inputs

- [ ] ¿Se ha identificado correctamente si el campo es input estándar (53px, radio 16), input compacto (radio 6px) o textarea (96px, radio 16)? Sí/No
- [ ] ¿El label del textarea es de 14px, no 13px? Sí/No

## Espaciado

- [ ] ¿El margen lateral de pantalla es 24px? Sí/No
- [ ] ¿La separación entre tarjetas/filas es 15px? Sí/No
- [ ] ¿No se ha inventado una escala de espaciado distinta a la documentada en §11? Sí/No

## Responsive

- [ ] ¿Se ha probado la pantalla en algún ancho distinto del viewport de referencia (412px)? Sí/No — no bloqueante; el comportamiento responsive general está en el backlog. Registrar el resultado igualmente.

## Ausencia de sombras

- [ ] ¿Ningún componente de la pantalla lleva `box-shadow` no documentado? Sí/No
- [ ] Si se ha añadido una sombra nueva, ¿está registrada como decisión de producto explícita en `VAULTKEY_VISUAL_DECISIONS.md`? Sí/No/No aplica

## Ausencia de emojis

- [ ] ¿Cero emojis en toda la pantalla, incluidos textos de ayuda y notificaciones? Sí/No

## Ausencia de inline styles

- [ ] ¿No hay ningún `style="..."` inline para un valor que ya tiene token en el sistema? Sí/No

## Ausencia de `!important` nuevos

- [ ] ¿No se ha añadido ningún `!important` nuevo para forzar un valor sobre una regla base? Sí/No
- [ ] Si existía un `!important` previo que este cambio hacía innecesario, ¿se ha retirado en un commit de limpieza separado (no mezclado con la integración visual)? Sí/No/No aplica

## Colores hardcodeados

- [ ] ¿Se ha verificado con `grep`/búsqueda de texto que no queda ningún hex/rgba nuevo fuera de las variables del sistema? Sí/No

## Reutilización de componentes

- [ ] ¿Se ha consultado `VAULTKEY_COMPONENT_CATALOG.md` antes de construir cualquier pieza visual? Sí/No
- [ ] ¿Ningún componente de esta pantalla duplica, con implementación distinta, uno ya existente en el catálogo? Sí/No
- [ ] Si ha hecho falta un componente que no existía en el catálogo, ¿se ha añadido primero al catálogo antes de usarse en la pantalla? Sí/No/No aplica

## Comparación con Figma

- [ ] ¿Se ha comparado la pantalla, elemento a elemento, contra el frame correspondiente del `.fig`/PDF? Sí/No
- [ ] ¿Se ha verificado en el panel de Figma cualquier valor que este sistema marca como PENDIENTE en el backlog y que la pantalla necesita? Sí/No/No aplica

## Comprobación en Chrome real

- [ ] ¿Se ha abierto la pantalla en Chrome real (no solo en un renderizador automático tipo wkhtmltoimage)? Sí/No

## Prueba de navegación

- [ ] ¿Se ha probado el botón Atrás de Android/navegador? Sí/No
- [ ] ¿Se ha probado el swipe entre pantallas raíz, si la pantalla es una de ellas? Sí/No
- [ ] ¿Se ha confirmado que la pantalla no se ha añadido a `NAV_ORDER` si es una subpantalla que no debería estarlo? Sí/No/No aplica

## Validación funcional

- [ ] ¿Todos los elementos interactivos de la pantalla (botones, filas, toggles) tienen su `onclick`/listener funcionando, y no quedan huérfanos visualmente listos pero sin lógica? Sí/No
- [ ] ¿Se ha revisado `git diff` para confirmar que no se ha tocado ningún archivo de seguridad/cripto/storage/sesión/autenticación/PIN/master/kit/Drive? Sí/No

## Diff visual antes/después

- [ ] ¿Existe una captura de "antes" y "después" de esta integración? Sí/No
- [ ] ¿La diferencia observada corresponde únicamente a lo que se pretendía cambiar, sin efectos colaterales en otras pantallas (por ejemplo, por una regla CSS global o un `nth-child` desalineado)? Sí/No

---

## Nota sobre implementación técnica del borde

El sistema especifica el borde como `Stroke` real (color, opacidad, 1px, posición interior) — **no hay
ninguna prohibición de usar `border` o `stroke` de CSS/SVG para implementarlo**. La técnica de "forma
duplicada" observada en el PDF exportado por Figma es un artefacto de ese exportador concreto, no una
restricción de la implementación real (ver DEC-020).

---

## Resultado

- Preguntas totales: ______
- Respondidas "Sí": ______
- Respondidas "No" (bloqueantes): ______
- Respondidas "Pendiente"/"No aplica" con justificación registrada: ______

**Pantalla aprobada para integrar: Sí / No**

Si "No", listar aquí los puntos bloqueantes antes de continuar:

1. ___________________________________________
2. ___________________________________________
3. ___________________________________________
