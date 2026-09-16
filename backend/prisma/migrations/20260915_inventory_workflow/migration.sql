-- Alter Inventory table
ALTER TABLE [dbo].[Inventory] ADD 
    [status] VARCHAR(50) NOT NULL CONSTRAINT [DF_Inventory_status] DEFAULT 'DRAFT',
    [cancellationReason] VARCHAR(500) NULL,
    [cutoffVersion] INT NULL CONSTRAINT [DF_Inventory_cutoffVersion] DEFAULT 0,
    [policyVersion] INT NULL CONSTRAINT [DF_Inventory_policyVersion] DEFAULT 1,
    [finalizedAt] DATETIME2 NULL,
    [title] VARCHAR(200) NULL;

-- Alter Inventory_User table
ALTER TABLE [dbo].[Inventory_User] ADD 
    [sequence] INT NOT NULL CONSTRAINT [DF_Inventory_User_sequence] DEFAULT 0,
    [responsibility] VARCHAR(50) NULL,
    [roleSnapshot] VARCHAR(100) NULL;

-- Alter Order table
ALTER TABLE [dbo].[Order] ADD 
    [attemptId] UNIQUEIDENTIFIER NULL,
    [observedEquipmentId] UNIQUEIDENTIFIER NULL,
    [observedShelfId] UNIQUEIDENTIFIER NULL,
    [notes] NVARCHAR(1000) NULL,
    [unknownItemEvidence] NVARCHAR(MAX) NULL;

-- Create InventoryWorkUnit table
CREATE TABLE [dbo].[InventoryWorkUnit] (
    [unitId] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_InventoryWorkUnit_unitId] DEFAULT newid(),
    [inventoryId] UNIQUEIDENTIFIER NOT NULL,
    [equipmentId] UNIQUEIDENTIFIER NULL,
    [shelfId] UNIQUEIDENTIFIER NULL,
    [status] VARCHAR(50) NOT NULL CONSTRAINT [DF_InventoryWorkUnit_status] DEFAULT 'DRAFT',
    [version] INT NOT NULL CONSTRAINT [DF_InventoryWorkUnit_version] DEFAULT 0,
    [coverage] NVARCHAR(MAX) NULL,
    CONSTRAINT [PK_InventoryWorkUnit] PRIMARY KEY CLUSTERED ([unitId])
);

-- Create InventoryCountAttempt table
CREATE TABLE [dbo].[InventoryCountAttempt] (
    [attemptId] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_InventoryCountAttempt_attemptId] DEFAULT newid(),
    [unitId] UNIQUEIDENTIFIER NOT NULL,
    [assignedUserId] UNIQUEIDENTIFIER NOT NULL,
    [sequence] INT NOT NULL CONSTRAINT [DF_InventoryCountAttempt_sequence] DEFAULT 0,
    [purpose] VARCHAR(50) NOT NULL,
    [status] VARCHAR(50) NOT NULL CONSTRAINT [DF_InventoryCountAttempt_status] DEFAULT 'AVAILABLE',
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [DF_InventoryCountAttempt_createdAt] DEFAULT current_timestamp,
    [submittedAt] DATETIME2 NULL,
    [version] INT NOT NULL CONSTRAINT [DF_InventoryCountAttempt_version] DEFAULT 0,
    [linkedPriorAttemptId] UNIQUEIDENTIFIER NULL,
    CONSTRAINT [PK_InventoryCountAttempt] PRIMARY KEY CLUSTERED ([attemptId])
);

-- Create Inventory_Equipment_Shelf_Snapshot table
CREATE TABLE [dbo].[Inventory_Equipment_Shelf_Snapshot] (
    [snapshotId] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_Inventory_Equipment_Shelf_Snapshot_snapshotId] DEFAULT newid(),
    [inventoryId] UNIQUEIDENTIFIER NOT NULL,
    [equipmentId] UNIQUEIDENTIFIER NOT NULL,
    [shelfId] UNIQUEIDENTIFIER NOT NULL,
    [phase] VARCHAR(50) NOT NULL,
    [quantity] INT NOT NULL,
    [provenance] NVARCHAR(1000) NULL,
    [sourceInventoryId] UNIQUEIDENTIFIER NULL,
    [coverage] NVARCHAR(MAX) NULL,
    CONSTRAINT [PK_Inventory_Equipment_Shelf_Snapshot] PRIMARY KEY CLUSTERED ([snapshotId])
);

