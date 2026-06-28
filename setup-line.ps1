# LINE inquiry + group link setup for Void.Store
param(
  [string]$InquiryUrl,
  [string]$GroupUrl,
  [switch]$SkipRender
)

$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$siteConfig = Join-Path $projectDir 'data\site-config.json'
$envFile = Join-Path $projectDir '.env.local'
$renderUrl = 'https://dashboard.render.com/'
$serviceName = 'null0dv-void-store'

Write-Host ''
Write-Host '========================================' -ForegroundColor Cyan
Write-Host '  Void.Store LINE Setup' -ForegroundColor Cyan
Write-Host '========================================' -ForegroundColor Cyan
Write-Host ''
Write-Host 'Get two links from LINE:' -ForegroundColor Yellow
Write-Host '  1. Inquiry URL (official account or personal)'
Write-Host '     e.g. https://line.me/R/oaMessage/@your-id/'
Write-Host '     or   https://line.me/R/ti/p/@your-id'
Write-Host '  2. Group invite URL'
Write-Host '     e.g. https://line.me/ti/g/xxxxxxxxxx'
Write-Host ''

if (-not $InquiryUrl) {
  $InquiryUrl = Read-Host 'LINE inquiry URL (optional)'
}
if (-not $GroupUrl) {
  $GroupUrl = Read-Host 'LINE group URL (optional)'
}

$inquiry = if ($InquiryUrl) { $InquiryUrl.Trim() } else { '' }
$group = if ($GroupUrl) { $GroupUrl.Trim() } else { '' }

if (-not $inquiry -and -not $group) {
  Write-Host 'No URLs entered. Cancelled.' -ForegroundColor Red
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

Write-Host ''
Write-Host "Saved local config: $siteConfig" -ForegroundColor Green

function Set-RenderLineEnv {
  param(
    [string]$ApiKey,
    [hashtable]$Vars
  )

  $headers = @{
    Authorization = "Bearer $ApiKey"
    Accept = 'application/json'
    'Content-Type' = 'application/json'
  }

  $services = Invoke-RestMethod -Uri 'https://api.render.com/v1/services?limit=100' -Headers $headers -Method Get
  $service = $services | Where-Object { $_.service.name -eq $serviceName } | Select-Object -First 1
  if (-not $service) {
    throw "Render service not found: $serviceName"
  }

  $serviceId = $service.service.id
  Write-Host "Render service ID: $serviceId" -ForegroundColor Green

  foreach ($entry in $Vars.GetEnumerator()) {
    $body = @{ value = $entry.Value } | ConvertTo-Json -Depth 5
    $encodedKey = [Uri]::EscapeDataString($entry.Key)
    Invoke-RestMethod -Uri "https://api.render.com/v1/services/$serviceId/env-vars/$encodedKey" -Headers $headers -Method Put -Body $body | Out-Null
    Write-Host "Set $($entry.Key)" -ForegroundColor Green
  }

  Invoke-RestMethod -Uri "https://api.render.com/v1/services/$serviceId/deploys" -Headers $headers -Method Post -Body '{}' | Out-Null
  Write-Host 'Render redeploy triggered' -ForegroundColor Cyan
}

$syncRender = $false
if (-not $SkipRender) {
  $answer = Read-Host 'Sync to Render cloud? (Y/n)'
  $syncRender = ($answer -ne 'n' -and $answer -ne 'N')
}

if ($syncRender) {
  $apiKey = $null
  if (Test-Path $envFile) {
    $apiKey = (Get-Content $envFile | Where-Object { $_ -match '^RENDER_API_KEY=' }) -replace '^RENDER_API_KEY=', ''
  }
  if (-not $apiKey) {
    $apiKey = Read-Host 'Paste Render API key (or press Enter to skip)'
  }

  if ($apiKey) {
    try {
      $renderVars = @{}
      if ($inquiry) { $renderVars.LINE_INQUIRY_URL = $inquiry }
      if ($group) { $renderVars.LINE_GROUP_URL = $group }
      Set-RenderLineEnv -ApiKey $apiKey -Vars $renderVars
      Write-Host 'Site: https://null0dv-void-store.onrender.com' -ForegroundColor Cyan
    } catch {
      Write-Host "Render sync failed: $($_.Exception.Message)" -ForegroundColor Red
      $syncRender = $false
    }
  } else {
    $syncRender = $false
  }
}

if (-not $syncRender) {
  Write-Host ''
  Write-Host 'Set these in Render Environment manually:' -ForegroundColor Yellow
  if ($inquiry) { Write-Host "  LINE_INQUIRY_URL = $inquiry" -ForegroundColor White }
  if ($group) { Write-Host "  LINE_GROUP_URL = $group" -ForegroundColor White }
  Write-Host ''
  Write-Host 'Opening Render dashboard...' -ForegroundColor Cyan
  Start-Process $renderUrl
}

Write-Host ''
Write-Host 'Done.' -ForegroundColor Green