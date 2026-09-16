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
      },
      inventory_User: {
        createMany: vi.fn(),
      },

      inventoryWorkUnit: {
        create: vi.fn(),
      },
      inventory_Equipment_Shelf_Snapshot: {
        createMany: vi.fn(),
      },
      inventoryCountAttempt: {
        createMany: vi.fn(),
        findMany: vi.fn(),
      },
      equipmentShelfs: {
        findMany: vi.fn(),
      }
    };

    prismaMock = {
      $transaction: vi.fn(async (cb) => cb(txMock)),
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
  });
});
