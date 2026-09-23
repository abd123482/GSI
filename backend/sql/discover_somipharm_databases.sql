/*
  SOMIPHARM DATABASE DISCOVERY
  READ ONLY.

  Run in SSMS on DESKTOP-H8RGDSS using the same login as the application.

  The script lists accessible databases first.
  Then run the generated SELECT statements shown in the second result set
  for any database you want to inspect.
*/

SET NOCOUNT ON;

SELECT
    @@SERVERNAME AS CurrentServer,
    DB_NAME() AS CurrentDatabase,
    SUSER_SNAME() AS LoginName;

SELECT
    name AS DatabaseName,
    state_desc AS StateDescription,
    HAS_DBACCESS(name) AS HasAccess,
    create_date AS CreateDate
FROM sys.databases
WHERE state_desc = 'ONLINE'
ORDER BY name;

SELECT
    'SELECT ' +
    QUOTENAME(name, '''') +
    ' AS DatabaseName, COUNT(*) AS ExpectedTablesFound ' +
    'FROM ' + QUOTENAME(name) + '.sys.tables ' +
    'WHERE name IN (' +
    '''Stock'',''StockStatus'',''Shelf'',''Equipment'',''EquipmentShelfs'',' +
    '''SerialNumber'',''Mouvement'',''MovementEquipment'',''Inventory'',' +
    '''InventoryWorkUnit'',''InventoryCountAttempt'',''Order'');'
    AS ReadOnlyInspectionQuery
FROM sys.databases
WHERE
    state_desc = 'ONLINE'
    AND HAS_DBACCESS(name) = 1
ORDER BY name;
