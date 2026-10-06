const fs = require('fs');
const file = 'backend/src/dashboard/dashboard.service.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  /this\.prisma\.equipment\.aggregate\(\{\s*_sum: \{ equipmentQuantity: true \},\s*\}\),/g,
  `this.prisma.equipment.aggregate({
        _sum: { minequipmentQuantity: true },
      }).then(() => this.prisma.$queryRaw\`
        SELECT SUM(
          CASE 
            WHEN destinationShelfId IS NOT NULL THEN equipmentQuantity 
            WHEN sourceShelfId IS NOT NULL THEN -equipmentQuantity 
            ELSE 0 
          END
        ) as total
        FROM dbo.MovementEquipment
      \`).then((res) => ({ _sum: { equipmentQuantity: Number(res[0]?.total ?? 0) } })),`
);

code = code.replace(
  /this\.prisma\.serialNumber\.count\(\{\s*where: \{ shelfId: \{ not: null \} \},\s*\}\),/g,
  `this.prisma.$queryRaw\`
        WITH CurrentSerials AS (
          SELECT serialNumberId FROM (
            SELECT serialNumberId, CONVERT(bigint, equipmentQuantity) AS delta
            FROM dbo.MovementEquipment
            WHERE destinationShelfId IS NOT NULL AND serialNumberId IS NOT NULL
            UNION ALL
            SELECT serialNumberId, -CONVERT(bigint, equipmentQuantity) AS delta
            FROM dbo.MovementEquipment
            WHERE sourceShelfId IS NOT NULL AND serialNumberId IS NOT NULL
          ) AS entries
          GROUP BY serialNumberId HAVING SUM(delta) > 0
        )
        SELECT COUNT(*) as count FROM CurrentSerials
      \`.then((res) => Number(res[0]?.count ?? 0)),`
);

code = code.replace(
  /SELECT COUNT\(\*\) as \[count\] \s*FROM dbo\.Equipment \s*WHERE equipmentQuantity <= minequipmentQuantity AND minequipmentQuantity > 0/g,
  `WITH EquipmentStock AS (
          SELECT e.equipmentId, e.minequipmentQuantity,
            SUM(CASE WHEN m.destinationShelfId IS NOT NULL THEN m.equipmentQuantity ELSE 0 END) -
            SUM(CASE WHEN m.sourceShelfId IS NOT NULL THEN m.equipmentQuantity ELSE 0 END) AS equipmentQuantity
          FROM dbo.Equipment e
          LEFT JOIN dbo.MovementEquipment m ON e.equipmentId = m.equipmentId
          GROUP BY e.equipmentId, e.minequipmentQuantity
        )
        SELECT COUNT(*) as [count] 
        FROM EquipmentStock 
        WHERE equipmentQuantity <= minequipmentQuantity AND minequipmentQuantity > 0`
);

code = code.replace(
  /SELECT TOP 5 equipmentId, equipmentName, equipmentQuantity, minequipmentQuantity \s*FROM dbo\.Equipment \s*WHERE equipmentQuantity <= minequipmentQuantity AND minequipmentQuantity > 0\s*ORDER BY equipmentQuantity ASC/g,
  `WITH EquipmentStock AS (
          SELECT e.equipmentId, e.equipmentName, e.minequipmentQuantity,
            SUM(CASE WHEN m.destinationShelfId IS NOT NULL THEN m.equipmentQuantity ELSE 0 END) -
            SUM(CASE WHEN m.sourceShelfId IS NOT NULL THEN m.equipmentQuantity ELSE 0 END) AS equipmentQuantity
          FROM dbo.Equipment e
          LEFT JOIN dbo.MovementEquipment m ON e.equipmentId = m.equipmentId
          GROUP BY e.equipmentId, e.equipmentName, e.minequipmentQuantity
        )
        SELECT TOP 5 equipmentId, equipmentName, COALESCE(equipmentQuantity, 0) as equipmentQuantity, minequipmentQuantity 
        FROM EquipmentStock 
        WHERE equipmentQuantity <= minequipmentQuantity AND minequipmentQuantity > 0
        ORDER BY equipmentQuantity ASC`
);

code = code.replace(
  /SELECT s\.stockId, COALESCE\(s\.stockName, 'Stock Principal'\) as stockName,\s*COUNT\(sh\.shelfId\) as shelvesCount,\s*COALESCE\(SUM\(sh\.shelfQuantity\), 0\) as totalUnits\s*FROM dbo\.Stock s\s*LEFT JOIN dbo\.Shelf sh ON s\.stockId = sh\.stockId\s*GROUP BY s\.stockId, s\.stockName/g,
  `SELECT s.stockId, COALESCE(s.stockName, 'Stock Principal') as stockName,
               COUNT(DISTINCT sh.shelfId) as shelvesCount,
               COALESCE(SUM(
                  CASE WHEN m.destinationShelfId = sh.shelfId THEN m.equipmentQuantity ELSE 0 END
               ) - SUM(
                  CASE WHEN m.sourceShelfId = sh.shelfId THEN m.equipmentQuantity ELSE 0 END
               ), 0) as totalUnits
        FROM dbo.Stock s
        LEFT JOIN dbo.Shelf sh ON s.stockId = sh.stockId
        LEFT JOIN dbo.MovementEquipment m ON (m.destinationShelfId = sh.shelfId OR m.sourceShelfId = sh.shelfId)
        GROUP BY s.stockId, s.stockName`
);

fs.writeFileSync(file, code);
console.log('done');
