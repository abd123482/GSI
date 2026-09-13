import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StockService } from './stock.service.js';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('StockService Unit Tests', () => {
  let service: StockService;
  let mockPrisma: any;

  const validStockId = 'b0000000-0000-4000-8000-000000000001';
  const activeStatusId = 'c0000000-0000-4000-8000-000000000001';

  beforeEach(() => {
    mockPrisma = {
      stock: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
      },
      stockStatus: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
    };

    service = new StockService(mockPrisma);
  });

  describe('createStock', () => {
    it('should create a new stock with validated name (5-50 chars) and default ACTIVE status', async () => {
      mockPrisma.stock.findFirst.mockResolvedValue(null);
      mockPrisma.stockStatus.findFirst.mockResolvedValue({
        stockStatusId: activeStatusId,
        stockStatusName: 'ACTIVE',
      });
      mockPrisma.stock.create.mockResolvedValue({
        stockId: validStockId,
        stockName: 'Stock Central Alger',
        stockStatusId: activeStatusId,
        stockStatus: { stockStatusId: activeStatusId, stockStatusName: 'ACTIVE' },
        _count: { shelves: 0 },
      });

      const result = await service.createStock({
        stockName: 'Stock Central Alger',
      });

      expect(result).toBeDefined();
      expect(result.stockName).toBe('Stock Central Alger');
      expect(mockPrisma.stock.create).toHaveBeenCalledWith({
        data: {
          stockName: 'Stock Central Alger',
          stockStatusId: activeStatusId,
        },
        include: {
          stockStatus: true,
          _count: { select: { shelves: true } },
        },
      });
    });

    it('should reject stock names shorter than 5 characters', async () => {
      await expect(
        service.createStock({ stockName: 'ABC' }),
      ).rejects.toThrow();
    });

    it('should reject duplicate stock name with BadRequestException', async () => {
      mockPrisma.stock.findFirst.mockResolvedValue({ stockId: validStockId, stockName: 'Stock Central Alger' });

      await expect(
        service.createStock({ stockName: 'Stock Central Alger' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateStock', () => {
    it('should update stock name and status when valid', async () => {
      mockPrisma.stock.findUnique.mockResolvedValue({
        stockId: validStockId,
        stockName: 'Stock Central Alger',
        stockStatusId: activeStatusId,
      });
      mockPrisma.stock.findFirst.mockResolvedValue(null); // name not taken
      mockPrisma.stockStatus.findFirst.mockResolvedValue({
        stockStatusId: 'd0000000-0000-4000-8000-000000000002',
        stockStatusName: 'INACTIVE',
      });
      mockPrisma.stock.update.mockResolvedValue({
        stockId: validStockId,
        stockName: 'Stock Secondaire Oran',
        stockStatusId: 'd0000000-0000-4000-8000-000000000002',
      });

      const result = await service.updateStock(
        { stockName: 'Stock Secondaire Oran', stockStatus: 'INACTIVE' },
        validStockId,
      );

      expect(result.stockName).toBe('Stock Secondaire Oran');
      expect(mockPrisma.stock.update).toHaveBeenCalled();
    });

    it('should throw NotFoundException if stock does not exist', async () => {
      mockPrisma.stock.findUnique.mockResolvedValue(null);

      await expect(
        service.updateStock({ stockName: 'Stock Inexistant' }, validStockId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getStockById', () => {
    it('should return stock with attached shelves', async () => {
      mockPrisma.stock.findUnique.mockResolvedValue({
        stockId: validStockId,
        stockName: 'Stock Principal Yacine',
        shelves: [{ shelfId: 's1', shelfName: 'Rayon 1' }],
        _count: { shelves: 1 },
      });

      const result = await service.getStockById(validStockId);
      expect(result.stockName).toBe('Stock Principal Yacine');
      expect(result.shelves.length).toBe(1);
    });

    it('should throw NotFoundException if stock does not exist', async () => {
      mockPrisma.stock.findUnique.mockResolvedValue(null);

      await expect(
        service.getStockById('00000000-0000-0000-0000-000000000000'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('searchStocks', () => {
    it('should filter stocks by name with pagination', async () => {
      mockPrisma.stock.findMany.mockResolvedValue([
        { stockId: validStockId, stockName: 'Stock Principal Yacine' },
      ]);
      mockPrisma.stock.count.mockResolvedValue(1);

      const result = await service.searchStocks(
        { stockName: 'Principal' },
        { page: 1, limit: 10 },
      );

      expect(result.stocks.length).toBe(1);
      expect(result.totalStocks).toBe(1);
      expect(result.currentPage).toBe(1);
    });
  });
});
