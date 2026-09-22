param(
    [string]$Root = "C:\Users\KS\Documents\yacineapp\somepharm-maintenance"
)

$ErrorActionPreference = "Stop"

$backend =
    Join-Path $Root "backend"

$alignmentReport =
    Join-Path $backend "sql\db-target-alignment-report.json"

$auditScript =
    Join-Path $backend "scripts\audit-db-hardening.mjs"

$compiledClient =
    Join-Path $backend "dist\generated\prisma\client.js"

if (!(Test-Path $backend)) {
    throw "Backend directory not found: $backend"
}

if (!(Test-Path $alignmentReport)) {
    throw @"
Database alignment report not found:
$alignmentReport

Run first:
.\scripts\run-db-target-alignment.ps1
"@
}

$alignment =
    Get-Content $alignmentReport -Raw |
    ConvertFrom-Json

if (
    -not $alignment.sameConfiguredTarget -or
    -not $alignment.sameConnectedTarget
) {
    throw @"
Database target alignment has NOT passed.

Configured target match: $($alignment.sameConfiguredTarget)
Connected target match:  $($alignment.sameConnectedTarget)

Do not harden the database until DB_* and DATABASE_URL point to the same target.
"@
}

if (!(Test-Path $auditScript)) {
    throw "Audit script not found: $auditScript"
}

Set-Location $backend

if (!(Test-Path $compiledClient)) {
    Write-Host "Compiled backend missing. Running safe build..." -ForegroundColor Yellow

    npm run build

    if ($LASTEXITCODE -ne 0) {
        throw "Backend build failed."
    }
}

Write-Host ""
Write-Host "SOMIPHARM DB HARDENING AUDIT" -ForegroundColor Cyan
Write-Host "READ ONLY - no DDL, no DML, no migration." -ForegroundColor Yellow
Write-Host ""

node .\scripts\audit-db-hardening.mjs

$exit =
    $LASTEXITCODE

Write-Host ""

switch ($exit) {
    0 {
        Write-Host "PASS: no hardening errors or warnings found." -ForegroundColor Green
    }

    2 {
        Write-Host "AUDIT PASSED WITH WARNINGS." -ForegroundColor Yellow
        Write-Host "Review missing/disabled optional hardening objects before applying anything." -ForegroundColor Yellow
    }

    3 {
        Write-Host "AUDIT FOUND DATA/SCHEMA INTEGRITY ERRORS." -ForegroundColor Red
        Write-Host "Do not auto-fix them. Review the JSON report first." -ForegroundColor Yellow
    }

    default {
        Write-Host "Audit could not complete." -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Report:" -ForegroundColor Cyan
Write-Host (
    Join-Path $backend "sql\db-hardening-audit-report.json"
)

exit $exit
