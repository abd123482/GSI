# SOMIPHARM recovery phase

The current SQL Server connection is confirmed:

- Server: `DESKTOP-H8RGDSS`
- Database: `yacinedb`
- Nest runtime and Prisma CLI point to the same target.
- `yacinedb` contains 0/12 expected application tables.
- No other database accessible to `admin_semepharm` contains the expected tables.

This means the next task is recovery discovery, not schema recreation.

## 1. Discover SQL Server instances and files

From the project root:

```powershell
.\scripts\run-sql-recovery-discovery.ps1
```

This is read-only.

It records:

- SQL Server Windows services;
- registered SQL Server instances;
- SQL LocalDB instances;
- SQL Server default backup/data/log paths found in the registry;
- targeted `.bak`, `.trn`, `.bacpac`, `.mdf`, `.ndf`, `.ldf` files.

Reports:

```text
backend\sql\recovery-discovery\windows-sql-recovery-discovery.json
backend\sql\recovery-discovery\candidate-sql-files.csv
```

## 2. Read SQL backup history

In SSMS run:

```text
backend\sql\sql_server_backup_history_readonly.sql
```

Important output:

- backup history for `yacinedb`;
- physical `.bak`/backup device names;
- restore history;
- default SQL data/log/backup directories;
- database file paths.

## 3. Do not restore yet

Even if a `.bak` file is found, do not restore over `yacinedb` yet.

First verify:

- backup date/time;
- source database name;
- whether it predates the accidental reset;
- whether it contains the required tables.

The safe recovery method is normally to restore to a NEW temporary database name,
inspect it, and only then decide how to recover data.

## 4. If nothing is found

If there is no backup history, no `.bak/.bacpac`, no alternate SQL instance and
no detached `.mdf`, then database row recovery may not be possible from SQL
Server itself.

At that point check external backups:

- Windows/File History;
- OneDrive/Dropbox backup of database exports;
- VM snapshots;
- SQL Server host backups;
- manual `.bak` copied elsewhere.

Do not use Prisma migration/reset commands as a recovery method.
