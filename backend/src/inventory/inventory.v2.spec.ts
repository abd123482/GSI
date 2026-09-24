// @ts-nocheck
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { InventoryService } from './inventory.service.js';

describe('InventoryService - synchronized C1/C2/C3 pipeline', () => {
  const inventoryId =
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  const equipmentId =
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  const shelfId =
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

  it('launch creates only C1 and C2 attempts and no C3 attempt', async () => {
    const tx: any = {
      $queryRaw:
        vi.fn().mockResolvedValue([
          { lockResult: 0 },
        ]),

      inventory: {
        findUnique:
          vi.fn().mockResolvedValue({
            inventoryId,
            title: 'Inventaire',
            status: 'DRAFT',
            typeInventory:
              'ByEquipment',
            equipmentScopeIds:
              JSON.stringify([
                equipmentId,
              ]),
            shelfScopeIds: null,
            Inventory_User: [
              {
                userId:
                  '11111111-1111-4111-8111-111111111111',
                sequence: 0,
              },
              {
                userId:
                  '22222222-2222-4222-8222-222222222222',
                sequence: 1,
              },
              {
                userId:
                  '33333333-3333-4333-8333-333333333333',
                sequence: 2,
              },
            ],
          }),
        update:
          vi.fn().mockResolvedValue({}),
      },

      inventoryWorkUnit: {
        findFirst:
          vi.fn().mockResolvedValue(
            null,
          ),
        create:
          vi.fn().mockResolvedValue({
            unitId:
              'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
            unitOrder: 0,
            equipmentId,
            shelfId: null,
          }),
      },

      equipment: {
        findMany:
          vi.fn().mockResolvedValue([
            { equipmentId },
          ]),
      },

      equipmentShelfs: {
        findMany:
          vi.fn().mockResolvedValue(
            [],
          ),
      },

      serialNumber: {
        findMany:
          vi.fn().mockResolvedValue(
            [],
          ),
      },

      inventory_Equipment_Shelf_Snapshot:
        {
          createMany: vi.fn(),
        },

      inventory_SerialNumber_Snapshot:
        {
          createMany: vi.fn(),
        },

      inventoryCountAttempt: {
        create:
          vi.fn()
            .mockResolvedValueOnce({
              attemptId:
                'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
            })
            .mockResolvedValueOnce({
              attemptId:
                'ffffffff-ffff-4fff-8fff-ffffffffffff',
            }),
      },

      notification: {
        create: vi.fn(),
      },
    };

    const prisma: any = {
      $transaction: vi.fn(
        async (
          callback: (
            client: typeof tx,
          ) => unknown,
          _options?: unknown,
        ) => callback(tx),
      ),
    };

    const service =
      new InventoryService(prisma);

    await service.launchInventory(
      inventoryId,
    );

    expect(
      tx.inventoryCountAttempt.create,
    ).toHaveBeenCalledTimes(2);

    const purposes =
      tx.inventoryCountAttempt.create.mock.calls.map(
        (call: any[]) =>
          call[0].data.purpose,
      );

    expect(purposes).toEqual([
      'PRIMARY_1',
      'PRIMARY_2',
    ]);

    expect(tx.$queryRaw).toHaveBeenCalled();
  });

  it('report marks a lower standard count as MANQUE', () => {
    const service =
      new InventoryService(
        {} as any,
      );

    const compare =
      (
        service as any
      ).compareReportCells(
        'STANDARD',
        {
          quantity: 7,
        },
        {
          quantity: 10,
        },
      );

    expect(compare).toEqual({
      status: 'MANQUE',
      delta: -3,
      missing: 3,
      surplus: 0,
    });
  });

  it('report detects serialized wrong location', () => {
    const service =
      new InventoryService(
        {} as any,
      );

    const compare =
      (
        service as any
      ).compareReportCells(
        'SERIALIZED',
        {
          quantity: 1,
          equipmentId,
          shelfId,
        },
        {
          quantity: 1,
          equipmentId,
          shelfId:
            'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        },
      );

    expect(compare.status).toBe(
      'MAUVAISE_POSITION',
    );
  });
});
