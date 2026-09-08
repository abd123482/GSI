# Legacy Authentication Cleanup Plan

This document outlines the safety checks, backup procedures, and future migration strategy for removing legacy authentication structures (`User.hashPassword` and table `dbo.[Session]`) from the Somipharm maintenance application.

---

## 1. Why Cleanup is Deferred

- **Zero Downtime & Data Safety**: Removing columns and tables immediately during live Clerk integration increases the risk of regressions, data loss, or failed deployments.
- **Rollback Safety**: During the initial transition phase, retaining legacy columns allows rolling back if unexpected external identity issues arise.
- **Foreign Key Stability**: The `dbo.[Session]` table references `dbo.[User](userId)`. Ensuring zero active database locks or stale triggers is required before dropping.
- **Principle**: The cleanup should only be executed **after production Clerk authentication and onboarding have been validated in production for at least 30 days**.

---

## 2. Verification Steps (Ensure No Code Uses Legacy Structures)

Before executing the cleanup migration, run the following audit checks:

### A. Check `hashPassword`
Run a ripgrep search across both backend and frontend codebases:
```bash
# Must return zero active writes or reads
grep -rn "hashPassword" backend/src/
```
Verify:
- No NestJS controller, service, or DTO writes or reads `hashPassword`.
- The user creation methods in `AuthService` and `UsersAdminService` explicitly omit `hashPassword`.
- No password hashing libraries (`argon2`, `bcrypt`) are imported or executed.

### B. Check `Session` Table
```bash
# Must return zero references outside of generated types
grep -rn "prisma\.session\." backend/src/
```
Verify:
- No service creates, queries, or updates rows in `prisma.session`.
- All session lifecycle management (login, token refresh, logout) is handled exclusively by Clerk.

---

## 3. Database Backup Requirements

Before executing any schema drop commands in Microsoft SQL Server:
1. **Full Database Backup**:
   ```sql
   BACKUP DATABASE [yacinedb]
   TO DISK = N'C:\Backups\yacinedb_pre_cleanup.bak'
   WITH NOFORMAT, NOINIT,
   NAME = N'yacinedb-Full Database Backup Prior to Auth Cleanup',
   SKIP, NOREWIND, NOUNLOAD, STATS = 10;
   GO
   ```
2. **Verify Backup Integrity**:
   ```sql
   RESTORE VERIFYONLY FROM DISK = N'C:\Backups\yacinedb_pre_cleanup.bak';
   GO
   ```

---

## 4. Future Cleanup Migration

When production verification is complete, execute the non-destructive drop in a dedicated Prisma migration:

### SQL Script (`drop_legacy_auth.sql`)
```sql
BEGIN TRANSACTION;

-- 1. Drop foreign key constraint on Session table if exists
IF OBJECT_ID(N'dbo.[Session]', N'U') IS NOT NULL
BEGIN
    DROP TABLE dbo.[Session];
    PRINT 'Dropped legacy table dbo.[Session].';
END;

-- 2. Drop hashPassword column on dbo.[User]
IF EXISTS (
    SELECT 1 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'dbo' 
      AND TABLE_NAME = 'User' 
      AND COLUMN_NAME = 'hashPassword'
)
BEGIN
    ALTER TABLE dbo.[User] DROP COLUMN hashPassword;
    PRINT 'Dropped legacy column dbo.[User].hashPassword.';
END;

COMMIT TRANSACTION;
```

### Prisma Schema Update
1. Remove `hashPassword` from `model User`.
2. Remove `sessions Session[]` from `model User`.
3. Remove `model Session` entirely.
4. Run `npx prisma generate` to refresh client types.
