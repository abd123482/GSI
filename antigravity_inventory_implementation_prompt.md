# SomePharm — Complete Inventory Workflow Implementation

You are the senior full-stack engineer working inside my existing SomePharm maintenance repository. Implement the complete inventory feature in the real backend and frontend files. Do not stop at a plan, mock screens, generic CRUD, pseudocode, or a database schema. Deliver integrated, tested functionality while preserving the existing application.

## 1. Repository context and non-negotiable boundaries

Use the checked-out repository as the implementation source of truth. The attached Repomix XML is a reference snapshot, not the file to edit. Inspect the original files and report material differences from this context before adapting the implementation.

The supplied snapshot contains:

- A NestJS backend using Express, ESM imports ending in `.js`, Clerk authentication, application-managed roles/permissions, Zod schemas, Vitest, and a shared PrismaService.
- Microsoft SQL Server, not PostgreSQL. `backend/prisma/schema.prisma` uses `provider = "sqlserver"`, the `prisma-client` generator, output `../src/generated/prisma`, and the `partialIndexes` preview feature. PrismaService uses PrismaMssql.
- Backend package declarations for NestJS `^12.0.1` and `@prisma/adapter-mssql` `^7.10.0`. The supplied backend manifest does not declare `prisma`, `@prisma/client`, or `zod`; verify the installed dependencies and add missing direct dependencies at compatible versions. Do not assume the adapter declaration proves the installed Prisma CLI/client version.
- A Next.js App Router frontend declaring Next `16.3.4`, React `19.2.8`, Tailwind 4, existing shadcn/Base UI components, TanStack Query, Axios, React Hook Form, Zod, Sonner, Lucide, and a barcode-scanning dependency.
- An existing French-language, warm-dark Warp-inspired business interface. Preserve it rather than installing a different dashboard template.

Inspect these paths before implementation:

```text
backend/prisma/schema.prisma
backend/prisma/MIGRATION_BASELINE.md
backend/prisma/migrations/
backend/prisma/seed.ts
backend/prisma/scripts/seed-auth.sql
backend/prisma.config.ts
backend/package.json
backend/src/app.module.ts
backend/src/prisma/
backend/src/inventory/
backend/src/orders/
backend/src/auth/
backend/src/users/
backend/src/equipment/
backend/src/shelves/
backend/src/serial-numbers/
backend/src/movements/
frontend/AGENTS.md
frontend/package.json
frontend/src/app/layout.tsx
frontend/src/app/globals.css
frontend/src/app/equipment/page.tsx
frontend/src/app/shelves/page.tsx
frontend/src/app/users/page.tsx
frontend/src/components/navigation/
frontend/src/components/equipment/
frontend/src/components/shelf/
frontend/src/components/ui/
frontend/src/hooks/use-api.ts
frontend/src/hooks/use-permissions.ts
frontend/src/hooks/use-equipments.ts
frontend/src/services/
frontend/src/schemas/
frontend/src/types/
frontend/src/providers/query-provider.tsx
frontend/src/lib/warp-theme.ts
logic.txt
```

The current InventoryService only performs reads and does not persist the requested workflow. AppModule does not register inventory functionality. Its DTO selects equipment/shelves by names and includes `roles`, `users`, `shelfs`, and `equipments`. Existing inventory tests reference an older behavior and need a justified update.

Existing models include Inventory, Inventory_User, Inventory_Equipment, Inventory_Shelf, Inventory_SerialNumber, Order, Equipment, EquipmentShelfs, Shelf, SerialNumber, and Mouvement. Inventory_Equipment stores an equipment total; Inventory_Shelf only links inventory and shelf. Their join cannot establish the quantity of each equipment on each shelf. A historical equipment–shelf snapshot must be added.

Keep Clerk, the SQL Server provider, shared PrismaService, public functionality, naming mappings, and existing records. Do not introduce another authentication system, ORM, database, microservice architecture, or mandatory external infrastructure. Read installed package documentation when version-specific APIs differ from familiar examples.

## 2. Required business behavior and explicit policy defaults

A user with `inventory.create` creates an inventory, chooses its type and scope, and assigns an ordered list of at least two different eligible users. The inventory is either `ByEquipment` or `ByShelf`.

