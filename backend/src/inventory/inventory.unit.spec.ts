import { describe, expect, it, vi, beforeEach } from 'vitest';
import { InventoryService } from './inventory.service.js';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('Inventory Workflow', () => {
  let inventoryService: InventoryService;

  let prismaMock: any;
  let txMock: any;

  beforeEach(() => {
    txMock = {
      inventory: {
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        delete: vi.fn(),
      },
      inventory_User: {
        create: vi.fn(),
        createMany: vi.fn(),
        update: vi.fn(),
        deleteMany: vi.fn(),
      },
      inventoryWorkUnit: {
        create: vi.fn().mockImplementation((args) => Promise.resolve({ unitId: 'unit-1', ...args.data })),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
        update: vi.fn(),
        deleteMany: vi.fn(),
        count: vi.fn(),
      },
      inventory_Equipment_Shelf_Snapshot: {
        createMany: vi.fn(),
        deleteMany: vi.fn(),
      },
      inventory_SerialNumber_Snapshot: {
        createMany: vi.fn(),
        deleteMany: vi.fn(),
      },
      inventoryInvestigationIssue: {
        deleteMany: vi.fn(),
      },
      inventoryCountAttempt: {
        create: vi.fn().mockImplementation((args) => Promise.resolve({ attemptId: 'att-1', ...args.data })),
        createMany: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
        update: vi.fn(),
        deleteMany: vi.fn(),
      },
      order: {
        deleteMany: vi.fn(),
      },
      equipmentShelfs: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      serialNumber: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      equipment: {
        findUnique: vi.fn(),
      },
      user: {
        findMany: vi.fn().mockResolvedValue([
          { userId: 'u1', role: { roleName: 'CONTROLLER' } },
          { userId: 'u2', role: { roleName: 'CONTROLLER' } },
          { userId: 'u3', role: { roleName: 'CONTROLLER' } },
        ]),
      },
      notification: {
        create: vi.fn(),
      },
    };

    prismaMock = {
      $transaction: vi.fn(async (cb) => cb(txMock)),
      inventory: txMock.inventory,
      inventoryWorkUnit: txMock.inventoryWorkUnit,
      inventoryCountAttempt: txMock.inventoryCountAttempt,
    };

    inventoryService = new InventoryService(prismaMock);
  });

  describe('createInventory', () => {
    it('creates a V2 inventory draft with 3 distinct ordered participants and equipment scope', async () => {
      txMock.inventory.create.mockResolvedValue({ inventoryId: 'inv-1', status: 'DRAFT' });

      const result = await inventoryService.createInventory({
        title: 'Annual Count',
        typeInventory: 'ByEquipment',
        policyVersion: 2,
        users: [
          { userId: 'u1', responsibility: 'PRIMARY_COUNTER_1' },
          { userId: 'u2', responsibility: 'PRIMARY_COUNTER_2' },
          { userId: 'u3', responsibility: 'FINAL_CONTROLLER' }
        ],
        equipmentIds: ['eq-1', 'eq-2']
      }, 'creator');

      expect(result.inventoryId).toBe('inv-1');
      expect(txMock.inventory.create).toHaveBeenCalled();
      expect(txMock.inventory_User.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({ inventoryId: 'inv-1', userId: 'u1', sequence: 0, responsibility: 'PRIMARY_COUNTER_1' }),
          expect.objectContaining({ inventoryId: 'inv-1', userId: 'u2', sequence: 1, responsibility: 'PRIMARY_COUNTER_2' }),
          expect.objectContaining({ inventoryId: 'inv-1', userId: 'u3', sequence: 2, responsibility: 'FINAL_CONTROLLER' })
        ]
      });
    });

    it('throws if fewer than 3 users are provided for V2', async () => {
      await expect(inventoryService.createInventory({
        title: 'Solo Count',
        typeInventory: 'ByEquipment',
        policyVersion: 2,
        users: [{ userId: 'u1', responsibility: 'PRIMARY_COUNTER_1' }],
      } as any, 'creator')).rejects.toThrow(BadRequestException);
    });

    it('throws if users are duplicate', async () => {
      await expect(inventoryService.createInventory({
        title: 'Duplicate Count',
        typeInventory: 'ByEquipment',
        policyVersion: 2,
        users: [
          { userId: 'u1', responsibility: 'PRIMARY_COUNTER_1' },
          { userId: 'u1', responsibility: 'PRIMARY_COUNTER_2' },
          { userId: 'u3', responsibility: 'FINAL_CONTROLLER' }
        ],
      } as any, 'creator')).rejects.toThrow(BadRequestException);
    });
  });

  describe('launchInventory', () => {
    it('throws if inventory is not DRAFT', async () => {
      txMock.inventory.findUnique.mockResolvedValue({
        inventoryId: 'inv-1',
        status: 'IN_PROGRESS',
        Inventory_User: []
      });

      await expect(inventoryService.launchInventory('inv-1')).rejects.toThrow(BadRequestException);
    });

    it('throws if inventory has fewer than required participants', async () => {
      txMock.inventory.findUnique.mockResolvedValue({
        inventoryId: 'inv-1',
        status: 'DRAFT',
        policyVersion: 2,
        Inventory_User: [{ userId: 'u1', sequence: 0, responsibility: 'PRIMARY_COUNTER_1' }]
      });

      await expect(inventoryService.launchInventory('inv-1')).rejects.toThrow(BadRequestException);
    });

    it('launches inventory and generates work units, snapshots and pipeline attempts', async () => {
      txMock.inventory.findUnique.mockResolvedValue({
        inventoryId: 'inv-1',
        status: 'DRAFT',
        typeInventory: 'ByEquipment',
        policyVersion: 2,
        Inventory_User: [
          { userId: 'u1', sequence: 0, responsibility: 'PRIMARY_COUNTER_1' },
          { userId: 'u2', sequence: 1, responsibility: 'PRIMARY_COUNTER_2' },
          { userId: 'u3', sequence: 2, responsibility: 'FINAL_CONTROLLER' }
        ],
        equipmentScopeIds: JSON.stringify(['eq-1'])
      });

      txMock.inventoryWorkUnit.create.mockResolvedValue({ unitId: 'unit-1' });
      txMock.equipmentShelfs.findMany.mockResolvedValue([
        { equipmentId: 'eq-1', shelfId: 'shelf-1', equipmentQuantity: 10 }
      ]);

      await inventoryService.launchInventory('inv-1');

      expect(txMock.inventory.update).toHaveBeenCalledWith({
        where: { inventoryId: 'inv-1' },
        data: expect.objectContaining({ status: 'IN_PROGRESS' })
      });
      expect(txMock.inventoryWorkUnit.create).toHaveBeenCalled();
      expect(txMock.inventory_Equipment_Shelf_Snapshot.createMany).toHaveBeenCalled();
      
      // Controller 1 gets attempt available
      expect(txMock.inventoryCountAttempt.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          unitId: 'unit-1',
          assignedUserId: 'u1',
          sequence: 0,
          purpose: 'PRIMARY_1',
          status: 'AVAILABLE'
        })
      });
      // Controller 2 gets attempt blocked
      expect(txMock.inventoryCountAttempt.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          unitId: 'unit-1',
          assignedUserId: 'u2',
          sequence: 1,
          purpose: 'PRIMARY_2',
          status: 'BLOCKED'
        })
      });
      // Controller 3 does NOT get an attempt at launch (only created dynamically if C1 and C2 mismatch)
      expect(txMock.inventoryCountAttempt.create).not.toHaveBeenCalledWith({
        data: expect.objectContaining({
          assignedUserId: 'u3',
          purpose: 'FINAL_RECOUNT',
        }),
      });
    });
  });

  describe('deleteInventory', () => {
    it('throws NotFoundException if inventory does not exist', async () => {
      prismaMock.inventory.findUnique.mockResolvedValue(null);

      await expect(inventoryService.deleteInventory('non-existent')).rejects.toThrow(NotFoundException);
    });

    it('cascades deletion across orders, attempts, work units, snapshots, issues, users and inventory', async () => {
      prismaMock.inventory.findUnique.mockResolvedValue({
        inventoryId: 'inv-to-delete',
        status: 'DRAFT',
      });
      txMock.inventoryWorkUnit.findMany.mockResolvedValue([{ unitId: 'unit-1' }]);
      txMock.inventoryCountAttempt.findMany.mockResolvedValue([{ attemptId: 'att-1' }]);
      txMock.inventory.delete.mockResolvedValue({ inventoryId: 'inv-to-delete' });

      const result = await inventoryService.deleteInventory('inv-to-delete');

      expect(result.success).toBe(true);
      expect(txMock.order.deleteMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { inventoryId: 'inv-to-delete' },
            { attemptId: { in: ['att-1'] } },
          ],
        },
      });
      expect(txMock.inventoryCountAttempt.deleteMany).toHaveBeenCalledWith({ where: { unitId: { in: ['unit-1'] } } });
      expect(txMock.inventoryWorkUnit.deleteMany).toHaveBeenCalledWith({ where: { inventoryId: 'inv-to-delete' } });
      expect(txMock.inventory_User.deleteMany).toHaveBeenCalledWith({ where: { inventoryId: 'inv-to-delete' } });
      expect(txMock.inventory.delete).toHaveBeenCalledWith({ where: { inventoryId: 'inv-to-delete' } });
    });

    it('allows deleting a FINALIZED inventory', async () => {
      prismaMock.inventory.findUnique.mockResolvedValue({
        inventoryId: 'inv-finalized',
        status: 'FINALIZED',
      });
      txMock.inventoryWorkUnit.findMany.mockResolvedValue([]);
      txMock.inventory.delete.mockResolvedValue({ inventoryId: 'inv-finalized' });

      const result = await inventoryService.deleteInventory('inv-finalized');

      expect(result.success).toBe(true);
      expect(txMock.inventory.delete).toHaveBeenCalledWith({ where: { inventoryId: 'inv-finalized' } });
    });
  });

  describe('Legacy Endpoint Protection in V2', () => {
    it('rejects assignThirdUser on V2 inventories because third controller is preassigned', async () => {
      txMock.inventory.findUnique.mockResolvedValue({
        inventoryId: 'inv-1',
        policyVersion: 2,
      });

      await expect(
        inventoryService.assignThirdUser('inv-1', 'unit-1', 'u3', 'admin-id'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects per-unit manualAdjudicate on V2 inventories because third controller recounts fully', async () => {
      txMock.inventoryWorkUnit.findUnique.mockResolvedValue({
        unitId: 'unit-1',
        inventory: { policyVersion: 2 },
      });

      await expect(
        inventoryService.manualAdjudicate('unit-1', 'u1', { quantity: 15 } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
