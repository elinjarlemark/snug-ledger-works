$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
$backupDirectory = Join-Path (Get-Location) 'backups'
New-Item -ItemType Directory -Force -Path $backupDirectory | Out-Null
$backupFile = Join-Path $backupDirectory ('accountpro-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.sql')
& docker compose exec -T db pg_dump -U snug -d snug_ledger --no-owner --no-privileges -f /tmp/accountpro-backup.sql
if ($LASTEXITCODE -ne 0) { throw 'Backup misslyckades. Kontrollera att Docker och databasen körs.' }
& docker compose cp db:/tmp/accountpro-backup.sql $backupFile
if ($LASTEXITCODE -ne 0) { throw 'Kunde inte kopiera säkerhetskopian från Docker.' }
Write-Host "Backup sparad: $backupFile"
