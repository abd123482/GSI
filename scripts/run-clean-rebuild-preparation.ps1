param(
    [string]$Root = "C:\Users\KS\Documents\yacineapp\somepharm-maintenance"
)

$ErrorActionPreference = "Stop"

$backend =
    Join-Path $Root "backend"

$alignment =
    Join-Path $backend "sql\db-target-alignment-report.json"

$discovery =
    Join-Path $backend "sql\database-discovery-report.json"

$script =
    Join-Path $backend "scripts\check-rebuild-readiness.mjs"

$compiledClient =
    Join-Path $backend "dist\generated\prisma\client.js"

if (!(Test-Path $alignment)) {
    throw "DB alignment report is missing."
}

$alignmentReport =
    Get-Content $alignment -Raw |
    ConvertFrom-Json

if (
    -not $alignmentReport.sameConfiguredTarget -or
    -not $alignmentReport.sameConnectedTarget
) {
    throw "DB target alignment is not confirmed."
}

if (!(Test-Path $discovery)) {
    throw "Database discovery report is missing."
}

$discoveryReport =
    Get-Content $discovery -Raw |
    ConvertFrom-Json

if ($discoveryReport.candidateCount -gt 0) {
    throw @"
Another database candidate exists.
Do not prepare a clean rebuild until that database is reviewed.
"@
}

if (!(Test-Path $script)) {
    throw "Readiness script missing: $script"
}

Set-Location $backend

if (!(Test-Path $compiledClient)) {
    npm run build

    if ($LASTEXITCODE -ne 0) {
        throw "Backend build failed."
    }
}

Write-Host ""
Write-Host "SOMIPHARM CLEAN REBUILD PREPARATION" -ForegroundColor Cyan
Write-Host "Phase 1: recovery/readiness gate." -ForegroundColor Yellow
Write-Host "Nothing will be created in SQL Server." -ForegroundColor Yellow
Write-Host ""

node .\scripts\check-rebuild-readiness.mjs

$exit =
    $LASTEXITCODE

if ($exit -ne 0) {
    Write-Host ""
    Write-Host "STOP: clean rebuild candidate will NOT be generated." -ForegroundColor Red
    Write-Host "Review backend\sql\rebuild-readiness-report.json." -ForegroundColor Yellow
    exit $exit
}

Write-Host ""
Write-Host "Phase 2: generate CURRENT schema SQL candidate." -ForegroundColor Cyan
Write-Host ""

Set-Location $Root

& .\scripts\generate-current-schema-sql.ps1 -Root $Root

if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

Write-Host ""
Write-Host "PREPARATION COMPLETE." -ForegroundColor Green
Write-Host ""
Write-Host "No database schema was changed." -ForegroundColor Green
Write-Host "Generated candidate:" -ForegroundColor Cyan
Write-Host "backend\sql\generated\current-schema-rebuild-candidate.sql"
Write-Host ""
Write-Host "Do not execute it against yacinedb yet." -ForegroundColor Yellow
