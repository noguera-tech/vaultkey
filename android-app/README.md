# VaultKey — Android WebView nativo (snapshot 13-08-2026)

Este directorio contiene el snapshot del proyecto Android nativo (WebView embebido) tal como estaba el 13 de agosto de 2026, subido como respaldo de emergencia.

## Contexto

Este proyecto reemplaza el enfoque anterior basado en TWA (Trusted Web Activity, ver rama `main` del repositorio) por una app Android nativa con WebView embebido y logica propia en Java (`MainActivity.java`).

## Estado de este snapshot

- **versionCode:** 36 (`2.7.0-webview-candidate`)
- **NO es la version final.** La version publicada en pruebas cerradas de Google Play es **v38** (versionCode 38), que incluye ademas `CryptoManager.java`, `StorageManager.java`, `DriveManager.java` y el modulo completo de criptografia, ninguno de los cuales esta en este snapshot.
- Este snapshot se subio como medida de seguridad para tener AL MENOS una copia en la nube del cambio de arquitectura TWA -> WebView nativo.

## Pendiente

Subir el proyecto completo desde el equipo local (`VaultKey_ANDROID_WEBVIEW_CANONICAL`), que contiene el codigo final de v38, incluyendo:

- `CryptoManager.java` (cifrado AES-256, PBKDF2)
- `StorageManager.java` (guardar/restaurar datos)
- Correcciones de camara, splash de Figma, panel de estado opaco, y demas incidencias resueltas hasta el 15-08-2026

## Que NO esta incluido aqui (intencionalmente)

- `keystore.properties` (contiene rutas y contrasenas de firma — nunca debe subirse a un repositorio, ni siquiera privado)
- Carpetas `build/`, `.gradle/`, `.idea/` (cache y compilados, se regeneran solos)
- Archivos `.bak` de ediciones intermedias
