-- 1. Inventory table additions
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Inventory') AND name = 'rootInventoryId')
BEGIN
    ALTER TABLE dbo.Inventory ADD rootInventoryId UNIQUEIDENTIFIER NULL;
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Inventory') AND name = 'roundNumber')
BEGIN
    ALTER TABLE dbo.Inventory ADD roundNumber INT NOT NULL CONSTRAINT DF_Inventory_roundNumber DEFAULT 1;
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Inventory') AND name = 'validatedInventoryId')
BEGIN
    ALTER TABLE dbo.Inventory ADD validatedInventoryId UNIQUEIDENTIFIER NULL;
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Inventory') AND name = 'snapshotData')
BEGIN
    ALTER TABLE dbo.Inventory ADD snapshotData NVARCHAR(MAX) NULL;
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Inventory') AND name = 'version')
BEGIN
    ALTER TABLE dbo.Inventory ADD version INT NOT NULL CONSTRAINT DF_Inventory_version DEFAULT 1;
END

-- 2. InventoryUnit table additions
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.InventoryUnit') AND name = 'unitOrder')
BEGIN
    ALTER TABLE dbo.InventoryUnit ADD unitOrder INT NOT NULL CONSTRAINT DF_InventoryUnit_unitOrder DEFAULT 0;
END

-- 3. InventoryIssue table additions
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.InventoryIssue') AND name = 'originatingRound')
BEGIN
    ALTER TABLE dbo.InventoryIssue ADD originatingRound INT NULL CONSTRAINT DF_InventoryIssue_originatingRound DEFAULT 1;
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.InventoryIssue') AND name = 'issueCategory')
BEGIN
    ALTER TABLE dbo.InventoryIssue ADD issueCategory VARCHAR(50) NULL;
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.InventoryIssue') AND name = 'status')
BEGIN
    ALTER TABLE dbo.InventoryIssue ADD status VARCHAR(50) NOT NULL CONSTRAINT DF_InventoryIssue_status DEFAULT 'OPEN';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.InventoryIssue') AND name = 'resolutionDisposition')
BEGIN
    ALTER TABLE dbo.InventoryIssue ADD resolutionDisposition VARCHAR(100) NULL;
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.InventoryIssue') AND name = 'resolutionReason')
BEGIN
    ALTER TABLE dbo.InventoryIssue ADD resolutionReason VARCHAR(500) NULL;
END

-- 4. Foreign Keys
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Inventory_RootInventory')
BEGIN
    ALTER TABLE dbo.Inventory ADD CONSTRAINT FK_Inventory_RootInventory 
        FOREIGN KEY (rootInventoryId) REFERENCES dbo.Inventory(inventoryId)
        ON DELETE NO ACTION ON UPDATE NO ACTION;
END

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Inventory_ValidatedInventory')
BEGIN
    ALTER TABLE dbo.Inventory ADD CONSTRAINT FK_Inventory_ValidatedInventory 
        FOREIGN KEY (validatedInventoryId) REFERENCES dbo.Inventory(inventoryId)
        ON DELETE NO ACTION ON UPDATE NO ACTION;
END

-- 5. Indexes
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Inventory_RootInventoryId' AND object_id = OBJECT_ID('dbo.Inventory'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Inventory_RootInventoryId ON dbo.Inventory(rootInventoryId);
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Inventory_ParentInventoryId' AND object_id = OBJECT_ID('dbo.Inventory'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Inventory_ParentInventoryId ON dbo.Inventory(parentInventoryId);
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Inventory_Root_Round' AND object_id = OBJECT_ID('dbo.Inventory'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Inventory_Root_Round ON dbo.Inventory(rootInventoryId, roundNumber);
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_InventoryUnit_Inventory_Order' AND object_id = OBJECT_ID('dbo.InventoryUnit'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_InventoryUnit_Inventory_Order ON dbo.InventoryUnit(inventoryId, unitOrder);
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_InventoryCount_Unit_Controller' AND object_id = OBJECT_ID('dbo.InventoryCount'))
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX UQ_InventoryCount_Unit_Controller ON dbo.InventoryCount(unitId, inventoryControllerId);
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_InventoryIssue_Status' AND object_id = OBJECT_ID('dbo.InventoryIssue'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_InventoryIssue_Status ON dbo.InventoryIssue(status, inventoryId);
END

-- 6. Deterministic Backfill using dynamic SQL to defer resolution
EXEC(N'
    UPDATE dbo.Inventory 
    SET rootInventoryId = inventoryId, roundNumber = 1 
    WHERE parentInventoryId IS NULL AND (rootInventoryId IS NULL OR roundNumber = 0);
');

EXEC(N'
    UPDATE child
    SET child.rootInventoryId = parent.rootInventoryId,
        child.roundNumber = 2
    FROM dbo.Inventory child
    JOIN dbo.Inventory parent ON child.parentInventoryId = parent.inventoryId
    WHERE child.parentInventoryId IS NOT NULL AND child.rootInventoryId IS NULL;
');

EXEC(N'
    UPDATE dbo.Inventory
    SET validatedInventoryId = inventoryId
    WHERE status = ''FINALIZED'' AND validatedInventoryId IS NULL;
');

EXEC(N'
    UPDATE dbo.InventoryIssue
    SET status = ''RESOLVED''
    WHERE resolvedAt IS NOT NULL AND status = ''OPEN'';
');
