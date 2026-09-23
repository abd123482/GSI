import 'dotenv/config';

import { PrismaMssql } from '@prisma/adapter-mssql';
import { PrismaClient } from '../dist/generated/prisma/client.js';
import fs from 'node:fs';
import path from 'node:path';

function required(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
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

function jsonReplacer(_key, value) {
  if (typeof value === 'bigint') {
    return value.toString();
  }

  return value;
}

const prisma = makeClient();

async function raw(sql) {
  return prisma.$queryRawUnsafe(sql);
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

  /*
   * SQL Server treats ROWCOUNT as a keyword.
   * Use totalRows instead of the previous unquoted rowCount alias.
   */
  const userTables = await raw(`
    SELECT
      s.name AS schemaName,
      t.name AS tableName,
      SUM(
        CASE
          WHEN p.index_id IN (0, 1) THEN p.rows
          ELSE 0
        END
      ) AS totalRows
    FROM sys.tables t
    JOIN sys.schemas s
      ON s.schema_id = t.schema_id
    LEFT JOIN sys.partitions p
      ON p.object_id = t.object_id
    WHERE t.is_ms_shipped = 0
    GROUP BY
      s.name,
      t.name
    ORDER BY
      s.name,
      t.name
  `);

  let backupHistoryAccessible = true;
  let backupHistoryError = null;
  let backupHistory = [];

  try {
    backupHistory = await raw(`
      SELECT TOP (200)
        bs.database_name AS databaseName,
        bs.type AS backupTypeCode,
        bs.backup_start_date AS backupStart,
        bs.backup_finish_date AS backupFinish,
        bs.backup_size AS backupSizeBytes,
        bs.compressed_backup_size AS compressedBackupSizeBytes,
        bs.recovery_model AS recoveryModel,
        bs.is_copy_only AS isCopyOnly,
        bmf.physical_device_name AS physicalDevice
      FROM msdb.dbo.backupset bs
      LEFT JOIN msdb.dbo.backupmediafamily bmf
        ON bmf.media_set_id = bs.media_set_id
      WHERE
        LOWER(bs.database_name) =
        LOWER(DB_NAME())
      ORDER BY
        bs.backup_finish_date DESC
    `);
  } catch (error) {
    backupHistoryAccessible = false;
    backupHistoryError =
      error instanceof Error
        ? error.message
        : String(error);
  }

  let restoreHistoryAccessible = true;
  let restoreHistoryError = null;
  let restoreHistory = [];

  try {
    restoreHistory = await raw(`
      SELECT TOP (200)
        rh.destination_database_name AS destinationDatabase,
        rh.restore_date AS restoreDate,
        rh.restore_type AS restoreType,
        rh.replace AS usedReplace,
        rh.recovery AS recovery,
        bs.database_name AS sourceDatabase,
        bs.backup_finish_date AS sourceBackupFinish,
        bmf.physical_device_name AS sourcePhysicalDevice
      FROM msdb.dbo.restorehistory rh
      LEFT JOIN msdb.dbo.backupset bs
        ON bs.backup_set_id = rh.backup_set_id
      LEFT JOIN msdb.dbo.backupmediafamily bmf
        ON bmf.media_set_id = bs.media_set_id
      WHERE
        LOWER(rh.destination_database_name) =
          LOWER(DB_NAME())
        OR LOWER(bs.database_name) =
          LOWER(DB_NAME())
      ORDER BY
        rh.restore_date DESC
    `);
  } catch (error) {
    restoreHistoryAccessible = false;
    restoreHistoryError =
      error instanceof Error
        ? error.message
        : String(error);
  }

  const fullBackups = backupHistory.filter(
    (row) =>
      String(
        row.backupTypeCode ?? '',
      ).toUpperCase() === 'D',
  );

  const nonSystemUserTables = userTables.filter(
    (row) =>
      String(row.tableName) !==
      '_prisma_migrations',
  );

  let decision =
    'STOP_REVIEW_REQUIRED';

  const reasons = [];

  if (!backupHistoryAccessible) {
    reasons.push(
      'msdb backup history could not be read; do not assume no backup exists.',
    );
  }

  if (!restoreHistoryAccessible) {
    reasons.push(
      'msdb restore history could not be read.',
    );
  }

  if (fullBackups.length > 0) {
    reasons.push(
      `${fullBackups.length} FULL backup record(s) exist for the current database; recovery should be evaluated before rebuilding.`,
    );
  }

  if (nonSystemUserTables.length > 0) {
    reasons.push(
      `${nonSystemUserTables.length} user table(s) still exist in the current database; clean rebuild must not overwrite them without review.`,
    );
  }

  if (
    backupHistoryAccessible &&
    restoreHistoryAccessible &&
    fullBackups.length === 0 &&
    nonSystemUserTables.length === 0
  ) {
    decision =
      'READY_TO_GENERATE_REBUILD_CANDIDATE';

    reasons.push(
      'No FULL backup record was found in readable msdb history and the current database has no user tables.',
    );
  }

  const report = {
    generatedAt:
      new Date().toISOString(),

    identity,
    decision,
    reasons,

    userTables,
    nonSystemUserTableCount:
      nonSystemUserTables.length,

    backupHistoryAccessible,
    backupHistoryError,
    backupHistory,
    fullBackupCount:
      fullBackups.length,

    restoreHistoryAccessible,
    restoreHistoryError,
    restoreHistory,
  };

  const outputPath =
    path.resolve(
      process.cwd(),
      'sql',
      'rebuild-readiness-report.json',
    );

  fs.mkdirSync(
    path.dirname(outputPath),
    {
      recursive: true,
    },
  );

  fs.writeFileSync(
    outputPath,
    JSON.stringify(
      report,
      jsonReplacer,
      2,
    ),
    'utf8',
  );

  console.log('');
  console.log(
    'SOMIPHARM CLEAN REBUILD READINESS',
  );
  console.log(
    '=================================',
  );

  console.log(
    `Server:   ${
      identity?.currentServer ??
      'unknown'
    }`,
  );

  console.log(
    `Database: ${
      identity?.currentDatabase ??
      'unknown'
    }`,
  );

  console.log(
    `User tables: ${nonSystemUserTables.length}`,
  );

  console.log(
    `FULL backups in msdb: ${fullBackups.length}`,
  );

  console.log(
    `Backup history readable: ${
      backupHistoryAccessible
        ? 'YES'
        : 'NO'
    }`,
  );

  console.log(
    `Restore history readable: ${
      restoreHistoryAccessible
        ? 'YES'
        : 'NO'
    }`,
  );

  console.log('');
  console.log(
    `DECISION: ${decision}`,
  );

  for (const reason of reasons) {
    console.log(`- ${reason}`);
  }

  console.log('');
  console.log(
    `Report saved to: ${outputPath}`,
  );

  if (
    decision ===
    'READY_TO_GENERATE_REBUILD_CANDIDATE'
  ) {
    process.exitCode = 0;
  } else {
    process.exitCode = 2;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma
      .$disconnect()
      .catch(
        () => undefined,
      );
  });
