-- Additive Migration for Inventory Workflow V2: Three-Controller Full-Recount Architecture

-- 1. Alter Inventory table
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Inventory]') AND name = 'finalResultSource')
BEGIN
    ALTER TABLE [dbo].[Inventory] ADD [finalResultSource] VARCHAR(50) NULL;
END;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Inventory]') AND name = 'thirdCountRequired')
BEGIN
    ALTER TABLE [dbo].[Inventory] ADD [thirdCountRequired] BIT NOT NULL CONSTRAINT [DF_Inventory_thirdCountRequired] DEFAULT 0;
END;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Inventory]') AND name = 'launchedAt')
BEGIN
    ALTER TABLE [dbo].[Inventory] ADD [launchedAt] DATETIME2 NULL;
END;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Inventory]') AND name = 'creatorId')
BEGIN
    ALTER TABLE [dbo].[Inventory] ADD [creatorId] UNIQUEIDENTIFIER NULL;
END;

-- 2. Alter InventoryWorkUnit table
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[InventoryWorkUnit]') AND name = 'unitOrder')
BEGIN
    ALTER TABLE [dbo].[InventoryWorkUnit] ADD [unitOrder] INT NOT NULL CONSTRAINT [DF_InventoryWorkUnit_unitOrder] DEFAULT 0;
END;

-- 3. Alter InventoryCountAttempt table
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[InventoryCountAttempt]') AND name = 'draftData')
BEGIN
    ALTER TABLE [dbo].[InventoryCountAttempt] ADD [draftData] NVARCHAR(MAX) NULL;
END;

-- 4. Alter Order table
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Order]') AND name = 'scannedSerialCode')
BEGIN
    ALTER TABLE [dbo].[Order] ADD [scannedSerialCode] VARCHAR(200) NULL;
END;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Order]') AND name = 'isExplicitZero')
BEGIN
    ALTER TABLE [dbo].[Order] ADD [isExplicitZero] BIT NOT NULL CONSTRAINT [DF_Order_isExplicitZero] DEFAULT 0;
END;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Order]') AND name = 'isUnexpected')
BEGIN
    ALTER TABLE [dbo].[Order] ADD [isUnexpected] BIT NOT NULL CONSTRAINT [DF_Order_isUnexpected] DEFAULT 0;
END;

-- 5. Alter Mouvement table (keep legacy timestamps unknown/NULL)
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Mouvement]') AND name = 'createdAt')
BEGIN
    ALTER TABLE [dbo].[Mouvement] ADD [createdAt] DATETIME2 NULL CONSTRAINT [DF_Mouvement_createdAt] DEFAULT sysdatetime();
END;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Mouvement]') AND name = 'createdByUserId')
BEGIN
    ALTER TABLE [dbo].[Mouvement] ADD [createdByUserId] UNIQUEIDENTIFIER NULL;
END;

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[Mouvement]') AND name = 'IDX_Mouvement_CreatedAt')
BEGIN
    CREATE INDEX [IDX_Mouvement_CreatedAt] ON [dbo].[Mouvement]([createdAt]);
END;

IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE object_id = OBJECT_ID(N'[dbo].[FK_Mouvement_CreatedByUser]'))
BEGIN
    ALTER TABLE [dbo].[Mouvement] ADD CONSTRAINT [FK_Mouvement_CreatedByUser] FOREIGN KEY ([createdByUserId]) REFERENCES [dbo].[User]([userId]) ON DELETE NO ACTION ON UPDATE NO ACTION;
END;

-- 6. Create Inventory_SerialNumber_Snapshot table
IF OBJECT_ID(N'[dbo].[Inventory_SerialNumber_Snapshot]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[Inventory_SerialNumber_Snapshot] (
        [snapshotId] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_Inventory_SerialNumber_Snapshot_snapshotId] DEFAULT newid(),
        [inventoryId] UNIQUEIDENTIFIER NOT NULL,
        [phase] VARCHAR(50) NOT NULL,
        [serialNumberId] UNIQUEIDENTIFIER NULL,
        [serialNumberCode] VARCHAR(200) NOT NULL,
        [equipmentId] UNIQUEIDENTIFIER NOT NULL,
        [shelfId] UNIQUEIDENTIFIER NULL,
        [serialNumberStatus] VARCHAR(100) NULL,
        [provenance] NVARCHAR(1000) NULL,
        [sourceInventoryId] UNIQUEIDENTIFIER NULL,
        [createdAt] DATETIME2 NOT NULL CONSTRAINT [DF_Inventory_SerialNumber_Snapshot_createdAt] DEFAULT sysdatetime(),
        CONSTRAINT [PK_Inventory_SerialNumber_Snapshot] PRIMARY KEY CLUSTERED ([snapshotId])
    );
