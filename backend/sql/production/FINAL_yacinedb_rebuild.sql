/*
  SOMIPHARM FINAL YACINEDB REBUILD
  ===============================

  IMPORTANT:
  - Generated only after isolated DB validation.
  - Intended for the currently EMPTY yacinedb.
  - Does not DROP the database.
  - Do not execute until the final production rebuild step.
*/

USE [yacinedb];
GO

/* ============================================================
   1. CURRENT PRISMA CORE SCHEMA
   ============================================================ */

BEGIN TRY

BEGIN TRAN;

-- CreateSchema
IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = N'dbo') EXEC sp_executesql N'CREATE SCHEMA [dbo];';

-- CreateTable
CREATE TABLE [dbo].[Role] (
    [roleId] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF__Role__roleId__43A1090D] DEFAULT newid(),
    [roleName] VARCHAR(100) NOT NULL,
    CONSTRAINT [PK_Role] PRIMARY KEY CLUSTERED ([roleId])
);

-- CreateTable
CREATE TABLE [dbo].[Permission] (
    [permissionId] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF__Permissio__permi__4C364F0E] DEFAULT newid(),
    [permissionName] VARCHAR(200) NOT NULL,
    [roleId] UNIQUEIDENTIFIER,
    CONSTRAINT [PK_Permission] PRIMARY KEY CLUSTERED ([permissionId])
);

-- CreateTable
CREATE TABLE [dbo].[User] (
    [userId] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF__User__userId__467D75B8] DEFAULT newid(),
    [userName] VARCHAR(50) NOT NULL CONSTRAINT [DF__User__userName__477199F1] DEFAULT 'yacine',
    [userEmail] VARCHAR(100) NOT NULL,
    [hashPassword] VARCHAR(255),
    [roleId] UNIQUEIDENTIFIER,
    [userStatus] VARCHAR(50) NOT NULL CONSTRAINT [DF__User__userStatus__4865BE2A] DEFAULT 'ACTIVE',
    [clerkUserId] VARCHAR(255),
    CONSTRAINT [PK_User] PRIMARY KEY CLUSTERED ([userId])
);

-- CreateTable
CREATE TABLE [dbo].[Session] (
    [sessionId] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF__Session__session__5006DFF2] DEFAULT newid(),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [DF__Session__created__50FB042B] DEFAULT sysdatetime(),
    [expiresAt] DATETIME2 NOT NULL,
    [userId] UNIQUEIDENTIFIER NOT NULL,
    CONSTRAINT [PK_Session] PRIMARY KEY CLUSTERED ([sessionId])
);

-- CreateTable
CREATE TABLE [dbo].[Equipment] (
    [equipmentId] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF__Equipment__equip__1E6F845E] DEFAULT newid(),
    [equipmentName] VARCHAR(200) NOT NULL,
    [hasSerialNumber] BIT NOT NULL,
    [equipmentQuantity] INT NOT NULL,
    [minequipmentQuantity] INT NOT NULL CONSTRAINT [DF__Equipment__mineq__1F63A897] DEFAULT 0,
    [equipmentStatus] VARCHAR(30) NOT NULL CONSTRAINT [DF_Equipment_EquipmentStatus] DEFAULT 'ACTIVE',
    [equipmentShelfId] UNIQUEIDENTIFIER,
    CONSTRAINT [PK_Equipment] PRIMARY KEY CLUSTERED ([equipmentId]),
    CONSTRAINT [UX_Equipment_EquipmentId] UNIQUE NONCLUSTERED ([equipmentId]),
    CONSTRAINT [UX_Equipment_EquipmentName] UNIQUE NONCLUSTERED ([equipmentName])
);

-- CreateTable
CREATE TABLE [dbo].[SerialNumber] (
    [serialNumberId] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF__SerialNum__seria__22401542] DEFAULT newid(),
    [serialNumberCode] VARCHAR(200) NOT NULL,
    [serialNumberStatus] VARCHAR(100) NOT NULL CONSTRAINT [DF_SerialNumber_Status] DEFAULT 'AVAILABLE',
    [equipmentId] UNIQUEIDENTIFIER NOT NULL,
    [shelfId] UNIQUEIDENTIFIER,
    CONSTRAINT [PK_SerialNumber] PRIMARY KEY CLUSTERED ([serialNumberId]),
    CONSTRAINT [UX_SerialNumber_Code] UNIQUE NONCLUSTERED ([serialNumberCode])
);

-- CreateTable
CREATE TABLE [dbo].[Shelf] (
    [shelfId] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF__Shelf__shelfId__29E1370A] DEFAULT newid(),
    [shelfName] VARCHAR(100),
    [shelfQuantity] INT NOT NULL CONSTRAINT [DF_Shelf_ShelfQuantity] DEFAULT 0,
    [stockId] UNIQUEIDENTIFIER NOT NULL,
    CONSTRAINT [PK_Shelf] PRIMARY KEY CLUSTERED ([shelfId])
);

