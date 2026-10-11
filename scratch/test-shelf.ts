import { PrismaClient } from '../backend/src/generated/prisma/client/index.js';

const prisma = new PrismaClient();

async function main() {
  try {
    const shelf = await prisma.shelf.findFirst({
      where: { shelfName: 'Emplacement C' }
    });
    console.log('Shelf:', shelf);
    if (!shelf) {
      const shelves = await prisma.shelf.findMany();
      console.log('All shelves:', shelves);
      return;
    }

    const shelfId = shelf.shelfId;
    console.log('Testing query for shelfId:', shelfId);

    const rows = await prisma.$queryRawUnsafe(`
      WITH ShelfEquipmentStock AS (
        SELECT 
          m.equipmentId,
          SUM(CASE WHEN m.destinationShelfId = CAST('${shelfId}' AS uniqueidentifier) THEN m.equipmentQuantity ELSE 0 END) -
          SUM(CASE WHEN m.sourceShelfId = CAST('${shelfId}' AS uniqueidentifier) THEN m.equipmentQuantity ELSE 0 END) AS quantity
        FROM dbo.MovementEquipment m
        WHERE m.destinationShelfId = CAST('${shelfId}' AS uniqueidentifier) OR m.sourceShelfId = CAST('${shelfId}' AS uniqueidentifier)
        GROUP BY m.equipmentId
        HAVING SUM(CASE WHEN m.destinationShelfId = CAST('${shelfId}' AS uniqueidentifier) THEN m.equipmentQuantity ELSE 0 END) -
               SUM(CASE WHEN m.sourceShelfId = CAST('${shelfId}' AS uniqueidentifier) THEN m.equipmentQuantity ELSE 0 END) > 0
      )
      SELECT 
        s.equipmentId,
        s.quantity,
        e.equipmentName,
        e.hasSerialNumber,
        e.equipmentStatus
      FROM ShelfEquipmentStock s
      JOIN dbo.Equipment e ON e.equipmentId = s.equipmentId
      ORDER BY e.equipmentName ASC, s.equipmentId ASC
      OFFSET 0 ROWS FETCH NEXT 20 ROWS ONLY
    `);
    console.log('Rows:', rows);

    const totals = await prisma.$queryRawUnsafe(`
      WITH ShelfEquipmentStock AS (
        SELECT 
          m.equipmentId,
          SUM(CASE WHEN m.destinationShelfId = CAST('${shelfId}' AS uniqueidentifier) THEN m.equipmentQuantity ELSE 0 END) -
          SUM(CASE WHEN m.sourceShelfId = CAST('${shelfId}' AS uniqueidentifier) THEN m.equipmentQuantity ELSE 0 END) AS quantity
        FROM dbo.MovementEquipment m
        WHERE m.destinationShelfId = CAST('${shelfId}' AS uniqueidentifier) OR m.sourceShelfId = CAST('${shelfId}' AS uniqueidentifier)
        GROUP BY m.equipmentId
        HAVING SUM(CASE WHEN m.destinationShelfId = CAST('${shelfId}' AS uniqueidentifier) THEN m.equipmentQuantity ELSE 0 END) -
               SUM(CASE WHEN m.sourceShelfId = CAST('${shelfId}' AS uniqueidentifier) THEN m.equipmentQuantity ELSE 0 END) > 0
      )
      SELECT 
        (SELECT COUNT_BIG(*) FROM ShelfEquipmentStock) AS total,
        (SELECT COALESCE(SUM(CONVERT(bigint, quantity)), 0) FROM ShelfEquipmentStock) AS totalQuantity
      FROM dbo.Shelf WHERE shelfId = CAST('${shelfId}' AS uniqueidentifier)
    `);
    console.log('Totals:', totals);
  } catch (err) {
    console.error('Error running test:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
