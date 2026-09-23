# SOMIPHARM clean Prisma baseline — final migration repair

This phase repairs the migration history after the production reconstruction.

It does NOT delete production business data.

## Why this is required

The old migration chain cannot reconstruct the schema safely from zero. It
contains an empty initial migration and later migrations that assume business
tables already exist.

The clean baseline replaces that historical chain for future deployments.

## 1. Prepare the baseline files

From the project root:

```powershell
.\scripts\prepare-clean-prisma-baseline.ps1
```

This:

- moves the broken historical migration directory to
  `backend\prisma\migrations_legacy_prebaseline_20260923`;
- creates:
  `backend\prisma\migrations\20260923_baseline\migration.sql`;
- includes the validated current schema plus the six DB hardening triggers;
- writes a SHA-256 manifest;
- changes NO database.

## 2. Create an isolated fresh test DB

In SSMS, using Windows/sysadmin credentials, execute:

```text
backend\sql\create_baseline_test_database_admin.sql
```

Expected:

```text
SUCCESS: yacinedb_baseline_test created.
```

## 3. Prove prisma migrate deploy works from zero

From project root:

```powershell
.\scripts\test-clean-prisma-baseline.ps1
```

This explicitly targets only:

```text
yacinedb_baseline_test
```

It performs:

```text
empty DB guard
→ npm build
→ prisma migrate deploy
→ prisma generate
→ TypeScript check
→ build
→ reference/security seed
→ 23-table verification
→ 6-trigger verification
→ FK verification
→ prisma migration-history verification
→ prisma migrate status
```

Required result:

```text
PASS: CLEAN PRISMA BASELINE IS VALIDATED.
CLEAN PRISMA BASELINE TEST PASSED.
```

## 4. Register the baseline on the existing production DB

The production database already contains the schema, so NEVER execute the
baseline migration against it.

Instead, after the isolated test passes:

```powershell
.\scripts\register-production-prisma-baseline.ps1 `
  -Confirmation "I CONFIRM REGISTER VALIDATED BASELINE ON YACINEDB"
```

The registration script verifies:

- DB is exactly `yacinedb`;
- expected 23 schema tables are present;
- 6 hardening triggers are enabled;
- foreign keys are trusted;
- the baseline SQL hash is identical to the isolated validated hash.

It then uses:

```text
prisma migrate resolve --applied 20260923_baseline
```

This records the migration in `_prisma_migrations` without recreating existing
tables.

## 5. Future migration rules

For production:

```text
prisma migrate deploy
```

only after a new migration has first been tested on a non-production database.

For development migration generation:

```text
prisma migrate dev
```

only against a disposable/development database, NEVER against production.

Never use on production:

```text
prisma db push
prisma migrate reset
prisma migrate dev
```

Keep SQL Server FULL backups before production schema deployments.
