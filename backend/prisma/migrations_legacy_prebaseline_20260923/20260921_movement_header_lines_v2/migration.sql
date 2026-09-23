SET XACT_ABORT ON;

BEGIN TRY
    BEGIN TRANSACTION;

    /* ============================================================
       0. Standardize the physical child table name
       ============================================================ */
    IF OBJECT_ID(N'dbo.MovementEquipment', N'U') IS NULL
       AND OBJECT_ID(N'dbo.MouvementEquipment', N'U') IS NOT NULL
    BEGIN
        EXEC sp_rename N'dbo.MouvementEquipment', N'MovementEquipment';
    END;

    IF OBJECT_ID(N'dbo.MovementEquipment', N'U') IS NULL
    BEGIN
        CREATE TABLE dbo.MovementEquipment
        (
            movementEquipmentId UNIQUEIDENTIFIER NOT NULL
                CONSTRAINT PK_MovementEquipment PRIMARY KEY
                CONSTRAINT DF_MovementEquipment_Id DEFAULT NEWID(),

            movementId UNIQUEIDENTIFIER NOT NULL,
            equipmentId UNIQUEIDENTIFIER NOT NULL,
            RowNum INT NULL,

            sourceShelfId UNIQUEIDENTIFIER NULL,
            destinationShelfId UNIQUEIDENTIFIER NULL,
            serialNumberId UNIQUEIDENTIFIER NULL,

            equipmentQuantity INT NULL,
            movementStatus VARCHAR(50) NULL
        );
    END;

    /* ============================================================
       1. Standardize legacy child column names when necessary
       ============================================================ */
    IF COL_LENGTH('dbo.MovementEquipment', 'movementEquipmentId') IS NULL
       AND COL_LENGTH('dbo.MovementEquipment', 'mouvementEquipmentId') IS NOT NULL
        EXEC sp_rename
            N'dbo.MovementEquipment.mouvementEquipmentId',
            N'movementEquipmentId',
            N'COLUMN';

    IF COL_LENGTH('dbo.MovementEquipment', 'movementId') IS NULL
       AND COL_LENGTH('dbo.MovementEquipment', 'mouvementId') IS NOT NULL
        EXEC sp_rename
            N'dbo.MovementEquipment.mouvementId',
            N'movementId',
            N'COLUMN';

    IF COL_LENGTH('dbo.MovementEquipment', 'equipmentQuantity') IS NULL
       AND COL_LENGTH('dbo.MovementEquipment', 'mouvementQuantity') IS NOT NULL
        EXEC sp_rename
            N'dbo.MovementEquipment.mouvementQuantity',
            N'equipmentQuantity',
            N'COLUMN';

    IF COL_LENGTH('dbo.MovementEquipment', 'movementStatus') IS NULL
       AND COL_LENGTH('dbo.MovementEquipment', 'mouvementStatus') IS NOT NULL
        EXEC sp_rename
            N'dbo.MovementEquipment.mouvementStatus',
            N'movementStatus',
            N'COLUMN';

    /* ============================================================
       2. Add missing line-level columns
       ============================================================ */
    IF COL_LENGTH('dbo.MovementEquipment', 'RowNum') IS NULL
        ALTER TABLE dbo.MovementEquipment ADD RowNum INT NULL;

    IF COL_LENGTH('dbo.MovementEquipment', 'sourceShelfId') IS NULL
        ALTER TABLE dbo.MovementEquipment ADD sourceShelfId UNIQUEIDENTIFIER NULL;

    IF COL_LENGTH('dbo.MovementEquipment', 'destinationShelfId') IS NULL
        ALTER TABLE dbo.MovementEquipment ADD destinationShelfId UNIQUEIDENTIFIER NULL;

    IF COL_LENGTH('dbo.MovementEquipment', 'serialNumberId') IS NULL
        ALTER TABLE dbo.MovementEquipment ADD serialNumberId UNIQUEIDENTIFIER NULL;

    IF COL_LENGTH('dbo.MovementEquipment', 'equipmentQuantity') IS NULL
        ALTER TABLE dbo.MovementEquipment ADD equipmentQuantity INT NULL;

    IF COL_LENGTH('dbo.MovementEquipment', 'movementStatus') IS NULL
        ALTER TABLE dbo.MovementEquipment ADD movementStatus VARCHAR(50) NULL;

    /* ============================================================
       3. Backfill old Mouvement headers which do not have lines yet
       ============================================================ */
    INSERT INTO dbo.MovementEquipment
    (
        movementEquipmentId,
        movementId,
        equipmentId,
        RowNum,
        sourceShelfId,
        destinationShelfId,
        serialNumberId,
        equipmentQuantity,
        movementStatus
    )
    SELECT
        NEWID(),
        m.mouvementId,
        m.equipmentId,
        1,
        m.sourceShelfId,
        m.destinationShelfId,
        m.serialNumberId,
        CASE
            WHEN ISNULL(m.movementQuantity, 0) > 0
                THEN m.movementQuantity
            ELSE 1
        END,
        CASE
            WHEN UPPER(ISNULL(m.mouvementStatus, '')) IN ('ENTRY', 'IN')
                THEN 'IN'
            WHEN UPPER(ISNULL(m.mouvementStatus, '')) IN ('EXIT', 'OUT')
                THEN 'OUT'
            WHEN UPPER(ISNULL(m.mouvementStatus, '')) = 'TRANSFER'
                THEN 'TRANSFER'
            WHEN m.sourceShelfId IS NULL
                 AND m.destinationShelfId IS NOT NULL
                THEN 'IN'
            WHEN m.sourceShelfId IS NOT NULL
                 AND m.destinationShelfId IS NULL
                THEN 'OUT'
            ELSE 'TRANSFER'
        END
    FROM dbo.Mouvement m
    WHERE m.equipmentId IS NOT NULL
      AND NOT EXISTS
      (
          SELECT 1
          FROM dbo.MovementEquipment me
          WHERE me.movementId = m.mouvementId
      );

    /* ============================================================
       4. Normalize aliases and infer missing line statuses
       ============================================================ */
    UPDATE dbo.MovementEquipment
    SET movementStatus =
        CASE
            WHEN UPPER(ISNULL(movementStatus, '')) IN ('IN', 'ENTRY')
                THEN 'IN'
            WHEN UPPER(ISNULL(movementStatus, '')) IN ('OUT', 'EXIT')
                THEN 'OUT'
            WHEN UPPER(ISNULL(movementStatus, '')) = 'TRANSFER'
                THEN 'TRANSFER'
            WHEN sourceShelfId IS NULL
                 AND destinationShelfId IS NOT NULL
                THEN 'IN'
            WHEN sourceShelfId IS NOT NULL
                 AND destinationShelfId IS NULL
                THEN 'OUT'
            WHEN sourceShelfId IS NOT NULL
                 AND destinationShelfId IS NOT NULL
                THEN 'TRANSFER'
            ELSE movementStatus
        END;

    UPDATE dbo.MovementEquipment
    SET equipmentQuantity = 1
    WHERE equipmentQuantity IS NULL;

    /* Deterministic ordering inside every movement document. */
    ;WITH Numbered AS
    (
        SELECT
            movementEquipmentId,
            ROW_NUMBER() OVER
            (
                PARTITION BY movementId
                ORDER BY movementEquipmentId
            ) AS NewRowNum
        FROM dbo.MovementEquipment
    )
    UPDATE me
    SET RowNum = n.NewRowNum
    FROM dbo.MovementEquipment me
    INNER JOIN Numbered n
        ON n.movementEquipmentId = me.movementEquipmentId;

    /* ============================================================
       5. Abort instead of silently repairing destructive corruption
       ============================================================ */
    IF EXISTS
    (
        SELECT 1
        FROM dbo.MovementEquipment
        WHERE movementId IS NULL
           OR equipmentId IS NULL
           OR RowNum IS NULL
           OR equipmentQuantity IS NULL
           OR equipmentQuantity <= 0
           OR movementStatus IS NULL
    )
        THROW 51001,
              'MovementEquipment contains invalid NULL/quantity rows. Review them before continuing.',
              1;

    IF EXISTS
    (
        SELECT 1
        FROM dbo.MovementEquipment
        WHERE
            NOT
            (
                (movementStatus = 'IN'
                    AND sourceShelfId IS NULL
                    AND destinationShelfId IS NOT NULL)

                OR

                (movementStatus = 'OUT'
                    AND sourceShelfId IS NOT NULL
                    AND destinationShelfId IS NULL)

                OR

                (movementStatus = 'TRANSFER'
                    AND sourceShelfId IS NOT NULL
                    AND destinationShelfId IS NOT NULL
                    AND sourceShelfId <> destinationShelfId)
            )
    )
        THROW 51002,
              'MovementEquipment contains rows whose type does not match source/destination shelves.',
              1;

    IF EXISTS
    (
        SELECT 1
        FROM dbo.MovementEquipment
        WHERE serialNumberId IS NOT NULL
          AND equipmentQuantity <> 1
    )
        THROW 51003,
              'Serialized movement lines must have equipmentQuantity = 1.',
              1;

    /* ============================================================
       6. Strengthen line columns
       ============================================================ */
    ALTER TABLE dbo.MovementEquipment
        ALTER COLUMN movementId UNIQUEIDENTIFIER NOT NULL;

    ALTER TABLE dbo.MovementEquipment
        ALTER COLUMN equipmentId UNIQUEIDENTIFIER NOT NULL;

    ALTER TABLE dbo.MovementEquipment
        ALTER COLUMN RowNum INT NOT NULL;

    ALTER TABLE dbo.MovementEquipment
        ALTER COLUMN equipmentQuantity INT NOT NULL;

    ALTER TABLE dbo.MovementEquipment
        ALTER COLUMN movementStatus VARCHAR(50) NOT NULL;

    /* ============================================================
       7. Child constraints
       ============================================================ */
    IF NOT EXISTS
    (
        SELECT 1
        FROM sys.check_constraints
        WHERE name = 'CK_MovementEquipment_Quantity_Positive'
    )
        ALTER TABLE dbo.MovementEquipment
        ADD CONSTRAINT CK_MovementEquipment_Quantity_Positive
        CHECK (equipmentQuantity > 0);

    IF NOT EXISTS
    (
        SELECT 1
        FROM sys.check_constraints
        WHERE name = 'CK_MovementEquipment_Status'
    )
        ALTER TABLE dbo.MovementEquipment
        ADD CONSTRAINT CK_MovementEquipment_Status
        CHECK (movementStatus IN ('IN', 'OUT', 'TRANSFER'));

    IF NOT EXISTS
    (
        SELECT 1
        FROM sys.check_constraints
        WHERE name = 'CK_MovementEquipment_Direction'
    )
        ALTER TABLE dbo.MovementEquipment
        ADD CONSTRAINT CK_MovementEquipment_Direction
        CHECK
        (
            (movementStatus = 'IN'
                AND sourceShelfId IS NULL
                AND destinationShelfId IS NOT NULL)

            OR

            (movementStatus = 'OUT'
                AND sourceShelfId IS NOT NULL
                AND destinationShelfId IS NULL)

            OR

            (movementStatus = 'TRANSFER'
                AND sourceShelfId IS NOT NULL
                AND destinationShelfId IS NOT NULL
                AND sourceShelfId <> destinationShelfId)
        );

    IF NOT EXISTS
    (
        SELECT 1
        FROM sys.check_constraints
        WHERE name = 'CK_MovementEquipment_SerializedQuantity'
    )
        ALTER TABLE dbo.MovementEquipment
        ADD CONSTRAINT CK_MovementEquipment_SerializedQuantity
        CHECK (serialNumberId IS NULL OR equipmentQuantity = 1);

    /* ============================================================
       8. Child foreign keys
       ============================================================ */
    IF NOT EXISTS
    (
        SELECT 1
        FROM sys.foreign_keys
        WHERE name = 'FK_MovementEquipment_Mouvement'
    )
        ALTER TABLE dbo.MovementEquipment
        ADD CONSTRAINT FK_MovementEquipment_Mouvement
        FOREIGN KEY (movementId)
        REFERENCES dbo.Mouvement(mouvementId)
        ON DELETE CASCADE;

    IF NOT EXISTS
    (
        SELECT 1
        FROM sys.foreign_keys
        WHERE name = 'FK_MovementEquipment_Equipment'
    )
        ALTER TABLE dbo.MovementEquipment
        ADD CONSTRAINT FK_MovementEquipment_Equipment
        FOREIGN KEY (equipmentId)
        REFERENCES dbo.Equipment(equipmentId);

    IF NOT EXISTS
    (
        SELECT 1
        FROM sys.foreign_keys
        WHERE name = 'FK_MovementEquipment_SourceShelf'
    )
        ALTER TABLE dbo.MovementEquipment
        ADD CONSTRAINT FK_MovementEquipment_SourceShelf
        FOREIGN KEY (sourceShelfId)
        REFERENCES dbo.Shelf(shelfId);

    IF NOT EXISTS
    (
        SELECT 1
        FROM sys.foreign_keys
        WHERE name = 'FK_MovementEquipment_DestinationShelf'
    )
        ALTER TABLE dbo.MovementEquipment
        ADD CONSTRAINT FK_MovementEquipment_DestinationShelf
        FOREIGN KEY (destinationShelfId)
        REFERENCES dbo.Shelf(shelfId);

    IF NOT EXISTS
    (
        SELECT 1
        FROM sys.foreign_keys
        WHERE name = 'FK_MovementEquipment_SerialNumber'
    )
        ALTER TABLE dbo.MovementEquipment
        ADD CONSTRAINT FK_MovementEquipment_SerialNumber
        FOREIGN KEY (serialNumberId)
        REFERENCES dbo.SerialNumber(serialNumberId);

    /* ============================================================
       9. History/order/performance indexes
       ============================================================ */
    IF NOT EXISTS
    (
        SELECT 1
        FROM sys.indexes
        WHERE object_id = OBJECT_ID('dbo.MovementEquipment')
          AND name = 'UX_MovementEquipment_Movement_RowNum'
    )
        CREATE UNIQUE INDEX UX_MovementEquipment_Movement_RowNum
        ON dbo.MovementEquipment(movementId, RowNum);

    IF NOT EXISTS
    (
        SELECT 1
        FROM sys.indexes
        WHERE object_id = OBJECT_ID('dbo.MovementEquipment')
          AND name = 'IX_MovementEquipment_MovementId'
    )
        CREATE INDEX IX_MovementEquipment_MovementId
        ON dbo.MovementEquipment(movementId);

    IF NOT EXISTS
    (
        SELECT 1
        FROM sys.indexes
        WHERE object_id = OBJECT_ID('dbo.MovementEquipment')
          AND name = 'IX_MovementEquipment_EquipmentId'
    )
        CREATE INDEX IX_MovementEquipment_EquipmentId
        ON dbo.MovementEquipment(equipmentId);

    IF NOT EXISTS
    (
        SELECT 1
        FROM sys.indexes
        WHERE object_id = OBJECT_ID('dbo.MovementEquipment')
          AND name = 'IX_MovementEquipment_Status'
    )
        CREATE INDEX IX_MovementEquipment_Status
        ON dbo.MovementEquipment(movementStatus);

    IF NOT EXISTS
    (
        SELECT 1
        FROM sys.indexes
        WHERE object_id = OBJECT_ID('dbo.MovementEquipment')
          AND name = 'IX_MovementEquipment_SourceShelfId'
    )
        CREATE INDEX IX_MovementEquipment_SourceShelfId
        ON dbo.MovementEquipment(sourceShelfId);

    IF NOT EXISTS
    (
        SELECT 1
        FROM sys.indexes
        WHERE object_id = OBJECT_ID('dbo.MovementEquipment')
          AND name = 'IX_MovementEquipment_DestinationShelfId'
    )
        CREATE INDEX IX_MovementEquipment_DestinationShelfId
        ON dbo.MovementEquipment(destinationShelfId);

    IF NOT EXISTS
    (
        SELECT 1
        FROM sys.indexes
        WHERE object_id = OBJECT_ID('dbo.MovementEquipment')
          AND name = 'IX_MovementEquipment_SerialNumberId'
    )
        CREATE INDEX IX_MovementEquipment_SerialNumberId
        ON dbo.MovementEquipment(serialNumberId)
        WHERE serialNumberId IS NOT NULL;

    IF NOT EXISTS
    (
        SELECT 1
        FROM sys.indexes
        WHERE object_id = OBJECT_ID('dbo.Mouvement')
          AND name = 'IX_Mouvement_CreatedAt_Id'
    )
        CREATE INDEX IX_Mouvement_CreatedAt_Id
        ON dbo.Mouvement(createdAt DESC, mouvementId DESC);

    /* ============================================================
       10. EquipmentShelfs must be one row per equipment+shelf.
           We deliberately FAIL if duplicates already exist.
       ============================================================ */
    IF EXISTS
    (
        SELECT equipmentId, shelfId
        FROM dbo.EquipmentShelfs
        WHERE equipmentId IS NOT NULL
          AND shelfId IS NOT NULL
        GROUP BY equipmentId, shelfId
        HAVING COUNT(*) > 1
    )
        THROW 51004,
              'Duplicate EquipmentShelfs rows exist. Merge them before creating the unique index.',
              1;

    IF NOT EXISTS
    (
        SELECT 1
        FROM sys.indexes
        WHERE object_id = OBJECT_ID('dbo.EquipmentShelfs')
          AND name = 'UX_EquipmentShelfs_Equipment_Shelf'
    )
        CREATE UNIQUE INDEX UX_EquipmentShelfs_Equipment_Shelf
        ON dbo.EquipmentShelfs(equipmentId, shelfId)
        WHERE equipmentId IS NOT NULL
          AND shelfId IS NOT NULL;

    /* ============================================================
       11. Recompute parent summary from authoritative child lines
       ============================================================ */
    ;WITH Summary AS
    (
        SELECT
            movementId,
            SUM(equipmentQuantity) AS TotalQuantity,
            COUNT(*) AS LineCount,
            MIN(movementStatus) AS MinStatus,
            MAX(movementStatus) AS MaxStatus
        FROM dbo.MovementEquipment
        GROUP BY movementId
    ),
    SingleLine AS
    (
        SELECT
            movementId,
            equipmentId,
            sourceShelfId,
            destinationShelfId,
            serialNumberId
        FROM dbo.MovementEquipment
        WHERE RowNum = 1
    )
    UPDATE m
    SET
        m.movementQuantity = s.TotalQuantity,
        m.mouvementStatus =
            CASE
                WHEN s.MinStatus = s.MaxStatus THEN s.MinStatus
                ELSE 'MIXED'
            END,

        m.equipmentId =
            CASE WHEN s.LineCount = 1 THEN sl.equipmentId ELSE NULL END,

        m.sourceShelfId =
            CASE WHEN s.LineCount = 1 THEN sl.sourceShelfId ELSE NULL END,

        m.destinationShelfId =
            CASE WHEN s.LineCount = 1 THEN sl.destinationShelfId ELSE NULL END,

        m.serialNumberId =
            CASE WHEN s.LineCount = 1 THEN sl.serialNumberId ELSE NULL END
    FROM dbo.Mouvement m
    INNER JOIN Summary s
        ON s.movementId = m.mouvementId
    LEFT JOIN SingleLine sl
        ON sl.movementId = m.mouvementId;

    COMMIT TRANSACTION;

    PRINT 'Movement header/lines migration completed successfully.';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION;

    THROW;
END CATCH;
