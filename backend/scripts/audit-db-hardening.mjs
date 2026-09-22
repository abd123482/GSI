import 'dotenv/config';

import { PrismaMssql } from '@prisma/adapter-mssql';
import { PrismaClient } from '../dist/generated/prisma/client.js';
import fs from 'node:fs';
import path from 'node:path';

const EXPECTED_TRIGGERS = [
  'TR_Shelf_RequireActiveStock',
  'TR_EquipmentShelfs_RequireActiveStock',
  'TR_Mouvement_RequireActiveStocks',
  'TR_SerialNumber_Guards',
  'TR_InventoryWorkUnit_AcceptedAttempt',
  'TR_MovementEquipment_MatchHeader',
];

const EXPECTED_COLUMNS = [
  ['Equipment', 'equipmentStatus'],
  ['InventoryWorkUnit', 'acceptedAttemptId'],
  ['InventoryWorkUnit', 'reconciledAt'],
  ['InventoryWorkUnit', 'reconciliationStatus'],
  ['Mouvement', 'inventoryId'],
  ['Mouvement', 'origin'],
  ['Mouvement', 'reason'],
  ['MovementEquipment', 'equipmentTypeSnapshot'],
  ['Shelf', 'stockId'],
  ['Stock', 'stockStatusId'],
  ['SerialNumber', 'serialNumberStatus'],
  ['SerialNumber', 'shelfId'],
];

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

function safeNumber(value) {
  if (typeof value === 'bigint') return Number(value);
  if (value == null) return 0;
  return Number(value);
}

