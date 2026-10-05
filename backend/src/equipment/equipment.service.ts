import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ZodError } from 'zod';
import { setTimeout as delay } from 'node:timers/promises';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  type CreateEquipmentDTO, createEquipmentSchema,
  type UpdateEquipmentDTO, updateEquipmentSchema,
  type SearchEquipmentDTO, searchEquipmentSchema,
  type PaginationDTO, paginationSchema,
} from './dto/index.js';

import { equipmentUuidSchema } from './dto/equipment-validation.js';
import {
  buildEquipmentBalancesQuery, buildShelfMatchesCte,
  safeDatabaseInteger, summarizeEquipmentStock, type ShelfBalanceRow,
} from './equipment-stock.js';

const EQUIPMENT_SELECT = {
  equipmentId: true,
  equipmentName: true,
  hasSerialNumber: true,
  minequipmentQuantity: true,
  equipmentStatus: true,
} satisfies Prisma.EquipmentSelect;

const EQUIPMENT_LIST_SELECT = {
  ...EQUIPMENT_SELECT,
  _count: { select: { serialNumbers: true } },
} satisfies Prisma.EquipmentSelect;

type EquipmentWithCount = Prisma.EquipmentGetPayload<{
  select: typeof EQUIPMENT_LIST_SELECT;
}>;
type EquipmentUpdate = ReturnType<typeof updateEquipmentSchema.parse>;
const SERIAL_BATCH_SIZE = 200;
const NON_LOCKING_INVENTORY_STATUSES = ['DRAFT', 'FINALIZED', 'CANCELLED'];
const EQUIPMENT_ORDER = [
  { equipmentName: 'asc' }, { equipmentId: 'asc' },
] satisfies Prisma.EquipmentOrderByWithRelationInput[];

@Injectable()
export class EquipmentService {
  constructor(private readonly prisma: PrismaService) { }

  async createEquipment(dto: CreateEquipmentDTO) {
    return this.operation(async () => {
      const data = createEquipmentSchema.parse(dto);
      await this.assertEquipmentNameAvailable(this.prisma, data.equipmentName);
      return this.prisma.equipment.create({
        data: {
          equipmentName: data.equipmentName,
          hasSerialNumber: data.hasSerialNumber,
          minequipmentQuantity: data.minEquipmentQuantity,
          equipmentStatus: data.equipmentStatus ? 'ACTIVE' : 'INACTIVE',
        },
        select: EQUIPMENT_SELECT,
      });
    });
  }

  async getAllEquipments(query?: PaginationDTO) {
    return this.operation(async () => this.listEquipments({}, paginationSchema.parse(query ?? {})));
  }

  async searchEquipments(query: SearchEquipmentDTO = {}, pagination?: PaginationDTO) {
    return this.operation(async () => {
      const filters = searchEquipmentSchema.parse(query ?? {});
      // The controller passes the query twice; direct callers may pass it once.
      const page = paginationSchema.parse(pagination ?? query ?? {});
      return this.listEquipments(filters, page);
    });
  }

  async getEquipmentById(id: string) {
    return this.operation(async () => {
      const equipmentId = this.parseEquipmentId(id);
      return this.transaction(async (tx) => {
        const equipment = await this.getEquipmentOrThrow(tx, equipmentId);
        const rows = await this.loadBalances(tx, [equipmentId]);
        return this.mapEquipment(equipment, rows);
      });
    });
  }

  async getEquipmentShelves(id: string) {
    // Exactly the same calculation and consistency diagnostics as list/detail.
    return this.getEquipmentById(id);
  }

