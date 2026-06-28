# Supabase persistent storage setup for Void.Store
$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$schemaFile = Join-Path $projectDir "supabase-schema.sql"
$supabaseUrl = "https://supabase.com/dashboard"
$renderUrl = "https://dashboard.render.com/"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Void.Store Supabase Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Why: Render free plan wipes local files on redeploy/sleep." -ForegroundColor Yellow
Write-Host "Supabase keeps products and images permanently." -ForegroundColor Yellow
Write-Host ""
Write-Host "Step 1: Create Supabase project" -ForegroundColor Yellow
Write-Host "  Opening Supabase dashboard..."
Write-Host "  1. New project"
Write-Host "  2. Save database password"
Write-Host ""

Start-Process $supabaseUrl
Start-Sleep -Seconds 2

Write-Host "Step 2: Run SQL schema" -ForegroundColor Yellow
Write-Host "  In Supabase: SQL Editor -> New query"
Write-Host "  Copy contents from:" -ForegroundColor White
Write-Host "  $schemaFile" -ForegroundColor Green
Write-Host ""
Write-Host "  SQL file will open now..."
Start-Process notepad $schemaFile
Start-Sleep -Seconds 1

Write-Host "Step 3: Paste Supabase keys" -ForegroundColor Yellow
$projectUrl = Read-Host "Supabase Project URL (https://xxxx.supabase.co)"
$serviceKey = Read-Host "Supabase service_role key (secret)"

if (-not $projectUrl -or $projectUrl -notmatch '^https://.+\.supabase\.co/?$') {
    Write-Host "Invalid Supabase URL" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
if (-not $serviceKey) {
    Write-Host "Service role key is required" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

$envFile = Join-Path $projectDir ".env.local"
@"
SUPABASE_URL=$($projectUrl.TrimEnd('/'))
SUPABASE_SERVICE_ROLE_KEY=$serviceKey
"@ | Set-Content -Path $envFile -Encoding UTF8
Write-Host "Saved local env: $envFile" -ForegroundColor Green

Write-Host ""
Write-Host "Step 4: Set Render environment variables" -ForegroundColor Yellow
Write-Host "  Opening Render dashboard..."
Write-Host "  Add to null0dv-void-store:" -ForegroundColor White
Write-Host "  SUPABASE_URL = $projectUrl" -ForegroundColor Green
Write-Host "  SUPABASE_SERVICE_ROLE_KEY = (your service_role key)" -ForegroundColor Green
Write-Host "  Then Save Changes"
Write-Host ""

Start-Process $renderUrl

Write-Host "Done. After Render redeploys, uploaded products will persist." -ForegroundColor Cyan
Write-Host "Site: https://null0dv-void-store.onrender.com" -ForegroundColor Cyan
Write-Host ""
Read-Host "Press Enter to exit"