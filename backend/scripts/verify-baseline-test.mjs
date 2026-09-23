import 'dotenv/config';

import { PrismaMssql } from '@prisma/adapter-mssql';
import { PrismaClient } from '../dist/generated/prisma/client.js';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const DATABASE = 'yacinedb_baseline_test';
const BASELINE_NAME = '20260923_baseline';

const EXPECTED_TABLES = [
  'Role',
  'Permission',
  'User',
  'Session',
  'Equipment',
  'SerialNumber',
  'Shelf',
  'StockStatus',
  'Stock',
  'Mouvement',
  'EquipmentShelfs',
  'EqipmentMouvements',
  'Inventory',
  'Inventory_User',
  'sysdiagrams',
  'Order',
  'InventoryWorkUnit',
  'InventoryCountAttempt',
  'Inventory_Equipment_Shelf_Snapshot',
  'Inventory_SerialNumber_Snapshot',
  'InventoryInvestigationIssue',
  'Notification',
  'MovementEquipment',
];

const EXPECTED_TRIGGERS = [
  'TR_Shelf_RequireActiveStock',
  'TR_EquipmentShelfs_RequireActiveStock',
  'TR_Mouvement_RequireActiveStocks',
  'TR_SerialNumber_Guards',
  'TR_InventoryWorkUnit_AcceptedAttempt',
  'TR_MovementEquipment_MatchHeader',
];

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

function sha256(buffer) {
  return crypto
    .createHash('sha256')
    .update(buffer)
    .digest('hex')
    .toUpperCase();
}

const prisma = new PrismaClient({
  adapter: new PrismaMssql({
    server: required('DB_HOST'),
    port: Number(process.env.DB_PORT ?? 1433),
    database: required('DB_NAME'),
    user: required('DB_USER'),
    password: required('DB_PASSWORD'),
    options: {
      encrypt: true,
      trustServerCertificate: true,
    },
  }),
});

