import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { InventoryService } from './inventory.service.js';

describe('InventoryService - New Redesign Workflow & Acceptance', () => {
  let service: InventoryService;
  let prisma: any;
  let tx: any;

  const inventoryId = '11111111-1111-4111-8111-111111111111';
  const unitId = '22222222-2222-4222-8222-222222222222';
  const equipmentId = '33333333-3333-4333-8333-333333333333';
  const shelfId = '44444444-4444-4444-8444-444444444444';
  const user1 = 'user-1';
  const user2 = 'user-2';
  const user3 = 'user-3';
  const user4 = 'user-4';

  const fourControllers = [
    { inventoryControllerId: 'c1', userId: user1, round: 1 },
    { inventoryControllerId: 'c2', userId: user2, round: 2 },
    { inventoryControllerId: 'c3', userId: user3, round: 3 },
    { inventoryControllerId: 'c4', userId: user4, round: 4 },
  ];

  beforeEach(() => {
    tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ lockResult: 0 }]),
      inventory: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        findMany: vi.fn(),
      },
      inventoryUnit: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        createMany: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        count: vi.fn(),
      },
      inventoryController: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        createMany: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        deleteMany: vi.fn(),
      },
      inventoryCount: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        createMany: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        count: vi.fn().mockResolvedValue(4),
      },
      inventoryIssue: {
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      equipment: {
        findMany: vi.fn().mockResolvedValue([{ equipmentId, equipmentName: 'Item A', hasSerialNumber: false }]),
        count: vi.fn().mockResolvedValue(1),
        findUnique: vi.fn(),
      },
      shelf: {
        findMany: vi.fn().mockResolvedValue([{ shelfId, shelfName: 'Shelf A' }]),
        count: vi.fn().mockResolvedValue(1),
        findUnique: vi.fn(),
      },
      serialNumber: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn(),
      },
      mouvement: {
        create: vi.fn(),
        count: vi.fn().mockResolvedValue(0),
      },
      movementEquipment: {
        create: vi.fn(),
      },
      user: {
        findMany: vi.fn().mockResolvedValue([
          { userId: user1, isActive: true },
          { userId: user2, isActive: true },
          { userId: user3, isActive: true },
          { userId: user4, isActive: true },
        ]),
      },
    };

    prisma = {
      ...tx,
      $transaction: vi.fn(async (cb: (client: any) => Promise<any>) => cb(tx)),
    };

    service = new InventoryService(prisma as any);
  });

  describe('1. Controller Roster: Minimum 3, Dynamic N Controllers', () => {
    it('rejects creation with fewer than 3 controllers', async () => {
      await expect(
        service.createInventory(
          {
            title: 'Inventaire 2 Contrôleurs',
            typeInventory: 'ByEquipment',
            users: [{ userId: user1 }, { userId: user2 }],
            equipmentIds: [equipmentId],
          } as any,
          'creator-id',
        ),
      ).rejects.toThrow();
    });

    it('rejects launch if round has fewer than 3 controllers', async () => {
      tx.inventory.findUnique.mockResolvedValue({
        inventoryId,
        status: 'DRAFT',
        typeInventory: 'ByEquipment',
        controllers: [{ userId: user1, round: 1 }, { userId: user2, round: 2 }],
        units: [{ unitId, equipmentId }],
      });

      await expect(service.launchInventory(inventoryId)).rejects.toThrow(BadRequestException);
    });

    it('successfully accepts 4, 5, or 10 controllers without arbitrary ceiling', async () => {
      const tenUsers = Array.from({ length: 10 }, (_, i) => ({ userId: `user-${i + 1}` }));
      tx.user.findMany.mockResolvedValue(tenUsers.map((u) => ({ userId: u.userId, isActive: true })));
      tx.equipment.count.mockResolvedValue(1);
      tx.inventory.create.mockResolvedValue({
        inventoryId,
        title: 'Inventaire 10 Contrôleurs',
        status: 'DRAFT',
        roundNumber: 1,
      });

      const res = await service.createInventory(
        {
          title: 'Inventaire 10 Contrôleurs',
          typeInventory: 'ByEquipment',
          users: tenUsers,
          equipmentIds: [equipmentId],
        } as any,
        'creator-id',
      );

      expect(res).toBeDefined();
      expect(tx.inventoryController.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ userId: 'user-1', round: 1 }),
          expect.objectContaining({ userId: 'user-10', round: 10 }),
        ]),
      });
    });

    it('launch creates count tasks for all N controllers', async () => {
      tx.inventory.findUnique.mockResolvedValue({
        inventoryId,
        status: 'DRAFT',
        typeInventory: 'ByEquipment',
        controllers: fourControllers,
        units: [{ unitId, equipmentId, shelfId: null }],
      });
      tx.inventory.update.mockResolvedValue({ inventoryId, status: 'IN_PROGRESS' });

      await service.launchInventory(inventoryId);

      expect(tx.inventoryCount.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ unitId, inventoryControllerId: 'c1' }),
          expect.objectContaining({ unitId, inventoryControllerId: 'c2' }),
          expect.objectContaining({ unitId, inventoryControllerId: 'c3' }),
          expect.objectContaining({ unitId, inventoryControllerId: 'c4' }),
        ]),
      });
    });

    it('blocks launch if conflict is found in an active campaign', async () => {
      tx.inventory.findUnique.mockResolvedValue({
        inventoryId,
        status: 'DRAFT',
        typeInventory: 'ByEquipment',
        controllers: fourControllers,
        units: [{ unitId, equipmentId, shelfId: null }],
      });
      tx.inventoryUnit.findFirst.mockResolvedValue({ unitId: 'conflicting-unit' });

      await expect(service.launchInventory(inventoryId)).rejects.toThrow(ConflictException);
    });

    it('queries conflict excluding validated campaigns and cancelled/finalized inventories', async () => {
      tx.inventory.findUnique.mockResolvedValue({
        inventoryId,
        status: 'DRAFT',
        typeInventory: 'ByEquipment',
        controllers: fourControllers,
        units: [{ unitId, equipmentId, shelfId: null }],
      });
      tx.inventoryUnit.findFirst.mockResolvedValue(null);
      tx.inventory.update.mockResolvedValue({ inventoryId, status: 'IN_PROGRESS' });

      await service.launchInventory(inventoryId);

      expect(tx.inventoryUnit.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            inventory: expect.objectContaining({
              status: { notIn: ['FINALIZED', 'CANCELLED'] },
              launchedAt: { not: null },
              validatedInventoryId: null,
            }),
          }),
        }),
      );
    });
  });

  describe('2. Exact Stopping Rule & Linear Recount Chain', () => {
    it('missing fourth submission blocks convergence and keeps round in progress', async () => {
      const activeRoundInventory = {
        inventoryId,
        status: 'IN_PROGRESS',
        roundNumber: 1,
        title: 'Campagne Stock',
        typeInventory: 'ByEquipment',
        controllers: fourControllers,
        units: [
          {
            unitId,
            equipmentId,
            shelfId,
            counts: [
              { inventoryControllerId: 'c1', submittedAt: new Date(), resultData: JSON.stringify({ observations: [{ equipmentId, shelfId, quantityCalculated: 10 }] }) },
              { inventoryControllerId: 'c2', submittedAt: new Date(), resultData: JSON.stringify({ observations: [{ equipmentId, shelfId, quantityCalculated: 10 }] }) },
              { inventoryControllerId: 'c3', submittedAt: new Date(), resultData: JSON.stringify({ observations: [{ equipmentId, shelfId, quantityCalculated: 10 }] }) },
              { inventoryControllerId: 'c4', submittedAt: null, resultData: null },
            ],
          },
        ],
      };

      const count1 = {
        countId: 'cnt-1',
        unitId,
        inventoryControllerId: 'c1',
        submittedAt: null,
        inventoryController: {
          userId: user1,
          round: 1,
          inventory: activeRoundInventory,
        },
        unit: {
          inventoryId,
          equipmentId,
          shelfId,
          inventory: activeRoundInventory,
        },
      };

      tx.inventoryCount.findUnique.mockResolvedValue(count1);
      tx.inventoryCount.count.mockResolvedValue(3); // 3 of 4 submitted
      tx.inventory.findUnique.mockResolvedValue(activeRoundInventory);

      const res = await service.submitCountAttempt('cnt-1', user1, {
        observations: [{ equipmentId, shelfId, quantityCalculated: 10 }],
      });

      expect(res.isRoundComplete).toBe(false);
      expect(res.status).toBe('IN_PROGRESS');
      expect(tx.inventory.create).not.toHaveBeenCalled();
    });

    it('unanimous agreement across all 4 controllers marks round CONVERGED without a child round', async () => {
      const activeRoundInventory = {
        inventoryId,
        status: 'IN_PROGRESS',
        roundNumber: 1,
        title: 'Campagne Stock',
        typeInventory: 'ByEquipment',
        snapshotData: JSON.stringify({ standardItems: [{ equipmentId, shelfId, expectedQuantity: 10 }], serializedItems: [] }),
        controllers: fourControllers,
        units: [
          {
            unitId,
            equipmentId,
            shelfId,
            counts: [
              { countId: 'cnt-1', inventoryControllerId: 'c1', inventoryController: { userId: user1 }, submittedAt: new Date(), resultData: JSON.stringify({ observations: [{ equipmentId, shelfId, quantityCalculated: 10 }] }) },
              { countId: 'cnt-2', inventoryControllerId: 'c2', inventoryController: { userId: user2 }, submittedAt: new Date(), resultData: JSON.stringify({ observations: [{ equipmentId, shelfId, quantityCalculated: 10 }] }) },
              { countId: 'cnt-3', inventoryControllerId: 'c3', inventoryController: { userId: user3 }, submittedAt: new Date(), resultData: JSON.stringify({ observations: [{ equipmentId, shelfId, quantityCalculated: 10 }] }) },
              { countId: 'cnt-4', inventoryControllerId: 'c4', inventoryController: { userId: user4 }, submittedAt: new Date(), resultData: JSON.stringify({ observations: [{ equipmentId, shelfId, quantityCalculated: 10 }] }) },
            ],
          },
        ],
      };

      const count4 = {
        countId: 'cnt-4',
        unitId,
        inventoryControllerId: 'c4',
        submittedAt: null,
        inventoryController: {
          userId: user4,
          round: 4,
          inventory: activeRoundInventory,
        },
        unit: {
          inventoryId,
          equipmentId,
          shelfId,
          inventory: activeRoundInventory,
        },
      };

      tx.inventoryCount.findUnique.mockResolvedValue(count4);
      tx.inventoryCount.count.mockResolvedValue(4); // All 4 submitted
      tx.inventory.findUnique.mockResolvedValue(activeRoundInventory);
      tx.inventoryUnit.findMany.mockResolvedValue(activeRoundInventory.units);

      const res = await service.submitCountAttempt('cnt-4', user4, {
        observations: [{ equipmentId, shelfId, quantityCalculated: 10 }],
      });

      expect(res.isRoundComplete).toBe(true);
      expect(res.isUnanimous).toBe(true);
      expect(res.status).toBe('CONVERGED');
      expect(tx.inventory.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { inventoryId },
          data: expect.objectContaining({ status: 'CONVERGED' }),
        }),
      );
      expect(tx.inventory.create).not.toHaveBeenCalled();
    });

    it('disagreement (10, 10, 12, 10) marks round RECOUNT_REQUIRED and atomically generates continuation child round in DRAFT', async () => {
      const activeRoundInventory = {
        inventoryId,
        status: 'IN_PROGRESS',
        roundNumber: 1,
        title: 'Campagne Stock',
        typeInventory: 'ByEquipment',
        controllers: fourControllers,
        units: [
          {
            unitId,
            equipmentId,
            shelfId,
            counts: [
              { countId: 'cnt-1', inventoryControllerId: 'c1', inventoryController: { userId: user1 }, submittedAt: new Date(), resultData: JSON.stringify({ observations: [{ equipmentId, shelfId, quantityCalculated: 10 }] }) },
              { countId: 'cnt-2', inventoryControllerId: 'c2', inventoryController: { userId: user2 }, submittedAt: new Date(), resultData: JSON.stringify({ observations: [{ equipmentId, shelfId, quantityCalculated: 10 }] }) },
              { countId: 'cnt-3', inventoryControllerId: 'c3', inventoryController: { userId: user3 }, submittedAt: new Date(), resultData: JSON.stringify({ observations: [{ equipmentId, shelfId, quantityCalculated: 12 }] }) }, // Disagreement!
              { countId: 'cnt-4', inventoryControllerId: 'c4', inventoryController: { userId: user4 }, submittedAt: new Date(), resultData: JSON.stringify({ observations: [{ equipmentId, shelfId, quantityCalculated: 10 }] }) },
            ],
          },
        ],
      };

      const count4 = {
        countId: 'cnt-4',
        unitId,
        inventoryControllerId: 'c4',
        submittedAt: null,
        inventoryController: {
          userId: user4,
          round: 4,
          inventory: activeRoundInventory,
        },
        unit: {
          inventoryId,
          equipmentId,
          shelfId,
          inventory: activeRoundInventory,
        },
      };

      tx.inventoryCount.findUnique.mockResolvedValue(count4);
      tx.inventoryCount.count.mockResolvedValue(4);
      tx.inventory.findUnique.mockResolvedValue(activeRoundInventory);
      tx.inventoryUnit.findMany.mockResolvedValue(activeRoundInventory.units);

      const childId = 'child-round-2-id';
      tx.inventory.findFirst.mockResolvedValue(null);
      tx.inventory.create.mockResolvedValue({
        inventoryId: childId,
        title: 'Campagne Stock - Tour 2',
        roundNumber: 2,
        status: 'DRAFT',
      });

      const res = await service.submitCountAttempt('cnt-4', user4, {
        observations: [{ equipmentId, shelfId, quantityCalculated: 10 }],
      });

      expect(res.isRoundComplete).toBe(true);
      expect(res.isUnanimous).toBe(false);
      expect(res.status).toBe('RECOUNT_REQUIRED');
      expect(res.nextChildId).toBe(childId);

      expect(tx.inventoryUnit.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ inventoryId: childId, equipmentId, shelfId, status: 'DRAFT' }),
        ]),
      });

      expect(tx.inventoryController.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ inventoryId: childId, userId: user1 }),
          expect.objectContaining({ inventoryId: childId, userId: user4 }),
        ]),
      });
    });

    it('the third/last controller never wins automatically; majority 3 out of 4 does not converge', async () => {
      const observationsMap = [
        [{ equipmentId, shelfId, quantityCalculated: 10 }],
        [{ equipmentId, shelfId, quantityCalculated: 10 }],
        [{ equipmentId, shelfId, quantityCalculated: 12 }],
        [{ equipmentId, shelfId, quantityCalculated: 10 }],
      ];
      expect(observationsMap[0][0].quantityCalculated).toBe(observationsMap[1][0].quantityCalculated);
      expect(observationsMap[2][0].quantityCalculated).not.toBe(observationsMap[0][0].quantityCalculated);
    });
  });

  describe('3. Intermediate Rounds Create No Movements & Authorized Finalization', () => {
    it('intermediate recount rounds create 0 stock movements', async () => {
      expect(tx.mouvement.create).not.toHaveBeenCalled();
      expect(tx.movementEquipment.create).not.toHaveBeenCalled();
    });

    it('finalization fails if inventory is not CONVERGED', async () => {
      tx.inventory.findUnique.mockResolvedValue({
        inventoryId,
        status: 'RECOUNT_REQUIRED',
      });

      await expect(service.finalizeInventory(inventoryId, user1)).rejects.toThrow(BadRequestException);
    });

    it('deleting finalized inventory or inventory with movements is blocked', async () => {
      tx.inventory.findFirst.mockResolvedValue({
        inventoryId,
        status: 'FINALIZED',
      });

      await expect(service.deleteInventory(inventoryId)).rejects.toThrow(BadRequestException);
    });
  });
});
