param(
    [string]$Root = "C:\Users\KS\Documents\yacineapp\somepharm-maintenance",
    [string]$DatabaseName = "yacinedb_rebuild_test"
)

$ErrorActionPreference = "Stop"
$originalLocation = Get-Location

try {
    if (
        $DatabaseName -notmatch
        '^yacinedb_rebuild_test(?:_[A-Za-z0-9_]+)?$'
    ) {
        throw "Safety stop: DatabaseName must be yacinedb_rebuild_test or yacinedb_rebuild_test_*."
    }

    $backend =
        Join-Path $Root "backend"

    $verification =
        Join-Path $backend "sql\generated\$DatabaseName-verification-report.json"

    $script =
        Join-Path $backend "scripts\apply-rebuild-test-hardening.mjs"

    if (
        !(Test-Path $verification)
    ) {
        throw @"
Test database verification report not found:
$verification

Run first:
.\scripts\run-rebuild-test-database.ps1 -DatabaseName $DatabaseName
"@
    }

    if (
        !(Test-Path $script)
    ) {
        throw "Hardening runner not found: $script"
    }

    Set-Location $backend

    $env:REBUILD_DB_NAME =
        $DatabaseName

    Write-Host ""
    Write-Host "SOMIPHARM TEST-DB HARDENING" -ForegroundColor Cyan
    Write-Host "Target: $DatabaseName" -ForegroundColor Green
    Write-Host "The real yacinedb will NOT be modified." -ForegroundColor Yellow
    Write-Host ""

    node .\scripts\apply-rebuild-test-hardening.mjs

    $exit =
        $LASTEXITCODE

    Remove-Item Env:\REBUILD_DB_NAME -ErrorAction SilentlyContinue

    if (
        $exit -ne 0
    ) {
        Write-Host ""
        Write-Host "Hardening did not complete successfully." -ForegroundColor Red
        exit $exit
    }

    Write-Host ""
    Write-Host "TEST DATABASE HARDENING PASSED." -ForegroundColor Green
}
finally {
    Remove-Item Env:\REBUILD_DB_NAME -ErrorAction SilentlyContinue
    Set-Location $originalLocation
}
