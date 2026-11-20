@echo off
rem Avvia Gaetanata su Windows (doppio clic). La logica sta in scripts\avvia.ps1.
rem Started from PowerShell 7, the inherited PSModulePath hides Windows PowerShell's
rem built-in modules (Get-FileHash, Expand-Archive): let powershell.exe rebuild it.
setlocal
set "PSModulePath="
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\avvia.ps1"
if errorlevel 1 pause
