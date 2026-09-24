import pkg from '@prisma/client';
const { PrismaClient } = pkg;

async function main() {
  const prisma = new PrismaClient();
  try {
    const res = await prisma.$queryRawUnsafe("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Shelf' AND COLUMN_NAME = 'shelfStatusId'");
    console.log('Columns:', res);
  } catch(e) {
    console.error('Error:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
