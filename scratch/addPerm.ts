import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const role = await prisma.role.findFirst({ where: { roleName: 'Admin' } });
  if (role) {
    const perms = new Set([...role.permissions, 'inventory.delete']);
    await prisma.role.update({
      where: { roleId: role.roleId },
      data: { permissions: Array.from(perms) }
    });
    console.log('Done');
  } else {
    console.log('Role not found');
  }
}

main();
