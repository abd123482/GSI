import { BadRequestException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';

export const movementInclude = {
  items: {
    include: {
      equipment: true,
      serialNumber: true,
      sourceShelf: true,
      destinationShelf: true,
    },
    orderBy: { mouvementEquipmentId: 'asc' as const },
  },
  equipment: true,
  serialNumber: true,
  sourceShelf: true,
  destinationShelf: true,
} satisfies Prisma.MouvementInclude;
export type MovementHeader = Prisma.MouvementGetPayload<{
  include: typeof movementInclude;
}>;
export function movementView(view?: string): 'header' | 'lines' {
  if (view === undefined || view === 'lines') return 'lines';
  if (view === 'header') return 'header';
  throw new BadRequestException('view must be header or lines');
}

// Preserve the flat equipment/route fields expected by existing clients.
export function movementLines(header: MovementHeader) {
  if (!header.items.length) return [header];
  return header.items.map((item) => ({ ...header, ...item, items: [item] }));
}

export interface MovementFilter {
  mouvementId?: string;
  equipmentId?: string;
  serialNumberId?: string;
  sourceShelfId?: string;
  destinationShelfId?: string;
  mouvementQuantity?: number;
  mouvementStatus?: string;
}

// One logical line per child, or the original header when it has no children.
// Filter and paginate BEFORE hydration so multi-item parents cannot overflow a page.
export function movementPageSql(
  filter: MovementFilter,
  skip: number,
  take: number,
  ascending: boolean,
) {
  const conditions: Prisma.Sql[] = [];
  for (const field of [
    'mouvementId',
    'equipmentId',
    'serialNumberId',
    'sourceShelfId',
    'destinationShelfId',
  ] as const) {
    if (filter[field])
      conditions.push(
        Prisma.sql`${Prisma.raw('[' + field + ']')} = CAST(${filter[field]} AS UNIQUEIDENTIFIER)`,
      );
  }
  if (filter.mouvementQuantity !== undefined)
    conditions.push(
      Prisma.sql`[mouvementQuantity] = ${filter.mouvementQuantity}`,
    );
  if (filter.mouvementStatus)
    conditions.push(Prisma.sql`[mouvementStatus] = ${filter.mouvementStatus}`);
  return Prisma.sql`
    WITH movementLines AS (
      SELECT m.mouvementId, i.mouvementEquipmentId, m.createdAt,
             i.equipmentId, i.serialNumberId, i.sourceShelfId, i.destinationShelfId,
             i.mouvementQuantity, i.mouvementStatus
      FROM dbo.Mouvement m JOIN dbo.MouvementEquipment i ON i.mouvementId = m.mouvementId
      UNION ALL
      SELECT m.mouvementId, CAST(NULL AS UNIQUEIDENTIFIER), m.createdAt,
             m.equipmentId, m.serialNumberId, m.sourceShelfId, m.destinationShelfId,
             m.movementQuantity, m.mouvementStatus
      FROM dbo.Mouvement m
      WHERE NOT EXISTS (SELECT 1 FROM dbo.MouvementEquipment i WHERE i.mouvementId = m.mouvementId)
    )
    SELECT mouvementId, mouvementEquipmentId FROM movementLines
    WHERE ${conditions.length ? Prisma.join(conditions, ' AND ') : Prisma.sql`1 = 1`}
    ORDER BY createdAt ${Prisma.raw(ascending ? 'ASC' : 'DESC')}, mouvementId ASC, mouvementEquipmentId ASC
    OFFSET ${skip} ROWS FETCH NEXT ${take} ROWS ONLY`;
}

// All predicates must match the SAME child; do not match equipment on one line and shelf on another.
export function movementHeaderWhere(
  filter: MovementFilter,
): Prisma.MouvementWhereInput {
  const { mouvementId, ...lineFilter } = filter;
  const { mouvementStatus, ...details } = lineFilter;
  const mixed = mouvementStatus === 'MIXED';
  const itemFilter = mixed ? details : lineFilter;
  return {
    ...(mouvementId ? { mouvementId } : {}),
    ...(mixed ? { mouvementStatus } : {}),
    ...(Object.keys(itemFilter).length
      ? {
          OR: [
            { items: { some: itemFilter } },
            { items: { none: {} }, ...itemFilter },
          ],
        }
      : {}),
  };
}
