param(
    [string]$Root = "C:\Users\KS\Documents\yacineapp\somepharm-maintenance"
)

$ErrorActionPreference = "Stop"

$backend = Join-Path $Root "backend"
$frontend = Join-Path $Root "frontend"

if (!(Test-Path $backend)) {
    throw "Backend directory not found: $backend"
}

if (!(Test-Path $frontend)) {
    throw "Frontend directory not found: $frontend"
}

function Run-Step {
    param(
        [string]$Title,
        [scriptblock]$Command
    )

    Write-Host ""
    Write-Host "============================================================" -ForegroundColor DarkGray
    Write-Host $Title -ForegroundColor Cyan
    Write-Host "============================================================" -ForegroundColor DarkGray

    & $Command

    if ($LASTEXITCODE -ne 0) {
        throw "$Title failed with exit code $LASTEXITCODE"
    }

    Write-Host "PASS: $Title" -ForegroundColor Green
}

Write-Host "SOMIPHARM FINAL NON-DESTRUCTIVE REGRESSION" -ForegroundColor Green
Write-Host "No db push/reset/dev/deploy migration command is executed." -ForegroundColor Yellow

Set-Location $backend

Run-Step "Backend: prisma format check" {
    npx prisma format
}

Run-Step "Backend: prisma validate" {
    npx prisma validate
}

Run-Step "Backend: prisma generate" {
    npx prisma generate
}

Run-Step "Backend: TypeScript" {
    npx tsc --noEmit
}

Run-Step "Backend: Vitest" {
    npx vitest run
}

Run-Step "Backend: build" {
    npm run build
}

Set-Location $frontend

Run-Step "Frontend: TypeScript" {
    npx tsc --noEmit
}

if (Test-Path ".\tests\movement-ledger.test.mts") {
    Run-Step "Frontend: movement ledger test" {
        node --experimental-strip-types --test tests/movement-ledger.test.mts
    }
}

Run-Step "Frontend: build" {
    npm run build
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor DarkGray
Write-Host "STATIC LEGACY STRING AUDIT" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor DarkGray

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
        Write-Host ""
        Write-Host "REVIEW: $pattern" -ForegroundColor Yellow

        $matches | ForEach-Object {
            Write-Host "  $($_.Path):$($_.LineNumber): $($_.Line.Trim())"
        }
    }
}

Write-Host ""
Write-Host "FINAL REGRESSION COMMANDS COMPLETED." -ForegroundColor Green
Write-Host "Next: run backend/sql/final_live_db_audit.sql in SSMS and then execute backend/test/final-smoke.http against local/staging." -ForegroundColor Green
