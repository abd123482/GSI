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

    if (!(Test-Path $envFile)) {
        throw "Backend .env not found: $envFile"
    }

    $oldDatabaseUrl = $env:DATABASE_URL
    $oldDbName = $env:DB_NAME

    $productionUrl =
        Read-EnvValue -Path $envFile -Name "DATABASE_URL"

    if ($productionUrl -notmatch "(?i)(^|;)database=[^;]+") {
        throw "DATABASE_URL does not contain a SQL Server database= segment."
    }

    $testUrl =
        $productionUrl -replace "(?i)database=[^;]+", "database=yacinedb_baseline_test"

    $env:DATABASE_URL = $testUrl
    $env:DB_NAME = "yacinedb_baseline_test"

    Set-Location $backend

    Write-Host ""
    Write-Host "RESUME CLEAN PRISMA BASELINE TEST" -ForegroundColor Cyan
    Write-Host "Target: yacinedb_baseline_test" -ForegroundColor Green
    Write-Host "Real yacinedb will NOT be modified." -ForegroundColor Yellow
    Write-Host ""

    npm run build

    if ($LASTEXITCODE -ne 0) {
        throw "Backend build failed."
    }

    node .\scripts\inspect-baseline-test-state.mjs

    if ($LASTEXITCODE -ne 0) {
        throw @"
Baseline test DB is populated, but the baseline migration is not safely recorded as applied.

Do NOT run migrate deploy against this populated DB.
Use a fresh isolated baseline-test database if this state is blocked.
"@
    }

    Write-Host ""
    Write-Host "Baseline migration already applied. Continuing with non-destructive validation..." -ForegroundColor Cyan

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
        throw "Backend build failed after generate."
    }

    node .\scripts\seed-reference-data.mjs

    if ($LASTEXITCODE -ne 0) {
        throw "Reference/security seed failed."
    }

    node .\scripts\verify-baseline-test.mjs

    if ($LASTEXITCODE -ne 0) {
        throw "Baseline test verification failed."
    }

    Write-Host ""
    npx prisma migrate status

    if ($LASTEXITCODE -ne 0) {
        throw "Prisma migrate status failed for baseline test DB."
    }

    Write-Host ""
    Write-Host "CLEAN PRISMA BASELINE RESUME TEST PASSED." -ForegroundColor Green
    Write-Host "The existing populated baseline test DB was reused safely." -ForegroundColor Green
}
finally {
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
