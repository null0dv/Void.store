$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectDir

$cloudflared = "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\Cloudflare.cloudflared_Microsoft.Winget.Source_8wekyb3d8bbwe\cloudflared.exe"
$siteConfig = Join-Path $projectDir "data\site-config.json"
$logFile = Join-Path $projectDir "tunnel.log"

if (-not (Test-Path $cloudflared)) {
    Write-Host "找不到 cloudflared，請先安裝 Cloudflare Tunnel"
    Read-Host "按 Enter 結束"
    exit 1
}

$portInUse = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if (-not $portInUse) {
    Write-Host "啟動網站伺服器..."
    Start-Process -FilePath "node" -ArgumentList "server.js" -WorkingDirectory $projectDir -WindowStyle Minimized
    Start-Sleep -Seconds 2
}

$existingTunnel = Get-Process -Name cloudflared -ErrorAction SilentlyContinue
if ($existingTunnel) {
    Write-Host "公開隧道已在運行"
    if (Test-Path $siteConfig) {
        $config = Get-Content $siteConfig -Raw | ConvertFrom-Json
        if ($config.publicUrl) {
            Write-Host "公開網址：$($config.publicUrl)"
            Start-Process $config.publicUrl
            exit 0
        }
    }
}

if (Test-Path $logFile) { Remove-Item $logFile -Force }

Write-Host "啟動公開隧道..."
Start-Process -FilePath $cloudflared -ArgumentList "tunnel", "--url", "http://localhost:3000" `
    -RedirectStandardOutput $logFile -RedirectStandardError "tunnel-err.log" -WindowStyle Minimized

$publicUrl = $null
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 1
    if (Test-Path $logFile) {
        $content = Get-Content $logFile -Raw -ErrorAction SilentlyContinue
        if ($content -match '(https://[a-z0-9-]+\.trycloudflare\.com)') {
            $publicUrl = $matches[1]
            break
        }
    }
}

if (-not $publicUrl) {
    Write-Host "無法取得公開網址，請稍後再試"
    Read-Host "按 Enter 結束"
    exit 1
}

$config = @{ publicUrl = $publicUrl } | ConvertTo-Json
Set-Content -Path $siteConfig -Value $config -Encoding UTF8

Write-Host ""
Write-Host "公開網址：$publicUrl"
Write-Host "已儲存，分享連結將使用此網址"
Write-Host ""

Start-Process $publicUrl