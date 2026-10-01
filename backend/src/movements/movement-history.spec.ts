// @ts-nocheck
import { describe, expect, it, vi } from 'vitest';
import { EquipmentService } from '../equipment/equipment.service.js';
import { SerialNumberService } from '../serial-numbers/serialNumber.service.js';
import { ShelfService } from '../shelves/shelves.service.js';
import { assertNoMovementHistory } from './movement-history.js';

describe('V3 movement-history protection', () => {
  it('allows an operation when canonical MovementEquipment history does not exist', async () => {
    const tx = {
      mouvementEquipment: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };

    await expect(
      assertNoMovementHistory(
        tx as any,
        { equipmentId: 'equipment' },
      ),
    ).resolves.toBeUndefined();
  });

  it('blocks an operation when canonical MovementEquipment history exists', async () => {
    const tx = {
      mouvementEquipment: {
        findFirst: vi.fn().mockResolvedValue({
          mouvementEquipmentId: 'history-line',
        }),
      },
    };

    await expect(
      assertNoMovementHistory(
        tx as any,
        { equipmentId: 'equipment' },
      ),
    ).rejects.toThrow('movement history');
  });

  it('blocks equipment deletion when movement history exists', async () => {
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([{ lockResult: 0 }]),
      equipment: {
        findUnique: vi.fn().mockResolvedValue({
          equipmentId: '11111111-1111-4111-8111-111111111111',
          equipmentName: 'Equipment',
          _count: { movementItems: 1 }
        }),
      },
      mouvementEquipment: {
        findFirst: vi.fn().mockResolvedValue({
          mouvementEquipmentId: 'line-1',
        }),
      },
      mouvement: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      serialNumber: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      equipmentShelfs: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      $transaction: vi.fn().mockImplementation(async (cb) => cb(prisma)),
    };

    await expect(
      new EquipmentService(prisma as any)
        .deleteEquipment('11111111-1111-4111-8111-111111111111'),
    ).rejects.toThrow('movement history');

    
  });

  it('blocks serial deletion when movement history exists', async () => {
    const prisma = {
      serialNumber: {
        findUnique: vi.fn().mockResolvedValue({
          serialNumberId: 'sn',
          serialNumberCode: 'SN-1',
          equipmentId: '11111111-1111-4111-8111-111111111111',
          shelfId: null,
        }),
      },
      mouvementEquipment: {
        findFirst: vi.fn().mockResolvedValue({
          mouvementEquipmentId: 'line-1',
        }),
      },
      mouvement: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      $transaction: vi.fn(),
    };

    await expect(
      new SerialNumberService(prisma as any)
        .deleteSerialNumber('sn'),
    ).rejects.toThrow('movement history');

    
  });

  it('blocks shelf deletion when movement history exists', async () => {
    const prisma = {
      shelf: {
        findUnique: vi.fn().mockResolvedValue({
          shelfId: 'shelf',
          shelfName: 'Shelf',
        }),
      },
      equipmentShelfs: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      serialNumber: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      mouvementEquipment: {
        findFirst: vi.fn().mockResolvedValue({
          mouvementEquipmentId: 'line-1',
        }),
      },
      mouvement: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      $transaction: vi.fn(),
    };

    await expect(
      new ShelfService(prisma as any)
        .deleteShelf('shelf'),
    ).rejects.toThrow('movement history');

    
  });
});
