param(
  [Parameter(Mandatory = $true)]
  [string]$DatabaseUrl
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $repoRoot "apps\web\.env"

if (-not (Test-Path $envFile)) {
  Write-Error "Missing $envFile"
}

if ($DatabaseUrl -notmatch "sslmode=") {
  if ($DatabaseUrl -match "\?") {
    $DatabaseUrl = "$DatabaseUrl&sslmode=require"
  } else {
    $DatabaseUrl = "$DatabaseUrl?sslmode=require"
  }
}

$content = Get-Content $envFile -Raw
if ($content -match "(?m)^DATABASE_URL=.*$") {
  $content = [regex]::Replace($content, "(?m)^DATABASE_URL=.*$", "DATABASE_URL=$DatabaseUrl")
} else {
  $content = "DATABASE_URL=$DatabaseUrl`n$content"
}

Set-Content -Path $envFile -Value $content -NoNewline
Write-Host "Updated DATABASE_URL in apps/web/.env" -ForegroundColor Green

Set-Location $repoRoot
Write-Host "Running db:bootstrap..." -ForegroundColor Yellow
bun run db:bootstrap
