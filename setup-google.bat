@echo off
cd /d "%~dp0"
title Google Login Setup - Void.Store
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-google.ps1"
pause
