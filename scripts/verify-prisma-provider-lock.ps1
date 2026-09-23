param(
    [string]$Root = "C:\Users\KS\Documents\yacineapp\somepharm-maintenance"
)

$ErrorActionPreference = "Stop"

$lock = Join-Path $Root "backend\prisma\migrations\migration_lock.toml"
$schema = Join-Path $Root "backend\prisma\schema.prisma"

if (!(Test-Path $lock)) {
    throw "Missing migration lock: $lock"
}

if (!(Test-Path $schema)) {
    throw "Missing Prisma schema: $schema"
}

$lockText = Get-Content $lock -Raw
$schemaText = Get-Content $schema -Raw

if ($lockText -notmatch 'provider\s*=\s*"mssql"') {
    throw "migration_lock.toml is not using provider = `"mssql`"."
}

if ($schemaText -notmatch 'provider\s*=\s*"sqlserver"') {
    throw "schema.prisma no longer shows provider = `"sqlserver`"."
}

Write-Host ""
Write-Host "PRISMA PROVIDER LOCK CHECK PASSED." -ForegroundColor Green
Write-Host "schema.prisma datasource provider: sqlserver" -ForegroundColor Cyan
Write-Host "migration_lock.toml provider: mssql" -ForegroundColor Cyan
Write-Host ""
Write-Host "This is the expected Prisma migration provider identifier for SQL Server." -ForegroundColor Green
