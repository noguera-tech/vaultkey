# Acta del candidato VaultKey 2.7.0 (36)

Fecha: 2026-08-15

## Identidad del candidato

- Rama local: `release/v2.7.0-candidate-2026-08-15`
- Commit de configuración: `ec6eb34e3e96fca7ae253fca7588f01a8277b597`
- Base validada: `04ed6781d50ff921dac757f5e2fc1c00ae0d1d2e`
- Paquete: `com.nogueratech.vaultkey`
- `compileSdk`: 36
- `targetSdk`: 36
- `minSdk`: 23
- `versionCode`: 36
- `versionName`: `2.7.0`

## Firma local

La configuración local `keystore.properties`, ignorada por Git, fue corregida y validada con la clave de subida existente. La contraseña no se registró en esta acta ni en Git.

- Alias: `upload`
- Propietario: `CN=VaultKey Admin, O=Noguera Technologies, C=ES`
- Validez: 2026-06-08 a 2053-10-24
- SHA-1: `48:8C:77:D9:18:83:A7:7F:2B:57:82:D6:F4:7A:C7:D6:2F:DA:E3:A2`
- SHA-256: `6F:62:F2:8D:73:B2:78:2B:5F:15:8F:97:7C:1B:D6:0A:A9:8D:F0:42:FB:2A:4F:F4:84:67:00:7A:7E:58:C9:45`

Las huellas coinciden exactamente con el certificado de subida registrado en Google Play Console. La afirmación provisional anterior de que la contraseña no podía validarse queda expresamente superada por esta comprobación.

## AAB generado

- Archivo: `artifacts/release-candidate-2026-08-15/VaultKey-2.7.0-v36-release-candidate-2026-08-15.aab`
- Tamaño: 2.805.813 bytes
- SHA-256: `54C4BFABBD7BE9BFE9BEE3D47A5302BE693785A9AD15E6794363B7EF7DD28144`
- Construcción: `bundleRelease` completada correctamente en modo offline.
- Firma: certificado de subida anterior; `jarsigner -verify` correcto.
- Bundletool: validación correcta.

El modo estricto de `jarsigner` advierte que el certificado de subida es autofirmado, carece de una cadena PKIX pública y no incluye sello de tiempo. Estas advertencias son coherentes con una clave privada de subida y no invalidan la integridad del AAB; la verificación normal devuelve `jar verified`.

## Verificación del artefacto

El manifiesto incluido en el propio AAB declara:

- `package="com.nogueratech.vaultkey"`
- `android:versionCode="36"`
- `android:versionName="2.7.0"`
- `android:minSdkVersion="23"`
- `android:targetSdkVersion="36"`
- `android:compileSdkVersion="36"`

El bundle contiene 205 entradas. Se confirmaron el manifiesto, los DEX, los recursos web principales, Drive, copias, iconos normal y redondo. No aparecieron nombres ni identificadores de las variantes diagnósticas en rutas o archivos de texto del AAB.

## Pruebas previas conservadas

- Guarda de cámara/selector: PASS.
- Secuencia de arranque Figma: PASS.
- Lote de siete incidencias: PASS.
- Prueba Gradle diagnóstica: `BUILD SUCCESSFUL` (`NO-SOURCE`).
- Compilación Java `release`: `BUILD SUCCESSFUL`.
- Procesamiento de manifiesto `release`: PASS.

## Límites de esta fase

No se instaló el candidato, no se subió a Google Play, no se creó ninguna versión en Play Console, no se publicó y no se realizó ninguna operación en GitHub. El AAB debe conservarse sin sobrescribir. Cualquier instalación, subida o publicación requiere una autorización posterior expresa.
