$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectDir

$portInUse = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue

if (-not $portInUse) {
    Start-Process -FilePath "node" -ArgumentList "server.js" -WorkingDirectory $projectDir -WindowStyle Minimized
    Start-Sleep -Seconds 2
}

Start-Process "http://localhost:3000"