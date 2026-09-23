param(
    [Parameter(Mandatory = $true)]
    [string]$Email,

    [Parameter(Mandatory = $true)]
    [string]$Confirmation,

    [string]$Root = "C:\Users\KS\Documents\yacineapp\somepharm-maintenance"
)

$ErrorActionPreference = "Stop"
$originalLocation = Get-Location

try {
    $required =
        "I CONFIRM BOOTSTRAP THIS EXISTING CLERK USER AS PRODUCTION ADMIN"

    if ($Confirmation -ne $required) {
        throw @"
Safety confirmation did not match.

Required:
$required
"@
    }

    $backend = Join-Path $Root "backend"
    $script = Join-Path $backend "scripts\bootstrap-production-admin.mjs"

    if (!(Test-Path $script)) {
        throw "Script not found: $script"
    }

    Set-Location $backend

    $env:BOOTSTRAP_ADMIN_EMAIL = $Email
    $env:BOOTSTRAP_ADMIN_CONFIRMATION = $Confirmation

    Write-Host ""
    Write-Host "Production ADMIN bootstrap" -ForegroundColor Cyan
    Write-Host "Target DB: yacinedb" -ForegroundColor Yellow
    Write-Host "Target email: $Email" -ForegroundColor Yellow
    Write-Host ""

    node .\scripts\bootstrap-production-admin.mjs

    $exit = $LASTEXITCODE

    Remove-Item Env:\BOOTSTRAP_ADMIN_EMAIL -ErrorAction SilentlyContinue
    Remove-Item Env:\BOOTSTRAP_ADMIN_CONFIRMATION -ErrorAction SilentlyContinue

    if ($exit -ne 0) {
        throw "Production ADMIN bootstrap failed."
    }

    Write-Host ""
    Write-Host "ADMIN BOOTSTRAP PASSED." -ForegroundColor Green
}
finally {
    Remove-Item Env:\BOOTSTRAP_ADMIN_EMAIL -ErrorAction SilentlyContinue
    Remove-Item Env:\BOOTSTRAP_ADMIN_CONFIRMATION -ErrorAction SilentlyContinue
    Set-Location $originalLocation
}
