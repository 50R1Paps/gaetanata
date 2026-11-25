@echo off
rem Avvia Gaetanata su Windows (doppio clic). La logica sta in scripts\avvia.ps1.
rem Started from PowerShell 7, the inherited PSModulePath hides Windows PowerShell's
rem built-in modules (Get-FileHash, Expand-Archive): let powershell.exe rebuild it.
setlocal
set "PSModulePath="
if defined GAETANATA_RESTART_PARENT (
  echo ready>"%~dp0.aggiornamento\launcher-pronto"
  powershell -NoProfile -Command "Wait-Process -Id %GAETANATA_RESTART_PARENT% -ErrorAction SilentlyContinue"
  set "GAETANATA_RESTART_PARENT="
)
if "%~1"=="--resume-update" (set "RESUME=-ResumeUpdate") else (set "RESUME=")
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\avvia.ps1" %RESUME%
if errorlevel 1 pause
