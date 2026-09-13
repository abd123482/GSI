import { describe, expect, it, vi } from 'vitest';
import { SerialNumberService } from './serialNumber.service.js';

describe('serial number shelf allocation on deletion', () => {
  it('decrements an existing allocation by its unique ID', async () => {
    const tx = {
      mouvement: { deleteMany: vi.fn() },
      serialNumber: { delete: vi.fn().mockResolvedValue({ serialNumberId: 'serial-1' }) },
      equipment: { update: vi.fn() },
      equipmentShelfs: {
        findFirst: vi.fn().mockResolvedValue({
          equipmentShelfId: 'allocation-1',
          equipmentQuantity: 1,
        }),
        update: vi.fn(),
      },
    };
    const prisma = {
      serialNumber: {
        findUnique: vi.fn().mockResolvedValue({
          serialNumberId: 'serial-1',
          equipmentId: 'equipment-1',
          shelfId: 'shelf-1',
          equipment: { hasSerialNumber: true },
        }),
      },
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = new SerialNumberService(prisma as any);

    await service.deleteSerialNumber('serial-1');

    expect(tx.equipmentShelfs.findFirst).toHaveBeenCalledWith({
      where: { equipmentId: 'equipment-1', shelfId: 'shelf-1' },
      orderBy: { equipmentQuantity: 'desc' },
    });
    expect(tx.equipmentShelfs.update).toHaveBeenCalledWith({
      where: { equipmentShelfId: 'allocation-1' },
      data: { equipmentQuantity: { decrement: 1 } },
    });
  });
});
