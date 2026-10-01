import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaMssql } from '@prisma/adapter-mssql';
import { ALL_SYSTEM_PERMISSIONS } from '../src/auth/constants/permissions.constant.js';

const adapter = new PrismaMssql({
  server: process.env.DB_HOST!,
  port: Number(process.env.DB_PORT ?? 1433),
  database: process.env.DB_NAME!,
  user: process.env.DB_USER!,
  password: process.env.DB_PASSWORD!,
  options: {
    encrypt: true,
    trustServerCertificate: true,
  },
});

const prisma = new PrismaClient({ adapter });

const TECHNICIAN_PERMISSIONS = [
  'equipment.read',
  'serial-number.read',
  'movement.read',
  'movement.create',
  'shelf.read',
] as const;

async function ensureRole(roleName: string) {
  let role = await prisma.role.findFirst({
    where: { roleName },
  });

  if (!role) {
    role = await prisma.role.create({
      data: { roleName },
    });
  }

  return role;
}

async function ensurePermission(
  roleId: string,
  permissionName: string,
) {
  const existing = await prisma.permission.findFirst({
    where: {
      roleId,
      permissionName,
    },
  });

  if (!existing) {
    await prisma.permission.create({
      data: {
        roleId,
        permissionName,
      },
    });
  }
}



async function main() {
  console.log('Seeding SOMIPHARM reference/security data idempotently...');


  const adminRole = await ensureRole('ADMIN');
  const technicianRole = await ensureRole('TECHNICIAN');

  for (const permissionName of ALL_SYSTEM_PERMISSIONS) {
    await ensurePermission(adminRole.roleId, permissionName);
  }

  for (const permissionName of TECHNICIAN_PERMISSIONS) {
    await ensurePermission(technicianRole.roleId, permissionName);
  }

  console.log(
    `Ensured ${ALL_SYSTEM_PERMISSIONS.length} ADMIN permissions.`,
  );
  console.log(
    `Ensured ${TECHNICIAN_PERMISSIONS.length} TECHNICIAN permissions.`,
  );
  console.log('Ensured StockStatus ACTIVE / INACTIVE.');
  console.log('Seed completed successfully.');
}

main()
  .catch((error) => {
    console.error('Seed error:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
