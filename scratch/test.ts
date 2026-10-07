import { PrismaClient } from './backend/src/generated/prisma/client/index.js';
const prisma = new PrismaClient();
async function run() {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.shelf.updateMany({ where: { stockId: 'cf970e04-a374-49db-9ac1-08913d41229f', status: true }, data: { status: false } });
      await tx.stock.update({ where: { stockId: 'cf970e04-a374-49db-9ac1-08913d41229f' }, data: { status: false } });
    });
    console.log('Success');
  } catch (e) {
    console.error(e);
  }
}
run();
