# Database hardening audit

This phase is deliberately read-only.

It checks the live SQL Server database for:

- required tables and hardened columns;
- six expected hardening triggers;
- disabled/untrusted foreign keys;
- disabled/untrusted check constraints;
- StockStatus domain (`ACTIVE` / `INACTIVE`);
- negative stock quantities;
- duplicate Equipment/Shelf allocation rows;
- Standard Equipment global quantity vs allocations;
- Serialized Equipment global quantity vs physically shelved serials;
- serialized per-shelf allocation consistency;
- Shelf totals vs allocation totals;
- Movement header/line route/type/quantity consistency;
- Inventory accepted-attempt / per-unit reconciliation invariants.

## Required prerequisite

The file:

`backend/sql/db-target-alignment-report.json`

must already show:

```text
sameConfiguredTarget = true
sameConnectedTarget = true
```

The PowerShell runner refuses to continue otherwise.

## Run

From project root:

```powershell
.\scripts\run-db-hardening-audit.ps1
```

The JSON report is written to:

```text
backend\sql\db-hardening-audit-report.json
```

Exit codes:

- `0`: clean
- `2`: warnings only
- `3`: integrity/schema errors found
- other: audit execution error

## SSMS equivalent

You can also run:

`backend/sql/final_hardening_readonly_audit.sql`

It contains SELECT/metadata inspection only.

## Important

Do not automatically repair rows reported by the audit.

Do not run:

```text
prisma db push
prisma migrate reset
prisma migrate dev
prisma migrate deploy
```

The next patch should be generated only after reviewing the audit report.
