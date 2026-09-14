import { describe, expect, it, vi } from 'vitest';
import { InventoryService } from './inventory.service.js';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('InventoryService - ByEquipment', () => {
    it('throws NotFoundException for unknown inventoryType', async () => {
        const prisma = {
            inventory: {
                findFirst: vi.fn().mockResolvedValue(null),
            },
        };
        const service = new InventoryService(prisma as any);

        await expect(
            service.createInventory({
                typeInventory: 'UnknownType',
                equipments: [],
                shelfs: [],
                serialNumbers: [],
            })
        ).rejects.toThrow(NotFoundException);
    });

    it('creates an inventory, checks serial numbers and validates shelves', async () => {
        const tx = {
            shelf: {
                findMany: vi.fn().mockResolvedValue([
                    { shelfId: 'shelf-1', shelfName: 'Shelf-A' },
                ]),
            },
            inventory: {
                create: vi.fn().mockResolvedValue({
                    inventoryId: 'inv-123',
                    typeInventory: 'ByEquipment',
                    createdAt: new Date('2026-09-14T10:00:00Z'),
                }),
            },
            serialNumber: {
                findMany: vi.fn().mockResolvedValue([
                    {
                        serialNumberId: 'sn-1',
                        serialNumberCode: 'SN-001',
                        shelfId: 'shelf-1',
                        shelf: { shelfId: 'shelf-1', shelfName: 'Shelf-A' },
                        equipment: { equipmentName: 'Device 1' },
                    },
                ]),
            },
            inventory_SerialNumber: {
                createMany: vi.fn().mockResolvedValue({ count: 1 }),
            },
            equipment: {
                findMany: vi.fn().mockResolvedValue([]),
            },
            inventory_Equipment: {
                create: vi.fn(),
            },
        };

        const prisma = {
            $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
        };

        const service = new InventoryService(prisma as any);

        const result = await service.createInventory({
            typeInventory: 'ByEquipment',
            shelfs: ['Shelf-A'],
            serialNumbers: ['SN-001'],
            equipments: [],
        });

        expect(result.inventoryId).toBe('inv-123');
        expect(result.typeInventory).toBe('ByEquipment');
        expect(tx.inventory.create).toHaveBeenCalled();
        expect(tx.inventory_SerialNumber.createMany).toHaveBeenCalledWith({
            data: [{ inventoryId: 'inv-123', serialNumberId: 'sn-1' }],
        });
    });

    it('throws BadRequestException if serial number is on the wrong shelf', async () => {
        const tx = {
            shelf: {
                findMany: vi.fn().mockResolvedValue([
                    { shelfId: 'shelf-1', shelfName: 'Shelf-A' },
                ]),
            },
            inventory: {
                create: vi.fn().mockResolvedValue({
                    inventoryId: 'inv-123',
                    typeInventory: 'ByEquipment',
                }),
            },
            serialNumber: {
                findMany: vi.fn().mockResolvedValue([
                    {
                        serialNumberId: 'sn-2',
                        serialNumberCode: 'SN-002',
                        shelfId: 'shelf-2',
                        shelf: { shelfId: 'shelf-2', shelfName: 'Shelf-B' },
                        equipment: { equipmentName: 'Device 2' },
                    },
                ]),
            },
        };

        const prisma = {
            $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
        };

        const service = new InventoryService(prisma as any);

        await expect(
            service.createInventory({
                typeInventory: 'ByEquipment',
                shelfs: ['Shelf-A'],
                serialNumbers: ['SN-002'],
                equipments: [],
            })
        ).rejects.toThrow(BadRequestException);
    });

    it('creates inventory for equipment and links to Inventory_Equipment', async () => {
        const tx = {
            shelf: {
                findMany: vi.fn().mockResolvedValue([
                    { shelfId: 'shelf-1', shelfName: 'Shelf-A' },
                ]),
            },
            inventory: {
                create: vi.fn().mockResolvedValue({
                    inventoryId: 'inv-456',
                    typeInventory: 'ByEquipment',
                    createdAt: new Date('2026-09-14T10:00:00Z'),
                }),
            },
            serialNumber: {
                findMany: vi.fn().mockResolvedValue([]),
            },
            equipment: {
                findMany: vi.fn().mockResolvedValue([
                    {
                        equipmentId: 'eq-1',
                        equipmentName: 'Tool Box',
                        hasSerialNumber: false,
                        equipmentShelfs: [
                            {
                                shelfId: 'shelf-1',
                                equipmentQuantity: 5,
                                shelf: { shelfId: 'shelf-1', shelfName: 'Shelf-A' },
                            },
                        ],
                    },
                ]),
            },
            inventory_Equipment: {
                create: vi.fn().mockResolvedValue({}),
            },
        };

        const prisma = {
            $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
        };

        const service = new InventoryService(prisma as any);

        const result = await service.createInventory({
            typeInventory: 'ByEquipment',
            shelfs: ['Shelf-A'],
            equipments: ['Tool Box'],
            amount: 5,
            serialNumbers: [],
        });

        expect(result.inventoryId).toBe('inv-456');
        expect(tx.inventory_Equipment.create).toHaveBeenCalledWith({
            data: {
                inventoryId: 'inv-456',
                equipmentId: 'eq-1',
                countedQuantity: 5,
            },
        });
    });
});
