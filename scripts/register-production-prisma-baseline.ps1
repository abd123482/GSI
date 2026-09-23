param(
    [Parameter(Mandatory = $true)]
    [string]$Confirmation,

    [string]$Root = "C:\Users\KS\Documents\yacineapp\somepharm-maintenance"
)

$ErrorActionPreference = "Stop"
$originalLocation = Get-Location

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

$requiredConfirmation =
    "I CONFIRM REGISTER VALIDATED BASELINE ON YACINEDB"

if ($Confirmation -ne $requiredConfirmation) {
    throw @"
Safety confirmation did not match.

Required:
$requiredConfirmation
"@
}

try {
    $backend = Join-Path $Root "backend"
    $envFile = Join-Path $backend ".env"

    if (!(Test-Path $envFile)) {
        throw "Backend .env not found."
    }

    $originalDatabaseUrl = $env:DATABASE_URL
    $originalDbName = $env:DB_NAME

    $productionUrl = Read-EnvValue -Path $envFile -Name "DATABASE_URL"

    if ($productionUrl -notmatch "(?i)(^|;)database=yacinedb(;|$)") {
        throw "Safety stop: backend DATABASE_URL is not explicitly targeting yacinedb."
    }

    $env:DATABASE_URL = $productionUrl
    $env:DB_NAME = "yacinedb"

    Set-Location $backend

    Write-Host ""
    Write-Host "PRODUCTION PRISMA BASELINE REGISTRATION" -ForegroundColor Cyan
    Write-Host "Target: yacinedb" -ForegroundColor Yellow
    Write-Host "This does NOT recreate tables." -ForegroundColor Yellow
    Write-Host "It records the validated baseline as already applied." -ForegroundColor Yellow
    Write-Host ""

    npm run build

    if ($LASTEXITCODE -ne 0) {
        throw "Backend build failed."
    }

    node .\scripts\check-production-baseline-register-ready.mjs

    if ($LASTEXITCODE -ne 0) {
        throw "Production baseline registration readiness failed."
    }

    $statusOutput = npx prisma migrate status 2>&1
    $statusExit = $LASTEXITCODE

    $alreadyRegistered =
        $statusOutput -match "Database schema is up to date" -and
        $statusOutput -notmatch "have not yet been applied"

    if (!$alreadyRegistered) {
        Write-Host ""
        Write-Host "Registering validated baseline as applied..." -ForegroundColor Cyan

        npx prisma migrate resolve --applied 20260923_baseline

        if ($LASTEXITCODE -ne 0) {
            throw "prisma migrate resolve failed."
        }
    }
    else {
        Write-Host "Prisma already reports the baseline as current; skipping resolve." -ForegroundColor Green
    }

    Write-Host ""
    npx prisma migrate status

    if ($LASTEXITCODE -ne 0) {
        throw "Final prisma migrate status failed."
    }

    Write-Host ""
    Write-Host "PRODUCTION PRISMA BASELINE REGISTERED." -ForegroundColor Green
    Write-Host "Future production schema changes can use reviewed prisma migrate deploy migrations." -ForegroundColor Green
}
finally {
    if ($null -eq $originalDatabaseUrl) {
        Remove-Item Env:\DATABASE_URL -ErrorAction SilentlyContinue
    }
    else {
        $env:DATABASE_URL = $originalDatabaseUrl
    }

    if ($null -eq $originalDbName) {
        Remove-Item Env:\DB_NAME -ErrorAction SilentlyContinue
    }
    else {
        $env:DB_NAME = $originalDbName
    }

    Set-Location $originalLocation
}
