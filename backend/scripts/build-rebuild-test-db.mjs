import 'dotenv/config';

import { PrismaMssql } from '@prisma/adapter-mssql';
import { PrismaClient } from '../dist/generated/prisma/client.js';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const DB_NAME =
  process.env.REBUILD_DB_NAME ??
  'yacinedb_rebuild_test';

if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(DB_NAME)) {
  throw new Error(
    'REBUILD_DB_NAME may contain only letters, digits and underscore and must start with a letter.',
  );
}

if (
  DB_NAME.toLowerCase() ===
  'yacinedb'
) {
  throw new Error(
    'Safety stop: this runner never modifies the real yacinedb.',
  );
}

const ALL_SYSTEM_PERMISSIONS = [
  'equipment.read',
  'equipment.create',
  'equipment.update',
  'equipment.delete',
  'serial-number.read',
  'serial-number.create',
  'serial-number.update',
  'serial-number.delete',
  'movement.read',
  'movement.create',
  'shelf.read',
  'shelf.create',
  'shelf.update',
  'shelf.delete',
  'stock.read',
  'stock.create',
  'stock.update',
  'stock.delete',
  'user.manage',
  'role.manage',
  'dashboard.read',
  'inventory.read',
  'inventory.create',
  'inventory.launch',
  'inventory.count',
  'inventory.adjudicate',
  'inventory.finalize',
  'inventory.delete',
];

const TECHNICIAN_PERMISSIONS = [
  'equipment.read',
  'serial-number.read',
  'movement.read',
  'movement.create',
  'shelf.read',
];

function required(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(
      `Missing environment variable: ${name}`,
    );
  }

  return value;
}

function adapterFor(database) {
  return new PrismaMssql({
    server: required('DB_HOST'),
    port: Number(
      process.env.DB_PORT ??
        1433,
    ),
    database,
    user: required('DB_USER'),
    password: required('DB_PASSWORD'),
    options: {
      encrypt: true,
      trustServerCertificate: true,
    },
  });
}

function clientFor(database) {
  return new PrismaClient({
    adapter:
      adapterFor(database),
  });
}

function q(identifier) {
  return `[${String(identifier)
    .replaceAll(']', ']]')}]`;
}

function sha256(buffer) {
  return crypto
    .createHash('sha256')
    .update(buffer)
    .digest('hex')
    .toUpperCase();
}