END;

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[Inventory_SerialNumber_Snapshot]') AND name = 'IDX_SnSnapshot_InventoryId')
BEGIN
    CREATE INDEX [IDX_SnSnapshot_InventoryId] ON [dbo].[Inventory_SerialNumber_Snapshot]([inventoryId]);
END;

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[Inventory_SerialNumber_Snapshot]') AND name = 'IDX_SnSnapshot_EquipmentId')
BEGIN
    CREATE INDEX [IDX_SnSnapshot_EquipmentId] ON [dbo].[Inventory_SerialNumber_Snapshot]([equipmentId]);
END;

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[Inventory_SerialNumber_Snapshot]') AND name = 'IDX_SnSnapshot_SerialCode')
BEGIN
    CREATE INDEX [IDX_SnSnapshot_SerialCode] ON [dbo].[Inventory_SerialNumber_Snapshot]([serialNumberCode]);
END;

IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE object_id = OBJECT_ID(N'[dbo].[FK_SnSnapshot_Inventory]'))
BEGIN
    ALTER TABLE [dbo].[Inventory_SerialNumber_Snapshot] ADD CONSTRAINT [FK_SnSnapshot_Inventory] FOREIGN KEY ([inventoryId]) REFERENCES [dbo].[Inventory]([inventoryId]) ON DELETE NO ACTION ON UPDATE NO ACTION;
END;

IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE object_id = OBJECT_ID(N'[dbo].[FK_SnSnapshot_Equipment]'))
BEGIN
    ALTER TABLE [dbo].[Inventory_SerialNumber_Snapshot] ADD CONSTRAINT [FK_SnSnapshot_Equipment] FOREIGN KEY ([equipmentId]) REFERENCES [dbo].[Equipment]([equipmentId]) ON DELETE NO ACTION ON UPDATE NO ACTION;
END;

IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE object_id = OBJECT_ID(N'[dbo].[FK_SnSnapshot_Shelf]'))
BEGIN
    ALTER TABLE [dbo].[Inventory_SerialNumber_Snapshot] ADD CONSTRAINT [FK_SnSnapshot_Shelf] FOREIGN KEY ([shelfId]) REFERENCES [dbo].[Shelf]([shelfId]) ON DELETE NO ACTION ON UPDATE NO ACTION;
END;

-- 7. Create InventoryInvestigationIssue table
IF OBJECT_ID(N'[dbo].[InventoryInvestigationIssue]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[InventoryInvestigationIssue] (
        [issueId] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_InventoryInvestigationIssue_issueId] DEFAULT newid(),
        [inventoryId] UNIQUEIDENTIFIER NOT NULL,
        [issueType] VARCHAR(100) NOT NULL,
        [status] VARCHAR(50) NOT NULL CONSTRAINT [DF_InventoryInvestigationIssue_status] DEFAULT 'OPEN',
        [equipmentId] UNIQUEIDENTIFIER NULL,
        [serialNumberId] UNIQUEIDENTIFIER NULL,
        [serialNumberCode] VARCHAR(200) NULL,
        [expectedShelfId] UNIQUEIDENTIFIER NULL,
        [finalObservedShelfId] UNIQUEIDENTIFIER NULL,
        [expectedQuantity] INT NULL,
        [finalQuantity] INT NULL,
        [deltaQuantity] INT NULL,
        [movementExplanation] VARCHAR(100) NULL,
        [resolutionType] VARCHAR(100) NULL,
        [resolutionShelfId] UNIQUEIDENTIFIER NULL,
        [resolutionNotes] NVARCHAR(1000) NULL,
        [resolvedByUserId] UNIQUEIDENTIFIER NULL,
        [resolvedAt] DATETIME2 NULL,
        [createdAt] DATETIME2 NOT NULL CONSTRAINT [DF_InventoryInvestigationIssue_createdAt] DEFAULT sysdatetime(),
        CONSTRAINT [PK_InventoryInvestigationIssue] PRIMARY KEY CLUSTERED ([issueId])
    );
