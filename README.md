# SOMIPHARM database hardening audit pack

This is the next phase after DB target alignment.

Files:

- `backend/scripts/audit-db-hardening.mjs`
- `scripts/run-db-hardening-audit.ps1`
- `backend/sql/final_hardening_readonly_audit.sql`
- `docs/DB_HARDENING_AUDIT.md`

Everything in this package is read-only.

The runner refuses to run if the previous DB alignment report does not confirm
that Nest runtime `DB_*` and Prisma CLI `DATABASE_URL` point to the same SQL
Server/database.

After running, send the contents of:

`backend/sql/db-hardening-audit-report.json`

The final SQL hardening patch can then be limited to objects that are actually
missing.
