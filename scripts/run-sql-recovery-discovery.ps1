param(
    [string]$Root = "C:\Users\KS\Documents\yacineapp\somepharm-maintenance"
)

$ErrorActionPreference = "Stop"

$backend = Join-Path $Root "backend"
$reportDir = Join-Path $backend "sql\recovery-discovery"
New-Item -ItemType Directory -Path $reportDir -Force | Out-Null

Write-Host ""
Write-Host "SOMIPHARM SQL SERVER RECOVERY DISCOVERY" -ForegroundColor Cyan
Write-Host "READ ONLY - no restore, attach, detach, migration, DDL or DML." -ForegroundColor Yellow
Write-Host ""

$report = [ordered]@{
    generatedAt = (Get-Date).ToString("o")
    machine = $env:COMPUTERNAME
    sqlServices = @()
    sqlInstances = @()
    localDbInstances = @()
    registryPaths = @()
    candidateFiles = @()
}

# ---------------------------------------------------------------------------
# 1. SQL Server services / instance names
# ---------------------------------------------------------------------------
Write-Host "=== 1. SQL Server services ===" -ForegroundColor Cyan

$services = Get-CimInstance Win32_Service -ErrorAction SilentlyContinue |
    Where-Object {
        $_.Name -like "MSSQL*" -or
        $_.Name -like "SQLAgent*" -or
        $_.DisplayName -like "*SQL Server*"
    } |
    Select-Object Name, DisplayName, State, StartMode, PathName

$report.sqlServices = @($services)

if ($services) {
    $services | Format-Table -AutoSize
} else {
    Write-Host "No SQL Server Windows services discovered." -ForegroundColor Yellow
}

# ---------------------------------------------------------------------------
# 2. SQL Server registry instances + data/backup paths
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "=== 2. Registered SQL Server instances ===" -ForegroundColor Cyan

$instanceNameKeys = @(
    "HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\Instance Names\SQL",
    "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Microsoft SQL Server\Instance Names\SQL"
)

$instances = @()

foreach ($key in $instanceNameKeys) {
    if (!(Test-Path $key)) {
        continue
    }

    $props = Get-ItemProperty $key

    foreach ($property in $props.PSObject.Properties) {
        if ($property.Name -like "PS*") {
            continue
        }

        $instances += [pscustomobject]@{
            instanceName = $property.Name
            instanceId = [string]$property.Value
            sourceKey = $key
        }
    }
}

$instances = $instances |
    Sort-Object instanceName, instanceId -Unique

$report.sqlInstances = @($instances)

if ($instances) {
    $instances | Format-Table -AutoSize
} else {
    Write-Host "No SQL instances found in standard registry locations." -ForegroundColor Yellow
}

$registryPaths = @()

foreach ($instance in $instances) {
    $instanceId = $instance.instanceId

    $candidateRegistryKeys = @(
        "HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\$instanceId\MSSQLServer",
        "HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\$instanceId\Setup",
        "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Microsoft SQL Server\$instanceId\MSSQLServer",
        "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Microsoft SQL Server\$instanceId\Setup"
    )

    $entry = [ordered]@{
        instanceName = $instance.instanceName
        instanceId = $instanceId
        backupDirectory = $null
        defaultData = $null
        defaultLog = $null
        sqlDataRoot = $null
        installationPath = $null
    }

    foreach ($regKey in $candidateRegistryKeys) {
        if (!(Test-Path $regKey)) {
            continue
        }

        try {
            $p = Get-ItemProperty $regKey

            if (-not $entry.backupDirectory -and $p.BackupDirectory) {
                $entry.backupDirectory = [string]$p.BackupDirectory
            }

            if (-not $entry.defaultData -and $p.DefaultData) {
                $entry.defaultData = [string]$p.DefaultData
            }

            if (-not $entry.defaultLog -and $p.DefaultLog) {
                $entry.defaultLog = [string]$p.DefaultLog
            }

            if (-not $entry.sqlDataRoot -and $p.SQLDataRoot) {
                $entry.sqlDataRoot = [string]$p.SQLDataRoot
            }

            if (-not $entry.installationPath -and $p.SQLPath) {
                $entry.installationPath = [string]$p.SQLPath
            }
        } catch {
            # Registry read failure is non-fatal.
        }
    }

    $registryPaths += [pscustomobject]$entry
}

$report.registryPaths = @($registryPaths)

if ($registryPaths) {
    $registryPaths | Format-Table -AutoSize
}

# ---------------------------------------------------------------------------
# 3. LocalDB instances (if installed)
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "=== 3. SQL LocalDB ===" -ForegroundColor Cyan

