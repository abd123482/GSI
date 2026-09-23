param(
    [Parameter(Mandatory = $true)]
    [string]$Email,

    [Parameter(Mandatory = $true)]
    [string]$Confirmation,

    [string]$Root = "C:\Users\KS\Documents\yacineapp\somepharm-maintenance"
)

$ErrorActionPreference = "Stop"
$originalLocation = Get-Location

$required =
    "I CONFIRM CREATE OR LINK THIS CLERK USER AS PRODUCTION ADMIN"

if ($Confirmation -ne $required) {
    throw @"
Safety confirmation did not match.

Required:
$required
"@
}

try {
    $backend =
        Join-Path $Root "backend"

    $script =
        Join-Path $backend "scripts\bootstrap-admin-from-clerk.mjs"

    if (!(Test-Path $script)) {
        throw "Script not found: $script"
    }

    Set-Location $backend

    $env:BOOTSTRAP_ADMIN_EMAIL =
        $Email

    $env:BOOTSTRAP_ADMIN_CONFIRMATION =
        $Confirmation

    Write-Host ""
    Write-Host "DIRECT CLERK -> SQL ADMIN BOOTSTRAP" -ForegroundColor Cyan
    Write-Host "Target DB: yacinedb" -ForegroundColor Yellow
    Write-Host "Target email: $Email" -ForegroundColor Yellow
    Write-Host ""

    npm run build

    if ($LASTEXITCODE -ne 0) {
        throw "Backend build failed."
    }

    node .\scripts\bootstrap-admin-from-clerk.mjs

    if ($LASTEXITCODE -ne 0) {
        throw "Direct Clerk ADMIN bootstrap failed."
    }

    Write-Host ""
    Write-Host "DIRECT ADMIN BOOTSTRAP PASSED." -ForegroundColor Green
}
finally {
    Remove-Item Env:\BOOTSTRAP_ADMIN_EMAIL -ErrorAction SilentlyContinue
    Remove-Item Env:\BOOTSTRAP_ADMIN_CONFIRMATION -ErrorAction SilentlyContinue
    Set-Location $originalLocation
}
