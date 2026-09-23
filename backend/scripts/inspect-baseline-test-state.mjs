import 'dotenv/config';

import { PrismaMssql } from '@prisma/adapter-mssql';
import { PrismaClient } from '../dist/generated/prisma/client.js';

const DATABASE = 'yacinedb_baseline_test';
const BASELINE = '20260923_baseline';

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
    DATABASE
  ) {
    throw new Error(
      `Safety stop: connected to ${identity?.currentDatabase}, expected ${DATABASE}.`,
    );
  }

  const tables = await prisma.$queryRawUnsafe(`
    SELECT
      s.name AS schemaName,
      t.name AS tableName
    FROM sys.tables t
    JOIN sys.schemas s
      ON s.schema_id = t.schema_id
    WHERE
      t.is_ms_shipped = 0
    ORDER BY
      s.name,
      t.name
  `);

  const hasMigrationTable =
    tables.some(
      (row) =>
        String(row.tableName) === '_prisma_migrations',
    );

  let migrations = [];

  if (hasMigrationTable) {
    migrations = await prisma.$queryRawUnsafe(`
      SELECT
        migration_name AS migrationName,
        started_at AS startedAt,
        finished_at AS finishedAt,
        rolled_back_at AS rolledBackAt,
        applied_steps_count AS appliedStepsCount
      FROM dbo._prisma_migrations
      ORDER BY started_at
    `);
  }

  const baselineRows = migrations.filter(
    (row) =>
      String(row.migrationName) === BASELINE,
  );

  const baselineApplied =
    baselineRows.length === 1 &&
    Boolean(baselineRows[0].finishedAt) &&
    !baselineRows[0].rolledBackAt;

  const failedOrRolledBack =
    baselineRows.some(
      (row) =>
        !row.finishedAt ||
        Boolean(row.rolledBackAt),
    );

  console.log('');
  console.log('BASELINE TEST DATABASE STATE');
  console.log('============================');
  console.log(`Database: ${identity?.currentDatabase}`);
  console.log(`User tables: ${tables.length}`);
  console.log(
    `Prisma migration table: ${hasMigrationTable ? 'YES' : 'NO'}`,
  );
  console.log(
    `Migration rows: ${migrations.length}`,
  );

  for (const row of migrations) {
    console.log(
      `- ${row.migrationName} | finished=${row.finishedAt ? 'YES' : 'NO'} | rolledBack=${row.rolledBackAt ? 'YES' : 'NO'}`,
    );
  }

  console.log('');
  console.log(
    `Validated baseline row applied: ${baselineApplied ? 'YES' : 'NO'}`,
  );

  if (baselineApplied && !failedOrRolledBack) {
    console.log(
      'RESUME_OK: baseline migration is already applied; continue with seed + verification.',
    );
    process.exitCode = 0;
    return;
  }

  console.log(
    'RESUME_BLOCKED: do not seed or register production yet.',
  );

  if (!hasMigrationTable) {
    console.log(
      'Reason: populated test DB has no Prisma migration history.',
    );
  } else if (baselineRows.length === 0) {
    console.log(
      'Reason: 20260923_baseline is not recorded as applied.',
    );
  } else if (failedOrRolledBack) {
    console.log(
      'Reason: baseline migration row is failed or rolled back.',
    );
  } else if (baselineRows.length > 1) {
    console.log(
      'Reason: duplicate baseline migration rows exist.',
    );
  }

  process.exitCode = 3;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });
