$deployUrl = "https://render.com/deploy?repo=https://github.com/null0dv/Void.store"

Write-Host ""
Write-Host "正在開啟 Render 一鍵部署頁面..." -ForegroundColor Cyan
Write-Host $deployUrl
Write-Host ""
Write-Host "請在瀏覽器中：" -ForegroundColor Yellow
Write-Host "  1. 用 GitHub (null0dv) 登入 Render"
Write-Host "  2. 設定 ADMIN_PASSWORD（管理員密碼）"
Write-Host "  3. 點 Deploy Blueprint 確認部署"
Write-Host ""
Write-Host "部署完成後固定網址：https://null0dv-void-store.onrender.com" -ForegroundColor Green
Write-Host ""

Start-Process $deployUrl