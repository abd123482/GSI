import 'dotenv/config';

import { PrismaMssql } from '@prisma/adapter-mssql';
import { PrismaClient } from '../dist/generated/prisma/client.js';

const DATABASE = 'yacinedb';

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
    String(identity?.currentDatabase ?? '').toLowerCase() !== DATABASE
  ) {
    throw new Error(
      `Safety stop: connected to ${identity?.currentDatabase}, expected ${DATABASE}.`,
    );
  }

  const exists = (
    await prisma.$queryRawUnsafe(`
      SELECT
        CASE
          WHEN OBJECT_ID(N'dbo._prisma_migrations', N'U') IS NULL
            THEN 0
          ELSE 1
        END AS existsFlag
    `)
  )[0];

  if (Number(exists?.existsFlag ?? 0) !== 1) {
    console.log('dbo._prisma_migrations does not exist.');
    return;
  }

  const rows = await prisma.$queryRawUnsafe(`
    SELECT
      id,
      migration_name AS migrationName,
      started_at AS startedAt,
      finished_at AS finishedAt,
      rolled_back_at AS rolledBackAt,
      applied_steps_count AS appliedStepsCount,
      logs
    FROM dbo._prisma_migrations
    ORDER BY started_at
  `);

  console.log('');
  console.log('PRODUCTION PRISMA MIGRATION HISTORY');
  console.log('===================================');
  console.log(`Database: ${identity?.currentDatabase}`);
  console.log(`Rows: ${rows.length}`);
  console.log('');

  for (const row of rows) {
    let status = 'UNKNOWN';

    if (row.rolledBackAt) {
      status = 'ROLLED_BACK';
    } else if (row.finishedAt) {
      status = 'APPLIED';
    } else {
      status = 'FAILED/INCOMPLETE';
    }

    console.log(
      [
        `Migration=${row.migrationName}`,
        `Status=${status}`,
        `Steps=${row.appliedStepsCount ?? '-'}`,
        `Started=${row.startedAt ?? '-'}`,
        `Finished=${row.finishedAt ?? '-'}`,
        `RolledBack=${row.rolledBackAt ?? '-'}`,
      ].join(' | '),
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });
