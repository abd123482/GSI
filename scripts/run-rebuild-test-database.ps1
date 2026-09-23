param(
    [string]$Root = "C:\Users\KS\Documents\yacineapp\somepharm-maintenance",
    [string]$DatabaseName = "yacinedb_rebuild_test"
)

$ErrorActionPreference = "Stop"
$originalLocation = Get-Location

try {
    if (
        $DatabaseName -notmatch
        '^[A-Za-z][A-Za-z0-9_]{0,63}$'
    ) {
        throw "Invalid DatabaseName."
    }

    if (
        $DatabaseName.ToLower() -eq
        "yacinedb"
    ) {
        throw "Safety stop: this runner never modifies yacinedb."
    }

    $backend =
        Join-Path $Root "backend"

    $readiness =
        Join-Path $backend "sql\rebuild-readiness-report.json"

    $candidate =
        Join-Path $backend "sql\generated\current-schema-rebuild-candidate.sql"

    $script =
        Join-Path $backend "scripts\build-rebuild-test-db.mjs"

    if (!(Test-Path $readiness)) {
        throw "Missing rebuild readiness report."
    }

    $readinessReport =
        Get-Content $readiness -Raw |
        ConvertFrom-Json

    if (
        $readinessReport.decision -ne
        "READY_TO_GENERATE_REBUILD_CANDIDATE"
    ) {
        throw "Safety stop: rebuild readiness did not pass."
    }

    if (!(Test-Path $candidate)) {
        throw "Missing generated current-schema candidate."
    }

    if (!(Test-Path $script)) {
        throw "Missing test DB builder."
    }

    Set-Location $backend

    $env:REBUILD_DB_NAME =
        $DatabaseName

    Write-Host ""
    Write-Host "SOMIPHARM ISOLATED REBUILD TEST" -ForegroundColor Cyan
    Write-Host "Target database: $DatabaseName" -ForegroundColor Green
    Write-Host "Real yacinedb will NOT be modified." -ForegroundColor Yellow
    Write-Host ""

    node .\scripts\build-rebuild-test-db.mjs

    $exit =
        $LASTEXITCODE

    Remove-Item Env:\REBUILD_DB_NAME -ErrorAction SilentlyContinue

    if ($exit -ne 0) {
        Write-Host ""
        Write-Host "Isolated rebuild did not complete." -ForegroundColor Red
        Write-Host ""
        Write-Host "If the error says CREATE DATABASE permission denied:" -ForegroundColor Yellow
        Write-Host "1. Open SSMS with Windows/sysadmin credentials."
        Write-Host "2. Run backend\sql\create_rebuild_test_database_admin.sql"
        Write-Host "3. Rerun this PowerShell script."
        exit $exit
    }

    Write-Host ""
    Write-Host "ISOLATED REBUILD TEST DATABASE CREATED AND VERIFIED." -ForegroundColor Green
    Write-Host ""
    Write-Host "Next:" -ForegroundColor Cyan
    Write-Host ".\scripts\run-rebuild-test-hardening.ps1"
}
finally {
    Remove-Item Env:\REBUILD_DB_NAME -ErrorAction SilentlyContinue
    Set-Location $originalLocation
}
