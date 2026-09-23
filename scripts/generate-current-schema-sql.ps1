param(
    [string]$Root = "C:\Users\KS\Documents\yacineapp\somepharm-maintenance"
)

$ErrorActionPreference = "Stop"

$backend =
    Join-Path $Root "backend"

$readiness =
    Join-Path $backend "sql\rebuild-readiness-report.json"

$outputDir =
    Join-Path $backend "sql\generated"

$sqlOut =
    Join-Path $outputDir "current-schema-rebuild-candidate.sql"

$hashOut =
    Join-Path $outputDir "current-schema-rebuild-candidate.sha256.txt"

$summaryOut =
    Join-Path $outputDir "current-schema-rebuild-summary.txt"

if (!(Test-Path $backend)) {
    throw "Backend directory not found: $backend"
}

if (!(Test-Path $readiness)) {
    throw @"
Rebuild readiness report not found.

Run first:
.\scripts\run-clean-rebuild-preparation.ps1
"@
}

$report =
    Get-Content $readiness -Raw |
    ConvertFrom-Json

if ($report.decision -ne "READY_TO_GENERATE_REBUILD_CANDIDATE") {
    throw @"
Rebuild readiness did not pass.

Decision: $($report.decision)

Do not generate/apply a clean schema until the recovery decision is reviewed.
"@
}

Set-Location $backend

New-Item -ItemType Directory -Path $outputDir -Force | Out-Null

Write-Host ""
Write-Host "Generating SQL from CURRENT prisma/schema.prisma..." -ForegroundColor Cyan
Write-Host "This generates a file only. It does NOT execute SQL." -ForegroundColor Yellow
Write-Host ""

npx prisma validate

if ($LASTEXITCODE -ne 0) {
    throw "Prisma schema validation failed."
}

Remove-Item $sqlOut -Force -ErrorAction SilentlyContinue

npx prisma migrate diff `
    --from-empty `
    --to-schema prisma/schema.prisma `
    --script `
    --output $sqlOut

if ($LASTEXITCODE -ne 0) {
    throw "Prisma migrate diff failed."
}

if (!(Test-Path $sqlOut)) {
    throw "Generated SQL file was not created: $sqlOut"
}

$content =
    Get-Content $sqlOut -Raw

$dangerousPatterns = @(
    '(?im)^\s*DROP\s+',
    '(?im)^\s*TRUNCATE\s+',
    '(?im)^\s*DELETE\s+',
    '(?im)^\s*UPDATE\s+',
    '(?im)^\s*ALTER\s+DATABASE\s+',
    '(?im)^\s*RESTORE\s+DATABASE\s+'
)

$dangerousMatches = @()

foreach ($pattern in $dangerousPatterns) {
    $matches =
        [regex]::Matches(
            $content,
            $pattern
        )

    foreach ($match in $matches) {
        $dangerousMatches += $match.Value.Trim()
    }
}

$createTableCount =
    ([regex]::Matches(
        $content,
        '(?im)^\s*CREATE\s+TABLE\s+'
    )).Count

$createIndexCount =
    ([regex]::Matches(
        $content,
        '(?im)^\s*CREATE\s+(UNIQUE\s+)?INDEX\s+'
    )).Count

$foreignKeyCount =
    ([regex]::Matches(
        $content,
        '(?im)FOREIGN\s+KEY'
    )).Count

$hash =
    Get-FileHash $sqlOut -Algorithm SHA256

$hash.Hash |
    Set-Content -Path $hashOut -Encoding ASCII

$summary = @"
SOMIPHARM CURRENT-SCHEMA REBUILD CANDIDATE
Generated: $(Get-Date -Format o)

SQL file:
$sqlOut

SHA256:
$($hash.Hash)

CREATE TABLE count:
$createTableCount

CREATE INDEX count:
$createIndexCount

FOREIGN KEY occurrences:
$foreignKeyCount

Dangerous write/destructive keywords detected:
$($dangerousMatches.Count)

NOTE:
Prisma migrate diff generates Prisma-supported schema objects.
Custom triggers/views are NOT expected to be included and must be handled separately.
"@

$summary |
    Set-Content -Path $summaryOut -Encoding UTF8

Write-Host $summary

if ($dangerousMatches.Count -gt 0) {
    Write-Host ""
    Write-Host "STOP: generated script contains unexpected destructive/write keywords." -ForegroundColor Red
    Write-Host "Do not execute it." -ForegroundColor Red
    exit 3
}

Write-Host ""
Write-Host "Candidate SQL generated successfully." -ForegroundColor Green
Write-Host "DO NOT execute it against yacinedb yet." -ForegroundColor Yellow
Write-Host ""
Write-Host "Next safe phase: validate this SQL in a NEW temporary database." -ForegroundColor Cyan
