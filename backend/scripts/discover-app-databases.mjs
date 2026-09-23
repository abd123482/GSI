import 'dotenv/config';

import { PrismaMssql } from '@prisma/adapter-mssql';
import { PrismaClient } from '../dist/generated/prisma/client.js';
import fs from 'node:fs';
import path from 'node:path';

const EXPECTED_TABLES = [
  'Stock',
  'StockStatus',
  'Shelf',
  'Equipment',
  'EquipmentShelfs',
  'SerialNumber',
  'Mouvement',
  'MovementEquipment',
  'Inventory',
  'InventoryWorkUnit',
  'InventoryCountAttempt',
  'Order',
];

const STRONG_HINTS = [
  'Stock',
  'Shelf',
  'Equipment',
  'SerialNumber',
  'Mouvement',
  'Inventory',
];

function required(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

function quoteSqlIdentifier(identifier) {
  return `[${String(identifier).replaceAll(']', ']]')}]`;
}

function makeClient() {
  const adapter = new PrismaMssql({
    server: required('DB_HOST'),
    port: Number(process.env.DB_PORT ?? 1433),
    database: required('DB_NAME'),
    user: required('DB_USER'),
    password: required('DB_PASSWORD'),
    options: {
      encrypt: true,
      trustServerCertificate: true,
    },
  });

  return new PrismaClient({ adapter });
}

const prisma = makeClient();

async function raw(sql) {
  return prisma.$queryRawUnsafe(sql);
}

async function inspectDatabase(databaseName) {
  const db = quoteSqlIdentifier(databaseName);

  try {
    const tables = await raw(`
      SELECT t.name AS tableName
      FROM ${db}.sys.tables t
      WHERE t.is_ms_shipped = 0
      ORDER BY t.name
    `);

    const tableNames = tables.map((row) => String(row.tableName));
    const set = new Set(tableNames);

    const expectedFound = EXPECTED_TABLES.filter((name) => set.has(name));
    const strongFound = STRONG_HINTS.filter((name) => set.has(name));

    return {
      databaseName,
      accessible: true,
      expectedFound,
      expectedCount: expectedFound.length,
      strongHintsFound: strongFound,
      strongHintCount: strongFound.length,
      totalUserTables: tableNames.length,
      allUserTables: tableNames,
    };
  } catch (error) {
    return {
      databaseName,
      accessible: false,
      expectedFound: [],
      expectedCount: 0,
      strongHintsFound: [],
      strongHintCount: 0,
      totalUserTables: 0,
      allUserTables: [],
      error:
        error instanceof Error
          ? error.message
          : String(error),
    };
  }
}

async function main() {
  await prisma.$connect();

  const identity = (
    await raw(`
      SELECT
        @@SERVERNAME AS currentServer,
        DB_NAME() AS currentDatabase,
        SUSER_SNAME() AS loginName
    `)
  )[0];

  const databases = await raw(`
    SELECT
      name,
      state_desc AS stateDesc,
      recovery_model_desc AS recoveryModel,
      create_date AS createDate
    FROM sys.databases
    WHERE
      state_desc = 'ONLINE'
      AND HAS_DBACCESS(name) = 1
    ORDER BY name
  `);

  const inspected = [];

  for (const database of databases) {
    inspected.push(
      await inspectDatabase(String(database.name)),
    );
  }

  inspected.sort((a, b) => {
    if (b.expectedCount !== a.expectedCount) {
      return b.expectedCount - a.expectedCount;
    }

    if (b.strongHintCount !== a.strongHintCount) {
      return b.strongHintCount - a.strongHintCount;
    }

    return a.databaseName.localeCompare(b.databaseName);
  });

  const candidates = inspected.filter(
    (db) => db.expectedCount > 0 || db.strongHintCount > 0,
  );

  const exactCandidates = inspected.filter(
    (db) => db.expectedCount === EXPECTED_TABLES.length,
  );

  const report = {
    generatedAt: new Date().toISOString(),
    server: identity?.currentServer ?? null,
    currentDatabase: identity?.currentDatabase ?? null,
    loginName: identity?.loginName ?? null,
    expectedTables: EXPECTED_TABLES,
    exactCandidateCount: exactCandidates.length,
    candidateCount: candidates.length,
    exactCandidates: exactCandidates.map((db) => db.databaseName),
    candidates,
    allAccessibleDatabases: inspected.map((db) => ({
      databaseName: db.databaseName,
      accessible: db.accessible,
      expectedCount: db.expectedCount,
      strongHintCount: db.strongHintCount,
      totalUserTables: db.totalUserTables,
      error: db.error,
    })),
  };

  const outputPath = path.resolve(
    process.cwd(),
    'sql',
    'database-discovery-report.json',
  );

  fs.mkdirSync(path.dirname(outputPath), {
    recursive: true,
  });

  fs.writeFileSync(
    outputPath,
    JSON.stringify(report, null, 2),
    'utf8',
  );

  console.log('');
  console.log('SOMIPHARM DATABASE DISCOVERY');
  console.log('============================');
  console.log(`Server:           ${report.server ?? 'unknown'}`);
  console.log(`Current database: ${report.currentDatabase ?? 'unknown'}`);
  console.log(`Accessible DBs:   ${inspected.length}`);
  console.log('');

  if (candidates.length === 0) {
    console.log(
      'NO candidate database contains any of the expected SOMIPHARM tables.',
    );
    console.log('');
    console.log(
      'This strongly suggests the schema was deleted/reset, or exists on another SQL Server instance/login.',
    );
  } else {
    console.log('Candidates ranked by expected table count:');
    console.log('');

    for (const db of candidates) {
      console.log(
        `${db.databaseName.padEnd(32)} ${String(db.expectedCount).padStart(2)}/${EXPECTED_TABLES.length} expected tables`,
      );

      if (db.expectedFound.length > 0) {
        console.log(`  found: ${db.expectedFound.join(', ')}`);
      }

      if (db.totalUserTables > 0) {
        console.log(`  user tables total: ${db.totalUserTables}`);
      }
    }
  }

  console.log('');
  console.log(`Report saved to: ${outputPath}`);

  if (exactCandidates.length === 1) {
    console.log('');
    console.log(
      `LIKELY APPLICATION DATABASE: ${exactCandidates[0].databaseName}`,
    );
    process.exitCode = 0;
    return;
  }

  if (exactCandidates.length > 1) {
    console.log('');
    console.log(
      'Multiple databases contain all expected tables. Manual review is required.',
    );
    process.exitCode = 2;
    return;
  }

  if (candidates.length > 0) {
    console.log('');
    console.log(
      'Partial candidate(s) found. Do not change .env yet; review the report first.',
    );
    process.exitCode = 3;
    return;
  }

  process.exitCode = 4;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });
