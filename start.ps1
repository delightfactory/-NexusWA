Write-Host ""
Write-Host "NexusWA - Starting services..." -ForegroundColor Cyan
Write-Host ""

# Kill old processes
$ports = @(3000, 3001)
foreach ($port in $ports) {
    $conn = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($conn) {
        Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
        Write-Host "  [OK] Port $port freed" -ForegroundColor Green
    }
}
Start-Sleep -Seconds 2

# Start Backend
Write-Host ""
Write-Host "Starting Backend (port 3000)..." -ForegroundColor Cyan
Start-Process cmd.exe -ArgumentList "/c cd /d `"$PSScriptRoot\backend`" && npx tsx src/server.ts" -WindowStyle Normal
Start-Sleep -Seconds 4

# Start Frontend
Write-Host "Starting Frontend (port 3001)..." -ForegroundColor Cyan
Start-Process cmd.exe -ArgumentList "/c cd /d `"$PSScriptRoot\frontend`" && npm run dev" -WindowStyle Normal

Write-Host ""
Write-Host "================================================" -ForegroundColor Magenta
Write-Host "  NexusWA is running!" -ForegroundColor Magenta
Write-Host "  Dashboard: http://localhost:3001" -ForegroundColor White
Write-Host "  API:       http://localhost:3000" -ForegroundColor White
Write-Host "  Swagger:   http://localhost:3000/docs" -ForegroundColor White
Write-Host "================================================" -ForegroundColor Magenta
Write-Host ""
