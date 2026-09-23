param(
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

try {
    $backend = Join-Path $Root "backend"
    $envFile = Join-Path $backend ".env"
    $manifest = Join-Path $backend "sql\generated\clean-prisma-baseline-manifest.json"

    if (!(Test-Path $manifest)) {
        throw @"
Baseline manifest not found.

Run first:
.\scripts\prepare-clean-prisma-baseline.ps1
"@
    }

    if (!(Test-Path $envFile)) {
        throw "Backend .env not found: $envFile"
    }

    $originalDatabaseUrl = $env:DATABASE_URL
    $originalDbName = $env:DB_NAME

    $productionUrl = Read-EnvValue -Path $envFile -Name "DATABASE_URL"

    if ($productionUrl -notmatch "(?i)(^|;)database=[^;]+") {
        throw "DATABASE_URL does not contain a SQL Server database= segment."
    }

    $testUrl = $productionUrl -replace "(?i)database=[^;]+", "database=yacinedb_baseline_test"

    $env:DATABASE_URL = $testUrl
    $env:DB_NAME = "yacinedb_baseline_test"

    Set-Location $backend

    Write-Host ""
    Write-Host "CLEAN PRISMA BASELINE TEST" -ForegroundColor Cyan
    Write-Host "Target: yacinedb_baseline_test" -ForegroundColor Green
    Write-Host "Real yacinedb will NOT be modified." -ForegroundColor Yellow
    Write-Host ""

    npm run build

    if ($LASTEXITCODE -ne 0) {
        throw "Backend build failed before baseline test."
    }

    node .\scripts\assert-baseline-test-empty.mjs

    if ($LASTEXITCODE -ne 0) {
        throw "Baseline test DB empty-target check failed."
    }

    Write-Host ""
    Write-Host "Applying clean baseline via prisma migrate deploy..." -ForegroundColor Cyan

    npx prisma migrate deploy

    if ($LASTEXITCODE -ne 0) {
        throw "prisma migrate deploy failed on the isolated baseline test DB."
    }

    npx prisma generate

    if ($LASTEXITCODE -ne 0) {
        throw "prisma generate failed."
    }

    npx tsc --noEmit

    if ($LASTEXITCODE -ne 0) {
        throw "TypeScript validation failed."
    }

    npm run build

    if ($LASTEXITCODE -ne 0) {
        throw "Backend build failed after baseline migration."
    }

    node .\scripts\seed-reference-data.mjs

    if ($LASTEXITCODE -ne 0) {
        throw "Reference/security seed failed."
    }

    node .\scripts\verify-baseline-test.mjs

    if ($LASTEXITCODE -ne 0) {
        throw "Baseline verification failed."
    }

    npx prisma migrate status

    if ($LASTEXITCODE -ne 0) {
        throw "prisma migrate status failed."
    }

    Write-Host ""
    Write-Host "CLEAN PRISMA BASELINE TEST PASSED." -ForegroundColor Green
    Write-Host "Production has NOT been changed." -ForegroundColor Yellow
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
