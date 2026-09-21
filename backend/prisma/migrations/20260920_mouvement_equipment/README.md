# Multi-equipment movements: compatibility and deployment

`Mouvement` remains the business document. `MouvementEquipment` contains its equipment, quantity, optional serial, source and destination lines. Legacy nullable columns remain in place. `EqipmentMouvements` is unrelated and remains untouched.

## Inspect before deploying

Run `inspect.sql` with a read-only SQL Server connection first. It reports columns, indexes, foreign keys, Prisma migration history, header/line counts, missing children, multi-line parents, quantity mismatches and duplicate equipment/shelf allocations.

The connected database was inspected on 2026-09-20: the child table has all 8 expected columns, its primary key and 5 non-unique indexes, and 5 enabled/trusted foreign keys. `_prisma_migrations` is absent. Headers, children, parents without children, multi-line parents and quantity mismatches were all zero. Duplicate allocation pairs and null shelf counters were also zero. These are observations for that connection, not assumptions for another deployment.

The migration was previously executed directly. **Do not rerun it or blindly run `migrate deploy` against this database.** No schema or data changes were made during this hardening pass. The original `migration.sql` was left unchanged.

Deployment cases:

- If the child table exists and matches the schema, do not execute the create-table migration again. Reconcile/baseline migration history as a separate reviewed operation after comparing the complete physical schema. Never replay `0_init` on an existing database.
- If the table is absent and prerequisite schema is present, the existing migration creates it and backfills one child per legacy header with an equipment ID. Use the established deployment process after inspection.
- If the table is partially present, foreign keys are disabled/untrusted, quantities disagree or history is incomplete, stop automatic migration and review the discrepancy. Do not deduplicate, delete history, change quantities or add UNIQUE constraints to repair it silently. Legacy rows without children remain readable.

No reset, destructive push, table/column removal, migration-history fabrication or new uniqueness constraint is required by this change.

## Public API contract

Both `/equipment-movement` and `/equipment-movements` remain supported under their existing Clerk permissions.

| Request | Response |
| --- | --- |
| POST with a legacy single-item body | One header with populated legacy equipment/route fields and an additive `items` array |
| POST with `{ items: [...] }` | One header with all child lines |
| POST `/batch` with `{ items: [...] }` | Legacy-compatible array of equipment-level rows, all referencing the same parent ID |
| POST `/batch?view=header` | One header with all child lines; used explicitly by the current UI |
| GET routes, default or `view=lines` | Legacy-compatible equipment-level rows, filtered and paginated at line level |
| GET routes with `view=header` | Documents with full `items` arrays, filtered and paginated at header level |

Use `mouvementEquipmentId` as the row key for a child and `mouvementId` as the shared document identity. A legacy row with no child retains its original ID. No row is counted twice when its legacy fields coexist with a child. Search filters apply to the same child, with a fallback to legacy fields only for headers with no children. `MIXED` is a document status and can be searched in header view. Entry/exit aliases remain supported.

## Integrity and compatibility

- All movement lines, stock updates and the header commit in one serializable transaction. Equipment/shelf update locks are acquired in consistent order; serial relocation also checks its original location in the update predicate.
- Each serial can appear only once. Serialized quantities must be 1 and belong to the specified equipment. Bulk repeated lines consume the transaction's current available balance. Source allocations, shelf totals and bulk equipment totals cannot be decremented below zero. Integer overflow is rejected.
- Duplicate allocation rows cause an explicit conflict for the affected equipment/shelf; none are deleted or merged. No UNIQUE constraint is added.
- Active inventory scopes are checked inside the transaction. Case differences in UUIDs cannot bypass a scope, and unreadable scopes block movements for review.
- Global serialized equipment quantity continues to count registered serials. Shelf entry/exit relocates a serial without changing its registration count.
- Referenced equipment, serials and shelves cannot be deleted, nor serialized equipment converted when doing so would delete referenced serials. The API returns a conflict and preserves history; unreferenced deletion remains available. Archiving/soft deletion is outside this refactor.
- Inventory investigation reads both child-based and legacy histories. Its counting, adjudication and finalization rules are otherwise unchanged.
- Dashboard totals count documents, with separate mixed/other categories; recent rows retain each child's actual route and serial. Equipment history loads every page and scopes totals to the chosen equipment.

## Verification

Backend unit/transaction-simulation tests cover single and grouped contracts, pagination hydration, SQL parameterization, rollback, mixed bulk/serial routes, active inventory locks, serial ownership/staleness, duplicate allocations, bounds and history protection. Existing inventory unit tests are included. Frontend ledger tests run with `node --experimental-strip-types --test tests/movement-ledger.test.mts` from `frontend`.

Five additional SQL Server checks used CTE/VALUES fixtures and SELECT statements only to verify the actual pagination SQL: legacy fallback, no header/child double count, matching-line filters and stable pages. No production rows were inserted or deleted.

The existing write-based movement integration suite is now opt-in: it requires `RUN_MOVEMENT_DB_TESTS=1` and a dedicated `DB_NAME` beginning with `test_` or `test-`. Never point it at production. Real concurrent-write stress testing remains a staging validation; unit simulations and read-only SQL checks do not prove concurrent database behavior.
