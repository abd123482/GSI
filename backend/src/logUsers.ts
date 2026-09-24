// @ts-nocheck
import { PrismaClient } from '../node_modules/@prisma/client/index.js';

const prisma = new PrismaClient();

async function run() {
  const users = await prisma.user.findMany({ include: { role: true } });
  console.log(`Found ${users.length} users:`);
  for (const u of users) {
    console.log(`- ${u.userEmail} (ID: ${u.userId}, Clerk: ${u.clerkUserId}, Role: ${u.role?.roleName})`);
  }
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
