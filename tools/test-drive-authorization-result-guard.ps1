$ErrorActionPreference = 'Stop'

$projectRoot = Join-Path $PSScriptRoot '..'
$sourcePath = Join-Path $projectRoot 'app\src\main\java\com\nogueratech\vaultkey\MainActivity.java'
$gradlePath = Join-Path $projectRoot 'app\build.gradle'
$source = Get-Content -LiteralPath $sourcePath -Raw
$gradle = Get-Content -LiteralPath $gradlePath -Raw

function Assert-SourceMatch {
    param(
        [string] $Pattern,
        [string] $Message
    )

    if ($source -notmatch $Pattern) {
        throw $Message
    }
}

$driveResultStart = $source.IndexOf('if (requestCode == DRIVE_AUTHORIZATION_REQUEST) {')
$localBackupResultStart = $source.IndexOf('if (requestCode == LOCAL_BACKUP_SAVE_REQUEST) {')
if ($driveResultStart -lt 0 -or $localBackupResultStart -le $driveResultStart) {
    throw 'No se encontro el bloque DRIVE_AUTHORIZATION_REQUEST.'
}

$driveResultBody = $source.Substring(
    $driveResultStart,
    $localBackupResultStart - $driveResultStart
)
if ($driveResultBody -match 'awaitingOwnActivityResult\s*=\s*false') {
    throw 'Drive libera awaitingOwnActivityResult dentro de onActivityResult.'
}
if ($driveResultBody -notmatch 'driveAuthorizationResultDelivered\s*=\s*true') {
    throw 'Drive no marca el resultado como entregado.'
}

# Aceptacion: el resultado valido se entrega al callback web sin liberar antes la guarda.
Assert-SourceMatch `
    '(?s)if \(requestCode == DRIVE_AUTHORIZATION_REQUEST\).*?getAuthorizationResultFromIntent\(data\).*?deliverDriveAuthorization\(result\)' `
    'La ruta de aceptacion de Drive no entrega el resultado.'

# Cancelacion/error devuelto por Google: se informa al callback web y la guarda sigue hasta foco.
Assert-SourceMatch `
    '(?s)if \(requestCode == DRIVE_AUTHORIZATION_REQUEST\).*?catch \(ApiException error\).*?failDriveAuthorization\(reportApiException' `
    'La ruta de cancelacion o error de Google no esta cubierta.'

# Recuperacion de foco: revelar primero, liberar despues y solo para un resultado propio entregado.
Assert-SourceMatch `
    '(?s)public void onWindowFocusChanged\(boolean hasFocus\).*?else \{\s*revealContentIfReady\(\);.*?if \(pageReady && awaitingOwnActivityResult &&\s*\(fileChooserResultDelivered \|\| driveAuthorizationResultDelivered \|\|\s*localBackupResultDelivered\)\).*?awaitingOwnActivityResult = false;.*?driveAuthorizationResultDelivered = false;' `
    'La guarda de Drive no se libera despues de recuperar el foco.'

# Inicio y error al abrir: solo se activa si se lanza la actividad; si no sale, se limpia.
Assert-SourceMatch `
    '(?s)driveAuthorizationResultDelivered = false;\s*awaitingOwnActivityResult = true;\s*startIntentSenderForResult.*?catch \(IntentSender.SendIntentException error\) \{\s*awaitingOwnActivityResult = false;\s*driveAuthorizationResultDelivered = false;' `
    'El inicio o el error de apertura de Drive no gestionan la guarda correctamente.'

# Seguridad normal: salir sin un resultado propio sigue cubriendo y bloqueando la boveda.
Assert-SourceMatch `
    '(?s)protected void onPause\(\).*?if \(!awaitingOwnActivityResult\) coverSensitiveContent\(\);' `
    'onPause dejo de aplicar el bloqueo normal.'
Assert-SourceMatch `
    '(?s)protected void onStop\(\).*?if \(!awaitingOwnActivityResult\) coverSensitiveContent\(\);' `
    'onStop dejo de aplicar el bloqueo normal.'
Assert-SourceMatch `
    '(?s)protected void onResume\(\).*?if \(!awaitingOwnActivityResult\) coverSensitiveContent\(\);' `
    'onResume dejo de aplicar el bloqueo normal.'
Assert-SourceMatch `
    '(?s)private void coverSensitiveContent\(\).*?if \(!awaitingOwnActivityResult\).*?typeof lock===.*?lock\(\)' `
    'La cobertura nativa dejo de ejecutar el bloqueo normal.'

if ($gradle -notmatch "(?s)driveAuthGuard\s*\{.*?applicationIdSuffix '\.driveauthguard'.*?debuggable true") {
    throw 'No existe una variante diagnostica independiente para la guarda de Drive.'
}

Write-Output 'PASS: retorno de Drive retenido hasta foco; aceptacion, cancelacion, error y bloqueo normal cubiertos.'
