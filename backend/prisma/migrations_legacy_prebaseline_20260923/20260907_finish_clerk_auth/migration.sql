-- =============================================================================
-- Migration: 20260907_finish_clerk_auth
-- Target: Microsoft SQL Server
-- Description: Idempotent and safe migration to support Clerk authentication:
--   1. Ensures dbo.[User] table exists.
--   2. Ensures hashPassword column is nullable (VARCHAR(255) NULL).
--   3. Ensures clerkUserId column exists (VARCHAR(255) NULL).
--   4. Checks for duplicate non-null clerkUserId values before creating index.
--   5. Creates filtered unique index UX_User_ClerkUserId if not already existing.
--   6. Preserves all existing data, passwords, and user records.
-- =============================================================================

BEGIN TRANSACTION;

-- 1. Ensure table dbo.[User] exists
IF OBJECT_ID(N'dbo.[User]', N'U') IS NOT NULL
BEGIN
    -- 2. Ensure hashPassword column is nullable
    IF EXISTS (
        SELECT 1 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = 'dbo' 
          AND TABLE_NAME = 'User' 
          AND COLUMN_NAME = 'hashPassword' 
          AND IS_NULLABLE = 'NO'
    )
    BEGIN
        PRINT 'Altering dbo.[User].hashPassword to allow NULL values...';
        ALTER TABLE dbo.[User] ALTER COLUMN hashPassword VARCHAR(255) NULL;
        PRINT 'dbo.[User].hashPassword successfully altered to VARCHAR(255) NULL.';
    END
    ELSE
    BEGIN
        PRINT 'dbo.[User].hashPassword is already nullable or does not require alteration.';
    END;

    -- 3. Ensure clerkUserId column exists
    IF NOT EXISTS (
        SELECT 1 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = 'dbo' 
          AND TABLE_NAME = 'User' 
          AND COLUMN_NAME = 'clerkUserId'
    )
    BEGIN
        PRINT 'Adding column clerkUserId VARCHAR(255) NULL to dbo.[User]...';
        ALTER TABLE dbo.[User] ADD clerkUserId VARCHAR(255) NULL;
        PRINT 'Column clerkUserId successfully added to dbo.[User].';
    END
    ELSE
    BEGIN
        PRINT 'Column clerkUserId already exists on dbo.[User].';
    END;

    -- 4. Check for duplicate non-null clerkUserId values before index creation
    IF EXISTS (
        SELECT clerkUserId, COUNT(*) AS duplicateCount
        FROM dbo.[User]
        WHERE clerkUserId IS NOT NULL
        GROUP BY clerkUserId
        HAVING COUNT(*) > 1
    )
    BEGIN
        RAISERROR('Cannot create unique index: Duplicate non-null clerkUserId values detected in dbo.[User].', 16, 1);
        ROLLBACK TRANSACTION;
        RETURN;
    END;

    -- 5. Ensure filtered unique index UX_User_ClerkUserId exists
    IF NOT EXISTS (
        SELECT 1 
        FROM sys.indexes 
        WHERE name = N'UX_User_ClerkUserId' 
          AND object_id = OBJECT_ID(N'dbo.[User]')
    )
    BEGIN
        PRINT 'Creating filtered unique index UX_User_ClerkUserId on dbo.[User](clerkUserId)...';
        CREATE UNIQUE NONCLUSTERED INDEX UX_User_ClerkUserId
        ON dbo.[User](clerkUserId)
        WHERE clerkUserId IS NOT NULL;
        PRINT 'Filtered unique index UX_User_ClerkUserId successfully created.';
    END
    ELSE
    BEGIN
        PRINT 'Filtered unique index UX_User_ClerkUserId already exists.';
    END;
END
ELSE
BEGIN
    PRINT 'Warning: Table dbo.[User] does not exist. Migration skipped.';
END;

COMMIT TRANSACTION;
