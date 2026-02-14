param(
  [int]$Port = 3001
)

Write-Host "Stopping process on port $Port (if any)..." -ForegroundColor Yellow
try {
  $conn = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($conn -and $conn.OwningProcess) {
    Stop-Process -Id $conn.OwningProcess -Force
    Write-Host "Stopped process $($conn.OwningProcess)." -ForegroundColor Green
  } else {
    Write-Host "No process found on port $Port." -ForegroundColor Green
  }
} catch {
  Write-Host "Could not check/stop port $Port. Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "Starting web dev server..." -ForegroundColor Yellow
Set-Location $PSScriptRoot
bun run dev:web