User 1 counts one equipment or shelf. Once that work unit is submitted, user 2 receives that same unit immediately. User 1 can continue the next unit while user 2 counts the previous one. Do not wait for user 1 to finish the entire inventory.

Store count observations in the existing Order table. Compare independent user results, including positions and serial identities, and compare the accepted result with previous finalized inventory information. Show changes and issues to the inventory manager and provide the appropriate tasks/notifications to participants.

Use these explicit defaults for details not otherwise defined:

**Last user:** the last person in the ordered participant list is the final adjudicator. This means the final assigned person, not automatically the creator.

**Two participants:** both perform the initial independent counts. A disagreement creates a new final-recount attempt for user 2. That repeat is not a third independent vote. If disagreement remains, their explicit, reasoned final decision requires acknowledgement by a different authorized inventory manager/finalizer before finalization. Display this weaker independence clearly; recommend, but do not require, three participants.

**More participants:** users 1 and 2 are mandatory initial counters. Remaining users are an ordered escalation chain. Request the next independent count only while disagreement remains. The final assigned user explicitly adjudicates when consensus still cannot be established.

**Blind counting:** counters do not see earlier users' quantities or historical/live expected quantities in counting responses. Existing general stock permissions may already let a user inspect stock elsewhere; describe blind mode as hiding count-sheet guidance, not as an absolute guarantee of ignorance. Never expose another participant's pending results through alternate Order routes.

**Completion:** automatically mark an inventory ready for finalization when its required work is resolved. Finalization is a deliberate authorized action, not a client-supplied status update.

**Live stock:** finalization creates an immutable audit result. Applying corrections to live stock is a separate, explicitly authorized action with a preview, concurrency checks, and an adjustment audit. Never silently change live stock when a counter saves or submits.

**Counting stability:** use persistent, scope-aware application locks during active counting. Block conflicting stock/location writes for the counted scope until finalization or cancellation. These are business locks, not an SQL transaction held open while humans count. State clearly that direct SSMS writes bypass application controls; recheck live-state consistency before finalization and adjustment.

Document these defaults in the feature documentation and make the consequential ones visible in the creation/review UI.

## 3. Creation, permissions, and eligible participants

Use internal User.userId UUIDs, never Clerk IDs as database foreign keys. Obtain creator, submitting user, role snapshot, timestamps, and decision actor from the authenticated server context using the existing CurrentUser/AuthenticatedUser conventions. Do not trust client-supplied actor IDs, role IDs, statuses, expected values, or approval flags.

Provide coherent permissions for creation, reading/supervision, counting, active reassignment, resolution, finalization, report access/export, cancellation, and applying stock adjustments. Retain `inventory.create`; suggested additions are `inventory.read`, `inventory.count`, `inventory.assign`, `inventory.resolve`, `inventory.finalize`, `inventory.report`, `inventory.cancel`, and `inventory.adjust-stock`. Document the route/action matrix and ownership rules.

Creation permission must allow initial scope selection, participant selection, and launch of the creator's valid draft without requiring global user-management permission. Give creators contextual access to their own inventories; participants can access their own assigned work; global supervision requires an appropriate permission. Respect the existing ADMIN permission policy, but never let an admin impersonate another counter or bypass workflow invariants.

Add a dedicated paginated eligible-users lookup for inventory creation. Do not make the creator depend on `/admin/users`, which requires `user.manage`. Return only minimal identity/eligibility fields. Require active users with counting permission; the final adjudicator must have resolution permission. Assignment must never silently change someone's role or grant permissions.

Reject duplicate users, fewer than two users, unknown/inactive users, unauthorized adjudicators, empty scope, duplicate identifiers, invalid UUIDs, and contradictory type-specific selections. Revalidate eligibility at launch and at mutation time. If a user is disabled mid-inventory, notify the manager and offer audited reassignment of pending work without overwriting submitted evidence or creating two supposedly independent counts by the same person.

Use a discriminated creation schema: `ByEquipment` accepts equipment IDs, `ByShelf` accepts shelf IDs; both accept ordered participant IDs and basic inventory metadata. Use names only for display/search. Preserve legacy compatibility only through an explicit, validated adapter, not ambiguous name matching or unrestricted old endpoints.

