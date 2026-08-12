# VaultKey — Plan de normalización de AppBar

Fecha: 2026-08-12
Rama: `refactor/unify-appbar-family-a`
Estado: diseño técnico previo a cambios funcionales.

## Objetivo

Reducir las múltiples implementaciones históricas de cabecera a un contrato común y mantenible, sin repetir el experimento global que rompió geometría, interacción y encoding.

## Contrato objetivo

- Altura visual estándar: 64 px.
- Zona táctil de acciones: 48 x 48 px.
- Icono interior: 24 x 24 px.
- Título centrado/alineado según la semántica de cada pantalla.
- Safe-area superior Android añadida de forma explícita y separada de la altura visual.
- Ningún cambio de HTML ni JavaScript durante la primera migración.
- Ningún cambio de scroll, footer, modal o teclado en el mismo parche.

## Principios de migración

1. Migración por familias, nunca por selector global.
2. Cambiar cabecera y cálculo de contenido asociado en el mismo commit cuando exista dependencia de altura.
3. No usar `!important` para imponer la nueva geometría salvo conflicto probado e inevitable.
4. No reescribir `app.html` desde PowerShell.
5. No tocar encoding.
6. Mantener rollback trivial: cada familia debe poder revertirse sin afectar las demás.
7. Validación física Android antes de extender el patrón.

## Orden de migración

### Fase A1 — Familia A, secciones principales

Pantallas:
- Contraseñas lista
- Notas lista
- Tarjetas lista
- Documentos lista
- Favoritos
- Ajustes
- Seguridad

Motivo: ya comparten `vk-section-header`; es la familia más adecuada para fijar el estándar de 64 px.

Riesgo conocido: `.vk-section-header` usa `height/min-height/flex` con `!important`, mientras Seguridad tiene reglas propias históricas. Antes de cambiar nada hay que resolver esa colisión sin alterar iconos ni contenido.

### Fase A2 — Editores de 64 px

Pantallas:
- Nota detalle/crear/editar
- Tarjeta detalle/crear/editar
- Documento vista previa/crear/detalle/editar

Motivo: ya usan 64 px de forma natural. La normalización debería limitarse a estructura de AppBar y safe-area.

### Fase A3 — Contraseñas 56 px

Pantallas:
- Detalle
- Editar
- Crear

Motivo: requieren migración explícita de 56 a 64 px y revisión del espacio de formulario. Se realizará solo después de validar A1/A2.

### Fase A4 — Ajustes secundarios

Pantallas:
- Cambio contraseña maestra
- Cambio PIN
- Kit de emergencia
- Zona de peligro
- Información
- Drive/Copia local
- Autobloqueo
- Interacción
- Notificaciones

Motivo: tienen alturas históricas heterogéneas (62/64/72/74 px) y varios contenidos calculados con `100dvh - Npx`.

## Primera implementación permitida

La primera prueba funcional se limitará a Familia A1 y debe cumplir:

- no modificar tamaño de iconos;
- no modificar padding lateral salvo que sea estrictamente necesario para preservar el diseño existente;
- no modificar botones, campos, formularios, modales ni sheets;
- no modificar JavaScript;
- no modificar `app.html`;
- mantener 64 px de altura visual;
- añadir safe-area superior sin alterar el centro visual de la barra;
- ajustar únicamente el contenido que hoy dependa directamente de la altura de esa misma cabecera.

## Criterio de aprobación A1

En Android deben verificarse, al menos, Contraseñas, Notas, Tarjetas, Documentos, Favoritos, Ajustes y Seguridad:

- ningún icono bajo barra de estado;
- ninguna acción desplazada horizontalmente;
- zonas táctiles funcionales;
- títulos y contenidos en su posición previa salvo el desplazamiento vertical necesario por safe-area;
- ausencia de scroll nuevo;
- ausencia de campos, botones o textos desplazados;
- ausencia de regresiones de interacción.

Solo tras aprobar A1 se migrará A2.
