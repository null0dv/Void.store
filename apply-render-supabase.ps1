# Copy Supabase env values from .env.local and open Render dashboard
$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$envFile = Join-Path $projectDir ".env.local"
$renderUrl = "https://dashboard.render.com/"

if (-not (Test-Path $envFile)) {
    Write-Host "Missing .env.local. Run finish-supabase.ps1 first." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

$lines = Get-Content $envFile | Where-Object { $_ -match '^SUPABASE_' }
if ($lines.Count -lt 2) {
    Write-Host ".env.local is missing Supabase values." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

$text = ($lines -join "`n")
Write-Host ""
Write-Host "Render environment variables to add:" -ForegroundColor Cyan
Write-Host $text
Write-Host ""
Set-Clipboard -Value $text
Write-Host "Copied to clipboard." -ForegroundColor Green
Write-Host "Open null0dv-void-store -> Environment -> paste both lines" -ForegroundColor Yellow
Start-Process $renderUrl
Read-Host "Press Enter to exit"