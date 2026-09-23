param(
    [string]$Root = "C:\Users\KS\Documents\yacineapp\somepharm-maintenance",
    [string]$DatabaseName = "yacinedb_rebuild_test"
)

$ErrorActionPreference = "Stop"

if ($DatabaseName -notmatch '^[A-Za-z][A-Za-z0-9_]{0,63}$') {
    throw "Invalid DatabaseName."
}

$backend =
    Join-Path $Root "backend"

if (!(Test-Path $backend)) {
    throw "Backend directory not found: $backend"
}

Set-Location $backend

# dotenv does not overwrite an existing process variable by default,
# so this keeps the normal .env credentials but changes DB_NAME only
# for this backend process.
$env:DB_NAME =
    $DatabaseName

Write-Host ""
Write-Host "Starting backend against TEST database: $DatabaseName" -ForegroundColor Cyan
Write-Host "This does not edit backend\.env." -ForegroundColor Yellow
Write-Host ""

npm run start:dev
