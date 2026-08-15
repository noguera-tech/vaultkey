$ErrorActionPreference = 'Stop'

$projectRoot = Join-Path $PSScriptRoot '..'
$nativePath = Join-Path $projectRoot 'app\src\main\java\com\nogueratech\vaultkey\MainActivity.java'
$webPath = Join-Path $projectRoot 'app\src\main\assets\web\app.js'
$gradlePath = Join-Path $projectRoot 'app\build.gradle'
$native = Get-Content -LiteralPath $nativePath -Raw
$web = Get-Content -LiteralPath $webPath -Raw
$gradle = Get-Content -LiteralPath $gradlePath -Raw

function Assert-Match {
    param([string] $Text, [string] $Pattern, [string] $Message)
    if ($Text -notmatch $Pattern) { throw $Message }
}

$localStart = $native.IndexOf('if (requestCode == LOCAL_BACKUP_SAVE_REQUEST) {')
$superStart = $native.IndexOf('super.onActivityResult(requestCode, resultCode, data);')
if ($localStart -lt 0 -or $superStart -le $localStart) {
    throw 'No se encontro el resultado del selector de copia local.'
}
$localBody = $native.Substring($localStart, $superStart - $localStart)
if ($localBody -match 'awaitingOwnActivityResult\s*=\s*false') {
    throw 'El resultado de copia local libera la guarda directamente.'
}

# Destino vacio/cancelacion y resultado de escritura, correcto o con error.
Assert-Match $localBody `
    '(?s)destination == null.*?deliverLocalBackupResult\(false, "Guardado cancelado"\);\s*markLocalBackupResultDelivered\(\);' `
    'La cancelacion o el destino vacio no conservan la salida segura.'
Assert-Match $localBody `
    '(?s)catch \(IOException error\).*?deliverLocalBackupResult\(result, detail\);\s*markLocalBackupResultDelivered\(\);' `
    'El exito o error de escritura no marcan el resultado antes de liberar la guarda.'

# Si el foco ya volvio, se libera; si no, onWindowFocusChanged la retiene.
Assert-Match $native `
    '(?s)private void markLocalBackupResultDelivered\(\).*?localBackupResultDelivered = true;.*?if \(pageReady && hasWindowFocus\(\)\).*?awaitingOwnActivityResult = false;' `
    'La guarda local no espera a que el foco este recuperado.'
Assert-Match $native `
    '(?s)onWindowFocusChanged\(boolean hasFocus\).*?revealContentIfReady\(\);.*?localBackupResultDelivered.*?awaitingOwnActivityResult = false;' `
    'La recuperacion diferida de foco no contempla la copia local.'

# Inicio y fallo al abrir el selector.
Assert-Match $native `
    '(?s)localBackupResultDelivered = false;\s*awaitingOwnActivityResult = true;\s*startActivityForResult\(intent, LOCAL_BACKUP_SAVE_REQUEST\).*?catch \(RuntimeException error\).*?awaitingOwnActivityResult = false;\s*localBackupResultDelivered = false;' `
    'El selector local no inicializa o limpia correctamente su guarda.'

# La capa web debe excluir solo el flujo local y cerrarlo en resultado o excepcion.
Assert-Match $web `
    '(?s)isFilePickerGuardActive.*?_vkLocalBackupPickerOpen.*?_vkLocalBackupPickerGraceUntil' `
    'La capa web no reconoce el flujo propio de copia local.'
Assert-Match $web `
    '(?s)saveBackupFile.*?_vkLocalBackupPickerOpen=true.*?__vaultKeyLocalBackupResult.*?_vkLocalBackupPickerOpen=false.*?_vkLocalBackupPickerGraceUntil=Date\.now\(\)\+500' `
    'La guarda web no cubre inicio y resultado de la copia local.'
Assert-Match $web `
    '(?s)catch\(error\).*?delete window\.__vaultKeyLocalBackupResult;.*?_vkLocalBackupPickerOpen=false.*?_vkLocalBackupPickerGraceUntil=Date\.now\(\)\+500' `
    'La excepcion del puente nativo no libera la guarda web de forma segura.'

# Seguridad normal y contrato de copia intactos.
Assert-Match $native `
    '(?s)protected void onPause\(\).*?if \(!awaitingOwnActivityResult\) coverSensitiveContent\(\);' `
    'onPause dejo de aplicar el bloqueo normal.'
Assert-Match $native `
    '(?s)protected void onStop\(\).*?if \(!awaitingOwnActivityResult\) coverSensitiveContent\(\);' `
    'onStop dejo de aplicar el bloqueo normal.'
Assert-Match $native `
    'intent\.setType\("application/octet-stream"\)' `
    'Cambio el tipo del archivo de copia local.'
Assert-Match $native `
    'stream\.write\(String\.valueOf\(content\)\.getBytes\(StandardCharsets\.UTF_8\)\)' `
    'Cambio el contenido entregado al selector local.'

if ($gradle -notmatch "(?s)localBackupFocusDiagnostic\s*\{.*?applicationIdSuffix '\.localbackupfocusdiagnostic'.*?debuggable true") {
    throw 'No existe la variante diagnostica independiente de copia local.'
}

Write-Output 'PASS: guarda de copia local, cancelacion, errores, foco y bloqueo normal cubiertos.'
