# Final production rebuild preparation

Use this phase only after the full live application smoke test has passed against
`yacinedb_rebuild_test`.

## 1. Record the smoke-test confirmation

From the project root:

```powershell
.\scripts\confirm-live-smoke-passed.ps1 -Confirmation "I CONFIRM LIVE SMOKE TEST PASSED"
```

This creates a local marker only.

## 2. Generate the final production SQL

```powershell
.\scripts\generate-production-rebuild-package.ps1
```

The readiness gate checks:

- isolated test DB core schema;
- 20 expected application tables;
- six hardening triggers;
- trusted foreign keys;
- ACTIVE / INACTIVE reference status;
- real `yacinedb` still has zero user tables;
- smoke-test marker exists.

If all gates pass, it creates:

```text
backend/sql/production/FINAL_yacinedb_rebuild.sql
backend/sql/production/FINAL_yacinedb_rebuild.sha256.txt
```

Nothing is executed.

## 3. Before eventual production execution

In SSMS run:

```text
backend/sql/backup_current_empty_yacinedb.sql
```

Keep the returned `.bak` path.

Then inspect `FINAL_yacinedb_rebuild.sql` manually.

The actual production application step is intentionally NOT automated in this
package.

## Why this phase does not auto-apply

Applying the final SQL changes the real `yacinedb`.

The preparation package generates and verifies the exact artifact first, while
keeping production unchanged.