  async updateEquipment(id: string, dto: UpdateEquipmentDTO) {
    return this.operation(async () => {
      const equipmentId = this.parseEquipmentId(id);
      const data = updateEquipmentSchema.parse(dto);
      return this.transaction(async (tx) => {
        // Same namespace and deterministic lock order as the movement service.
        // Locks MUST precede the reads used to make mutation decisions.
        await this.acquireLocks(tx, [
          `SOMIPHARM:EQUIPMENT:${equipmentId}`,
          ...(data.conversionSerials ?? []).map((item) => `SOMIPHARM:SHELF:${item.shelfId}`),
        ]);
        const current = await this.getEquipmentOrThrow(tx, equipmentId);
        if (current.hasSerialNumber && data.hasSerialNumber === false) {
          throw new BadRequestException('Serialized equipment cannot be converted back to standard equipment');
        }
        const converting = !current.hasSerialNumber && data.hasSerialNumber === true;
        if (!converting && data.conversionSerials !== undefined) {
          throw new BadRequestException('conversionSerials are only valid during Standard -> Serialized conversion');
        }
        if (data.equipmentName !== undefined && data.equipmentName !== current.equipmentName) {
          await this.assertEquipmentNameAvailable(tx, data.equipmentName, equipmentId);
        }
        if (converting) return this.convertStandardToSerialized(tx, current, data);
        return tx.equipment.update({
          where: { equipmentId }, data: this.metadataUpdate(data), select: EQUIPMENT_SELECT,
        });
      });
    });
  }

  async deleteEquipment(id: string) {
    return this.operation(async () => {
      const equipmentId = this.parseEquipmentId(id);
      return this.transaction(async (tx) => {
        await this.acquireLocks(tx, [`SOMIPHARM:EQUIPMENT:${equipmentId}`]);
        const equipment = await tx.equipment.findUnique({
          where: { equipmentId },
          select: {
            ...EQUIPMENT_SELECT,
            _count: {
              select: {
                movementItems: true, serialNumbers: true, inventoryUnits: true,
              }
            },
          },
        });
        if (!equipment) throw new NotFoundException(`Equipment with ID '${equipmentId}' not found`);
        if (equipment._count.movementItems) {
          throw new ConflictException('This equipment has movement history and cannot be physically deleted; mark it INACTIVE instead');
        }
        const rows = await this.loadBalances(tx, [equipmentId]);
        const stock = summarizeEquipmentStock(equipment, rows);
        if (stock.equipmentQuantity !== 0) {
          throw new ConflictException('Equipment with non-zero stock cannot be physically deleted');
        }
        if (equipment._count.serialNumbers) {
          throw new ConflictException('Equipment has serial identities (including inactive ones); mark it INACTIVE instead');
        }
        if (equipment._count.inventoryUnits) {
          throw new ConflictException('Equipment is referenced by inventory records and cannot be physically deleted');
        }
        // These schema fields are logical references, not Equipment relations.
        // Do not rely solely on FK errors or remove historical child records.
        const workUnit = await tx.inventoryUnit.findFirst({
          where: { equipmentId }, select: { unitId: true },
        });

        const scopes = await tx.$queryRaw<Array<{ inventoryId: string }>>`
          SELECT TOP (1) [inventoryId] FROM [dbo].[Inventory]
          WHERE CHARINDEX(${equipmentId}, LOWER([equipmentScopeIds])) > 0
        `;
        if (workUnit || scopes.length > 0) {
          throw new ConflictException('Equipment is referenced by inventory history or scope and cannot be physically deleted');
        }
        return tx.equipment.delete({ where: { equipmentId }, select: EQUIPMENT_SELECT });
      });
    });
  }

  async getSerialNumbersByEquipmentId(id: string, pagination?: PaginationDTO) {
    return this.operation(async () => {
      const equipmentId = this.parseEquipmentId(id);
      const { page, limit } = paginationSchema.parse(pagination ?? {});
      return this.transaction(async (tx) => {
        const equipment = await this.getEquipmentOrThrow(tx, equipmentId);
        if (!equipment.hasSerialNumber && equipment._count.serialNumbers > 0) {
          throw new ConflictException('Standard equipment unexpectedly has serial identities; reconcile the data first');
        }
        const totalSerialNumbers = equipment._count.serialNumbers;
        const serialNumbers = !equipment.hasSerialNumber ? [] : await tx.serialNumber.findMany({
          where: { equipmentId }, skip: (page - 1) * limit, take: limit,
          select: {
            serialNumberId: true, serialNumberCode: true, serialNumberStatus: true,
            equipmentId: true,
            movementItems: { select: { destinationShelf: { select: { shelfId: true, shelfName: true, stockId: true } } }, orderBy: { movementEquipmentId: 'desc' }, take: 1 },
          },
          orderBy: [{ serialNumberCode: 'asc' }, { serialNumberId: 'asc' }],
        });
        return {
          serialNumbers, totalSerialNumbers,
          totalPages: Math.max(1, Math.ceil(totalSerialNumbers / limit)), currentPage: page, limit
        };
      });
    });
  }

  private async listEquipments(
    filters: SearchEquipmentDTO,
    { page, limit }: ReturnType<typeof paginationSchema.parse>,
  ) {
    return this.transaction(async (tx) => {
      const skip = (page - 1) * limit;
      const shelfId = filters.shelfId ?? filters.equipmentShelfId;
      let equipments: EquipmentWithCount[];
      let totalEquipments: number;
      if (shelfId) {
        const cte = buildShelfMatchesCte(shelfId, filters);
        const countRows = await tx.$queryRaw<Array<{ total: bigint | number }>>(
          Prisma.sql`${cte} SELECT COUNT_BIG(*) AS total FROM Matches`,
        );
        totalEquipments = safeDatabaseInteger(countRows[0]?.total ?? 0, 'Equipment count');
        const ids = await tx.$queryRaw<Array<{ equipmentId: string }>>(
          Prisma.sql`${cte} SELECT [equipmentId] FROM Matches
            ORDER BY [equipmentName] ASC, [equipmentId] ASC
            OFFSET ${skip} ROWS FETCH NEXT ${limit} ROWS ONLY`,
        );
        equipments = ids.length === 0 ? [] : await tx.equipment.findMany({
          where: { equipmentId: { in: ids.map((row) => row.equipmentId) } },
          select: EQUIPMENT_LIST_SELECT, orderBy: EQUIPMENT_ORDER,
        });
      } else {
        const where: Prisma.EquipmentWhereInput = {};
        if (filters.equipmentName) where.equipmentName = { contains: filters.equipmentName };
        if (filters.hasSerialNumber !== undefined) where.hasSerialNumber = filters.hasSerialNumber;
        if (filters.equipmentStatus !== undefined) where.equipmentStatus = filters.equipmentStatus ? 'ACTIVE' : 'INACTIVE';
        if (filters.minEquipmentQuantity !== undefined) where.minequipmentQuantity = filters.minEquipmentQuantity;
        totalEquipments = await tx.equipment.count({ where });
        equipments = await tx.equipment.findMany({
          where, skip, take: limit, select: EQUIPMENT_LIST_SELECT, orderBy: EQUIPMENT_ORDER,
        });
      }
      const balances = await this.loadBalances(tx, equipments.map((item) => item.equipmentId));
      return {
        equipments: equipments.map((item) => this.mapEquipment(item, balances)),
        totalEquipments, totalPages: Math.max(1, Math.ceil(totalEquipments / limit)),
        currentPage: page, limit,
      };
    });
  }

  private mapEquipment(equipment: EquipmentWithCount, rows: ShelfBalanceRow[]) {
    const stock = summarizeEquipmentStock(equipment, rows);
    return {
      ...equipment, ...stock,
      _count: { ...equipment._count, equipmentShelfs: stock.shelvesCount }
    };
  }

  private async loadBalances(tx: Prisma.TransactionClient, equipmentIds: string[]): Promise<ShelfBalanceRow[]> {
    if (equipmentIds.length === 0) return [];
    return tx.$queryRaw<ShelfBalanceRow[]>(buildEquipmentBalancesQuery(equipmentIds));
  }

  private async getEquipmentOrThrow(tx: Prisma.TransactionClient, equipmentId: string) {
    const equipment = await tx.equipment.findUnique({
      where: { equipmentId }, select: EQUIPMENT_LIST_SELECT,
    });
    if (!equipment) throw new NotFoundException(`Equipment with ID '${equipmentId}' not found`);
    return equipment;
  }

  private async assertEquipmentNameAvailable(
    tx: Prisma.TransactionClient, equipmentName: string, excludeEquipmentId?: string,
  ): Promise<void> {
    const existing = await tx.equipment.findFirst({
      where: { equipmentName, ...(excludeEquipmentId ? { equipmentId: { not: excludeEquipmentId } } : {}) },
      select: { equipmentId: true },
    });
    if (existing) throw new ConflictException(`Equipment '${equipmentName}' already exists`);
    // The unique DB constraint is still authoritative for concurrent requests.
  }

  private metadataUpdate(data: EquipmentUpdate): Prisma.EquipmentUpdateInput {
    return {
      ...(data.equipmentName !== undefined && { equipmentName: data.equipmentName }),
      ...(data.minEquipmentQuantity !== undefined && { minequipmentQuantity: data.minEquipmentQuantity }),
      ...(data.equipmentStatus !== undefined && { equipmentStatus: data.equipmentStatus ? 'ACTIVE' : 'INACTIVE' }),
    };
  }

  private async convertStandardToSerialized(
    tx: Prisma.TransactionClient, current: EquipmentWithCount, data: EquipmentUpdate,
  ) {
    if (current._count.serialNumbers !== 0) {
      throw new ConflictException('Standard equipment already has serial records and cannot be converted safely');
    }
    const rows = await this.loadBalances(tx, [current.equipmentId]);
    const stock = summarizeEquipmentStock(current, rows);
    // Also check zero-stock equipment: positive/negative balances must not be hidden.
    if (!stock.stockIsConsistent) {
      throw new ConflictException('Equipment physical quantity and movement-derived shelf balances are inconsistent; conversion is blocked');
    }
    const serials = data.conversionSerials ?? [];
    if (serials.length !== stock.equipmentQuantity) {
      throw new BadRequestException(`Conversion requires exactly ${stock.equipmentQuantity} serial codes mapped to the current shelves`);
    }
    const codes = serials.map((item) => item.serialNumberCode);
    if (new Set(codes).size !== codes.length) {
      throw new BadRequestException('Duplicate serial number codes exist in the conversion request');
    }
    const expected = new Map(stock.equipmentShelfs.map((item) => [item.shelfId, item.equipmentQuantity]));
    const provided = new Map<string, number>();
    for (const item of serials) {
      if (!expected.has(item.shelfId)) {
        throw new BadRequestException(`Shelf '${item.shelfId}' does not contain this equipment`);
      }
      provided.set(item.shelfId, (provided.get(item.shelfId) ?? 0) + 1);
    }
    for (const [shelfId, quantity] of expected) {
      if (provided.get(shelfId) !== quantity) {
        throw new BadRequestException(`Serial mapping count does not match physical quantity on shelf '${shelfId}'`);
      }
    }

    const shelfIds = [...expected.keys()];
    // Match the stock-freeze policy already used by EquipmentMovementService.
    for (let offset = 0; offset < Math.max(1, shelfIds.length); offset += SERIAL_BATCH_SIZE) {
      const ids = shelfIds.slice(offset, offset + SERIAL_BATCH_SIZE);
      const inventoryConflict = await tx.inventoryUnit.findFirst({
        where: {
          OR: [{ equipmentId: current.equipmentId },
          ...(ids.length ? [{ shelfId: { in: ids } }] : [])],
          inventory: { status: { notIn: NON_LOCKING_INVENTORY_STATUSES } },
        },
        select: { unitId: true },
      });
      if (inventoryConflict) {
        throw new ConflictException('Conversion is blocked while this equipment or its shelves are controlled by an active inventory');
      }
    }

    // Chunk queries and writes to avoid a single large SQL Server parameter list.
    for (let offset = 0; offset < shelfIds.length; offset += SERIAL_BATCH_SIZE) {
      const ids = shelfIds.slice(offset, offset + SERIAL_BATCH_SIZE);
      const shelves = await tx.shelf.findMany({
        where: { shelfId: { in: ids } },
        select: { shelfId: true, status: true, stock: { select: { status: true } } },
      });
      if (shelves.length !== ids.length || shelves.some((shelf) => !shelf.status || !shelf.stock.status)) {
        throw new ConflictException('Conversion requires existing active shelves in active stocks');
      }
    }
    for (let offset = 0; offset < codes.length; offset += SERIAL_BATCH_SIZE) {
      const existing = await tx.serialNumber.findMany({
        where: { serialNumberCode: { in: codes.slice(offset, offset + SERIAL_BATCH_SIZE) } },
        select: { serialNumberCode: true },
      });
      if (existing.length > 0) {
        throw new ConflictException('One or more conversion serial number codes already exist');
      }
    }

    // IMPORTANT: the SerialNumber guard requires hasSerialNumber=true at INSERT.
    // Both this update and every insert are in the SAME transaction. Any failure
    // rolls back the flag, metadata and all prior batches. No new IN movement:
    // these units are already in stock, and quantity must not be incremented.
    const updated = await tx.equipment.update({
      where: { equipmentId: current.equipmentId },
      data: { ...this.metadataUpdate(data), hasSerialNumber: true }, select: EQUIPMENT_SELECT,
    });
    for (let offset = 0; offset < serials.length; offset += SERIAL_BATCH_SIZE) {
      const batch = serials.slice(offset, offset + SERIAL_BATCH_SIZE);
      const result = await tx.serialNumber.createMany({
        data: batch.map((item) => ({
          equipmentId: current.equipmentId, serialNumberCode: item.serialNumberCode,
          serialNumberStatus: 'ACTIVE',
        })),
      });
      if (result.count !== batch.length) throw new ConflictException('Serial conversion was incomplete; the transaction has been cancelled');
    }
    return updated;
  }

  private parseEquipmentId(id: string): string {
    if (typeof id !== 'string' || id.trim() === '') throw new BadRequestException('Equipment ID is required');
    const parsed = equipmentUuidSchema.safeParse(id);
    if (!parsed.success) throw new BadRequestException('Equipment ID must be a valid UUID');
    return parsed.data;
  }

  private async acquireLocks(tx: Prisma.TransactionClient, resources: string[]): Promise<void> {
    for (const resource of [...new Set(resources)].sort()) {
      const rows = await tx.$queryRaw<Array<{ lockResult: number }>>`
        DECLARE @lockResult int;
        EXEC @lockResult = sys.sp_getapplock
          @Resource = ${resource}, @LockMode = 'Exclusive',
          @LockOwner = 'Transaction', @LockTimeout = 10000;
        SELECT @lockResult AS lockResult;
      `;
      // SQL Server documents only 0 (immediate) and 1 (after waiting) as success.
      if (rows[0]?.lockResult !== 0 && rows[0]?.lockResult !== 1) {
        throw new ConflictException('Equipment or shelf is busy; refresh and retry');
      }
    }
  }

  private async transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.prisma.$transaction(work, {
          isolationLevel: 'Serializable', maxWait: 5_000, timeout: 30_000,
        });
      } catch (error) {
        // Retry only a documented rolled-back write conflict, not unknown or
        // ambiguous connection failures. Do not perform external side effects here.
        if (this.prismaErrorCode(error) !== 'P2034' || attempt >= 2) throw error;
        await delay(25 * 2 ** attempt);
      }
    }
  }

  private prismaErrorCode(error: unknown): string | undefined {
    if (typeof error !== 'object' || error === null || !('code' in error)) return undefined;
    return typeof error.code === 'string' ? error.code : undefined;
  }

  private async operation<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (error instanceof ZodError) {
        const detail = error.issues.map((issue) => `${issue.path.join('.') || 'request'}: ${issue.message}`).join('; ');
        throw new BadRequestException(`Invalid equipment request: ${detail}`);
      }
      switch (this.prismaErrorCode(error)) {
        case 'P2002': throw new ConflictException('Equipment name or serial number code already exists (database uniqueness rules apply)');
        case 'P2003': throw new ConflictException('A referenced record is missing, changed, or prevents deletion; refresh and retry, or mark equipment INACTIVE');
        case 'P2025': throw new NotFoundException('Equipment or a related record no longer exists');
        case 'P2034': throw new ConflictException('Concurrent stock changes prevented this operation; refresh and retry');
        case 'P2028': throw new ServiceUnavailableException('Database transaction could not complete; refresh the record before retrying');
        case 'P2000':
        case 'P2020': throw new BadRequestException('A value exceeds the database field limits');
        default: throw error;
      }
    }
  }
}
