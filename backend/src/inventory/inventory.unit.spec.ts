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
        create: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
        deleteMany: vi.fn(),
      },
      inventory_Equipment_Shelf_Snapshot: {
        createMany: vi.fn(),
        deleteMany: vi.fn(),
      },
      inventoryCountAttempt: {
        create: vi.fn(),
        createMany: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        deleteMany: vi.fn(),
      },
      order: {
        deleteMany: vi.fn(),
      },
      equipmentShelfs: {
        findMany: vi.fn(),
      },
      equipment: {
        findUnique: vi.fn(),
      },
      notification: {
        create: vi.fn(),
      },
    };


    prismaMock = {
      $transaction: vi.fn(async (cb) => cb(txMock)),
      inventory: {
        findUnique: vi.fn(),
      },
      inventoryCountAttempt: txMock.inventoryCountAttempt,
    };

    inventoryService = new InventoryService(prismaMock);
  });

  describe('createInventory', () => {
    it('creates an inventory draft with users and equipment scope', async () => {
      txMock.inventory.create.mockResolvedValue({ inventoryId: 'inv-1', status: 'DRAFT' });

      const result = await inventoryService.createInventory({
        title: 'Annual Count',
        typeInventory: 'ByEquipment',
        users: [
          { userId: 'u1', responsibility: 'COUNT' },
          { userId: 'u2', responsibility: 'ADJUDICATE' }
        ],
        equipmentIds: ['eq-1', 'eq-2']
      }, 'creator');

      expect(result.inventoryId).toBe('inv-1');
      expect(txMock.inventory.create).toHaveBeenCalled();
      expect(txMock.inventory_User.createMany).toHaveBeenCalledWith({
        data: [
          { inventoryId: 'inv-1', userId: 'u1', sequence: 0, responsibility: 'COUNT' },
          { inventoryId: 'inv-1', userId: 'u2', sequence: 1, responsibility: 'ADJUDICATE' }
        ]
      });
      expect(txMock.inventory.update).toHaveBeenCalledWith({
        where: { inventoryId: 'inv-1' },
        data: { equipmentScopeIds: JSON.stringify(['eq-1', 'eq-2']) }
      });
    });

    it('throws if fewer than 2 users are provided', async () => {
      await expect(inventoryService.createInventory({
        title: 'Solo Count',
        typeInventory: 'ByEquipment',
        users: [{ userId: 'u1', responsibility: 'COUNT' }],
      } as any, 'creator')).rejects.toThrow(BadRequestException);
    });

    it('throws if users are duplicate', async () => {
      await expect(inventoryService.createInventory({
        title: 'Duplicate Count',
        typeInventory: 'ByEquipment',
        users: [
          { userId: 'u1', responsibility: 'COUNT' },
          { userId: 'u1', responsibility: 'COUNT' }
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

    it('throws if inventory has fewer than 2 participants', async () => {
      txMock.inventory.findUnique.mockResolvedValue({
        inventoryId: 'inv-1',
        status: 'DRAFT',
        Inventory_User: [{ userId: 'u1', sequence: 0, responsibility: 'COUNT' }]
      });

      await expect(inventoryService.launchInventory('inv-1')).rejects.toThrow(BadRequestException);
    });

    it('launches inventory and generates work units and snapshots', async () => {
      txMock.inventory.findUnique.mockResolvedValue({
        inventoryId: 'inv-1',
        status: 'DRAFT',
        typeInventory: 'ByEquipment',
        Inventory_User: [
          { userId: 'u1', sequence: 0, responsibility: 'COUNT' },
          { userId: 'u2', sequence: 1, responsibility: 'ADJUDICATE' }
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
        data: { status: 'IN_PROGRESS' }
      });
      expect(txMock.inventoryWorkUnit.create).toHaveBeenCalled();
      expect(txMock.inventory_Equipment_Shelf_Snapshot.createMany).toHaveBeenCalled();
      expect(txMock.inventoryCountAttempt.createMany).toHaveBeenCalledWith({
        data: [
          {
            unitId: 'unit-1',
            assignedUserId: 'u1',
            sequence: 0,
            purpose: 'INITIAL',
            status: 'AVAILABLE'
          }
        ]
      });
    });

    it('launches inventory with 2 counters and generates initial attempts for both', async () => {
      txMock.inventory.findUnique.mockResolvedValue({
        inventoryId: 'inv-2',
        status: 'DRAFT',
        typeInventory: 'ByEquipment',
        Inventory_User: [
          { userId: 'u1', sequence: 0, responsibility: 'COUNT' },
          { userId: 'u2', sequence: 0, responsibility: 'COUNT' }
        ],
        equipmentScopeIds: JSON.stringify(['eq-1'])
      });

      txMock.inventoryWorkUnit.create.mockResolvedValue({ unitId: 'unit-2' });
      txMock.equipmentShelfs.findMany.mockResolvedValue([
        { equipmentId: 'eq-1', shelfId: 'shelf-1', equipmentQuantity: 5 }
      ]);

      await inventoryService.launchInventory('inv-2');

      expect(txMock.inventoryCountAttempt.createMany).toHaveBeenCalledWith({
        data: [
          {
            unitId: 'unit-2',
            assignedUserId: 'u1',
            sequence: 0,
            purpose: 'INITIAL',
            status: 'AVAILABLE'
          },
          {
            unitId: 'unit-2',
            assignedUserId: 'u2',
            sequence: 0,
            purpose: 'INITIAL',
            status: 'BLOCKED'
          }
        ]
      });
    });
  });

  describe('deleteInventory', () => {
    it('throws NotFoundException if inventory does not exist', async () => {
      prismaMock.inventory.findUnique.mockResolvedValue(null);

      await expect(inventoryService.deleteInventory('non-existent')).rejects.toThrow(NotFoundException);
    });

    it('cascades deletion across orders, attempts, work units, snapshots, users and unlinks children', async () => {
      prismaMock.inventory.findUnique.mockResolvedValue({
        inventoryId: 'inv-to-delete',
        workUnits: [
          {
            unitId: 'unit-1',
            attempts: [{ attemptId: 'att-1' }, { attemptId: 'att-2' }],
          },
        ],
      });
      txMock.inventory.delete.mockResolvedValue({ inventoryId: 'inv-to-delete' });

      const result = await inventoryService.deleteInventory('inv-to-delete');

      expect(result.success).toBe(true);
      expect(result.inventoryId).toBe('inv-to-delete');

      // 1. Orders deleted
      expect(txMock.order.deleteMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { inventoryId: 'inv-to-delete' },
            { attemptId: { in: ['att-1', 'att-2'] } },
          ],
        },
      });

      // 2. Count attempts deleted
      expect(txMock.inventoryCountAttempt.deleteMany).toHaveBeenCalledWith({
        where: {
          unitId: { in: ['unit-1'] },
        },
      });

      // 3. Work units deleted
      expect(txMock.inventoryWorkUnit.deleteMany).toHaveBeenCalledWith({
        where: {
          inventoryId: 'inv-to-delete',
        },
      });

      // 4. Snapshots deleted
      expect(txMock.inventory_Equipment_Shelf_Snapshot.deleteMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { inventoryId: 'inv-to-delete' },
            { sourceInventoryId: 'inv-to-delete' },
          ],
        },
      });

      // 5. User assignments deleted
      expect(txMock.inventory_User.deleteMany).toHaveBeenCalledWith({
        where: {
          inventoryId: 'inv-to-delete',
        },
      });

      // 6. Sub-inventories unlinked
      expect(txMock.inventory.updateMany).toHaveBeenCalledWith({
        where: {
          parentInventoryId: 'inv-to-delete',
        },
        data: {
          parentInventoryId: null,
        },
      });

      // 7. Inventory deleted
      expect(txMock.inventory.delete).toHaveBeenCalledWith({
        where: {
          inventoryId: 'inv-to-delete',
        },
      });
    });
  });

  describe('3rd User Enforcement on Discrepancies', () => {
    it('throws BadRequestException if the designated 3rd user is one of the initial counters', async () => {
      txMock.inventory.findUnique.mockResolvedValue({
        inventoryId: 'inv-1',
        status: 'IN_PROGRESS',
        Inventory_User: [
          { userId: 'u1', sequence: 0, responsibility: 'COUNT' },
          { userId: 'u2', sequence: 0, responsibility: 'COUNT' },
        ],
      });
      txMock.inventoryWorkUnit.findFirst.mockResolvedValue({
        unitId: 'unit-1',
        inventoryId: 'inv-1',
        attempts: [
          { assignedUserId: 'u1', sequence: 0, status: 'SUBMITTED' },
          { assignedUserId: 'u2', sequence: 0, status: 'SUBMITTED' },
        ],
      });

      await expect(
        inventoryService.assignThirdUser('inv-1', 'unit-1', 'u1', 'admin-id'),
      ).rejects.toThrow(BadRequestException);
    });

    it('successfully assigns a distinct 3rd user, creates adjudication attempt, and sends notification', async () => {
      txMock.inventory.findUnique.mockResolvedValue({
        inventoryId: 'inv-1',
        title: 'Inventaire Test',
        status: 'IN_PROGRESS',
        Inventory_User: [
          { userId: 'u1', sequence: 0, responsibility: 'COUNT' },
          { userId: 'u2', sequence: 0, responsibility: 'COUNT' },
        ],
      });
      txMock.inventoryWorkUnit.findFirst.mockResolvedValue({
        unitId: 'unit-1',
        inventoryId: 'inv-1',
        equipmentId: 'eq-1',
        attempts: [
          { assignedUserId: 'u1', sequence: 0, status: 'SUBMITTED' },
          { assignedUserId: 'u2', sequence: 0, status: 'SUBMITTED' },
        ],
      });
      txMock.inventoryCountAttempt.create.mockResolvedValue({
        attemptId: 'att-3',
        assignedUserId: 'u3',
      });
      txMock.inventoryWorkUnit.update.mockResolvedValue({});
      txMock.equipment.findUnique.mockResolvedValue({ equipmentName: 'Scanner IR' });
      txMock.notification.create.mockResolvedValue({});

      const result = await inventoryService.assignThirdUser('inv-1', 'unit-1', 'u3', 'admin-id');

      expect(result.success).toBe(true);
      expect(result.thirdUserId).toBe('u3');
      expect(result.attemptId).toBe('att-3');

      // Verify notification sent
      expect(txMock.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          recipientId: 'u3',
          eventType: 'INVENTORY_ADJUDICATION_ASSIGNED',
        }),
      });

      // Verify work unit status updated to IN_PROGRESS
      expect(txMock.inventoryWorkUnit.update).toHaveBeenCalledWith({
        where: { unitId: 'unit-1' },
        data: expect.objectContaining({
          status: 'IN_PROGRESS',
          discrepancyActorId: 'u3',
        }),
      });
    });

    it('forbids initial counters from manually arbitrating their own dispute', async () => {
      txMock.inventoryWorkUnit.findUnique.mockResolvedValue({
        unitId: 'unit-1',
        inventoryId: 'inv-1',
        discrepancyState: 'UNRESOLVED',
        attempts: [
          { assignedUserId: 'u1', sequence: 0, status: 'SUBMITTED' },
          { assignedUserId: 'u2', sequence: 0, status: 'SUBMITTED' },
        ],
        inventory: { Inventory_User: [] },
      });

      await expect(
        inventoryService.manualAdjudicate('unit-1', 'u1', { quantity: 15 }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});


