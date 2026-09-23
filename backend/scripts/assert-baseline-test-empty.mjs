import 'dotenv/config';

import { PrismaMssql } from '@prisma/adapter-mssql';
import { PrismaClient } from '../dist/generated/prisma/client.js';

const EXPECTED_DATABASE = 'yacinedb_baseline_test';

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

const database = required('DB_NAME');

if (database.toLowerCase() !== EXPECTED_DATABASE) {
  throw new Error(
    `Safety stop: DB_NAME must be ${EXPECTED_DATABASE}; got ${database}.`,
  );
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

async function main() {
  await prisma.$connect();

  const identity = (
    await prisma.$queryRawUnsafe(`
      SELECT
        @@SERVERNAME AS currentServer,
        DB_NAME() AS currentDatabase
    `)
  )[0];

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

  if (
    String(identity?.currentDatabase ?? '').toLowerCase() !==
    EXPECTED_DATABASE
  ) {
    throw new Error(
      `Connected to ${identity?.currentDatabase}; expected ${EXPECTED_DATABASE}.`,
    );
  }

  if (tables.length > 0) {
    throw new Error(
      [
        `Safety stop: ${EXPECTED_DATABASE} already contains ${tables.length} user table(s).`,
        'The baseline test must start from an empty database.',
        tables
          .map((row) => `${row.schemaName}.${row.tableName}`)
          .join(', '),
      ].join('\n'),
    );
  }

  console.log(
    `PASS: ${EXPECTED_DATABASE} exists and contains zero user tables.`,
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
