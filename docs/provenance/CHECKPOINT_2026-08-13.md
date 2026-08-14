# Procedencia del checkpoint Android/WebView

## Fuente preservada

La base canónica procede de:

`C:\Users\alank\Documents\Codex\01_WORK_ACTIVE\VaultKey_ANDROID_WEBVIEW_CHECKPOINT_2026-08-13`

La copia se realizó sin modificar el checkpoint. Se excluyeron datos regenerables o específicos del equipo:

- `.android-user-home/`
- `.gradle/`
- `.gradle-user-home/`
- `.idea/`
- todos los directorios `build/`
- `local.properties`
- `keystore.properties`

Los 63 archivos fuente relevantes del checkpoint están registrados en `preservation/checkpoint-source-sha256.txt`.

## APK validado

El APK instalado y probado se preserva fuera del índice Git en:

`artifacts/validated/app-debug-validated-39a5e8d0.apk`

Datos verificados:

- Tamaño: 4.508.247 bytes.
- SHA-256: `39a5e8d0d85bfc67cfb6292d0cc506485c9f015ef435dcd24461a9eddf7819fb`.
- Paquete: `com.nogueratech.vaultkey`.
- Versión: `2.7.0-webview-candidate`, código 36.
- Variante: debug.
- Firma: Android Debug; verificación v1 y v2 correcta.
- Certificado SHA-256: `262c21b90db0b2ab7f54ac288f9146f6d45387d94c2b05bab0f1cab62e65a412`.

Este artefacto prueba la identidad de la versión validada, pero no es un APK de producción.

## Limpieza posterior

El primer commit conserva cinco copias `app.js*.bak` y el `build-info.json` original porque formaban parte de los activos empaquetados. El segundo commit los retira de la fuente activa. Su contenido continúa recuperable desde el primer commit y desde el checkpoint inmutable.

No se modificó código funcional durante esta limpieza.

