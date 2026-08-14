$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path $PSScriptRoot -Parent
$appJs = Get-Content -LiteralPath (Join-Path $projectRoot 'app\src\main\assets\web\app.js') -Raw
$appHtml = Get-Content -LiteralPath (Join-Path $projectRoot 'app\src\main\assets\web\app.html') -Raw
$onboarding = Get-Content -LiteralPath (Join-Path $projectRoot 'app\src\main\assets\web\onboarding.js') -Raw
$overrides = Get-Content -LiteralPath (Join-Path $projectRoot 'app\src\main\assets\web\csp-overrides.css') -Raw
$activity = Get-Content -LiteralPath (Join-Path $projectRoot 'app\src\main\java\com\nogueratech\vaultkey\MainActivity.java') -Raw
$gradle = Get-Content -LiteralPath (Join-Path $projectRoot 'app\build.gradle') -Raw

if ($appJs -notmatch "privacy\.html\?from=vaultkey") { throw 'Privacidad no abre la copia local.' }
if ($activity -notmatch 'localLegalPage[\s\S]*?webView\.goBack\(\)') { throw 'Las páginas legales no tienen regreso interno seguro.' }
if ([regex]::Matches($appJs, "await vkConfirm\(").Count -lt 2 -or $appJs -notmatch '¿Borrar definitivamente\?') { throw 'Falta la segunda confirmación de borrado local.' }
if ($onboarding -notmatch "onboarding-kit-verify'[\s\S]*?navigate\('/onboarding/kit-save'\)") { throw 'Atrás desde verificar kit no vuelve al kit generado.' }
if ($overrides -notmatch '\.vk-notif-content\s*\{[\s\S]*?overflow-y:\s*hidden') { throw 'Notificaciones todavía permite scroll vertical.' }
if ($appHtml -match 'vk-interaction-version') { throw 'Interacción conserva la versión redundante.' }
if ($overrides -notmatch '\.vk-info-version\s*\{[\s\S]*?margin-top:\s*24px') { throw 'La versión inferior de Información no se ha subido.' }
if ($overrides -notmatch '#healthModal\.vk-health-modal\s*\{[\s\S]*?position:\s*fixed') { throw 'Estado de la bóveda no cubre la pantalla anterior.' }
if ($gradle -notmatch "applicationIdSuffix '\.pendingerrorsdiagnostic'") { throw 'Falta el paquete independiente del lote pendiente.' }

Write-Output 'PASS: siete incidencias pendientes cubiertas por comprobaciones estructurales.'
