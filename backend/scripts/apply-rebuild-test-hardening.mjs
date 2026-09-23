import 'dotenv/config';

import { PrismaMssql } from '@prisma/adapter-mssql';
import { PrismaClient } from '../dist/generated/prisma/client.js';
import fs from 'node:fs';
import path from 'node:path';

const TARGET =
  process.env.REBUILD_DB_NAME ??
  'yacinedb_rebuild_test';

const EXPECTED_TRIGGERS = [
  'TR_Shelf_RequireActiveStock',
  'TR_EquipmentShelfs_RequireActiveStock',
  'TR_Mouvement_RequireActiveStocks',
  'TR_SerialNumber_Guards',
  'TR_InventoryWorkUnit_AcceptedAttempt',
  'TR_MovementEquipment_MatchHeader',
];

if (
  !/^yacinedb_rebuild_test(?:_[A-Za-z0-9_]+)?$/i.test(
    TARGET,
  )
) {
  throw new Error(
    `Safety stop: hardening target must be an isolated yacinedb_rebuild_test* database. Received: ${TARGET}`,
  );
}

if (
  TARGET.toLowerCase() ===
  'yacinedb'
) {
  throw new Error(
    'Safety stop: this runner never modifies the real yacinedb.',
  );
}

function required(name) {
  const value =
    process.env[name];

  if (!value) {
    throw new Error(
      `Missing environment variable: ${name}`,
    );
  }

  return value;
}

function splitBatches(sql) {
  return sql
    .split(
      /^\s*GO\s*;?\s*$/gim,
    )
    .map(
      (batch) =>
        batch.trim(),
    )
    .filter(Boolean);
}

const adapter =
  new PrismaMssql({
    server:
      required('DB_HOST'),

    port:
      Number(
        process.env.DB_PORT ??
          1433,
      ),

    database:
      TARGET,

    user:
      required('DB_USER'),

    password:
      required('DB_PASSWORD'),

    options: {
      encrypt: true,
      trustServerCertificate: true,
    },
  });

const prisma =
  new PrismaClient({
    adapter,
  });

async function main() {
  const verificationPath =
    path.resolve(
      process.cwd(),
      'sql',
      'generated',
      `${TARGET}-verification-report.json`,
    );

  if (
    !fs.existsSync(
      verificationPath,
    )
  ) {
    throw new Error(
      `Safety stop: test DB verification report not found: ${verificationPath}`,
    );
  }

  const verification =
    JSON.parse(
      fs.readFileSync(
        verificationPath,
        'utf8',
      ),
    );

  if (
    verification.databaseName !==
    TARGET
  ) {
    throw new Error(
      `Verification report belongs to ${verification.databaseName}, not ${TARGET}.`,
    );
  }

  if (
    verification.foundTableCount !==
    verification.expectedTableCount
  ) {
    throw new Error(
      'Safety stop: test DB core schema verification did not pass.',
    );
  }

  if (
    Array.isArray(
      verification.foreignKeyProblems,
    ) &&
    verification
      .foreignKeyProblems
      .length > 0
  ) {
    throw new Error(
      'Safety stop: test DB has disabled/untrusted foreign keys.',
    );
  }

  const sqlPath =
    path.resolve(
      process.cwd(),
      'sql',
      'rebuild_test_hardening.sql',
    );

  if (
    !fs.existsSync(
      sqlPath,
    )
  ) {
    throw new Error(
      `Hardening SQL not found: ${sqlPath}`,
    );
  }

  await prisma.$connect();

  const identity =
    (
      await prisma.$queryRawUnsafe(`
        SELECT
          @@SERVERNAME AS currentServer,
          DB_NAME() AS currentDatabase
      `)
    )[0];

  if (
    String(
      identity?.currentDatabase ??
        '',
    ).toLowerCase() !==
    TARGET.toLowerCase()
  ) {
    throw new Error(
      `Connected DB mismatch: expected ${TARGET}, got ${identity?.currentDatabase}.`,
    );
  }

  const sql =
    fs.readFileSync(
      sqlPath,
      'utf8',
    );

  const batches =
    splitBatches(
      sql,
    );

  console.log('');
  console.log(
    'SOMIPHARM REBUILD TEST HARDENING',
  );
  console.log(
    '================================',
  );
  console.log(
    `Database: ${TARGET}`,
  );
  console.log(
    `SQL batches: ${batches.length}`,
  );
  console.log('');

  for (
    let i = 0;
    i < batches.length;
    i += 1
  ) {
    console.log(
      `Applying batch ${i + 1}/${batches.length}...`,
    );

    await prisma
      .$executeRawUnsafe(
        batches[i],
      );
  }

  const triggerRows =
    await prisma.$queryRawUnsafe(`
      SELECT
        tr.name,
        tr.is_disabled AS isDisabled,
        OBJECT_NAME(tr.parent_id) AS parentTable
      FROM sys.triggers tr
      WHERE tr.name IN (
        ${EXPECTED_TRIGGERS
          .map(
            (name) =>
              `N'${name}'`,
          )
          .join(',')}
      )
      ORDER BY tr.name
    `);

  const byName =
    new Map(
      triggerRows.map(
        (row) => [
          row.name,
          row,
        ],
      ),
    );

  const problems = [];

  for (
    const triggerName of
    EXPECTED_TRIGGERS
  ) {
    const trigger =
      byName.get(
        triggerName,
      );

    if (!trigger) {
      problems.push({
        triggerName,
        problem:
          'MISSING',
      });
    } else if (
      trigger.isDisabled
    ) {
      problems.push({
        triggerName,
        problem:
          'DISABLED',
      });
    }
  }

  const report = {
    generatedAt:
      new Date()
        .toISOString(),

    database:
      TARGET,

    triggerCount:
      triggerRows.length,

    expectedTriggerCount:
      EXPECTED_TRIGGERS.length,

    triggers:
      triggerRows,

    problems,

    nextPhase:
      problems.length === 0
        ? 'Run backend/API smoke tests against this isolated hardened database.'
        : 'Fix trigger installation before application smoke testing.',
  };

  const reportPath =
    path.resolve(
      process.cwd(),
      'sql',
      'generated',
      `${TARGET}-hardening-report.json`,
    );

  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      report,
      null,
      2,
    ),
    'utf8',
  );

  console.log('');
  console.log(
    `Triggers: ${triggerRows.length}/${EXPECTED_TRIGGERS.length}`,
  );

  for (
    const trigger of
    triggerRows
  ) {
    console.log(
      `  ${trigger.isDisabled ? 'DISABLED' : 'ENABLED '} ${trigger.name} on ${trigger.parentTable}`,
    );
  }

  console.log('');
  console.log(
    `Report: ${reportPath}`,
  );

  if (
    problems.length > 0
  ) {
    process.exitCode = 3;
  }
}

main()
  .catch(
    (error) => {
      console.error(
        error,
      );

      process.exitCode = 1;
    },
  )
  .finally(
    async () => {
      await prisma
        .$disconnect()
        .catch(
          () => undefined,
        );
    },
  );