## 4. Baseline generation and scope semantics

Keep four concepts separate: previous finalized audit state, live ledger state at launch, each person's observations, and the accepted final audit state. A previous inventory is a comparison reference, not proof that nothing legitimately changed afterward.

Freeze reference snapshots at launch. A draft preview is provisional and must be rebuilt or version-checked at launch. Store provenance, source inventory IDs, source completion times, coverage, and a server-generated cutoff time. Do not repeatedly read changing live rows as historical evidence.

For each work unit, select the latest finalized, trustworthy inventory with complete compatible coverage of that unit. Order by finalization time with a deterministic tie-breaker, not creation time alone. A newer partial inventory must not imply that equipment absent from it disappeared. Use per-unit/per-line provenance when different units have different source inventories. Set parentInventoryId only when it truthfully represents a single common parent; do not overload it with participant rounds.

For ByEquipment, create one work unit per selected equipment. Derive its prior locations and quantities from the finalized equipment–shelf snapshot. Include all recorded positions, not just one shelf. Supplement discovery with live-at-launch locations/items clearly marked as live evidence rather than historical results. Allow independent reporting of additional observed locations.

For ByShelf, create one work unit per selected shelf. Derive prior contents and per-equipment quantities for that shelf. Include currently known additions as discovery candidates, and let counters record unexpected equipment. An empty selected shelf is still a work unit requiring two explicit confirmations.

A ByEquipment inventory does not verify every other equipment on its associated shelves. A ByShelf inventory does not verify the global total of equipment located elsewhere. Store explicit coverage metadata; membership in Inventory_Shelf alone must never mean full shelf coverage.

When no compatible verified baseline exists, preserve any usable historical evidence but mark missing historical quantities/positions unknown. Capture current ledger data as `INITIAL_LIVE_SNAPSHOT` or another clearly unverified bootstrap source. Never invent a previous quantity of zero, distribute a historic equipment total across shelves arbitrarily, or certify legacy records merely because they exist.

Distinguish uncounted, confirmed zero, unassigned, outside scope, unknown location, and external-repair/other legitimate off-shelf states. Inspect current status semantics before classifying an off-shelf serial as missing. Missing evidence is not automatically zero stock.

Scope is frozen after launch. An observation outside a shelf inventory's scope is an investigation lead, not permission to replace that other shelf's quantities. Any supplementary counting must have explicit scope, locking, independent verification, and audit linkage.

## 5. Work-unit pipeline and lifecycle

Implement explicit server-side state transitions. A suitable inventory lifecycle is `DRAFT -> IN_PROGRESS -> READY_TO_FINALIZE -> FINALIZED`, with `CANCELLED` for permitted nonfinal states. Unresolved/recount activity belongs to work-unit states and is reflected in inventory progress. Do not force the entire inventory into a state that prevents other units from progressing normally.

Work units should distinguish initial counting, second counting, recount required, awaiting adjudication, resolved without change, and resolved with change. Count attempts should distinguish blocked, available, in progress, submitted, cancelled, and skipped-not-required.

At launch, atomically freeze scope/baselines/participants, acquire appropriate business locks, create the work units, and make first-user assignments available. Second-user assignments remain blocked until the corresponding first-user submission commits.

Submitting a unit must atomically validate its completeness, persist/freeze its Order observations, mark the attempt submitted, advance only that unit, create the next required task/notification, and update progress. Use one transition implementation; controllers, old Order routes, and retry handlers must not implement conflicting paths.

Example: U1 submits equipment A, so U2 receives A while U1 continues B. U2 must not be able to start B until U1 submits B. The same behavior applies to shelf work units.

Drafts can be resumed after refresh. Submitted observations are immutable; corrections require a new linked attempt with a reason. Cancellation preserves existing evidence, stops pending tasks, and releases locks transactionally. Finalized inventories cannot be silently reopened or overwritten; a correction is a new linked inventory or explicitly versioned audited correction.

## 6. Count entry and Order persistence

Keep Order as the observation table and extend it safely. Add a parent count-attempt/submission concept so one user can submit many equipment–shelf rows as one complete work unit. An empty shelf submission must exist even with no positive observation rows.

For nonserialized equipment, record observed quantity per equipment and actual shelf/location. Quantities must be nonnegative integers within the supported range. Zero must be explicit; a blank field is not zero. Draft nulls may represent unfinished entries but may not survive required submitted lines.

For serialized equipment, capture individual serial identity and observed location, with optional scanning through the existing barcode library and manual input fallback. Enforce equipment ownership of known serials, prevent repeated scanning of the same serial within an attempt, and detect conflicting locations across units in the same inventory round. Equal totals with different serial identities are not a match.

Do not double-count serialized units by adding both their scan rows and a separately entered aggregate. Derive serialized quantities from validated serial observations using documented rules. Unknown/ambiguous serial codes must be recorded as issues for authorized resolution, not guessed or silently inserted into the catalog. Respect the current schema's nullable/nonunique serial-code reality.

A serial found on a different shelf must be accepted as an observation and flagged, not rejected simply because it disagrees with its current stored position. Authorization and scope validation remain mandatory.

Counters need a way to mark expected items not found, confirm an empty shelf, record unexpected known equipment, report unidentified items with notes, and enter actual shelf information. Catalog creation or stock movement permissions are not implied by counting permission.

Validate and persist each draft change with optimistic version checks. Submission requires explicit completion confirmation for the whole work unit, including all pages, not merely currently displayed rows. Preserve observation timestamps separately from submittedAt and distinguish waiting time from active recorded work time.

## 7. Reconciliation and final adjudication

Implement reconciliation as deterministic, independently tested domain logic. Normalize complete submissions into maps keyed by equipment and actual location, plus serial identity where relevant. Compare the union of relevant locations/items, including unexpected observations. Never compare only equipment totals or array order.

Treat an omitted scoped item as zero only when the submission explicitly confirms complete coverage and the rule is documented. Otherwise classify it as incomplete or unknown. Never coerce a partially saved draft into a completed zero count.

Apply this decision logic:

1. U1 and U2 match, and match the verified historical distribution: resolve without historical change.
2. U1 and U2 match each other but differ from history: accept a candidate confirmed change and show its quantity/location details to the manager. Do not send it into endless recounts merely because history differs.
3. U1 and U2 disagree: record a counting disagreement and release the next eligible recount task. One user's agreement with history does not automatically make that user correct.
4. An escalation user's complete submission matches an earlier complete submission from a different user: establish consensus under the documented two-independent-matching-results policy. Preserve dissent and mark unused later escalation attempts skipped, not unfinished.
5. The final assigned user still matches nobody: require an explicit final adjudication containing the selected/corrected result, explanatory notes, evidence references, and actor/time. Mark it `FINAL_ADJUDICATION`, not consensus. Use the special two-participant acknowledgement rule above.

When historical values are unknown, matching independent observations establish an initial audited baseline; do not label them unchanged or calculate a fictional historical delta. Keep a final adjudicator's recount blind until they submit their own observations, then reveal authorized comparison evidence for their explicit decision.

Each accepted result needs provenance: matching attempt IDs or final decision ID, resolution method, and any required approval. Never average disagreements, use the newest row automatically, or let a generic PATCH set a resolved flag.

Classify at least counting disagreement, quantity shortage/excess, missing expected equipment, unexpected equipment, location change/redistribution, serial mismatch, duplicate serial, unknown item, unknown baseline, and incomplete coverage. Keep discrepancy type, severity, verification status, and resolution status separate. A resolved issue remains part of the audit.

For quantities, retain both:

```text
deltaPrevious = finalObserved - previousVerified   // only where history is known
deltaLive     = finalObserved - liveAtLaunch      // only where live reference is known
```

A change since the last inventory can be a legitimate intervening movement, not a new unexplained loss. Show movement evidence where available and label unavailable history honestly. The current Mouvement schema does not contain a historical timestamp/actor field; do not fabricate those for old rows. Add forward-looking audit metadata if needed without inventing legacy facts.

