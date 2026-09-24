import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const inv = await prisma.inventory.findUnique({ where: { inventoryId: '192B5E3F-B05F-481B-BCA9-F3532A6C6BCA'.toLowerCase() } });
  console.log('Lowercase Found:', inv ? true : false);
  const inv2 = await prisma.inventory.findUnique({ where: { inventoryId: '192B5E3F-B05F-481B-BCA9-F3532A6C6BCA'.toUpperCase() } });
  console.log('Uppercase Found:', inv2 ? true : false);
}
main();
