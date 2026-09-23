/*
  SOMIPHARM PRODUCTION REFERENCE SEED
  Intended for a freshly reconstructed EMPTY yacinedb.

  This does not create any business Stock/Shelf/Equipment/Movement/Inventory rows.
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

IF NOT EXISTS (
    SELECT 1
    FROM dbo.StockStatus
    WHERE stockStatusName = 'ACTIVE'
)
BEGIN
    INSERT INTO dbo.StockStatus (
        stockStatusName
    )
    VALUES (
        'ACTIVE'
    );
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM dbo.StockStatus
    WHERE stockStatusName = 'INACTIVE'
)
BEGIN
    INSERT INTO dbo.StockStatus (
        stockStatusName
    )
    VALUES (
        'INACTIVE'
    );
END;
GO

DECLARE @AdminRoleId uniqueidentifier;
DECLARE @TechnicianRoleId uniqueidentifier;

SELECT
    @AdminRoleId = roleId
FROM dbo.Role
WHERE roleName = 'ADMIN';

IF @AdminRoleId IS NULL
BEGIN
    INSERT INTO dbo.Role (
        roleName
    )
    VALUES (
        'ADMIN'
    );

    SELECT
        @AdminRoleId = roleId
    FROM dbo.Role
    WHERE roleName = 'ADMIN';
END;

SELECT
    @TechnicianRoleId = roleId
FROM dbo.Role
WHERE roleName = 'TECHNICIAN';

IF @TechnicianRoleId IS NULL
BEGIN
    INSERT INTO dbo.Role (
        roleName
    )
    VALUES (
        'TECHNICIAN'
    );

    SELECT
        @TechnicianRoleId = roleId
    FROM dbo.Role
    WHERE roleName = 'TECHNICIAN';
END;

DECLARE @AdminPermissions TABLE (
    permissionName varchar(200) NOT NULL
);

INSERT INTO @AdminPermissions(permissionName)
VALUES
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
('stock.read'),
('stock.create'),
('stock.update'),
('stock.delete'),
('user.manage'),
('role.manage'),
('dashboard.read'),
('inventory.read'),
('inventory.create'),
('inventory.launch'),
('inventory.count'),
('inventory.adjudicate'),
('inventory.finalize'),
('inventory.delete');

INSERT INTO dbo.Permission (
    permissionName,
    roleId
)
SELECT
    p.permissionName,
    @AdminRoleId
FROM @AdminPermissions p
WHERE NOT EXISTS (
    SELECT 1
    FROM dbo.Permission existing
    WHERE
        existing.roleId = @AdminRoleId
        AND existing.permissionName = p.permissionName
);

DECLARE @TechnicianPermissions TABLE (
    permissionName varchar(200) NOT NULL
);

INSERT INTO @TechnicianPermissions(permissionName)
VALUES
('equipment.read'),
('serial-number.read'),
('movement.read'),
('movement.create'),
('shelf.read');

INSERT INTO dbo.Permission (
    permissionName,
    roleId
)
SELECT
    p.permissionName,
    @TechnicianRoleId
FROM @TechnicianPermissions p
WHERE NOT EXISTS (
    SELECT 1
    FROM dbo.Permission existing
    WHERE
        existing.roleId = @TechnicianRoleId
        AND existing.permissionName = p.permissionName
);
GO
