# Dependency audit (before hardening)

| Consumer | Observed assumption/risk | Resolution |
| --- | --- | --- |
| Movement DTO/controller/service | Batch response changed from array to object; single headers lost equipment/route fields | Legacy default shapes retained; explicit header view; existing routes and guards kept |
| Movement listing/search | Searches missed headers without children; multi-item line pagination undefined | Parameterized child/legacy union with stable row pagination, explicit header pagination, same-child filters |
| Equipment creation | Writes legacy single header | Continues writing legacy fields plus one child |
| Serial batch creation | Creates one header for received serials | Preserved, lines returned through compatible history reads |
| Equipment deletion/conversion | Deleted headers and child history | Reference guard before deletion/conversion |
| Serial deletion | Deleted child rows and legacy headers | Reference guard preserves history |
| Shelf deletion | Could delete allocations before discovering historical FK links | History check before cleanup |
| Inventory finalization investigation | Child-only movement lookup missed old rows | Shared child-or-legacy predicate; inventory workflow unchanged |
| Dashboard service/tables/chart | Mixed headers omitted from categories; combined shelf strings lost pairing; child serial missing | Document counts include mixed/other; child routes and serials shown |
| Frontend movement service/types | Header and child types conflated; equipment ledger read only first 100 rows | Explicit child type, header response opt-in, complete scoped line history |
| Equipment detail ledger | Parent totals/duplicate rows could distort balance | Scoped child normalization, stable row keys, deduplication of repeated API rows only |
| Create movement modal | Serial source could be borrowed from another serial; unlimited staged lines; controls active while saving | Actual serial source, 100-line limit, disabled form during save |
| use-equipments | Dashboard cache stayed stale after movement mutations | Dashboard invalidation added |
| SQL migration | Physical table present without Prisma history | Read-only inspection; original migration unchanged; no replay |
| Database integration tests | Implicitly wrote to the application connection | Explicit dedicated test-database gate |

Repository searches included all requested identifiers, route aliases and movement access sites. Generated Prisma files and the unrelated user-edited `repomix-output.xml` were not modified. Existing `EquipmentShelfs` and legacy columns retain their schema and data.

## Validation scope

The movement/inventory unit suites, backend build, frontend type checks and ledger tests pass. The dashboard chart already used synchronous `setIsMounted(true)` in an effect before this task; the full targeted lint command flags that existing `react-hooks/set-state-in-effect` violation at `DashboardCharts.tsx:25`. The movement/UI modules pass lint separately. The chart's mount behavior was left unchanged to avoid unrelated cleanup.

Write-based tests were not run against the application database. The current database contains no movement history, so historical-read cases were tested with fixtures rather than assuming that an empty live result proves backward compatibility.
