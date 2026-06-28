@echo off
cd /d "%~dp0"
title Apply Supabase to Render
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0apply-render-supabase.ps1"
pause