import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EquipmentService } from './equipment.service.js';
import { SerialNumberService } from '../serial-numbers/serialNumber.service.js';

describe('Equipment and serial creation V3', () => {
  let prisma: any;
  let equipmentService: EquipmentService;
  let serialNumberService: SerialNumberService;

  const equipmentId =
    '11111111-1111-4111-8111-111111111111';

  beforeEach(() => {
    const tx = {
      serialNumber: {
        create: vi.fn().mockResolvedValue({
          serialNumberId:
            '22222222-2222-4222-8222-222222222222',
          serialNumberCode: 'SN-1',
          serialNumberStatus: 'AVAILABLE',
          equipmentId,
          shelfId: null,
          equipment: null,
          shelf: null,
        }),
        createMany: vi.fn().mockResolvedValue({
          count: 3,
        }),
        delete: vi.fn(),
      },

      equipment: {
        update: vi.fn().mockResolvedValue({}),
        updateMany: vi.fn().mockResolvedValue({
          count: 1,
        }),
        delete: vi.fn(),
      },

      equipmentShelfs: {
        deleteMany: vi.fn(),
      },
    };

    prisma = {
      equipment: {
        findFirst: vi.fn().mockResolvedValue(null),
        findUnique: vi.fn().mockResolvedValue({
          equipmentId,
          equipmentName: 'Equipment',
          hasSerialNumber: true,
        }),
        create: vi.fn().mockResolvedValue({
          equipmentId,
          equipmentName: 'Equipment',
          hasSerialNumber: false,
          equipmentQuantity: 0,
          minequipmentQuantity: 2,
        }),
        update: vi.fn(),
      },

      serialNumber: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue(null),
        findUnique: vi.fn(),
      },

      mouvementEquipment: {
        findFirst: vi.fn().mockResolvedValue(null),
      },

      mouvement: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
      },

      equipmentShelfs: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
      },

      shelf: {
        update: vi.fn(),
      },

      $transaction: vi.fn(
        async (callback: (client: typeof tx) => unknown) =>
          callback(tx),
      ),

      _tx: tx,
    };

    equipmentService =
      new EquipmentService(prisma as any);

    serialNumberService =
      new SerialNumberService(prisma as any);
  });

  it('creates equipment as metadata only with quantity zero', async () => {
    await equipmentService.createEquipment({
      equipmentName: 'Equipment',
      hasSerialNumber: false,
      minEquipmentQuantity: 2,
    });

    expect(prisma.equipment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          equipmentName: 'Equipment',
          hasSerialNumber: false,
          equipmentQuantity: 0,
          minequipmentQuantity: 2,
        },
      }),
    );

    expect(prisma.equipmentShelfs.create)
      .not.toHaveBeenCalled();

    expect(prisma.mouvement.create)
      .not.toHaveBeenCalled();
  });

  it('creates batch serial numbers strictly with shelfId null', async () => {
    prisma.equipment.findUnique.mockResolvedValue({
      equipmentId,
      equipmentName: 'Serialized',
      hasSerialNumber: true,
    });

    const result =
      await serialNumberService.createBatchSerialNumbers({
        equipmentId,
        serialNumberCodes: ['SN-A', 'SN-B', 'SN-C'],
      });

    expect(result).toEqual({
      success: true,
      count: 3,
      equipmentId,
    });

    expect(
      prisma._tx.serialNumber.createMany,
    ).toHaveBeenCalledWith({
      data: [
        {
          serialNumberCode: 'SN-A',
          serialNumberStatus: 'AVAILABLE',
          equipmentId,
          shelfId: null,
        },
        {
          serialNumberCode: 'SN-B',
          serialNumberStatus: 'AVAILABLE',
          equipmentId,
          shelfId: null,
        },
        {
          serialNumberCode: 'SN-C',
          serialNumberStatus: 'AVAILABLE',
          equipmentId,
          shelfId: null,
        },
      ],
    });

    expect(prisma._tx.equipment.update)
      .toHaveBeenCalledWith({
        where: {
          equipmentId,
        },
        data: {
          equipmentQuantity: {
            increment: 3,
          },
        },
      });

    expect(prisma.mouvement.create)
      .not.toHaveBeenCalled();

    expect(prisma.shelf.update)
      .not.toHaveBeenCalled();
  });

  it('creates a single serial number with shelfId null and increments registered quantity', async () => {
    prisma.equipment.findUnique.mockResolvedValue({
      equipmentId,
      equipmentName: 'Serialized',
      hasSerialNumber: true,
    });

    prisma.serialNumber.findFirst.mockResolvedValue(null);

    await serialNumberService.createSerialNumber({
      equipmentId,
      serialNumberCode: 'SN-1',
    });

    expect(
      prisma._tx.serialNumber.create,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          serialNumberCode: 'SN-1',
          serialNumberStatus: 'AVAILABLE',
          equipmentId,
          shelfId: null,
        },
      }),
    );

    expect(prisma._tx.equipment.update)
      .toHaveBeenCalledWith({
        where: {
          equipmentId,
        },
        data: {
          equipmentQuantity: {
            increment: 1,
          },
        },
      });
  });

  it('does not allow EquipmentService to edit stock quantity directly', async () => {
    await expect(
      equipmentService.updateEquipment(
        equipmentId,
        {
          equipmentQuantity: 50,
        } as any,
      ),
    ).rejects.toThrow();

    expect(prisma.equipment.update)
      .not.toHaveBeenCalled();
  });

  it('blocks equipment deletion when movement history exists', async () => {
    prisma.equipment.findUnique.mockResolvedValue({
      equipmentId,
      equipmentName: 'Equipment',
    });

    prisma.mouvementEquipment.findFirst.mockResolvedValue({
      mouvementEquipmentId: 'history',
    });

    await expect(
      equipmentService.deleteEquipment(equipmentId),
    ).rejects.toThrow('movement history');

    expect(prisma.$transaction)
      .not.toHaveBeenCalled();
  });
});
