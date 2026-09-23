import { PrismaClient } from '../backend/src/generated/prisma/client/index.js';
const prisma = new PrismaClient();
async function run() {
  const users = await prisma.user.findMany({ include: { role: { include: { permissions: true } } } });
  console.log(JSON.stringify(users, null, 2));
}
run().catch(console.error).finally(() => prisma.$disconnect());
