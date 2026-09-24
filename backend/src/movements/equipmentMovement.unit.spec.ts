// @ts-nocheck
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

const serializedEquipment =
  '33333333-3333-4333-8333-333333333333';

const sourceShelfId =
  '44444444-4444-4444-8444-444444444444';

const destinationShelfId =
  '55555555-5555-4555-8555-555555555555';

const serialId =
  '66666666-6666-4666-8666-666666666666';

const movementId =
  '77777777-7777-4777-8777-777777777777';

const inventoryId =
  '88888888-8888-4888-8888-888888888888';

function activeShelf(
  shelfId: string,
) {
  return {
    shelfId,
    shelfName:
      `Shelf-${shelfId.slice(0, 4)}`,
    stockId:
      '99999999-9999-4999-8999-999999999999',
    stock: {
      stockId:
        '99999999-9999-4999-8999-999999999999',
      stockName:
        'Stock Principal',
      stockStatus: {
        stockStatusName:
          'ACTIVE',
      },
    },
  };
}

function createHarness() {
  const equipmentRecords =
    new Map([
      [
        equipmentA,
        {
          equipmentId:
            equipmentA,
          equipmentName:
            'Standard A',
          hasSerialNumber:
            false,
          equipmentQuantity:
            20,
          equipmentStatus:
            'ACTIVE',
        },
      ],

      [
        equipmentB,
        {
          equipmentId:
            equipmentB,
          equipmentName:
            'Standard B',
          hasSerialNumber:
            false,
          equipmentQuantity:
            30,
          equipmentStatus:
            'ACTIVE',
        },
      ],

      [
        serializedEquipment,
        {
          equipmentId:
            serializedEquipment,
          equipmentName:
            'Serialized',
          hasSerialNumber:
            true,
          equipmentQuantity:
            1,
          equipmentStatus:
            'ACTIVE',
        },
      ],
    ]);

  const serialRecords =
    new Map<
      string,
      {
        serialNumberId: string;
        equipmentId: string;
        shelfId: string | null;
        serialNumberStatus: string;
      }
    >([
      [
        serialId,
        {
          serialNumberId:
            serialId,
          equipmentId:
            serializedEquipment,
          shelfId:
            sourceShelfId,
          serialNumberStatus:
            'AVAILABLE',
        },
      ],
    ]);

  const allocations =
    new Map<
      string,
      {
        equipmentShelfId:
          string;
        equipmentId:
          string;
        shelfId:
          string;
        equipmentQuantity:
          number;
      }
    >();

  let nextAllocationId =
    1;

  const tx = {
    $queryRaw: vi
      .fn()
      .mockResolvedValue([
        {
          lockResult: 0,
        },
      ]),

    shelf: {
      findMany: vi.fn(
        async (
          args: any,
        ) =>
          (
            args.where.shelfId
              .in as string[]
          ).map(
            activeShelf,
          ),
      ),

      updateMany: vi
        .fn()
        .mockResolvedValue({
          count: 1,
        }),

      findUnique: vi
        .fn()
        .mockResolvedValue({
          shelfQuantity: 0,
        }),
    },

    equipment: {
      findMany: vi.fn(
        async (
          args: any,
        ) =>
          (
            args.where.equipmentId
              .in as string[]
          )
            .map(
              (id) =>
                equipmentRecords.get(
                  id,
                ),
            )
            .filter(Boolean),
      ),

      updateMany: vi
        .fn()
        .mockResolvedValue({
          count: 1,
        }),
    },

    serialNumber: {
      findMany: vi.fn(
        async (
          args: any,
        ) =>
          (
            args.where
              .serialNumberId
              .in as string[]
          )
            .map(
              (id) =>
                serialRecords.get(
                  id,
                ),
            )
            .filter(Boolean),
      ),

      updateMany: vi
        .fn()
        .mockResolvedValue({
          count: 1,
        }),
    },

    equipmentShelfs: {
      updateMany: vi
        .fn()
        .mockResolvedValue({
          count: 1,
        }),

      findMany: vi.fn(
        async (
          args: any,
        ) => {
          const ids =
            args.where
              .equipmentId
              .in as string[];

          return ids
            .map((id) =>
              allocations.get(
                `${id}:${args.where.shelfId}`,
              ),
            )
            .filter(Boolean);
        },
      ),

      create: vi.fn(
        async (
          args: any,
        ) => {
          const record = {
            equipmentShelfId:
              `allocation-${nextAllocationId++}`,
            equipmentId:
              args.data
                .equipmentId,
            shelfId:
              args.data.shelfId,
            equipmentQuantity:
              args.data
                .equipmentQuantity,
          };

          allocations.set(
            `${record.equipmentId}:${record.shelfId}`,
            record,
          );

          return record;
        },
      ),
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
            mouvementStatus:
              'IN',
            mouvementQuantity:
              0,
            origin: 'USER',
            inventoryId: null,
            reason: null,
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
          client: typeof tx,
        ) => unknown,
        _options?: unknown,
      ) => callback(tx),
    );

  const prisma = {
    $transaction:
      transaction,
  };

  return {
    service:
      new EquipmentMovementService(
        prisma as any,
      ),
    prisma,
    tx,
    transaction,
    equipmentRecords,
    serialRecords,
    allocations,
  };
}

