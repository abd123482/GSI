import 'dotenv/config';

import { PrismaMssql } from '@prisma/adapter-mssql';
import { PrismaClient } from '../dist/generated/prisma/client.js';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const DATABASE = 'yacinedb';
const BASELINE_NAME = '20260923_baseline';

const REQUIRED_CONFIRMATION =
  'I CONFIRM REPLACE LEGACY PRISMA HISTORY WITH VALIDATED BASELINE';

/*
 * These are the ONLY historical migration names allowed to be removed from the
 * rebuilt production database. They are metadata from the pre-baseline chain.
 *
 * Their status may be APPLIED, FAILED/INCOMPLETE, or ROLLED_BACK. The current
 * production schema is no longer derived from these rows: it has already been
 * rebuilt and independently validated, and the replacement baseline has passed
 * from-zero testing in yacinedb_baseline_test.
 */
const LEGACY_MIGRATIONS = new Set([
  '0_init',
  '20260907_finish_clerk_auth',
  '20260914_add_order_table',
]);

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

function jsonReplacer(_key, value) {
  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return value;
}

function migrationStatus(row) {
  if (row.rolledBackAt) return 'ROLLED_BACK';
  if (row.finishedAt) return 'APPLIED';
  return 'FAILED_OR_INCOMPLETE';
}

const confirmation =
  required('PRISMA_REBASELINE_CONFIRMATION');

