param(
    [string]$Root = "C:\Users\KS\Documents\yacineapp\somepharm-maintenance"
)

$ErrorActionPreference = "Stop"
$originalLocation = Get-Location

try {
    $backend = Join-Path $Root "backend"

    Set-Location $backend

    npm run build

    if ($LASTEXITCODE -ne 0) {
        throw "Backend build failed."
    }

    node .\scripts\inspect-production-prisma-history.mjs

    if ($LASTEXITCODE -ne 0) {
        throw "Production Prisma history inspection failed."
    }
}
finally {
    Set-Location $originalLocation
}
