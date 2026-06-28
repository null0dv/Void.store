$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$envFile = Join-Path $projectDir "void-store-render.env"
$dashboard = "https://dashboard.render.com/"

$msg = @"
Render 設定步驟（不要點 Environment Groups）

1. 左側點 Services（服務）
2. 點 null0dv-void-store
3. 左側點 Environment
4. 點 Add from .env
5. 選擇這個檔案：
$envFile
6. 按 Save, rebuild, and deploy

如果沒有 Add from .env：
- 點 + Add Environment Variable
- Key: SUPABASE_SERVICE_ROLE_KEY
- Value: 貼上 sb_secret_ 開頭的金鑰
"@

Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.MessageBox]::Show($msg, "Void.Store Render 設定", "OK", "Information") | Out-Null

if (Test-Path $envFile) {
  Start-Process explorer.exe "/select,$envFile"
}
Start-Process $dashboard