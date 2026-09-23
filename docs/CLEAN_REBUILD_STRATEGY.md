# SOMIPHARM controlled clean reconstruction strategy

Current evidence:

- Backend and frontend code compile/build.
- Nest runtime and Prisma CLI point to the same `yacinedb`.
- `yacinedb` has 0/12 expected application tables.
- No other database accessible to the application login contains the SOMIPHARM schema.
- No useful local SOMIPHARM `.bak/.bacpac/.mdf` was found in the targeted file scan.

The last recovery gate is SQL Server `msdb` backup history.

This package automates that gate.

## Run

From project root:

```powershell
.\scripts\run-clean-rebuild-preparation.ps1
```

The runner will:

1. require the successful DB-alignment report;
2. require the database-discovery report to contain no alternate candidate;
3. query current user tables;
4. query `msdb` backup history for the current database;
5. query restore history;
6. STOP if a full backup exists or history cannot be read;
7. only when safe, validate the current Prisma schema;
8. generate a new SQL candidate from EMPTY -> CURRENT Prisma schema;
9. scan the generated SQL for destructive/write keywords;
10. save a SHA-256 hash and summary.

It does **not execute** the generated SQL.

Generated files:

```text
backend/sql/rebuild-readiness-report.json
backend/sql/generated/current-schema-rebuild-candidate.sql
backend/sql/generated/current-schema-rebuild-candidate.sha256.txt
backend/sql/generated/current-schema-rebuild-summary.txt
```

## Why generate from the current Prisma schema?

The historical migration chain is known to be unsafe from zero. A fresh
EMPTY -> CURRENT schema candidate avoids replaying the broken migration chain.

However Prisma schema diff does not represent custom SQL Server objects such as
triggers/views. Those are added only after the core schema is validated.

## Next phase

If preparation passes:

1. create a NEW temporary database such as `yacinedb_rebuild_test`;
2. apply the generated candidate there;
3. seed required reference/auth/status data;
4. run backend tests against that temporary database;
5. apply hardening triggers;
6. run Stock/Shelf/Equipment/Movement/Inventory smoke tests;
7. only then decide how to recreate the real `yacinedb`.

Do not execute the candidate against `yacinedb` yet.
