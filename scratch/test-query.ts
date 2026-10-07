import { PrismaClient } from './backend/generated/prisma/client/index.js';
const prisma = new PrismaClient();

async function run() {
  const serials = await prisma.serialNumber.findMany({
    take: 5,
    select: {
      serialNumberCode: true,
      movementItems: {
        take: 1,
        orderBy: { movement: { happenedAt: 'desc' } },
        select: {
          destinationShelfId: true,
          destinationShelf: { select: { shelfId: true, shelfName: true } },
          movement: { select: { mouvementStatus: true } }
        }
      }
    }
  });
  console.log(JSON.stringify(serials, null, 2));
}

run().catch(console.error).finally(() => prisma.$disconnect());
