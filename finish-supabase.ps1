# Finish Supabase setup for Void.Store (URL pre-filled)
$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$schemaFile = Join-Path $projectDir "supabase-schema.sql"
$envFile = Join-Path $projectDir ".env.local"
$projectUrl = "https://iriuznaoxstqsepisldd.supabase.co"
$projectRef = "iriuznaoxstqsepisldd"
$sqlUrl = "https://supabase.com/dashboard/project/$projectRef/sql/new"
$apiUrl = "https://supabase.com/dashboard/project/$projectRef/settings/api-keys"
$connectUrl = "https://supabase.com/dashboard/project/$projectRef?showConnect=true"
$renderUrl = "https://dashboard.render.com/"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Finish Supabase Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Project URL: $projectUrl" -ForegroundColor Green
Write-Host ""
Write-Host "Step 1: Run SQL schema (if not done yet)" -ForegroundColor Yellow
Write-Host "  Opening SQL Editor..."
Start-Process $sqlUrl
Start-Sleep -Seconds 1
Start-Process notepad $schemaFile

Write-Host ""
Write-Host "Step 2: Copy Secret key" -ForegroundColor Yellow
Write-Host "  Opening API Keys page..."
Start-Process $apiUrl
Start-Sleep -Seconds 1
Start-Process $connectUrl
Write-Host "  In Supabase go to: Project Settings -> API Keys" -ForegroundColor White
Write-Host "  Copy Secret key (sb_secret_...) or legacy service_role" -ForegroundColor White
Write-Host "  Do NOT use Publishable key (sb_publishable_...)" -ForegroundColor Yellow
Write-Host ""

$serviceKey = Read-Host "Paste Supabase Secret key or service_role key"
if (-not $serviceKey -or $serviceKey.Length -lt 20) {
    Write-Host "Invalid service_role key" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

@"
SUPABASE_URL=$projectUrl
SUPABASE_SERVICE_ROLE_KEY=$serviceKey
"@ | Set-Content -Path $envFile -Encoding UTF8
Write-Host "Saved: $envFile" -ForegroundColor Green

Write-Host ""
Write-Host "Step 3: Set Render environment variables" -ForegroundColor Yellow
Write-Host "  SUPABASE_URL = $projectUrl" -ForegroundColor Green
Write-Host "  SUPABASE_SERVICE_ROLE_KEY = (the key you pasted)" -ForegroundColor Green
Write-Host "  Opening Render dashboard..."
Start-Process $renderUrl

Write-Host ""
Write-Host "After Render redeploys, products will persist." -ForegroundColor Cyan
Read-Host "Press Enter to exit"