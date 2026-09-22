param(
    [string]$Project = "C:\Users\KS\Documents\yacineapp\somepharm-maintenance\frontend"
)

$ErrorActionPreference = "Stop"

if (!(Test-Path $Project)) {
    throw "Frontend project not found: $Project"
}

Set-Location $Project

$obsoleteFiles = @(
    "src\components\equipment\CreateMovementModal.tsx",
    "src\components\equipment\ViewEquipmentShelvesModal.tsx"
)

foreach ($file in $obsoleteFiles) {
    if (Test-Path $file) {
        Remove-Item $file -Force
        Write-Host "Removed obsolete file: $file" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Obsolete Equipment movement/shelf modal cleanup complete." -ForegroundColor Green
