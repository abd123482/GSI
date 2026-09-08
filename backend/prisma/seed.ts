import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaMssql } from '@prisma/adapter-mssql';

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

const ADMIN_PERMISSIONS = [
  'equipment.read',
  'equipment.create',
  'equipment.update',
  'equipment.delete',
  'serial-number.read',
  'serial-number.create',
  'serial-number.update',
  'serial-number.delete',
  'movement.read',
  'movement.create',
  'shelf.read',
  'shelf.create',
  'shelf.update',
  'shelf.delete',
  'user.manage',
  'role.manage',
];

const TECHNICIAN_PERMISSIONS = [
  'equipment.read',
  'serial-number.read',
  'movement.read',
  'movement.create',
  'shelf.read',
];

async function main() {
  console.log('Seeding roles and permissions idempotently...');

  // 1. ADMIN Role
  let adminRole = await prisma.role.findFirst({
    where: { roleName: 'ADMIN' },
  });
  if (!adminRole) {
    adminRole = await prisma.role.create({
      data: { roleName: 'ADMIN' },
    });
    console.log('Created ADMIN role.');
  }

  // 2. TECHNICIAN Role
  let techRole = await prisma.role.findFirst({
    where: { roleName: 'TECHNICIAN' },
  });
  if (!techRole) {
    techRole = await prisma.role.create({
      data: { roleName: 'TECHNICIAN' },
    });
    console.log('Created TECHNICIAN role.');
  }

  // 3. ADMIN Permissions
  for (const permName of ADMIN_PERMISSIONS) {
    const existing = await prisma.permission.findFirst({
      where: {
        roleId: adminRole.roleId,
        permissionName: permName,
      },
    });
    if (!existing) {
      await prisma.permission.create({
        data: {
          roleId: adminRole.roleId,
          permissionName: permName,
        },
      });
    }
  }
  console.log(`Ensured ${ADMIN_PERMISSIONS.length} ADMIN permissions.`);

  // 4. TECHNICIAN Permissions
  for (const permName of TECHNICIAN_PERMISSIONS) {
    const existing = await prisma.permission.findFirst({
      where: {
        roleId: techRole.roleId,
        permissionName: permName,
      },
    });
    if (!existing) {
      await prisma.permission.create({
        data: {
          roleId: techRole.roleId,
          permissionName: permName,
        },
      });
    }
  }
  console.log(`Ensured ${TECHNICIAN_PERMISSIONS.length} TECHNICIAN permissions.`);

  console.log('Seed completed successfully.');
}

main()
  .catch((err) => {
    console.error('Seed error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
