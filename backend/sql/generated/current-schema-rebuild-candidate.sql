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
