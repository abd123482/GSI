-- =============================================================================
-- Script: create-order-table.sql
-- Description: Idempotent table and constraint creation for dbo.[Order]
-- Engine: Microsoft SQL Server (SSMS)
-- =============================================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Order' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.[Order] (
        orderId UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
        inventoryId UNIQUEIDENTIFIER NULL,
        serialNumberId UNIQUEIDENTIFIER NULL,
        equipmentId UNIQUEIDENTIFIER NULL,
        shelfId UNIQUEIDENTIFIER NULL,
        roleId UNIQUEIDENTIFIER NULL,
        userId UNIQUEIDENTIFIER NULL,
        quantityCalculated INT NULL,
        createdAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

        CONSTRAINT PK_Order PRIMARY KEY CLUSTERED (orderId),

        CONSTRAINT FK_Order_Inventory FOREIGN KEY (inventoryId)
            REFERENCES dbo.[Inventory](inventoryId) ON DELETE NO ACTION ON UPDATE NO ACTION,

        CONSTRAINT FK_Order_SerialNumber FOREIGN KEY (serialNumberId)
            REFERENCES dbo.[SerialNumber](serialNumberId) ON DELETE NO ACTION ON UPDATE NO ACTION,

        CONSTRAINT FK_Order_Equipment FOREIGN KEY (equipmentId)
            REFERENCES dbo.[Equipment](equipmentId) ON DELETE NO ACTION ON UPDATE NO ACTION,

        CONSTRAINT FK_Order_Shelf FOREIGN KEY (shelfId)
            REFERENCES dbo.[Shelf](shelfId) ON DELETE NO ACTION ON UPDATE NO ACTION,

        CONSTRAINT FK_Order_Role FOREIGN KEY (roleId)
            REFERENCES dbo.[Role](roleId) ON DELETE NO ACTION ON UPDATE NO ACTION,

        CONSTRAINT FK_Order_User FOREIGN KEY (userId)
            REFERENCES dbo.[User](userId) ON DELETE NO ACTION ON UPDATE NO ACTION
    );

    CREATE NONCLUSTERED INDEX IDX_Order_InventoryId ON dbo.[Order](inventoryId);
    CREATE NONCLUSTERED INDEX IDX_Order_SerialNumberId ON dbo.[Order](serialNumberId);
    CREATE NONCLUSTERED INDEX IDX_Order_EquipmentId ON dbo.[Order](equipmentId);
    CREATE NONCLUSTERED INDEX IDX_Order_ShelfId ON dbo.[Order](shelfId);
    CREATE NONCLUSTERED INDEX IDX_Order_RoleId ON dbo.[Order](roleId);
    CREATE NONCLUSTERED INDEX IDX_Order_UserId ON dbo.[Order](userId);

    PRINT 'dbo.[Order] table and foreign key indexes created successfully.';
END
ELSE
BEGIN
    PRINT 'dbo.[Order] table already exists.';
END;
