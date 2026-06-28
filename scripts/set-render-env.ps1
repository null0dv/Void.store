param(
  [string]$RenderApiKey = $env:RENDER_API_KEY
)

$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$envFile = Join-Path (Split-Path $projectDir -Parent) ".env.local"
$serviceName = "null0dv-void-store"

if (-not $RenderApiKey) {
  $RenderApiKey = Read-Host "Paste Render API key (from dashboard.render.com/account/api-keys)"
}

if (-not (Test-Path $envFile)) {
  Write-Host "Missing .env.local" -ForegroundColor Red
  exit 1
}

$vars = @{}
Get-Content $envFile | ForEach-Object {
  if ($_ -match '^([^=]+)=(.*)$') { $vars[$matches[1]] = $matches[2] }
}

if (-not $vars.SUPABASE_URL -or -not $vars.SUPABASE_SERVICE_ROLE_KEY) {
  Write-Host "Missing Supabase values in .env.local" -ForegroundColor Red
  exit 1
}

$headers = @{
  Authorization = "Bearer $RenderApiKey"
  Accept = "application/json"
  "Content-Type" = "application/json"
}

$services = Invoke-RestMethod -Uri "https://api.render.com/v1/services?limit=100" -Headers $headers -Method Get
$service = $services | Where-Object { $_.service.name -eq $serviceName } | Select-Object -First 1
if (-not $service) {
  Write-Host "Service not found: $serviceName" -ForegroundColor Red
  exit 1
}

$serviceId = $service.service.id
Write-Host "Service ID: $serviceId" -ForegroundColor Green

function Set-RenderEnv($key, $value) {
  $body = @{ envVar = @{ key = $key; value = $value } } | ConvertTo-Json -Depth 5
  Invoke-RestMethod -Uri "https://api.render.com/v1/services/$serviceId/env-vars" -Headers $headers -Method Post -Body $body | Out-Null
  Write-Host "Set $key" -ForegroundColor Green
}

Set-RenderEnv "SUPABASE_URL" $vars.SUPABASE_URL
Set-RenderEnv "SUPABASE_SERVICE_ROLE_KEY" $vars.SUPABASE_SERVICE_ROLE_KEY

Invoke-RestMethod -Uri "https://api.render.com/v1/services/$serviceId/deploys" -Headers $headers -Method Post -Body "{}" | Out-Null
Write-Host "Deploy triggered" -ForegroundColor Cyan
Write-Host "Site: https://null0dv-void-store.onrender.com" -ForegroundColor Cyan