-- CreateTable
CREATE TABLE [dbo].[StockStatus] (
    [stockStatusId] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF__StockStat__stock__7073AF84] DEFAULT newid(),
    [stockStatusName] VARCHAR(50) NOT NULL,
    CONSTRAINT [PK__StockSta__EC5FDC3570BCF5AF] PRIMARY KEY CLUSTERED ([stockStatusId]),
    CONSTRAINT [UQ__StockSta__E053D81017965D3C] UNIQUE NONCLUSTERED ([stockStatusName])
);

-- CreateTable
CREATE TABLE [dbo].[Stock] (
    [stockId] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF__Stock__stockId__69C6B1F5] DEFAULT newid(),
    [stockName] VARCHAR(100),
    [stockStatusId] UNIQUEIDENTIFIER NOT NULL,
    CONSTRAINT [PK__Stock__CBAD876353C2F93A] PRIMARY KEY CLUSTERED ([stockId])
);

-- CreateTable
CREATE TABLE [dbo].[Mouvement] (
    [mouvementId] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF__Mouvement__mouve__2DB1C7EE] DEFAULT newid(),
    [mouvementStatus] VARCHAR(50),
    [movementQuantity] INT,
    [equipmentId] UNIQUEIDENTIFIER,
    [sourceShelfId] UNIQUEIDENTIFIER,
    [destinationShelfId] UNIQUEIDENTIFIER,
    [serialNumberId] UNIQUEIDENTIFIER,
    [createdAt] DATETIME2 CONSTRAINT [Mouvement_createdAt_df] DEFAULT sysdatetime(),
    [createdByUserId] UNIQUEIDENTIFIER,
    [inventoryId] UNIQUEIDENTIFIER,
    [origin] VARCHAR(30) NOT NULL CONSTRAINT [DF_Mouvement_Origin] DEFAULT 'USER',
    [reason] NVARCHAR(1000),
    CONSTRAINT [mouvementId] PRIMARY KEY CLUSTERED ([mouvementId])
);

-- CreateTable
CREATE TABLE [dbo].[EquipmentShelfs] (
    [equipmentShelfId] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF__Equipment__equip__2610A626] DEFAULT newid(),
    [equipmentQuantity] INT NOT NULL CONSTRAINT [DF_EquipmentShelfs_Quantity] DEFAULT 0,
    [equipmentId] UNIQUEIDENTIFIER NOT NULL,
    [shelfId] UNIQUEIDENTIFIER NOT NULL,
    CONSTRAINT [PK_EquipmentShelfs] PRIMARY KEY CLUSTERED ([equipmentShelfId]),
    CONSTRAINT [UX_EquipmentShelfs_Equipment_Shelf] UNIQUE NONCLUSTERED ([equipmentId],[shelfId])
);

-- CreateTable
CREATE TABLE [dbo].[EqipmentMouvements] (
    [equipmentMouvementsId] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF__EqipmentM__equip__318258D2] DEFAULT newid(),
    [equipmentQuantity] INT,
    [equipmentId] UNIQUEIDENTIFIER,
    [shelfId] UNIQUEIDENTIFIER,
    CONSTRAINT [PK_EqipmentMouvements] PRIMARY KEY CLUSTERED ([equipmentMouvementsId])
);

-- CreateTable
CREATE TABLE [dbo].[Inventory] (
    [inventoryId] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF__Inventory__inven__7AF13DF7] DEFAULT newid(),
    [typeInventory] VARCHAR(50),
    [createdAt] DATETIME2 CONSTRAINT [DF__Inventory__creat__7BE56230] DEFAULT CURRENT_TIMESTAMP,
    [parentInventoryId] UNIQUEIDENTIFIER,
    [status] VARCHAR(50) NOT NULL CONSTRAINT [Inventory_status_df] DEFAULT 'DRAFT',
    [cancellationReason] VARCHAR(500),
    [cutoffVersion] INT CONSTRAINT [Inventory_cutoffVersion_df] DEFAULT 0,
    [policyVersion] INT CONSTRAINT [Inventory_policyVersion_df] DEFAULT 1,
    [finalizedAt] DATETIME2,
    [title] VARCHAR(200),
    [finalResultSource] VARCHAR(50),
    [thirdCountRequired] BIT NOT NULL CONSTRAINT [Inventory_thirdCountRequired_df] DEFAULT 0,
    [launchedAt] DATETIME2,
    [creatorId] UNIQUEIDENTIFIER,
    [adjustmentApproverId] UNIQUEIDENTIFIER,
    [adjustmentReason] NVARCHAR(1000),
    [adjustmentBatchData] NVARCHAR(max),
    [equipmentScopeIds] NVARCHAR(max),
    [shelfScopeIds] NVARCHAR(max),
    CONSTRAINT [PK__Inventor__C4B7BC02CCF87E0E] PRIMARY KEY CLUSTERED ([inventoryId])
);

-- CreateTable
CREATE TABLE [dbo].[Inventory_User] (
    [inventoryId] UNIQUEIDENTIFIER NOT NULL,
    [userId] UNIQUEIDENTIFIER NOT NULL,
    [sequence] INT NOT NULL CONSTRAINT [Inventory_User_sequence_df] DEFAULT 0,
    [responsibility] VARCHAR(50),
    [roleSnapshot] VARCHAR(100),
    CONSTRAINT [PK__Inventor__280E1DCDF3168EB2] PRIMARY KEY CLUSTERED ([inventoryId],[userId]),
    CONSTRAINT [UX_Inventory_User_Inventory_Sequence] UNIQUE NONCLUSTERED ([inventoryId],[sequence])
);

-- CreateTable
CREATE TABLE [dbo].[sysdiagrams] (
    [name] NVARCHAR(128) NOT NULL,
    [principal_id] INT NOT NULL,
    [diagram_id] INT NOT NULL IDENTITY(1,1),
    [version] INT,
    [definition] VARBINARY(max),
    CONSTRAINT [PK__sysdiagr__C2B05B613770EED4] PRIMARY KEY CLUSTERED ([diagram_id]),
    CONSTRAINT [UK_principal_name] UNIQUE NONCLUSTERED ([principal_id],[name])
);

-- CreateTable
CREATE TABLE [dbo].[Order] (
    [orderId] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [Order_orderId_df] DEFAULT newid(),
    [inventoryId] UNIQUEIDENTIFIER,
    [serialNumberId] UNIQUEIDENTIFIER,
    [scannedSerialCode] VARCHAR(200),
    [equipmentId] UNIQUEIDENTIFIER,
    [shelfId] UNIQUEIDENTIFIER,
    [roleId] UNIQUEIDENTIFIER,
    [userId] UNIQUEIDENTIFIER,
    [quantityCalculated] INT,
    [isExplicitZero] BIT NOT NULL CONSTRAINT [Order_isExplicitZero_df] DEFAULT 0,
    [isUnexpected] BIT NOT NULL CONSTRAINT [Order_isUnexpected_df] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Order_createdAt_df] DEFAULT sysdatetime(),
    [attemptId] UNIQUEIDENTIFIER,
    [observedEquipmentId] UNIQUEIDENTIFIER,
    [observedShelfId] UNIQUEIDENTIFIER,
    [notes] NVARCHAR(1000),
    [unknownItemEvidence] NVARCHAR(max),
    CONSTRAINT [PK_Order] PRIMARY KEY CLUSTERED ([orderId])
);

-- CreateTable
CREATE TABLE [dbo].[InventoryWorkUnit] (
    [unitId] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [InventoryWorkUnit_unitId_df] DEFAULT newid(),
    [inventoryId] UNIQUEIDENTIFIER NOT NULL,
    [equipmentId] UNIQUEIDENTIFIER,
    [shelfId] UNIQUEIDENTIFIER,
    [unitOrder] INT NOT NULL CONSTRAINT [InventoryWorkUnit_unitOrder_df] DEFAULT 0,
    [status] VARCHAR(50) NOT NULL CONSTRAINT [InventoryWorkUnit_status_df] DEFAULT 'DRAFT',
    [version] INT NOT NULL CONSTRAINT [InventoryWorkUnit_version_df] DEFAULT 0,
    [coverage] NVARCHAR(max),
    [reconciliationStatus] VARCHAR(30) NOT NULL CONSTRAINT [DF_InventoryWorkUnit_ReconciliationStatus] DEFAULT 'PENDING',
    [acceptedAttemptId] UNIQUEIDENTIFIER,
    [reconciledAt] DATETIME2,
    [discrepancyType] VARCHAR(100),
    [discrepancyState] VARCHAR(50),
    [discrepancyBeforeData] NVARCHAR(max),
    [discrepancyAfterData] NVARCHAR(max),
    [discrepancyActorId] UNIQUEIDENTIFIER,
    [discrepancyReason] NVARCHAR(1000),
    CONSTRAINT [InventoryWorkUnit_pkey] PRIMARY KEY CLUSTERED ([unitId])
);

