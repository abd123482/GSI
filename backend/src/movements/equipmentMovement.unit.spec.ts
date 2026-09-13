import { describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { EquipmentMovementService } from './equipmentMovement.service.js';

const equipmentId = '11111111-1111-4111-8111-111111111111';
const sourceShelfId = '22222222-2222-4222-8222-222222222222';
const destinationShelfId = '33333333-3333-4333-8333-333333333333';

function createService() {
  const tx = {
    equipmentShelfs: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    shelf: { update: vi.fn() },
    equipment: { update: vi.fn() },
    mouvement: { create: vi.fn().mockResolvedValue({ mouvementId: 'movement-1' }) },
  };
  const prisma = {
    equipment: { count: vi.fn().mockResolvedValue(1) },
    shelf: { count: vi.fn().mockResolvedValue(1) },
    $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
  };
  return { service: new EquipmentMovementService(prisma as any), tx };
}

describe('equipment movement shelf allocations', () => {
  it('uses the allocation ID and initializes a nullable destination quantity', async () => {
    const { service, tx } = createService();
    tx.equipmentShelfs.findFirst.mockResolvedValue({
      equipmentShelfId: 'allocation-1',
      equipmentQuantity: null,
    });

    await service.createEquipmentMovement({
      equipmentId,
      destinationShelfId,
      movementQuantity: 3,
      movementType: 'ENTRY',
    });

    expect(tx.equipmentShelfs.findFirst).toHaveBeenCalledWith({
      where: { equipmentId, shelfId: destinationShelfId },
    });
    expect(tx.equipmentShelfs.update).toHaveBeenCalledWith({
      where: { equipmentShelfId: 'allocation-1' },
      data: { equipmentQuantity: 3 },
    });
    expect(tx.equipmentShelfs.create).not.toHaveBeenCalled();
  });

  it('rejects a source allocation with a null quantity', async () => {
    const { service, tx } = createService();
    tx.equipmentShelfs.findFirst.mockResolvedValue({
      equipmentShelfId: 'allocation-1',
      equipmentQuantity: null,
    });

    await expect(service.createEquipmentMovement({
      equipmentId,
      sourceShelfId,
      movementQuantity: 1,
      movementType: 'EXIT',
    })).rejects.toThrow(BadRequestException);
    expect(tx.equipmentShelfs.updateMany).not.toHaveBeenCalled();
  });

  it('rejects a movement if the source quantity changes before decrement', async () => {
    const { service, tx } = createService();
    tx.equipmentShelfs.findFirst.mockResolvedValue({
      equipmentShelfId: 'allocation-1',
      equipmentQuantity: 2,
    });
    tx.equipmentShelfs.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.createEquipmentMovement({
      equipmentId,
      sourceShelfId,
      movementQuantity: 2,
      movementType: 'EXIT',
    })).rejects.toThrow('Source shelf quantity changed');
    expect(tx.equipmentShelfs.updateMany).toHaveBeenCalledWith({
      where: {
        equipmentShelfId: 'allocation-1',
        equipmentQuantity: { gte: 2 },
      },
      data: { equipmentQuantity: { decrement: 2 } },
    });
  });
});