function splitSqlBatches(sql) {
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

async function assertPrerequisites() {
  const readinessPath =
    path.resolve(
      process.cwd(),
      'sql',
      'rebuild-readiness-report.json',
    );

  const sqlPath =
    path.resolve(
      process.cwd(),
      'sql',
      'generated',
      'current-schema-rebuild-candidate.sql',
    );

  const hashPath =
    path.resolve(
      process.cwd(),
      'sql',
      'generated',
      'current-schema-rebuild-candidate.sha256.txt',
    );

  for (
    const requiredPath of [
      readinessPath,
      sqlPath,
      hashPath,
    ]
  ) {
    if (
      !fs.existsSync(
        requiredPath,
      )
    ) {
      throw new Error(
        `Required file missing: ${requiredPath}`,
      );
    }
  }

  const readiness =
    JSON.parse(
      fs.readFileSync(
        readinessPath,
        'utf8',
      ),
    );

  if (
    readiness.decision !==
    'READY_TO_GENERATE_REBUILD_CANDIDATE'
  ) {
    throw new Error(
      `Rebuild readiness is not approved. Decision=${readiness.decision}`,
    );
  }

  const sqlBytes =
    fs.readFileSync(
      sqlPath,
    );

  const expectedHash =
    fs.readFileSync(
      hashPath,
      'utf8',
    )
      .trim()
      .toUpperCase();

  const actualHash =
    sha256(sqlBytes);

  if (
    expectedHash !==
    actualHash
  ) {
    throw new Error(
      'Generated schema candidate hash does not match. Regenerate the candidate.',
    );
  }

  const sql =
    sqlBytes.toString(
      'utf8',
    );

  const forbidden = [
    /^\s*DROP\s+/gim,
    /^\s*TRUNCATE\s+/gim,
    /^\s*DELETE\s+/gim,
    /^\s*UPDATE\s+/gim,
    /^\s*RESTORE\s+DATABASE\s+/gim,
    /^\s*ALTER\s+DATABASE\s+\[?yacinedb\]?\b/gim,
  ];

  for (
    const pattern of forbidden
  ) {
    if (
      pattern.test(sql)
    ) {
      throw new Error(
        `Generated candidate contains forbidden operation matching ${pattern}.`,
      );
    }
  }

  return {
    sql,
    hash:
      actualHash,
  };
}

/*
 * NEW behavior:
 *
 * The application login does not need server-level CREATE DATABASE permission.
 * If the isolated DB was pre-created by an administrator, reuse it ONLY when:
 *   - it is not yacinedb;
 *   - app login can connect;
 *   - it contains zero user tables.
 *
 * If it is missing, we try CREATE DATABASE for convenience. If SQL Server
 * denies it, a clear instruction points to the SSMS admin script.
 */
async function ensureEmptyIsolatedDatabase() {
  const master =
    clientFor('master');

  let exists =
    false;

  try {
    await master.$connect();

    const existing =
      await master.$queryRawUnsafe(`
        SELECT
          name
        FROM sys.databases
        WHERE
          name =
          N'${DB_NAME
            .replaceAll("'", "''")}'
      `);

    exists =
      existing.length > 0;

    if (!exists) {
      console.log(
        `Isolated database ${DB_NAME} does not exist.`,
      );

      console.log(
        'Attempting CREATE DATABASE with the application login...',
      );

      try {
        await master
          .$executeRawUnsafe(
            `CREATE DATABASE ${q(DB_NAME)};`,
          );

        exists =
          true;

        console.log(
          `Created isolated database: ${DB_NAME}`,
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : String(error);

        if (
          /CREATE DATABASE permission denied/i.test(
            message,
          )
        ) {
          throw new Error(
            [
              `The application login cannot create ${DB_NAME}.`,
              '',
              'Create the isolated DB once in SSMS using an administrator/Windows login:',
              '  backend\\sql\\create_rebuild_test_database_admin.sql',
              '',
              'Then rerun:',
              '  .\\scripts\\run-rebuild-test-database.ps1',
              '',
              'The runner will safely reuse the pre-created database only if it is empty.',
            ].join('\n'),
          );
        }

        throw error;
      }
    }
  } finally {
    await master
      .$disconnect()
      .catch(
        () => undefined,
      );
  }

  if (!exists) {
    throw new Error(
      `Could not find or create ${DB_NAME}.`,
    );
  }

  const target =
    clientFor(DB_NAME);

  try {
    await target.$connect();

    const identity =
      (
        await target
          .$queryRawUnsafe(`
            SELECT
              DB_NAME() AS currentDatabase
          `)
      )[0];

    if (
      String(
        identity
          ?.currentDatabase ??
          '',
      ).toLowerCase() !==
      DB_NAME.toLowerCase()
    ) {
      throw new Error(
        `Connected database mismatch. Expected ${DB_NAME}.`,
      );
    }

    const userTables =
      await target
        .$queryRawUnsafe(`
          SELECT
            s.name AS schemaName,
            t.name AS tableName
          FROM sys.tables t
          JOIN sys.schemas s
            ON s.schema_id =
               t.schema_id
          WHERE
            t.is_ms_shipped = 0
          ORDER BY
            s.name,
            t.name
        `);

    if (
      userTables.length > 0
    ) {
      throw new Error(
        [
          `Safety stop: ${DB_NAME} already contains ${userTables.length} user table(s).`,
          'This runner never overwrites an existing populated database.',
          `Existing tables: ${userTables
            .map(
              (row) =>
                `${row.schemaName}.${row.tableName}`,
            )
            .join(', ')}`,
        ].join('\n'),
      );
    }

    console.log(
      `Safety check passed: ${DB_NAME} exists and contains zero user tables.`,
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    if (
      /login failed|cannot open database|access/i.test(
        message,
      )
    ) {
      throw new Error(
        [
          `The login ${process.env.DB_USER} cannot access ${DB_NAME}.`,
          'Run the SSMS admin helper:',
          '  backend\\sql\\create_rebuild_test_database_admin.sql',
          'or map the existing login to the isolated DB with sufficient TEST-only DDL/data permissions.',
        ].join('\n'),
      );
    }

    throw error;
  } finally {
    await target
      .$disconnect()
      .catch(
        () => undefined,
      );
  }
}

async function applyCurrentSchema(
  sql,
) {
  const db =
    clientFor(DB_NAME);

  try {
    await db.$connect();

    const batches =
      splitSqlBatches(
        sql,
      );

    console.log(
      `Applying ${batches.length} generated SQL batch(es) to ${DB_NAME}...`,
    );

    for (
      let i = 0;
      i < batches.length;
      i += 1
    ) {
      console.log(
        `  batch ${i + 1}/${batches.length}`,
      );

      await db
        .$executeRawUnsafe(
          batches[i],
        );
    }
  } finally {
    await db
      .$disconnect()
      .catch(
        () => undefined,
      );
  }
}

async function ensureRole(
  prisma,
  roleName,
) {
  let role =
    await prisma.role
      .findFirst({
        where: {
          roleName,
        },
      });

  if (!role) {
    role =
      await prisma.role
        .create({
          data: {
            roleName,
          },
        });
  }

  return role;
}

async function ensurePermission(
  prisma,
  roleId,
  permissionName,
) {
  const existing =
    await prisma.permission
      .findFirst({
        where: {
          roleId,
          permissionName,
        },
      });

  if (!existing) {
    await prisma.permission
      .create({
        data: {
          roleId,
          permissionName,
        },
      });
  }
}

async function seedReferenceData() {
  const prisma =
    clientFor(DB_NAME);

  try {
    await prisma.$connect();

    console.log(
      'Seeding required reference data...',
    );

    for (
      const stockStatusName of [
        'ACTIVE',
        'INACTIVE',
      ]
    ) {
      const existing =
        await prisma.stockStatus
          .findUnique({
            where: {
              stockStatusName,
            },
          });

      if (!existing) {
        await prisma.stockStatus
          .create({
            data: {
              stockStatusName,
            },
          });
      }
    }

    const adminRole =
      await ensureRole(
        prisma,
        'ADMIN',
      );

    const techRole =
      await ensureRole(
        prisma,
        'TECHNICIAN',
      );

    for (
      const permissionName of
      ALL_SYSTEM_PERMISSIONS
    ) {
      await ensurePermission(
        prisma,
        adminRole.roleId,
        permissionName,
      );
    }

    for (
      const permissionName of
      TECHNICIAN_PERMISSIONS
    ) {
      await ensurePermission(
        prisma,
        techRole.roleId,
        permissionName,
      );
    }
  } finally {
    await prisma
      .$disconnect()
      .catch(
        () => undefined,
      );
  }
}

async function verifyDatabase(
  candidateHash,
) {
  const prisma =
    clientFor(DB_NAME);

  try {
    await prisma.$connect();

    const identity =
      (
        await prisma
          .$queryRawUnsafe(`
            SELECT
              @@SERVERNAME AS currentServer,
              DB_NAME() AS currentDatabase
          `)
      )[0];

    const expectedTables = [
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

    const tableRows =
      await prisma
        .$queryRawUnsafe(`
          SELECT
            name
          FROM sys.tables
          WHERE name IN (
            ${expectedTables
              .map(
                (name) =>
                  `N'${name
                    .replaceAll(
                      "'",
                      "''",
                    )}'`,
              )
              .join(',')}
          )
          ORDER BY name
        `);

    const found =
      new Set(
        tableRows.map(
          (row) =>
            String(
              row.name,
            ),
        ),
      );

    const missing =
      expectedTables.filter(
        (name) =>
          !found.has(name),
      );

    const stockStatuses =
      await prisma.stockStatus
        .findMany({
          orderBy: {
            stockStatusName:
              'asc',
          },
        });

    const roles =
      await prisma.role
        .findMany({
          include: {
            permissions:
              true,
          },

          orderBy: {
            roleName:
              'asc',
          },
        });

    const businessCounts = {
      stocks:
        await prisma.stock
          .count(),

      shelves:
        await prisma.shelf
          .count(),

      equipment:
        await prisma.equipment
          .count(),

      serialNumbers:
        await prisma.serialNumber
          .count(),

      movements:
        await prisma.mouvement
          .count(),

      inventories:
        await prisma.inventory
          .count(),
    };

    const foreignKeyProblems =
      await prisma
        .$queryRawUnsafe(`
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

    const report = {
      generatedAt:
        new Date()
          .toISOString(),

      databaseName:
        DB_NAME,

      identity,
      candidateHash,

      expectedTableCount:
        expectedTables.length,

      foundTableCount:
        found.size,

      missingTables:
        missing,

      stockStatuses,

      roles:
        roles.map(
          (role) => ({
            roleName:
              role.roleName,

            permissionCount:
              role.permissions
                .length,

            permissions:
              role.permissions
                .map(
                  (permission) =>
                    permission
                      .permissionName,
                )
                .sort(),
          }),
        ),

      businessCounts,
      foreignKeyProblems,

      customHardeningTriggersInstalled:
        false,

      nextPhase:
        'Install hardening triggers, then run API smoke tests against this isolated DB.',
    };

    const outputPath =
      path.resolve(
        process.cwd(),
        'sql',
        'generated',
        `${DB_NAME}-verification-report.json`,
      );

    fs.writeFileSync(
      outputPath,
      JSON.stringify(
        report,
        null,
        2,
      ),
      'utf8',
    );

    console.log('');
    console.log(
      'REBUILD TEST DATABASE VERIFICATION',
    );
    console.log(
      '==================================',
    );

    console.log(
      `Database: ${identity?.currentDatabase ?? DB_NAME}`,
    );

    console.log(
      `Expected application tables: ${found.size}/${expectedTables.length}`,
    );

    console.log(
      `StockStatus values: ${stockStatuses
        .map(
          (row) =>
            row.stockStatusName,
        )
        .join(', ')}`,
    );

    console.log(
      `Roles: ${roles
        .map(
          (role) =>
            `${role.roleName}(${role.permissions.length})`,
        )
        .join(', ')}`,
    );

    console.log(
      `FK problems: ${foreignKeyProblems.length}`,
    );

    console.log(
      `Business rows: ${JSON.stringify(businessCounts)}`,
    );

    console.log('');
    console.log(
      `Report: ${outputPath}`,
    );

    if (
      missing.length > 0 ||
      foreignKeyProblems.length > 0
    ) {
      process.exitCode =
        3;
    }
  } finally {
    await prisma
      .$disconnect()
      .catch(
        () => undefined,
      );
  }
}

async function main() {
  console.log('');
  console.log(
    'SOMIPHARM ISOLATED REBUILD DATABASE',
  );
  console.log(
    '===================================',
  );
  console.log(
    `Target: ${DB_NAME}`,
  );
  console.log(
    'The current yacinedb will NOT be modified.',
  );
  console.log('');

  const candidate =
    await assertPrerequisites();

  console.log(
    `Candidate SHA256: ${candidate.hash}`,
  );

  await ensureEmptyIsolatedDatabase();

  await applyCurrentSchema(
    candidate.sql,
  );

  await seedReferenceData();

  await verifyDatabase(
    candidate.hash,
  );
}

main()
  .catch(
    (error) => {
      console.error(
        error,
      );

      process.exitCode =
        1;
    },
  );
