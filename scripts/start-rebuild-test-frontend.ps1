param(
    [string]$Root = "C:\Users\KS\Documents\yacineapp\somepharm-maintenance"
)

$ErrorActionPreference = "Stop"

$frontend = Join-Path $Root "frontend"

if (!(Test-Path $frontend)) {
    throw "Frontend directory not found: $frontend"
}

Set-Location $frontend

Write-Host ""
Write-Host "Starting Next.js frontend..." -ForegroundColor Cyan
Write-Host ""

npm run dev
