import 'dotenv/config';

import { PrismaMssql } from '@prisma/adapter-mssql';
import { PrismaClient } from '../dist/generated/prisma/client.js';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const DATABASE = 'yacinedb';
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
    database: DATABASE,
    user: required('DB_USER'),
    password: required('DB_PASSWORD'),
    options: {
      encrypt: true,
      trustServerCertificate: true,
    },
  }),
});

async function main() {
  const testReportPath = path.resolve(
    process.cwd(),
    'sql',
    'generated',
    'clean-prisma-baseline-test-report.json',
  );

  const manifestPath = path.resolve(
    process.cwd(),
    'sql',
    'generated',
    'clean-prisma-baseline-manifest.json',
  );

  const migrationPath = path.resolve(
    process.cwd(),
    'prisma',
    'migrations',
    BASELINE_NAME,
    'migration.sql',
  );

  for (const file of [
    testReportPath,
    manifestPath,
    migrationPath,
  ]) {
    if (!fs.existsSync(file)) {
      throw new Error(`Required file missing: ${file}`);
    }
  }

  const testReport = JSON.parse(
    fs.readFileSync(testReportPath, 'utf8'),
  );

  const manifest = JSON.parse(
    fs.readFileSync(manifestPath, 'utf8'),
  );

  if (!testReport.passed) {
    throw new Error(
      'The isolated clean-baseline test report is not PASS.',
    );
  }

  const currentMigrationHash = sha256(
    fs.readFileSync(migrationPath),
  );

  if (
    currentMigrationHash !== manifest.migrationSha256 ||
    currentMigrationHash !== testReport.migrationHash
  ) {
    throw new Error(
      'Baseline migration changed after isolated validation.',
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

  const tables = await prisma.$queryRawUnsafe(`
    SELECT name
    FROM sys.tables
    WHERE name IN (
      ${EXPECTED_TABLES.map((name) => `N'${name}'`).join(',')}
    )
    ORDER BY name
  `);

  const triggers = await prisma.$queryRawUnsafe(`
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
  `);

  const migrationTableExists = (
    await prisma.$queryRawUnsafe(`
      SELECT
        CASE
          WHEN OBJECT_ID(N'dbo._prisma_migrations', N'U') IS NULL
            THEN 0
          ELSE 1
        END AS existsFlag
    `)
  )[0];

  let alreadyApplied = false;

  if (Number(migrationTableExists?.existsFlag ?? 0) === 1) {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT migration_name AS migrationName
      FROM dbo._prisma_migrations
      WHERE migration_name = N'${BASELINE_NAME}'
        AND finished_at IS NOT NULL
        AND rolled_back_at IS NULL
    `);

    alreadyApplied = rows.length > 0;
  }

  const tableNames = new Set(
    tables.map((row) => String(row.name)),
  );

  const triggerMap = new Map(
    triggers.map((row) => [String(row.name), row]),
  );

  const missingTables = EXPECTED_TABLES.filter(
    (name) => !tableNames.has(name),
  );

  const badTriggers = EXPECTED_TRIGGERS.filter((name) => {
    const row = triggerMap.get(name);
    return !row || Boolean(row.isDisabled);
  });

  const problems = [];

  if (
    String(identity?.currentDatabase ?? '').toLowerCase() !==
    DATABASE
  ) {
    problems.push(
      `Connected DB is ${identity?.currentDatabase}, not yacinedb.`,
    );
  }

  if (missingTables.length > 0) {
    problems.push(
      `Production is missing tables: ${missingTables.join(', ')}`,
    );
  }

  if (badTriggers.length > 0) {
    problems.push(
      `Production hardening problem: ${badTriggers.join(', ')}`,
    );
  }

  if (fkProblems.length > 0) {
    problems.push(
      `${fkProblems.length} production FK problem(s).`,
    );
  }

  console.log('');
  console.log('PRODUCTION PRISMA BASELINE REGISTRATION READINESS');
  console.log('=================================================');
  console.log(`Database: ${identity?.currentDatabase}`);
  console.log(
    `Schema tables: ${tableNames.size}/${EXPECTED_TABLES.length}`,
  );
  console.log(
    `Hardening triggers: ${triggers.length}/${EXPECTED_TRIGGERS.length}`,
  );
  console.log(`FK problems: ${fkProblems.length}`);
  console.log(
    `Validated baseline SHA256: ${currentMigrationHash}`,
  );
  console.log(
    `Already registered: ${alreadyApplied ? 'YES' : 'NO'}`,
  );
  console.log('');

  if (problems.length > 0) {
    console.log('NOT READY:');
    for (const problem of problems) {
      console.log(`- ${problem}`);
    }
    process.exitCode = 2;
    return;
  }

  console.log(
    alreadyApplied
      ? 'READY: baseline is already registered; resolve step can be skipped.'
      : 'READY: baseline can be registered with migrate resolve --applied.',
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });
