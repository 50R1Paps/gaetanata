@echo off
rem Avvia Gaetanata su Windows (doppio clic). La logica sta in scripts\avvia.ps1.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\avvia.ps1"
if errorlevel 1 pause
