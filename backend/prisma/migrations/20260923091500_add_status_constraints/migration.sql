BEGIN TRY
  BEGIN TRAN;

  -- 1. INSPECT STOCK STATUS
  IF EXISTS (SELECT 1 FROM [StockStatus] WHERE stockStatusName NOT IN ('ACTIVE', 'INACTIVE'))
  BEGIN
    THROW 50001, 'Unsafe data exists in StockStatus. Migration aborted.', 1;
  END

  -- 2. INSPECT EQUIPMENT STATUS
  IF EXISTS (SELECT 1 FROM [Equipment] WHERE equipmentStatus NOT IN ('ACTIVE', 'INACTIVE'))
  BEGIN
    THROW 50002, 'Unsafe data exists in Equipment. Migration aborted.', 1;
  END

  -- 3. INSPECT INVENTORY WORK UNIT
  IF EXISTS (SELECT 1 FROM [InventoryWorkUnit] WHERE reconciliationStatus NOT IN ('PENDING', 'PRIMARY_MATCH', 'THIRD_REQUIRED', 'THIRD_RESOLVED'))
  BEGIN
    THROW 50003, 'Unsafe data exists in InventoryWorkUnit. Migration aborted.', 1;
  END

  -- 4. INSPECT MOUVEMENT ORIGIN
  IF EXISTS (SELECT 1 FROM [Mouvement] WHERE origin NOT IN ('USER', 'INVENTORY_ADJUSTMENT'))
  BEGIN
    THROW 50004, 'Unsafe data exists in Mouvement origin. Migration aborted.', 1;
  END

  -- 5. INSPECT MOVEMENT EQUIPMENT STATUS
  IF EXISTS (SELECT 1 FROM [MovementEquipment] WHERE movementStatus NOT IN ('IN', 'OUT', 'TRANSFER'))
  BEGIN
    THROW 50005, 'Unsafe data exists in MovementEquipment. Migration aborted.', 1;
  END

  -- ADD CONSTRAINTS
  ALTER TABLE [StockStatus] ADD CONSTRAINT [CHK_StockStatus_Name] CHECK (stockStatusName IN ('ACTIVE', 'INACTIVE'));
  ALTER TABLE [Equipment] ADD CONSTRAINT [CHK_Equipment_Status] CHECK (equipmentStatus IN ('ACTIVE', 'INACTIVE'));
  ALTER TABLE [InventoryWorkUnit] ADD CONSTRAINT [CHK_InvWorkUnit_ReconStatus] CHECK (reconciliationStatus IN ('PENDING', 'PRIMARY_MATCH', 'THIRD_REQUIRED', 'THIRD_RESOLVED'));
  ALTER TABLE [Mouvement] ADD CONSTRAINT [CHK_Mouvement_Origin] CHECK (origin IN ('USER', 'INVENTORY_ADJUSTMENT'));
  ALTER TABLE [MovementEquipment] ADD CONSTRAINT [CHK_MovementEq_Status] CHECK (movementStatus IN ('IN', 'OUT', 'TRANSFER'));

  COMMIT TRAN;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0
    ROLLBACK TRAN;
  THROW;
END CATCH
