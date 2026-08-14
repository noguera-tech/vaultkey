$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path $PSScriptRoot -Parent
$background = Join-Path $projectRoot 'app\src\main\res\drawable-nodpi\vault_figma_startup_background.png'
$lock = Join-Path $projectRoot 'app\src\main\assets\web\figma-startup-lock.svg'
$shield = Join-Path $projectRoot 'app\src\main\assets\web\figma-startup-shield.svg'

$expectedHashes = @{
    $background = '5D56FF42A66993CCA9BDA3571E44ABACF81167C6F33EFB8B9E399A8029493E52'
    $lock = '05AC457A67E4FDD55DCEEDFAADCC86178E3615E10F645B0F38918C8A2E3144B8'
    $shield = 'FC14EA4791A8427D1E5808E175042C4644CF7990CE77ACC08E138358656FF112'
}

foreach ($asset in $expectedHashes.GetEnumerator()) {
    $actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $asset.Key).Hash
    if ($actual -ne $asset.Value) {
        throw "El activo Figma no coincide: $($asset.Key)"
    }
}

Add-Type -AssemblyName System.Drawing
$bitmap = [System.Drawing.Bitmap]::new($background)
try {
    if ($bitmap.Width -ne 412 -or $bitmap.Height -ne 917) {
        throw 'El fondo Figma no conserva el frame 412x917.'
    }
} finally {
    $bitmap.Dispose()
}

$appScript = Get-Content -LiteralPath (Join-Path $projectRoot 'app\src\main\assets\web\app.js') -Raw
if ($appScript -match 'if\s*\(window\.__VK_TWA__\)\s*\{\s*hideSplashHard') {
    throw 'Android sigue omitiendo el splash web.'
}
if ($appScript -notmatch "setTimeout\(\(\)=>\{\s*hideSplashHard\(\);\s*cb\(\);\s*\},600\)") {
    throw 'La transición splash a aplicación no conserva su duración controlada.'
}
if ($appScript -notmatch "_obNav\('/welcome'\)") {
    throw 'La secuencia no termina en Bienvenida.'
}

$mainActivity = Get-Content -LiteralPath (Join-Path $projectRoot 'app\src\main\java\com\nogueratech\vaultkey\MainActivity.java') -Raw
$backgroundUses = [regex]::Matches($mainActivity, 'setBackgroundResource\(R\.drawable\.vault_figma_startup_background\)').Count
if ($backgroundUses -ne 3) {
    throw "Se esperaban tres superficies nativas con fondo Figma; encontradas: $backgroundUses."
}

$components = Get-Content -LiteralPath (Join-Path $projectRoot 'app\src\main\assets\web\components.css') -Raw
$style = Get-Content -LiteralPath (Join-Path $projectRoot 'app\src\main\assets\web\style.css') -Raw
$figmaWebBackground = Join-Path $projectRoot 'app\src\main\assets\web\vault-figma-startup-background.png'
if (-not (Test-Path -LiteralPath $figmaWebBackground)) {
    throw 'Falta el fondo raster exacto de Figma para el arranque web.'
}
if ($style -notmatch 'vault-figma-startup-background\.png' -or $components -notmatch 'vault-figma-startup-background\.png') {
    throw 'Splash y bienvenida no comparten el fondo raster exacto de Figma.'
}
if ($components -match 'vk-welcome-shift-y') {
    throw 'Permanece el desplazamiento móvil que alteraba las coordenadas de Figma.'
}
if ($components -match '--vk-startup-scale' -or $style -match '--vk-startup-scale' -or $appScript -match 'updateSplashScale') {
    throw 'El arranque vuelve a aplicar una escala dinámica que puede producir saltos.'
}

Write-Output 'PASS: fondo raster Figma 412x917, splash y bienvenida conservan activos, orden y lienzo estable.'
