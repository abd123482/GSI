-- =============================================================================
-- Script: create-inventory-shelf-table.sql
-- Description: Idempotent table and constraint creation for dbo.[Inventory_Shelf]
-- Engine: Microsoft SQL Server (SSMS)
-- =============================================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Inventory_Shelf' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.[Inventory_Shelf] (
        inventoryId UNIQUEIDENTIFIER NOT NULL,
        shelfId UNIQUEIDENTIFIER NOT NULL,

        CONSTRAINT PK_Inventory_Shelf PRIMARY KEY CLUSTERED (inventoryId, shelfId),

        CONSTRAINT FK_Inventory_Shelf_Inventory FOREIGN KEY (inventoryId)
            REFERENCES dbo.[Inventory](inventoryId) ON DELETE NO ACTION ON UPDATE NO ACTION,

        CONSTRAINT FK_Inventory_Shelf_Shelf FOREIGN KEY (shelfId)
            REFERENCES dbo.[Shelf](shelfId) ON DELETE NO ACTION ON UPDATE NO ACTION
    );

    CREATE NONCLUSTERED INDEX IDX_Inventory_Shelf_ShelfId ON dbo.[Inventory_Shelf](shelfId);
    CREATE NONCLUSTERED INDEX IDX_Inventory_Shelf_InventoryId ON dbo.[Inventory_Shelf](inventoryId);

    PRINT 'dbo.[Inventory_Shelf] table and foreign key indexes created successfully.';
END
ELSE
BEGIN
    PRINT 'dbo.[Inventory_Shelf] table already exists.';
END;