-- CreateTable
CREATE TABLE [dbo].[InventoryCountAttempt] (
    [attemptId] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [InventoryCountAttempt_attemptId_df] DEFAULT newid(),
    [unitId] UNIQUEIDENTIFIER NOT NULL,
    [assignedUserId] UNIQUEIDENTIFIER NOT NULL,
    [sequence] INT NOT NULL CONSTRAINT [InventoryCountAttempt_sequence_df] DEFAULT 0,
    [purpose] VARCHAR(50) NOT NULL,
    [status] VARCHAR(50) NOT NULL CONSTRAINT [InventoryCountAttempt_status_df] DEFAULT 'AVAILABLE',
    [draftData] NVARCHAR(max),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [InventoryCountAttempt_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [submittedAt] DATETIME2,
    [version] INT NOT NULL CONSTRAINT [InventoryCountAttempt_version_df] DEFAULT 0,
    [linkedPriorAttemptId] UNIQUEIDENTIFIER,
    CONSTRAINT [InventoryCountAttempt_pkey] PRIMARY KEY CLUSTERED ([attemptId]),
    CONSTRAINT [UX_InventoryCountAttempt_Unit_Sequence] UNIQUE NONCLUSTERED ([unitId],[sequence])
);

-- CreateTable
CREATE TABLE [dbo].[Inventory_Equipment_Shelf_Snapshot] (
    [snapshotId] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [Inventory_Equipment_Shelf_Snapshot_snapshotId_df] DEFAULT newid(),
    [inventoryId] UNIQUEIDENTIFIER NOT NULL,
    [equipmentId] UNIQUEIDENTIFIER NOT NULL,
    [shelfId] UNIQUEIDENTIFIER NOT NULL,
    [phase] VARCHAR(50) NOT NULL,
    [quantity] INT NOT NULL,
    [provenance] NVARCHAR(1000),
    [sourceInventoryId] UNIQUEIDENTIFIER,
    [coverage] NVARCHAR(max),
    CONSTRAINT [Inventory_Equipment_Shelf_Snapshot_pkey] PRIMARY KEY CLUSTERED ([snapshotId])
);

-- CreateTable
CREATE TABLE [dbo].[Inventory_SerialNumber_Snapshot] (
    [snapshotId] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [Inventory_SerialNumber_Snapshot_snapshotId_df] DEFAULT newid(),
    [inventoryId] UNIQUEIDENTIFIER NOT NULL,
    [phase] VARCHAR(50) NOT NULL,
    [serialNumberId] UNIQUEIDENTIFIER,
    [serialNumberCode] VARCHAR(200) NOT NULL,
    [equipmentId] UNIQUEIDENTIFIER NOT NULL,
    [shelfId] UNIQUEIDENTIFIER,
    [serialNumberStatus] VARCHAR(100),
    [provenance] NVARCHAR(1000),
    [sourceInventoryId] UNIQUEIDENTIFIER,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Inventory_SerialNumber_Snapshot_createdAt_df] DEFAULT sysdatetime(),
    CONSTRAINT [Inventory_SerialNumber_Snapshot_pkey] PRIMARY KEY CLUSTERED ([snapshotId])
);

