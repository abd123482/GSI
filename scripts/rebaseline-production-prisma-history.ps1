param(
    [Parameter(Mandatory = $true)]
    [string]$Confirmation,

    [string]$Root = "C:\Users\KS\Documents\yacineapp\somepharm-maintenance"
)

$ErrorActionPreference = "Stop"
$originalLocation = Get-Location

$required =
    "I CONFIRM REPLACE LEGACY PRISMA HISTORY WITH VALIDATED BASELINE"

if ($Confirmation -ne $required) {
    throw @"
Safety confirmation did not match.

Required:
$required
"@
}

function Read-EnvValue {
    param(
        [string]$Path,
        [string]$Name
    )

    $line = Get-Content $Path |
        Where-Object {
            $_ -match "^\s*$([regex]::Escape($Name))\s*="
        } |
        Select-Object -First 1

    if (!$line) {
        throw "Missing $Name in $Path"
    }

    $value = ($line -split "=", 2)[1].Trim()

    if (
        ($value.StartsWith('"') -and $value.EndsWith('"')) -or
        ($value.StartsWith("'") -and $value.EndsWith("'"))
    ) {
        $value = $value.Substring(1, $value.Length - 2)
    }

    return $value
}

try {
    $backend = Join-Path $Root "backend"
    $envFile = Join-Path $backend ".env"
    $statePath =
        Join-Path $backend "sql\generated\production-prisma-rebaseline-state.json"

    if (!(Test-Path $envFile)) {
        throw "Backend .env not found."
    }

    $productionUrl =
        Read-EnvValue -Path $envFile -Name "DATABASE_URL"

    if ($productionUrl -notmatch "(?i)(^|;)database=yacinedb(;|$)") {
        throw "Safety stop: DATABASE_URL is not explicitly targeting yacinedb."
    }

    $oldDatabaseUrl = $env:DATABASE_URL
    $oldDbName = $env:DB_NAME

    $env:DATABASE_URL = $productionUrl
    $env:DB_NAME = "yacinedb"
    $env:PRISMA_REBASELINE_CONFIRMATION = $Confirmation

    Set-Location $backend

    Write-Host ""
    Write-Host "PRODUCTION PRISMA HISTORY REBASELINE" -ForegroundColor Cyan
    Write-Host "Target: yacinedb" -ForegroundColor Yellow
    Write-Host "Application tables/data will NOT be dropped." -ForegroundColor Yellow
    Write-Host ""

    npm run build

    if ($LASTEXITCODE -ne 0) {
        throw "Backend build failed."
    }

    node .\scripts\rebaseline-production-prisma-history.mjs

    if ($LASTEXITCODE -ne 0) {
        throw "Production Prisma-history preflight/rebaseline failed."
    }

    if (!(Test-Path $statePath)) {
        throw "Rebaseline state file was not created."
    }

    $state =
        Get-Content $statePath -Raw |
        ConvertFrom-Json

    if (!$state.baselineAlreadyApplied) {
        Write-Host ""
        Write-Host "Registering validated baseline as applied..." -ForegroundColor Cyan

        npx prisma migrate resolve --applied 20260923_baseline

        if ($LASTEXITCODE -ne 0) {
            throw @"
prisma migrate resolve failed.

Do NOT run migrate deploy.
The old migration metadata was archived at:
$($state.archivePath)

Application schema/data are unchanged.
"@
        }
    }

    node .\scripts\verify-production-prisma-baseline.mjs

    if ($LASTEXITCODE -ne 0) {
        throw "Final production Prisma-history verification failed."
    }

    Write-Host ""
    npx prisma migrate status

    if ($LASTEXITCODE -ne 0) {
        throw "Prisma migrate status is not clean."
    }

    Write-Host ""
    Write-Host "PRODUCTION PRISMA HISTORY REBASELINE PASSED." -ForegroundColor Green
    Write-Host "Database schema is now represented by 20260923_baseline." -ForegroundColor Green
}
finally {
    Remove-Item Env:\PRISMA_REBASELINE_CONFIRMATION -ErrorAction SilentlyContinue

    if ($null -eq $oldDatabaseUrl) {
        Remove-Item Env:\DATABASE_URL -ErrorAction SilentlyContinue
    }
    else {
        $env:DATABASE_URL = $oldDatabaseUrl
    }

    if ($null -eq $oldDbName) {
        Remove-Item Env:\DB_NAME -ErrorAction SilentlyContinue
    }
    else {
        $env:DB_NAME = $oldDbName
    }

    Set-Location $originalLocation
}
