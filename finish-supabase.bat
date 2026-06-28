@echo off
cd /d "%~dp0"
title Finish Supabase - Void.Store
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0finish-supabase.ps1"
pause