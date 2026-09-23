param(
    [string]$Root = "C:\Users\KS\Documents\yacineapp\somepharm-maintenance"
)

$ErrorActionPreference = "Stop"

$backend =
    Join-Path $Root "backend"

$script =
    Join-Path $backend "scripts\discover-app-databases.mjs"

$compiledClient =
    Join-Path $backend "dist\generated\prisma\client.js"

if (!(Test-Path $backend)) {
    throw "Backend directory not found: $backend"
}

if (!(Test-Path $script)) {
    throw "Discovery script not found: $script"
}

Set-Location $backend

if (!(Test-Path $compiledClient)) {
    Write-Host "Compiled Prisma client missing. Running safe backend build..." -ForegroundColor Yellow

    npm run build

    if ($LASTEXITCODE -ne 0) {
        throw "Backend build failed."
    }
}

Write-Host ""
Write-Host "SOMIPHARM DATABASE DISCOVERY" -ForegroundColor Cyan
Write-Host "READ ONLY - no schema or data changes." -ForegroundColor Yellow
Write-Host ""

node .\scripts\discover-app-databases.mjs

$exit = $LASTEXITCODE

Write-Host ""

switch ($exit) {
    0 {
        Write-Host "A single exact candidate database was found." -ForegroundColor Green
    }

    2 {
        Write-Host "Multiple exact candidates were found. Review before changing .env." -ForegroundColor Yellow
    }

    3 {
        Write-Host "Only partial candidates were found. Review the JSON report." -ForegroundColor Yellow
    }

    4 {
        Write-Host "No accessible database contains the expected SOMIPHARM tables." -ForegroundColor Red
        Write-Host "Do NOT create a new schema yet. First check whether another SQL Server instance or backup exists." -ForegroundColor Yellow
    }

    default {
        Write-Host "Discovery failed. Review the error above." -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Report:" -ForegroundColor Cyan
Write-Host (
    Join-Path $backend "sql\database-discovery-report.json"
)

exit $exit
