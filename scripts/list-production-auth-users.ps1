param(
    [string]$Root = "C:\Users\KS\Documents\yacineapp\somepharm-maintenance"
)

$ErrorActionPreference = "Stop"
$originalLocation = Get-Location

try {
    $backend = Join-Path $Root "backend"
    $script = Join-Path $backend "scripts\list-production-auth-users.mjs"

    if (!(Test-Path $script)) {
        throw "Script not found: $script"
    }

    Set-Location $backend

    node .\scripts\list-production-auth-users.mjs

    if ($LASTEXITCODE -ne 0) {
        throw "Production auth user listing failed."
    }
}
finally {
    Set-Location $originalLocation
}
