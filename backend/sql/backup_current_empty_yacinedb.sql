/*
  SAFETY BACKUP OF CURRENT YACINEDB
  ---------------------------------
  Run in SSMS as an account allowed to BACKUP DATABASE.

  Even though the database is currently empty, this creates a rollback artifact
  of the exact current state before reconstruction.
*/

USE [master];
GO

DECLARE @BackupDirectory nvarchar(4000) =
    CONVERT(nvarchar(4000), SERVERPROPERTY('InstanceDefaultBackupPath'));

IF @BackupDirectory IS NULL OR LTRIM(RTRIM(@BackupDirectory)) = ''
BEGIN
    THROW 51100,
        'SQL Server InstanceDefaultBackupPath is unavailable. Choose a reviewed backup path manually.',
        1;
END;

DECLARE @File nvarchar(4000) =
    @BackupDirectory +
    CASE
        WHEN RIGHT(@BackupDirectory, 1) IN ('\', '/')
            THEN ''
        ELSE '\'
    END +
    'yacinedb_before_rebuild_' +
    REPLACE(
        REPLACE(
            REPLACE(
                CONVERT(varchar(19), GETDATE(), 120),
                '-',
                ''
            ),
            ':',
            ''
        ),
        ' ',
        '_'
    ) +
    '.bak';

DECLARE @Sql nvarchar(max) =
    N'BACKUP DATABASE [yacinedb] TO DISK = N''' +
    REPLACE(@File, '''', '''''') +
    N''' WITH COPY_ONLY, INIT, CHECKSUM, STATS = 10;';

EXEC sys.sp_executesql @Sql;

SELECT
    @File AS BackupFile;
GO