Example: prior equipment A is Shelf-1:10, Shelf-2:0; both users observe Shelf-1:7, Shelf-2:3. Total remains 10, but this is a location-distribution change, not a no-change result. For nonserialized equipment, describe a possible three-unit redistribution, not proof of a particular physical transfer. Confirmed serial identity or an actual movement record can supply stronger evidence.

A total of 8 instead of 10 has a net -2 difference. A matching total with different locations still has a location issue. Avoid counting a suspected transfer twice as both a net loss and a net gain. Cross-shelf matching must respect stock boundaries, verified coverage, quantities, and serial identities; outside-scope observations remain unverified leads.

Recompute affected inventory-wide consistency checks when related units finish. Do not finalize while conflicting serial locations or other blocking issues remain.

## 8. Prisma data model and migrations

Produce a clear schema design before coding, then implement it. Prefer extending existing concepts rather than creating a parallel inventory system. Suggested logical records are:

- Inventory: creator, title/reference, type, lifecycle, timestamps, scope/cutoff version, completion/finalization actor, cancellation reason, policy version.
- Inventory_User: ordered participants, task responsibility, identity/role snapshot, and auditable replacements. Enforce distinct participants and unique sequence positions.
- InventoryWorkUnit: one equipment OR one shelf, coverage metadata, workflow state, and version. Enforce the type-specific target rule.
- InventoryCountAttempt: work unit, assigned user, sequence/round, purpose, status, timestamps, completion confirmation, optimistic version, and linked prior attempt when recounting.
- Order: attempt foreign key, actual equipment/location/serial observations, quantityCalculated, notes, identity/time snapshots, and structured unknown-item evidence where needed. Actor fields are set by the server.
- Historical/live/final snapshot lines: normalized equipment–shelf quantities with phase, coverage, provenance, source inventory, and display-name snapshots. A new `Inventory_Equipment_Shelf` mapping or equivalently named model is appropriate. Add serial-location snapshots too; joining a historical serial ID to its current Shelf is not a historical snapshot.
- Discrepancy and resolution records: affected unit/lines, compared attempts, old/new quantities and positions, issue type, state, decision reason, decision actor, and timestamps.
- Audit events and persistent in-app notifications, with recipient/event deduplication and read timestamps.
- Scope locks and an adjustment batch/lines or equivalent auditable stock-adjustment representation.

You may consolidate records when it preserves the required semantics; document the mapping. Preserve Inventory_Equipment as a finalized aggregate consistent with detailed results. Do not fill its nonnullable countedQuantity with a fake value merely to represent draft selection; draft targets belong in work-unit/scope records. Inventory_Shelf remains scope/membership, not an invented quantity source.

Preserve original table mappings, UUID native types, foreign keys, and historical rows. New workflow-owned rows need strong required fields even when legacy Order rows are nullable; implement conditional constraints/backfills without inventing historical submissions or certifying old inventories. Keep legacy data distinguishable.

Use SQL Server-compatible status strings with TypeScript/Zod unions and SQL CHECK constraints rather than unsupported Prisma enum fields. Use normalized relations or validated NVARCHAR text for structured payloads instead of unsupported Prisma Json/scalar-list fields. Handle nullable uniqueness with appropriate keys/filtered indexes, preserving the existing partial-index configuration. Do not use createMany skipDuplicates or unsupported returning APIs. Validate features against the installed connector/client.

Add indexes for participant task queues, inventory status/finalizedAt, work-unit/attempt lookup, snapshot scope/provenance, Order attempt rows, unresolved discrepancies, and notification recipients. Uniqueness must prevent duplicate transitions/attempts/observations without depending only on pre-insert reads. Handle SQL Server NoAction relationships and avoid cascading-path conflicts.

No migrate reset, force-reset, accept-data-loss, table truncation, production seeding, or destructive migrations. Do not edit already-applied migrations or mark new ones applied without verification. The existing `0_init` migration is empty: document a reproducible isolated-test/bootstrap path rather than assuming migration replay builds the entire legacy database. Generate and review additive SQL; apply only to an explicitly safe development/test database. Otherwise deliver the migration and precise unexecuted deployment steps.

## 9. NestJS architecture, transactions, and concurrency

