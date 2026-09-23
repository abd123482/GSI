/*
  SOMIPHARM REBUILD TEST DATABASE HARDENING
  -----------------------------------------
  Apply ONLY to an isolated rebuild database such as:
    yacinedb_rebuild_test

  The PowerShell/Node runner refuses the real yacinedb.

  These triggers protect database-level invariants that Prisma schema alone
  cannot express.
*/

SET XACT_ABORT ON;
GO

CREATE OR ALTER TRIGGER dbo.TR_Shelf_RequireActiveStock
ON dbo.Shelf
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (
        SELECT 1
        FROM inserted i
        JOIN dbo.Stock s
            ON s.stockId = i.stockId
        JOIN dbo.StockStatus ss
            ON ss.stockStatusId = s.stockStatusId
        WHERE UPPER(LTRIM(RTRIM(ss.stockStatusName))) <> 'ACTIVE'
    )
    BEGIN
        THROW 51001,
            'A shelf can be created or reassigned only inside an ACTIVE stock.',
            1;
    END;
END;
GO

CREATE OR ALTER TRIGGER dbo.TR_EquipmentShelfs_RequireActiveStock
ON dbo.EquipmentShelfs
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (
        SELECT 1
        FROM inserted i
        JOIN dbo.Shelf sh
            ON sh.shelfId = i.shelfId
        JOIN dbo.Stock st
            ON st.stockId = sh.stockId
        JOIN dbo.StockStatus ss
            ON ss.stockStatusId = st.stockStatusId
        WHERE UPPER(LTRIM(RTRIM(ss.stockStatusName))) <> 'ACTIVE'
    )
    BEGIN
        THROW 51002,
            'Equipment allocation is allowed only on a shelf whose stock is ACTIVE.',
            1;
    END;

    IF EXISTS (
        SELECT 1
        FROM inserted
        WHERE equipmentQuantity < 0
    )
    BEGIN
        THROW 51003,
            'Equipment shelf quantity cannot be negative.',
            1;
    END;
END;
GO

CREATE OR ALTER TRIGGER dbo.TR_Mouvement_RequireActiveStocks
ON dbo.Mouvement
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (
        SELECT 1
        FROM inserted i
        JOIN dbo.Shelf sh
            ON sh.shelfId = i.sourceShelfId
        JOIN dbo.Stock st
            ON st.stockId = sh.stockId
        JOIN dbo.StockStatus ss
            ON ss.stockStatusId = st.stockStatusId
        WHERE
            i.sourceShelfId IS NOT NULL
            AND UPPER(LTRIM(RTRIM(ss.stockStatusName))) <> 'ACTIVE'
    )
    BEGIN
        THROW 51004,
            'Movement source shelf belongs to an INACTIVE stock.',
            1;
    END;

    IF EXISTS (
        SELECT 1
        FROM inserted i
        JOIN dbo.Shelf sh
            ON sh.shelfId = i.destinationShelfId
        JOIN dbo.Stock st
            ON st.stockId = sh.stockId
        JOIN dbo.StockStatus ss
            ON ss.stockStatusId = st.stockStatusId
        WHERE
            i.destinationShelfId IS NOT NULL
            AND UPPER(LTRIM(RTRIM(ss.stockStatusName))) <> 'ACTIVE'
    )
    BEGIN
        THROW 51005,
            'Movement destination shelf belongs to an INACTIVE stock.',
            1;
    END;

    IF EXISTS (
        SELECT 1
        FROM inserted
        WHERE movementQuantity IS NOT NULL
          AND movementQuantity < 0
    )
    BEGIN
        THROW 51006,
            'Movement header quantity cannot be negative.',
            1;
    END;
END;
GO

CREATE OR ALTER TRIGGER dbo.TR_SerialNumber_Guards
ON dbo.SerialNumber
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    -- Serial identity code is immutable after creation.
    IF EXISTS (
        SELECT 1
        FROM inserted i
        JOIN deleted d
            ON d.serialNumberId = i.serialNumberId
        WHERE ISNULL(i.serialNumberCode, '') <> ISNULL(d.serialNumberCode, '')
    )
    BEGIN
        THROW 51007,
            'Serial number code is immutable after creation.',
            1;
    END;

    -- A serial identity must belong to serialized equipment.
    IF EXISTS (
        SELECT 1
        FROM inserted i
        JOIN dbo.Equipment e
            ON e.equipmentId = i.equipmentId
        WHERE e.hasSerialNumber = 0
    )
    BEGIN
        THROW 51008,
            'A serial number can belong only to serialized equipment.',
            1;
    END;

    -- A serial may be unallocated. If allocated, target stock must be ACTIVE.
    IF EXISTS (
        SELECT 1
        FROM inserted i
        JOIN dbo.Shelf sh
            ON sh.shelfId = i.shelfId
        JOIN dbo.Stock st
            ON st.stockId = sh.stockId
        JOIN dbo.StockStatus ss
            ON ss.stockStatusId = st.stockStatusId
        WHERE
            i.shelfId IS NOT NULL
            AND UPPER(LTRIM(RTRIM(ss.stockStatusName))) <> 'ACTIVE'
    )
    BEGIN
        THROW 51009,
            'A serial number can be assigned only to a shelf whose stock is ACTIVE.',
            1;
    END;
END;
GO

