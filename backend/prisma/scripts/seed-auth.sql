-- =============================================================================
-- Script: seed-auth.sql
-- Description: Idempotent role & permission seed script for Somipharm maintenance
-- =============================================================================

BEGIN TRANSACTION;

-- 1. Ensure ADMIN Role exists
DECLARE @AdminRoleId UNIQUEIDENTIFIER;
SELECT @AdminRoleId = roleId FROM dbo.[Role] WHERE roleName = 'ADMIN';

IF @AdminRoleId IS NULL
BEGIN
    SET @AdminRoleId = NEWID();
    INSERT INTO dbo.[Role] (roleId, roleName)
    VALUES (@AdminRoleId, 'ADMIN');
    PRINT 'Inserted ADMIN role.';
END
ELSE
BEGIN
    PRINT 'ADMIN role already exists.';
END;

-- 2. Ensure TECHNICIAN Role exists
DECLARE @TechRoleId UNIQUEIDENTIFIER;
SELECT @TechRoleId = roleId FROM dbo.[Role] WHERE roleName = 'TECHNICIAN';

IF @TechRoleId IS NULL
BEGIN
    SET @TechRoleId = NEWID();
    INSERT INTO dbo.[Role] (roleId, roleName)
    VALUES (@TechRoleId, 'TECHNICIAN');
    PRINT 'Inserted TECHNICIAN role.';
END
ELSE
BEGIN
    PRINT 'TECHNICIAN role already exists.';
END;

-- 3. Idempotently insert ADMIN permissions
DECLARE @Permissions TABLE (permissionName VARCHAR(100));
INSERT INTO @Permissions (permissionName) VALUES
    ('equipment.read'),
    ('equipment.create'),
    ('equipment.update'),
    ('equipment.delete'),
    ('serial-number.read'),
    ('serial-number.create'),
    ('serial-number.update'),
    ('serial-number.delete'),
    ('movement.read'),
    ('movement.create'),
    ('shelf.read'),
    ('shelf.create'),
    ('shelf.update'),
    ('shelf.delete'),
    ('user.manage'),
    ('role.manage');

INSERT INTO dbo.[Permission] (permissionId, permissionName, roleId)
SELECT NEWID(), p.permissionName, @AdminRoleId
FROM @Permissions p
WHERE NOT EXISTS (
    SELECT 1 
    FROM dbo.[Permission] perm 
    WHERE perm.permissionName = p.permissionName 
      AND perm.roleId = @AdminRoleId
);

-- 4. Idempotently insert TECHNICIAN permissions
DECLARE @TechPermissions TABLE (permissionName VARCHAR(100));
INSERT INTO @TechPermissions (permissionName) VALUES
    ('equipment.read'),
    ('serial-number.read'),
    ('movement.read'),
    ('movement.create'),
    ('shelf.read');

INSERT INTO dbo.[Permission] (permissionId, permissionName, roleId)
SELECT NEWID(), tp.permissionName, @TechRoleId
FROM @TechPermissions tp
WHERE NOT EXISTS (
    SELECT 1 
    FROM dbo.[Permission] perm 
    WHERE perm.permissionName = tp.permissionName 
      AND perm.roleId = @TechRoleId
);

COMMIT TRANSACTION;
PRINT 'Role and permission seeding completed successfully.';
