$ErrorActionPreference = 'Stop'
$baseUrl = 'http://localhost:5173'
$page = Invoke-WebRequest -UseBasicParsing -Uri $baseUrl -TimeoutSec 15
if ($page.StatusCode -ne 200) { throw 'Webbsidan svarar inte.' }
$health = Invoke-RestMethod -Uri "$baseUrl/backend/health" -TimeoutSec 15
if ($health.db -ne 'ok') { throw 'Databasen är inte redo.' }
Write-Host 'Webbsidan, API och databasen svarar korrekt.'