describe(
  'EquipmentMovementService hardened movement engine',
  () => {
    it('creates a USER IN movement with STANDARD snapshots', async () => {
      const {
        service,
        tx,
      } = createHarness();

      await service.createMovement({
        movementType: 'IN',
        destinationShelfId,
        items: [
          {
            equipmentId:
              equipmentA,
            movementQuantity:
              3,
          },
          {
            equipmentId:
              equipmentB,
            movementQuantity:
              2,
          },
        ],
      });

      expect(
        tx.mouvement.create,
      ).toHaveBeenCalledWith({
        data:
          expect.objectContaining(
            {
              mouvementStatus:
                'IN',
              mouvementQuantity:
                5,
              sourceShelfId:
                null,
              destinationShelfId,
              equipmentId:
                null,
              serialNumberId:
                null,
              origin: 'USER',
              inventoryId:
                null,
              reason: null,
            },
          ),
        select: {
          mouvementId: true,
        },
      });

      expect(
        tx.mouvementEquipment
          .createMany,
      ).toHaveBeenCalledWith({
        data: [
          {
            mouvementId:
              movementId,
            rowNum: 1,
            equipmentId:
              equipmentA,
            equipmentTypeSnapshot:
              'STANDARD',
            serialNumberId:
              null,
            mouvementQuantity:
              3,
            mouvementStatus:
              'IN',
            sourceShelfId:
              null,
            destinationShelfId,
          },
          {
            mouvementId:
              movementId,
            rowNum: 2,
            equipmentId:
              equipmentB,
            equipmentTypeSnapshot:
              'STANDARD',
            serialNumberId:
              null,
            mouvementQuantity:
              2,
            mouvementStatus:
              'IN',
            sourceShelfId:
              null,
            destinationShelfId,
          },
        ],
      });

      expect(
        tx.equipment.updateMany,
      ).toHaveBeenCalledTimes(
        2,
      );
    });

    it('serialized IN increments physical equipment quantity and moves serial from null to destination', async () => {
      const {
        service,
        tx,
        serialRecords,
      } = createHarness();

      serialRecords.set(
        serialId,
        {
          serialNumberId:
            serialId,
          equipmentId:
            serializedEquipment,
          shelfId: null,
          serialNumberStatus:
            'AVAILABLE',
        },
      );

      await service.createMovement({
        movementType: 'IN',
        destinationShelfId,
        items: [
          {
            equipmentId:
              serializedEquipment,
            serialNumberId:
              serialId,
            movementQuantity:
              1,
          },
        ],
      });

      expect(
        tx.equipment.updateMany,
      ).toHaveBeenCalledWith({
        where: {
          equipmentId:
            serializedEquipment,
          equipmentStatus:
            'ACTIVE',
          equipmentQuantity:
            {
              lte:
                2_147_483_646,
            },
        },
        data: {
          equipmentQuantity:
            {
              increment: 1,
            },
        },
      });

      expect(
        tx.serialNumber
          .updateMany,
      ).toHaveBeenCalledWith({
        where: {
          serialNumberId:
            serialId,
          equipmentId:
            serializedEquipment,
          shelfId: null,
        },
        data: {
          shelfId:
            destinationShelfId,
        },
      });

      expect(
        tx.mouvementEquipment
          .createMany,
      ).toHaveBeenCalledWith({
        data: [
          expect.objectContaining(
            {
              equipmentTypeSnapshot:
                'SERIALIZED',
            },
          ),
        ],
      });
    });

    it('serialized OUT decrements physical equipment quantity and clears serial shelf', async () => {
      const {
        service,
        tx,
      } = createHarness();

      await service.createMovement({
        movementType: 'OUT',
        sourceShelfId,
        items: [
          {
            equipmentId:
              serializedEquipment,
            serialNumberId:
              serialId,
            movementQuantity:
              1,
          },
        ],
      });

      expect(
        tx.equipment.updateMany,
      ).toHaveBeenCalledWith({
        where: {
          equipmentId:
            serializedEquipment,
          equipmentStatus:
            'ACTIVE',
          equipmentQuantity:
            {
              gte: 1,
            },
        },
        data: {
          equipmentQuantity:
            {
              decrement: 1,
            },
        },
      });

      expect(
        tx.serialNumber
          .updateMany,
      ).toHaveBeenCalledWith({
        where: {
          serialNumberId:
            serialId,
          equipmentId:
            serializedEquipment,
          shelfId:
            sourceShelfId,
        },
        data: {
          shelfId: null,
        },
      });
    });

    it('TRANSFER changes allocations and serial location but never global equipment quantity', async () => {
      const {
        service,
        tx,
      } = createHarness();

      await service.createMovement({
        movementType:
          'TRANSFER',
        sourceShelfId,
        destinationShelfId,
        items: [
          {
            equipmentId:
              equipmentA,
            movementQuantity:
              2,
          },
          {
            equipmentId:
              serializedEquipment,
            serialNumberId:
              serialId,
            movementQuantity:
              1,
          },
        ],
      });

      expect(
        tx.equipment.updateMany,
      ).not.toHaveBeenCalled();

      expect(
        tx.serialNumber
          .updateMany,
      ).toHaveBeenCalledWith({
        where: {
          serialNumberId:
            serialId,
          equipmentId:
            serializedEquipment,
          shelfId:
            sourceShelfId,
        },
        data: {
          shelfId:
            destinationShelfId,
        },
      });
    });

    it('rejects movement through an INACTIVE stock before creating header', async () => {
      const {
        service,
        tx,
      } = createHarness();

      tx.shelf.findMany
        .mockResolvedValue([
          {
            ...activeShelf(
              destinationShelfId,
            ),
            stock: {
              ...activeShelf(
                destinationShelfId,
              ).stock,
              stockStatus: {
                stockStatusName:
                  'INACTIVE',
              },
            },
          },
        ]);

      await expect(
        service.createMovement({
          movementType: 'IN',
          destinationShelfId,
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
        'INACTIVE stock',
      );

      expect(
        tx.mouvement.create,
      ).not.toHaveBeenCalled();
    });

    it('rejects movement of INACTIVE equipment', async () => {
      const {
        service,
        tx,
        equipmentRecords,
      } = createHarness();

      equipmentRecords.set(
        equipmentA,
        {
          equipmentId:
            equipmentA,
          equipmentName:
            'Standard A',
          hasSerialNumber:
            false,
          equipmentQuantity:
            20,
          equipmentStatus:
            'INACTIVE',
        },
      );

      await expect(
        service.createMovement({
          movementType: 'IN',
          destinationShelfId,
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
        'INACTIVE',
      );

      expect(
        tx.mouvement.create,
      ).not.toHaveBeenCalled();
    });

    it('blocks a resource controlled by an active inventory', async () => {
      const {
        service,
        tx,
      } = createHarness();

      tx.inventoryWorkUnit
        .findFirst
        .mockResolvedValue({
          unitId:
            'unit-1',
          equipmentId:
            equipmentA,
          shelfId: null,
          inventory: {
            inventoryId,
            title:
              'Inventory Active',
            status:
              'IN_PROGRESS',
          },
        });

      await expect(
        service.createMovement({
          movementType: 'IN',
          destinationShelfId,
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
        'active inventory',
      );

      expect(
        tx.mouvement.create,
      ).not.toHaveBeenCalled();
    });

    it('inventory adjustment may bypass its own inventory lock but keeps the audit link', async () => {
      const {
        service,
        tx,
      } = createHarness();

      await service.createInventoryAdjustmentMovement(
        {
          movementType:
            'IN',
          destinationShelfId,
          items: [
            {
              equipmentId:
                equipmentA,
              movementQuantity:
                1,
            },
          ],
        },
        inventoryId,
        'Inventory reconciliation',
        'actor-id',
      );

      expect(
        tx.inventoryWorkUnit
          .findFirst,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where:
            expect.objectContaining({
              inventory:
                expect.objectContaining({
                  inventoryId: {
                    not:
                      inventoryId,
                  },
                }),
            }),
        }),
      );

      expect(
        tx.mouvement.create,
      ).toHaveBeenCalledWith({
        data:
          expect.objectContaining(
            {
              origin:
                'INVENTORY_ADJUSTMENT',
              inventoryId,
              reason:
                'Inventory reconciliation',
              createdByUserId:
                'actor-id',
            },
          ),
        select: {
          mouvementId: true,
        },
      });
    });

    it('rejects duplicate serial use before creating the header', async () => {
      const {
        service,
        tx,
      } = createHarness();

      await expect(
        service.createMovement({
          movementType:
            'TRANSFER',
          sourceShelfId,
          destinationShelfId,
          items: [
            {
              equipmentId:
                serializedEquipment,
              serialNumberId:
                serialId,
              movementQuantity:
                1,
            },
            {
              equipmentId:
                serializedEquipment,
              serialNumberId:
                serialId,
              movementQuantity:
                1,
            },
          ],
        }),
      ).rejects.toThrow(
        'cannot appear twice',
      );

      expect(
        tx.mouvement.create,
      ).not.toHaveBeenCalled();
    });

    it('rejects serialized quantity other than one', async () => {
      const {
        service,
        tx,
      } = createHarness();

      await expect(
        service.createMovement({
          movementType:
            'TRANSFER',
          sourceShelfId,
          destinationShelfId,
          items: [
            {
              equipmentId:
                serializedEquipment,
              serialNumberId:
                serialId,
              movementQuantity:
                2,
            },
          ],
        }),
      ).rejects.toThrow(
        'must have quantity 1',
      );

      expect(
        tx.mouvement.create,
      ).not.toHaveBeenCalled();
    });

    it('rejects a serial that is not physically on the OUT source shelf', async () => {
      const {
        service,
        tx,
        serialRecords,
      } = createHarness();

      serialRecords.set(
        serialId,
        {
          serialNumberId:
            serialId,
          equipmentId:
            serializedEquipment,
          shelfId:
            destinationShelfId,
          serialNumberStatus:
            'AVAILABLE',
        },
      );

      await expect(
        service.createMovement({
          movementType:
            'OUT',
          sourceShelfId,
          items: [
            {
              equipmentId:
                serializedEquipment,
              serialNumberId:
                serialId,
              movementQuantity:
                1,
            },
          ],
        }),
      ).rejects.toThrow(
        'not on the movement source shelf',
      );

      expect(
        tx.mouvement.create,
      ).not.toHaveBeenCalled();
    });

    it('rejects insufficient source allocation and rolls the transaction back', async () => {
      const {
        service,
        tx,
      } = createHarness();

      tx.equipmentShelfs
        .updateMany
        .mockResolvedValueOnce({
          count: 0,
        });

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
                7,
            },
          ],
        }),
      ).rejects.toThrow(
        'Insufficient quantity',
      );

      expect(
        tx.mouvementEquipment
          .createMany,
      ).not.toHaveBeenCalled();
    });

    it('rejects a route mismatch before opening a transaction', async () => {
      const {
        service,
        prisma,
      } = createHarness();

      await expect(
        service.createMovement({
          movementType: 'IN',
          sourceShelfId,
          destinationShelfId,
          items: [
            {
              equipmentId:
                equipmentA,
              movementQuantity:
                1,
            },
          ],
        } as any),
      ).rejects.toThrow();

      expect(
        prisma.$transaction,
      ).not.toHaveBeenCalled();
    });
  },
);
