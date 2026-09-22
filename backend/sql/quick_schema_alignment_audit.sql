/*
  SOMIPHARM QUICK SCHEMA ALIGNMENT AUDIT
  READ ONLY - SELECT statements only.
*/

SET NOCOUNT ON;

SELECT
    @@SERVERNAME AS CurrentServer,
    DB_NAME() AS CurrentDatabase,
    SUSER_SNAME() AS LoginName;

WITH ExpectedTables(TableName) AS (
    SELECT *
    FROM (VALUES
        ('Stock'),
        ('StockStatus'),
        ('Shelf'),
        ('Equipment'),
        ('EquipmentShelfs'),
        ('SerialNumber'),
        ('Mouvement'),
        ('MovementEquipment'),
        ('Inventory'),
        ('InventoryWorkUnit'),
        ('InventoryCountAttempt'),
        ('Order')
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

WITH ExpectedColumns(TableName, ColumnName) AS (
    SELECT *
    FROM (VALUES
        ('Equipment', 'equipmentStatus'),
        ('InventoryWorkUnit', 'acceptedAttemptId'),
        ('InventoryWorkUnit', 'reconciliationStatus'),
        ('Mouvement', 'inventoryId'),
        ('Mouvement', 'origin'),
        ('Mouvement', 'reason'),
        ('MovementEquipment', 'equipmentTypeSnapshot'),
        ('Shelf', 'stockId'),
        ('Stock', 'stockStatusId'),
        ('SerialNumber', 'serialNumberStatus'),
        ('SerialNumber', 'shelfId')
    ) v(TableName, ColumnName)
)
SELECT
    e.TableName,
    e.ColumnName,
    CASE
        WHEN c.column_id IS NULL THEN 'MISSING'
        ELSE 'PRESENT'
    END AS Result
FROM ExpectedColumns e
LEFT JOIN sys.tables t
    ON t.name = e.TableName
LEFT JOIN sys.columns c
    ON c.object_id = t.object_id
    AND c.name = e.ColumnName
ORDER BY e.TableName, e.ColumnName;

SELECT
    OBJECT_NAME(fk.parent_object_id) AS TableName,
    fk.name AS ForeignKeyName,
    OBJECT_NAME(fk.referenced_object_id) AS ReferencedTable,
    fk.is_disabled AS IsDisabled,
    fk.is_not_trusted AS IsNotTrusted
FROM sys.foreign_keys fk
WHERE OBJECT_NAME(fk.parent_object_id) IN (
    'Stock',
    'Shelf',
    'Equipment',
    'EquipmentShelfs',
    'SerialNumber',
    'Mouvement',
    'MovementEquipment',
    'Inventory',
    'InventoryWorkUnit',
    'InventoryCountAttempt',
    'Order'
)
ORDER BY TableName, ForeignKeyName;

IF OBJECT_ID(N'dbo.StockStatus', N'U') IS NOT NULL
BEGIN
    SELECT
        stockStatusId,
        stockStatusName
    FROM dbo.StockStatus
    ORDER BY stockStatusName;
END;

SELECT
    o.name AS ObjectName,
    o.type_desc AS ObjectType,
    CASE
        WHEN tr.object_id IS NULL THEN NULL
        ELSE tr.is_disabled
    END AS TriggerDisabled
FROM sys.objects o
LEFT JOIN sys.triggers tr
    ON tr.object_id = o.object_id
WHERE o.name IN (
    'TR_Shelf_RequireActiveStock',
    'TR_EquipmentShelfs_RequireActiveStock',
    'TR_Mouvement_RequireActiveStocks',
    'TR_SerialNumber_Guards',
    'TR_InventoryWorkUnit_AcceptedAttempt',
    'TR_MovementEquipment_MatchHeader'
)
ORDER BY o.name;
