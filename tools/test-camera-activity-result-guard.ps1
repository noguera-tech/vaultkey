$ErrorActionPreference = 'Stop'

$sourcePath = Join-Path $PSScriptRoot '..\app\src\main\java\com\nogueratech\vaultkey\MainActivity.java'
$source = Get-Content -LiteralPath $sourcePath -Raw

function Assert-SourceMatch {
    param(
        [string] $Pattern,
        [string] $Message
    )

    if ($source -notmatch $Pattern) {
        throw $Message
    }
}

$fileChooserStart = $source.IndexOf('if (requestCode == FILE_CHOOSER_REQUEST) {')
$driveResultStart = $source.IndexOf('if (requestCode == DRIVE_AUTHORIZATION_REQUEST) {')
if ($fileChooserStart -lt 0 -or $driveResultStart -le $fileChooserStart) {
    throw 'No se encontro el bloque FILE_CHOOSER_REQUEST.'
}

$resultBody = $source.Substring($fileChooserStart, $driveResultStart - $fileChooserStart)
if ($resultBody -match 'awaitingOwnActivityResult\s*=\s*false') {
    throw 'FILE_CHOOSER_REQUEST libera awaitingOwnActivityResult dentro de onActivityResult.'
}
if ($resultBody -notmatch 'fileChooserResultDelivered\s*=\s*true') {
    throw 'FILE_CHOOSER_REQUEST no marca el resultado como entregado.'
}

Assert-SourceMatch `
    '(?s)if \(resultCode == RESULT_OK && pendingCameraUri != null\).*?callback\.onReceiveValue\(new Uri\[\]\{pendingCameraUri\}\).*?else.*?FileChooserParams\.parseResult\(resultCode, data\)' `
    'No estan cubiertos tanto el resultado de camara aceptado como el resultado cancelado/selector.'
Assert-SourceMatch `
    '(?s)protected void onResume\(\).*?if \(!awaitingOwnActivityResult\) coverSensitiveContent\(\);' `
    'onResume dejo de respetar awaitingOwnActivityResult.'
Assert-SourceMatch `
    '(?s)public void onWindowFocusChanged\(boolean hasFocus\).*?else \{\s*revealContentIfReady\(\);.*?if \(pageReady && awaitingOwnActivityResult && fileChooserResultDelivered\) \{\s*awaitingOwnActivityResult = false;\s*fileChooserResultDelivered = false;' `
    'La guarda no se libera despues de revelar el contenido al recuperar foco.'
Assert-SourceMatch `
    '(?s)fileChooserResultDelivered = false;\s*awaitingOwnActivityResult = true;\s*startActivityForResult\(cameraIntent, FILE_CHOOSER_REQUEST\)' `
    'La captura de camara no inicializa la guarda correctamente.'
Assert-SourceMatch `
    '(?s)fileChooserResultDelivered = false;\s*awaitingOwnActivityResult = true;\s*startActivityForResult\(intent, FILE_CHOOSER_REQUEST\)' `
    'El selector de archivos no inicializa la guarda correctamente.'

Write-Output 'PASS: guarda de resultado de camara/selector retenida hasta recuperar foco.'
