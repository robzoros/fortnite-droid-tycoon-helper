@echo off
REM Inicia el servidor DroidHelper pidiendo permisos de Administrador automaticamente.
REM Si ya hay UAC elevado, no vuelve a preguntar.

net session >nul 2>&1
if %errorlevel% neq 0 (
    powershell -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

cd /d "%~dp0"
python server.py
pause