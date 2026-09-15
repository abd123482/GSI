import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OrdersService } from './orders.service.js';
import { NotFoundException } from '@nestjs/common';

describe('OrdersService Unit Tests', () => {
  let service: OrdersService;
  let mockPrisma: any;

  const validOrderId = 'a0000000-0000-4000-8000-000000000001';
  const validInventoryId = 'b0000000-0000-4000-8000-000000000001';
  const validEquipmentId = 'c0000000-0000-4000-8000-000000000001';

  beforeEach(() => {
    mockPrisma = {
      order: {
        create: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
      },
    };
    service = new OrdersService(mockPrisma);
  });

  describe('createOrder', () => {
    it('should create an order with foreign keys and quantityCalculated', async () => {
      const dto = {
        inventoryId: validInventoryId,
        equipmentId: validEquipmentId,
        quantityCalculated: 15,
      };

      const expectedOrder = {
        orderId: validOrderId,
        ...dto,
        serialNumberId: null,
        shelfId: null,
        roleId: null,
        userId: null,
        createdAt: new Date(),
      };

      mockPrisma.order.create.mockResolvedValue(expectedOrder);

      const result = await service.createOrder(dto);
      expect(mockPrisma.order.create).toHaveBeenCalledWith({
        data: {
          inventoryId: validInventoryId,
          serialNumberId: null,
          equipmentId: validEquipmentId,
          shelfId: null,
          roleId: null,
          userId: null,
          quantityCalculated: 15,
        },
        include: {
          inventory: true,
          serialNumber: true,
          equipment: true,
          shelf: true,
          role: true,
          user: true,
        },
      });
      expect(result.orderId).toBe(validOrderId);
      expect(result.quantityCalculated).toBe(15);
    });
  });

  describe('getAllOrders', () => {
    it('should return all orders with relations included', async () => {
      mockPrisma.order.findMany.mockResolvedValue([
        { orderId: validOrderId, quantityCalculated: 5 },
      ]);

      const result = await service.getAllOrders();
      expect(result).toHaveLength(1);
      expect(mockPrisma.order.findMany).toHaveBeenCalled();
    });
  });

  describe('getOrderById', () => {
    it('should return order if found', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        orderId: validOrderId,
        quantityCalculated: 20,
      });

      const result = await service.getOrderById(validOrderId);
      expect(result.orderId).toBe(validOrderId);
    });

    it('should throw NotFoundException if order does not exist', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(null);

      await expect(service.getOrderById('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
