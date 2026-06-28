$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectDir

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Void.Store 雲端部署指南 (Render)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "步驟 1：建立 GitHub 倉庫" -ForegroundColor Yellow
Write-Host "  前往 https://github.com/new"
Write-Host "  倉庫名稱：void-store"
Write-Host "  設為 Public 或 Private 皆可"
Write-Host ""
Write-Host "步驟 2：推送程式碼到 GitHub" -ForegroundColor Yellow
Write-Host "  在專案資料夾執行："
Write-Host "  git remote add origin https://github.com/你的帳號/void-store.git"
Write-Host "  git push -u origin main"
Write-Host ""
Write-Host "步驟 3：部署到 Render" -ForegroundColor Yellow
Write-Host "  1. 前往 https://dashboard.render.com/"
Write-Host "  2. 註冊 / 登入（可用 GitHub 帳號）"
Write-Host "  3. 點 New + → Blueprint"
Write-Host "  4. 連接 GitHub 倉庫 void-store"
Write-Host "  5. Render 會自動讀取 render.yaml 並部署"
Write-Host ""
Write-Host "步驟 4：設定環境變數（Render 控制台）" -ForegroundColor Yellow
Write-Host "  ADMIN_PASSWORD              = 你的管理員密碼（_null 登入用）"
Write-Host "  SUPABASE_SERVICE_ROLE_KEY   = Supabase 金鑰（商品持久化，選填）"
Write-Host ""
Write-Host "步驟 5：取得固定網址" -ForegroundColor Yellow
Write-Host "  部署完成後網址格式：https://void-store.onrender.com"
Write-Host "  分享連結會自動使用此網址，無需隧道！"
Write-Host ""
Write-Host "注意：免費方案 15 分鐘無人使用會休眠，首次開啟需等約 30 秒" -ForegroundColor DarkYellow
Write-Host ""

if (-not (Test-Path "$projectDir\.git")) {
    Write-Host "正在初始化 Git..." -ForegroundColor Green
    git init
    git add .
    git commit -m "Initial commit: Void.Store product site"
    Write-Host "Git 已初始化並完成首次 commit" -ForegroundColor Green
} else {
    Write-Host "Git 已存在，略過初始化" -ForegroundColor Green
}

Write-Host ""
Write-Host "專案路徑：$projectDir" -ForegroundColor Cyan
Write-Host ""