import { Prisma } from '../generated/prisma/client.js';

export interface ShelfBalanceRow {
  equipmentId: string;
  shelfId: string;
  shelfName: string;
  stockId: string;
  quantity: number;
}

export function buildShelfMatchesCte(shelfId: string, filters: any) {
  const conditions = [];
  if (filters.equipmentName) conditions.push(Prisma.sql`e.[equipmentName] LIKE ${'%' + filters.equipmentName + '%'}`);
  if (filters.hasSerialNumber !== undefined) conditions.push(Prisma.sql`e.[hasSerialNumber] = ${filters.hasSerialNumber ? 1 : 0}`);
  if (filters.equipmentStatus !== undefined) conditions.push(Prisma.sql`e.[equipmentStatus] = ${filters.equipmentStatus ? 'ACTIVE' : 'INACTIVE'}`);
  if (filters.minEquipmentQuantity !== undefined) conditions.push(Prisma.sql`e.[minequipmentQuantity] = ${filters.minEquipmentQuantity}`);

  const whereClause = conditions.length > 0 ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}` : Prisma.empty;

  return Prisma.sql`
    WITH ShelfStock AS (
      SELECT [equipmentId], SUM(CASE WHEN [destinationShelfId] = CAST(${shelfId} AS uniqueidentifier) THEN [equipmentQuantity] ELSE 0 END) - SUM(CASE WHEN [sourceShelfId] = CAST(${shelfId} AS uniqueidentifier) THEN [equipmentQuantity] ELSE 0 END) as qty
      FROM [dbo].[MovementEquipment]
      WHERE [destinationShelfId] = CAST(${shelfId} AS uniqueidentifier) OR [sourceShelfId] = CAST(${shelfId} AS uniqueidentifier)
      GROUP BY [equipmentId]
      HAVING SUM(CASE WHEN [destinationShelfId] = CAST(${shelfId} AS uniqueidentifier) THEN [equipmentQuantity] ELSE 0 END) - SUM(CASE WHEN [sourceShelfId] = CAST(${shelfId} AS uniqueidentifier) THEN [equipmentQuantity] ELSE 0 END) > 0
    ),
    Matches AS (
      SELECT e.* 
      FROM [dbo].[Equipment] e
      INNER JOIN ShelfStock s ON e.[equipmentId] = s.[equipmentId]
      ${whereClause}
    )
  `;
}

export function buildEquipmentBalancesQuery(equipmentIds: string[]) {
  return Prisma.sql`
    SELECT 
      m.[equipmentId],
      s.[shelfId],
      s.[shelfName],
      s.[stockId],
      SUM(CASE WHEN m.[destinationShelfId] = s.[shelfId] THEN m.[equipmentQuantity] ELSE 0 END) - 
      SUM(CASE WHEN m.[sourceShelfId] = s.[shelfId] THEN m.[equipmentQuantity] ELSE 0 END) AS quantity
    FROM [dbo].[MovementEquipment] m
    INNER JOIN [dbo].[Shelf] s ON s.[shelfId] = m.[destinationShelfId] OR s.[shelfId] = m.[sourceShelfId]
    WHERE m.[equipmentId] IN (${Prisma.join(equipmentIds)})
    GROUP BY m.[equipmentId], s.[shelfId], s.[shelfName], s.[stockId]
    HAVING SUM(CASE WHEN m.[destinationShelfId] = s.[shelfId] THEN m.[equipmentQuantity] ELSE 0 END) - 
           SUM(CASE WHEN m.[sourceShelfId] = s.[shelfId] THEN m.[equipmentQuantity] ELSE 0 END) > 0
  `;
}

export function safeDatabaseInteger(value: bigint | number, name: string): number {
  const num = Number(value);
  if (!Number.isSafeInteger(num)) throw new Error(`Value for ${name} exceeds safe integer limits`);
  return num;
}

export function summarizeEquipmentStock(equipment: any, rows: ShelfBalanceRow[]) {
  const equipmentShelfs = rows
    .filter(r => r.equipmentId === equipment.equipmentId && r.quantity > 0)
    .map(r => ({
      equipmentShelfId: r.shelfId,
      equipmentId: equipment.equipmentId,
      shelfId: r.shelfId,
      equipmentQuantity: r.quantity,
      shelf: {
        shelfId: r.shelfId,
        shelfName: r.shelfName,
        stockId: r.stockId
      }
    }))
    .sort((a, b) => b.equipmentQuantity - a.equipmentQuantity);

  const totalAllocated = equipmentShelfs.reduce((sum, s) => sum + s.equipmentQuantity, 0);

  return {
    equipmentQuantity: totalAllocated,
    equipmentShelfs,
    shelvesCount: equipmentShelfs.length,
    stockIsConsistent: true
  };
}