-- CreateTable
CREATE TABLE [dbo].[InventoryInvestigationIssue] (
    [issueId] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [InventoryInvestigationIssue_issueId_df] DEFAULT newid(),
    [inventoryId] UNIQUEIDENTIFIER NOT NULL,
    [issueType] VARCHAR(100) NOT NULL,
    [status] VARCHAR(50) NOT NULL CONSTRAINT [InventoryInvestigationIssue_status_df] DEFAULT 'OPEN',
    [equipmentId] UNIQUEIDENTIFIER,
    [serialNumberId] UNIQUEIDENTIFIER,
    [serialNumberCode] VARCHAR(200),
    [expectedShelfId] UNIQUEIDENTIFIER,
    [finalObservedShelfId] UNIQUEIDENTIFIER,
    [expectedQuantity] INT,
    [finalQuantity] INT,
    [deltaQuantity] INT,
    [movementExplanation] VARCHAR(100),
    [resolutionType] VARCHAR(100),
    [resolutionShelfId] UNIQUEIDENTIFIER,
    [resolutionNotes] NVARCHAR(1000),
    [resolvedByUserId] UNIQUEIDENTIFIER,
    [resolvedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [InventoryInvestigationIssue_createdAt_df] DEFAULT sysdatetime(),
    CONSTRAINT [InventoryInvestigationIssue_pkey] PRIMARY KEY CLUSTERED ([issueId])
);

-- CreateTable
CREATE TABLE [dbo].[Notification] (
    [notificationId] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [Notification_notificationId_df] DEFAULT newid(),
    [recipientId] UNIQUEIDENTIFIER NOT NULL,
    [eventType] VARCHAR(100) NOT NULL,
    [payload] NVARCHAR(max),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Notification_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [readAt] DATETIME2,
    CONSTRAINT [Notification_pkey] PRIMARY KEY CLUSTERED ([notificationId])
);

-- CreateTable
CREATE TABLE [dbo].[MovementEquipment] (
    [movementEquipmentId] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [MovementEquipment_movementEquipmentId_df] DEFAULT newid(),
    [movementId] UNIQUEIDENTIFIER NOT NULL,
    [equipmentId] UNIQUEIDENTIFIER NOT NULL,
    [RowNum] INT NOT NULL,
    [sourceShelfId] UNIQUEIDENTIFIER,
    [destinationShelfId] UNIQUEIDENTIFIER,
    [serialNumberId] UNIQUEIDENTIFIER,
    [equipmentQuantity] INT NOT NULL,
    [movementStatus] VARCHAR(50) NOT NULL,
    [equipmentTypeSnapshot] VARCHAR(20) NOT NULL CONSTRAINT [DF_MovementEquipment_TypeSnapshot] DEFAULT 'STANDARD',
    CONSTRAINT [MovementEquipment_pkey] PRIMARY KEY CLUSTERED ([movementEquipmentId]),
    CONSTRAINT [UX_MovementEquipment_Movement_RowNum] UNIQUE NONCLUSTERED ([movementId],[RowNum])
);

-- CreateIndex
CREATE UNIQUE NONCLUSTERED INDEX [idx_user_clerkUserId_unique] ON [dbo].[User]([clerkUserId]) WHERE ([clerkUserId] IS NOT NULL);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IDX_Equipment_EquipmentId] ON [dbo].[Equipment]([equipmentId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IDX_Equipment_EquipmentName] ON [dbo].[Equipment]([equipmentName]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IDX_Equipment_EquipmentShelfId] ON [dbo].[Equipment]([equipmentShelfId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IDX_Equipment_HasSerialNumber] ON [dbo].[Equipment]([hasSerialNumber]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IDX_Equipment_MinEquipmentQuantity] ON [dbo].[Equipment]([minequipmentQuantity]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_Equipment_EquipmentName] ON [dbo].[Equipment]([equipmentName]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_Equipment_Status] ON [dbo].[Equipment]([equipmentStatus]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IDX_SerialNumber_SerialNumberCode] ON [dbo].[SerialNumber]([serialNumberCode]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IDX_SerialNumber_SerialNumberId] ON [dbo].[SerialNumber]([serialNumberId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_SerialNumber_Equipment_Shelf] ON [dbo].[SerialNumber]([equipmentId], [shelfId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_SerialNumber_ShelfId] ON [dbo].[SerialNumber]([shelfId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_SerialNumber_Status] ON [dbo].[SerialNumber]([serialNumberStatus]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [INDEX_Shelf_ShelfId] ON [dbo].[Shelf]([shelfId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [INDEX_Shelf_ShelfName] ON [dbo].[Shelf]([shelfName]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [INDEX_Shelf_ShelfQuantity] ON [dbo].[Shelf]([shelfQuantity]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_Shelf_StockId] ON [dbo].[Shelf]([stockId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Stock_StockId] ON [dbo].[Stock]([stockId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Stock_StockName] ON [dbo].[Stock]([stockName]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_Stock_StockStatusId] ON [dbo].[Stock]([stockStatusId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IDX_Mouvement_EquipmentId] ON [dbo].[Mouvement]([equipmentId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_Mouvement_CreatedAt_Id] ON [dbo].[Mouvement]([createdAt], [mouvementId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_Mouvement_Status] ON [dbo].[Mouvement]([mouvementStatus]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_Mouvement_InventoryId] ON [dbo].[Mouvement]([inventoryId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_EquipmentShelfs_EquipmentId] ON [dbo].[EquipmentShelfs]([equipmentId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_EquipmentShelfs_ShelfId] ON [dbo].[EquipmentShelfs]([shelfId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_Inventory_Status] ON [dbo].[Inventory]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IDX_Order_EquipmentId] ON [dbo].[Order]([equipmentId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IDX_Order_InventoryId] ON [dbo].[Order]([inventoryId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IDX_Order_RoleId] ON [dbo].[Order]([roleId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IDX_Order_SerialNumberId] ON [dbo].[Order]([serialNumberId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IDX_Order_ShelfId] ON [dbo].[Order]([shelfId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IDX_Order_UserId] ON [dbo].[Order]([userId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IDX_Order_AttemptId] ON [dbo].[Order]([attemptId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IDX_WorkUnit_InventoryId] ON [dbo].[InventoryWorkUnit]([inventoryId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_InventoryWorkUnit_Equipment_Inventory] ON [dbo].[InventoryWorkUnit]([equipmentId], [inventoryId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_InventoryWorkUnit_Shelf_Inventory] ON [dbo].[InventoryWorkUnit]([shelfId], [inventoryId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_InventoryWorkUnit_Reconciliation] ON [dbo].[InventoryWorkUnit]([inventoryId], [reconciliationStatus]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IDX_Attempt_UnitId] ON [dbo].[InventoryCountAttempt]([unitId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IDX_Attempt_UserId] ON [dbo].[InventoryCountAttempt]([assignedUserId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IDX_Snapshot_InventoryId] ON [dbo].[Inventory_Equipment_Shelf_Snapshot]([inventoryId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IDX_Snapshot_Eq_Shelf] ON [dbo].[Inventory_Equipment_Shelf_Snapshot]([equipmentId], [shelfId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IDX_SnSnapshot_InventoryId] ON [dbo].[Inventory_SerialNumber_Snapshot]([inventoryId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IDX_SnSnapshot_EquipmentId] ON [dbo].[Inventory_SerialNumber_Snapshot]([equipmentId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IDX_SnSnapshot_SerialCode] ON [dbo].[Inventory_SerialNumber_Snapshot]([serialNumberCode]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IDX_InvIssue_InventoryId] ON [dbo].[InventoryInvestigationIssue]([inventoryId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IDX_InvIssue_Status] ON [dbo].[InventoryInvestigationIssue]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IDX_InvIssue_EquipmentId] ON [dbo].[InventoryInvestigationIssue]([equipmentId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IDX_Notification_RecipientId] ON [dbo].[Notification]([recipientId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IDX_Notification_CreatedAt] ON [dbo].[Notification]([createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_MovementEquipment_MovementId] ON [dbo].[MovementEquipment]([movementId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_MovementEquipment_EquipmentId] ON [dbo].[MovementEquipment]([equipmentId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_MovementEquipment_Status] ON [dbo].[MovementEquipment]([movementStatus]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_MovementEquipment_SourceShelfId] ON [dbo].[MovementEquipment]([sourceShelfId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_MovementEquipment_DestinationShelfId] ON [dbo].[MovementEquipment]([destinationShelfId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_MovementEquipment_SerialNumberId] ON [dbo].[MovementEquipment]([serialNumberId]);

-- AddForeignKey
ALTER TABLE [dbo].[Permission] ADD CONSTRAINT [FK_Permission_Role] FOREIGN KEY ([roleId]) REFERENCES [dbo].[Role]([roleId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[User] ADD CONSTRAINT [FK_User_Role] FOREIGN KEY ([roleId]) REFERENCES [dbo].[Role]([roleId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Session] ADD CONSTRAINT [FK_Session_User] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([userId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SerialNumber] ADD CONSTRAINT [FK_SerialNumber_Equipment] FOREIGN KEY ([equipmentId]) REFERENCES [dbo].[Equipment]([equipmentId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SerialNumber] ADD CONSTRAINT [FK_SerialNumber_Shelf] FOREIGN KEY ([shelfId]) REFERENCES [dbo].[Shelf]([shelfId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Shelf] ADD CONSTRAINT [FK_Shelf_Stock] FOREIGN KEY ([stockId]) REFERENCES [dbo].[Stock]([stockId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Stock] ADD CONSTRAINT [FK_Stock_StockStatus] FOREIGN KEY ([stockStatusId]) REFERENCES [dbo].[StockStatus]([stockStatusId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Mouvement] ADD CONSTRAINT [FK_Mouvement_CreatedByUser] FOREIGN KEY ([createdByUserId]) REFERENCES [dbo].[User]([userId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Mouvement] ADD CONSTRAINT [FK_Mouvement_Inventory] FOREIGN KEY ([inventoryId]) REFERENCES [dbo].[Inventory]([inventoryId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Mouvement] ADD CONSTRAINT [FK_Mouvement_SerialNumber] FOREIGN KEY ([serialNumberId]) REFERENCES [dbo].[SerialNumber]([serialNumberId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Mouvement] ADD CONSTRAINT [FK_Mouvement_Shelfsource] FOREIGN KEY ([sourceShelfId]) REFERENCES [dbo].[Shelf]([shelfId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Mouvement] ADD CONSTRAINT [FK_MouvementEequipment] FOREIGN KEY ([equipmentId]) REFERENCES [dbo].[Equipment]([equipmentId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Mouvement] ADD CONSTRAINT [FK_SerialNumber_Shelfdestination] FOREIGN KEY ([destinationShelfId]) REFERENCES [dbo].[Shelf]([shelfId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[EquipmentShelfs] ADD CONSTRAINT [FK_EquipmentShelfs_Equipment] FOREIGN KEY ([equipmentId]) REFERENCES [dbo].[Equipment]([equipmentId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[EquipmentShelfs] ADD CONSTRAINT [FK_EquipmentShelfs_Shelf] FOREIGN KEY ([shelfId]) REFERENCES [dbo].[Shelf]([shelfId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[EqipmentMouvements] ADD CONSTRAINT [FK_EqipmentMouvements_Equipment] FOREIGN KEY ([equipmentId]) REFERENCES [dbo].[Equipment]([equipmentId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Inventory] ADD CONSTRAINT [FK__Inventory__paren__7CD98669] FOREIGN KEY ([parentInventoryId]) REFERENCES [dbo].[Inventory]([inventoryId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Inventory_User] ADD CONSTRAINT [FK__Inventory__inven__7FB5F314] FOREIGN KEY ([inventoryId]) REFERENCES [dbo].[Inventory]([inventoryId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Inventory_User] ADD CONSTRAINT [FK__Inventory__userI__00AA174D] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([userId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Order] ADD CONSTRAINT [FK_Order_Equipment] FOREIGN KEY ([equipmentId]) REFERENCES [dbo].[Equipment]([equipmentId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Order] ADD CONSTRAINT [FK_Order_Inventory] FOREIGN KEY ([inventoryId]) REFERENCES [dbo].[Inventory]([inventoryId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Order] ADD CONSTRAINT [FK_Order_Role] FOREIGN KEY ([roleId]) REFERENCES [dbo].[Role]([roleId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Order] ADD CONSTRAINT [FK_Order_SerialNumber] FOREIGN KEY ([serialNumberId]) REFERENCES [dbo].[SerialNumber]([serialNumberId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Order] ADD CONSTRAINT [FK_Order_Shelf] FOREIGN KEY ([shelfId]) REFERENCES [dbo].[Shelf]([shelfId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Order] ADD CONSTRAINT [FK_Order_User] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([userId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Order] ADD CONSTRAINT [FK_Order_Attempt] FOREIGN KEY ([attemptId]) REFERENCES [dbo].[InventoryCountAttempt]([attemptId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[InventoryWorkUnit] ADD CONSTRAINT [FK_WorkUnit_Inventory] FOREIGN KEY ([inventoryId]) REFERENCES [dbo].[Inventory]([inventoryId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[InventoryWorkUnit] ADD CONSTRAINT [FK_InventoryWorkUnit_AcceptedAttempt] FOREIGN KEY ([acceptedAttemptId]) REFERENCES [dbo].[InventoryCountAttempt]([attemptId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[InventoryCountAttempt] ADD CONSTRAINT [FK_Attempt_WorkUnit] FOREIGN KEY ([unitId]) REFERENCES [dbo].[InventoryWorkUnit]([unitId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[InventoryCountAttempt] ADD CONSTRAINT [FK_Attempt_User] FOREIGN KEY ([assignedUserId]) REFERENCES [dbo].[User]([userId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Inventory_SerialNumber_Snapshot] ADD CONSTRAINT [FK_SnSnapshot_Inventory] FOREIGN KEY ([inventoryId]) REFERENCES [dbo].[Inventory]([inventoryId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Inventory_SerialNumber_Snapshot] ADD CONSTRAINT [FK_SnSnapshot_Equipment] FOREIGN KEY ([equipmentId]) REFERENCES [dbo].[Equipment]([equipmentId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Inventory_SerialNumber_Snapshot] ADD CONSTRAINT [FK_SnSnapshot_Shelf] FOREIGN KEY ([shelfId]) REFERENCES [dbo].[Shelf]([shelfId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[InventoryInvestigationIssue] ADD CONSTRAINT [FK_InvIssue_Inventory] FOREIGN KEY ([inventoryId]) REFERENCES [dbo].[Inventory]([inventoryId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[InventoryInvestigationIssue] ADD CONSTRAINT [FK_InvIssue_Equipment] FOREIGN KEY ([equipmentId]) REFERENCES [dbo].[Equipment]([equipmentId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[InventoryInvestigationIssue] ADD CONSTRAINT [FK_InvIssue_SerialNumber] FOREIGN KEY ([serialNumberId]) REFERENCES [dbo].[SerialNumber]([serialNumberId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[InventoryInvestigationIssue] ADD CONSTRAINT [FK_InvIssue_ExpectedShelf] FOREIGN KEY ([expectedShelfId]) REFERENCES [dbo].[Shelf]([shelfId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[InventoryInvestigationIssue] ADD CONSTRAINT [FK_InvIssue_ObservedShelf] FOREIGN KEY ([finalObservedShelfId]) REFERENCES [dbo].[Shelf]([shelfId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[InventoryInvestigationIssue] ADD CONSTRAINT [FK_InvIssue_ResolutionShelf] FOREIGN KEY ([resolutionShelfId]) REFERENCES [dbo].[Shelf]([shelfId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[InventoryInvestigationIssue] ADD CONSTRAINT [FK_InvIssue_User] FOREIGN KEY ([resolvedByUserId]) REFERENCES [dbo].[User]([userId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Notification] ADD CONSTRAINT [FK_Notification_User] FOREIGN KEY ([recipientId]) REFERENCES [dbo].[User]([userId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[MovementEquipment] ADD CONSTRAINT [FK_MovementEquipment_Mouvement] FOREIGN KEY ([movementId]) REFERENCES [dbo].[Mouvement]([mouvementId]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[MovementEquipment] ADD CONSTRAINT [FK_MovementEquipment_Equipment] FOREIGN KEY ([equipmentId]) REFERENCES [dbo].[Equipment]([equipmentId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[MovementEquipment] ADD CONSTRAINT [FK_MovementEquipment_SourceShelf] FOREIGN KEY ([sourceShelfId]) REFERENCES [dbo].[Shelf]([shelfId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[MovementEquipment] ADD CONSTRAINT [FK_MovementEquipment_DestinationShelf] FOREIGN KEY ([destinationShelfId]) REFERENCES [dbo].[Shelf]([shelfId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[MovementEquipment] ADD CONSTRAINT [FK_MovementEquipment_SerialNumber] FOREIGN KEY ([serialNumberId]) REFERENCES [dbo].[SerialNumber]([serialNumberId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH


/* ============================================================
   2. REQUIRED REFERENCE / SECURITY DATA
   ============================================================ */

/*
  SOMIPHARM PRODUCTION REFERENCE SEED
  Intended for a freshly reconstructed EMPTY yacinedb.

  This does not create any business Stock/Shelf/Equipment/Movement/Inventory rows.
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

IF NOT EXISTS (
    SELECT 1
    FROM dbo.StockStatus
    WHERE stockStatusName = 'ACTIVE'
)
BEGIN
    INSERT INTO dbo.StockStatus (
        stockStatusName
    )
    VALUES (
        'ACTIVE'
    );
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM dbo.StockStatus
    WHERE stockStatusName = 'INACTIVE'
)
BEGIN
    INSERT INTO dbo.StockStatus (
        stockStatusName
    )
    VALUES (
        'INACTIVE'
    );
END;
GO

DECLARE @AdminRoleId uniqueidentifier;
DECLARE @TechnicianRoleId uniqueidentifier;

SELECT
    @AdminRoleId = roleId
FROM dbo.Role
WHERE roleName = 'ADMIN';

IF @AdminRoleId IS NULL
BEGIN
    INSERT INTO dbo.Role (
        roleName
    )
    VALUES (
        'ADMIN'
    );

    SELECT
        @AdminRoleId = roleId
    FROM dbo.Role
    WHERE roleName = 'ADMIN';
END;

SELECT
    @TechnicianRoleId = roleId
FROM dbo.Role
WHERE roleName = 'TECHNICIAN';

IF @TechnicianRoleId IS NULL
BEGIN
    INSERT INTO dbo.Role (
        roleName
    )
    VALUES (
        'TECHNICIAN'
    );

    SELECT
        @TechnicianRoleId = roleId
    FROM dbo.Role
    WHERE roleName = 'TECHNICIAN';
END;

DECLARE @AdminPermissions TABLE (
    permissionName varchar(200) NOT NULL
);

INSERT INTO @AdminPermissions(permissionName)
VALUES
('equipment.read'),
('equipment.create'),
('equipment.update'),
('equipment.delete'),
('serial-number.read'),
('serial-number.create'),
('serial-number.update'),
('serial-number.delete'),
('movement.read'),
('movement.create'),
('shelf.read'),
('shelf.create'),
('shelf.update'),
('shelf.delete'),
('stock.read'),
('stock.create'),
('stock.update'),
('stock.delete'),
('user.manage'),
('role.manage'),
('dashboard.read'),
('inventory.read'),
('inventory.create'),
('inventory.launch'),
('inventory.count'),
('inventory.adjudicate'),
('inventory.finalize'),
('inventory.delete');

INSERT INTO dbo.Permission (
    permissionName,
    roleId
)
SELECT
    p.permissionName,
    @AdminRoleId
FROM @AdminPermissions p
WHERE NOT EXISTS (
    SELECT 1
    FROM dbo.Permission existing
    WHERE
        existing.roleId = @AdminRoleId
        AND existing.permissionName = p.permissionName
);

DECLARE @TechnicianPermissions TABLE (
    permissionName varchar(200) NOT NULL
);

INSERT INTO @TechnicianPermissions(permissionName)
VALUES
('equipment.read'),
('serial-number.read'),
('movement.read'),
('movement.create'),
('shelf.read');

INSERT INTO dbo.Permission (
    permissionName,
    roleId
)
SELECT
    p.permissionName,
    @TechnicianRoleId
FROM @TechnicianPermissions p
WHERE NOT EXISTS (
    SELECT 1
    FROM dbo.Permission existing
    WHERE
        existing.roleId = @TechnicianRoleId
        AND existing.permissionName = p.permissionName
);
GO


/* ============================================================
   3. DATABASE HARDENING
   ============================================================ */

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


/* ============================================================
   4. FINAL READ-ONLY VERIFICATION
   ============================================================ */

SELECT
    @@SERVERNAME AS CurrentServer,
    DB_NAME() AS CurrentDatabase;

SELECT
    COUNT(*) AS ApplicationTableCount
FROM sys.tables
WHERE is_ms_shipped = 0;

SELECT
    stockStatusName
FROM dbo.StockStatus
ORDER BY stockStatusName;

SELECT
    name AS HardeningTrigger,
    is_disabled AS IsDisabled
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
GO
