$ErrorActionPreference = 'Stop'

$projectRoot = Join-Path $PSScriptRoot '..'
$gradle = Get-Content -LiteralPath (Join-Path $projectRoot 'app\build.gradle') -Raw
$app = Get-Content -LiteralPath (Join-Path $projectRoot 'app\src\main\assets\web\app.js') -Raw

$gradleMatch = [regex]::Match($gradle, "versionName\s+'([^']+)'")
$visibleMatch = [regex]::Match($app, "const APP_VERSION='VaultKey ([^']+)'\s*;")

if (-not $gradleMatch.Success) { throw 'No se encontro versionName en app/build.gradle.' }
if (-not $visibleMatch.Success) { throw 'No se encontro APP_VERSION visible en app.js.' }
if ($gradleMatch.Groups[1].Value -ne $visibleMatch.Groups[1].Value) {
    throw "Version incoherente: versionName=$($gradleMatch.Groups[1].Value), visible=$($visibleMatch.Groups[1].Value)."
}

Write-Output "PASS: version visible VaultKey $($visibleMatch.Groups[1].Value) coincide con versionName."
