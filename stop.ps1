Write-Host ""
Write-Host "NexusWA - Stopping all services..." -ForegroundColor Red
Write-Host ""

$ports = @(3000, 3001)
foreach ($port in $ports) {
    $conn = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($conn) {
        Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
        Write-Host "  [OK] Port $port stopped" -ForegroundColor Green
    } else {
        Write-Host "  [--] Port $port not running" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "All services stopped." -ForegroundColor Green
Write-Host ""
