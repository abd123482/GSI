param(
    [string]$Root = "C:\Users\KS\Documents\yacineapp\somepharm-maintenance"
)

$ErrorActionPreference = "Stop"
$originalLocation = Get-Location

try {
    $backend = Join-Path $Root "backend"
    $script = Join-Path $backend "scripts\check-production-apply-readiness.mjs"

    if (!(Test-Path $script)) {
        throw "Production preflight script not found: $script"
    }

    Set-Location $backend

    Write-Host ""
    Write-Host "SOMIPHARM PRODUCTION APPLY PREFLIGHT" -ForegroundColor Cyan
    Write-Host "READ ONLY - it will not rebuild yacinedb." -ForegroundColor Yellow
    Write-Host ""

    node .\scripts\check-production-apply-readiness.mjs

    if ($LASTEXITCODE -ne 0) {
        throw "Production apply preflight did not pass."
    }

    Write-Host ""
    Write-Host "PREFLIGHT PASSED." -ForegroundColor Green
    Write-Host "The final rebuild must still be executed manually in SSMS." -ForegroundColor Yellow
}
finally {
    Set-Location $originalLocation
}
