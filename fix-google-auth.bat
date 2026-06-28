@echo off
cd /d "%~dp0"
title Fix Google Auth - Void.Store
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0fix-google-auth.ps1"
pause
