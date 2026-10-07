import { PrismaClient } from './src/generated/prisma/index.js';
const prisma = new PrismaClient();

async function run() {
  const serials = await prisma.serialNumber.findMany({
    include: {
      movementItems: {
        include: { movement: true, sourceShelf: true, destinationShelf: true }
      }
    }
  });
  console.log(JSON.stringify(serials, null, 2));
}

run().finally(() => prisma.$disconnect());
