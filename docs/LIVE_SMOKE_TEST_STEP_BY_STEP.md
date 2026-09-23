# SOMIPHARM live smoke test — step by step

Run these tests only against:

```text
yacinedb_rebuild_test
```

Do not use the real `yacinedb`.

## 1. Readiness check

From project root:

```powershell
.\scripts\run-live-smoke-readiness.ps1
```

Expected:

```text
Tables:   20/20
Triggers: 6/6
FK problems: 0
StockStatus: ACTIVE, INACTIVE
READY: isolated DB is ready for live application smoke testing.
```

## 2. Start backend

Open PowerShell window 1:

```powershell
cd C:\Users\KS\Documents\yacineapp\somepharm-maintenance
.\scripts\start-rebuild-test-backend.ps1
```

Leave it running.

Backend should listen on port 3001.

## 3. Start frontend

Open PowerShell window 2:

```powershell
cd C:\Users\KS\Documents\yacineapp\somepharm-maintenance
.\scripts\start-rebuild-test-frontend.ps1
```

Leave it running.

Open:

```text
http://localhost:3000
```

## 4. Authentication

Sign in with a valid Clerk account.

Because this is a rebuilt SQL database, the first local SQL user may be created
as `PENDING`. If the UI denies protected operations, inspect the Users page /
admin flow and assign the appropriate role/status in the TEST database only.

For the inventory test you need three distinct users:

- Controller 1
- Controller 2
- Controller 3

## 5. Stock

Create:

```text
SMOKE ACTIVE
status: ACTIVE
```

Create:

```text
SMOKE INACTIVE
status: INACTIVE
```

Verify:

- only ACTIVE / INACTIVE are available;
- no Archive option;
- no UUID/GUID visible.

## 6. Shelf

Create:

```text
Shelf A -> SMOKE ACTIVE
Shelf B -> SMOKE ACTIVE
```

Try creating a shelf in `SMOKE INACTIVE`.

Expected: rejected.

Open an empty shelf.

Expected exact empty message:

```text
Aucun article dans cet emplacement.
```

## 7. Standard equipment

Create:

```text
SMOKE STANDARD
type: Standard
status: ACTIVE
minimum: 1
```

Expected physical/global quantity after metadata creation:

```text
0
```

There should be no Movement button in the Equipment row.

## 8. Serialized equipment

Create:

```text
SMOKE SERIALIZED
type: Serialized
status: ACTIVE
```

Add one serial manually:

```text
SMOKE-SN-001
```

Expected:

- code is manually entered;
- code cannot later be changed;
- serial status can be changed;
- creating the identity does not itself perform an IN movement.

## 9. Movement IN

Open top-level:

```text
/movements
```

Create IN:

```text
SMOKE STANDARD -> Shelf A -> quantity 10
SMOKE SERIALIZED / SMOKE-SN-001 -> Shelf A -> quantity 1
```

Verify:

```text
Standard global quantity = 10
Standard Shelf A allocation = 10

Serial SMOKE-SN-001 shelf = Shelf A
Serialized global physical quantity follows the current backend movement rule.
```

## 10. Movement TRANSFER

Transfer:

```text
SMOKE STANDARD: 4 from Shelf A -> Shelf B
SMOKE-SN-001: Shelf A -> Shelf B
```

Expected:

```text
Standard global quantity = unchanged
Shelf A standard = 6
Shelf B standard = 4
Serial shelf = Shelf B
```

Destination must exclude source.

## 11. Movement OUT

OUT:

```text
SMOKE STANDARD: quantity 2 from Shelf B
SMOKE-SN-001 from Shelf B
```

Expected:

```text
Standard global quantity = 8
Shelf A = 6
Shelf B = 2
Serial shelf = none/null
```

## 12. Negative movement checks

Verify these are rejected:

```text
IN with a source shelf
TRANSFER source = destination
OUT quantity larger than source allocation
movement through INACTIVE stock
```

## 13. Inventory — PRIMARY_MATCH

Create an inventory with:

```text
Scope: SMOKE STANDARD
C1: User 1
C2: User 2
C3: User 3
```

Launch it.

C1 counts:

```text
Shelf A = 6
Shelf B = 2
```

C2 counts the same:

```text
Shelf A = 6
Shelf B = 2
```

Expected immediately:

```text
reconciliationStatus = PRIMARY_MATCH
accepted result = C1
C3 receives no task for this unit
```

## 14. Inventory — THIRD_REQUIRED

Create another inventory with the same equipment.

C1:

```text
Shelf A = 6
Shelf B = 2
```

C2 intentionally differs:

```text
Shelf A = 5
Shelf B = 2
```

Expected:

```text
THIRD_REQUIRED
C3 task exists for this unit only
```

C3:

```text
Shelf A = 6
Shelf B = 2
```

Expected:

```text
THIRD_RESOLVED
accepted result = C3
```

## 15. Finalization

Finalize only after all units are reconciled.

Verify:

- report contains C1 / C2 / C3 / Accepted;
- adjustment history is append-only;
- adjustment movement origin is `INVENTORY_ADJUSTMENT`;
- old movement records are not edited.

## 16. Final UI sweep

Verify everywhere:

- no visible UUID/GUID;
- no UUID/GUID copy button;
- no Archive stock status;
- Movement is a top-level navbar item;
- Equipment details show movement history and serials, not shelf management;
- no old manual/global C3 adjudication controls.

## When this whole test passes

The isolated rebuild is functionally validated.

Only then prepare the final real-database reconstruction plan for `yacinedb`.
