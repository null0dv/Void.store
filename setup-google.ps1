# Google OAuth setup wizard for Void.Store
$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$googleConfig = Join-Path $projectDir "data\google-config.json"
$renderUrl = "https://dashboard.render.com/"
$googleConsole = "https://console.cloud.google.com/apis/credentials/oauthclient"

$origins = @(
  "https://null0dv-void-store.onrender.com",
  "http://localhost:3000"
)

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Google Member Login Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
$consentUrl = "https://console.cloud.google.com/auth/audience"

Write-Host "Step 1: OAuth consent screen (required first)" -ForegroundColor Yellow
Write-Host "  Opening OAuth consent screen..."
Write-Host ""
Write-Host "  In Google Console:" -ForegroundColor White
Write-Host "  1. Fill app name and support email"
Write-Host "  2. Add scopes: email, profile, openid"
Write-Host "  3. If status is TESTING, add your Gmail as Test user" -ForegroundColor Green
Write-Host "     OR click Publish App to allow all Google accounts"
Write-Host ""

Start-Process $consentUrl
Start-Sleep -Seconds 2

Write-Host "Step 2: Create OAuth Client ID" -ForegroundColor Yellow
Write-Host "  Opening Credentials page..."
Write-Host ""
Write-Host "  In Google Console:" -ForegroundColor White
Write-Host "  1. Select or create a project"
Write-Host "  2. APIs and Services > Credentials"
Write-Host "  3. Create Credentials > OAuth client ID"
Write-Host "  4. Application type: Web application"
Write-Host "  5. Authorized JavaScript origins - add:"
foreach ($o in $origins) { Write-Host "     $o" -ForegroundColor Green }
Write-Host "  6. Copy Client ID (ends with .apps.googleusercontent.com)"
Write-Host ""

Start-Process $googleConsole
Start-Sleep -Seconds 2

Write-Host "Step 3: Paste Client ID" -ForegroundColor Yellow
$clientId = Read-Host "Paste Google Client ID"

if (-not $clientId -or $clientId -notmatch '\.apps\.googleusercontent\.com$') {
    Write-Host "Invalid Client ID format. Please run this script again." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

$config = @{ clientId = $clientId.Trim() } | ConvertTo-Json
Set-Content -Path $googleConfig -Value $config -Encoding UTF8
Write-Host "Saved local config: $googleConfig" -ForegroundColor Green

Write-Host ""
Write-Host "Step 4: Set Render environment variable" -ForegroundColor Yellow
Write-Host "  Opening Render dashboard..."
Write-Host ""
Write-Host "  In Render:" -ForegroundColor White
Write-Host "  1. Open null0dv-void-store service"
Write-Host "  2. Environment > Add Environment Variable"
Write-Host "  3. Key: GOOGLE_CLIENT_ID"
Write-Host "  4. Value: $clientId" -ForegroundColor Green
Write-Host "  5. Save Changes (auto redeploy)"
Write-Host ""

Start-Process $renderUrl

Write-Host "Done! Google login will work after deploy finishes." -ForegroundColor Cyan
Write-Host "Site: https://null0dv-void-store.onrender.com" -ForegroundColor Cyan
Write-Host ""
Read-Host "Press Enter to exit"