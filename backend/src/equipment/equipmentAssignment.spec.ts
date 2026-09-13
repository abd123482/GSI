import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EquipmentService } from './equipment.service.js';
import { SerialNumberService } from '../serial-numbers/serialNumber.service.js';

describe('Equipment & Serial Number Controllers - Decoupled from Shelf', () => {
  let equipmentService: EquipmentService;
  let serialNumberService: SerialNumberService;
  let mockPrisma: any;

  const validUuid1 = 'a0000000-0000-4000-8000-000000000001';

  beforeEach(() => {
    mockPrisma = {
      equipment: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        findUniqueOrThrow: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        count: vi.fn(),
      },
      shelf: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        update: vi.fn(),
      },
      equipmentShelfs: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        deleteMany: vi.fn(),
      },
      serialNumber: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        createMany: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        count: vi.fn(),
      },
      $transaction: vi.fn((cb) => cb(mockPrisma)),
    };

    equipmentService = new EquipmentService(mockPrisma);
    serialNumberService = new SerialNumberService(mockPrisma);
  });

  it('1. should create standard equipment directly without any shelf assignment', async () => {
    mockPrisma.equipment.findFirst.mockResolvedValue(null);
    mockPrisma.equipment.create.mockResolvedValue({
      equipmentId: validUuid1,
      equipmentName: 'Oscilloscope Pro',
      hasSerialNumber: false,
      equipmentQuantity: 10,
      minequipmentQuantity: 2,
      equipmentShelfs: [],
      serialNumbers: [],
    });

    const result = await equipmentService.createEquipment({
      equipmentName: 'Oscilloscope Pro',
      hasSerialNumber: false,
      equipmentQuantity: 10,
      minEquipmentQuantity: 2,
    });

    expect(result.equipmentId).toBe(validUuid1);
    expect(result.equipmentQuantity).toBe(10);
    expect(mockPrisma.equipment.create).toHaveBeenCalled();
    expect(mockPrisma.shelf.update).not.toHaveBeenCalled();
    expect(mockPrisma.equipmentShelfs.create).not.toHaveBeenCalled();
  });

  it('2. should create batch serial numbers strictly with shelfId null', async () => {
    mockPrisma.equipment.findUnique.mockResolvedValue({
      equipmentId: validUuid1,
      hasSerialNumber: true,
      equipmentQuantity: 0,
    });
    mockPrisma.serialNumber.findMany.mockResolvedValue([]); // No duplicates

    const result = await serialNumberService.createBatchSerialNumbers({
      equipmentId: validUuid1,
      serialNumberCodes: ['SN-BATCH-01', 'SN-BATCH-02', 'SN-BATCH-03'],
    });

    expect(result.count).toBe(3);
    expect(result.shelfId).toBeNull();
    expect(mockPrisma.serialNumber.createMany).toHaveBeenCalledWith({
      data: [
        { serialNumberCode: 'SN-BATCH-01', equipmentId: validUuid1, shelfId: null, serialNumberStatus: 'AVAILABLE' },
        { serialNumberCode: 'SN-BATCH-02', equipmentId: validUuid1, shelfId: null, serialNumberStatus: 'AVAILABLE' },
        { serialNumberCode: 'SN-BATCH-03', equipmentId: validUuid1, shelfId: null, serialNumberStatus: 'AVAILABLE' },
      ],
    });
    expect(mockPrisma.shelf.update).not.toHaveBeenCalled();
  });

  it('3. should create single serial number strictly with shelfId null', async () => {
    mockPrisma.equipment.findUnique.mockResolvedValue({
      equipmentId: validUuid1,
      hasSerialNumber: true,
    });
    mockPrisma.serialNumber.findFirst.mockResolvedValue(null);
    mockPrisma.serialNumber.create.mockResolvedValue({
      serialNumberId: 'sn-1',
      serialNumberCode: 'SN-SINGLE-01',
      equipmentId: validUuid1,
      shelfId: null,
      serialNumberStatus: 'AVAILABLE',
    });

    const result = await serialNumberService.createSerialNumber({
      equipmentId: validUuid1,
      serialNumberCode: 'SN-SINGLE-01',
    });

    expect(result.shelfId).toBeNull();
    expect(mockPrisma.serialNumber.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          serialNumberCode: 'SN-SINGLE-01',
          equipmentId: validUuid1,
          shelfId: null,
          serialNumberStatus: 'AVAILABLE',
        },
      }),
    );
    expect(mockPrisma.shelf.update).not.toHaveBeenCalled();
  });
});
