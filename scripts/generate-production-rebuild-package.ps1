param(
    [string]$Root = "C:\Users\KS\Documents\yacineapp\somepharm-maintenance"
)

$ErrorActionPreference = "Stop"
$originalLocation = Get-Location

try {
    $backend = Join-Path $Root "backend"

    $readinessScript =
        Join-Path $backend "scripts\check-production-rebuild-readiness.mjs"

    $candidate =
        Join-Path $backend "sql\generated\current-schema-rebuild-candidate.sql"

    $seed =
        Join-Path $backend "sql\production_reference_seed.sql"

    $hardening =
        Join-Path $backend "sql\rebuild_test_hardening.sql"

    $outputDir =
        Join-Path $backend "sql\production"

    $output =
        Join-Path $outputDir "FINAL_yacinedb_rebuild.sql"

    $hashFile =
        Join-Path $outputDir "FINAL_yacinedb_rebuild.sha256.txt"

    foreach ($path in @(
        $readinessScript,
        $candidate,
        $seed,
        $hardening
    )) {
        if (!(Test-Path $path)) {
            throw "Required file missing: $path"
        }
    }

    Set-Location $backend

    node .\scripts\check-production-rebuild-readiness.mjs

    if ($LASTEXITCODE -ne 0) {
        throw "Production rebuild readiness did not pass."
    }

    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null

    $candidateText =
        Get-Content $candidate -Raw

    $seedText =
        Get-Content $seed -Raw

    $hardeningText =
        Get-Content $hardening -Raw

    $final = @"
/*
  SOMIPHARM FINAL YACINEDB REBUILD
  ===============================

  IMPORTANT:
  - Generated only after isolated DB validation.
  - Intended for the currently EMPTY yacinedb.
  - Does not DROP the database.
  - Do not execute until the final production rebuild step.
*/

USE [yacinedb];
GO

/* ============================================================
   1. CURRENT PRISMA CORE SCHEMA
   ============================================================ */

$candidateText

/* ============================================================
   2. REQUIRED REFERENCE / SECURITY DATA
   ============================================================ */

$seedText

/* ============================================================
   3. DATABASE HARDENING
   ============================================================ */

$hardeningText

/* ============================================================
   4. FINAL READ-ONLY VERIFICATION
   ============================================================ */

SELECT
    @@SERVERNAME AS CurrentServer,
    DB_NAME() AS CurrentDatabase;

SELECT
    COUNT(*) AS ApplicationTableCount
FROM sys.tables
WHERE is_ms_shipped = 0;

SELECT
    stockStatusName
FROM dbo.StockStatus
ORDER BY stockStatusName;

SELECT
    name AS HardeningTrigger,
    is_disabled AS IsDisabled
FROM sys.triggers
WHERE name IN (
    'TR_Shelf_RequireActiveStock',
    'TR_EquipmentShelfs_RequireActiveStock',
    'TR_Mouvement_RequireActiveStocks',
    'TR_SerialNumber_Guards',
    'TR_InventoryWorkUnit_AcceptedAttempt',
    'TR_MovementEquipment_MatchHeader'
)
ORDER BY name;
GO
"@

    $final |
        Set-Content -Path $output -Encoding UTF8

    $hash =
        Get-FileHash $output -Algorithm SHA256

    $hash.Hash |
        Set-Content -Path $hashFile -Encoding ASCII

    Write-Host ""
    Write-Host "PRODUCTION REBUILD PACKAGE GENERATED." -ForegroundColor Green
    Write-Host ""
    Write-Host "SQL:" -ForegroundColor Cyan
    Write-Host $output
    Write-Host ""
    Write-Host "SHA256:" -ForegroundColor Cyan
    Write-Host $hash.Hash
    Write-Host ""
    Write-Host "This script was GENERATED ONLY. Nothing was executed against yacinedb." -ForegroundColor Yellow
}
finally {
    Set-Location $originalLocation
}
