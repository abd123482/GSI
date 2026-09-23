import { PrismaClient } from './src/generated/prisma/client/index.js';
const prisma = new PrismaClient();
async function run() {
  const adminRole = await prisma.role.findFirst({ where: { roleName: 'Admin' } })
    ?? await prisma.role.findFirst({ where: { roleName: 'ADMIN' } })
    ?? await prisma.role.create({ data: { roleName: 'Admin' } });
  
  await prisma.user.updateMany({
    data: { roleId: adminRole.roleId, userStatus: 'ACTIVE' }
  });
  console.log('Promoted all users to Admin role and set status to ACTIVE.');
}
run().catch(console.error).finally(() => prisma.$disconnect());
