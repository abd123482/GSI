import { describe, expect, it, vi } from 'vitest';
import { EquipmentMovementService } from './equipmentMovement.service.js';

const equipmentA = '11111111-1111-4111-8111-111111111111';
const equipmentB = '22222222-2222-4222-8222-222222222222';
const serializedEquipment = '33333333-3333-4333-8333-333333333333';
const sourceShelfId = '44444444-4444-4444-8444-444444444444';
const destinationShelfId = '55555555-5555-4555-8555-555555555555';
const serialId = '66666666-6666-4666-8666-666666666666';
const movementId = '77777777-7777-4777-8777-777777777777';

function createHarness() {
  const equipmentRecords = new Map([
    [
      equipmentA,
      {
        equipmentId: equipmentA,
        equipmentName: 'Standard A',
        hasSerialNumber: false,
        equipmentQuantity: 20,
      },
    ],
    [
      equipmentB,
      {
        equipmentId: equipmentB,
        equipmentName: 'Standard B',
        hasSerialNumber: false,
        equipmentQuantity: 30,
      },
    ],
    [
      serializedEquipment,
      {
        equipmentId: serializedEquipment,
        equipmentName: 'Serialized',
        hasSerialNumber: true,
        equipmentQuantity: 1,
      },
    ],
  ]);

  const serialRecords = new Map([
    [
      serialId,
      {
        serialNumberId: serialId,
        equipmentId: serializedEquipment,
        shelfId: sourceShelfId,
      },
    ],
  ]);

  const tx = {
    shelf: {
      findMany: vi.fn(async (args: any) =>
        (args.where.shelfId.in as string[]).map((shelfId) => ({ shelfId })),
      ),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUnique: vi.fn().mockResolvedValue({ shelfQuantity: 0 }),
      update: vi.fn().mockResolvedValue({}),
    },

    equipment: {
      findMany: vi.fn(async (args: any) =>
        (args.where.equipmentId.in as string[])
          .map((id) => equipmentRecords.get(id))
          .filter(Boolean),
      ),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },

    serialNumber: {
      findMany: vi.fn(async (args: any) =>
        (args.where.serialNumberId.in as string[])
          .map((id) => serialRecords.get(id))
          .filter(Boolean),
      ),
      updateMany: vi.fn(async (args: any) => ({
        count: (args.where.serialNumberId.in as string[]).length,
      })),
    },

    equipmentShelfs: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
    },

    mouvement: {
      create: vi.fn().mockResolvedValue({ mouvementId: movementId }),
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        mouvementId: movementId,
        mouvementStatus: 'IN',
        mouvementQuantity: 0,
        items: [],
      }),
    },

    mouvementEquipment: {
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };

  const prisma = {
    $transaction: vi.fn(
      async (callback: (client: typeof tx) => unknown) => callback(tx),
    ),
  };

  return {
    service: new EquipmentMovementService(prisma as any),
    prisma,
    tx,
    equipmentRecords,
    serialRecords,
  };
}

