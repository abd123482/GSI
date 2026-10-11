import { PrismaClient } from './src/generated/prisma/client.js';

const prisma = new PrismaClient();

async function main() {
  const shelves = await prisma.shelf.findMany({
    include: { stock: true }
  });
  console.log('ALL SHELVES:', JSON.stringify(shelves, null, 2));
  await prisma.$disconnect();
}

main();
