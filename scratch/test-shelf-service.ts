import { PrismaClient } from '../backend/src/generated/prisma/client/index.js';
import { ShelfService } from '../backend/src/shelves/shelves.service.js';

const prisma = new PrismaClient();
const service = new ShelfService(prisma as any);

async function main() {
  try {
    const shelfId = '900DEE7A-6A38-42FD-8A1F-87E7EDCC0A6E';
    const res = await service.getShelfEquipments(shelfId, { page: 1, limit: 20 });
    console.log('Service Result:', JSON.stringify(res, null, 2));
  } catch (err) {
    console.error('Service Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