Create and register InventoryModule. Use focused injectable services for orchestration, baseline snapshots, assignments/count submission, reconciliation, finalization/reporting, and stock adjustment. Keep controllers thin. Reuse PrismaService; do not instantiate an independent client in each feature. Pass Prisma.TransactionClient to helpers participating in a transaction.

Keep the repository's schema-first Zod approach. Bind real runtime validation through a suitable Nest schema-validation pipe or reusable Zod pipe; a TypeScript alias does not validate HTTP inputs. Apply separate schemas to body, query, and path parameters. Return structured 400 errors, safe 403/404 responses, and 409 conflict responses for invalid state/stale versions. Do not catch every database failure and pretend it is a business validation failure.

Use explicit return types, generated Prisma types, and typed select/payload helpers. Avoid broad `any`, copied nested includes, leaking legacy password fields, or loading full User records in response DTOs. Update old `/orders` routes to use the same permissions, assignment ownership, validation, and workflow services; no bypass path may remain.

Use short atomic transactions for launch, submit/unlock, adjudication, cancellation, finalization, and adjustment application. Verify allowed state and assignment inside the mutation transaction. Use optimistic version checks and appropriate isolation/locking for shared state, with bounded retries for verified transient write conflicts/deadlocks. Database uniqueness is the final guard; frontend disabled buttons are not concurrency protection.

Idempotency must be durable: scope keys by actor/action/resource and bind them to a canonical payload hash. Repeating the same successful request returns its result; reusing a key with a different payload returns a conflict. Concurrent submissions must not create two next-user tasks or two finalizations. Attempt state and unique keys must also protect requests that use different idempotency keys.

Check business locks inside every relevant stock-writing transaction: movements, direct equipment quantity updates, serial creation/update/deletion/location changes, and shelf-related changes. Cover an equipment-scoped inventory intersecting a shelf-scoped inventory, including possible new equipment–shelf pairs. A preflight check outside the transaction is insufficient. Use deterministic lock ordering and tests for the race between launch and movement creation.

Do not hold transactions open for notifications, exports, user input, or external requests. Persist notifications/outbox events within the business transaction and deliver after commit. Durable in-app notifications with authenticated polling are sufficient; do not require Redis/WebSockets/email infrastructure for the core workflow.

Paginate lists and large work-unit contents, use minimal projections, batch lookups/inserts, respect SQL Server query limits, and avoid per-equipment user queries or loading millions of serial rows into a browser. Use bounded resumable jobs for large snapshot/report work, with persistent status and atomic publication, rather than increasing timeouts indefinitely.

## 10. HTTP API and frontend contracts

Keep `/inventory` as the canonical existing backend prefix. Implement and document typed request/response contracts for these capabilities; exact subordinate names may be adjusted consistently:

```text
POST   /inventory                         Create a draft with initial scope/participants
GET    /inventory                         Authorized paginated inventory listing
GET    /inventory/eligible-users           Minimal paginated participant lookup
POST   /inventory/preview                  Authorized scope/baseline preview
GET    /inventory/my-tasks                 Current user's paginated available/pending tasks
GET    /inventory/:id                      Role-appropriate detail and progress
PATCH  /inventory/:id                      Allowed draft metadata/scope changes
POST   /inventory/:id/launch               Freeze reference data and start counting
POST   /inventory/:id/cancel               Audited cancellation
POST   /inventory/:id/reassign             Audited pending-work replacement
GET    /inventory/:id/work-units           Paginated work units and progress
GET    /inventory/:id/discrepancies        Authorized comparisons/issues
GET    /inventory/:id/audit                Authorized audit history
GET    /inventory/:id/tasks/:taskId        Assignment-specific count sheet
POST   /inventory/:id/tasks/:taskId/start  Start an available attempt
PATCH  /inventory/:id/tasks/:taskId/draft  Versioned draft observations
POST   /inventory/:id/tasks/:taskId/submit Atomic immutable submission/next-task release
POST   /inventory/:id/work-units/:unitId/adjudicate
POST   /inventory/:id/finalize
GET    /inventory/:id/report
GET    /inventory/:id/report/export
POST   /inventory/:id/adjustments/preview
POST   /inventory/:id/adjustments/apply
GET    /notifications
PATCH  /notifications/:id/read
```

