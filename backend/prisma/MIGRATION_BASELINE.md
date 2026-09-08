# SQL Server Database Migration & Baseline Documentation

## Current Database State
- **Database Engine**: Microsoft SQL Server (SSMS)
- **Database Name**: `yacinedb`
- **Tables**: `dbo.[User]`, `dbo.[Role]`, `dbo.[Permission]`, `dbo.[Equipment]`, `dbo.[SerialNumber]`, `dbo.[Shelf]`, `dbo.[Mouvement]`, `dbo.[EquipmentShelfs]`, `dbo.[EqipmentMouvements]`, `dbo.[Session]`
- **Authentication Columns on `dbo.[User]`**:
  - `userId UNIQUEIDENTIFIER NOT NULL DEFAULT newid()` (Primary Key, internal foreign key target)
  - `clerkUserId VARCHAR(255) NULL` (Clerk external identity link)
  - `hashPassword VARCHAR(255) NULL` (Deprecated legacy field, nullable to allow Clerk users without local passwords)
  - `userStatus VARCHAR(50) NULL` (Default `'PENDING'`, approved users `'ACTIVE'`)
  - `roleId UNIQUEIDENTIFIER NULL` (Foreign key to `dbo.[Role]`)
- **Indexes**:
  - `UX_User_ClerkUserId`: Filtered unique nonclustered index on `dbo.[User](clerkUserId) WHERE clerkUserId IS NOT NULL`.

---

## Non-Destructive Migration Guidelines

> [!CAUTION]
> **NEVER** run the following commands on this live database:
> - `npx prisma migrate reset` (Drops the entire database!)
> - `npx prisma db push --force-reset` (Destroys existing tables and data!)
> - `npx prisma db push --accept-data-loss` (Can drop unmapped legacy columns!)

### How Migrations are Applied

1. **Structural Migration (`migration.sql`)**:
   Located at:
   `backend/prisma/migrations/20260907_finish_clerk_auth/migration.sql`

   This script is 100% idempotent. It executes checks (`IF EXISTS`, `IF NOT EXISTS`) before modifying any schema definition. It checks for duplicates before index creation and safely alters `hashPassword` to `NULL` without touching existing password data.

2. **Marking Migration as Applied (Baselining)**:
   In an environment where the database changes already exist, run:
   ```bash
   npx prisma migrate resolve --applied 20260907_finish_clerk_auth
   ```
   This records the migration in the `_prisma_migrations` table without attempting redundant schema alterations.

3. **Role & Permission Seeding**:
   To seed authorization roles and permissions:
   ```bash
   npx tsx prisma/seed.ts
   ```
   Or execute via SSMS:
   `backend/prisma/scripts/seed-auth.sql`

---

## Verification
To verify the migration status without applying changes:
```bash
npx prisma migrate status
```
