/*
  SOMIPHARM - FINAL PRODUCTION VERIFICATION
  READ ONLY.
*/

USE [yacinedb];
GO

SET NOCOUNT ON;

SELECT
    @@SERVERNAME AS CurrentServer,
    DB_NAME() AS CurrentDatabase,
    SUSER_SNAME() AS CurrentLogin;

WITH ExpectedTables(TableName) AS (
    SELECT *
    FROM (VALUES
        ('Role'),
        ('Permission'),
        ('User'),
        ('Session'),
        ('Equipment'),
        ('SerialNumber'),
        ('Shelf'),
        ('StockStatus'),
        ('Stock'),
        ('Mouvement'),
        ('EquipmentShelfs'),
        ('EqipmentMouvements'),
        ('Inventory'),
        ('Inventory_User'),
        ('sysdiagrams'),
        ('Order'),
        ('InventoryWorkUnit'),
        ('InventoryCountAttempt'),
        ('Inventory_Equipment_Shelf_Snapshot'),
        ('Inventory_SerialNumber_Snapshot'),
        ('InventoryInvestigationIssue'),
        ('Notification'),
        ('MovementEquipment')
    ) v(TableName)
)
SELECT
    e.TableName,
    CASE
        WHEN t.object_id IS NULL THEN 'MISSING'
        ELSE 'PRESENT'
    END AS Result
FROM ExpectedTables e
LEFT JOIN sys.tables t
    ON t.name = e.TableName
ORDER BY e.TableName;

WITH ExpectedTrigger(TriggerName) AS (
    SELECT *
    FROM (VALUES
        ('TR_Shelf_RequireActiveStock'),
        ('TR_EquipmentShelfs_RequireActiveStock'),
        ('TR_Mouvement_RequireActiveStocks'),
        ('TR_SerialNumber_Guards'),
        ('TR_InventoryWorkUnit_AcceptedAttempt'),
        ('TR_MovementEquipment_MatchHeader')
    ) v(TriggerName)
)
SELECT
    e.TriggerName,
    CASE
        WHEN tr.object_id IS NULL THEN 'MISSING'
        WHEN tr.is_disabled = 1 THEN 'DISABLED'
        ELSE 'ENABLED'
    END AS Result,
    OBJECT_NAME(tr.parent_id) AS ParentTable
FROM ExpectedTrigger e
LEFT JOIN sys.triggers tr
    ON tr.name = e.TriggerName
ORDER BY e.TriggerName;

SELECT
    stockStatusName
FROM dbo.StockStatus
ORDER BY stockStatusName;

SELECT
    r.roleName,
    COUNT(p.permissionId) AS PermissionCount
FROM dbo.Role r
LEFT JOIN dbo.Permission p
    ON p.roleId = r.roleId
GROUP BY
    r.roleId,
    r.roleName
ORDER BY r.roleName;

SELECT
    OBJECT_NAME(parent_object_id) AS TableName,
    name AS ForeignKeyName,
    is_disabled AS IsDisabled,
    is_not_trusted AS IsNotTrusted
FROM sys.foreign_keys
WHERE
    is_disabled = 1
    OR is_not_trusted = 1
ORDER BY
    TableName,
    ForeignKeyName;

SELECT
    (SELECT COUNT_BIG(*) FROM dbo.Stock) AS Stocks,
    (SELECT COUNT_BIG(*) FROM dbo.Shelf) AS Shelves,
    (SELECT COUNT_BIG(*) FROM dbo.Equipment) AS Equipment,
    (SELECT COUNT_BIG(*) FROM dbo.SerialNumber) AS SerialNumbers,
    (SELECT COUNT_BIG(*) FROM dbo.Mouvement) AS Movements,
    (SELECT COUNT_BIG(*) FROM dbo.Inventory) AS Inventories;

PRINT 'PRODUCTION VERIFICATION COMPLETE - READ ONLY';
GO
