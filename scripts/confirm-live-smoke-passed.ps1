param(
    [string]$Root = "C:\Users\KS\Documents\yacineapp\somepharm-maintenance",
    [string]$Confirmation
)

$ErrorActionPreference = "Stop"

$required = "I CONFIRM LIVE SMOKE TEST PASSED"

if ($Confirmation -ne $required) {
    throw @"
Confirmation did not match.

Run ONLY after you completed the full live workflow against yacinedb_rebuild_test:

.\scripts\confirm-live-smoke-passed.ps1 -Confirmation "$required"
"@
}

$marker = Join-Path $Root "backend\sql\generated\live-smoke-test-passed.txt"

$dir = Split-Path $marker -Parent
New-Item -ItemType Directory -Path $dir -Force | Out-Null

@"
$required
ConfirmedAt=$(Get-Date -Format o)
TestDatabase=yacinedb_rebuild_test
"@ | Set-Content -Path $marker -Encoding UTF8

Write-Host ""
Write-Host "Live smoke-test confirmation recorded." -ForegroundColor Green
Write-Host $marker
