# Next part: confirm the exact SQL Server database

Before restoring or creating any SQL trigger/constraint, confirm that:

- the NestJS runtime (`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`) and
- the Prisma CLI (`DATABASE_URL`)

connect to the same SQL Server and the same database.

The backend uses `DB_*` at runtime while Prisma CLI reads `DATABASE_URL`.

## Step 1

From the project root:

```powershell
.\scripts\run-db-target-alignment.ps1
```

This creates:

```text
backend\sql\db-target-alignment-report.json
```

Passwords are never printed or stored.

Expected:

```text
Configured target match: YES
Connected target match:  YES
expected tables:          12/12
```

## Step 2

In SSMS run:

```text
backend\sql\quick_schema_alignment_audit.sql
```

It is SELECT-only.

## If there is a mismatch

Do not run:

```text
prisma db push
prisma migrate reset
prisma migrate dev
prisma migrate deploy
```

Correct the `.env` target first.

## What comes after

Once the target is confirmed and the SQL output shows which triggers/FKs are
present or missing, the final hardening patch can be generated only for the
missing objects.
