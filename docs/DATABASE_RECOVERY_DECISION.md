# Database discovery / recovery decision

The previous checks proved:

- Nest `DB_*` and Prisma `DATABASE_URL` point to the same target.
- That target is `DESKTOP-H8RGDSS / yacinedb`.
- `yacinedb` currently contains **0/12** expected SOMIPHARM tables.

Therefore the next action is **not hardening** and **not schema creation**.

First discover whether the original application schema still exists in another
accessible database on the same SQL Server.

Run:

```powershell
.\scripts\run-database-discovery.ps1
```

Possible outcomes:

## One exact candidate

The report shows one database with `12/12` expected tables.

Do not immediately edit `.env`.
Send the report for review first, because data/history/row counts still need to
be compared before switching the application target.

## Partial candidate

A database contains some expected tables.

Do not merge or migrate automatically.
The schema may be an older SOMIPHARM version.

## No candidate

If every accessible DB has `0/12`, then one of these is likely true:

- the schema was removed/reset;
- the application used a different SQL Server instance;
- the application used another login that can access another DB;
- recovery requires a SQL Server backup/export.

At that point, inspect SQL Server backups/history before recreating anything.

## Never run during discovery

```text
npx prisma db push
npx prisma migrate reset
npx prisma migrate dev
npx prisma migrate deploy
```
