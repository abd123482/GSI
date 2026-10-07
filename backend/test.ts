import { PrismaClient } from './src/generated/prisma/index.js';
const prisma = new PrismaClient();

async function run() {
  const m = await prisma.mouvement.findMany({
    include: { items: true },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
  console.log(JSON.stringify(m, null, 2));
}

run().finally(() => prisma.$disconnect());
