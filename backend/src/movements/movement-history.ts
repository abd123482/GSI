import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';

type MovementHistoryFilter = Pick<
  Prisma.MovementEquipmentWhereInput,
  'equipmentId' | 'serialNumberId' | 'sourceShelfId' | 'destinationShelfId'
>;

/**
 * Prevents physical deletion of data already referenced by movement history.
 * MovementEquipment is the canonical history table.
 */
export async function assertNoMovementHistory(
  tx: Prisma.TransactionClient,
  where: MovementHistoryFilter,
): Promise<void> {
  const history = await tx.movementEquipment.findFirst({
    where,
    select: { movementEquipmentId: true },
  });

  if (history) {
    throw new BadRequestException(
      'Operation refused: movement history exists for this record.',
    );
  }
}
