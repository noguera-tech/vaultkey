# Acta del candidato VaultKey 2.7.0 v37 — 2026-08-15

## Alcance

Candidato release local creado desde `b42d95a48c79dddb53258a0fcc938700fb43cf6d`, que contiene la corrección validada de la guarda del retorno de autorización de Google Drive. El único cambio adicional del candidato es `versionCode 37`; se mantiene `versionName 2.7.0`.

Rama local: `release/v2.7.0-v37-candidate-2026-08-15`.

No se instaló ninguna APK, no se subió el bundle y no se modificaron Google Cloud, Play Console, Alpha, producción ni GitHub.

## Artefacto

Archivo: `artifacts/release-candidate-v37-2026-08-15/VaultKey-2.7.0-v37-release-candidate-2026-08-15.aab`

- Tamaño: 2.805.928 bytes
- SHA-256: `C11D7B2B6F707324973F14FBA048935372E627560D2840BBBA205E583EBEDD65`
- Generación: `bundleRelease`, satisfactoria
- Firma JAR: verificada

El bundle se generó en un directorio de construcción nuevo para no sobrescribir el AAB v36 existente.

## Identidad y SDK

Comprobados en los metadatos de salida y en el manifiesto release combinado:

- Paquete: `com.nogueratech.vaultkey`
- `versionCode`: `37`
- `versionName`: `2.7.0`
- `minSdk`: `23`
- `targetSdk`: `36`
- Variante: `release`

## Certificado de subida

El certificado contenido en el AAB coincide con el certificado de subida registrado en Google Play Console:

- Propietario: `CN=VaultKey Admin, O=Noguera Technologies, C=ES`
- SHA-1: `48:8C:77:D9:18:83:A7:7F:2B:57:82:D6:F4:7A:C7:D6:2F:DA:E3:A2`
- SHA-256: `6F:62:F2:8D:73:B2:78:2B:5F:15:8F:97:7C:1B:D6:0A:A9:8D:F0:42:FB:2A:4F:F4:84:67:00:7A:7E:58:C9:45`
- Validez: 8 de junio de 2026 a 24 de octubre de 2053

La advertencia de cadena autofirmada de `jarsigner` es la esperada para una clave privada de subida; la integridad de la firma fue verificada y la huella coincide con Play Console.

## Contenido y regresiones

El AAB contiene 205 entradas. Se comprobaron como presentes el manifiesto, los DEX, `BundleConfig.pb`, `drive.js`, `app.js` e `index.html`. No aparecieron nombres de variantes diagnósticas en las rutas del bundle.

Pasaron las pruebas estructurales de:

- Retorno de autorización de Drive: aceptación, cancelación, error y recuperación de foco.
- Conservación del bloqueo normal fuera del flujo autorizado.
- Regresión de cámara y selector.
- Incidencias pendientes y secuencia de arranque.

La prueba histórica del icono compara contra el alcance cerrado de su antigua rama diagnóstica y rechaza cambios funcionales acumulados posteriores, incluida `MainActivity.java`; por ello no es aplicable como prueba global de este candidato. Los recursos de icono permanecen incluidos en el bundle.

## Estado

El AAB v37 queda verificado como candidato local para una futura publicación exclusivamente en Prueba interna. Cualquier subida requiere una autorización posterior y separada.
