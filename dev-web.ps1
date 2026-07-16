param(
  [int]$Port = 3001
)

Write-Host "Stopping process on port $Port (if any)..." -ForegroundColor Yellow
try {
  $conn = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($conn -and $conn.OwningProcess) {
    # /T kills the whole process tree, not just the port holder — a crashed
    # Turbopack worker pool otherwise leaves orphaned webpack-loaders.js
    # processes behind that keep accumulating across restarts.
    taskkill /PID $conn.OwningProcess /T /F 2>$null | Out-Null
    Write-Host "Stopped process tree $($conn.OwningProcess)." -ForegroundColor Green
  } else {
    Write-Host "No process found on port $Port." -ForegroundColor Green
  }
} catch {
  Write-Host "Could not check/stop port $Port. Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "Sweeping for orphaned dev-server worker processes..." -ForegroundColor Yellow
try {
  $orphans = Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -like "*$PSScriptRoot*" }
  if ($orphans) {
    foreach ($p in $orphans) {
      Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
    }
    Write-Host "Stopped $($orphans.Count) orphaned process(es)." -ForegroundColor Green
  } else {
    Write-Host "No orphaned processes found." -ForegroundColor Green
  }
} catch {
  Write-Host "Could not sweep orphaned processes. Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "Starting web dev server..." -ForegroundColor Yellow
Set-Location $PSScriptRoot
bun run dev:web
