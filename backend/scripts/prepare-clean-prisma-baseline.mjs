import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const BASELINE_NAME = '20260923_baseline';
const MIGRATIONS_DIR = path.resolve(process.cwd(), 'prisma', 'migrations');
const LEGACY_DIR = path.resolve(
  process.cwd(),
  'prisma',
  'migrations_legacy_prebaseline_20260923',
);
const BASELINE_DIR = path.join(MIGRATIONS_DIR, BASELINE_NAME);

const CANDIDATE = path.resolve(
  process.cwd(),
  'sql',
  'generated',
  'current-schema-rebuild-candidate.sql',
);

const HARDENING = path.resolve(
  process.cwd(),
  'sql',
  'rebuild_test_hardening.sql',
);

const MANIFEST = path.resolve(
  process.cwd(),
  'sql',
  'generated',
  'clean-prisma-baseline-manifest.json',
);

const KNOWN_BROKEN_MIGRATIONS = [
  '0_init',
  '20260907_finish_clerk_auth',
  '20260914_add_order_table',
  '20260915_add_inventory_shelf',
  '20260915_inventory_workflow',
  '20260919_inventory_v2_three_controller',
  '20260920_mouvement_equipment',
  '20260921_movement_header_lines_v2',
];

function sha256(buffer) {
  return crypto
    .createHash('sha256')
    .update(buffer)
    .digest('hex')
    .toUpperCase();
}

function splitGoBatches(sql) {
  return sql
    .split(/^\s*GO\s*;?\s*$/gim)
    .map((part) => part.trim())
    .filter(Boolean);
}

function hardeningForPrismaMigration(sql) {
  const batches = splitGoBatches(sql);
  const output = [];

  for (const batch of batches) {
    if (/CREATE\s+OR\s+ALTER\s+TRIGGER/i.test(batch)) {
      const escaped = batch.replaceAll("'", "''");
      output.push(`EXEC(N'${escaped}');`);
      continue;
    }

    output.push(batch);
  }

  return output.join('\n\n');
}

function currentMigrationEntries() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    return [];
  }

  return fs
    .readdirSync(MIGRATIONS_DIR, {
      withFileTypes: true,
    })
    .map((entry) => entry.name)
    .filter((name) => name !== 'migration_lock.toml');
}

function archiveLegacyMigrationsIfNeeded() {
  const entries = currentMigrationEntries();

  if (
    entries.length === 1 &&
    entries[0] === BASELINE_NAME
  ) {
    return {
      action: 'already_baselined',
      archived: false,
    };
  }

  const hasKnownBroken = entries.some((name) =>
    KNOWN_BROKEN_MIGRATIONS.includes(name),
  );

  if (!hasKnownBroken && entries.length > 0) {
    throw new Error(
      [
        'Safety stop: prisma/migrations contains an unknown migration layout.',
        `Entries: ${entries.join(', ')}`,
        'No files were moved.',
      ].join('\n'),
    );
  }

  if (fs.existsSync(LEGACY_DIR)) {
    throw new Error(
      [
        `Legacy archive already exists: ${LEGACY_DIR}`,
        'Safety stop: refusing to overwrite the existing migration archive.',
      ].join('\n'),
    );
  }

  if (fs.existsSync(MIGRATIONS_DIR)) {
    fs.renameSync(MIGRATIONS_DIR, LEGACY_DIR);
  }

  fs.mkdirSync(MIGRATIONS_DIR, {
    recursive: true,
  });

  return {
    action: 'archived_legacy',
    archived: true,
  };
}

function main() {
  for (const requiredPath of [
    CANDIDATE,
    HARDENING,
  ]) {
    if (!fs.existsSync(requiredPath)) {
      throw new Error(
        `Required source file missing: ${requiredPath}`,
      );
    }
  }

  const candidate = fs.readFileSync(CANDIDATE, 'utf8');
  const hardening = fs.readFileSync(HARDENING, 'utf8');

  const destructiveCandidatePatterns = [
    /^\s*DROP\s+DATABASE\b/gim,
    /^\s*DROP\s+TABLE\b/gim,
    /^\s*TRUNCATE\b/gim,
    /^\s*DELETE\s+FROM\b/gim,
    /^\s*RESTORE\s+DATABASE\b/gim,
  ];

  for (const pattern of destructiveCandidatePatterns) {
    if (pattern.test(candidate)) {
      throw new Error(
        `Safety stop: generated schema candidate matched forbidden pattern ${pattern}.`,
      );
    }
  }

  const archiveResult =
    archiveLegacyMigrationsIfNeeded();

  fs.mkdirSync(BASELINE_DIR, {
    recursive: true,
  });

  const migrationSql = [
    '/*',
    '  SOMIPHARM CLEAN PRISMA BASELINE',
    '  Generated from the validated current Prisma schema plus validated',
    '  database hardening triggers.',
    '',
    '  IMPORTANT:',
    '  - This baseline is for NEW/EMPTY databases.',
    '  - Existing yacinedb must be BASELINED with prisma migrate resolve.',
    '  - Do NOT execute this baseline directly against the populated yacinedb.',
    '*/',
    '',
    '/* ============================================================',
    '   CURRENT PRISMA SCHEMA',
    '   ============================================================ */',
    '',
    candidate.trim(),
    '',
    '/* ============================================================',
    '   DATABASE HARDENING TRIGGERS',
    '   ============================================================ */',
    '',
    hardeningForPrismaMigration(hardening),
    '',
  ].join('\n');

  const migrationPath = path.join(
    BASELINE_DIR,
    'migration.sql',
  );

  fs.writeFileSync(
    migrationPath,
    migrationSql,
    'utf8',
  );

  fs.writeFileSync(
    path.join(
      MIGRATIONS_DIR,
      'migration_lock.toml',
    ),
    '# Please do not edit this file manually\nprovider = "mssql"\n',
    'utf8',
  );

  const bytes = fs.readFileSync(migrationPath);
  const hash = sha256(bytes);

  const manifest = {
    generatedAt: new Date().toISOString(),
    baselineName: BASELINE_NAME,
    migrationPath,
    migrationSha256: hash,
    candidateSha256: sha256(
      fs.readFileSync(CANDIDATE),
    ),
    hardeningSha256: sha256(
      fs.readFileSync(HARDENING),
    ),
    legacyArchive: LEGACY_DIR,
    archiveResult,
    sourceFiles: {
      candidate: CANDIDATE,
      hardening: HARDENING,
    },
  };

  fs.mkdirSync(
    path.dirname(MANIFEST),
    {
      recursive: true,
    },
  );

  fs.writeFileSync(
    MANIFEST,
    JSON.stringify(manifest, null, 2),
    'utf8',
  );

  console.log('');
  console.log('SOMIPHARM CLEAN PRISMA BASELINE PREPARED');
  console.log('========================================');
  console.log(`Baseline: ${BASELINE_NAME}`);
  console.log(`Migration: ${migrationPath}`);
  console.log(`SHA256: ${hash}`);
  console.log(`Legacy migrations: ${LEGACY_DIR}`);
  console.log(`Manifest: ${MANIFEST}`);
  console.log('');
  console.log(
    'No database was changed. Test this baseline on yacinedb_baseline_test next.',
  );
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
