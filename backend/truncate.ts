import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
  await prisma.$executeRawUnsafe(`DELETE FROM MovementEquipment`);
  await prisma.$executeRawUnsafe(`DELETE FROM Mouvement`);
}

run().catch(console.error).finally(() => prisma.$disconnect());
