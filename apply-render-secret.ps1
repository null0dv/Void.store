$envFile = Join-Path (Split-Path $MyInvocation.MyCommand.Path -Parent) ".env.local"
$renderUrl = "https://dashboard.render.com/"

if (-not (Test-Path $envFile)) {
  Write-Host "Missing .env.local" -ForegroundColor Red
  exit 1
}

$secret = (Get-Content $envFile | Where-Object { $_ -match '^SUPABASE_SERVICE_ROLE_KEY=' }) -replace '^SUPABASE_SERVICE_ROLE_KEY=', ''
if (-not $secret) {
  Write-Host "Missing SUPABASE_SERVICE_ROLE_KEY in .env.local" -ForegroundColor Red
  exit 1
}

Set-Clipboard -Value $secret
Write-Host "Copied SUPABASE_SERVICE_ROLE_KEY to clipboard." -ForegroundColor Green
Write-Host "In Render -> null0dv-void-store -> Environment:" -ForegroundColor Yellow
Write-Host "  Key: SUPABASE_SERVICE_ROLE_KEY" -ForegroundColor White
Write-Host "  Value: paste from clipboard" -ForegroundColor White
Write-Host "SUPABASE_URL is already set from render.yaml" -ForegroundColor Cyan
Start-Process $renderUrl