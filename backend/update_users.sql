UPDATE [User]
SET roleId = (SELECT TOP 1 roleId FROM Role WHERE roleName = 'Admin' OR roleName = 'ADMIN'),
    userStatus = 'ACTIVE'
WHERE userStatus = 'PENDING' OR userStatus = 'DISABLED';
