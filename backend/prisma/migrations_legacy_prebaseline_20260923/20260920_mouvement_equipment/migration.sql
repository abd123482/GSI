BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[MouvementEquipment] (
    [mouvementEquipmentId] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [MouvementEquipment_mouvementEquipmentId_df] DEFAULT newid(),
    [mouvementId] UNIQUEIDENTIFIER NOT NULL,
    [equipmentId] UNIQUEIDENTIFIER NOT NULL,
    [sourceShelfId] UNIQUEIDENTIFIER,
    [destinationShelfId] UNIQUEIDENTIFIER,
    [serialNumberId] UNIQUEIDENTIFIER,
    [mouvementQuantity] INT NOT NULL,
    [mouvementStatus] VARCHAR(50) NOT NULL,
    CONSTRAINT [MouvementEquipment_pkey] PRIMARY KEY CLUSTERED ([mouvementEquipmentId])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [MouvementEquipment_mouvementId_idx] ON [dbo].[MouvementEquipment]([mouvementId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [MouvementEquipment_equipmentId_idx] ON [dbo].[MouvementEquipment]([equipmentId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [MouvementEquipment_sourceShelfId_idx] ON [dbo].[MouvementEquipment]([sourceShelfId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [MouvementEquipment_destinationShelfId_idx] ON [dbo].[MouvementEquipment]([destinationShelfId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [MouvementEquipment_serialNumberId_idx] ON [dbo].[MouvementEquipment]([serialNumberId]);

-- AddForeignKey
ALTER TABLE [dbo].[MouvementEquipment] ADD CONSTRAINT [MouvementEquipment_mouvementId_fkey] FOREIGN KEY ([mouvementId]) REFERENCES [dbo].[Mouvement]([mouvementId]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[MouvementEquipment] ADD CONSTRAINT [MouvementEquipment_equipmentId_fkey] FOREIGN KEY ([equipmentId]) REFERENCES [dbo].[Equipment]([equipmentId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[MouvementEquipment] ADD CONSTRAINT [MouvementEquipment_sourceShelfId_fkey] FOREIGN KEY ([sourceShelfId]) REFERENCES [dbo].[Shelf]([shelfId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[MouvementEquipment] ADD CONSTRAINT [MouvementEquipment_destinationShelfId_fkey] FOREIGN KEY ([destinationShelfId]) REFERENCES [dbo].[Shelf]([shelfId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[MouvementEquipment] ADD CONSTRAINT [MouvementEquipment_serialNumberId_fkey] FOREIGN KEY ([serialNumberId]) REFERENCES [dbo].[SerialNumber]([serialNumberId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Preserve existing history as one child line per legacy equipment movement.
INSERT INTO [dbo].[MouvementEquipment]
  ([mouvementId], [equipmentId], [sourceShelfId], [destinationShelfId], [serialNumberId], [mouvementQuantity], [mouvementStatus])
SELECT [mouvementId], [equipmentId], [sourceShelfId], [destinationShelfId], [serialNumberId],
       COALESCE([movementQuantity], 1), COALESCE([mouvementStatus], 'TRANSFER')
FROM [dbo].[Mouvement]
WHERE [equipmentId] IS NOT NULL;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
