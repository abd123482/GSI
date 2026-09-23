/*
  SOMIPHARM SQL SERVER BACKUP / RECOVERY DISCOVERY
  READ ONLY.

  This script does not restore, attach, detach, alter, insert, update or delete.

  Run in SSMS against the current SQL Server instance.
*/

SET NOCOUNT ON;

PRINT '1. SERVER / INSTANCE';
SELECT
    @@SERVERNAME AS CurrentServer,
    SERVERPROPERTY('MachineName') AS MachineName,
    SERVERPROPERTY('InstanceName') AS InstanceName,
    SERVERPROPERTY('Edition') AS Edition,
    SERVERPROPERTY('ProductVersion') AS ProductVersion,
    DB_NAME() AS CurrentDatabase,
    SUSER_SNAME() AS LoginName;

PRINT '2. DATABASES VISIBLE TO THIS LOGIN';
SELECT
    name AS DatabaseName,
    database_id AS DatabaseId,
    state_desc AS StateDescription,
    user_access_desc AS UserAccess,
    recovery_model_desc AS RecoveryModel,
    create_date AS CreateDate,
    HAS_DBACCESS(name) AS HasDbAccess
FROM sys.databases
ORDER BY name;

PRINT '3. CURRENT DATABASE FILES';
SELECT
    DB_NAME(database_id) AS DatabaseName,
    name AS LogicalName,
    type_desc AS FileType,
    physical_name AS PhysicalPath,
    size * 8.0 / 1024.0 AS SizeMB,
    state_desc AS StateDescription
FROM sys.master_files
ORDER BY DatabaseName, FileType, LogicalName;

PRINT '4. DEFAULT INSTANCE PATHS';
SELECT
    SERVERPROPERTY('InstanceDefaultDataPath') AS DefaultDataPath,
    SERVERPROPERTY('InstanceDefaultLogPath') AS DefaultLogPath,
    SERVERPROPERTY('InstanceDefaultBackupPath') AS DefaultBackupPath;

PRINT '5. BACKUP HISTORY - YACINEDB';

BEGIN TRY
    SELECT TOP (200)
        bs.database_name AS DatabaseName,
        CASE bs.type
            WHEN 'D' THEN 'FULL'
            WHEN 'I' THEN 'DIFFERENTIAL'
            WHEN 'L' THEN 'LOG'
            WHEN 'F' THEN 'FILE/FILEGROUP'
            WHEN 'G' THEN 'DIFFERENTIAL FILE'
            WHEN 'P' THEN 'PARTIAL'
            WHEN 'Q' THEN 'DIFFERENTIAL PARTIAL'
            ELSE bs.type
        END AS BackupType,
        bs.backup_start_date AS BackupStart,
        bs.backup_finish_date AS BackupFinish,
        CAST(bs.backup_size / 1024.0 / 1024.0 AS decimal(18,2)) AS BackupSizeMB,
        CAST(bs.compressed_backup_size / 1024.0 / 1024.0 AS decimal(18,2)) AS CompressedSizeMB,
        bs.recovery_model AS RecoveryModel,
        bs.is_copy_only AS IsCopyOnly,
        bs.first_lsn AS FirstLSN,
        bs.last_lsn AS LastLSN,
        bs.database_backup_lsn AS DatabaseBackupLSN,
        bmf.physical_device_name AS PhysicalDevice
    FROM msdb.dbo.backupset bs
    LEFT JOIN msdb.dbo.backupmediafamily bmf
        ON bmf.media_set_id = bs.media_set_id
    WHERE LOWER(bs.database_name) = LOWER('yacinedb')
    ORDER BY bs.backup_finish_date DESC;
END TRY
BEGIN CATCH
    SELECT
        'Could not read msdb backup history' AS Notice,
        ERROR_MESSAGE() AS ErrorMessage;
END CATCH;

PRINT '6. ALL RECENT DATABASE BACKUPS ON THIS INSTANCE';

BEGIN TRY
    SELECT TOP (300)
        bs.database_name AS DatabaseName,
        CASE bs.type
            WHEN 'D' THEN 'FULL'
            WHEN 'I' THEN 'DIFFERENTIAL'
            WHEN 'L' THEN 'LOG'
            ELSE bs.type
        END AS BackupType,
        bs.backup_finish_date AS BackupFinish,
        CAST(bs.backup_size / 1024.0 / 1024.0 AS decimal(18,2)) AS BackupSizeMB,
        bmf.physical_device_name AS PhysicalDevice
    FROM msdb.dbo.backupset bs
    LEFT JOIN msdb.dbo.backupmediafamily bmf
        ON bmf.media_set_id = bs.media_set_id
    ORDER BY bs.backup_finish_date DESC;
END TRY
BEGIN CATCH
    SELECT
        'Could not read all backup history' AS Notice,
        ERROR_MESSAGE() AS ErrorMessage;
END CATCH;

PRINT '7. RESTORE HISTORY';

BEGIN TRY
    SELECT TOP (200)
        rh.destination_database_name AS DestinationDatabase,
        rh.restore_date AS RestoreDate,
        rh.restore_type AS RestoreType,
        rh.replace AS UsedReplace,
        rh.recovery AS Recovery,
        bs.database_name AS SourceDatabase,
        bs.backup_finish_date AS SourceBackupFinish,
        bmf.physical_device_name AS SourcePhysicalDevice
    FROM msdb.dbo.restorehistory rh
    LEFT JOIN msdb.dbo.backupset bs
        ON bs.backup_set_id = rh.backup_set_id
    LEFT JOIN msdb.dbo.backupmediafamily bmf
        ON bmf.media_set_id = bs.media_set_id
    WHERE
        LOWER(rh.destination_database_name) = LOWER('yacinedb')
        OR LOWER(bs.database_name) = LOWER('yacinedb')
    ORDER BY rh.restore_date DESC;
END TRY
BEGIN CATCH
    SELECT
        'Could not read restore history' AS Notice,
        ERROR_MESSAGE() AS ErrorMessage;
END CATCH;

PRINT '8. YACINEDB OBJECT COUNT BY TYPE';
IF DB_ID(N'yacinedb') IS NOT NULL
BEGIN
    SELECT
        type_desc AS ObjectType,
        COUNT_BIG(*) AS ObjectCount
    FROM yacinedb.sys.objects
    WHERE is_ms_shipped = 0
    GROUP BY type_desc
    ORDER BY type_desc;
END;

PRINT 'RECOVERY DISCOVERY COMPLETE - NOTHING WAS MODIFIED';
