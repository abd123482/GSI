import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  CreateStockDTO,
  createStockSchema,
  UpdateStockDTO,
  updateStockSchema,
  SearchStockDTO,
  searchStockSchema,
  PaginationDTO,
  paginationSchema,
} from './dto/index.js';

@Injectable()
export class StockService {
  constructor(private readonly prisma: PrismaService) {}

  async existStock(stockName: string): Promise<boolean> {
    const stock = await this.prisma.stock.findFirst({
      where: { stockName },
    });
    return stock !== null;
  }

  async resolveStockStatus(statusInput?: string) {
    if (!statusInput) {
      const defaultStatus = await this.prisma.stockStatus.findFirst({
        where: { stockStatusName: 'ACTIVE' },
      });
      return defaultStatus;
    }

    const foundStatus = await this.prisma.stockStatus.findFirst({
      where: {
        OR: [
          { stockStatusName: statusInput },
          { stockStatusId: statusInput },
        ],
      },
    });

    if (!foundStatus) {
      throw new BadRequestException(`Statut de stock invalide : '${statusInput}' n'existe pas`);
    }

    return foundStatus;
  }

  async createStock(dto: CreateStockDTO) {
    // 1. Validate inputs using Zod
    const validated = createStockSchema.parse(dto);

    // 2. Check if stock already exists
    const existing = await this.existStock(validated.stockName);
    if (existing) {
      throw new BadRequestException('Stock with this name already exists');
    }

    // 3. Resolve stock status from StockStatus table
    const statusRecord = await this.resolveStockStatus(validated.stockStatus);

    // 4. Create new tuple inside Stock table without manual quantity
    return await this.prisma.stock.create({
      data: {
        stockName: validated.stockName,
        stockStatusId: statusRecord?.stockStatusId ?? null,
      },
      include: {
        stockStatus: true,
        _count: {
          select: { shelves: true },
        },
      },
    });
  }

  async updateStock(dto: UpdateStockDTO, id: string) {
    // 1. Validate inputs using Zod
    const validated = updateStockSchema.parse(dto);

    // 2. Check if stock exists
    const existingStock = await this.prisma.stock.findUnique({
      where: { stockId: id },
    });
    if (!existingStock) {
      throw new NotFoundException(`Stock with ID '${id}' not found`);
    }

    // 3. If name is being updated, verify uniqueness
    if (validated.stockName && validated.stockName !== existingStock.stockName) {
      const nameTaken = await this.existStock(validated.stockName);
      if (nameTaken) {
        throw new BadRequestException('Stock with this name already exists');
      }
    }

    // 4. If status is being updated, resolve against StockStatus table
    let statusId: string | undefined = undefined;
    if (validated.stockStatus !== undefined) {
      const resolvedStatus = await this.resolveStockStatus(validated.stockStatus);
      statusId = resolvedStatus?.stockStatusId;
    }

    // 5. Update stock tuple
    return await this.prisma.stock.update({
      where: { stockId: id },
      data: {
        ...(validated.stockName !== undefined && { stockName: validated.stockName }),
        ...(statusId !== undefined && { stockStatusId: statusId }),
      },
      include: {
        stockStatus: true,
        _count: {
          select: { shelves: true },
        },
      },
    });
  }

  async getStockById(id: string) {
    const stock = await this.prisma.stock.findUnique({
      where: { stockId: id },
      include: {
        stockStatus: true,
        shelves: {
          take: 100,
          orderBy: { shelfName: 'asc' },
        },
        _count: {
          select: { shelves: true },
        },
      },
    });

    if (!stock) {
      throw new NotFoundException(`Stock with ID '${id}' not found`);
    }

    return stock;
  }

  async searchStocks(searchStockDTO: SearchStockDTO, pagination: PaginationDTO) {
    const parsedPagination = paginationSchema.parse(pagination ?? {});
    const validatedSearch = searchStockSchema.parse(searchStockDTO ?? {});

    const page = parsedPagination.page;
    const limit = parsedPagination.limit;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (validatedSearch?.stockName) {
      where.stockName = {
        contains: validatedSearch.stockName,
      };
    }
    if (validatedSearch?.stockStatus) {
      where.stockStatus = {
        stockStatusName: validatedSearch.stockStatus,
      };
    }

    const [stocks, totalStocks] = await Promise.all([
      this.prisma.stock.findMany({
        skip,
        take: limit,
        where,
        orderBy: { stockName: 'asc' },
        include: {
          stockStatus: true,
          _count: {
            select: { shelves: true },
          },
        },
      }),
      this.prisma.stock.count({ where }),
    ]);

    return {
      stocks,
      totalStocks,
      totalPages: Math.ceil(totalStocks / limit) || 1,
      currentPage: page,
      limit,
    };
  }

  async getAllStocks(pagination: PaginationDTO) {
    const parsedPagination = paginationSchema.parse(pagination ?? {});
    const page = parsedPagination.page;
    const limit = parsedPagination.limit;
    const skip = (page - 1) * limit;

    const [stocks, totalStocks] = await Promise.all([
      this.prisma.stock.findMany({
        skip,
        take: limit,
        orderBy: { stockName: 'asc' },
        include: {
          stockStatus: true,
          _count: {
            select: { shelves: true },
          },
        },
      }),
      this.prisma.stock.count(),
    ]);

    return {
      stocks,
      totalStocks,
      totalPages: Math.ceil(totalStocks / limit) || 1,
      currentPage: page,
      limit,
    };
  }

  async getAllStockStatuses() {
    return await this.prisma.stockStatus.findMany({
      orderBy: { stockStatusName: 'asc' },
    });
  }
}
