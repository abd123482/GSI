import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { SerialNumberService } from './serialNumber.service.js';

const equipmentId =
  '11111111-1111-4111-8111-111111111111';

const serialId =
  '22222222-2222-4222-8222-222222222222';

const shelfId =
  '33333333-3333-4333-8333-333333333333';

function createHarness(
  serial: {
    serialNumberId: string;
    serialNumberCode: string;
    equipmentId: string;
    shelfId: string | null;
  },
) {
  const prisma = {
    serialNumber: {
      findUnique: vi.fn()
        .mockResolvedValue(
          serial,
        ),

      findFirst: vi.fn(),

      findMany: vi.fn()
        .mockResolvedValue([]),

      create: vi.fn(),

      createMany: vi.fn(),

      update: vi.fn(),

      delete: vi.fn()
        .mockResolvedValue({
          ...serial,
          serialNumberStatus:
            'AVAILABLE',
          equipment: null,
          shelf: null,
        }),
    },

    equipment: {
      findUnique: vi.fn()
        .mockResolvedValue({
          equipmentId,
          equipmentName:
            'Serialized',
          hasSerialNumber: true,
          equipmentStatus:
            'ACTIVE',
        }),
    },

    mouvementEquipment: {
      findFirst: vi.fn()
        .mockResolvedValue(null),
    },

    mouvement: {
      findFirst: vi.fn()
        .mockResolvedValue(null),
    },
  };

  return {
    prisma,
    service:
      new SerialNumberService(
        prisma as any,
      ),
  };
}

describe(
  'SerialNumberService V3',
  () => {
    it('refuses deletion while serial is on a shelf', async () => {
      const {
        service,
        prisma,
      } = createHarness({
        serialNumberId:
          serialId,
        serialNumberCode:
          'SN-1',
        equipmentId,
        shelfId,
      });

      await expect(
        service.deleteSerialNumber(
          serialId,
        ),
      ).rejects.toThrow(
        'Create an OUT movement',
      );

      expect(
        prisma.serialNumber
          .delete,
      ).not.toHaveBeenCalled();
    });

    it('refuses deletion when movement history exists', async () => {
      const {
        service,
        prisma,
      } = createHarness({
        serialNumberId:
          serialId,
        serialNumberCode:
          'SN-1',
        equipmentId,
        shelfId: null,
      });

      prisma.mouvementEquipment
        .findFirst
        .mockResolvedValue({
          mouvementEquipmentId:
            'history',
        });

      await expect(
        service.deleteSerialNumber(
          serialId,
        ),
      ).rejects.toThrow(
        'movement history',
      );

      expect(
        prisma.serialNumber
          .delete,
      ).not.toHaveBeenCalled();
    });

    it('deletes unused serial identity without changing equipment quantity', async () => {
      const {
        service,
        prisma,
      } = createHarness({
        serialNumberId:
          serialId,
        serialNumberCode:
          'SN-1',
        equipmentId,
        shelfId: null,
      });

      await service.deleteSerialNumber(
        serialId,
      );

      expect(
        prisma.serialNumber
          .delete,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            serialNumberId:
              serialId,
          },
        }),
      );

      expect(
        prisma.equipment,
      ).not.toHaveProperty(
        'update',
      );
    });

    it('rejects duplicate codes inside a batch before insert', async () => {
      const {
        service,
        prisma,
      } = createHarness({
        serialNumberId:
          serialId,
        serialNumberCode:
          'SN-1',
        equipmentId,
        shelfId: null,
      });

      await expect(
        service.createBatchSerialNumbers({
          equipmentId,
          serialNumberCodes: [
            'SN-X',
            'SN-X',
          ],
        }),
      ).rejects.toThrow(
        'Duplicate serial numbers',
      );

      expect(
        prisma.serialNumber
          .createMany,
      ).not.toHaveBeenCalled();
    });

    it('does not allow serial code editing after creation', async () => {
      const {
        service,
      } = createHarness({
        serialNumberId:
          serialId,
        serialNumberCode:
          'SN-1',
        equipmentId,
        shelfId: null,
      });

      await expect(
        service.updateSerialNumber(
          serialId,
          {
            serialNumberCode:
              'SN-CHANGED',
          } as any,
        ),
      ).rejects.toThrow();
    });
  },
);