Place static routes before ambiguous `:id` handlers as required by the router. All nested IDs must belong to the same authorized inventory and current workflow version. Preview/lookup/report/export routes need authorization too. Provide minimal equipment/shelf discovery endpoints for assigned counting users without granting unrestricted stock access. Response shapes must not reveal blind values through metadata, errors, exports, or cached responses.

Return explicit progress, next actions, allowed actions, and conflict codes useful to the frontend. Document compatibility changes to existing Order endpoints and update their callers/tests.

## 11. Frontend implementation and exact visual continuity

Use existing useApi for Clerk-authenticated Axios calls, usePermissions for UI behavior, TanStack Query for server state, existing error-message handling and Sonner, and React Hook Form/Zod for forms. Extend permissions consistently across backend registry, role editor, seed data, and frontend helpers. Server checks remain authoritative.

Keep existing layout/Navbar, logo, French labels, compact tables, dialogs, status badges, spacing, and responsive behavior. Reuse the active palette and tokens: canvas #2b2622, elevated surface #383330, borders #3f3a36, text #f7f5f0, secondary #c9c0ad, muted #aea69c. Retain Inter, DM Mono, existing serif accents, and the small 3–6px corner-radius language. Prefer shared tokens/components over duplicating style constants. Do not redesign existing pages.

Build these integrated screens:

**Inventory workspace:** `/inventory`, with authorized inventory listing, search/type/status/date filters, creation action, progress, issue counts, and links to tasks/reports. Show actual server data, not demo statistics.

**Creation wizard:** metadata/type, searchable paginated equipment OR shelf selection, ordered participants with move-up/down controls, final adjudicator designation, scope/baseline preview, warnings for missing history, and draft/launch actions. Display minimum-two and two-user adjudication rules. Do not download every user/equipment/shelf to populate selectors.

**My inventory tasks:** available, in-progress, submitted, and blocked assignments, with clear equipment/shelf identity and predecessor status. Release updates appear through invalidation/polling after a committed submission; notification read state must not control task eligibility.

**Counting workspace:** actual-position and quantity entry, serial scan/manual entry, explicit zero/not-found/empty confirmation, unexpected-item reporting, notes, save indicator, conflict handling, and final-submit confirmation. Preserve unsaved changes during polling; refresh must recover saved drafts. Show the complete-unit coverage requirement across pagination.

**Manager inventory detail:** overview, scope/reference information, participant order, work-unit progress, user results when authorized, discrepancy review, adjudication, timeline, finalization readiness, and cancellation/reassignment actions. Show both quantity and position changes, not only a red mismatch badge.

**Final report and adjustment review:** historical vs live-at-launch vs observations vs accepted results, all issues and resolution evidence, actor/time data, printable/exportable report, and a separate permission-controlled adjustment preview/application action.

Add corresponding `types/inventory.ts`, `schemas/inventory.schema.ts`, service methods, query hooks, and modular components under existing conventions. Include loading, empty, forbidden, validation, backend failure, stale-version, cancelled, and finalized states. Support keyboard access, labelled controls, readable mobile counting, and horizontally scrollable large comparison tables.

Scope Query keys by authenticated identity and relevant permissions/resource/version. Clear sensitive cached data when users sign out or switch accounts. Poll only while appropriate, stop/refine polling for terminal states, and invalidate relevant task/inventory/report/stock queries after successful mutations. Do not optimistically mark an uncommitted submission or finalization successful.

## 12. Finalization, reporting, and controlled stock adjustments

Finalization requires every required work unit resolved, mandatory independent initial counts submitted, final decisions complete, required acknowledgements present, no blocking unresolved issues, valid coverage, and a successful live-state consistency check. Skipped optional escalation attempts are not unfinished mandatory work. Persist final snapshots, aggregates, audit event, and report metadata atomically and exactly once; never expose a partially published final result.

Capture stable names/identifiers and UTC timestamps so later catalog/user renames or stock movements do not rewrite history. Explain any legacy timezone uncertainty rather than falsely relabelling SYSDATETIME values as UTC. Display new timestamps in Africa/Algiers while retaining unambiguous source timestamps.

