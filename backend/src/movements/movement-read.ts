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
    orderBy: { movementEquipmentId: 'asc' as const },
  },
  createdByUser: true,
  inventory: true,
} satisfies Prisma.MouvementInclude;
export type MovementHeader = Prisma.MouvementGetPayload<{
  include: typeof movementInclude;
}>;

export interface MovementFilter {
  mouvementId?: string;
  equipmentId?: string;
  serialNumberId?: string;
  sourceShelfId?: string;
  destinationShelfId?: string;
  equipmentQuantity?: number;
  mouvementStatus?: string;
}

export function movementHeaderWhere(
  filter: MovementFilter,
): Prisma.MouvementWhereInput {
  const { mouvementId, mouvementStatus, ...details } = filter;
  return {
    ...(mouvementId ? { mouvementId } : {}),
    ...(mouvementStatus !== undefined ? { mouvementStatus } : {}),
    ...(Object.keys(details).length
      ? {
          items: { some: details },
        }
      : {}),
  };
}
