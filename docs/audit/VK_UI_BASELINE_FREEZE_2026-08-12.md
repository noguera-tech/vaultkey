# VaultKey — UI Baseline estable — 2026-08-12

## Estado

Esta versión se declara **baseline estable de UI** tras revisión física completa en dispositivo Android.

Regla de trabajo a partir de este punto:

- No realizar nuevos ajustes visuales globales.
- No modificar cabeceras, safe-area, FAB, botones inferiores o geometrías ya validadas salvo que exista una incidencia reproducible.
- Cualquier cambio funcional futuro debe partir de esta baseline.
- Antes de integrar cambios funcionales, revisar regresiones visuales en las pantallas afectadas.
- Mantener separadas las autorizaciones de edición, commit, push, PR y merge.

## Validado físicamente

### Cabeceras / safe-area
- Dashboard.
- Contraseñas: lista, detalle, edición y alta.
- Notas: lista, detalle, crear y editar.
- Tarjetas: lista, detalle, crear y editar.
- Documentos: lista, vista previa, elegir tipo, crear y editar.
- Favoritos.
- Ajustes.
- Seguridad.
- Cambiar contraseña maestra.
- Cambiar PIN.
- Bloqueo automático.
- Kit de emergencia.
- Zona de peligro.
- Copia local.
- Google Drive.
- Interacción.
- Notificaciones.
- Información.

### Acciones inferiores / FAB
- FAB `+` de Notas.
- FAB `+` de Tarjetas.
- FAB `+` de Documentos.
- Vista previa de documento: Repetir / Continuar.
- Crear documento: Cancelar / Crear.
- Editar documento: Cancelar / Guardar.
- Editar tarjeta: Cancelar / Guardar.
- Cambiar PIN: Guardar cambios.
- Confirmaciones de Restablecer VaultKey.
- Confirmaciones de Borrar bóveda local.
- Confirmaciones de Desconectar Google Drive.
- Crear copia de seguridad.

### Funcionalidad validada durante la pasada
- Cámara de Documentos abre correctamente.
- Captura y retorno a VaultKey sin salto indebido al PIN.
- Importación/flujo de documentos conservado.
- CVV limitado a 3 dígitos.
- Selector Web / Wi-Fi / PIN / Recuperación corregido.
- Autobloqueo “Inmediatamente” validado: bloquea al salir de la app.
- Hápticos/vibración validados tras añadir permiso Android `VIBRATE`.
- Favoritos en Seguridad correctamente alineado.
- Dashboard alineado visualmente.
- Estado de tu bóveda ajustado visualmente.

## Notas para manual de usuario

- “Inmediatamente” en autobloqueo significa **bloquear al salir de VaultKey**; no bloquea mientras el usuario continúa dentro de la app.
- Para restaurar una copia de seguridad se necesita la **contraseña maestra con la que se creó esa copia**.
- Abrir la cámara o el selector de archivos desde VaultKey no debe interpretarse como abandonar la app; al volver se continúa el flujo.
- Queda como mejora futura de usabilidad añadir icono de ojo para mostrar/ocultar en Restaurar copia y campos de PIN.

## Mejoras futuras, no incluidas en esta baseline

- Copia de seguridad automática tras cambios confirmados, con fallo de backup no bloqueante.
- Revisión futura del manual de usuario completo.
- Cualquier nueva mejora funcional debe implementarse sin reabrir la normalización visual ya validada.

## Criterio de congelación

Esta baseline se considera el punto de partida estable para futuros cambios. Si una modificación futura provoca una regresión visual, la referencia para comparar es esta versión.
