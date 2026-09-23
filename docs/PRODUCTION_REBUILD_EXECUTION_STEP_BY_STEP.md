# SOMIPHARM production reconstruction — exact final steps

This phase changes the real `yacinedb`.

Do not start it until:

- live smoke testing passed against `yacinedb_rebuild_test`;
- `FINAL_yacinedb_rebuild.sql` was generated;
- the current empty `yacinedb` has a FULL backup;
- production preflight says READY.

## A. Generate the final SQL if not already generated

From project root:

```powershell
.\scripts\confirm-live-smoke-passed.ps1 -Confirmation "I CONFIRM LIVE SMOKE TEST PASSED"
.\scripts\generate-production-rebuild-package.ps1
```

Expected file:

```text
backend\sql\production\FINAL_yacinedb_rebuild.sql
```

Do not execute it yet.

## B. Create the safety backup in SSMS

Use Windows/sysadmin connection.

Open:

```text
backend\sql\backup_current_empty_yacinedb.sql
```

Execute the whole file.

Save the returned backup path.

## C. Run production preflight

Back in PowerShell:

```powershell
.\scripts\run-production-apply-preflight.ps1
```

Required final line:

```text
READY FOR MANUAL PRODUCTION REBUILD IN SSMS.
PREFLIGHT PASSED.
```

If it does not pass, do not continue.

## D. Extra SSMS guard

Open:

```text
backend\sql\production_apply_guard.sql
```

Execute.

Required result:

```text
ProductionDatabaseState = READY
DatabaseName = yacinedb
```

It must also show the latest FULL backup.

## E. Apply the final schema

Now open:

```text
backend\sql\production\FINAL_yacinedb_rebuild.sql
```

Check the database selector / first `USE` statement says:

```sql
USE [yacinedb];
```

Execute the entire file once.

Do not run it twice.

Do not run Prisma migrations afterwards.

## F. Verify immediately

Open:

```text
backend\sql\verify_production_after_rebuild.sql
```

Execute.

Expected:

- 23/23 listed schema tables = PRESENT;
- 6/6 hardening triggers = ENABLED;
- `ACTIVE`, `INACTIVE`;
- no disabled/untrusted foreign keys;
- new business counts normally start at zero.

## G. Start the normal application

Backend:

```powershell
cd C:\Users\KS\Documents\yacineapp\somepharm-maintenance\backend
npm run start:dev
```

Frontend:

```powershell
cd C:\Users\KS\Documents\yacineapp\somepharm-maintenance\frontend
npm run dev
```

Now both use the normal `.env`, which points to `yacinedb`.

## H. Final production smoke test

Create only small test data:

```text
ACTIVE stock
Shelf
Standard Equipment
IN 1
TRANSFER
OUT
```

Then do one small C1/C2 matching inventory.

After successful production smoke testing, the next project task is the
migration-baseline / backup strategy so the broken historical migration chain
cannot be replayed against this database.
