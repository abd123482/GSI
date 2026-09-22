param(
    [string]$Root = "C:\Users\KS\Documents\yacineapp\somepharm-maintenance"
)

$ErrorActionPreference = "Stop"

$backend =
    Join-Path $Root "backend"

$script =
    Join-Path $backend "scripts\inspect-db-targets.mjs"

$generatedClient =
    Join-Path $backend "dist\generated\prisma\client.js"

if (!(Test-Path $backend)) {
    throw "Backend directory not found: $backend"
}

if (!(Test-Path $script)) {
    throw "Database alignment script not found: $script"
}

Set-Location $backend

Write-Host ""
Write-Host "SOMIPHARM DATABASE TARGET ALIGNMENT" -ForegroundColor Cyan
Write-Host "READ ONLY: no schema or data mutation." -ForegroundColor Yellow
Write-Host ""

if (!(Test-Path $generatedClient)) {
    Write-Host "Compiled Prisma client not found in dist. Running safe backend build..." -ForegroundColor Yellow

    npm run build

    if ($LASTEXITCODE -ne 0) {
        throw "Backend build failed."
    }
}

if (!(Test-Path $generatedClient)) {
    throw "Compiled Prisma client still not found: $generatedClient"
}

node .\scripts\inspect-db-targets.mjs

$exit =
    $LASTEXITCODE

Write-Host ""

if ($exit -eq 0) {
    Write-Host "PASS: Nest runtime and Prisma CLI point to the same SQL Server/database." -ForegroundColor Green
}
elseif ($exit -eq 2) {
    Write-Host "MISMATCH: DB_* and DATABASE_URL do not resolve to the same target." -ForegroundColor Red
    Write-Host "Do not run migration commands until the mismatch is corrected." -ForegroundColor Yellow
}
else {
    Write-Host "Inspection failed. Review the connection error above." -ForegroundColor Red
}

Write-Host ""
Write-Host "Report:" -ForegroundColor Cyan
Write-Host (
    Join-Path $backend "sql\db-target-alignment-report.json"
)

exit $exit
