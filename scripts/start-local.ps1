$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot

& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "setup-local.ps1")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "CVEShop demarre sur http://localhost:3010" -ForegroundColor Green
Write-Host "Pour arreter le site : Ctrl+C"
& npm run dev
