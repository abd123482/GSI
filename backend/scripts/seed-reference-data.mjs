import 'dotenv/config';

import { PrismaMssql } from '@prisma/adapter-mssql';
import { PrismaClient } from '../dist/generated/prisma/client.js';
import { ALL_SYSTEM_PERMISSIONS } from '../dist/auth/constants/permissions.constant.js';

const database = process.env.DB_NAME;

if (!database) {
  throw new Error('Missing DB_NAME.');
}

function required(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

const prisma = new PrismaClient({
  adapter: new PrismaMssql({
    server: required('DB_HOST'),
    port: Number(process.env.DB_PORT ?? 1433),
    database,
    user: required('DB_USER'),
    password: required('DB_PASSWORD'),
    options: {
      encrypt: true,
      trustServerCertificate: true,
    },
  }),
});

const TECHNICIAN_PERMISSIONS = [
  'equipment.read',
  'serial-number.read',
  'movement.read',
  'movement.create',
  'shelf.read',
];

async function ensureRole(roleName) {
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

async function ensurePermission(roleId, permissionName) {
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
  await prisma.$connect();

  const identity = (
    await prisma.$queryRawUnsafe(`
      SELECT
        @@SERVERNAME AS currentServer,
        DB_NAME() AS currentDatabase
    `)
  )[0];

  if (
    String(identity?.currentDatabase ?? '').toLowerCase() !==
    database.toLowerCase()
  ) {
    throw new Error(
      `Connected DB mismatch: expected ${database}, got ${identity?.currentDatabase}`,
    );
  }

  for (const stockStatusName of ['ACTIVE', 'INACTIVE']) {
    await prisma.stockStatus.upsert({
      where: { stockStatusName },
      update: {},
      create: { stockStatusName },
    });
  }

  const adminRole = await ensureRole('ADMIN');
  const technicianRole = await ensureRole('TECHNICIAN');

  for (const permissionName of ALL_SYSTEM_PERMISSIONS) {
    await ensurePermission(adminRole.roleId, permissionName);
  }

  for (const permissionName of TECHNICIAN_PERMISSIONS) {
    await ensurePermission(technicianRole.roleId, permissionName);
  }

  console.log('');
  console.log('REFERENCE DATA SEEDED');
  console.log('=====================');
  console.log(`Database: ${identity?.currentDatabase}`);
  console.log(`ADMIN permissions ensured: ${ALL_SYSTEM_PERMISSIONS.length}`);
  console.log(
    `TECHNICIAN permissions ensured: ${TECHNICIAN_PERMISSIONS.length}`,
  );
  console.log('StockStatus ensured: ACTIVE, INACTIVE');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });
