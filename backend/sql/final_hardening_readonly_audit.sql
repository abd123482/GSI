/*
    SOMIPHARM FINAL HARDENING AUDIT
    READ ONLY.

    This script intentionally contains no INSERT / UPDATE / DELETE /
    ALTER / CREATE / DROP statements.
*/

SET NOCOUNT ON;

PRINT '1. CONNECTION';
SELECT
    @@SERVERNAME AS CurrentServer,
    DB_NAME() AS CurrentDatabase,
    SUSER_SNAME() AS LoginName;

PRINT '2. EXPECTED HARDENING TRIGGERS';
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
    END AS TriggerState
FROM ExpectedTrigger e
LEFT JOIN sys.triggers tr
    ON tr.name = e.TriggerName
ORDER BY e.TriggerName;

PRINT '3. DISABLED / UNTRUSTED FOREIGN KEYS';
SELECT
    OBJECT_NAME(parent_object_id) AS TableName,
    name AS ForeignKeyName,
    OBJECT_NAME(referenced_object_id) AS ReferencedTable,
    is_disabled AS IsDisabled,
    is_not_trusted AS IsNotTrusted
FROM sys.foreign_keys
WHERE
    (is_disabled = 1 OR is_not_trusted = 1)
    AND OBJECT_NAME(parent_object_id) IN (
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

PRINT '4. DISABLED / UNTRUSTED CHECK CONSTRAINTS';
SELECT
    OBJECT_NAME(parent_object_id) AS TableName,
    name AS ConstraintName,
    definition,
    is_disabled AS IsDisabled,
    is_not_trusted AS IsNotTrusted
FROM sys.check_constraints
WHERE
    (is_disabled = 1 OR is_not_trusted = 1)
    AND OBJECT_NAME(parent_object_id) IN (
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

PRINT '5. STOCK STATUS DOMAIN';
IF OBJECT_ID(N'dbo.StockStatus', N'U') IS NOT NULL
BEGIN
    SELECT
        stockStatusId,
        stockStatusName
    FROM dbo.StockStatus
    ORDER BY stockStatusName;
END;

PRINT '6. NEGATIVE QUANTITIES';
IF COL_LENGTH('dbo.Equipment', 'equipmentQuantity') IS NOT NULL
BEGIN
    SELECT TOP (100)
        'Equipment' AS SourceTable,
        equipmentId AS EntityId,
        equipmentQuantity AS BadQuantity
    FROM dbo.Equipment
    WHERE equipmentQuantity < 0;
END;

IF COL_LENGTH('dbo.Shelf', 'shelfQuantity') IS NOT NULL
BEGIN
    SELECT TOP (100)
        'Shelf' AS SourceTable,
        shelfId AS EntityId,
        shelfQuantity AS BadQuantity
    FROM dbo.Shelf
    WHERE shelfQuantity < 0;
END;

IF COL_LENGTH('dbo.EquipmentShelfs', 'equipmentQuantity') IS NOT NULL
BEGIN
    SELECT TOP (100)
        'EquipmentShelfs' AS SourceTable,
        equipmentShelfId AS EntityId,
        equipmentQuantity AS BadQuantity
    FROM dbo.EquipmentShelfs
    WHERE equipmentQuantity < 0;
END;

PRINT '7. DUPLICATE EQUIPMENT/SHELF ALLOCATIONS';
IF
    COL_LENGTH('dbo.EquipmentShelfs', 'equipmentId') IS NOT NULL
    AND COL_LENGTH('dbo.EquipmentShelfs', 'shelfId') IS NOT NULL
BEGIN
    SELECT TOP (100)
        equipmentId,
        shelfId,
        COUNT_BIG(*) AS DuplicateRows
    FROM dbo.EquipmentShelfs
    GROUP BY equipmentId, shelfId
    HAVING COUNT_BIG(*) > 1
    ORDER BY DuplicateRows DESC;
END;

PRINT '8. STANDARD GLOBAL QUANTITY VS ALLOCATIONS';
IF
    COL_LENGTH('dbo.Equipment', 'hasSerialNumber') IS NOT NULL
    AND COL_LENGTH('dbo.Equipment', 'equipmentQuantity') IS NOT NULL
    AND COL_LENGTH('dbo.EquipmentShelfs', 'equipmentQuantity') IS NOT NULL
BEGIN
    SELECT TOP (100)
        e.equipmentId,
        e.equipmentName,
        e.equipmentQuantity AS GlobalQuantity,
        COALESCE(a.AllocatedQuantity, 0) AS AllocatedQuantity
    FROM dbo.Equipment e
    OUTER APPLY (
        SELECT
            SUM(es.equipmentQuantity) AS AllocatedQuantity
        FROM dbo.EquipmentShelfs es
        WHERE es.equipmentId = e.equipmentId
    ) a
    WHERE
        e.hasSerialNumber = 0
        AND COALESCE(e.equipmentQuantity, 0) <>
            COALESCE(a.AllocatedQuantity, 0)
    ORDER BY e.equipmentName;
END;

PRINT '9. SERIALIZED GLOBAL QUANTITY VS PHYSICAL SERIALS';
IF
    COL_LENGTH('dbo.Equipment', 'hasSerialNumber') IS NOT NULL
    AND COL_LENGTH('dbo.Equipment', 'equipmentQuantity') IS NOT NULL
    AND COL_LENGTH('dbo.SerialNumber', 'shelfId') IS NOT NULL
BEGIN
    SELECT TOP (100)
        e.equipmentId,
        e.equipmentName,
        e.equipmentQuantity AS GlobalQuantity,
        COALESCE(s.PhysicalSerials, 0) AS PhysicalSerials
    FROM dbo.Equipment e
    OUTER APPLY (
        SELECT COUNT_BIG(*) AS PhysicalSerials
        FROM dbo.SerialNumber sn
        WHERE
            sn.equipmentId = e.equipmentId
            AND sn.shelfId IS NOT NULL
    ) s
    WHERE
        e.hasSerialNumber = 1
        AND COALESCE(e.equipmentQuantity, 0) <>
            COALESCE(s.PhysicalSerials, 0)
    ORDER BY e.equipmentName;
END;

PRINT '10. SHELF TOTAL VS ALLOCATIONS';
IF
    COL_LENGTH('dbo.Shelf', 'shelfQuantity') IS NOT NULL
    AND COL_LENGTH('dbo.EquipmentShelfs', 'equipmentQuantity') IS NOT NULL
BEGIN
    SELECT TOP (100)
        s.shelfId,
        s.shelfName,
        s.shelfQuantity AS ShelfQuantity,
        COALESCE(a.AllocatedQuantity, 0) AS AllocatedQuantity
    FROM dbo.Shelf s
    OUTER APPLY (
        SELECT
            SUM(es.equipmentQuantity) AS AllocatedQuantity
        FROM dbo.EquipmentShelfs es
        WHERE es.shelfId = s.shelfId
    ) a
    WHERE
        COALESCE(s.shelfQuantity, 0) <>
        COALESCE(a.AllocatedQuantity, 0)
    ORDER BY s.shelfName;
END;

PRINT '11. INVENTORY ACCEPTED ATTEMPT MUST BELONG TO SAME UNIT';
IF
    COL_LENGTH('dbo.InventoryWorkUnit', 'acceptedAttemptId') IS NOT NULL
    AND OBJECT_ID(N'dbo.InventoryCountAttempt', N'U') IS NOT NULL
BEGIN
    SELECT TOP (100)
        u.unitId,
        u.reconciliationStatus,
        u.acceptedAttemptId,
        a.unitId AS AcceptedAttemptUnitId,
        a.purpose,
        a.status
    FROM dbo.InventoryWorkUnit u
    JOIN dbo.InventoryCountAttempt a
        ON a.attemptId = u.acceptedAttemptId
    WHERE a.unitId <> u.unitId;
END;

PRINT '12. PRIMARY_MATCH ACCEPTED ATTEMPT';
IF
    COL_LENGTH('dbo.InventoryWorkUnit', 'reconciliationStatus') IS NOT NULL
    AND COL_LENGTH('dbo.InventoryWorkUnit', 'acceptedAttemptId') IS NOT NULL
BEGIN
    SELECT TOP (100)
        u.unitId,
        u.reconciliationStatus,
        u.acceptedAttemptId,
        a.purpose,
        a.status
    FROM dbo.InventoryWorkUnit u
    LEFT JOIN dbo.InventoryCountAttempt a
        ON a.attemptId = u.acceptedAttemptId
    WHERE
        u.reconciliationStatus = 'PRIMARY_MATCH'
        AND (
            u.acceptedAttemptId IS NULL
            OR a.purpose <> 'PRIMARY_1'
            OR a.status <> 'SUBMITTED'
        );
END;

PRINT '13. THIRD_REQUIRED MUST NOT HAVE ACCEPTED RESULT YET';
IF
    COL_LENGTH('dbo.InventoryWorkUnit', 'reconciliationStatus') IS NOT NULL
    AND COL_LENGTH('dbo.InventoryWorkUnit', 'acceptedAttemptId') IS NOT NULL
BEGIN
    SELECT TOP (100)
        unitId,
        reconciliationStatus,
        acceptedAttemptId
    FROM dbo.InventoryWorkUnit
    WHERE
        reconciliationStatus = 'THIRD_REQUIRED'
        AND acceptedAttemptId IS NOT NULL;
END;

PRINT '14. THIRD_RESOLVED ACCEPTED ATTEMPT';
IF
    COL_LENGTH('dbo.InventoryWorkUnit', 'reconciliationStatus') IS NOT NULL
    AND COL_LENGTH('dbo.InventoryWorkUnit', 'acceptedAttemptId') IS NOT NULL
BEGIN
    SELECT TOP (100)
        u.unitId,
        u.reconciliationStatus,
        u.acceptedAttemptId,
        a.purpose,
        a.status
    FROM dbo.InventoryWorkUnit u
    LEFT JOIN dbo.InventoryCountAttempt a
        ON a.attemptId = u.acceptedAttemptId
    WHERE
        u.reconciliationStatus = 'THIRD_RESOLVED'
        AND (
            u.acceptedAttemptId IS NULL
            OR a.purpose <> 'FINAL_RECOUNT'
            OR a.status <> 'SUBMITTED'
        );
END;

PRINT 'AUDIT COMPLETE - NOTHING WAS MODIFIED';
