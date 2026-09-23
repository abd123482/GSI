import 'dotenv/config';

import { PrismaMssql } from '@prisma/adapter-mssql';
import { PrismaClient } from '../dist/generated/prisma/client.js';
import fs from 'node:fs';
import path from 'node:path';

const TEST_DB =
  process.env.REBUILD_DB_NAME ??
  'yacinedb_rebuild_test';

const PROD_DB = 'yacinedb';

const EXPECTED_TABLES = [
  'Role',
  'Permission',
  'User',
  'StockStatus',
  'Stock',
  'Shelf',
  'Equipment',
  'EquipmentShelfs',
  'SerialNumber',
  'Mouvement',
  'MovementEquipment',
  'Inventory',
  'Inventory_User',
  'Order',
  'InventoryWorkUnit',
  'InventoryCountAttempt',
  'Inventory_Equipment_Shelf_Snapshot',
  'Inventory_SerialNumber_Snapshot',
  'InventoryInvestigationIssue',
  'Notification',
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

function clientFor(database) {
  return new PrismaClient({
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
}

async function inspectTestDb() {
  const prisma = clientFor(TEST_DB);

  try {
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
      ORDER BY tableName, foreignKeyName
    `);

    const statuses = await prisma.stockStatus.findMany({
      orderBy: {
        stockStatusName: 'asc',
      },
    });

    const foundTables = new Set(
      tables.map((row) => String(row.name)),
    );

    const foundTriggers = new Map(
      triggers.map((row) => [String(row.name), row]),
    );

    const missingTables = EXPECTED_TABLES.filter(
      (name) => !foundTables.has(name),
    );

    const badTriggers = EXPECTED_TRIGGERS.filter((name) => {
      const row = foundTriggers.get(name);
      return !row || Boolean(row.isDisabled);
    });

    const statusNames = statuses.map(
      (row) => row.stockStatusName,
    );

    return {
      identity,
      tableCount: tables.length,
      missingTables,
      triggerCount: triggers.length,
      badTriggers,
      fkProblems,
      statusNames,
      passed:
        missingTables.length === 0 &&
        badTriggers.length === 0 &&
        fkProblems.length === 0 &&
        statusNames.includes('ACTIVE') &&
        statusNames.includes('INACTIVE'),
    };
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
}

async function inspectProdDb() {
  const prisma = clientFor(PROD_DB);

  try {
    await prisma.$connect();

    const identity = (
      await prisma.$queryRawUnsafe(`
        SELECT
          @@SERVERNAME AS currentServer,
          DB_NAME() AS currentDatabase
      `)
    )[0];

    const userTables = await prisma.$queryRawUnsafe(`
      SELECT
        s.name AS schemaName,
        t.name AS tableName
      FROM sys.tables t
      JOIN sys.schemas s
        ON s.schema_id = t.schema_id
      WHERE
        t.is_ms_shipped = 0
        AND t.name <> '_prisma_migrations'
      ORDER BY
        s.name,
        t.name
    `);

    return {
      identity,
      userTableCount: userTables.length,
      userTables,
      passed: userTables.length === 0,
    };
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
}

async function main() {
  const smokeMarker = path.resolve(
    process.cwd(),
    'sql',
    'generated',
    'live-smoke-test-passed.txt',
  );

  const testVerification = path.resolve(
    process.cwd(),
    'sql',
    'generated',
    `${TEST_DB}-verification-report.json`,
  );

  const testHardening = path.resolve(
    process.cwd(),
    'sql',
    'generated',
    `${TEST_DB}-hardening-report.json`,
  );

  const candidateSql = path.resolve(
    process.cwd(),
    'sql',
    'generated',
    'current-schema-rebuild-candidate.sql',
  );

  const requiredFiles = [
    testVerification,
    testHardening,
    candidateSql,
  ];

  for (const requiredFile of requiredFiles) {
    if (!fs.existsSync(requiredFile)) {
      throw new Error(
        `Required validation artifact is missing: ${requiredFile}`,
      );
    }
  }

  const testDb = await inspectTestDb();
  const prodDb = await inspectProdDb();

  const problems = [];

  if (!testDb.passed) {
    problems.push(
      'Isolated rebuild database does not pass schema/hardening verification.',
    );
  }

  if (!prodDb.passed) {
    problems.push(
      `Production yacinedb is not empty: ${prodDb.userTableCount} user table(s) exist.`,
    );
  }

  if (!fs.existsSync(smokeMarker)) {
    problems.push(
      'Live smoke-test confirmation marker is missing.',
    );
  }

  const report = {
    generatedAt: new Date().toISOString(),
    testDatabase: TEST_DB,
    productionDatabase: PROD_DB,
    testDb,
    prodDb,
    smokeMarkerPresent: fs.existsSync(smokeMarker),
    ready: problems.length === 0,
    problems,
  };

  const reportPath = path.resolve(
    process.cwd(),
    'sql',
    'generated',
    'production-rebuild-readiness-report.json',
  );

  fs.writeFileSync(
    reportPath,
    JSON.stringify(report, null, 2),
    'utf8',
  );

  console.log('');
  console.log('SOMIPHARM PRODUCTION REBUILD READINESS');
  console.log('======================================');
  console.log(
    `Test DB tables:   ${testDb.tableCount}/${EXPECTED_TABLES.length}`,
  );
  console.log(
    `Test DB triggers: ${testDb.triggerCount}/${EXPECTED_TRIGGERS.length}`,
  );
  console.log(
    `Test DB FK issues: ${testDb.fkProblems.length}`,
  );
  console.log(
    `Production user tables: ${prodDb.userTableCount}`,
  );
  console.log(
    `Smoke marker: ${report.smokeMarkerPresent ? 'YES' : 'NO'}`,
  );
  console.log('');

  if (report.ready) {
    console.log('READY: production rebuild package may be generated.');
  } else {
    console.log('NOT READY:');
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
  });
