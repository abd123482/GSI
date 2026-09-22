import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { EquipmentService } from './equipment.service.js';
import { SerialNumberService } from '../serial-numbers/serialNumber.service.js';

describe('Equipment + SerialNumber V3', () => {
  let prisma: any;
  let equipmentService: EquipmentService;
  let serialNumberService: SerialNumberService;

  const equipmentId =
    '11111111-1111-4111-8111-111111111111';

  const serialId =
    '22222222-2222-4222-8222-222222222222';

  const shelfId =
    '33333333-3333-4333-8333-333333333333';

  beforeEach(() => {
    const tx = {
      equipment: {
        findUnique: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },

      serialNumber: {
        findMany: vi.fn().mockResolvedValue([]),
        createMany: vi.fn().mockResolvedValue({
          count: 2,
        }),
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
          hasSerialNumber: false,
          equipmentQuantity: 0,
          minequipmentQuantity: 2,
          equipmentStatus: 'ACTIVE',
        }),

        create: vi.fn().mockResolvedValue({
          equipmentId,
          equipmentName: 'Equipment',
          hasSerialNumber: false,
          equipmentQuantity: 0,
          minequipmentQuantity: 2,
          equipmentStatus: 'ACTIVE',
        }),

        update: vi.fn(),
      },

      serialNumber: {
        findUnique: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue(null),

        create: vi.fn().mockResolvedValue({
          serialNumberId: serialId,
          serialNumberCode: 'SN-1',
          serialNumberStatus: 'AVAILABLE',
          equipmentId,
          shelfId: null,
          equipment: {
            equipmentId,
            equipmentName: 'Serialized',
            hasSerialNumber: true,
            equipmentStatus: 'ACTIVE',
          },
          shelf: null,
        }),

        createMany: vi.fn().mockResolvedValue({
          count: 3,
        }),
      },

      mouvementEquipment: {
        findFirst: vi.fn().mockResolvedValue(null),
      },

      mouvement: {
        findFirst: vi.fn().mockResolvedValue(null),
      },

      equipmentShelfs: {
        findFirst: vi.fn().mockResolvedValue(null),
      },

      $transaction: vi.fn(
        async (
          callback: (client: typeof tx) => unknown,
          _options?: unknown,
        ) => callback(tx),
      ),

      _tx: tx,
    };

    equipmentService =
      new EquipmentService(prisma as any);

    serialNumberService =
      new SerialNumberService(prisma as any);
  });

  it('creates equipment as metadata only with quantity zero and ACTIVE status', async () => {
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
          equipmentStatus: 'ACTIVE',
        },
      }),
    );
  });

  it('creates batch serial identities with shelfId null without changing physical quantity', async () => {
    prisma.equipment.findUnique.mockResolvedValue({
      equipmentId,
      equipmentName: 'Serialized',
      hasSerialNumber: true,
      equipmentStatus: 'ACTIVE',
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
      prisma.serialNumber.createMany,
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

    expect(prisma.equipment.update).not.toHaveBeenCalled();
  });

  it('creates a single serial identity with shelfId null without changing physical quantity', async () => {
    prisma.equipment.findUnique.mockResolvedValue({
      equipmentId,
      equipmentName: 'Serialized',
      hasSerialNumber: true,
      equipmentStatus: 'ACTIVE',
    });

    prisma.serialNumber.findUnique.mockResolvedValue(null);

    await serialNumberService.createSerialNumber({
      equipmentId,
      serialNumberCode: 'SN-1',
    });

    expect(
      prisma.serialNumber.create,
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

    expect(prisma.equipment.update).not.toHaveBeenCalled();
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

    expect(prisma.equipment.update).not.toHaveBeenCalled();
  });

  it('allows Standard -> Serialized conversion when physical quantity is zero', async () => {
    prisma.equipment.findUnique.mockResolvedValue({
      equipmentId,
      equipmentName: 'Equipment',
      hasSerialNumber: false,
      equipmentQuantity: 0,
      equipmentStatus: 'ACTIVE',
    });

    prisma._tx.equipment.findUnique.mockResolvedValue({
      equipmentId,
      equipmentName: 'Equipment',
      hasSerialNumber: false,
      equipmentQuantity: 0,
      equipmentStatus: 'ACTIVE',
      equipmentShelfs: [],
      _count: {
        serialNumbers: 0,
      },
    });

    prisma._tx.equipment.update.mockResolvedValue({
      equipmentId,
      equipmentName: 'Equipment',
      hasSerialNumber: true,
      equipmentQuantity: 0,
      minequipmentQuantity: 2,
      equipmentStatus: 'ACTIVE',
    });

    const result =
      await equipmentService.updateEquipment(
        equipmentId,
        {
          hasSerialNumber: true,
        },
      );

    expect(result.hasSerialNumber).toBe(true);

    expect(
      prisma._tx.equipment.update,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          equipmentId,
        },
        data: expect.objectContaining({
          hasSerialNumber: true,
        }),
      }),
    );
  });

  it('blocks Serialized -> Standard conversion', async () => {
    prisma.equipment.findUnique.mockResolvedValue({
      equipmentId,
      equipmentName: 'Serialized',
      hasSerialNumber: true,
      equipmentQuantity: 0,
      equipmentStatus: 'ACTIVE',
    });

    await expect(
      equipmentService.updateEquipment(
        equipmentId,
        {
          hasSerialNumber: false,
        },
      ),
    ).rejects.toThrow(
      'cannot be converted back',
    );
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

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
