/*
  SOMIPHARM FINAL LIVE DATABASE AUDIT
  ----------------------------------
  READ-ONLY.
  This file performs SELECT-only inspection.

  IMPORTANT:
  - Run this only after selecting the SQL Server/database you believe the app uses.
  - Do NOT run prisma db push / migrate reset / migrate dev / migrate deploy
    as part of this audit.
*/

SET NOCOUNT ON;

PRINT '============================================================';
PRINT '1. SERVER / DATABASE';
PRINT '============================================================';

SELECT
    @@SERVERNAME AS CurrentServer,
    DB_NAME() AS CurrentDatabase,
    SUSER_SNAME() AS LoginName;

PRINT '============================================================';
PRINT '2. EXPECTED APPLICATION TABLES';
PRINT '============================================================';

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

PRINT '============================================================';
PRINT '3. IMPORTANT COLUMNS';
PRINT '============================================================';

WITH ExpectedColumns(TableName, ColumnName) AS (
    SELECT *
    FROM (VALUES
        ('Equipment', 'equipmentStatus'),
        ('InventoryWorkUnit', 'acceptedAttemptId'),
        ('InventoryWorkUnit', 'reconciledAt'),
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
    END AS Result,
    ty.name AS SqlType,
    c.max_length AS MaxLength,
    c.is_nullable AS IsNullable
FROM ExpectedColumns e
LEFT JOIN sys.tables t
    ON t.name = e.TableName
LEFT JOIN sys.columns c
    ON c.object_id = t.object_id
    AND c.name = e.ColumnName
LEFT JOIN sys.types ty
    ON ty.user_type_id = c.user_type_id
ORDER BY e.TableName, e.ColumnName;

PRINT '============================================================';
PRINT '4. FOREIGN KEYS';
PRINT '============================================================';

SELECT
    OBJECT_SCHEMA_NAME(fk.parent_object_id) AS SchemaName,
    OBJECT_NAME(fk.parent_object_id) AS TableName,
    fk.name AS ForeignKeyName,
    OBJECT_NAME(fk.referenced_object_id) AS ReferencedTable,
    fk.is_disabled AS IsDisabled,
    fk.is_not_trusted AS IsNotTrusted,
    fk.delete_referential_action_desc AS DeleteAction,
    fk.update_referential_action_desc AS UpdateAction
FROM sys.foreign_keys fk
WHERE
    OBJECT_NAME(fk.parent_object_id) IN (
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

PRINT '============================================================';
PRINT '5. CHECK CONSTRAINTS';
PRINT '============================================================';

SELECT
    OBJECT_SCHEMA_NAME(cc.parent_object_id) AS SchemaName,
    OBJECT_NAME(cc.parent_object_id) AS TableName,
    cc.name AS ConstraintName,
    cc.definition,
    cc.is_disabled AS IsDisabled,
    cc.is_not_trusted AS IsNotTrusted
FROM sys.check_constraints cc
WHERE
    OBJECT_NAME(cc.parent_object_id) IN (
        'Stock',
        'StockStatus',
        'Shelf',
        'Equipment',
        'EquipmentShelfs',
        'SerialNumber',
        'Mouvement',
        'MovementEquipment',
        'Inventory',
        'InventoryWorkUnit',
        'InventoryCountAttempt'
    )
ORDER BY TableName, ConstraintName;

PRINT '============================================================';
PRINT '6. STOCK STATUS DOMAIN';
PRINT '============================================================';

IF OBJECT_ID(N'dbo.StockStatus', N'U') IS NOT NULL
BEGIN
    SELECT
        stockStatusId,
        stockStatusName
    FROM dbo.StockStatus
    ORDER BY stockStatusName;
END
ELSE
BEGIN
    SELECT
        CAST(NULL AS uniqueidentifier) AS stockStatusId,
        CAST('StockStatus table is missing' AS varchar(100)) AS stockStatusName;
END;

PRINT '============================================================';
PRINT '7. CUSTOM HARDENING OBJECTS';
PRINT '============================================================';

WITH ExpectedObjects(ObjectName, ExpectedType) AS (
    SELECT *
    FROM (VALUES
        ('TR_Shelf_RequireActiveStock', 'TRIGGER'),
        ('TR_EquipmentShelfs_RequireActiveStock', 'TRIGGER'),
        ('TR_Mouvement_RequireActiveStocks', 'TRIGGER'),
        ('TR_SerialNumber_Guards', 'TRIGGER'),
        ('TR_InventoryWorkUnit_AcceptedAttempt', 'TRIGGER'),
        ('TR_MovementEquipment_MatchHeader', 'TRIGGER')
    ) v(ObjectName, ExpectedType)
)
SELECT
    e.ObjectName,
    e.ExpectedType,
    CASE
        WHEN o.object_id IS NULL THEN 'MISSING'
        ELSE 'PRESENT'
    END AS Result,
    o.type_desc AS ActualType
FROM ExpectedObjects e
LEFT JOIN sys.objects o
    ON o.name = e.ObjectName
ORDER BY e.ObjectName;

PRINT '============================================================';
PRINT '8. TABLE ROW COUNTS (READ ONLY)';
PRINT '============================================================';

SELECT
    t.name AS TableName,
    SUM(p.rows) AS ApproxRows
FROM sys.tables t
JOIN sys.partitions p
    ON p.object_id = t.object_id
    AND p.index_id IN (0, 1)
WHERE
    t.name IN (
        'Stock',
        'StockStatus',
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
GROUP BY t.name
ORDER BY t.name;

PRINT '============================================================';
PRINT 'AUDIT COMPLETE - NO DATA OR SCHEMA WAS MODIFIED';
PRINT '============================================================';
