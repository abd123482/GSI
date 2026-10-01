import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

import {
  type CreateStockDTO,
  createStockSchema,
  type UpdateStockDTO,
  updateStockSchema,
  type SearchStockDTO,
  searchStockSchema,
  type PaginationDTO,
  paginationSchema,
} from './dto/index.js';

type AllowedStockStatus = 1 | 0

@Injectable()
export class StockService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

// check if stock name is already exist
  private async assertStockNameAvailable(
    stockName: string,
    excludeStockId?: string,
  ): Promise<void> {
    const existing = await this.prisma.stock.findFirst({
      where: {
        stockName,
        ...(excludeStockId
          ? {
              stockId: {
                not: excludeStockId,
              },
            }
          : {}),
      },
      select: {
        stockId: true,
      },
    });

    if (existing) {
      throw new BadRequestException(
        `Stock '${stockName}' already exists`,
      );
    }
  }

  private async getStockOrThrow(
    stockId: string,
  ) {
    const stock =
      await this.prisma.stock.findUnique({
        where: {
          stockId,
        },
        include: {
          
          stockName:true,
          _count: {
            select: {
              shelves: true,
            },
          },
        },
      });

    if (!stock) {
      throw new NotFoundException(
        `Stock with ID '${stockId}' not found`,
      );
    }

    return stock;
  }

  async createStock(
    dto: CreateStockDTO,
  ) {
    const validated =
      createStockSchema.parse(dto);

    await this.assertStockNameAvailable(
      validated.stockName,
    );


    return this.prisma.stock.create({
      data: {
        stockName: validated.stockName,
        status: dto.stockStatus,
      },
      include: {
        
        _count: {
          select: {
            shelves: true,
          },
        },
      },
    });
  }

  async updateStock(
    dto: UpdateStockDTO,
    id: string,
  ) {
    const stockId = id?.trim();

    if (!stockId) {
      throw new BadRequestException(
        'Stock ID is required',
      );
    }

    const validated =
      updateStockSchema.parse(dto);

    const existingStock =
      await this.getStockOrThrow(
        stockId,
      );

    if (
      validated.stockName !== undefined &&
      validated.stockName !==
        existingStock.stockName
    ) {
      await this.assertStockNameAvailable(
        validated.stockName,
        stockId,
      );
    }

return this.prisma.$transaction(async (tx) => {
  const updatedStock = await tx.stock.update({
    where: { stockId },

    data: {
      ...(validated.stockName !== undefined && {
        stockName: validated.stockName,
      }),

      ...(validated.stockStatus !== undefined && {
        status: validated.stockStatus,
      }),
    },

    include: {
      _count: {
        select: {
          shelves: true,
        },
      },
    },
  });

  // If the stock becomes INACTIVE,
  // automatically deactivate all shelves inside it.
  if (validated.stockStatus === false) {
    await tx.shelf.updateMany({
      where: {
        stockId,
      },
      data: {
        status: false,
      },
    });
  }

  return updatedStock;
});
}

  async getStockById(
    id: string,
  ) {
    const stockId = id?.trim();

    if (!stockId) {
      throw new BadRequestException(
        'Stock ID is required',
      );
    }

    const stock =
      await this.prisma.stock.findUnique({
        where: {
          stockId,
        },
        include: {
          
          shelves: {
            take: 100,
            orderBy: [
              {
                shelfName: 'asc',
              },
              {
                shelfId: 'asc',
              },
            ],
            select: {
              shelfId: true,
              shelfName: true,
              shelfQuantity: true,
              stockId: true,
            },
          },
          _count: {
            select: {
              shelves: true,
            },
          },
        },
      });

    if (!stock) {
      throw new NotFoundException(
        `Stock with ID '${stockId}' not found`,
      );
    }

    return stock;
  }

  async searchStocks(
    searchStockDTO: SearchStockDTO,
    pagination: PaginationDTO,
  ) {
    const validatedSearch =
      searchStockSchema.parse(
        searchStockDTO ?? {},
      );

    const {
      page,
      limit,
    } = paginationSchema.parse(
      pagination ?? {},
    );

    const skip = (page - 1) * limit;

    const where:
      any = {};

    if (validatedSearch.stockName) {
      where.stockName = {
        contains:
          validatedSearch.stockName,
      };
    }

if (validatedSearch.stockStatus !== undefined) {
  where.status = validatedSearch.stockStatus;
}

    const [
      stocks,
      totalStocks,
    ] = await Promise.all([
      this.prisma.stock.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          {
            stockName: 'asc',
          },
          {
            stockId: 'asc',
          },
        ],
        include: {
          
          _count: {
            select: {
              shelves: true,
            },
          },
        },
      }),

      this.prisma.stock.count({
        where,
      }),
    ]);

    return {
      stocks,
      totalStocks,
      totalPages:
        Math.ceil(totalStocks / limit) || 1,
      currentPage: page,
      limit,
    };
  }

  async getAllStocks(
    pagination: PaginationDTO,
  ) {
    const {
      page,
      limit,
    } = paginationSchema.parse(
      pagination ?? {},
    );

    const skip = (page - 1) * limit;

    const [
      stocks,
      totalStocks,
    ] = await Promise.all([
      this.prisma.stock.findMany({
        skip,
        take: limit,
        orderBy: [
          {
            stockName: 'asc',
          },
          {
            stockId: 'asc',
          },
        ],
        include: {
          
          _count: {
            select: {
              shelves: true,
            },
          },
        },
      }),

      this.prisma.stock.count(),
    ]);

    return {
      stocks,
      totalStocks,
      totalPages:
        Math.ceil(totalStocks / limit) || 1,
      currentPage: page,
      limit,
    };
  }


}
