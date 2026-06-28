# LINE inquiry + group link setup for Void.Store
$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$siteConfig = Join-Path $projectDir "data\site-config.json"
$renderUrl = "https://dashboard.render.com/"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Void.Store LINE 設定" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "請先在 LINE 取得兩個連結：" -ForegroundColor Yellow
Write-Host "  1. 詢價連結（官方帳號或個人）"
Write-Host "     例：https://line.me/R/oaMessage/@你的帳號/"
Write-Host "     或：https://line.me/R/ti/p/@你的帳號"
Write-Host "  2. 群組邀請連結"
Write-Host "     例：https://line.me/ti/g/xxxxxxxxxx"
Write-Host ""

$inquiry = Read-Host "貼上 LINE 詢價連結（可留空）"
$group = Read-Host "貼上 LINE 群組連結（可留空）"

if (-not $inquiry -and -not $group) {
  Write-Host "未輸入任何連結，已取消。" -ForegroundColor Red
  exit 1
}

$config = @{
  publicUrl = $null
  lineInquiryUrl = $null
  lineGroupUrl = $null
}
if (Test-Path $siteConfig) {
  $existing = Get-Content $siteConfig -Raw | ConvertFrom-Json
  if ($existing.publicUrl) { $config.publicUrl = $existing.publicUrl }
  if ($existing.lineInquiryUrl) { $config.lineInquiryUrl = $existing.lineInquiryUrl }
  if ($existing.lineGroupUrl) { $config.lineGroupUrl = $existing.lineGroupUrl }
}

if ($inquiry) { $config.lineInquiryUrl = $inquiry.Trim() }
if ($group) { $config.lineGroupUrl = $group.Trim() }

@{
  publicUrl = $config.publicUrl
  lineInquiryUrl = $config.lineInquiryUrl
  lineGroupUrl = $config.lineGroupUrl
} | ConvertTo-Json -Depth 4 | Set-Content -Path $siteConfig -Encoding UTF8
Write-Host ""
Write-Host "已寫入本機設定：$siteConfig" -ForegroundColor Green
Write-Host ""
Write-Host "雲端部署請到 Render 設定環境變數：" -ForegroundColor Yellow
if ($inquiry) {
  Write-Host "  LINE_INQUIRY_URL = $inquiry" -ForegroundColor White
}
if ($group) {
  Write-Host "  LINE_GROUP_URL = $group" -ForegroundColor White
}
Write-Host ""
Write-Host "正在開啟 Render 控制台..." -ForegroundColor Cyan
Start-Process $renderUrl