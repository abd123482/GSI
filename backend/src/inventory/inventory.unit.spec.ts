import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { InventoryService } from './inventory.service.js';

describe('InventoryService - per-unit reconciliation', () => {
  let service: InventoryService;
  let prisma: any;
  let tx: any;

  const inventoryId =
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  const unitId =
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  const c1Id =
    '11111111-1111-4111-8111-111111111111';

  const c2Id =
    '22222222-2222-4222-8222-222222222222';

  const c3Id =
    '33333333-3333-4333-8333-333333333333';

  beforeEach(() => {
    tx = {
      inventoryWorkUnit: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        count: vi.fn(),
      },
      inventoryCountAttempt: {
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
      },
      inventory: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      notification: {
        create: vi.fn(),
      },
    };

    prisma = {
      $transaction: vi.fn(
        async (
          callback: (
            client: typeof tx,
          ) => unknown,
        ) => callback(tx),
      ),
    };

    service =
      new InventoryService(
        prisma as any,
      );
  });

  it('accepts C1 when C1 and C2 are equivalent for one unit', async () => {
    tx.inventoryWorkUnit.findMany.mockResolvedValue([
      {
        unitId,
        inventoryId,
        unitOrder: 0,
        equipmentId:
          'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        shelfId: null,
        reconciliationStatus:
          'PENDING',
        attempts: [
          {
            attemptId: c1Id,
            purpose: 'PRIMARY_1',
            status: 'SUBMITTED',
            orders: [
              {
                equipmentId:
                  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
                shelfId:
                  'ffffffff-ffff-4fff-8fff-ffffffffffff',
                quantityCalculated: 8,
                scannedSerialCode: null,
                observedEquipmentId: null,
                observedShelfId: null,
                serialNumber: null,
              },
            ],
          },
          {
            attemptId: c2Id,
            purpose: 'PRIMARY_2',
            status: 'SUBMITTED',
            orders: [
              {
                equipmentId:
                  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
                shelfId:
                  'ffffffff-ffff-4fff-8fff-ffffffffffff',
                quantityCalculated: 8,
                scannedSerialCode: null,
                observedEquipmentId: null,
                observedShelfId: null,
                serialNumber: null,
              },
            ],
          },
        ],
      },
    ]);

    tx.inventoryWorkUnit.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);

    tx.inventory.update.mockResolvedValue({
      inventoryId,
      creatorId: null,
    });

    const result =
      await service.reconcilePrimaryInventory(
        inventoryId,
        tx,
      );

    expect(result.reconciled).toEqual([
      {
        unitId,
        result:
          'PRIMARY_MATCH',
      },
    ]);

    expect(
      tx.inventoryWorkUnit.update,
    ).toHaveBeenCalledWith({
      where: { unitId },
      data:
        expect.objectContaining({
          status: 'VALIDATED',
          reconciliationStatus:
            'PRIMARY_MATCH',
          acceptedAttemptId:
            c1Id,
        }),
    });

    expect(
      tx.inventoryCountAttempt.create,
    ).not.toHaveBeenCalled();
  });

  it('creates C3 only for the mismatching unit', async () => {
    tx.inventoryWorkUnit.findMany.mockResolvedValue([
      {
        unitId,
        inventoryId,
        unitOrder: 2,
        equipmentId:
          'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        shelfId: null,
        reconciliationStatus:
          'PENDING',
        attempts: [
          {
            attemptId: c1Id,
            purpose: 'PRIMARY_1',
            status: 'SUBMITTED',
            orders: [
              {
                equipmentId:
                  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
                shelfId:
                  'ffffffff-ffff-4fff-8fff-ffffffffffff',
                quantityCalculated: 10,
                scannedSerialCode: null,
                serialNumber: null,
              },
            ],
          },
          {
            attemptId: c2Id,
            purpose: 'PRIMARY_2',
            status: 'SUBMITTED',
            orders: [
              {
                equipmentId:
                  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
                shelfId:
                  'ffffffff-ffff-4fff-8fff-ffffffffffff',
                quantityCalculated: 8,
                scannedSerialCode: null,
                serialNumber: null,
              },
            ],
          },
        ],
      },
    ]);

    tx.inventory.findUnique.mockResolvedValue({
      inventoryId,
      Inventory_User: [
        {
          userId:
            '44444444-4444-4444-8444-444444444444',
          sequence: 0,
        },
        {
          userId:
            '55555555-5555-4555-8555-555555555555',
          sequence: 1,
        },
        {
          userId:
            '66666666-6666-4666-8666-666666666666',
          sequence: 2,
        },
      ],
    });

    tx.inventoryCountAttempt.findFirst.mockResolvedValue(
      null,
    );

    tx.inventoryCountAttempt.create.mockResolvedValue({
      attemptId: c3Id,
      assignedUserId:
        '66666666-6666-4666-8666-666666666666',
      status: 'AVAILABLE',
    });

    tx.inventoryWorkUnit.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1);

    tx.inventory.update.mockResolvedValue({
      inventoryId,
      creatorId: null,
    });

    const result =
      await service.reconcilePrimaryInventory(
        inventoryId,
        tx,
      );

    expect(result.reconciled).toEqual([
      {
        unitId,
        result:
          'THIRD_REQUIRED',
      },
    ]);

    expect(
      tx.inventoryCountAttempt.create,
    ).toHaveBeenCalledWith({
      data:
        expect.objectContaining({
          unitId,
          sequence: 2,
          purpose:
            'FINAL_RECOUNT',
          status: 'AVAILABLE',
        }),
    });

    expect(
      tx.inventoryWorkUnit.update,
    ).toHaveBeenCalledWith({
      where: { unitId },
      data:
        expect.objectContaining({
          reconciliationStatus:
            'THIRD_REQUIRED',
          acceptedAttemptId: null,
        }),
    });
  });
});
