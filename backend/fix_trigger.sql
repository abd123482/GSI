CREATE OR ALTER TRIGGER dbo.TR_Shelf_RequireActiveStock
ON dbo.Shelf
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (
        SELECT 1
        FROM inserted i
        LEFT JOIN deleted d ON i.shelfId = d.shelfId
        JOIN dbo.Stock s
            ON s.stockId = i.stockId
        JOIN dbo.StockStatus ss
            ON ss.stockStatusId = s.stockStatusId
        WHERE UPPER(LTRIM(RTRIM(ss.stockStatusName))) <> 'ACTIVE'
        AND (d.shelfId IS NULL OR i.stockId <> d.stockId)
    )
    BEGIN
        THROW 51001,
            'A shelf can be created or reassigned only inside an ACTIVE stock.',
            1;
    END;
END;
