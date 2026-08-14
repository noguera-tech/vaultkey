$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path $PSScriptRoot -Parent
$manifestPath = Join-Path $projectRoot 'app\src\main\AndroidManifest.xml'
[xml] $manifest = Get-Content -LiteralPath $manifestPath -Raw
$androidNamespace = 'http://schemas.android.com/apk/res/android'
$application = $manifest.manifest.application
$colorsPath = Join-Path $projectRoot 'app\src\main\res\values\colors.xml'
[xml] $colors = Get-Content -LiteralPath $colorsPath -Raw

if ($application.GetAttribute('icon', $androidNamespace) -ne '@mipmap/ic_launcher') {
    throw 'AndroidManifest.xml no declara android:icon=@mipmap/ic_launcher.'
}
if ($application.GetAttribute('roundIcon', $androidNamespace) -ne '@mipmap/ic_launcher_round') {
    throw 'AndroidManifest.xml no declara android:roundIcon=@mipmap/ic_launcher_round.'
}

$launcherBackground = $colors.resources.color | Where-Object { $_.name -eq 'launcher_icon_background' }
if (-not $launcherBackground -or $launcherBackground.InnerText.ToUpperInvariant() -ne '#182F4E') {
    throw 'El fondo adaptable no coincide con el fondo oficial #182F4E.'
}

$expectedSizes = [ordered]@{
    'mipmap-mdpi' = 48
    'mipmap-hdpi' = 72
    'mipmap-xhdpi' = 96
    'mipmap-xxhdpi' = 144
    'mipmap-xxxhdpi' = 192
}

Add-Type -AssemblyName System.Drawing
foreach ($density in $expectedSizes.GetEnumerator()) {
    foreach ($name in @('ic_launcher.png', 'ic_launcher_round.png')) {
        $path = Join-Path $projectRoot "app\src\main\res\$($density.Key)\$name"
        if (-not (Test-Path -LiteralPath $path)) {
            throw "Falta el recurso $path."
        }
        $bitmap = [System.Drawing.Bitmap]::new($path)
        try {
            if ($bitmap.Width -ne $density.Value -or $bitmap.Height -ne $density.Value) {
                throw "$path no tiene tamaño $($density.Value)x$($density.Value)."
            }
        } finally {
            $bitmap.Dispose()
        }
    }
}

foreach ($name in @('ic_launcher.xml', 'ic_launcher_round.xml')) {
    $path = Join-Path $projectRoot "app\src\main\res\mipmap-anydpi-v26\$name"
    [xml] $adaptiveIcon = Get-Content -LiteralPath $path -Raw
    if ($adaptiveIcon.'adaptive-icon'.background.GetAttribute('drawable', $androidNamespace) -ne '@color/launcher_icon_background') {
        throw "$name no usa el fondo oficial."
    }
    if ($adaptiveIcon.'adaptive-icon'.foreground.GetAttribute('drawable', $androidNamespace) -ne '@drawable/ic_launcher_foreground') {
        throw "$name no usa la marca oficial como primer plano."
    }
}

$changedFunctionalFiles = git -C $projectRoot diff --name-only 85f906f1ad29bb1699a0f2ab52763550f4cf5437 -- `
    'app/src/main/java' 'app/src/main/assets/web'
if ($changedFunctionalFiles) {
    throw "Se detectaron cambios funcionales o web no autorizados: $changedFunctionalFiles"
}

Write-Output 'PASS: manifiesto, cinco densidades e iconos adaptables verificados; sin cambios funcionales.'
