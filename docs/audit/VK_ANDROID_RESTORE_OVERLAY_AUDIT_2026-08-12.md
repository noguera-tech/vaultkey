# VaultKey — Auditoría de restauración, confirmaciones y overlays Android

Fecha: 2026-08-12
Rama: `fix/android-header-safe-area`
Estado: inventario técnico, sin cambios funcionales.

## Alcance

Este bloque revisa los flujos de restauración/importación y su relación con overlays, teclado, viewport dinámico, botones inferiores y safe-area en Android/WebView.

## Hallazgos

### R-01 — Restauración usa dos pasos modales encadenados

El flujo VaultKey 2.0 pide primero credencial (`openRestoreCredentialModal`) y después PIN (`openRestorePinModal`). Ambos modales se abren programáticamente, enfocan un input tras 150 ms y permiten confirmar mediante Enter.

Implicación Android: al enfocar automáticamente el input, el teclado reduce el viewport visual (`interactive-widget=resizes-content`). El modal debe tolerar esa reducción sin cortar título, input ni acciones.

### R-02 — El PIN de restauración es estrictamente de 6 dígitos

`openRestorePinModal` filtra caracteres no numéricos, limita a 6 dígitos y rechaza confirmación si no coincide con `^\d{6}$`.

Implicación de UI: no se debe resolver un recorte ocultando contenido o desplazando el botón fuera de la vista; el usuario necesita ver simultáneamente campo, ayuda y acción principal.

### R-03 — La restauración puede mantener el modal abierto durante validación asíncrona

La credencial se valida antes de cerrar el modal. Mientras se verifica, se deshabilitan input y botones y el texto de la acción cambia a `Verificando...`. Si falla, el modal permanece abierto y se devuelve el foco al input.

Implicación Android: la geometría debe ser estable entre estados normal, teclado abierto y estado de validación; no debe saltar el footer ni cambiar la posibilidad de scroll de forma inesperada.

### R-04 — Existe además un flujo de importación legacy independiente

`openImportModal` usa `importModal` con pasos internos (`importStep1`, `importStep2`) y enfoca `importPinInput` después de 300 ms. Es otra arquitectura distinta de restauración que debe entrar en la matriz visual aunque no sea el flujo VK2 principal.

### R-05 — Los overlays legacy conservan geometría inline

`app.html` mantiene `urlModal`, `noteModal`, `quickModal` y `recoveryModal` con alturas máximas o fullscreen definidas inline. `recoveryModal` usa `max-height:92dvh`; `quickModal` fuerza `height:100dvh; max-height:none`.

Esto confirma que una corrección CSS global no basta si un inline style conserva mayor prioridad o define otra geometría.

### R-06 — La capa final de bottom sheets ya intenta unificar varios sistemas, pero no todos

`csp-overrides.css` agrupa `vk-create-picker`, document sheets, backup sheet, Drive picker y health sheet bajo un lenguaje visual común. Sin embargo, restauración/confirmaciones no aparecen dentro de ese contrato unificado.

Decisión: restauración y confirmaciones deben tener contrato geométrico propio o incorporarse explícitamente al contrato común; no asumir que ya heredan el arreglo de bottom sheets.

### R-07 — Se detectó una duplicación temporal de safe-area en el generador que luego fue neutralizada

La rama contiene una regla inicial que añade safe-area al panel del generador y también a acciones, seguida por la V2 validada que pone `padding-bottom:0` en acciones para evitar aplicar el inset dos veces.

Lección de arquitectura: cada familia debe declarar un único propietario del safe-area inferior. Esto será una regla de aceptación para restauración, confirmaciones y sheets.

## Contrato requerido para restauración/confirmación

1. `max-height` basado en `dvh`, no en `vh` clásico cuando el teclado/viewport pueda variar.
2. Contenedor principal con `min-height:0`.
3. Cuerpo central scrollable solo cuando sea necesario.
4. Título y acciones no deben desaparecer por overflow del cuerpo.
5. Safe-area inferior aplicada exactamente una vez.
6. Al abrir teclado, input activo debe seguir visible.
7. Al cerrar teclado, no debe quedar scroll residual.
8. Estados de validación (`Verificando...`, error, re-foco) no deben cambiar la geometría de forma brusca.
9. Enter/Escape y botones táctiles deben seguir siendo equivalentes funcionalmente.
10. No mezclar cambios de criptografía/restauración con ajustes visuales.

## Casos de prueba obligatorios

- Restaurar VK2 con credencial correcta + PIN correcto.
- Credencial incorrecta: modal permanece abierto y campo visible.
- PIN con menos de 6 dígitos: mensaje/toast y campo visible.
- Teclado abierto en credencial.
- Teclado abierto en PIN.
- Cancelar desde credencial.
- Atrás desde PIN.
- Importación legacy paso 1 y paso 2.
- Recovery modal con contenido largo.
- Altura de pantalla reducida.

## Decisión para el primer parche estructural

No modificar aún la lógica JS. La primera APK estructural debe limitarse a CSS/estructura visual y probar representantes de cabeceras + un modal de restauración + un sheet. Si ese patrón funciona, se generaliza por familia.