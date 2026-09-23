# Big step: isolated database reconstruction

This phase creates a NEW SQL Server database and leaves `yacinedb` untouched.

Default new database:

```text
yacinedb_rebuild_test
```

## Safety gates

The runner refuses to continue unless:

- `rebuild-readiness-report.json` exists;
- its decision is `READY_TO_GENERATE_REBUILD_CANDIDATE`;
- `current-schema-rebuild-candidate.sql` exists;
- its SHA-256 matches the generated hash file;
- the candidate contains no forbidden destructive operations;
- the requested test database does not already exist.

The runner never drops or overwrites an existing database.

## Run

```powershell
.\scripts\run-rebuild-test-database.ps1
```

To use another isolated name:

```powershell
.\scripts\run-rebuild-test-database.ps1 -DatabaseName yacinedb_rebuild_test_2
```

## What it does

1. Creates a brand-new isolated SQL Server database.
2. Applies the EMPTY -> CURRENT Prisma schema candidate.
3. Seeds only reference/security metadata:
   - StockStatus `ACTIVE`
   - StockStatus `INACTIVE`
   - `ADMIN` role
   - `TECHNICIAN` role
   - current system permission registry
4. Does not create business Stock/Shelf/Equipment/Movement/Inventory rows.
5. Verifies expected tables and trusted foreign keys.
6. Writes a JSON verification report.

## Start backend against the test DB

After the rebuild test passes:

```powershell
.\scripts\start-backend-rebuild-test.ps1
```

This sets `DB_NAME=yacinedb_rebuild_test` only for that process.
It does not modify `.env`.

The frontend can continue running normally against the backend at port 3001.

## Still not included

Custom SQL Server hardening triggers are intentionally not installed in this
phase.

The next phase installs them on the TEST database first and runs the complete
Stock -> Shelf -> Equipment -> Movement -> Inventory C1/C2/C3 workflow.

Only after the test database passes should the real `yacinedb` be reconstructed.
