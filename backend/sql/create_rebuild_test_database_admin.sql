/*
    SOMIPHARM - CREATE ISOLATED REBUILD TEST DATABASE
    -------------------------------------------------
    Run this script in SSMS using a Windows/sysadmin account or another login
    that has CREATE ANY DATABASE permission.

    SAFETY:
    - It creates ONLY [yacinedb_rebuild_test].
    - It NEVER drops or alters [yacinedb].
    - It refuses to continue if [yacinedb_rebuild_test] already exists.
    - It maps the existing SQL login [admin_semepharm] only inside the TEST DB.
*/

USE [master];
GO

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

DECLARE @TargetDatabase sysname = N'yacinedb_rebuild_test';
DECLARE @ApplicationLogin sysname = N'admin_semepharm';

IF DB_ID(@TargetDatabase) IS NOT NULL
BEGIN
    THROW 51040,
        'Safety stop: yacinedb_rebuild_test already exists. This script never overwrites or drops an existing database.',
        1;
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.server_principals
    WHERE name = @ApplicationLogin
)
BEGIN
    THROW 51041,
        'The SQL login admin_semepharm does not exist on this SQL Server instance.',
        1;
END;

IF
    IS_SRVROLEMEMBER('sysadmin') <> 1
    AND HAS_PERMS_BY_NAME(NULL, NULL, 'CREATE ANY DATABASE') <> 1
BEGIN
    THROW 51042,
        'The current SSMS login does not have permission to create a database. Reconnect with Windows/sysadmin credentials.',
        1;
END;

CREATE DATABASE [yacinedb_rebuild_test];
GO

USE [yacinedb_rebuild_test];
GO

IF USER_ID(N'admin_semepharm') IS NULL
BEGIN
    CREATE USER [admin_semepharm]
        FOR LOGIN [admin_semepharm]
        WITH DEFAULT_SCHEMA = [dbo];
END;
GO

/*
    db_owner is intentionally granted ONLY on this disposable isolated TEST DB
    so the application login can create the generated schema and hardening
    triggers during reconstruction validation.
*/
ALTER ROLE [db_owner]
    ADD MEMBER [admin_semepharm];
GO

SELECT
    @@SERVERNAME AS CurrentServer,
    DB_NAME() AS CurrentDatabase,
    USER_NAME() AS ExecutingDatabaseUser;

SELECT
    sp.name AS LoginName,
    dp.name AS DatabaseUser,
    rp.name AS DatabaseRole
FROM sys.database_principals dp
JOIN master.sys.server_principals sp
    ON sp.sid = dp.sid
LEFT JOIN sys.database_role_members drm
    ON drm.member_principal_id = dp.principal_id
LEFT JOIN sys.database_principals rp
    ON rp.principal_id = drm.role_principal_id
WHERE sp.name = N'admin_semepharm';

PRINT 'SUCCESS: yacinedb_rebuild_test created. Real yacinedb was not modified.';
GO
