import { PrismaClient } from './backend/generated/prisma/client/index.js';
const prisma = new PrismaClient();

async function run() {
  await prisma.$executeRawUnsafe(`DELETE FROM MovementEquipment`);
  await prisma.$executeRawUnsafe(`DELETE FROM Mouvement`);
}

run().catch(console.error).finally(() => prisma.$disconnect());
