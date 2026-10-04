import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ZodError } from 'zod';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  createStockSchema, updateStockSchema, searchStockSchema, paginationSchema,
  type CreateStockDTO, type UpdateStockDTO, type SearchStockDTO, type PaginationDTO,
} from './dto/index.js';

const stockSelect = {
  stockId: true, stockName: true, status: true,
  _count: { select: { shelves: true } },
} satisfies Prisma.StockSelect;

function parse<T>(schema: { parse(input: unknown): T }, input: unknown): T {
  try {
    return schema.parse(input);
  } catch (error) {
    if (error instanceof ZodError) throw new BadRequestException(error.issues);
    throw error;
  }
}

function handlePrismaError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') throw new BadRequestException('Stock name already exists');
    if (error.code === 'P2025') throw new NotFoundException('Stock not found');
  }
  throw error;
}

@Injectable()
export class StockService {
  constructor(private readonly prisma: PrismaService) { }

  async createStock(dto: CreateStockDTO) {
    const { stockName, status } = parse(createStockSchema, dto);
    return this.prisma.stock.create({
      data: { stockName, status: status ?? true },
      select: stockSelect,
    }).catch(handlePrismaError);
  }

  async updateStock(dto: UpdateStockDTO, stockId: string) {
    const { stockName, status } = parse(updateStockSchema, dto);
    if (stockName === undefined && status === undefined) {
      throw new BadRequestException('Provide stockName or status');
    }
    return this.prisma.stock.update({
      where: { stockId },
      data: {
        ...(stockName !== undefined && { stockName }),
        ...(status !== undefined && { status }),
        ...(status === false && {
          shelves: { updateMany: { where: { status: true }, data: { status: false } } },
        }),
      },
      select: stockSelect,
    }).catch(handlePrismaError);
  }

  getStockById(stockId: string) {
    return this.prisma.stock.findUniqueOrThrow({
      where: { stockId },
      select: {
        ...stockSelect,
        shelves: {
          take: 100,
          orderBy: [{ shelfName: 'asc' }, { shelfId: 'asc' }],
          select: { shelfId: true, shelfName: true, stockId: true, status: true },
        },
      },
    }).catch(handlePrismaError);
  }

  searchStocks(dto: SearchStockDTO, pagination: PaginationDTO) {
    const { stockName, status } = parse(searchStockSchema, dto ?? {});
    const where: Prisma.StockWhereInput = {};
    if (stockName) where.stockName = { contains: stockName };
    if (status !== undefined) where.status = status;
    return this.listStocks(where, pagination);
  }

  getAllStocks(pagination: PaginationDTO) {
    return this.listStocks({}, pagination);
  }

  private async listStocks(where: Prisma.StockWhereInput, pagination: PaginationDTO) {
    const { page, limit } = parse(paginationSchema, pagination ?? {});
    const [stocks, totalStocks] = await Promise.all([
      this.prisma.stock.findMany({
        where, skip: (page - 1) * limit, take: limit,
        orderBy: [{ stockName: 'asc' }, { stockId: 'asc' }],
        select: stockSelect,
      }),
      this.prisma.stock.count({ where }),
    ]);
    return {
      stocks, totalStocks, totalPages: Math.max(1, Math.ceil(totalStocks / limit)),
      currentPage: page, limit,
    };
  }
}
