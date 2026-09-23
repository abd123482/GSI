/*
  SOMIPHARM - CREATE CLEAN BASELINE TEST DATABASE

  Run in SSMS using Windows/sysadmin credentials.

  Creates ONLY:
    yacinedb_baseline_test

  It never drops or modifies:
    yacinedb
    yacinedb_rebuild_test
*/

USE [master];
GO

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

DECLARE @TargetDatabase sysname = N'yacinedb_baseline_test';
DECLARE @ApplicationLogin sysname = N'admin_semepharm';

IF DB_ID(@TargetDatabase) IS NOT NULL
BEGIN
    THROW 51300,
        'Safety stop: yacinedb_baseline_test already exists. This script never overwrites an existing DB.',
        1;
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.server_principals
    WHERE name = @ApplicationLogin
)
BEGIN
    THROW 51301,
        'SQL login admin_semepharm does not exist.',
        1;
END;

IF
    IS_SRVROLEMEMBER('sysadmin') <> 1
    AND HAS_PERMS_BY_NAME(NULL, NULL, 'CREATE ANY DATABASE') <> 1
BEGIN
    THROW 51302,
        'Current SSMS login cannot create a database. Use Windows/sysadmin credentials.',
        1;
END;

CREATE DATABASE [yacinedb_baseline_test];
GO

USE [yacinedb_baseline_test];
GO

IF USER_ID(N'admin_semepharm') IS NULL
BEGIN
    CREATE USER [admin_semepharm]
        FOR LOGIN [admin_semepharm]
        WITH DEFAULT_SCHEMA = [dbo];
END;
GO

ALTER ROLE [db_owner]
    ADD MEMBER [admin_semepharm];
GO

SELECT
    @@SERVERNAME AS CurrentServer,
    DB_NAME() AS CurrentDatabase,
    SUSER_SNAME() AS CurrentLogin;

PRINT 'SUCCESS: yacinedb_baseline_test created.';
GO
