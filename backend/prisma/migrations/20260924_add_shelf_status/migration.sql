BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[ShelfStatus] (
    [shelfStatusId] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_ShelfStatus_shelfStatusId] DEFAULT newid(),
    [shelfStatusName] VARCHAR(50) NOT NULL,
    CONSTRAINT [PK_ShelfStatus] PRIMARY KEY CLUSTERED ([shelfStatusId]),
    CONSTRAINT [UQ_ShelfStatus_Name] UNIQUE NONCLUSTERED ([shelfStatusName])
);

-- Insert statuses
INSERT INTO [dbo].[ShelfStatus] ([shelfStatusName]) VALUES ('ACTIVE'), ('INACTIVE');

-- AlterTable
ALTER TABLE [dbo].[Shelf] ADD [shelfStatusId] UNIQUEIDENTIFIER;

-- Set default for existing rows
DECLARE @activeId UNIQUEIDENTIFIER;
SELECT @activeId = [shelfStatusId] FROM [dbo].[ShelfStatus] WHERE [shelfStatusName] = 'ACTIVE';
DECLARE @sql NVARCHAR(MAX) = N'UPDATE [dbo].[Shelf] SET [shelfStatusId] = ''' + CAST(@activeId AS NVARCHAR(36)) + '''';
EXEC sp_executesql @sql;

-- Make column NOT NULL
ALTER TABLE [dbo].[Shelf] ALTER COLUMN [shelfStatusId] UNIQUEIDENTIFIER NOT NULL;

-- AddForeignKey
ALTER TABLE [dbo].[Shelf] ADD CONSTRAINT [FK_Shelf_ShelfStatus] FOREIGN KEY ([shelfStatusId]) REFERENCES [dbo].[ShelfStatus]([shelfStatusId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