if (confirmation !== REQUIRED_CONFIRMATION) {
  throw new Error(
    [
      'Safety confirmation did not match.',
      `Required: ${REQUIRED_CONFIRMATION}`,
    ].join('\n'),
  );
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

  const baselineSqlPath = path.resolve(
    process.cwd(),
    'prisma',
    'migrations',
    BASELINE_NAME,
    'migration.sql',
  );

  for (const requiredPath of [
    testReportPath,
    manifestPath,
    baselineSqlPath,
  ]) {
    if (!fs.existsSync(requiredPath)) {
      throw new Error(
        `Required validated-baseline artifact missing: ${requiredPath}`,
      );
    }
  }

  const testReport = JSON.parse(
    fs.readFileSync(testReportPath, 'utf8'),
  );

  if (!testReport.passed) {
    throw new Error(
      'Safety stop: isolated clean Prisma baseline test is not PASS.',
    );
  }

  const manifest = JSON.parse(
    fs.readFileSync(manifestPath, 'utf8'),
  );

  const currentHash = sha256(
    fs.readFileSync(baselineSqlPath),
  );

  if (
    currentHash !== manifest.migrationSha256 ||
    currentHash !== testReport.migrationHash
  ) {
    throw new Error(
      'Safety stop: baseline migration changed after isolated validation.',
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

  if (
    String(identity?.currentDatabase ?? '').toLowerCase() !== DATABASE
  ) {
    throw new Error(
      `Safety stop: connected to ${identity?.currentDatabase}, not ${DATABASE}.`,
    );
  }

  const tableRows = await prisma.$queryRawUnsafe(`
    SELECT name
    FROM sys.tables
    WHERE name IN (
      ${EXPECTED_TABLES.map((name) => `N'${name}'`).join(',')}
    )
    ORDER BY name
  `);

  const foundTables = new Set(
    tableRows.map((row) => String(row.name)),
  );

  const missingTables = EXPECTED_TABLES.filter(
    (name) => !foundTables.has(name),
  );

  if (missingTables.length > 0) {
    throw new Error(
      `Safety stop: production is missing expected table(s): ${missingTables.join(', ')}`,
    );
  }

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

  const triggerMap = new Map(
    triggerRows.map((row) => [String(row.name), row]),
  );

  const badTriggers = EXPECTED_TRIGGERS.filter((name) => {
    const row = triggerMap.get(name);
    return !row || Boolean(row.isDisabled);
  });

  if (badTriggers.length > 0) {
    throw new Error(
      `Safety stop: production hardening trigger problem: ${badTriggers.join(', ')}`,
    );
  }

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

  if (fkProblems.length > 0) {
    throw new Error(
      `Safety stop: production has ${fkProblems.length} disabled/untrusted FK(s).`,
    );
  }

  const fullBackups = await prisma.$queryRawUnsafe(`
    SELECT TOP (1)
      bs.backup_finish_date AS backupFinish,
      bmf.physical_device_name AS backupDevice
    FROM msdb.dbo.backupset bs
    LEFT JOIN msdb.dbo.backupmediafamily bmf
      ON bmf.media_set_id = bs.media_set_id
    WHERE
      LOWER(bs.database_name) = LOWER(N'yacinedb')
      AND bs.type = 'D'
    ORDER BY
      bs.backup_finish_date DESC
  `);

  if (fullBackups.length === 0) {
    throw new Error(
      'Safety stop: no FULL yacinedb backup is recorded in msdb.',
    );
  }

  const migrationTable = (
    await prisma.$queryRawUnsafe(`
      SELECT
        CASE
          WHEN OBJECT_ID(N'dbo._prisma_migrations', N'U') IS NULL
            THEN 0
          ELSE 1
        END AS existsFlag
    `)
  )[0];

  if (Number(migrationTable?.existsFlag ?? 0) !== 1) {
    throw new Error(
      'Safety stop: dbo._prisma_migrations does not exist.',
    );
  }

  const rows = await prisma.$queryRawUnsafe(`
    SELECT
      id,
      checksum,
      finished_at AS finishedAt,
      migration_name AS migrationName,
      logs,
      rolled_back_at AS rolledBackAt,
      started_at AS startedAt,
      applied_steps_count AS appliedStepsCount
    FROM dbo._prisma_migrations
    ORDER BY started_at
  `);

  const unknown = rows.filter((row) => {
    const name = String(row.migrationName);

    return (
      name !== BASELINE_NAME &&
      !LEGACY_MIGRATIONS.has(name)
    );
  });

  if (unknown.length > 0) {
    throw new Error(
      [
        'Safety stop: production contains unexpected Prisma migration history.',
        `Unexpected names: ${unknown
          .map((row) => row.migrationName)
          .join(', ')}`,
        'No migration-history rows were changed.',
      ].join('\n'),
    );
  }

  const baselineRows = rows.filter(
    (row) =>
      String(row.migrationName) === BASELINE_NAME,
  );

  if (baselineRows.length > 1) {
    throw new Error(
      'Safety stop: more than one production baseline row exists.',
    );
  }

  const legacyRows = rows.filter((row) =>
    LEGACY_MIGRATIONS.has(
      String(row.migrationName),
    ),
  );

  const archiveDir = path.resolve(
    process.cwd(),
    'sql',
    'generated',
  );

  fs.mkdirSync(archiveDir, {
    recursive: true,
  });

  const timestamp = new Date()
    .toISOString()
    .replaceAll(':', '-')
    .replaceAll('.', '-');

  const archivePath = path.join(
    archiveDir,
    `production-prisma-legacy-history-${timestamp}.json`,
  );

  fs.writeFileSync(
    archivePath,
    JSON.stringify(
      {
        archivedAt: new Date().toISOString(),
        database: DATABASE,
        server: identity?.currentServer,
        backup: fullBackups[0],
        baselineName: BASELINE_NAME,
        validatedBaselineHash: currentHash,
        migrationRows: rows.map((row) => ({
          ...row,
          derivedStatus: migrationStatus(row),
        })),
      },
      jsonReplacer,
      2,
    ),
    'utf8',
  );

  console.log('');
  console.log('PRODUCTION PRISMA HISTORY REBASELINE');
  console.log('====================================');
  console.log(`Database: ${identity?.currentDatabase}`);
  console.log(
    `Validated schema tables: ${foundTables.size}/${EXPECTED_TABLES.length}`,
  );
  console.log(
    `Validated triggers: ${triggerRows.length}/${EXPECTED_TRIGGERS.length}`,
  );
  console.log(`FK problems: ${fkProblems.length}`);
  console.log(
    `Latest FULL backup: ${fullBackups[0]?.backupDevice ?? 'record found'}`,
  );
  console.log(
    `Validated baseline SHA256: ${currentHash}`,
  );
  console.log('');
  console.log('Existing migration metadata:');

  if (rows.length === 0) {
    console.log('- (none)');
  } else {
    for (const row of rows) {
      console.log(
        `- ${row.migrationName} [${migrationStatus(row)}]`,
      );
    }
  }

  console.log('');
  console.log(`Archived migration metadata: ${archivePath}`);
  console.log('');

  /*
   * At this point all gates have passed:
   * - tested replacement baseline is PASS;
   * - exact baseline hash matches the tested artifact;
   * - production schema/triggers/FKs are independently healthy;
   * - a FULL backup exists;
   * - every non-baseline migration row is one of the explicitly known legacy
   *   names.
   *
   * Therefore failed/rolled-back status on those legacy rows is metadata from
   * the broken pre-baseline history, not a reason to keep that history.
   */
  if (legacyRows.length > 0) {
    const legacyNames = [...LEGACY_MIGRATIONS]
      .map((name) => `N'${name}'`)
      .join(',');

    const deleted = await prisma.$executeRawUnsafe(`
      DELETE FROM dbo._prisma_migrations
      WHERE migration_name IN (${legacyNames});
    `);

    console.log(
      `Removed ${deleted} known legacy Prisma migration-history row(s).`,
    );
  } else {
    console.log(
      'No known legacy migration rows remain.',
    );
  }

  const remaining = await prisma.$queryRawUnsafe(`
    SELECT
      migration_name AS migrationName,
      finished_at AS finishedAt,
      rolled_back_at AS rolledBackAt
    FROM dbo._prisma_migrations
    ORDER BY started_at
  `);

  const baselineAlreadyApplied = remaining.some(
    (row) =>
      String(row.migrationName) === BASELINE_NAME &&
      row.finishedAt &&
      !row.rolledBackAt,
  );

  const unexpectedRemaining = remaining.filter(
    (row) =>
      String(row.migrationName) !== BASELINE_NAME,
  );

  if (unexpectedRemaining.length > 0) {
    throw new Error(
      [
        'Post-cleanup safety stop: unexpected migration rows remain.',
        unexpectedRemaining
          .map((row) => row.migrationName)
          .join(', '),
        `Archive: ${archivePath}`,
      ].join('\n'),
    );
  }

  const statePath = path.resolve(
    process.cwd(),
    'sql',
    'generated',
    'production-prisma-rebaseline-state.json',
  );

  fs.writeFileSync(
    statePath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        archivePath,
        baselineName: BASELINE_NAME,
        baselineAlreadyApplied,
        remainingMigrationRows: remaining,
      },
      jsonReplacer,
      2,
    ),
    'utf8',
  );

  console.log(
    `Baseline already applied: ${baselineAlreadyApplied ? 'YES' : 'NO'}`,
  );
  console.log(`State: ${statePath}`);
  console.log('');
  console.log(
    baselineAlreadyApplied
      ? 'READY: legacy history removed; baseline already registered.'
      : 'READY: legacy history removed; validated baseline may now be registered with migrate resolve --applied.',
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