Provide an on-screen report, a print-ready version, and a correctly escaped CSV export. A print-to-PDF workflow is acceptable; only advertise a direct PDF export when it is actually implemented and tested. Reports must contain inventory identity/type/scope/status, reference sources and missing-history warnings, creator/participants, per-user attempts, baseline/live/final quantities and positions, serial changes, previous/live deltas, all discrepancies including resolved ones, resolution method and notes, acknowledgements, timeline, elapsed durations, finalizer, and report generation/version metadata. Label in-progress reports provisional.

Calculate durations from recorded events; do not represent an open tab's entire lifetime as active counting. Export all authorized rows, not only the currently visible page. Prevent spreadsheet-formula injection in CSV text fields and do not include secrets or inaccessible participant data.

Build adjustment preview from final observations versus captured live state, not versus an old historic inventory. Apply only authorized verified scope. For partial shelf inventories, preserve other shelves and off-shelf balances; do not replace an equipment's global quantity with a partial count. Preserve serial-status meaning, avoid serial/aggregate double counting, and reconcile EquipmentShelfs/Equipment/Shelf aggregates through one documented implementation.

Before applying, atomically recheck every affected position and relevant source revision/fingerprint against the captured state. Any intervening stock change, conflicting newer finalized coverage, or uncertain adjustment basis requires explicit review/recount; do not blindly overwrite or replay an old delta. Existing duplicate EquipmentShelfs pairs and unknown quantities require an explicit reconciliation policy, not silent row deletion.

Record adjustment batch/lines, before/after values, reason, final-inventory reference, approving actor, and timestamps. Applying twice must not change stock twice. Use truthful adjustment audit records rather than fabricating ordinary transfers. Keep later adjustment events as an auditable addendum; do not mutate the frozen final inventory evidence.

## 13. Verification and delivery criteria

Implement automated tests for creation authorization, duplicate/inactive participants, exactly-two and three-plus workflows, both inventory types, derived scope, first inventory without verified history, newest-partial inventory selection, unknown versus zero, empty shelves, and serial-location snapshots.

Test the per-unit pipeline explicitly: U2 gets A immediately after U1 submits A, while U1 can count B; U2 cannot access B early. Test draft resume, incomplete submission rejection, immutable submitted rows, user disable/reassignment, cancellation, and skipped optional rounds.

Test exact match, equal counts changed from history, disagreement even when one user matches history, later consensus, unmatched final adjudication, two-user acknowledgement, location-only redistribution, net shortage, unexpected items, duplicate/mismatched serials, off-shelf states, and cross-scope false-transfer prevention.

Test forged actor fields, cross-inventory/task access, old Order endpoint bypass prevention, safe user projections, blind-response leakage, authorization of lookup/report/export routes, and user-switch cache isolation.

Test duplicate requests with same/different payloads, different keys against the same submitted task, simultaneous task submission, simultaneous finalization, transaction rollback, launch/movement races, intersecting scope locks, out-of-band live-state changes, adjustment replay, stale adjustment rejection, and preservation of uncounted stock.

Use Vitest for the existing backend suite and real SQL Server integration tests for connector-specific constraints and concurrency. Add focused frontend component/end-to-end tests using compatible tooling. Do not substitute SQLite-only tests for SQL Server guarantees. Validate schema/generation, backend/frontend builds, lint, tests, route registration, actual database persistence, and the rendered UI against existing pages.

Do not delete unrelated failing tests, weaken assertions merely to pass, or claim an unexecuted check passed. Distinguish pre-existing defects, newly fixed defects, and environment-blocked checks. Work against an isolated safe database and retain the existing migration safety policy.

Finish with an implementation summary covering files changed, schema/migration changes, permission matrix, endpoints/contracts, workflow policies, screenshots or browser-verification evidence when available, commands run and their actual results, deployment steps, and any remaining limitations. Include a short manual verification scenario using three users and equipment distributed across two shelves.

Start by inspecting the actual repository and documenting the schema/state/permission design. Then implement backend, migrations, frontend, reporting, notifications, and tests in coherent stages. Continue through integration and verification instead of stopping after scaffolding. Never claim a database migration, test, export, or UI behavior works without evidence.
