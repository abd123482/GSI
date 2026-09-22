import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  EquipmentMovementService,
} from './equipmentMovement.service.js';

const equipmentA =
  '11111111-1111-4111-8111-111111111111';

const equipmentB =
  '22222222-2222-4222-8222-222222222222';

const sourceShelfId =
  '33333333-3333-4333-8333-333333333333';

const movementId =
  '44444444-4444-4444-8444-444444444444';

function activeShelf(
  shelfId: string,
) {
  return {
    shelfId,
    shelfName:
      'Source Shelf',
    stockId:
      '55555555-5555-4555-8555-555555555555',
    stock: {
      stockId:
        '55555555-5555-4555-8555-555555555555',
      stockName:
        'Stock',
      stockStatus: {
        stockStatusName:
          'ACTIVE',
      },
    },
  };
}

describe(
  'EquipmentMovementService hardened transaction behavior',
  () => {
    it('runs movement creation in one Serializable transaction', async () => {
      const tx = {
        $queryRaw: vi
          .fn()
          .mockResolvedValue([
            {
              lockResult: 0,
            },
          ]),

        shelf: {
          findMany: vi
            .fn()
            .mockResolvedValue([
              activeShelf(
                sourceShelfId,
              ),
            ]),

          updateMany: vi
            .fn()
            .mockResolvedValue({
              count: 1,
            }),
        },

        equipment: {
          findMany: vi
            .fn()
            .mockResolvedValue([
              {
                equipmentId:
                  equipmentA,
                equipmentName:
                  'A',
                hasSerialNumber:
                  false,
                equipmentQuantity:
                  10,
                equipmentStatus:
                  'ACTIVE',
              },
            ]),

          updateMany: vi
            .fn()
            .mockResolvedValue({
              count: 1,
            }),
        },

        serialNumber: {
          findMany:
            vi.fn(),
          updateMany:
            vi.fn(),
        },

        equipmentShelfs: {
          updateMany: vi
            .fn()
            .mockResolvedValue({
              count: 1,
            }),

          findMany:
            vi.fn(),
          create:
            vi.fn(),
        },

        inventoryWorkUnit: {
          findFirst: vi
            .fn()
            .mockResolvedValue(
              null,
            ),
        },

        mouvement: {
          create: vi
            .fn()
            .mockResolvedValue({
              mouvementId:
                movementId,
            }),

          findUniqueOrThrow:
            vi
              .fn()
              .mockResolvedValue({
                mouvementId:
                  movementId,
                items: [],
              }),
        },

        mouvementEquipment: {
          createMany: vi
            .fn()
            .mockResolvedValue({
              count: 1,
            }),
        },
      };

      const transaction =
        vi.fn(
          async (
            callback: (
              client:
                typeof tx,
            ) => unknown,
            _options?: unknown,
          ) =>
            callback(tx),
        );

      const prisma = {
        $transaction:
          transaction,
      };

      const service =
        new EquipmentMovementService(
          prisma as any,
        );

      await service.createMovement({
        movementType:
          'OUT',
        sourceShelfId,
        items: [
          {
            equipmentId:
              equipmentA,
            movementQuantity:
              2,
          },
        ],
      });

      expect(
        transaction,
      ).toHaveBeenCalledTimes(
        1,
      );

      expect(
        transaction.mock
          .calls[0]?.[1],
      ).toEqual({
        isolationLevel:
          'Serializable',
        timeout: 30_000,
      });

      expect(
        tx.$queryRaw,
      ).toHaveBeenCalled();

      expect(
        tx.mouvement.create,
      ).toHaveBeenCalledTimes(
        1,
      );

      expect(
        tx.mouvementEquipment
          .createMany,
      ).toHaveBeenCalledTimes(
        1,
      );
    });

    it('rolls back parent and stock mutations when a later line fails', async () => {
      const state = {
        parents: 0,
        lines: 0,

        allocations: {
          [equipmentA]: 5,
          [equipmentB]: 3,
        } as Record<
          string,
          number
        >,
      };

      const tx = {
        $queryRaw: vi
          .fn()
          .mockResolvedValue([
            {
              lockResult: 0,
            },
          ]),

        shelf: {
          findMany: vi
            .fn()
            .mockResolvedValue([
              activeShelf(
                sourceShelfId,
              ),
            ]),

          updateMany: vi
            .fn()
            .mockResolvedValue({
              count: 1,
            }),
        },

        equipment: {
          findMany: vi
            .fn()
            .mockResolvedValue([
              {
                equipmentId:
                  equipmentA,
                equipmentName:
                  'A',
                hasSerialNumber:
                  false,
                equipmentQuantity:
                  5,
                equipmentStatus:
                  'ACTIVE',
              },

              {
                equipmentId:
                  equipmentB,
                equipmentName:
                  'B',
                hasSerialNumber:
                  false,
                equipmentQuantity:
                  3,
                equipmentStatus:
                  'ACTIVE',
              },
            ]),

          updateMany: vi
            .fn()
            .mockResolvedValue({
              count: 1,
            }),
        },

        serialNumber: {
          findMany:
            vi.fn(),
          updateMany:
            vi.fn(),
        },

        equipmentShelfs: {
          updateMany:
            vi.fn(
              async (
                args: any,
              ) => {
                const id =
                  args.where
                    .equipmentId as string;

                const quantity =
                  args.where
                    .equipmentQuantity
                    .gte as number;

                if (
                  (state.allocations[
                    id
                  ] ?? 0) <
                  quantity
                ) {
                  return {
                    count: 0,
                  };
                }

                state.allocations[
                  id
                ] -= quantity;

                return {
                  count: 1,
                };
              },
            ),

          findMany:
            vi.fn(),
          create:
            vi.fn(),
        },

        inventoryWorkUnit: {
          findFirst: vi
            .fn()
            .mockResolvedValue(
              null,
            ),
        },

        mouvement: {
          create: vi.fn(
            async () => {
              state.parents += 1;

              return {
                mouvementId:
                  movementId,
              };
            },
          ),

          findUniqueOrThrow:
            vi.fn(),
        },

        mouvementEquipment: {
          createMany: vi.fn(
            async (
              args: any,
            ) => {
              state.lines +=
                args.data.length;

              return {
                count:
                  args.data
                    .length,
              };
            },
          ),
        },
      };

      const transaction =
        vi.fn(
          async (
            callback: (
              client:
                typeof tx,
            ) => Promise<unknown>,
            _options?: unknown,
          ) => {
            const snapshot =
              structuredClone(
                state,
              );

            try {
              return await callback(
                tx,
              );
            } catch (error) {
              state.parents =
                snapshot.parents;

              state.lines =
                snapshot.lines;

              state.allocations =
                snapshot.allocations;

              throw error;
            }
          },
        );

      const prisma = {
        $transaction:
          transaction,
      };

      const service =
        new EquipmentMovementService(
          prisma as any,
        );

      const before =
        structuredClone(
          state,
        );

      await expect(
        service.createMovement({
          movementType:
            'OUT',
          sourceShelfId,
          items: [
            {
              equipmentId:
                equipmentA,
              movementQuantity:
                2,
            },
            {
              equipmentId:
                equipmentB,
              movementQuantity:
                4,
            },
          ],
        }),
      ).rejects.toThrow(
        'Insufficient quantity',
      );

      expect(
        state,
      ).toEqual(before);

      expect(
        tx.mouvementEquipment
          .createMany,
      ).not.toHaveBeenCalled();
    });

    it('rejects movement when SQL Server application lock cannot be acquired', async () => {
      const tx = {
        $queryRaw: vi
          .fn()
          .mockResolvedValue([
            {
              lockResult:
                -1,
            },
          ]),

        shelf: {
          findMany:
            vi.fn(),
        },

        equipment: {
          findMany:
            vi.fn(),
        },
      };

      const transaction =
        vi.fn(
          async (
            callback: (
              client:
                typeof tx,
            ) => unknown,
            _options?: unknown,
          ) =>
            callback(tx),
        );

      const service =
        new EquipmentMovementService(
          {
            $transaction:
              transaction,
          } as any,
        );

      await expect(
        service.createMovement({
          movementType:
            'OUT',
          sourceShelfId,
          items: [
            {
              equipmentId:
                equipmentA,
              movementQuantity:
                1,
            },
          ],
        }),
      ).rejects.toThrow(
        'resource is busy',
      );

      expect(
        tx.shelf.findMany,
      ).not.toHaveBeenCalled();
    });
  },
);
