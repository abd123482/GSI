import { PrismaClient } from './src/generated/prisma/client.js';
const prisma = new PrismaClient();
async function main() {
  console.log('Stocks:', await prisma.stock.findMany({ take: 5 }));
  console.log('Shelves:', await prisma.shelf.findMany({ take: 5 }));
  console.log('Equipment:', await prisma.equipment.findMany({ take: 5 }));
  console.log('SerialNumbers:', await prisma.serialNumber.findMany({ take: 5 }));
}
main().catch(console.error).finally(() => prisma.$disconnect());
