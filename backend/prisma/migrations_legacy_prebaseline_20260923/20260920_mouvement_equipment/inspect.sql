-- Read-only. No migration, DDL, DML, temporary tables or migration-history changes.
SELECT name FROM sys.tables WHERE name IN ('Mouvement', 'MouvementEquipment', '_prisma_migrations');
SELECT c.name, t.name AS type, c.max_length, c.is_nullable, d.definition AS defaultValue
FROM sys.columns c JOIN sys.types t ON c.user_type_id = t.user_type_id
LEFT JOIN sys.default_constraints d ON c.default_object_id = d.object_id
WHERE c.object_id = OBJECT_ID('dbo.MouvementEquipment') ORDER BY c.column_id;
SELECT i.name, i.is_unique, c.name AS columnName
FROM sys.indexes i JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
WHERE i.object_id = OBJECT_ID('dbo.MouvementEquipment');
SELECT name, OBJECT_NAME(referenced_object_id) AS target, delete_referential_action_desc, is_disabled, is_not_trusted
FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID('dbo.MouvementEquipment');
IF OBJECT_ID('dbo._prisma_migrations') IS NOT NULL
  EXEC('SELECT migration_name, finished_at, rolled_back_at FROM dbo._prisma_migrations WHERE migration_name = ''20260920_mouvement_equipment''');
IF OBJECT_ID('dbo.Mouvement') IS NOT NULL
  EXEC('SELECT COUNT_BIG(*) AS headers FROM dbo.Mouvement');
IF OBJECT_ID('dbo.MouvementEquipment') IS NOT NULL
  EXEC('SELECT COUNT_BIG(*) AS lines FROM dbo.MouvementEquipment;
    SELECT COUNT_BIG(*) AS noLines FROM dbo.Mouvement m WHERE NOT EXISTS (SELECT 1 FROM dbo.MouvementEquipment i WHERE i.mouvementId = m.mouvementId);
    SELECT COUNT_BIG(*) AS multiLine FROM (SELECT mouvementId FROM dbo.MouvementEquipment GROUP BY mouvementId HAVING COUNT(*) > 1) x;
    SELECT COUNT_BIG(*) AS quantityMismatches FROM dbo.Mouvement m JOIN
      (SELECT mouvementId, SUM(CAST(mouvementQuantity AS BIGINT)) AS quantity FROM dbo.MouvementEquipment GROUP BY mouvementId) i
      ON i.mouvementId = m.mouvementId WHERE m.movementQuantity IS NULL OR m.movementQuantity <> i.quantity');
SELECT COUNT_BIG(*) AS duplicateAllocationPairs FROM
  (SELECT equipmentId, shelfId FROM dbo.EquipmentShelfs GROUP BY equipmentId, shelfId HAVING COUNT(*) > 1) x;
SELECT COUNT_BIG(*) AS nullShelfQuantities FROM dbo.Shelf WHERE shelfQuantity IS NULL;
