param(
    [string]$Root = "C:\Users\KS\Documents\yacineapp\somepharm-maintenance",
    [string]$DatabaseName = "yacinedb_rebuild_test"
)

$ErrorActionPreference = "Stop"
$originalLocation = Get-Location

try {
    $backend = Join-Path $Root "backend"
    $script = Join-Path $backend "scripts\verify-rebuild-test-ready.mjs"

    if (!(Test-Path $script)) {
        throw "Readiness script not found: $script"
    }

    Set-Location $backend

    $env:REBUILD_DB_NAME = $DatabaseName

    node .\scripts\verify-rebuild-test-ready.mjs

    $exit = $LASTEXITCODE

    Remove-Item Env:\REBUILD_DB_NAME -ErrorAction SilentlyContinue

    if ($exit -ne 0) {
        throw "Live smoke readiness check failed."
    }

    Write-Host ""
    Write-Host "READY FOR LIVE SMOKE TESTING." -ForegroundColor Green
}
finally {
    Remove-Item Env:\REBUILD_DB_NAME -ErrorAction SilentlyContinue
    Set-Location $originalLocation
}
