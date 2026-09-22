$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$runtimeDir = Join-Path $projectRoot "tools\pocketbase"
$dataDir = Join-Path $projectRoot "local-data\pocketbase"
$migrationDir = Join-Path $projectRoot "pb_migrations"
$pocketBaseExe = Join-Path $runtimeDir "pocketbase.exe"
$envPath = Join-Path $projectRoot ".env.local"
$examplePath = Join-Path $projectRoot ".env.example"
$downloadUrl = "https://github.com/pocketbase/pocketbase/releases/download/v0.40.1/pocketbase_0.40.1_windows_amd64.zip"

New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null
New-Item -ItemType Directory -Path $dataDir -Force | Out-Null
if (-not (Test-Path -LiteralPath $pocketBaseExe)) {
  Write-Host "Telechargement de PocketBase (une seule fois)..." -ForegroundColor Cyan
  $zipPath = Join-Path $env:TEMP "cveshop-pocketbase-0.40.1.zip"
  Invoke-WebRequest -Uri $downloadUrl -OutFile $zipPath
  Expand-Archive -LiteralPath $zipPath -DestinationPath $runtimeDir -Force
  Remove-Item -LiteralPath $zipPath -Force
}

$content = if (Test-Path -LiteralPath $envPath) { Get-Content -LiteralPath $envPath -Raw } else { Get-Content -LiteralPath $examplePath -Raw }
$originalContent = $content
function Set-EnvValue([string]$text, [string]$name, [string]$value) {
  $escapedName = [regex]::Escape($name)
  if ($text -match "(?m)^$escapedName=") { return [regex]::Replace($text, "(?m)^$escapedName=.*$", "$name=$value") }
  return $text.TrimEnd() + "`r`n$name=$value`r`n"
}
$content = Set-EnvValue $content "LOCAL_DATA_BACKEND" "pocketbase"
$content = Set-EnvValue $content "POCKETBASE_URL" "http://127.0.0.1:8090"
$content = Set-EnvValue $content "AUTH_URL" "http://localhost:3010"
$content = Set-EnvValue $content "AUTH_TRUST_HOST" "true"
if ($content -match "(?m)^AUTH_SECRET=\s*$") {
  $randomBytes = New-Object byte[] 32
  $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  $generator.GetBytes($randomBytes)
  $generator.Dispose()
  $content = Set-EnvValue $content "AUTH_SECRET" ([Convert]::ToBase64String($randomBytes))
}
if ($content -ne $originalContent -or -not (Test-Path -LiteralPath $envPath)) {
  Set-Content -LiteralPath $envPath -Value $content -Encoding utf8
}

$health = $null
try { $health = Invoke-RestMethod -Uri "http://127.0.0.1:8090/api/health" -TimeoutSec 2 } catch {}
if (-not $health) {
  Write-Host "Demarrage de la base locale PocketBase..." -ForegroundColor Cyan
  $outLog = Join-Path $dataDir "pocketbase.out.log"
  $errLog = Join-Path $dataDir "pocketbase.err.log"
  Start-Process -FilePath $pocketBaseExe -ArgumentList @("serve", "--http=127.0.0.1:8090", "--dir=$dataDir", "--migrationsDir=$migrationDir") -WorkingDirectory $projectRoot -RedirectStandardOutput $outLog -RedirectStandardError $errLog -WindowStyle Hidden
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    Start-Sleep -Milliseconds 500
    try { $health = Invoke-RestMethod -Uri "http://127.0.0.1:8090/api/health" -TimeoutSec 2; break } catch {}
  }
}
if (-not $health) { throw "PocketBase n'a pas pu demarrer. Consulte local-data\pocketbase\pocketbase.err.log." }
Write-Host "Base locale prete : http://127.0.0.1:8090" -ForegroundColor Green
Write-Host "Donnees : local-data\pocketbase (ignore par Git)."
