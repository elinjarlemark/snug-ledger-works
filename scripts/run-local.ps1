$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw 'Docker Desktop ar inte installerat.'
}

& docker info *> $null

if ($LASTEXITCODE -ne 0) {
    throw 'Starta Docker Desktop och vanta tills Docker kor.'
}

$lockPath = Join-Path $projectRoot 'package-lock.json'
$privateRegistryPattern = 'applied-caas-gateway|internal\.api\.openai\.org|artifactory/api/npm'

Write-Host ''
Write-Host 'Kontrollerar npm-paket...'
Write-Host ''

$mustRebuildLock = $false

if (-not (Test-Path $lockPath)) {
    $mustRebuildLock = $true
}
else {
    $lockContent = Get-Content -Path $lockPath -Raw

    if ($lockContent -match $privateRegistryPattern) {
        Write-Host 'Package-lock innehaller ett privat npm-register.'
        Write-Host 'Skapar en ren package-lock fran npmjs.org...'
        $mustRebuildLock = $true
    }
}

if ($mustRebuildLock) {
    if (Test-Path $lockPath) {
        Remove-Item -Path $lockPath -Force
    }
}

& docker run --rm -v ("{0}:/app" -f $projectRoot) -w /app node:22-alpine sh -c "npm config set registry https://registry.npmjs.org && npm install --package-lock-only --ignore-scripts --no-audit --no-fund"

if ($LASTEXITCODE -ne 0) {
    throw 'Kunde inte skapa eller uppdatera package-lock.json.'
}

if (-not (Test-Path $lockPath)) {
    throw 'package-lock.json skapades inte.'
}

$lockContent = Get-Content -Path $lockPath -Raw

if ($lockContent -match $privateRegistryPattern) {
    throw 'package-lock.json innehaller fortfarande lankar till ett privat npm-register.'
}

Write-Host ''
Write-Host 'Package-lock ar OK.'
Write-Host 'Bygger och startar AccountPro...'
Write-Host ''

& docker compose up --build -d --wait --wait-timeout 180

if ($LASTEXITCODE -ne 0) {
    throw 'Starten misslyckades. Se Docker-loggen ovan for orsaken.'
}

& (Join-Path $PSScriptRoot 'test-local.ps1')

Write-Host ''
Write-Host 'Klart!'
Write-Host 'Oppna http://localhost:5173 i webblasaren.'
