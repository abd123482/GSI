/*
  Run this BEFORE opening FINAL_yacinedb_rebuild.sql.

  READ ONLY.
*/

USE [yacinedb];
GO

IF EXISTS (
    SELECT 1
    FROM sys.tables
    WHERE
        is_ms_shipped = 0
        AND name <> '_prisma_migrations'
)
BEGIN
    THROW 51200,
        'SAFETY STOP: yacinedb is not empty. Do not execute the final rebuild SQL.',
        1;
END;

IF NOT EXISTS (
    SELECT 1
    FROM msdb.dbo.backupset
    WHERE
        LOWER(database_name) = LOWER('yacinedb')
        AND type = 'D'
)
BEGIN
    THROW 51201,
        'SAFETY STOP: no FULL yacinedb backup is recorded in msdb.',
        1;
END;

SELECT
    'READY' AS ProductionDatabaseState,
    DB_NAME() AS DatabaseName;

SELECT TOP (1)
    backup_finish_date AS LatestFullBackupFinish,
    bmf.physical_device_name AS BackupDevice
FROM msdb.dbo.backupset bs
LEFT JOIN msdb.dbo.backupmediafamily bmf
    ON bmf.media_set_id = bs.media_set_id
WHERE
    LOWER(bs.database_name) = LOWER('yacinedb')
    AND bs.type = 'D'
ORDER BY
    bs.backup_finish_date DESC;
GO