$sqllocaldb = Get-Command sqllocaldb.exe -ErrorAction SilentlyContinue

if ($sqllocaldb) {
    $localDbNames = & sqllocaldb.exe info 2>$null

    $localDbInfo = @()

    foreach ($name in $localDbNames) {
        if ([string]::IsNullOrWhiteSpace($name)) {
            continue
        }

        $details = & sqllocaldb.exe info "$name" 2>$null

        $localDbInfo += [pscustomobject]@{
            name = $name.Trim()
            details = ($details -join "`n")
        }
    }

    $report.localDbInstances = @($localDbInfo)

    if ($localDbInfo) {
        $localDbInfo | ForEach-Object {
            Write-Host ""
            Write-Host "LocalDB: $($_.name)" -ForegroundColor Green
            Write-Host $_.details
        }
    } else {
        Write-Host "sqllocaldb exists but no LocalDB instances were listed."
    }
} else {
    Write-Host "sqllocaldb.exe not found."
}

# ---------------------------------------------------------------------------
# 4. Targeted backup/data-file discovery
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "=== 4. Candidate SQL backup/data files ===" -ForegroundColor Cyan

$searchRoots = New-Object System.Collections.Generic.List[string]

function Add-SearchRoot([string]$Path) {
    if ([string]::IsNullOrWhiteSpace($Path)) {
        return
    }

    try {
        $expanded = [Environment]::ExpandEnvironmentVariables($Path)

        if (Test-Path $expanded) {
            $resolved = (Resolve-Path $expanded -ErrorAction Stop).Path

            if (-not $searchRoots.Contains($resolved)) {
                $searchRoots.Add($resolved)
            }
        }
    } catch {
        # Ignore inaccessible/nonexistent candidate paths.
    }
}

Add-SearchRoot $Root
Add-SearchRoot (Join-Path $env:USERPROFILE "Desktop")
Add-SearchRoot (Join-Path $env:USERPROFILE "Documents")
Add-SearchRoot (Join-Path $env:USERPROFILE "Downloads")

foreach ($paths in $registryPaths) {
    Add-SearchRoot $paths.backupDirectory
    Add-SearchRoot $paths.defaultData
    Add-SearchRoot $paths.defaultLog
    Add-SearchRoot $paths.sqlDataRoot
}

$commonSqlRoots = @(
    "C:\Program Files\Microsoft SQL Server",
    "C:\Program Files (x86)\Microsoft SQL Server"
)

foreach ($path in $commonSqlRoots) {
    Add-SearchRoot $path
}

$patterns = @("*.bak", "*.trn", "*.bacpac", "*.mdf", "*.ndf", "*.ldf")
$foundFiles = @()

foreach ($searchRoot in $searchRoots) {
    Write-Host "Scanning: $searchRoot"

    foreach ($pattern in $patterns) {
        try {
            $foundFiles += Get-ChildItem `
                -Path $searchRoot `
                -Filter $pattern `
                -File `
                -Recurse `
                -ErrorAction SilentlyContinue |
                Select-Object @{
                    Name = "Path"
                    Expression = { $_.FullName }
                }, @{
                    Name = "Extension"
                    Expression = { $_.Extension }
                }, Length, CreationTime, LastWriteTime
        } catch {
            # Continue scanning other roots.
        }
    }
}

$foundFiles = $foundFiles |
    Sort-Object Path -Unique |
    Sort-Object LastWriteTime -Descending

$report.candidateFiles = @($foundFiles)

if ($foundFiles) {
    $foundFiles |
        Select-Object -First 200 |
        Format-Table -AutoSize
} else {
    Write-Host "No .bak/.trn/.bacpac/.mdf/.ndf/.ldf files found in targeted locations." -ForegroundColor Yellow
}

# ---------------------------------------------------------------------------
# 5. Save reports
# ---------------------------------------------------------------------------
$jsonPath = Join-Path $reportDir "windows-sql-recovery-discovery.json"
$csvPath = Join-Path $reportDir "candidate-sql-files.csv"

$report |
    ConvertTo-Json -Depth 8 |
    Set-Content -Path $jsonPath -Encoding UTF8

$foundFiles |
    Export-Csv -Path $csvPath -NoTypeInformation -Encoding UTF8

Write-Host ""
Write-Host "Discovery completed." -ForegroundColor Green
Write-Host "JSON: $jsonPath"
Write-Host "CSV:  $csvPath"
Write-Host ""
Write-Host "Next: run backend\sql\sql_server_backup_history_readonly.sql in SSMS." -ForegroundColor Cyan
