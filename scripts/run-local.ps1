$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw 'Installera Docker Desktop först: https://docs.docker.com/desktop/setup/install/windows-install/'
}
& docker info *> $null
if ($LASTEXITCODE -ne 0) { throw 'Starta Docker Desktop och vänta tills det visar att Docker körs. Försök sedan igen.' }
Write-Host 'Bygger och startar AccountPro. Första starten kan ta flera minuter.'
& docker compose up --build -d --wait --wait-timeout 180
if ($LASTEXITCODE -ne 0) { throw 'Starten misslyckades. Kör docker compose logs --tail=80 för att se orsaken.' }
& (Join-Path $PSScriptRoot 'test-local.ps1')
Write-Host 'Klart! Öppna http://localhost:5173 i webbläsaren.'
