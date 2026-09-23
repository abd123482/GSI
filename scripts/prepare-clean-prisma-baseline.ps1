param(
    [string]$Root = "C:\Users\KS\Documents\yacineapp\somepharm-maintenance"
)

$ErrorActionPreference = "Stop"
$originalLocation = Get-Location

try {
    $backend = Join-Path $Root "backend"
    $script = Join-Path $backend "scripts\prepare-clean-prisma-baseline.mjs"

    if (!(Test-Path $script)) {
        throw "Baseline preparation script not found: $script"
    }

    Set-Location $backend

    Write-Host ""
    Write-Host "PREPARING CLEAN PRISMA BASELINE" -ForegroundColor Cyan
    Write-Host "This changes migration files only. No database DDL will run." -ForegroundColor Yellow
    Write-Host ""

    node .\scripts\prepare-clean-prisma-baseline.mjs

    if ($LASTEXITCODE -ne 0) {
        throw "Clean baseline preparation failed."
    }

    Write-Host ""
    Write-Host "BASELINE PREPARATION PASSED." -ForegroundColor Green
}
finally {
    Set-Location $originalLocation
}
