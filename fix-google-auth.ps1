# Fix "Access blocked: Authorization error" for Void.Store Google login
$consentUrl = "https://console.cloud.google.com/auth/audience"
$credentialsUrl = "https://console.cloud.google.com/apis/credentials"
$origins = @(
  "https://null0dv-void-store.onrender.com",
  "http://localhost:3000"
)

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Fix Google Authorization Error" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Error: Access blocked / Authorization error" -ForegroundColor Yellow
Write-Host "Cause: OAuth consent screen or test users not configured" -ForegroundColor Yellow
Write-Host ""
Write-Host "Step 1: OAuth consent screen" -ForegroundColor Yellow
Write-Host "  Opening Google OAuth consent screen..."
Write-Host ""
Write-Host "  Required:" -ForegroundColor White
Write-Host "  1. App name and support email filled in"
Write-Host "  2. Scopes include: email, profile, openid"
Write-Host "  3. If status is TESTING:"
Write-Host "     Add your Gmail under Test users" -ForegroundColor Green
Write-Host "     (Only listed emails can sign in during testing)"
Write-Host "  4. Or click PUBLISH APP to allow all Google accounts"
Write-Host "     (email/profile scopes do not need Google verification)"
Write-Host ""

Start-Process $consentUrl
Start-Sleep -Seconds 2

Write-Host "Step 2: OAuth Client ID origins" -ForegroundColor Yellow
Write-Host "  Opening Credentials page..."
Write-Host ""
Write-Host "  Open your Web application OAuth client and add:" -ForegroundColor White
foreach ($o in $origins) { Write-Host "     $o" -ForegroundColor Green }
Write-Host "  under Authorized JavaScript origins, then Save"
Write-Host ""

Start-Process $credentialsUrl

Write-Host "Step 3: Retry login" -ForegroundColor Yellow
Write-Host "  1. Wait 1-2 minutes after saving"
Write-Host "  2. Open https://null0dv-void-store.onrender.com"
Write-Host "  3. Press Ctrl+F5, then click Login"
Write-Host ""
Read-Host "Press Enter to exit"