END;

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[InventoryInvestigationIssue]') AND name = 'IDX_InvIssue_InventoryId')
BEGIN
    CREATE INDEX [IDX_InvIssue_InventoryId] ON [dbo].[InventoryInvestigationIssue]([inventoryId]);
END;

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[InventoryInvestigationIssue]') AND name = 'IDX_InvIssue_Status')
BEGIN
    CREATE INDEX [IDX_InvIssue_Status] ON [dbo].[InventoryInvestigationIssue]([status]);
END;

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[InventoryInvestigationIssue]') AND name = 'IDX_InvIssue_EquipmentId')
BEGIN
    CREATE INDEX [IDX_InvIssue_EquipmentId] ON [dbo].[InventoryInvestigationIssue]([equipmentId]);
END;

IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE object_id = OBJECT_ID(N'[dbo].[FK_InvIssue_Inventory]'))
BEGIN
    ALTER TABLE [dbo].[InventoryInvestigationIssue] ADD CONSTRAINT [FK_InvIssue_Inventory] FOREIGN KEY ([inventoryId]) REFERENCES [dbo].[Inventory]([inventoryId]) ON DELETE NO ACTION ON UPDATE NO ACTION;
END;

IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE object_id = OBJECT_ID(N'[dbo].[FK_InvIssue_Equipment]'))
BEGIN
    ALTER TABLE [dbo].[InventoryInvestigationIssue] ADD CONSTRAINT [FK_InvIssue_Equipment] FOREIGN KEY ([equipmentId]) REFERENCES [dbo].[Equipment]([equipmentId]) ON DELETE NO ACTION ON UPDATE NO ACTION;
END;

IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE object_id = OBJECT_ID(N'[dbo].[FK_InvIssue_SerialNumber]'))
BEGIN
    ALTER TABLE [dbo].[InventoryInvestigationIssue] ADD CONSTRAINT [FK_InvIssue_SerialNumber] FOREIGN KEY ([serialNumberId]) REFERENCES [dbo].[SerialNumber]([serialNumberId]) ON DELETE NO ACTION ON UPDATE NO ACTION;
END;

IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE object_id = OBJECT_ID(N'[dbo].[FK_InvIssue_ExpectedShelf]'))
BEGIN
    ALTER TABLE [dbo].[InventoryInvestigationIssue] ADD CONSTRAINT [FK_InvIssue_ExpectedShelf] FOREIGN KEY ([expectedShelfId]) REFERENCES [dbo].[Shelf]([shelfId]) ON DELETE NO ACTION ON UPDATE NO ACTION;
END;

IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE object_id = OBJECT_ID(N'[dbo].[FK_InvIssue_ObservedShelf]'))
BEGIN
    ALTER TABLE [dbo].[InventoryInvestigationIssue] ADD CONSTRAINT [FK_InvIssue_ObservedShelf] FOREIGN KEY ([finalObservedShelfId]) REFERENCES [dbo].[Shelf]([shelfId]) ON DELETE NO ACTION ON UPDATE NO ACTION;
END;

IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE object_id = OBJECT_ID(N'[dbo].[FK_InvIssue_ResolutionShelf]'))
BEGIN
    ALTER TABLE [dbo].[InventoryInvestigationIssue] ADD CONSTRAINT [FK_InvIssue_ResolutionShelf] FOREIGN KEY ([resolutionShelfId]) REFERENCES [dbo].[Shelf]([shelfId]) ON DELETE NO ACTION ON UPDATE NO ACTION;
END;

IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE object_id = OBJECT_ID(N'[dbo].[FK_InvIssue_User]'))
BEGIN
    ALTER TABLE [dbo].[InventoryInvestigationIssue] ADD CONSTRAINT [FK_InvIssue_User] FOREIGN KEY ([resolvedByUserId]) REFERENCES [dbo].[User]([userId]) ON DELETE NO ACTION ON UPDATE NO ACTION;
END;
