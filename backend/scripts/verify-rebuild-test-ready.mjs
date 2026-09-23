import 'dotenv/config';

import { PrismaMssql } from '@prisma/adapter-mssql';
import { PrismaClient } from '../dist/generated/prisma/client.js';

const database =
  process.env.REBUILD_DB_NAME ??
  'yacinedb_rebuild_test';

if (!/^yacinedb_rebuild_test(?:_[A-Za-z0-9_]+)?$/i.test(database)) {
  throw new Error(
    `Safety stop: expected isolated rebuild DB, got ${database}`,
  );
}

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
    database,
    user: required('DB_USER'),
    password: required('DB_PASSWORD'),
    options: {
      encrypt: true,
      trustServerCertificate: true,
    },
  }),
});

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

const expectedTriggers = [
  'TR_Shelf_RequireActiveStock',
  'TR_EquipmentShelfs_RequireActiveStock',
  'TR_Mouvement_RequireActiveStocks',
  'TR_SerialNumber_Guards',
  'TR_InventoryWorkUnit_AcceptedAttempt',
  'TR_MovementEquipment_MatchHeader',
];

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
    SELECT name
    FROM sys.tables
    WHERE name IN (
      ${expectedTables.map((name) => `N'${name}'`).join(',')}
    )
    ORDER BY name
  `);

  const triggers = await prisma.$queryRawUnsafe(`
    SELECT
      name,
      is_disabled AS isDisabled
    FROM sys.triggers
    WHERE name IN (
      ${expectedTriggers.map((name) => `N'${name}'`).join(',')}
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
  `);

  const statuses = await prisma.stockStatus.findMany({
    orderBy: {
      stockStatusName: 'asc',
    },
  });

  const counts = {
    stocks: await prisma.stock.count(),
    shelves: await prisma.shelf.count(),
    equipment: await prisma.equipment.count(),
    serialNumbers: await prisma.serialNumber.count(),
    movements: await prisma.mouvement.count(),
    inventories: await prisma.inventory.count(),
  };

  const missingTables =
    expectedTables.filter(
      (name) =>
        !tables.some(
          (row) =>
            String(row.name) === name,
        ),
    );

  const badTriggers =
    expectedTriggers.filter(
      (name) => {
        const row =
          triggers.find(
            (item) =>
              String(item.name) === name,
          );

        return (
          !row ||
          row.isDisabled
        );
      },
    );

  const expectedStatuses =
    ['ACTIVE', 'INACTIVE'];

  const statusNames =
    statuses.map(
      (row) =>
        row.stockStatusName,
    );

  const missingStatuses =
    expectedStatuses.filter(
      (name) =>
        !statusNames.includes(name),
    );

  console.log('');
  console.log('SOMIPHARM LIVE SMOKE TEST READINESS');
  console.log('===================================');
  console.log(
    `Server:   ${identity?.currentServer ?? 'unknown'}`,
  );
  console.log(
    `Database: ${identity?.currentDatabase ?? 'unknown'}`,
  );
  console.log(
    `Tables:   ${tables.length}/${expectedTables.length}`,
  );
  console.log(
    `Triggers: ${triggers.length}/${expectedTriggers.length}`,
  );
  console.log(
    `FK problems: ${fkProblems.length}`,
  );
  console.log(
    `StockStatus: ${statusNames.join(', ')}`,
  );
  console.log(
    `Business rows: ${JSON.stringify(counts)}`,
  );

  const problems = [];

  if (
    String(
      identity?.currentDatabase ?? '',
    ).toLowerCase() !==
    database.toLowerCase()
  ) {
    problems.push(
      `Connected to wrong database: ${identity?.currentDatabase}`,
    );
  }

  if (missingTables.length > 0) {
    problems.push(
      `Missing tables: ${missingTables.join(', ')}`,
    );
  }

  if (badTriggers.length > 0) {
    problems.push(
      `Missing/disabled triggers: ${badTriggers.join(', ')}`,
    );
  }

  if (fkProblems.length > 0) {
    problems.push(
      `${fkProblems.length} disabled/untrusted FK(s)`,
    );
  }

  if (missingStatuses.length > 0) {
    problems.push(
      `Missing StockStatus values: ${missingStatuses.join(', ')}`,
    );
  }

  console.log('');

  if (problems.length === 0) {
    console.log('READY: isolated DB is ready for live application smoke testing.');
  } else {
    console.log('NOT READY:');
    for (const problem of problems) {
      console.log(`- ${problem}`);
    }
    process.exitCode = 2;
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