-- Create InventoryDiscrepancy table
CREATE TABLE [dbo].[InventoryDiscrepancy] (
    [discrepancyId] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_InventoryDiscrepancy_discrepancyId] DEFAULT newid(),
    [inventoryId] UNIQUEIDENTIFIER NOT NULL,
    [unitId] UNIQUEIDENTIFIER NOT NULL,
    [issueType] VARCHAR(100) NOT NULL,
    [state] VARCHAR(50) NOT NULL,
    [reason] NVARCHAR(1000) NULL,
    [actorId] UNIQUEIDENTIFIER NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [DF_InventoryDiscrepancy_createdAt] DEFAULT current_timestamp,
    [resolvedAt] DATETIME2 NULL,
    [beforeData] NVARCHAR(MAX) NULL,
    [afterData] NVARCHAR(MAX) NULL,
    CONSTRAINT [PK_InventoryDiscrepancy] PRIMARY KEY CLUSTERED ([discrepancyId])
);

-- Create InventoryStockAdjustment table
CREATE TABLE [dbo].[InventoryStockAdjustment] (
    [adjustmentId] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_InventoryStockAdjustment_adjustmentId] DEFAULT newid(),
    [inventoryId] UNIQUEIDENTIFIER NOT NULL,
    [reason] NVARCHAR(1000) NULL,
    [approverId] UNIQUEIDENTIFIER NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [DF_InventoryStockAdjustment_createdAt] DEFAULT current_timestamp,
    [batchData] NVARCHAR(MAX) NOT NULL,
    CONSTRAINT [PK_InventoryStockAdjustment] PRIMARY KEY CLUSTERED ([adjustmentId])
);

-- Create Notification table
CREATE TABLE [dbo].[Notification] (
    [notificationId] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_Notification_notificationId] DEFAULT newid(),
    [recipientId] UNIQUEIDENTIFIER NOT NULL,
    [eventType] VARCHAR(100) NOT NULL,
    [payload] NVARCHAR(MAX) NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [DF_Notification_createdAt] DEFAULT current_timestamp,
    [readAt] DATETIME2 NULL,
    CONSTRAINT [PK_Notification] PRIMARY KEY CLUSTERED ([notificationId])
);

-- Add Foreign Keys
ALTER TABLE [dbo].[Order] ADD CONSTRAINT [FK_Order_Attempt] FOREIGN KEY ([attemptId]) REFERENCES [dbo].[InventoryCountAttempt]([attemptId]);

ALTER TABLE [dbo].[InventoryWorkUnit] ADD CONSTRAINT [FK_WorkUnit_Inventory] FOREIGN KEY ([inventoryId]) REFERENCES [dbo].[Inventory]([inventoryId]);

ALTER TABLE [dbo].[InventoryCountAttempt] ADD CONSTRAINT [FK_Attempt_WorkUnit] FOREIGN KEY ([unitId]) REFERENCES [dbo].[InventoryWorkUnit]([unitId]);
ALTER TABLE [dbo].[InventoryCountAttempt] ADD CONSTRAINT [FK_Attempt_User] FOREIGN KEY ([assignedUserId]) REFERENCES [dbo].[User]([userId]);

ALTER TABLE [dbo].[InventoryDiscrepancy] ADD CONSTRAINT [FK_Discrepancy_Inventory] FOREIGN KEY ([inventoryId]) REFERENCES [dbo].[Inventory]([inventoryId]);
ALTER TABLE [dbo].[InventoryDiscrepancy] ADD CONSTRAINT [FK_Discrepancy_WorkUnit] FOREIGN KEY ([unitId]) REFERENCES [dbo].[InventoryWorkUnit]([unitId]);

ALTER TABLE [dbo].[InventoryStockAdjustment] ADD CONSTRAINT [FK_Adjustment_Inventory] FOREIGN KEY ([inventoryId]) REFERENCES [dbo].[Inventory]([inventoryId]);
ALTER TABLE [dbo].[InventoryStockAdjustment] ADD CONSTRAINT [FK_Adjustment_User] FOREIGN KEY ([approverId]) REFERENCES [dbo].[User]([userId]);

ALTER TABLE [dbo].[Notification] ADD CONSTRAINT [FK_Notification_User] FOREIGN KEY ([recipientId]) REFERENCES [dbo].[User]([userId]);
