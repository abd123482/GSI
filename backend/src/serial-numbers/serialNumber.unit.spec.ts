import { describe, expect, it, vi } from 'vitest';
import { SerialNumberService } from './serialNumber.service.js';

const equipmentId =
  '11111111-1111-4111-8111-111111111111';
const serialId =
  '22222222-2222-4222-8222-222222222222';
const shelfId =
  '33333333-3333-4333-8333-333333333333';

function createDeleteHarness(
  serial: {
    serialNumberId: string;
    serialNumberCode: string;
    equipmentId: string | null;
    shelfId: string | null;
  },
) {
  const tx = {
    serialNumber: {
      delete: vi.fn().mockResolvedValue({
        ...serial,
        serialNumberStatus: 'AVAILABLE',
        equipment: null,
        shelf: null,
      }),
    },
    equipment: {
      updateMany: vi.fn().mockResolvedValue({
        count: 1,
      }),
    },
  };

  const prisma = {
    serialNumber: {
      findUnique: vi.fn().mockResolvedValue(serial),
    },
    mouvementEquipment: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    mouvement: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    $transaction: vi.fn(
      async (callback: (client: typeof tx) => unknown) =>
        callback(tx),
    ),
  };

  return {
    service: new SerialNumberService(prisma as any),
    prisma,
    tx,
  };
}

describe('SerialNumberService V3', () => {
  it('refuses physical deletion while a serial is still on a shelf', async () => {
    const { service, prisma } = createDeleteHarness({
      serialNumberId: serialId,
      serialNumberCode: 'SN-1',
      equipmentId,
      shelfId,
    });

    await expect(
      service.deleteSerialNumber(serialId),
    ).rejects.toThrow('Create an OUT movement');

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('refuses deletion when movement history exists', async () => {
    const { service, prisma } = createDeleteHarness({
      serialNumberId: serialId,
      serialNumberCode: 'SN-1',
      equipmentId,
      shelfId: null,
    });

    prisma.mouvementEquipment.findFirst.mockResolvedValue({
      mouvementEquipmentId: 'history',
    });

    await expect(
      service.deleteSerialNumber(serialId),
    ).rejects.toThrow('movement history');

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('deletes an unused serial and decrements serialized equipment total', async () => {
    const { service, tx } = createDeleteHarness({
      serialNumberId: serialId,
      serialNumberCode: 'SN-1',
      equipmentId,
      shelfId: null,
    });

    await service.deleteSerialNumber(serialId);

    expect(tx.serialNumber.delete).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          serialNumberId: serialId,
        },
      }),
    );

    expect(tx.equipment.updateMany).toHaveBeenCalledWith({
      where: {
        equipmentId,
        equipmentQuantity: {
          gt: 0,
        },
      },
      data: {
        equipmentQuantity: {
          decrement: 1,
        },
      },
    });
  });

  it('rejects deletion if serialized equipment quantity is inconsistent', async () => {
    const { service, tx } = createDeleteHarness({
      serialNumberId: serialId,
      serialNumberCode: 'SN-1',
      equipmentId,
      shelfId: null,
    });

    tx.equipment.updateMany.mockResolvedValue({
      count: 0,
    });

    await expect(
      service.deleteSerialNumber(serialId),
    ).rejects.toThrow('quantity is inconsistent');
  });

  it('rejects duplicate codes inside a batch before opening a transaction', async () => {
    const prisma = {
      equipment: {
        findUnique: vi.fn().mockResolvedValue({
          equipmentId,
          equipmentName: 'Serialized',
          hasSerialNumber: true,
        }),
      },
      serialNumber: {
        findMany: vi.fn(),
      },
      $transaction: vi.fn(),
    };

    const service =
      new SerialNumberService(prisma as any);

    await expect(
      service.createBatchSerialNumbers({
        equipmentId,
        serialNumberCodes: ['SN-X', 'SN-X'],
      }),
    ).rejects.toThrow('Duplicate serial numbers');

    expect(prisma.$transaction)
      .not.toHaveBeenCalled();
  });
});
