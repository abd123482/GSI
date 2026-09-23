import 'dotenv/config';

import { PrismaMssql } from '@prisma/adapter-mssql';
import { PrismaClient } from '../dist/generated/prisma/client.js';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const PROD_DB = 'yacinedb';
const TEST_DB = 'yacinedb_rebuild_test';

const EXPECTED_TEST_TABLES = [
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

function sha256(buffer) {
  return crypto
    .createHash('sha256')
    .update(buffer)
    .digest('hex')
    .toUpperCase();
}

async function inspectProduction() {
  const prisma = clientFor(PROD_DB);

  try {
    await prisma.$connect();

    const identity = (
      await prisma.$queryRawUnsafe(`
        SELECT
          @@SERVERNAME AS currentServer,
          DB_NAME() AS currentDatabase,
          SUSER_SNAME() AS loginName
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

    let backupHistoryReadable = true;
    let backupHistoryError = null;
    let latestFullBackup = null;

    try {
      const rows = await prisma.$queryRawUnsafe(`
        SELECT TOP (1)
          bs.database_name AS databaseName,
          bs.backup_start_date AS backupStart,
          bs.backup_finish_date AS backupFinish,
          bs.backup_size AS backupSizeBytes,
          bs.compressed_backup_size AS compressedBackupSizeBytes,
          bs.is_copy_only AS isCopyOnly,
          bmf.physical_device_name AS physicalDevice
        FROM msdb.dbo.backupset bs
        LEFT JOIN msdb.dbo.backupmediafamily bmf
          ON bmf.media_set_id = bs.media_set_id
        WHERE
          LOWER(bs.database_name) = LOWER('yacinedb')
          AND bs.type = 'D'
        ORDER BY
          bs.backup_finish_date DESC
      `);

      latestFullBackup = rows[0] ?? null;
    } catch (error) {
      backupHistoryReadable = false;
      backupHistoryError =
        error instanceof Error
          ? error.message
          : String(error);
    }

    return {
      identity,
      userTables,
      userTableCount: userTables.length,
      backupHistoryReadable,
      backupHistoryError,
      latestFullBackup,
    };
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
}

async function inspectTestDb() {
  const prisma = clientFor(TEST_DB);

  try {
    await prisma.$connect();

    const tables = await prisma.$queryRawUnsafe(`
      SELECT name
      FROM sys.tables
      WHERE name IN (
        ${EXPECTED_TEST_TABLES.map((name) => `N'${name}'`).join(',')}
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
      ORDER BY
        tableName,
        foreignKeyName
    `);

    const statuses = await prisma.stockStatus.findMany({
      orderBy: {
        stockStatusName: 'asc',
      },
    });

    const tableNames = new Set(
      tables.map((row) => String(row.name)),
    );

    const triggerMap = new Map(
      triggers.map((row) => [String(row.name), row]),
    );

    const missingTables = EXPECTED_TEST_TABLES.filter(
      (name) => !tableNames.has(name),
    );

    const badTriggers = EXPECTED_TRIGGERS.filter((name) => {
      const row = triggerMap.get(name);
      return !row || Boolean(row.isDisabled);
    });

    const statusNames = statuses.map(
      (row) => row.stockStatusName,
    );

    return {
      foundTableCount: tables.length,
      expectedTableCount: EXPECTED_TEST_TABLES.length,
      missingTables,
      foundTriggerCount: triggers.length,
      expectedTriggerCount: EXPECTED_TRIGGERS.length,
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

function inspectArtifacts() {
  const prodDir = path.resolve(
    process.cwd(),
    'sql',
    'production',
  );

  const sqlPath = path.join(
    prodDir,
    'FINAL_yacinedb_rebuild.sql',
  );

  const hashPath = path.join(
    prodDir,
    'FINAL_yacinedb_rebuild.sha256.txt',
  );

  const smokeMarker = path.resolve(
    process.cwd(),
    'sql',
    'generated',
    'live-smoke-test-passed.txt',
  );

  if (!fs.existsSync(sqlPath)) {
    throw new Error(
      `Missing final production SQL: ${sqlPath}`,
    );
  }

  if (!fs.existsSync(hashPath)) {
    throw new Error(
      `Missing final production SQL hash: ${hashPath}`,
    );
  }

  if (!fs.existsSync(smokeMarker)) {
    throw new Error(
      `Missing live smoke-test confirmation marker: ${smokeMarker}`,
    );
  }

  const sqlBytes = fs.readFileSync(sqlPath);
  const expectedHash = fs
    .readFileSync(hashPath, 'utf8')
    .trim()
    .toUpperCase();

  const actualHash = sha256(sqlBytes);

  const forbiddenPatterns = [
    /^\s*DROP\s+DATABASE\s+/gim,
    /^\s*DROP\s+TABLE\s+/gim,
    /^\s*TRUNCATE\s+/gim,
    /^\s*DELETE\s+FROM\s+/gim,
    /^\s*RESTORE\s+DATABASE\s+/gim,
  ];

  const sql = sqlBytes.toString('utf8');

  const forbiddenMatches = [];

  for (const pattern of forbiddenPatterns) {
    const matches = sql.match(pattern) ?? [];
    forbiddenMatches.push(...matches);
  }

  return {
    sqlPath,
    hashPath,
    smokeMarker,
    expectedHash,
    actualHash,
    hashMatches:
      expectedHash === actualHash,
    forbiddenMatches,
  };
}

async function main() {
  const artifacts = inspectArtifacts();
  const [production, testDb] = await Promise.all([
    inspectProduction(),
    inspectTestDb(),
  ]);

  const problems = [];

  if (!artifacts.hashMatches) {
    problems.push(
      'FINAL_yacinedb_rebuild.sql SHA-256 does not match its recorded hash.',
    );
  }

  if (artifacts.forbiddenMatches.length > 0) {
    problems.push(
      `Unexpected destructive SQL was detected: ${artifacts.forbiddenMatches.join(', ')}`,
    );
  }

  if (
    String(
      production.identity?.currentDatabase ?? '',
    ).toLowerCase() !== 'yacinedb'
  ) {
    problems.push(
      `Production inspection connected to ${production.identity?.currentDatabase}, not yacinedb.`,
    );
  }

  if (production.userTableCount !== 0) {
    problems.push(
      `yacinedb is no longer empty: ${production.userTableCount} user table(s) exist.`,
    );
  }

  if (!production.backupHistoryReadable) {
    problems.push(
      'SQL Server msdb backup history could not be read.',
    );
  }

  if (!production.latestFullBackup) {
    problems.push(
      'No FULL backup record exists yet for yacinedb. Run backup_current_empty_yacinedb.sql first.',
    );
  }

  if (!testDb.passed) {
    problems.push(
      'yacinedb_rebuild_test no longer passes schema/hardening verification.',
    );
  }

  const ready = problems.length === 0;

  const report = {
    generatedAt: new Date().toISOString(),
    ready,
    problems,
    artifacts,
    production,
    testDatabase: testDb,
  };

  const reportPath = path.resolve(
    process.cwd(),
    'sql',
    'production',
    'production-apply-readiness-report.json',
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
  console.log('SOMIPHARM PRODUCTION APPLY PREFLIGHT');
  console.log('===================================');
  console.log(
    `Final SQL hash: ${artifacts.hashMatches ? 'PASS' : 'FAIL'}`,
  );
  console.log(
    `Smoke marker:   YES`,
  );
  console.log(
    `Test DB:        ${testDb.passed ? 'PASS' : 'FAIL'}`,
  );
  console.log(
    `yacinedb user tables: ${production.userTableCount}`,
  );
  console.log(
    `FULL backup record: ${production.latestFullBackup ? 'YES' : 'NO'}`,
  );

  if (production.latestFullBackup) {
    console.log(
      `Backup finish: ${production.latestFullBackup.backupFinish}`,
    );
    console.log(
      `Backup device: ${production.latestFullBackup.physicalDevice}`,
    );
  }

  console.log('');

  if (ready) {
    console.log(
      'READY FOR MANUAL PRODUCTION REBUILD IN SSMS.',
    );
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
