param(
    [string]$Project = "C:\Users\KS\Documents\yacineapp\somepharm-maintenance\frontend"
)

$ErrorActionPreference = "Stop"

if (!(Test-Path $Project)) {
    throw "Frontend project not found: $Project"
}

Set-Location $Project

Write-Host "=== 0. Clear stale Next.js generated types ===" -ForegroundColor Cyan
Remove-Item ".next" -Recurse -Force -ErrorAction SilentlyContinue

$duplicateStockPages = Get-ChildItem ".\src\app\stocks" -File -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match '^page \(\d+\)\.(tsx|ts|jsx|js)$' }

if ($duplicateStockPages) {
    Write-Host "WARNING: duplicate stocks page file(s) found:" -ForegroundColor Yellow
    $duplicateStockPages | ForEach-Object {
        Write-Host "  $($_.FullName)"
    }
    Write-Host "Do not delete automatically; review these duplicates if Next.js regenerates page (1)." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== 1. TypeScript ===" -ForegroundColor Cyan
npx tsc --noEmit
if ($LASTEXITCODE -ne 0) {
    throw "TypeScript check failed."
}

Write-Host ""
Write-Host "=== 2. Movement ledger test ===" -ForegroundColor Cyan
if (Test-Path ".\tests\movement-ledger.test.mts") {
    node --experimental-strip-types --test tests/movement-ledger.test.mts
    if ($LASTEXITCODE -ne 0) {
        throw "Movement ledger test failed."
    }
}

Write-Host ""
Write-Host "=== 3. Production build ===" -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) {
    throw "Frontend build failed."
}

Write-Host ""
Write-Host "=== 4. Legacy UI audit ===" -ForegroundColor Cyan
$patterns = @(
    "components/equipment/CreateMovementModal",
    "components/equipment/ViewEquipmentShelvesModal",
    "useAssignThirdUser",
    "useAssignThirdUserAll",
    "PRIMARY_DOUBLE_COUNT_MATCH",
    "THIRD_FULL_RECOUNT_FINAL",
    "/inventory/adjudicate/"
)

foreach ($pattern in $patterns) {
    $matches = Get-ChildItem .\src -Recurse -File -Include *.ts,*.tsx |
        Select-String -SimpleMatch -Pattern $pattern

    if ($matches) {
        Write-Host "REVIEW: $pattern" -ForegroundColor Yellow
        $matches | ForEach-Object {
            Write-Host "  $($_.Path):$($_.LineNumber): $($_.Line.Trim())"
        }
    }
}

Write-Host ""
Write-Host "FRONTEND TYPECHECK / LEDGER TEST / BUILD PASSED." -ForegroundColor Green
