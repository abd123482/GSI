param(
    [string]$Root = "C:\Users\KS\Documents\yacineapp\somepharm-maintenance"
)

$csv = Join-Path $Root "backend\sql\recovery-discovery\candidate-sql-files.csv"

if (!(Test-Path $csv)) {
    throw "Candidate file report not found. Run .\scripts\run-sql-recovery-discovery.ps1 first."
}

$rows = Import-Csv $csv

if (!$rows) {
    Write-Host "No SQL recovery files were discovered." -ForegroundColor Yellow
    exit 0
}

$rows |
    Sort-Object LastWriteTime -Descending |
    Select-Object Path, Extension, Length, CreationTime, LastWriteTime |
    Format-Table -AutoSize
