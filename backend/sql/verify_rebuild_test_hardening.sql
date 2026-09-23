/*
  Read-only verification after the hardening installer.
  Change USE only if you selected another isolated test DB name.
*/

USE [yacinedb_rebuild_test];
GO

SELECT
    @@SERVERNAME AS CurrentServer,
    DB_NAME() AS CurrentDatabase;

WITH ExpectedTrigger(TriggerName) AS (
    SELECT *
    FROM (VALUES
        ('TR_Shelf_RequireActiveStock'),
        ('TR_EquipmentShelfs_RequireActiveStock'),
        ('TR_Mouvement_RequireActiveStocks'),
        ('TR_SerialNumber_Guards'),
        ('TR_InventoryWorkUnit_AcceptedAttempt'),
        ('TR_MovementEquipment_MatchHeader')
    ) x(TriggerName)
)
SELECT
    e.TriggerName,
    CASE
        WHEN tr.object_id IS NULL
            THEN 'MISSING'
        WHEN tr.is_disabled = 1
            THEN 'DISABLED'
        ELSE 'ENABLED'
    END AS TriggerState,
    OBJECT_NAME(tr.parent_id) AS ParentTable
FROM ExpectedTrigger e
LEFT JOIN sys.triggers tr
    ON tr.name = e.TriggerName
ORDER BY e.TriggerName;

SELECT
    OBJECT_NAME(parent_object_id) AS TableName,
    name AS ForeignKeyName,
    is_disabled AS IsDisabled,
    is_not_trusted AS IsNotTrusted
FROM sys.foreign_keys
WHERE
    is_disabled = 1
    OR is_not_trusted = 1
ORDER BY TableName, ForeignKeyName;