describe('EquipmentMovementService V3', () => {
  it('creates one IN header and copies the shared route/type to all lines', async () => {
    const { service, tx } = createHarness();

    await service.createMovement({
      movementType: 'IN',
      destinationShelfId,
      items: [
        {
          equipmentId: equipmentA,
          movementQuantity: 3,
        },
        {
          equipmentId: equipmentB,
          movementQuantity: 2,
        },
      ],
    });

    expect(tx.mouvement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        mouvementStatus: 'IN',
        mouvementQuantity: 5,
        sourceShelfId: null,
        destinationShelfId,
        equipmentId: null,
        serialNumberId: null,
      }),
      select: {
        mouvementId: true,
      },
    });

    expect(tx.mouvementEquipment.createMany).toHaveBeenCalledWith({
      data: [
        {
          mouvementId: movementId,
          rowNum: 1,
          equipmentId: equipmentA,
          serialNumberId: null,
          mouvementQuantity: 3,
          mouvementStatus: 'IN',
          sourceShelfId: null,
          destinationShelfId,
        },
        {
          mouvementId: movementId,
          rowNum: 2,
          equipmentId: equipmentB,
          serialNumberId: null,
          mouvementQuantity: 2,
          mouvementStatus: 'IN',
          sourceShelfId: null,
          destinationShelfId,
        },
      ],
    });

    expect(tx.equipment.updateMany).toHaveBeenCalledTimes(2);
    expect(tx.shelf.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { shelfId: destinationShelfId },
      }),
    );
  });

  it('transfers standard and serialized equipment under one shared route', async () => {
    const { service, tx } = createHarness();

    await service.createMovement({
      movementType: 'TRANSFER',
      sourceShelfId,
      destinationShelfId,
      items: [
        {
          equipmentId: equipmentA,
          movementQuantity: 2,
        },
        {
          equipmentId: serializedEquipment,
          serialNumberId: serialId,
          movementQuantity: 1,
        },
      ],
    });

    expect(tx.equipmentShelfs.updateMany).toHaveBeenCalledTimes(2);
    expect(tx.equipmentShelfs.create).toHaveBeenCalledTimes(2);

    expect(tx.serialNumber.updateMany).toHaveBeenCalledWith({
      where: {
        serialNumberId: { in: [serialId] },
        shelfId: sourceShelfId,
      },
      data: {
        shelfId: destinationShelfId,
      },
    });

    // TRANSFER never changes the global Equipment quantity.
    expect(tx.equipment.updateMany).not.toHaveBeenCalled();

    expect(tx.mouvementEquipment.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          mouvementStatus: 'TRANSFER',
          sourceShelfId,
          destinationShelfId,
        }),
      ]),
    });
  });

  it('rejects a duplicate serial before creating the movement header', async () => {
    const { service, tx } = createHarness();

    await expect(
      service.createMovement({
        movementType: 'TRANSFER',
        sourceShelfId,
        destinationShelfId,
        items: [
          {
            equipmentId: serializedEquipment,
            serialNumberId: serialId,
            movementQuantity: 1,
          },
          {
            equipmentId: serializedEquipment,
            serialNumberId: serialId,
            movementQuantity: 1,
          },
        ],
      }),
    ).rejects.toThrow('cannot appear twice');

    expect(tx.mouvement.create).not.toHaveBeenCalled();
  });

  it('rejects a serialized line with quantity different from one', async () => {
    const { service, tx } = createHarness();

    await expect(
      service.createMovement({
        movementType: 'TRANSFER',
        sourceShelfId,
        destinationShelfId,
        items: [
          {
            equipmentId: serializedEquipment,
            serialNumberId: serialId,
            movementQuantity: 2,
          },
        ],
      }),
    ).rejects.toThrow('must have quantity 1');

    expect(tx.mouvement.create).not.toHaveBeenCalled();
  });

  it('rejects a serial belonging to another equipment', async () => {
    const { service, tx, serialRecords } = createHarness();

    serialRecords.set(serialId, {
      serialNumberId: serialId,
      equipmentId: equipmentB,
      shelfId: sourceShelfId,
    });

    await expect(
      service.createMovement({
        movementType: 'TRANSFER',
        sourceShelfId,
        destinationShelfId,
        items: [
          {
            equipmentId: serializedEquipment,
            serialNumberId: serialId,
            movementQuantity: 1,
          },
        ],
      }),
    ).rejects.toThrow('does not belong');

    expect(tx.mouvement.create).not.toHaveBeenCalled();
  });

  it('rejects a serial that is not on the OUT/TRANSFER source shelf', async () => {
    const { service, tx, serialRecords } = createHarness();

    serialRecords.set(serialId, {
      serialNumberId: serialId,
      equipmentId: serializedEquipment,
      shelfId: destinationShelfId,
    });

    await expect(
      service.createMovement({
        movementType: 'OUT',
        sourceShelfId,
        items: [
          {
            equipmentId: serializedEquipment,
            serialNumberId: serialId,
            movementQuantity: 1,
          },
        ],
      }),
    ).rejects.toThrow('not on the movement source shelf');

    expect(tx.mouvement.create).not.toHaveBeenCalled();
  });

  it('rejects duplicate standard-equipment lines in one movement', async () => {
    const { service, tx } = createHarness();

    await expect(
      service.createMovement({
        movementType: 'IN',
        destinationShelfId,
        items: [
          {
            equipmentId: equipmentA,
            movementQuantity: 1,
          },
          {
            equipmentId: equipmentA,
            movementQuantity: 2,
          },
        ],
      }),
    ).rejects.toThrow('can appear only once');

    expect(tx.mouvement.create).not.toHaveBeenCalled();
  });

  it('rejects an OUT when source allocation is insufficient', async () => {
    const { service, tx } = createHarness();

    tx.equipmentShelfs.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      service.createMovement({
        movementType: 'OUT',
        sourceShelfId,
        items: [
          {
            equipmentId: equipmentA,
            movementQuantity: 7,
          },
        ],
      }),
    ).rejects.toThrow('Insufficient quantity');

    expect(tx.mouvementEquipment.createMany).not.toHaveBeenCalled();
  });

  it('uses a conditional serial update and rejects a stale location', async () => {
    const { service, tx } = createHarness();

    tx.serialNumber.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      service.createMovement({
        movementType: 'TRANSFER',
        sourceShelfId,
        destinationShelfId,
        items: [
          {
            equipmentId: serializedEquipment,
            serialNumberId: serialId,
            movementQuantity: 1,
          },
        ],
      }),
    ).rejects.toThrow('locations changed');

    expect(tx.mouvementEquipment.createMany).not.toHaveBeenCalled();
  });

  it('rejects a route that does not match the movement type before opening a transaction', async () => {
    const { service, prisma } = createHarness();

    await expect(
      service.createMovement({
        movementType: 'IN',
        sourceShelfId,
        destinationShelfId,
        items: [
          {
            equipmentId: equipmentA,
            movementQuantity: 1,
          },
        ],
      } as any),
    ).rejects.toThrow();

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