CREATE OR ALTER TRIGGER dbo.TR_InventoryWorkUnit_AcceptedAttempt
ON dbo.InventoryWorkUnit
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    -- Any accepted attempt must belong to the exact same unit and be SUBMITTED.
    IF EXISTS (
        SELECT 1
        FROM inserted i
        LEFT JOIN dbo.InventoryCountAttempt a
            ON a.attemptId = i.acceptedAttemptId
        WHERE
            i.acceptedAttemptId IS NOT NULL
            AND (
                a.attemptId IS NULL
                OR a.unitId <> i.unitId
                OR a.status <> 'SUBMITTED'
            )
    )
    BEGIN
        THROW 51010,
            'Accepted inventory attempt must be SUBMITTED and belong to the same work unit.',
            1;
    END;

    -- C1/C2 agreement accepts PRIMARY_1.
    IF EXISTS (
        SELECT 1
        FROM inserted i
        LEFT JOIN dbo.InventoryCountAttempt a
            ON a.attemptId = i.acceptedAttemptId
        WHERE
            i.reconciliationStatus = 'PRIMARY_MATCH'
            AND (
                i.acceptedAttemptId IS NULL
                OR a.purpose <> 'PRIMARY_1'
                OR a.status <> 'SUBMITTED'
            )
    )
    BEGIN
        THROW 51011,
            'PRIMARY_MATCH must accept the submitted PRIMARY_1 attempt.',
            1;
    END;

    -- A discrepancy awaiting C3 has no accepted final result yet.
    IF EXISTS (
        SELECT 1
        FROM inserted
        WHERE
            reconciliationStatus = 'THIRD_REQUIRED'
            AND acceptedAttemptId IS NOT NULL
    )
    BEGIN
        THROW 51012,
            'THIRD_REQUIRED cannot have an accepted attempt before C3 submits.',
            1;
    END;

    -- C3 resolution accepts FINAL_RECOUNT.
    IF EXISTS (
        SELECT 1
        FROM inserted i
        LEFT JOIN dbo.InventoryCountAttempt a
            ON a.attemptId = i.acceptedAttemptId
        WHERE
            i.reconciliationStatus = 'THIRD_RESOLVED'
            AND (
                i.acceptedAttemptId IS NULL
                OR a.purpose <> 'FINAL_RECOUNT'
                OR a.status <> 'SUBMITTED'
            )
    )
    BEGIN
        THROW 51013,
            'THIRD_RESOLVED must accept the submitted FINAL_RECOUNT attempt.',
            1;
    END;
END;
GO

CREATE OR ALTER TRIGGER dbo.TR_MovementEquipment_MatchHeader
ON dbo.MovementEquipment
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    -- Quantity on a movement line must be positive.
    IF EXISTS (
        SELECT 1
        FROM inserted
        WHERE equipmentQuantity <= 0
    )
    BEGIN
        THROW 51014,
            'Movement line quantity must be greater than zero.',
            1;
    END;

    -- If the parent header has legacy route fields populated, the child must match.
    IF EXISTS (
        SELECT 1
        FROM inserted i
        JOIN dbo.Mouvement m
            ON m.mouvementId = i.movementId
        WHERE
            (
                m.sourceShelfId IS NOT NULL
                AND (
                    i.sourceShelfId IS NULL
                    OR i.sourceShelfId <> m.sourceShelfId
                )
            )
            OR
            (
                m.destinationShelfId IS NOT NULL
                AND (
                    i.destinationShelfId IS NULL
                    OR i.destinationShelfId <> m.destinationShelfId
                )
            )
            OR
            (
                m.mouvementStatus IS NOT NULL
                AND m.mouvementStatus <> 'MIXED'
                AND i.movementStatus <> m.mouvementStatus
            )
    )
    BEGIN
        THROW 51015,
            'Movement child line conflicts with its populated parent header route/type.',
            1;
    END;

    -- New multi-line documents store route on child lines.
    IF EXISTS (
        SELECT 1
        FROM inserted i
        JOIN dbo.Shelf sh
            ON sh.shelfId = i.sourceShelfId
        JOIN dbo.Stock st
            ON st.stockId = sh.stockId
        JOIN dbo.StockStatus ss
            ON ss.stockStatusId = st.stockStatusId
        WHERE
            i.sourceShelfId IS NOT NULL
            AND UPPER(LTRIM(RTRIM(ss.stockStatusName))) <> 'ACTIVE'
    )
    BEGIN
        THROW 51016,
            'Movement line source belongs to an INACTIVE stock.',
            1;
    END;

    IF EXISTS (
        SELECT 1
        FROM inserted i
        JOIN dbo.Shelf sh
            ON sh.shelfId = i.destinationShelfId
        JOIN dbo.Stock st
            ON st.stockId = sh.stockId
        JOIN dbo.StockStatus ss
            ON ss.stockStatusId = st.stockStatusId
        WHERE
            i.destinationShelfId IS NOT NULL
            AND UPPER(LTRIM(RTRIM(ss.stockStatusName))) <> 'ACTIVE'
    )
    BEGIN
        THROW 51017,
            'Movement line destination belongs to an INACTIVE stock.',
            1;
    END;

    -- Serialized lines are always a single physical unit and must belong
    -- to the line equipment.
    IF EXISTS (
        SELECT 1
        FROM inserted i
        JOIN dbo.SerialNumber sn
            ON sn.serialNumberId = i.serialNumberId
        WHERE
            i.serialNumberId IS NOT NULL
            AND (
                i.equipmentQuantity <> 1
                OR sn.equipmentId <> i.equipmentId
            )
    )
    BEGIN
        THROW 51018,
            'Serialized movement lines must have quantity 1 and the serial must belong to the same equipment.',
            1;
    END;

    IF EXISTS (
        SELECT 1
        FROM inserted
        WHERE equipmentTypeSnapshot NOT IN ('STANDARD', 'SERIALIZED')
    )
    BEGIN
        THROW 51019,
            'Movement equipment type snapshot must be STANDARD or SERIALIZED.',
            1;
    END;
END;
GO
