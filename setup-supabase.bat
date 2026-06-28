@echo off
cd /d "%~dp0"
title Supabase Setup - Void.Store
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-supabase.ps1"
pause