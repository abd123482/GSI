const { PrismaClient } = require('../backend/src/generated/prisma');
const prisma = new PrismaClient();

async function main() {
  try {
    const tables = await prisma.$queryRawUnsafe(`SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME`);
    console.log('Tables:', tables.map(t => t.TABLE_NAME));

    const inventoryCols = await prisma.$queryRawUnsafe(`SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Inventory'`);
    console.log('Inventory columns:', inventoryCols);

    const controllerCols = await prisma.$queryRawUnsafe(`SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'InventoryController'`);
    console.log('InventoryController columns:', controllerCols);

    const unitCols = await prisma.$queryRawUnsafe(`SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'InventoryUnit'`);
    console.log('InventoryUnit columns:', unitCols);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
