@echo off
cd /d "%~dp0"
docker compose stop
echo Data finns kvar i Docker-volymen.
pause
