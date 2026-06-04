# PhishGuard - Pre-distribution cleanup (Windows)
# Usage:  .\cleanup.ps1           -> dry-run
#         .\cleanup.ps1 -Run      -> delete targets

param([switch]$Run)

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$DryRun = -not $Run
$TotalBytes = 0

function Format-Bytes([long]$Bytes) {
    if ($Bytes -ge 1GB) { return "{0:N1} GB" -f ($Bytes / 1GB) }
    if ($Bytes -ge 1MB) { return "{0:N1} MB" -f ($Bytes / 1MB) }
    if ($Bytes -ge 1KB) { return "{0:N1} KB" -f ($Bytes / 1KB) }
    return "$Bytes B"
}

function Remove-Target([string]$Path, [string]$Label) {
    if (-not (Test-Path $Path)) { return }
    $size = (Get-ChildItem $Path -Recurse -Force -ErrorAction SilentlyContinue |
        Measure-Object -Property Length -Sum).Sum
    if (-not $size) { $size = 0 }
    $script:TotalBytes += $size
    $human = Format-Bytes $size
    $rel = $Path.Replace($Root + "\", "")
    if ($DryRun) {
        Write-Host "  [DRY] $Label" -ForegroundColor Yellow
        Write-Host "        $rel ($human)" -ForegroundColor Cyan
    } else {
        Write-Host "  [DEL] $Label ($human)" -ForegroundColor Red
        Remove-Item $Path -Recurse -Force -ErrorAction SilentlyContinue
    }
}

Write-Host ""
Write-Host "PhishGuard Pre-Distribution Cleanup" -ForegroundColor Cyan
if ($DryRun) {
    Write-Host "  MODE: DRY-RUN" -ForegroundColor Yellow
    Write-Host "  Run: .\cleanup.ps1 -Run" -ForegroundColor Yellow
} else {
    Write-Host "  MODE: LIVE - deleting" -ForegroundColor Red
}
Write-Host ""

Write-Host "[1/5] node_modules" -ForegroundColor White
Get-ChildItem $Root -Directory -Filter node_modules -Recurse -Force -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -notmatch '\\node_modules\\.*\\node_modules' } |
    Sort-Object { $_.FullName.Length } -Descending |
    ForEach-Object { Remove-Target $_.FullName "node_modules" }

Write-Host "`n[2/5] .next" -ForegroundColor White
Remove-Target (Join-Path $Root "apps\web\.next") ".next"

Write-Host "`n[3/5] *.tsbuildinfo" -ForegroundColor White
Get-ChildItem $Root -Filter "*.tsbuildinfo" -Recurse -Force -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -notmatch '\\node_modules\\' } |
    ForEach-Object { Remove-Target $_.FullName "tsbuildinfo" }

Write-Host "`n[4/5] packages/*/dist" -ForegroundColor White
Get-ChildItem (Join-Path $Root "packages") -Directory -Filter dist -Recurse -Force -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -notmatch 'ml-service' } |
    ForEach-Object { Remove-Target $_.FullName "dist" }

Write-Host "`n[5/5] *.log" -ForegroundColor White
Get-ChildItem $Root -Filter "*.log" -Recurse -Force -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -notmatch '\\node_modules\\' } |
    ForEach-Object { Remove-Target $_.FullName "log" }

Write-Host ""
Write-Host "Estimated space freed: $(Format-Bytes $TotalBytes)" -ForegroundColor Green
if ($DryRun) {
    Write-Host "Dry-run only. Apply: .\cleanup.ps1 -Run" -ForegroundColor Yellow
} else {
    Write-Host "Done. Reinstall: bun install" -ForegroundColor Cyan
}

$Rar = Join-Path (Split-Path $Root -Parent) "phish-guard-app.rar"
if (Test-Path $Rar) {
    $rarSize = (Get-Item $Rar).Length
    Write-Host ""
    Write-Host "NOTE: phish-guard-app.rar ($((Format-Bytes $rarSize))) duplicates the repo - delete after backup." -ForegroundColor Yellow
}

Write-Host ""
