param(
  [ValidateSet("development", "preview", "production")]
  [string]$Environment = "development"
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$webDir = Join-Path $repoRoot "apps\web"
$pullFile = Join-Path $webDir ".env.vercel"
$targetEnv = Join-Path $webDir ".env"

if (-not (Get-Command vercel -ErrorAction SilentlyContinue)) {
  Write-Error "Vercel CLI missing. Install: npm i -g vercel"
}

Set-Location $webDir
Write-Host "Pulling Vercel env ($Environment)..." -ForegroundColor Yellow
vercel env pull $pullFile --environment=$Environment --yes

if (-not (Test-Path $pullFile)) {
  Write-Error "Pull failed — no $pullFile"
}

$vercelDb = Select-String -Path $pullFile -Pattern '^DATABASE_URL=(.+)$' | ForEach-Object { $_.Matches[0].Groups[1].Value }
if (-not $vercelDb) {
  Write-Error "DATABASE_URL not found in $pullFile"
}

if (-not (Test-Path $targetEnv)) {
  Copy-Item (Join-Path $webDir ".env.example") $targetEnv
}

$content = Get-Content $targetEnv -Raw
if ($content -match "(?m)^DATABASE_URL=.*$") {
  $content = [regex]::Replace($content, "(?m)^DATABASE_URL=.*$", "DATABASE_URL=$vercelDb")
} else {
  $content = "DATABASE_URL=$vercelDb`n$content"
}

Set-Content -Path $targetEnv -Value $content -NoNewline
Write-Host "Updated DATABASE_URL in apps/web/.env from Vercel ($Environment)." -ForegroundColor Green
Write-Host "Run: bun run db:bootstrap" -ForegroundColor Cyan
