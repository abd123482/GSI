param(
    [string]$Root = "C:\Users\KS\Documents\yacineapp\somepharm-maintenance",
    [string]$DatabaseName = "yacinedb_rebuild_test"
)

$ErrorActionPreference = "Stop"

$backend = Join-Path $Root "backend"

if (!(Test-Path $backend)) {
    throw "Backend directory not found: $backend"
}

Set-Location $backend

$env:DB_NAME = $DatabaseName

Write-Host ""
Write-Host "Starting NestJS against TEST DB: $DatabaseName" -ForegroundColor Cyan
Write-Host "This process-local override does not edit backend\.env." -ForegroundColor Yellow
Write-Host ""

npm run start:dev