async function main() {
  if (
    required('DB_NAME').toLowerCase() !== DATABASE
  ) {
    throw new Error(
      `Safety stop: expected DB_NAME=${DATABASE}.`,
    );
  }

  await prisma.$connect();

  const identity = (
    await prisma.$queryRawUnsafe(`
      SELECT
        @@SERVERNAME AS currentServer,
        DB_NAME() AS currentDatabase
    `)
  )[0];

  const tableRows = await prisma.$queryRawUnsafe(`
    SELECT name
    FROM sys.tables
    WHERE name IN (
      ${EXPECTED_TABLES.map((name) => `N'${name}'`).join(',')}
    )
    ORDER BY name
  `);

  const triggerRows = await prisma.$queryRawUnsafe(`
    SELECT
      name,
      is_disabled AS isDisabled
    FROM sys.triggers
    WHERE name IN (
      ${EXPECTED_TRIGGERS.map((name) => `N'${name}'`).join(',')}
    )
    ORDER BY name
  `);

  const fkProblems = await prisma.$queryRawUnsafe(`
    SELECT
      OBJECT_NAME(parent_object_id) AS tableName,
      name AS foreignKeyName,
      is_disabled AS isDisabled,
      is_not_trusted AS isNotTrusted
    FROM sys.foreign_keys
    WHERE
      is_disabled = 1
      OR is_not_trusted = 1
    ORDER BY
      tableName,
      foreignKeyName
  `);

  const migrationRows = await prisma.$queryRawUnsafe(`
    SELECT
      migration_name AS migrationName,
      finished_at AS finishedAt,
      rolled_back_at AS rolledBackAt
    FROM dbo._prisma_migrations
    ORDER BY started_at
  `);

  const statuses = await prisma.stockStatus.findMany({
    orderBy: {
      stockStatusName: 'asc',
    },
  });

  const roles = await prisma.role.findMany({
    include: {
      permissions: true,
    },
    orderBy: {
      roleName: 'asc',
    },
  });

  const foundTables = new Set(
    tableRows.map((row) => String(row.name)),
  );

  const missingTables = EXPECTED_TABLES.filter(
    (name) => !foundTables.has(name),
  );

  const triggerMap = new Map(
    triggerRows.map((row) => [String(row.name), row]),
  );

  const badTriggers = EXPECTED_TRIGGERS.filter((name) => {
    const row = triggerMap.get(name);
    return !row || Boolean(row.isDisabled);
  });

  const baselineMigration = migrationRows.find(
    (row) => row.migrationName === BASELINE_NAME,
  );

  const admin = roles.find(
    (role) => role.roleName === 'ADMIN',
  );

  const technician = roles.find(
    (role) => role.roleName === 'TECHNICIAN',
  );

  const statusNames = statuses.map(
    (row) => row.stockStatusName,
  );

  const migrationPath = path.resolve(
    process.cwd(),
    'prisma',
    'migrations',
    BASELINE_NAME,
    'migration.sql',
  );

  const manifestPath = path.resolve(
    process.cwd(),
    'sql',
    'generated',
    'clean-prisma-baseline-manifest.json',
  );

  const migrationHash = sha256(
    fs.readFileSync(migrationPath),
  );

  const manifest = JSON.parse(
    fs.readFileSync(manifestPath, 'utf8'),
  );

  const problems = [];

  if (
    String(identity?.currentDatabase ?? '').toLowerCase() !==
    DATABASE
  ) {
    problems.push(
      `Wrong DB: ${identity?.currentDatabase}`,
    );
  }

  if (missingTables.length > 0) {
    problems.push(
      `Missing tables: ${missingTables.join(', ')}`,
    );
  }

  if (badTriggers.length > 0) {
    problems.push(
      `Missing/disabled triggers: ${badTriggers.join(', ')}`,
    );
  }

  if (fkProblems.length > 0) {
    problems.push(
      `${fkProblems.length} disabled/untrusted foreign key(s)`,
    );
  }

  if (
    !baselineMigration ||
    !baselineMigration.finishedAt ||
    baselineMigration.rolledBackAt
  ) {
    problems.push(
      `Prisma baseline migration ${BASELINE_NAME} is not recorded as successfully applied.`,
    );
  }

  if (
    !statusNames.includes('ACTIVE') ||
    !statusNames.includes('INACTIVE')
  ) {
    problems.push(
      'StockStatus ACTIVE/INACTIVE seed is incomplete.',
    );
  }

  if (
    !admin ||
    admin.permissions.length < 28
  ) {
    problems.push(
      `ADMIN role is missing or has only ${admin?.permissions.length ?? 0} permissions.`,
    );
  }

  if (
    !technician ||
    technician.permissions.length < 5
  ) {
    problems.push(
      `TECHNICIAN role is missing or has only ${technician?.permissions.length ?? 0} permissions.`,
    );
  }

  if (
    manifest.migrationSha256 !== migrationHash
  ) {
    problems.push(
      'Baseline migration hash differs from preparation manifest.',
    );
  }

  const report = {
    generatedAt: new Date().toISOString(),
    passed: problems.length === 0,
    database: DATABASE,
    identity,
    baselineName: BASELINE_NAME,
    migrationHash,
    tableCount: foundTables.size,
    expectedTableCount: EXPECTED_TABLES.length,
    missingTables,
    triggerCount: triggerRows.length,
    expectedTriggerCount: EXPECTED_TRIGGERS.length,
    badTriggers,
    foreignKeyProblems: fkProblems,
    migrations: migrationRows,
    stockStatuses: statusNames,
    roles: roles.map((role) => ({
      roleName: role.roleName,
      permissionCount: role.permissions.length,
      permissions: role.permissions
        .map((permission) => permission.permissionName)
        .sort(),
    })),
    problems,
  };

  const reportPath = path.resolve(
    process.cwd(),
    'sql',
    'generated',
    'clean-prisma-baseline-test-report.json',
  );

  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      report,
      (_key, value) =>
        typeof value === 'bigint'
          ? value.toString()
          : value,
      2,
    ),
    'utf8',
  );

  console.log('');
  console.log('CLEAN PRISMA BASELINE TEST');
  console.log('==========================');
  console.log(`Database: ${identity?.currentDatabase}`);
  console.log(
    `Tables: ${foundTables.size}/${EXPECTED_TABLES.length}`,
  );
  console.log(
    `Hardening triggers: ${triggerRows.length}/${EXPECTED_TRIGGERS.length}`,
  );
  console.log(`FK problems: ${fkProblems.length}`);
  console.log(`StockStatus: ${statusNames.join(', ')}`);
  console.log(
    `ADMIN permissions: ${admin?.permissions.length ?? 0}`,
  );
  console.log(
    `TECHNICIAN permissions: ${technician?.permissions.length ?? 0}`,
  );
  console.log(
    `Prisma baseline recorded: ${baselineMigration ? 'YES' : 'NO'}`,
  );
  console.log('');

  if (problems.length === 0) {
    console.log('PASS: CLEAN PRISMA BASELINE IS VALIDATED.');
  } else {
    console.log('FAIL:');
    for (const problem of problems) {
      console.log(`- ${problem}`);
    }
    process.exitCode = 2;
  }

  console.log('');
  console.log(`Report: ${reportPath}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });
