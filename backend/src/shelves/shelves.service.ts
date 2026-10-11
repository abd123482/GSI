import { setTimeout as delay } from 'node:timers/promises';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ZodError } from 'zod';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  createShelfSchema, updateShelfSchema, searchShelfSchema, paginationSchema,
  type CreateShelfDTO, type UpdateShelfDTO, type SearchShelfDTO, type PaginationDTO,
} from './dto/index.js';

const shelfSelect = {
  shelfId: true, shelfName: true, stockId: true, status: true,
  stock: { select: { stockId: true, stockName: true, status: true } },
} satisfies Prisma.ShelfSelect;
const shelfOrder = [{ shelfName: 'asc' }, { shelfId: 'asc' }] satisfies Prisma.ShelfOrderByWithRelationInput[];

type SerialRow = {
  serialNumberId: string; serialNumberCode: string; serialNumberStatus: string;
  equipmentId: string; equipmentName: string; equipmentStatus: string;
};

function parse<T>(schema: { parse(input: unknown): T }, input: unknown): T {
  try { return schema.parse(input); }
  catch (error) {
    if (error instanceof ZodError) throw new BadRequestException(error.issues.map(issue => issue.message));
    throw error;
  }
}

function pageArgs(input: PaginationDTO) {
  const { page, limit } = parse(paginationSchema, input ?? {});
  const skip = (page - 1) * limit;
  if (!Number.isSafeInteger(skip) || skip > 2_147_483_647) throw new BadRequestException('Page is too large');
  return { page, limit, skip };
}

function dbError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') throw new BadRequestException('Shelf name or another unique value already exists');
    if (error.code === 'P2025') throw new NotFoundException('Shelf or related record not found');
    if (error.code === 'P2003') throw new BadRequestException('Operation blocked by a stock, movement, or inventory reference');
    if (error.code === 'P2034') throw new ConflictException('Concurrent update; retry the request');
  }
  throw error;
}

function serialsOnShelf(shelfId: string) {
  return Prisma.sql`
    WITH CurrentSerials AS (
      SELECT serialNumberId FROM (
        SELECT serialNumberId, CONVERT(bigint, equipmentQuantity) AS delta
        FROM dbo.MovementEquipment
        WHERE destinationShelfId = CAST(${shelfId} AS uniqueidentifier) AND serialNumberId IS NOT NULL
        UNION ALL
        SELECT serialNumberId, -CONVERT(bigint, equipmentQuantity) AS delta
        FROM dbo.MovementEquipment
        WHERE sourceShelfId = CAST(${shelfId} AS uniqueidentifier) AND serialNumberId IS NOT NULL
      ) AS entries
      GROUP BY serialNumberId HAVING SUM(delta) > 0
    )`;
}
@Injectable()
export class ShelfService {
  constructor(private readonly prisma: PrismaService) { }

  async createShelf(dto: CreateShelfDTO) {
    const { shelfName, stockId, status } = parse(createShelfSchema, dto);
    return this.write(async tx => {
      await this.requireActiveStock(tx, stockId);
      return tx.shelf.create({ data: { shelfName, stockId, status: status ?? true }, select: shelfSelect });
    });
  }

  async updateShelf(shelfId: string, dto: UpdateShelfDTO) {
    const { shelfName, stockId, status } = parse(updateShelfSchema, dto);
    const update = (tx: Prisma.TransactionClient) => tx.shelf.update({
      where: { shelfId },
      data: {
        ...(shelfName !== undefined && { shelfName }),
        ...(stockId !== undefined && { stockId }),
        ...(status !== undefined && { status }),
      },
      select: shelfSelect,
    });
    // Name-only updates rely on the database UNIQUE index; no preliminary read.
    if (stockId === undefined && status === undefined) return update(this.prisma).catch(dbError);
    return this.write(async tx => {
      const current = await tx.shelf.findUniqueOrThrow({ where: { shelfId }, select: { stockId: true } });
      const moving = stockId !== undefined && stockId.toLowerCase() !== current.stockId.toLowerCase();
      if (moving || status === true) await this.requireActiveStock(tx, stockId ?? current.stockId);
      if (status === false) {
        const occupied = await tx.$queryRaw<{ serialNumberId: string }[]>(Prisma.sql`
          ${serialsOnShelf(shelfId)} SELECT TOP (1) serialNumberId FROM CurrentSerials`);
        if (occupied.length) throw new BadRequestException('Cannot deactivate a shelf containing serialized items');
      }
      return update(tx);
    });
  }

  getShelfById(shelfId: string) {
    return this.prisma.shelf.findUniqueOrThrow({ where: { shelfId }, select: shelfSelect }).catch(dbError);
  }

  getAllShelves(pagination: PaginationDTO) {
    return this.list({}, pagination);
  }

  async searchShelves(dto: SearchShelfDTO, pagination: PaginationDTO) {
    const { shelfName, stockId, status } = parse(searchShelfSchema, dto ?? {});
    const where: Prisma.ShelfWhereInput = {};
    if (shelfName) where.shelfName = { contains: shelfName };
    if (stockId) where.stockId = stockId;
    if (status !== undefined) where.status = status;
    return this.list(where, pagination);
  }

  async getShelfByName(name: string, pagination: PaginationDTO) {
    name = name.trim();
    if (!name) throw new BadRequestException('Shelf name is required');
    return this.searchShelves({ shelfName: name }, pagination);
  }

  deleteShelf(shelfId: string) {
    // Requires ENABLED, TRUSTED SQL Server NO ACTION FKs from both movement
    // shelf columns and InventoryUnit.shelfId. Run shelf-db-preflight.sql first.
    return this.prisma.shelf.delete({ where: { shelfId }, select: shelfSelect }).catch(dbError);
  }

  async getShelfSerialNumbers(shelfId: string, pagination: PaginationDTO) {
    const { page, limit, skip } = pageArgs(pagination);
    const cte = serialsOnShelf(shelfId);
    const [rows, totals] = await Promise.all([
      this.prisma.$queryRaw<SerialRow[]>(Prisma.sql`
        ${cte}
        SELECT sn.serialNumberId, sn.serialNumberCode, sn.serialNumberStatus,
               sn.equipmentId, e.equipmentName, e.equipmentStatus
        FROM CurrentSerials c
        JOIN dbo.SerialNumber sn ON sn.serialNumberId = c.serialNumberId
        JOIN dbo.Equipment e ON e.equipmentId = sn.equipmentId
        ORDER BY sn.serialNumberCode, sn.serialNumberId
        OFFSET ${skip} ROWS FETCH NEXT ${limit} ROWS ONLY`),
      this.prisma.$queryRaw<{ total: bigint }[]>(Prisma.sql`
        ${cte}
        SELECT (SELECT COUNT_BIG(*) FROM CurrentSerials c
          JOIN dbo.SerialNumber sn ON sn.serialNumberId = c.serialNumberId
          JOIN dbo.Equipment e ON e.equipmentId = sn.equipmentId) AS total
        FROM dbo.Shelf WHERE shelfId = CAST(${shelfId} AS uniqueidentifier)`),
    ]).catch(dbError);
    if (!totals[0]) throw new NotFoundException('Shelf not found');
    const totalSerialNumbers = Number(totals[0].total);
    if (!Number.isSafeInteger(totalSerialNumbers)) throw new RangeError('Serial count exceeds the safe integer range');
    return {
      serialNumbers: rows.map(({ equipmentName, equipmentStatus, ...serial }) => ({
        ...serial, shelfId,
        equipment: { equipmentId: serial.equipmentId, equipmentName, equipmentStatus },
      })),
      totalSerialNumbers, totalPages: Math.max(1, Math.ceil(totalSerialNumbers / limit)),
      currentPage: page, limit,
    };
  }

  async getShelfEquipments(shelfId: string, pagination: PaginationDTO) {
    const { page, limit, skip } = pageArgs(pagination);
    const [rows, totals] = await Promise.all([
      this.prisma.$queryRaw<Array<{
        equipmentId: string;
        quantity: bigint | number;
        equipmentName: string;
        hasSerialNumber: boolean;
        equipmentStatus: string;
      }>>(Prisma.sql`
        WITH ShelfEquipmentStock AS (
          SELECT 
            m.equipmentId,
            SUM(CASE WHEN m.destinationShelfId = CAST(${shelfId} AS uniqueidentifier) THEN m.equipmentQuantity ELSE 0 END) -
            SUM(CASE WHEN m.sourceShelfId = CAST(${shelfId} AS uniqueidentifier) THEN m.equipmentQuantity ELSE 0 END) AS quantity
          FROM dbo.MovementEquipment m
          WHERE m.destinationShelfId = CAST(${shelfId} AS uniqueidentifier) OR m.sourceShelfId = CAST(${shelfId} AS uniqueidentifier)
          GROUP BY m.equipmentId
          HAVING SUM(CASE WHEN m.destinationShelfId = CAST(${shelfId} AS uniqueidentifier) THEN m.equipmentQuantity ELSE 0 END) -
                 SUM(CASE WHEN m.sourceShelfId = CAST(${shelfId} AS uniqueidentifier) THEN m.equipmentQuantity ELSE 0 END) > 0
        )
        SELECT 
          s.equipmentId,
          s.quantity,
          e.equipmentName,
          e.hasSerialNumber,
          e.equipmentStatus
        FROM ShelfEquipmentStock s
        JOIN dbo.Equipment e ON e.equipmentId = s.equipmentId
        ORDER BY e.equipmentName ASC, s.equipmentId ASC
        OFFSET ${skip} ROWS FETCH NEXT ${limit} ROWS ONLY`),
      this.prisma.$queryRaw<Array<{ total: bigint | number; totalQuantity: bigint | number }>>(Prisma.sql`
        WITH ShelfEquipmentStock AS (
          SELECT 
            m.equipmentId,
            SUM(CASE WHEN m.destinationShelfId = CAST(${shelfId} AS uniqueidentifier) THEN m.equipmentQuantity ELSE 0 END) -
            SUM(CASE WHEN m.sourceShelfId = CAST(${shelfId} AS uniqueidentifier) THEN m.equipmentQuantity ELSE 0 END) AS quantity
          FROM dbo.MovementEquipment m
          WHERE m.destinationShelfId = CAST(${shelfId} AS uniqueidentifier) OR m.sourceShelfId = CAST(${shelfId} AS uniqueidentifier)
          GROUP BY m.equipmentId
          HAVING SUM(CASE WHEN m.destinationShelfId = CAST(${shelfId} AS uniqueidentifier) THEN m.equipmentQuantity ELSE 0 END) -
                 SUM(CASE WHEN m.sourceShelfId = CAST(${shelfId} AS uniqueidentifier) THEN m.equipmentQuantity ELSE 0 END) > 0
        )
        SELECT 
          (SELECT COUNT_BIG(*) FROM ShelfEquipmentStock) AS total,
          (SELECT COALESCE(SUM(CONVERT(bigint, quantity)), 0) FROM ShelfEquipmentStock) AS totalQuantity
        FROM dbo.Shelf WHERE shelfId = CAST(${shelfId} AS uniqueidentifier)`),
    ]).catch(dbError);

    if (!totals[0]) throw new NotFoundException('Shelf not found');
    const totalEquipments = Number(totals[0].total);
    const totalQuantity = Number(totals[0].totalQuantity);
    if (!Number.isSafeInteger(totalEquipments)) throw new RangeError('Equipment count exceeds the safe integer range');

    const serializedIds = rows.filter(r => r.hasSerialNumber).map(r => r.equipmentId);
    const serialsMap = new Map<string, Array<{ serialNumberId: string; serialNumberCode: string; serialNumberStatus: string }>>();

    if (serializedIds.length > 0) {
      const serialRows = await this.prisma.$queryRaw<Array<{
        serialNumberId: string;
        serialNumberCode: string;
        serialNumberStatus: string;
        equipmentId: string;
      }>>(Prisma.sql`
        ${serialsOnShelf(shelfId)}
        SELECT sn.serialNumberId, sn.serialNumberCode, sn.serialNumberStatus, sn.equipmentId
        FROM CurrentSerials c
        JOIN dbo.SerialNumber sn ON sn.serialNumberId = c.serialNumberId
        WHERE sn.equipmentId IN (${Prisma.join(serializedIds.map(id => Prisma.sql`CAST(${id} AS uniqueidentifier)`))})
        ORDER BY sn.serialNumberCode ASC
      `).catch(dbError);

      for (const s of serialRows) {
        const list = serialsMap.get(s.equipmentId) ?? [];
        list.push({
          serialNumberId: s.serialNumberId,
          serialNumberCode: s.serialNumberCode,
          serialNumberStatus: s.serialNumberStatus,
        });
        serialsMap.set(s.equipmentId, list);
      }
    }

    return {
      equipments: rows.map(r => ({
        equipmentId: r.equipmentId,
        equipmentName: r.equipmentName,
        hasSerialNumber: Boolean(r.hasSerialNumber),
        equipmentStatus: r.equipmentStatus,
        quantity: Number(r.quantity),
        serials: serialsMap.get(r.equipmentId) ?? [],
      })),
      totalEquipments,
      totalQuantity,
      totalPages: Math.max(1, Math.ceil(totalEquipments / limit)),
      currentPage: page,
      limit,
    };
  }

  private async list(where: Prisma.ShelfWhereInput, pagination: PaginationDTO) {
    const { page, limit, skip } = pageArgs(pagination);
    const [shelves, totalShelves] = await Promise.all([
      this.prisma.shelf.findMany({ where, skip, take: limit, select: shelfSelect, orderBy: shelfOrder }),
      this.prisma.shelf.count({ where }),
    ]).catch(dbError);
    return { shelves, totalShelves, totalPages: Math.max(1, Math.ceil(totalShelves / limit)), currentPage: page, limit };
  }

  private async requireActiveStock(tx: Prisma.TransactionClient, stockId: string) {
    const stock = await tx.stock.findUnique({ where: { stockId }, select: { status: true } });
    if (!stock) throw new NotFoundException('Stock not found');
    if (!stock.status) throw new BadRequestException('An inactive stock cannot receive or activate shelves');
  }

  private async write<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.prisma.$transaction(operation, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2034' || attempt >= 2) {
          return dbError(error);
        }
        await delay(20 * 2 ** attempt + Math.floor(Math.random() * 20));
      }
    }
  }
}