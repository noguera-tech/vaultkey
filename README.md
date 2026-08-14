# VaultKey Android WebView — base canónica

Esta carpeta es la base de trabajo canónica creada a partir del checkpoint Android/WebView validado el 14 de agosto de 2026.

## Estado validado

- Aplicación probada correctamente en el teléfono.
- Paquete Android: `com.nogueratech.vaultkey`.
- Versión del checkpoint: `2.7.0-webview-candidate` (`versionCode 36`).
- APK validado: variante `debug`, no apta para producción.
- SHA-256 del APK: `39a5e8d0d85bfc67cfb6292d0cc506485c9f015ef435dcd24461a9eddf7819fb`.

El checkpoint original permanece fuera de este repositorio y no debe modificarse:

`C:\Users\alank\Documents\Codex\01_WORK_ACTIVE\VaultKey_ANDROID_WEBVIEW_CHECKPOINT_2026-08-13`

## Historial local

El primer commit conserva la fuente correspondiente al checkpoint validado, incluidos los archivos históricos que estaban empaquetados en aquel APK. El segundo commit elimina esos archivos auxiliares de la fuente activa y documenta su procedencia.

El APK conservado en `artifacts/validated/` está excluido de Git. Su identidad se registra en `preservation/validated-apk-sha256.txt`.

## Restricciones actuales

- No publicar ni distribuir el APK debug.
- No considerar esta versión firmada para producción.
- No integrar en `main` sin una revisión específica.
- No mezclar esta base con el proyecto TWA histórico: son arquitecturas diferentes.
- No incorporar credenciales, claves, `local.properties`, cachés ni salidas de compilación.

## Procedencia web

La base web lógica es el commit `785985817cd93d2a72261357bd7cda4411bfb915` de `noguera-tech/vaultkey`. La relación es documental y por hashes; no se presenta como parentesco Git directo porque los activos se copiaron manualmente al proyecto Android.

Consulta `docs/provenance/` y los manifiestos de `preservation/` antes de preparar cualquier integración.

