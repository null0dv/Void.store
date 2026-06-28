# LINE inquiry + group link setup for Void.Store
param(
  [string]$InquiryUrl,
  [string]$GroupUrl,
  [switch]$SkipRender
)

$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$siteConfig = Join-Path $projectDir "data\site-config.json"
$envFile = Join-Path $projectDir ".env.local"
$renderUrl = "https://dashboard.render.com/"
$serviceName = "null0dv-void-store"

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

if (-not $InquiryUrl) {
  $InquiryUrl = Read-Host "貼上 LINE 詢價連結（可留空）"
}
if (-not $GroupUrl) {
  $GroupUrl = Read-Host "貼上 LINE 群組連結（可留空）"
}

$inquiry = $InquiryUrl.Trim()
$group = $GroupUrl.Trim()

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

if ($inquiry) { $config.lineInquiryUrl = $inquiry }
if ($group) { $config.lineGroupUrl = $group }

@{
  publicUrl = $config.publicUrl
  lineInquiryUrl = $config.lineInquiryUrl
  lineGroupUrl = $config.lineGroupUrl
} | ConvertTo-Json -Depth 4 | Set-Content -Path $siteConfig -Encoding UTF8

Write-Host ""
Write-Host "已寫入本機設定：$siteConfig" -ForegroundColor Green

function Set-RenderLineEnv {
  param(
    [string]$ApiKey,
    [hashtable]$Vars
  )

  $headers = @{
    Authorization = "Bearer $ApiKey"
    Accept = "application/json"
    "Content-Type" = "application/json"
  }

  $services = Invoke-RestMethod -Uri "https://api.render.com/v1/services?limit=100" -Headers $headers -Method Get
  $service = $services | Where-Object { $_.service.name -eq $serviceName } | Select-Object -First 1
  if (-not $service) {
    throw "找不到 Render 服務：$serviceName"
  }

  $serviceId = $service.service.id
  Write-Host "Render 服務 ID：$serviceId" -ForegroundColor Green

  foreach ($entry in $Vars.GetEnumerator()) {
    $body = @{ value = $entry.Value } | ConvertTo-Json -Depth 5
    $encodedKey = [Uri]::EscapeDataString($entry.Key)
    Invoke-RestMethod -Uri "https://api.render.com/v1/services/$serviceId/env-vars/$encodedKey" -Headers $headers -Method Put -Body $body | Out-Null
    Write-Host "已設定 $($entry.Key)" -ForegroundColor Green
  }

  Invoke-RestMethod -Uri "https://api.render.com/v1/services/$serviceId/deploys" -Headers $headers -Method Post -Body "{}" | Out-Null
  Write-Host "已觸發 Render 重新部署" -ForegroundColor Cyan
}

$syncRender = $false
if (-not $SkipRender) {
  $answer = Read-Host "是否同步到 Render 雲端？(Y/n)"
  $syncRender = ($answer -ne 'n' -and $answer -ne 'N')
}

if ($syncRender) {
  $apiKey = $null
  if (Test-Path $envFile) {
    $apiKey = (Get-Content $envFile | Where-Object { $_ -match '^RENDER_API_KEY=' }) -replace '^RENDER_API_KEY=', ''
  }
  if (-not $apiKey) {
    $apiKey = Read-Host "貼上 Render API Key（或按 Enter 改用手動設定）"
  }

  if ($apiKey) {
    try {
      $renderVars = @{}
      if ($inquiry) { $renderVars.LINE_INQUIRY_URL = $inquiry }
      if ($group) { $renderVars.LINE_GROUP_URL = $group }
      Set-RenderLineEnv -ApiKey $apiKey -Vars $renderVars
      Write-Host "雲端網址：https://null0dv-void-store.onrender.com" -ForegroundColor Cyan
    } catch {
      Write-Host "Render 同步失敗：$($_.Exception.Message)" -ForegroundColor Red
      $syncRender = $false
    }
  } else {
    $syncRender = $false
  }
}

if (-not $syncRender) {
  Write-Host ""
  Write-Host "請到 Render 手動設定環境變數：" -ForegroundColor Yellow
  if ($inquiry) { Write-Host "  LINE_INQUIRY_URL = $inquiry" -ForegroundColor White }
  if ($group) { Write-Host "  LINE_GROUP_URL = $group" -ForegroundColor White }
  Write-Host ""
  Write-Host "正在開啟 Render 控制台..." -ForegroundColor Cyan
  Start-Process $renderUrl
}

Write-Host ""
Write-Host "完成！" -ForegroundColor Green