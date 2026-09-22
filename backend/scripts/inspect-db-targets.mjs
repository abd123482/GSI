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

function parseBoolean(value, fallback) {
  if (value == null || value === '') {
    return fallback;
  }

  return String(value).toLowerCase() === 'true';
}

function parseSqlServerUrl(url) {
  const prefix = 'sqlserver://';

  if (!url.startsWith(prefix)) {
    throw new Error('DATABASE_URL must start with sqlserver://');
  }

  const body = url.slice(prefix.length);
  const parts = body.split(';');
  const serverPart = parts.shift() ?? '';
  const lastColon = serverPart.lastIndexOf(':');

  const server =
    lastColon > -1
      ? serverPart.slice(0, lastColon)
      : serverPart;

  const port =
    lastColon > -1
      ? Number(serverPart.slice(lastColon + 1))
      : 1433;

  const options = {};

  for (const part of parts) {
    const separator = part.indexOf('=');

    if (separator <= 0) {
      continue;
    }

    const key = part
      .slice(0, separator)
      .trim()
      .toLowerCase();

    const value = part
      .slice(separator + 1)
      .trim();

    options[key] = value;
  }

  return {
    server,
    port,
    database:
      options.database ?? '',
    user:
      options.user ?? '',
    password:
      options.password ?? '',
    encrypt: parseBoolean(
      options.encrypt,
      true,
    ),
    trustServerCertificate:
      parseBoolean(
        options.trustservercertificate,
        true,
      ),
  };
}

function runtimeConfig() {
  return {
    server:
      required('DB_HOST'),

    port:
      Number(
        process.env.DB_PORT ??
          1433,
      ),

    database:
      required('DB_NAME'),

    user:
      required('DB_USER'),

    password:
      required('DB_PASSWORD'),

    encrypt: true,
    trustServerCertificate: true,
  };
}

function cliConfig() {
  return parseSqlServerUrl(
    required(
      'DATABASE_URL',
    ),
  );
}

function safeConfig(config) {
  return {
    server:
      config.server,

    port:
      config.port,

    database:
      config.database,

    user:
      config.user,

    encrypt:
      config.encrypt,

    trustServerCertificate:
      config.trustServerCertificate,
  };
}

async function inspect(
  label,
  config,
) {
  const adapter =
    new PrismaMssql({
      server:
        config.server,

      port:
        config.port,

      database:
        config.database,

      user:
        config.user,

      password:
        config.password,

      options: {
        encrypt:
          config.encrypt,

        trustServerCertificate:
          config.trustServerCertificate,
      },
    });

  const prisma =
    new PrismaClient({
      adapter,
    });

  try {
    await prisma.$connect();

    const identityRows =
      await prisma.$queryRawUnsafe(`
        SELECT
          DB_NAME() AS currentDatabase,
          @@SERVERNAME AS currentServer
      `);

    const tableRows =
      await prisma.$queryRawUnsafe(`
        SELECT
          t.name AS tableName
        FROM sys.tables t
        WHERE t.name IN (
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
        ORDER BY t.name
      `);

    return {
      label,

      configured:
        safeConfig(
          config,
        ),

      connected: true,

      identity:
        identityRows[0] ??
        null,

      expectedTablesFound:
        tableRows.map(
          (row) =>
            row.tableName,
        ),
    };
  } catch (error) {
    return {
      label,

      configured:
        safeConfig(
          config,
        ),

      connected: false,

      error:
        error instanceof Error
          ? error.message
          : String(error),
    };
  } finally {
    await prisma
      .$disconnect()
      .catch(
        () => undefined,
      );
  }
}

const runtime =
  runtimeConfig();

const cli =
  cliConfig();

const [
  runtimeResult,
  cliResult,
] =
  await Promise.all([
    inspect(
      'Nest runtime DB_*',
      runtime,
    ),

    inspect(
      'Prisma CLI DATABASE_URL',
      cli,
    ),
  ]);

const sameConfiguredTarget =
  runtime.server.toLowerCase() ===
    cli.server.toLowerCase() &&
  Number(runtime.port) ===
    Number(cli.port) &&
  runtime.database.toLowerCase() ===
    cli.database.toLowerCase();

const sameConnectedTarget =
  runtimeResult.connected &&
  cliResult.connected &&
  String(
    runtimeResult.identity
      ?.currentServer ??
      '',
  ).toLowerCase() ===
    String(
      cliResult.identity
        ?.currentServer ??
        '',
    ).toLowerCase() &&
  String(
    runtimeResult.identity
      ?.currentDatabase ??
      '',
  ).toLowerCase() ===
    String(
      cliResult.identity
        ?.currentDatabase ??
        '',
    ).toLowerCase();

const report = {
  generatedAt:
    new Date().toISOString(),

  sameConfiguredTarget,
  sameConnectedTarget,

  runtime:
    runtimeResult,

  prismaCli:
    cliResult,
};

const outputPath =
  path.resolve(
    process.cwd(),
    'sql',
    'db-target-alignment-report.json',
  );

fs.mkdirSync(
  path.dirname(
    outputPath,
  ),
  {
    recursive: true,
  },
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
  'SOMIPHARM DATABASE TARGET ALIGNMENT',
);
console.log(
  '==================================',
);
console.log(
  `Configured target match: ${
    sameConfiguredTarget
      ? 'YES'
      : 'NO'
  }`,
);
console.log(
  `Connected target match:  ${
    sameConnectedTarget
      ? 'YES'
      : 'NO'
  }`,
);
console.log('');

for (
  const result of [
    runtimeResult,
    cliResult,
  ]
) {
  console.log(
    result.label,
  );

  console.log(
    `  configured server:   ${result.configured.server}:${result.configured.port}`,
  );

  console.log(
    `  configured database: ${result.configured.database}`,
  );

  console.log(
    `  configured user:     ${result.configured.user}`,
  );

  if (result.connected) {
    console.log(
      `  connected server:    ${
        result.identity
          ?.currentServer ??
        'unknown'
      }`,
    );

    console.log(
      `  connected database:  ${
        result.identity
          ?.currentDatabase ??
        'unknown'
      }`,
    );

    console.log(
      `  expected tables:     ${result.expectedTablesFound.length}/12`,
    );
  } else {
    console.log(
      '  connection:           FAILED',
    );

    console.log(
      `  error:                ${result.error}`,
    );
  }

  console.log('');
}

console.log(
  `Report saved to: ${outputPath}`,
);

if (
  !sameConfiguredTarget ||
  !sameConnectedTarget
) {
  process.exitCode = 2;
}
