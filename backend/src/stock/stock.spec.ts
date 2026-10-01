import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';

import { StockService } from './stock.service.js';

describe('StockService', () => {
  let service: StockService;
  let prisma: any;

  const stockId =
    'b0000000-0000-4000-8000-000000000001';

  const activeStatusId =
    'c0000000-0000-4000-8000-000000000001';

  const inactiveStatusId =
    'd0000000-0000-4000-8000-000000000002';

  beforeEach(() => {
    prisma = {
      $transaction: vi.fn().mockImplementation(async (cb) => cb(prisma)),
      shelf: { updateMany: vi.fn() },
    stock: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
      },

      stockStatus: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
      },
    };

    service =
      new StockService(prisma);
  });

  it('creates a stock with ACTIVE status by default', async () => {
    prisma.stock.findFirst
      .mockResolvedValue(null);

    prisma.stockStatus.findUnique
      .mockResolvedValue({
        status: undefined,
        stockStatusName: 'ACTIVE',
      });

    prisma.stock.create
      .mockResolvedValue({
        stockId,
        stockName: 'Stock Principal',
        status: undefined,
        stockStatus: {
          status: undefined,
          stockStatusName: 'ACTIVE',
        },
        _count: {
          shelves: 0,
        },
      });

    await service.createStock({
      stockName: 'Stock Principal',
    });



    expect(
      prisma.stock.create,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          stockName: 'Stock Principal',
          status: undefined,
        },
      }),
    );
  });

  it('rejects a duplicate stock name', async () => {
    prisma.stock.findFirst
      .mockResolvedValue({
        stockId,
      });

    await expect(
      service.createStock({
        stockName: 'Stock Principal',
      }),
    ).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('updates stock status to INACTIVE', async () => {
    prisma.stock.findUnique
      .mockResolvedValue({
        stockId,
        stockName: 'Stock Principal',
        status: undefined,
        stockStatus: {
          stockStatusName: 'ACTIVE',
        },
        _count: {
          shelves: 2,
        },
      });

    prisma.stockStatus.findUnique
      .mockResolvedValue({
        status: false,
        stockStatusName: 'INACTIVE',
      });

    prisma.stock.update
      .mockResolvedValue({
        stockId,
        stockName: 'Stock Principal',
        status: false,
      });

    await service.updateStock(
      {
        stockStatus: false,
      },
      stockId,
    );

    expect(
      prisma.stock.update,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          stockId,
        },
        data: {
          status: false,
        },
      }),
    );
  });

  it('throws when stock does not exist', async () => {
    prisma.stock.findUnique
      .mockResolvedValue(null);

    await expect(
      service.getStockById(stockId),
    ).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