function makeAdapter() {
  return new PrismaMssql({
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
}

const prisma = new PrismaClient({
  adapter: makeAdapter(),
});

async function rows(sql) {
  return prisma.$queryRawUnsafe(sql);
}

async function scalar(sql, key = 'value') {
  const result = await rows(sql);
  return safeNumber(result?.[0]?.[key]);
}

async function tableExists(tableName) {
  return (
    (await scalar(`
      SELECT COUNT_BIG(*) AS value
      FROM sys.tables
      WHERE name = N'${tableName.replaceAll("'", "''")}'
    `)) > 0
  );
}

async function columnExists(tableName, columnName) {
  return (
    (await scalar(`
      SELECT COUNT_BIG(*) AS value
      FROM sys.columns c
      JOIN sys.tables t ON t.object_id = c.object_id
      WHERE
        t.name = N'${tableName.replaceAll("'", "''")}'
        AND c.name = N'${columnName.replaceAll("'", "''")}'
    `)) > 0
  );
}

async function canCheck(table, ...columns) {
  if (!(await tableExists(table))) return false;

  for (const column of columns) {
    if (!(await columnExists(table, column))) {
      return false;
    }
  }

  return true;
}

const checks = [];

function addCheck({
  code,
  title,
  severity = 'ERROR',
  count = 0,
  details = [],
  note = null,
}) {
  checks.push({
    code,
    title,
    severity,
    count: safeNumber(count),
    passed: safeNumber(count) === 0,
    details,
    note,
  });
}

async function countCheck({
  code,
  title,
  severity = 'ERROR',
  sql,
  detailsSql = null,
  note = null,
}) {
  const count = await scalar(sql);

  let details = [];
  if (count > 0 && detailsSql) {
    details = await rows(detailsSql);
  }

  addCheck({
    code,
    title,
    severity,
    count,
    details,
    note,
  });
}

async function main() {
  await prisma.$connect();

  const identity = (
    await rows(`
      SELECT
        @@SERVERNAME AS currentServer,
        DB_NAME() AS currentDatabase,
        SUSER_SNAME() AS loginName
    `)
  )[0];

  const tableList = await rows(`
    SELECT name
    FROM sys.tables
    WHERE name IN (
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
      'Order'
    )
    ORDER BY name
  `);

  const requiredTables = [
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

  const presentTables = new Set(tableList.map((row) => row.name));
  const missingTables = requiredTables.filter(
    (name) => !presentTables.has(name),
  );

  addCheck({
    code: 'SCHEMA_TABLES',
    title: 'Required application tables are present',
    severity: 'ERROR',
    count: missingTables.length,
    details: missingTables,
  });

  const missingColumns = [];
  for (const [table, column] of EXPECTED_COLUMNS) {
    if (!(await columnExists(table, column))) {
      missingColumns.push(`${table}.${column}`);
    }
  }

  addCheck({
    code: 'SCHEMA_COLUMNS',
    title: 'Required hardened columns are present',
    severity: 'ERROR',
    count: missingColumns.length,
    details: missingColumns,
  });

  const triggerRows = await rows(`
    SELECT
      o.name,
      tr.is_disabled AS isDisabled
    FROM sys.objects o
    LEFT JOIN sys.triggers tr
      ON tr.object_id = o.object_id
    WHERE o.name IN (
      ${EXPECTED_TRIGGERS.map((name) => `N'${name}'`).join(',')}
    )
    ORDER BY o.name
  `);

  const triggerByName = new Map(
    triggerRows.map((row) => [row.name, row]),
  );

  const missingOrDisabledTriggers = [];
  for (const name of EXPECTED_TRIGGERS) {
    const trigger = triggerByName.get(name);
    if (!trigger) {
      missingOrDisabledTriggers.push({
        name,
        state: 'MISSING',
      });
    } else if (trigger.isDisabled) {
      missingOrDisabledTriggers.push({
        name,
        state: 'DISABLED',
      });
    }
  }

  addCheck({
    code: 'HARDENING_TRIGGERS',
    title: 'Expected hardening triggers are present and enabled',
    severity: 'WARN',
    count: missingOrDisabledTriggers.length,
    details: missingOrDisabledTriggers,
    note:
      'Missing triggers are not installed automatically by this audit. Review before applying a hardening patch.',
  });

  await countCheck({
    code: 'FK_DISABLED_OR_UNTRUSTED',
    title: 'Foreign keys are enabled and trusted',
    severity: 'ERROR',
    sql: `
      SELECT COUNT_BIG(*) AS value
      FROM sys.foreign_keys
      WHERE
        (is_disabled = 1 OR is_not_trusted = 1)
        AND OBJECT_NAME(parent_object_id) IN (
          'Stock',
          'Shelf',
          'Equipment',
          'EquipmentShelfs',
          'SerialNumber',
          'Mouvement',
          'MovementEquipment',
          'Inventory',
          'InventoryWorkUnit',
          'InventoryCountAttempt',
          'Order'
        )
    `,
    detailsSql: `
      SELECT TOP (100)
        OBJECT_NAME(parent_object_id) AS tableName,
        name AS foreignKeyName,
        is_disabled AS isDisabled,
        is_not_trusted AS isNotTrusted
      FROM sys.foreign_keys
      WHERE
        (is_disabled = 1 OR is_not_trusted = 1)
        AND OBJECT_NAME(parent_object_id) IN (
          'Stock',
          'Shelf',
          'Equipment',
          'EquipmentShelfs',
          'SerialNumber',
          'Mouvement',
          'MovementEquipment',
          'Inventory',
          'InventoryWorkUnit',
          'InventoryCountAttempt',
          'Order'
        )
      ORDER BY tableName, foreignKeyName
    `,
  });

  await countCheck({
    code: 'CHECK_DISABLED_OR_UNTRUSTED',
    title: 'Check constraints are enabled and trusted',
    severity: 'WARN',
    sql: `
      SELECT COUNT_BIG(*) AS value
      FROM sys.check_constraints
      WHERE
        (is_disabled = 1 OR is_not_trusted = 1)
        AND OBJECT_NAME(parent_object_id) IN (
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
          'InventoryCountAttempt'
        )
    `,
    detailsSql: `
      SELECT TOP (100)
        OBJECT_NAME(parent_object_id) AS tableName,
        name AS constraintName,
        definition,
        is_disabled AS isDisabled,
        is_not_trusted AS isNotTrusted
      FROM sys.check_constraints
      WHERE
        (is_disabled = 1 OR is_not_trusted = 1)
        AND OBJECT_NAME(parent_object_id) IN (
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
          'InventoryCountAttempt'
        )
      ORDER BY tableName, constraintName
    `,
  });

  if (
    await canCheck(
      'StockStatus',
      'stockStatusName',
    )
  ) {
    await countCheck({
      code: 'STOCK_STATUS_DOMAIN',
      title: 'StockStatus contains only ACTIVE / INACTIVE',
      severity: 'ERROR',
      sql: `
        SELECT COUNT_BIG(*) AS value
        FROM dbo.StockStatus
        WHERE UPPER(LTRIM(RTRIM(stockStatusName))) NOT IN ('ACTIVE', 'INACTIVE')
      `,
      detailsSql: `
        SELECT TOP (100)
          stockStatusId,
          stockStatusName
        FROM dbo.StockStatus
        WHERE UPPER(LTRIM(RTRIM(stockStatusName))) NOT IN ('ACTIVE', 'INACTIVE')
        ORDER BY stockStatusName
      `,
    });

    await countCheck({
      code: 'STOCK_STATUS_REQUIRED_ROWS',
      title: 'Both ACTIVE and INACTIVE status rows exist',
      severity: 'ERROR',
      sql: `
        SELECT
          CASE
            WHEN
              EXISTS (
                SELECT 1 FROM dbo.StockStatus
                WHERE UPPER(LTRIM(RTRIM(stockStatusName))) = 'ACTIVE'
              )
              AND EXISTS (
                SELECT 1 FROM dbo.StockStatus
                WHERE UPPER(LTRIM(RTRIM(stockStatusName))) = 'INACTIVE'
              )
            THEN CAST(0 AS bigint)
            ELSE CAST(1 AS bigint)
          END AS value
      `,
      detailsSql: `
        SELECT stockStatusId, stockStatusName
        FROM dbo.StockStatus
        ORDER BY stockStatusName
      `,
    });
  }

  for (const [table, column] of [
    ['Equipment', 'equipmentQuantity'],
    ['Shelf', 'shelfQuantity'],
    ['EquipmentShelfs', 'equipmentQuantity'],
  ]) {
    if (await canCheck(table, column)) {
      await countCheck({
        code: `NEGATIVE_${table.toUpperCase()}_${column.toUpperCase()}`,
        title: `${table}.${column} is never negative`,
        severity: 'ERROR',
        sql: `
          SELECT COUNT_BIG(*) AS value
          FROM dbo.[${table}]
          WHERE [${column}] < 0
        `,
        detailsSql: `
          SELECT TOP (100) *
          FROM dbo.[${table}]
          WHERE [${column}] < 0
        `,
      });
    }
  }

  if (
    await canCheck(
      'EquipmentShelfs',
      'equipmentId',
      'shelfId',
    )
  ) {
    await countCheck({
      code: 'DUPLICATE_EQUIPMENT_SHELF',
      title: 'No duplicate equipment/shelf allocation pairs',
      severity: 'ERROR',
      sql: `
        SELECT COUNT_BIG(*) AS value
        FROM (
          SELECT equipmentId, shelfId
          FROM dbo.EquipmentShelfs
          GROUP BY equipmentId, shelfId
          HAVING COUNT_BIG(*) > 1
        ) d
      `,
      detailsSql: `
        SELECT TOP (100)
          equipmentId,
          shelfId,
          COUNT_BIG(*) AS duplicateRows
        FROM dbo.EquipmentShelfs
        GROUP BY equipmentId, shelfId
        HAVING COUNT_BIG(*) > 1
        ORDER BY duplicateRows DESC
      `,
    });
  }

  if (
    await canCheck(
      'Equipment',
      'equipmentId',
      'equipmentQuantity',
      'hasSerialNumber',
    ) &&
    await canCheck(
      'EquipmentShelfs',
      'equipmentId',
      'equipmentQuantity',
    )
  ) {
    await countCheck({
      code: 'STANDARD_GLOBAL_QTY_MISMATCH',
      title: 'Standard Equipment quantity equals sum of shelf allocations',
      severity: 'ERROR',
      sql: `
        SELECT COUNT_BIG(*) AS value
        FROM dbo.Equipment e
        OUTER APPLY (
          SELECT COALESCE(SUM(es.equipmentQuantity), 0) AS allocated
          FROM dbo.EquipmentShelfs es
          WHERE es.equipmentId = e.equipmentId
        ) a
        WHERE
          e.hasSerialNumber = 0
          AND COALESCE(e.equipmentQuantity, 0) <> COALESCE(a.allocated, 0)
      `,
      detailsSql: `
        SELECT TOP (100)
          e.equipmentId,
          e.equipmentName,
          e.equipmentQuantity AS globalQuantity,
          COALESCE(a.allocated, 0) AS allocatedQuantity
        FROM dbo.Equipment e
        OUTER APPLY (
          SELECT COALESCE(SUM(es.equipmentQuantity), 0) AS allocated
          FROM dbo.EquipmentShelfs es
          WHERE es.equipmentId = e.equipmentId
        ) a
        WHERE
          e.hasSerialNumber = 0
          AND COALESCE(e.equipmentQuantity, 0) <> COALESCE(a.allocated, 0)
        ORDER BY e.equipmentName
      `,
    });
  }

  if (
    await canCheck(
      'Equipment',
      'equipmentId',
      'equipmentQuantity',
      'hasSerialNumber',
    ) &&
    await canCheck(
      'SerialNumber',
      'equipmentId',
      'shelfId',
    )
  ) {
    await countCheck({
      code: 'SERIALIZED_GLOBAL_QTY_MISMATCH',
      title: 'Serialized Equipment quantity equals physically shelved serial count',
      severity: 'ERROR',
      sql: `
        SELECT COUNT_BIG(*) AS value
        FROM dbo.Equipment e
        OUTER APPLY (
          SELECT COUNT_BIG(*) AS physicalSerials
          FROM dbo.SerialNumber sn
          WHERE
            sn.equipmentId = e.equipmentId
            AND sn.shelfId IS NOT NULL
        ) s
        WHERE
          e.hasSerialNumber = 1
          AND COALESCE(e.equipmentQuantity, 0) <> COALESCE(s.physicalSerials, 0)
      `,
      detailsSql: `
        SELECT TOP (100)
          e.equipmentId,
          e.equipmentName,
          e.equipmentQuantity AS globalQuantity,
          COALESCE(s.physicalSerials, 0) AS physicallyShelvedSerials
        FROM dbo.Equipment e
        OUTER APPLY (
          SELECT COUNT_BIG(*) AS physicalSerials
          FROM dbo.SerialNumber sn
          WHERE
            sn.equipmentId = e.equipmentId
            AND sn.shelfId IS NOT NULL
        ) s
        WHERE
          e.hasSerialNumber = 1
          AND COALESCE(e.equipmentQuantity, 0) <> COALESCE(s.physicalSerials, 0)
        ORDER BY e.equipmentName
      `,
    });
  }

  if (
    await canCheck(
      'Equipment',
      'equipmentId',
      'hasSerialNumber',
    ) &&
    await canCheck(
      'SerialNumber',
      'equipmentId',
      'shelfId',
    ) &&
    await canCheck(
      'EquipmentShelfs',
      'equipmentId',
      'shelfId',
      'equipmentQuantity',
    )
  ) {
    await countCheck({
      code: 'SERIALIZED_SHELF_QTY_MISMATCH',
      title: 'Serialized shelf allocations equal serials physically on each shelf',
      severity: 'ERROR',
      sql: `
        SELECT COUNT_BIG(*) AS value
        FROM (
          SELECT
            keys.equipmentId,
            keys.shelfId,
            COALESCE(es.quantity, 0) AS allocationQuantity,
            COALESCE(sn.quantity, 0) AS serialQuantity
          FROM (
            SELECT equipmentId, shelfId
            FROM dbo.EquipmentShelfs
            UNION
            SELECT equipmentId, shelfId
            FROM dbo.SerialNumber
            WHERE shelfId IS NOT NULL
          ) keys
          JOIN dbo.Equipment e
            ON e.equipmentId = keys.equipmentId
            AND e.hasSerialNumber = 1
          OUTER APPLY (
            SELECT SUM(x.equipmentQuantity) AS quantity
            FROM dbo.EquipmentShelfs x
            WHERE
              x.equipmentId = keys.equipmentId
              AND x.shelfId = keys.shelfId
          ) es
          OUTER APPLY (
            SELECT COUNT_BIG(*) AS quantity
            FROM dbo.SerialNumber x
            WHERE
              x.equipmentId = keys.equipmentId
              AND x.shelfId = keys.shelfId
          ) sn
          WHERE COALESCE(es.quantity, 0) <> COALESCE(sn.quantity, 0)
        ) d
      `,
      detailsSql: `
        SELECT TOP (100)
          keys.equipmentId,
          e.equipmentName,
          keys.shelfId,
          COALESCE(es.quantity, 0) AS allocationQuantity,
          COALESCE(sn.quantity, 0) AS serialQuantity
        FROM (
          SELECT equipmentId, shelfId
          FROM dbo.EquipmentShelfs
          UNION
          SELECT equipmentId, shelfId
          FROM dbo.SerialNumber
          WHERE shelfId IS NOT NULL
        ) keys
        JOIN dbo.Equipment e
          ON e.equipmentId = keys.equipmentId
          AND e.hasSerialNumber = 1
        OUTER APPLY (
          SELECT SUM(x.equipmentQuantity) AS quantity
          FROM dbo.EquipmentShelfs x
          WHERE
            x.equipmentId = keys.equipmentId
            AND x.shelfId = keys.shelfId
        ) es
        OUTER APPLY (
          SELECT COUNT_BIG(*) AS quantity
          FROM dbo.SerialNumber x
          WHERE
            x.equipmentId = keys.equipmentId
            AND x.shelfId = keys.shelfId
        ) sn
        WHERE COALESCE(es.quantity, 0) <> COALESCE(sn.quantity, 0)
        ORDER BY e.equipmentName
      `,
    });
  }

  if (
    await canCheck(
      'Shelf',
      'shelfId',
      'shelfQuantity',
    ) &&
    await canCheck(
      'EquipmentShelfs',
      'shelfId',
      'equipmentQuantity',
    )
  ) {
    await countCheck({
      code: 'SHELF_TOTAL_MISMATCH',
      title: 'Shelf total quantity equals allocation totals',
      severity: 'ERROR',
      sql: `
        SELECT COUNT_BIG(*) AS value
        FROM dbo.Shelf s
        OUTER APPLY (
          SELECT COALESCE(SUM(es.equipmentQuantity), 0) AS allocated
          FROM dbo.EquipmentShelfs es
          WHERE es.shelfId = s.shelfId
        ) a
        WHERE COALESCE(s.shelfQuantity, 0) <> COALESCE(a.allocated, 0)
      `,
      detailsSql: `
        SELECT TOP (100)
          s.shelfId,
          s.shelfName,
          s.shelfQuantity,
          COALESCE(a.allocated, 0) AS allocatedQuantity
        FROM dbo.Shelf s
        OUTER APPLY (
          SELECT COALESCE(SUM(es.equipmentQuantity), 0) AS allocated
          FROM dbo.EquipmentShelfs es
          WHERE es.shelfId = s.shelfId
        ) a
        WHERE COALESCE(s.shelfQuantity, 0) <> COALESCE(a.allocated, 0)
        ORDER BY s.shelfName
      `,
    });
  }

  if (
    await canCheck(
      'Mouvement',
      'mouvementId',
      'mouvementStatus',
      'mouvementQuantity',
      'sourceShelfId',
      'destinationShelfId',
    ) &&
    await canCheck(
      'MovementEquipment',
      'movementId',
      'movementStatus',
      'equipmentQuantity',
      'sourceShelfId',
      'destinationShelfId',
    )
  ) {
    await countCheck({
      code: 'MOVEMENT_HEADER_LINE_MISMATCH',
      title: 'Movement lines match the parent route/type',
      severity: 'ERROR',
      sql: `
        SELECT COUNT_BIG(*) AS value
        FROM dbo.MovementEquipment me
        JOIN dbo.Mouvement m
          ON m.mouvementId = me.movementId
        WHERE
          COALESCE(me.movementStatus, '') <> COALESCE(m.mouvementStatus, '')
          OR COALESCE(CONVERT(varchar(36), me.sourceShelfId), '') <>
             COALESCE(CONVERT(varchar(36), m.sourceShelfId), '')
          OR COALESCE(CONVERT(varchar(36), me.destinationShelfId), '') <>
             COALESCE(CONVERT(varchar(36), m.destinationShelfId), '')
      `,
      detailsSql: `
        SELECT TOP (100)
          me.movementId,
          me.movementEquipmentId,
          m.mouvementStatus AS headerStatus,
          me.movementStatus AS lineStatus,
          m.sourceShelfId AS headerSource,
          me.sourceShelfId AS lineSource,
          m.destinationShelfId AS headerDestination,
          me.destinationShelfId AS lineDestination
        FROM dbo.MovementEquipment me
        JOIN dbo.Mouvement m
          ON m.mouvementId = me.movementId
        WHERE
          COALESCE(me.movementStatus, '') <> COALESCE(m.mouvementStatus, '')
          OR COALESCE(CONVERT(varchar(36), me.sourceShelfId), '') <>
             COALESCE(CONVERT(varchar(36), m.sourceShelfId), '')
          OR COALESCE(CONVERT(varchar(36), me.destinationShelfId), '') <>
             COALESCE(CONVERT(varchar(36), m.destinationShelfId), '')
      `,
    });

    await countCheck({
      code: 'MOVEMENT_HEADER_QTY_MISMATCH',
      title: 'Movement header total equals sum of child line quantities',
      severity: 'ERROR',
      sql: `
        SELECT COUNT_BIG(*) AS value
        FROM dbo.Mouvement m
        JOIN (
          SELECT movementId, SUM(equipmentQuantity) AS totalQuantity
          FROM dbo.MovementEquipment
          GROUP BY movementId
        ) x
          ON x.movementId = m.mouvementId
        WHERE COALESCE(m.mouvementQuantity, 0) <> COALESCE(x.totalQuantity, 0)
      `,
      detailsSql: `
        SELECT TOP (100)
          m.mouvementId,
          m.mouvementQuantity AS headerQuantity,
          x.totalQuantity AS childQuantity
        FROM dbo.Mouvement m
        JOIN (
          SELECT movementId, SUM(equipmentQuantity) AS totalQuantity
          FROM dbo.MovementEquipment
          GROUP BY movementId
        ) x
          ON x.movementId = m.mouvementId
        WHERE COALESCE(m.mouvementQuantity, 0) <> COALESCE(x.totalQuantity, 0)
      `,
    });
  }

  if (
    await canCheck(
      'InventoryWorkUnit',
      'unitId',
      'reconciliationStatus',
      'acceptedAttemptId',
    ) &&
    await canCheck(
      'InventoryCountAttempt',
      'attemptId',
      'unitId',
      'purpose',
      'status',
    )
  ) {
    await countCheck({
      code: 'INVENTORY_ACCEPTED_WRONG_UNIT',
      title: 'Accepted attempt always belongs to the same work unit',
      severity: 'ERROR',
      sql: `
        SELECT COUNT_BIG(*) AS value
        FROM dbo.InventoryWorkUnit u
        JOIN dbo.InventoryCountAttempt a
          ON a.attemptId = u.acceptedAttemptId
        WHERE a.unitId <> u.unitId
      `,
      detailsSql: `
        SELECT TOP (100)
          u.unitId,
          u.reconciliationStatus,
          u.acceptedAttemptId,
          a.unitId AS acceptedAttemptUnitId,
          a.purpose,
          a.status
        FROM dbo.InventoryWorkUnit u
        JOIN dbo.InventoryCountAttempt a
          ON a.attemptId = u.acceptedAttemptId
        WHERE a.unitId <> u.unitId
      `,
    });

    await countCheck({
      code: 'INVENTORY_PRIMARY_MATCH_ACCEPTED',
      title: 'PRIMARY_MATCH accepts submitted PRIMARY_1',
      severity: 'ERROR',
      sql: `
        SELECT COUNT_BIG(*) AS value
        FROM dbo.InventoryWorkUnit u
        LEFT JOIN dbo.InventoryCountAttempt a
          ON a.attemptId = u.acceptedAttemptId
        WHERE
          u.reconciliationStatus = 'PRIMARY_MATCH'
          AND (
            u.acceptedAttemptId IS NULL
            OR a.purpose <> 'PRIMARY_1'
            OR a.status <> 'SUBMITTED'
          )
      `,
      detailsSql: `
        SELECT TOP (100)
          u.unitId,
          u.reconciliationStatus,
          u.acceptedAttemptId,
          a.purpose,
          a.status
        FROM dbo.InventoryWorkUnit u
        LEFT JOIN dbo.InventoryCountAttempt a
          ON a.attemptId = u.acceptedAttemptId
        WHERE
          u.reconciliationStatus = 'PRIMARY_MATCH'
          AND (
            u.acceptedAttemptId IS NULL
            OR a.purpose <> 'PRIMARY_1'
            OR a.status <> 'SUBMITTED'
          )
      `,
    });

    await countCheck({
      code: 'INVENTORY_THIRD_REQUIRED_ACCEPTED',
      title: 'THIRD_REQUIRED has no accepted attempt yet',
      severity: 'ERROR',
      sql: `
        SELECT COUNT_BIG(*) AS value
        FROM dbo.InventoryWorkUnit
        WHERE
          reconciliationStatus = 'THIRD_REQUIRED'
          AND acceptedAttemptId IS NOT NULL
      `,
      detailsSql: `
        SELECT TOP (100)
          unitId,
          reconciliationStatus,
          acceptedAttemptId
        FROM dbo.InventoryWorkUnit
        WHERE
          reconciliationStatus = 'THIRD_REQUIRED'
          AND acceptedAttemptId IS NOT NULL
      `,
    });

    await countCheck({
      code: 'INVENTORY_THIRD_RESOLVED_ACCEPTED',
      title: 'THIRD_RESOLVED accepts submitted FINAL_RECOUNT',
      severity: 'ERROR',
      sql: `
        SELECT COUNT_BIG(*) AS value
        FROM dbo.InventoryWorkUnit u
        LEFT JOIN dbo.InventoryCountAttempt a
          ON a.attemptId = u.acceptedAttemptId
        WHERE
          u.reconciliationStatus = 'THIRD_RESOLVED'
          AND (
            u.acceptedAttemptId IS NULL
            OR a.purpose <> 'FINAL_RECOUNT'
            OR a.status <> 'SUBMITTED'
          )
      `,
      detailsSql: `
        SELECT TOP (100)
          u.unitId,
          u.reconciliationStatus,
          u.acceptedAttemptId,
          a.purpose,
          a.status
        FROM dbo.InventoryWorkUnit u
        LEFT JOIN dbo.InventoryCountAttempt a
          ON a.attemptId = u.acceptedAttemptId
        WHERE
          u.reconciliationStatus = 'THIRD_RESOLVED'
          AND (
            u.acceptedAttemptId IS NULL
            OR a.purpose <> 'FINAL_RECOUNT'
            OR a.status <> 'SUBMITTED'
          )
      `,
    });
  }

  const errors = checks.filter(
    (check) =>
      check.severity === 'ERROR' &&
      !check.passed,
  );

  const warnings = checks.filter(
    (check) =>
      check.severity === 'WARN' &&
      !check.passed,
  );

  const report = {
    generatedAt: new Date().toISOString(),
    identity,
    summary: {
      totalChecks: checks.length,
      passedChecks: checks.filter((check) => check.passed).length,
      errorChecks: errors.length,
      warningChecks: warnings.length,
    },
    checks,
  };

  const outputPath = path.resolve(
    process.cwd(),
    'sql',
    'db-hardening-audit-report.json',
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
  console.log('SOMIPHARM DB HARDENING AUDIT');
  console.log('============================');
  console.log(
    `Server:   ${identity?.currentServer ?? 'unknown'}`,
  );
  console.log(
    `Database: ${identity?.currentDatabase ?? 'unknown'}`,
  );
  console.log('');

  for (const check of checks) {
    const state = check.passed
      ? 'PASS'
      : check.severity;

    console.log(
      `${state.padEnd(5)} ${check.code.padEnd(34)} ${check.count} - ${check.title}`,
    );
  }

  console.log('');
  console.log(
    `Checks: ${report.summary.passedChecks}/${report.summary.totalChecks} passed`,
  );
  console.log(
    `Errors: ${report.summary.errorChecks}`,
  );
  console.log(
    `Warnings: ${report.summary.warningChecks}`,
  );
  console.log('');
  console.log(`Report saved to: ${outputPath}`);

  if (errors.length > 0) {
    process.exitCode = 3;
  } else if (warnings.length > 0) {
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
