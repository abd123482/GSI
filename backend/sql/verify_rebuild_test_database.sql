/*
  SOMIPHARM ISOLATED REBUILD TEST DATABASE
  READ-ONLY MANUAL VERIFICATION.

  Change the USE line only if you chose a different DatabaseName.
*/

USE [yacinedb_rebuild_test];
GO

SELECT
    @@SERVERNAME AS CurrentServer,
    DB_NAME() AS CurrentDatabase;

SELECT
    name AS TableName
FROM sys.tables
WHERE name IN (
    'Role',
    'Permission',
    'User',
    'StockStatus',
    'Stock',
    'Shelf',
    'Equipment',
    'EquipmentShelfs',
    'SerialNumber',
    'Mouvement',
    'MovementEquipment',
    'Inventory',
    'Inventory_User',
    'Order',
    'InventoryWorkUnit',
    'InventoryCountAttempt',
    'Inventory_Equipment_Shelf_Snapshot',
    'Inventory_SerialNumber_Snapshot',
    'InventoryInvestigationIssue',
    'Notification'
)
ORDER BY name;

SELECT
    stockStatusId,
    stockStatusName
FROM dbo.StockStatus
ORDER BY stockStatusName;

SELECT
    r.roleName,
    COUNT(p.permissionId) AS PermissionCount
FROM dbo.Role r
LEFT JOIN dbo.Permission p
    ON p.roleId = r.roleId
GROUP BY r.roleId, r.roleName
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
ORDER BY TableName, ForeignKeyName;

SELECT
    (SELECT COUNT_BIG(*) FROM dbo.Stock) AS Stocks,
    (SELECT COUNT_BIG(*) FROM dbo.Shelf) AS Shelves,
    (SELECT COUNT_BIG(*) FROM dbo.Equipment) AS Equipment,
    (SELECT COUNT_BIG(*) FROM dbo.SerialNumber) AS SerialNumbers,
    (SELECT COUNT_BIG(*) FROM dbo.Mouvement) AS Movements,
    (SELECT COUNT_BIG(*) FROM dbo.Inventory) AS Inventories;

-- Custom hardening objects are intentionally handled in the NEXT phase.
SELECT
    name AS ExistingHardeningTrigger
FROM sys.triggers
WHERE name IN (
    'TR_Shelf_RequireActiveStock',
    'TR_EquipmentShelfs_RequireActiveStock',
    'TR_Mouvement_RequireActiveStocks',
    'TR_SerialNumber_Guards',
    'TR_InventoryWorkUnit_AcceptedAttempt',
    'TR_MovementEquipment_MatchHeader'
)
ORDER BY name;
