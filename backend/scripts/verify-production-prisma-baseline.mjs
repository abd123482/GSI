import 'dotenv/config';

import { PrismaMssql } from '@prisma/adapter-mssql';
import { PrismaClient } from '../dist/generated/prisma/client.js';

const DATABASE = 'yacinedb';
const BASELINE_NAME = '20260923_baseline';

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
      SELECT DB_NAME() AS currentDatabase
    `)
  )[0];

  if (
    String(identity?.currentDatabase ?? '').toLowerCase() !==
    DATABASE
  ) {
    throw new Error(
      `Connected to ${identity?.currentDatabase}; expected ${DATABASE}.`,
    );
  }

  const rows = await prisma.$queryRawUnsafe(`
    SELECT
      migration_name AS migrationName,
      finished_at AS finishedAt,
      rolled_back_at AS rolledBackAt
    FROM dbo._prisma_migrations
    ORDER BY started_at
  `);

  const goodBaselineRows = rows.filter(
    (row) =>
      String(row.migrationName) === BASELINE_NAME &&
      row.finishedAt &&
      !row.rolledBackAt,
  );

  if (
    rows.length !== 1 ||
    goodBaselineRows.length !== 1
  ) {
    throw new Error(
      [
        'Production Prisma history is not clean.',
        `Rows: ${rows
          .map((row) => row.migrationName)
          .join(', ')}`,
      ].join('\n'),
    );
  }

  console.log('');
  console.log('PRODUCTION PRISMA HISTORY VERIFIED');
  console.log('==================================');
  console.log(`Database: ${DATABASE}`);
  console.log(`Migration row: ${BASELINE_NAME}`);
  console.log('Status: APPLIED');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });
