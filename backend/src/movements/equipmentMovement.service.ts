import { BadRequestException, ConflictException, Injectable, NotFoundException, Optional, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { z, ZodError } from 'zod';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { createEquipmentMovementSchema, searchEquipmentMovementSchema, type MovementOrigin } from './dto/index.js';

const MAX = 2_147_483_647, UNLOCKED = ['DRAFT', 'FINALIZED', 'CANCELLED'];
const uuid = z.string().trim().uuid().transform((id) => id.toLowerCase());
const unique = (values: string[]) => [...new Set(values)];
const shelfSelect = { shelfId: true, shelfName: true, stockId: true } as const;
const equipmentSelect = {
  equipmentId: true, equipmentName: true, hasSerialNumber: true, equipmentQuantity: true, equipmentStatus: true,
} satisfies Prisma.EquipmentSelect;
const movementInclude = {
  sourceShelf: { select: shelfSelect }, destinationShelf: { select: shelfSelect },
  createdByUser: { select: { userId: true, userName: true, userEmail: true } },
  inventory: { select: { inventoryId: true, title: true, status: true } },
  items: {
    orderBy: { rowNum: 'asc' }, include: {
      equipment: { select: equipmentSelect },
      serialNumber: { select: { serialNumberId: true, serialNumberCode: true, serialNumberStatus: true } },
    }
  },
} satisfies Prisma.MouvementInclude;
type Audit = { origin: MovementOrigin; inventoryId: string | null; reason: string | null };
type Item = z.output<typeof createEquipmentMovementSchema>['items'][number];

@Injectable()
export class EquipmentMovementService {
  // Retain the optional constructor argument for existing tests; notifications stay disabled.
  constructor(private readonly prisma: PrismaService, @Optional() _notifications?: NotificationsService) { }

  async createMovement(dto: unknown, userId?: string) {
    return this.create(dto, userId, { origin: 'USER', inventoryId: null, reason: null });
  }
  async createInventoryAdjustmentMovement(dto: unknown, inventoryId: string, reason: string, userId?: string) {
    return this.run(() => this.create(dto, userId, {
      origin: 'INVENTORY_ADJUSTMENT',
      inventoryId: uuid.parse(inventoryId), reason: z.string().trim().min(1).max(1000).parse(reason)
    }));
  }

  private async create(dto: unknown, userId: string | undefined, audit: Audit) {
    return this.run(async () => {
      const { movementType: type, items } = createEquipmentMovementSchema.parse(dto);
      const createdByUserId = userId === undefined ? null : uuid.parse(userId);
      const equipmentIds = unique(items.map((i) => i.equipmentId));
      const shelfIds = unique(items.flatMap((i) => [i.sourceShelfId, i.destinationShelfId].filter((v): v is string => !!v)));
      const serialIds = items.flatMap((i) => i.serialNumberId ? [i.serialNumberId] : []);
      // Client-generated UUIDs let createMany insert serials without an ID lookup per row.
      const resolved = items.map((i) => ({ ...i, serialNumberId: i.serialNumberId ?? (i.serialNumberCode ? randomUUID() : null) }));
      const newSerials = resolved.filter((i) => i.serialNumberCode !== undefined);
      const existing = resolved.filter((i) => i.serialNumberId && i.serialNumberCode === undefined);
      const totals = new Map<string, number>();
      for (const i of items) totals.set(i.equipmentId, (totals.get(i.equipmentId) ?? 0) + i.movementQuantity);

      return this.write(async (tx) => {
        await this.lock(tx, [
          ...equipmentIds.map((id) => `SOMIPHARM:EQUIPMENT:${id}`),
          ...shelfIds.map((id) => `SOMIPHARM:SHELF:${id}`),
          ...serialIds.map((id) => `SOMIPHARM:SERIAL:${id}`),
        ]);
        const equipments = await tx.equipment.findMany({ where: { equipmentId: { in: equipmentIds } }, select: equipmentSelect });
        if (equipments.length !== equipmentIds.length) throw new NotFoundException('One or more equipment records do not exist');
        if (equipments.some((e) => !e.equipmentStatus || e.equipmentQuantity < 0)) throw new ConflictException('Equipment is inactive or has invalid stock');
        const shelves = await tx.shelf.findMany({ where: { shelfId: { in: shelfIds }, status: true, stock: { status: true } }, select: { shelfId: true } });
        if (shelves.length !== shelfIds.length) throw new ConflictException('Every shelf and its stock must exist and be active');
        const serials = serialIds.length ? await tx.serialNumber.findMany({
          where: { serialNumberId: { in: serialIds } },
          select: { serialNumberId: true, equipmentId: true, shelfId: true }
        }) : [];
        if (serials.length !== serialIds.length) throw new NotFoundException('One or more serial numbers do not exist');
        const equipmentById = new Map(equipments.map((e) => [e.equipmentId.toLowerCase(), e]));
        const serialById = new Map(serials.map((s) => [s.serialNumberId.toLowerCase(), s]));
        for (const item of items) {
          const equipment = equipmentById.get(item.equipmentId)!;
          if (equipment.hasSerialNumber !== !!(item.serialNumberId || item.serialNumberCode))
            throw new BadRequestException(`'${equipment.equipmentName}' ${equipment.hasSerialNumber ? 'requires' : 'does not accept'} a serial`);
          if (item.serialNumberId) {
            const serial = serialById.get(item.serialNumberId)!;
            if (serial.equipmentId.toLowerCase() !== item.equipmentId || (serial.shelfId?.toLowerCase() ?? null) !== (item.sourceShelfId ?? null))
              throw new ConflictException('Serial ownership or source location does not match; an IN return requires an unallocated serial');
          }
        }
        if (audit.inventoryId) {
          const inventory = await tx.inventory.findUnique({ where: { inventoryId: audit.inventoryId }, select: { status: true } });
          if (!inventory || UNLOCKED.includes(inventory.status)) throw new ConflictException('Inventory adjustment requires an active inventory');
        }
        const conflict = await tx.inventoryWorkUnit.findFirst({
          where: {
            OR: [{ equipmentId: { in: equipmentIds } }, { shelfId: { in: shelfIds } }],
            inventory: { status: { notIn: UNLOCKED }, ...(audit.inventoryId ? { inventoryId: { not: audit.inventoryId } } : {}) },
          }, select: { unitId: true }
        });
        if (conflict) throw new ConflictException('Movement is blocked by an active inventory');
        if (type !== 'IN') {
          await this.checkSourceBalances(tx, items);
          for (const [id, quantity] of totals) if (equipmentById.get(id)!.equipmentQuantity < quantity)
            throw new ConflictException('Equipment total is smaller than the quantity leaving source shelves');
        }

        // A single guarded update for all equipment totals; TRANSFER leaves totals unchanged.
        if (type !== 'TRANSFER') {
          const values = Prisma.join([...totals].map(([id, qty]) => Prisma.sql`(CAST(${id} AS uniqueidentifier), ${type === 'IN' ? qty : -qty})`));
          const [result] = await tx.$queryRaw<{ changed: number }[]>(Prisma.sql`
            DECLARE @changed TABLE (id uniqueidentifier);
            UPDATE e SET equipmentQuantity = e.equipmentQuantity + v.delta
            OUTPUT inserted.equipmentId INTO @changed
            FROM dbo.Equipment e JOIN (VALUES ${values}) v(id, delta) ON v.id = e.equipmentId
            WHERE e.equipmentStatus = 1 AND e.equipmentQuantity >= 0
              AND CAST(e.equipmentQuantity AS bigint) + v.delta BETWEEN 0 AND ${MAX};
            SELECT COUNT(*) AS changed FROM @changed;`);
          if (result?.changed !== totals.size) throw new ConflictException('Insufficient stock, overflow, or concurrent equipment change');
        }
        if (newSerials.length) {
          const result = await tx.serialNumber.createMany({
            data: newSerials.map((i) => ({
              serialNumberId: i.serialNumberId!, serialNumberCode: i.serialNumberCode!,
              equipmentId: i.equipmentId, shelfId: i.destinationShelfId!, serialNumberStatus: true,
            }))
          });
          if (result.count !== newSerials.length) throw new ConflictException('Serial creation was incomplete');
        }
        // Existing serials are returned/issued/transferred in one conditional update.
        if (existing.length) {
          const values = Prisma.join(existing.map((i) => Prisma.sql`(
            CAST(${i.serialNumberId} AS uniqueidentifier), CAST(${i.equipmentId} AS uniqueidentifier),
            CAST(${i.sourceShelfId ?? null} AS uniqueidentifier), CAST(${i.destinationShelfId ?? null} AS uniqueidentifier))`));
          const [result] = await tx.$queryRaw<{ changed: number }[]>(Prisma.sql`
            DECLARE @changed TABLE (id uniqueidentifier);
            UPDATE s SET shelfId = v.destination OUTPUT inserted.serialNumberId INTO @changed
            FROM dbo.SerialNumber s JOIN (VALUES ${values}) v(id, equipment, source, destination)
              ON v.id = s.serialNumberId AND v.equipment = s.equipmentId
            WHERE s.shelfId = v.source OR (s.shelfId IS NULL AND v.source IS NULL);
            SELECT COUNT(*) AS changed FROM @changed;`);
          if (result?.changed !== existing.length) throw new ConflictException('Serial locations changed; refresh and retry');
        }
        const header = await tx.mouvement.create({
          data: {
            mouvementStatus: type === 'OUT', mouvementQuantity: items.reduce((s, i) => s + i.movementQuantity, 0),
            equipmentId: null, serialNumberId: null, sourceShelfId: null, destinationShelfId: null,
            createdByUserId, origin: audit.origin, inventoryId: audit.inventoryId, reason: audit.reason,
          }, select: { mouvementId: true }
        });
        const lines = await tx.mouvementEquipment.createMany({
          data: resolved.map((i, index) => ({
            mouvementId: header.mouvementId, rowNum: index + 1, equipmentId: i.equipmentId,
            equipmentTypeSnapshot: equipmentById.get(i.equipmentId)!.hasSerialNumber ? 'SERIALIZED' : 'STANDARD',
            serialNumberId: i.serialNumberId, mouvementQuantity: i.movementQuantity, mouvementStatus: type === 'OUT',
            sourceShelfId: i.sourceShelfId ?? null, destinationShelfId: i.destinationShelfId ?? null,
          }))
        });
        if (lines.count !== resolved.length) throw new ConflictException('Movement lines were incomplete');
        return tx.mouvement.findUniqueOrThrow({ where: { mouvementId: header.mouvementId }, include: movementInclude });
      });
    });
  }

  async getMovements(query: unknown = {}) {
    return this.run(async () => {
      const f = searchEquipmentMovementSchema.parse(query ?? {}), skip = (f.page - 1) * f.limit;
      if (!Number.isSafeInteger(skip) || skip > MAX) throw new BadRequestException('Page is too large');
      const route = f.movementType ? {
        sourceShelfId: f.movementType === 'IN' ? null : { not: null },
        destinationShelfId: f.movementType === 'OUT' ? null : { not: null },
      } : {};
      const details = {
        ...(f.equipmentId ? { equipmentId: f.equipmentId } : {}), ...(f.serialNumberId ? { serialNumberId: f.serialNumberId } : {}),
        ...(f.sourceShelfId ? { sourceShelfId: f.sourceShelfId } : {}), ...(f.destinationShelfId ? { destinationShelfId: f.destinationShelfId } : {}),
      };
      const line: Prisma.MouvementEquipmentWhereInput = { AND: [route, details] };
      const where: Prisma.MouvementWhereInput = {
        ...(f.origin ? { origin: f.origin } : {}), ...(f.inventoryId ? { inventoryId: f.inventoryId } : {}),
        ...((f.movementType || Object.keys(details).length) ? {
          OR: [
            { items: { some: line } }, { items: { none: {} }, AND: [route, details] },
          ]
        } : {}),
      };
      const [movements, totalMovements] = await Promise.all([
        this.prisma.mouvement.findMany({
          where, skip, take: f.limit, include: movementInclude,
          orderBy: [{ createdAt: 'desc' }, { mouvementId: 'desc' }]
        }),
        this.prisma.mouvement.count({ where }),
      ]);
      return { movements, totalMovements, totalPages: Math.ceil(totalMovements / f.limit) || 1, currentPage: f.page, limit: f.limit };
    });
  }
  async getMovementById(id: string) {
    return this.run(() => this.prisma.mouvement.findUniqueOrThrow({ where: { mouvementId: uuid.parse(id) }, include: movementInclude }));
  }

  private async checkSourceBalances(tx: Prisma.TransactionClient, items: Item[]) {
    const needs = new Map<string, number>();
    for (const i of items) {
      const key = `${i.equipmentId}|${i.sourceShelfId}`;
      needs.set(key, (needs.get(key) ?? 0) + i.movementQuantity);
    }
    const values = Prisma.join([...needs.keys()].map((key) => {
      const [equipment, shelf] = key.split('|');
      return Prisma.sql`(CAST(${equipment} AS uniqueidentifier), CAST(${shelf} AS uniqueidentifier))`;
    }));
    // Canonical children plus ONLY legacy headers without children. SUM uses bigint.
    const balances = await tx.$queryRaw<{ equipmentId: string; shelfId: string; quantity: bigint }[]>(Prisma.sql`
      WITH wanted AS (SELECT * FROM (VALUES ${values}) v(equipmentId, shelfId)), deltas AS (
        SELECT m.equipmentId, m.destinationShelfId shelfId, CAST(m.equipmentQuantity AS bigint) qty
        FROM dbo.MovementEquipment m JOIN wanted w ON w.equipmentId=m.equipmentId AND w.shelfId=m.destinationShelfId
        UNION ALL
        SELECT m.equipmentId, m.sourceShelfId, -CAST(m.equipmentQuantity AS bigint)
        FROM dbo.MovementEquipment m JOIN wanted w ON w.equipmentId=m.equipmentId AND w.shelfId=m.sourceShelfId
        UNION ALL
        SELECT m.equipmentId, m.destinationShelfId, CAST(m.movementQuantity AS bigint)
        FROM dbo.Mouvement m JOIN wanted w ON w.equipmentId=m.equipmentId AND w.shelfId=m.destinationShelfId
        WHERE NOT EXISTS (SELECT 1 FROM dbo.MovementEquipment c WHERE c.movementId=m.mouvementId)
        UNION ALL
        SELECT m.equipmentId, m.sourceShelfId, -CAST(m.movementQuantity AS bigint)
        FROM dbo.Mouvement m JOIN wanted w ON w.equipmentId=m.equipmentId AND w.shelfId=m.sourceShelfId
        WHERE NOT EXISTS (SELECT 1 FROM dbo.MovementEquipment c WHERE c.movementId=m.mouvementId)
      ) SELECT w.equipmentId, w.shelfId, COALESCE(SUM(d.qty),0) quantity
      FROM wanted w LEFT JOIN deltas d ON d.equipmentId=w.equipmentId AND d.shelfId=w.shelfId
      GROUP BY w.equipmentId,w.shelfId;`);
    if (balances.length !== needs.size) throw new ConflictException('Could not verify source stock');
    for (const b of balances) {
      const needed = needs.get(`${b.equipmentId.toLowerCase()}|${b.shelfId.toLowerCase()}`);
      if (needed === undefined || BigInt(b.quantity) < BigInt(needed)) throw new ConflictException('Insufficient equipment quantity on a source shelf');
    }
  }

  private async lock(tx: Prisma.TransactionClient, resources: string[]) {
    const values = Prisma.join(unique(resources).sort().map((r) => Prisma.sql`(${r})`));
    // One network round trip, same lock names/order as the existing stock services.
    const [result] = await tx.$queryRaw<{ result: number }[]>(Prisma.sql`
      DECLARE @keys TABLE (resource nvarchar(255) COLLATE Latin1_General_100_BIN2 PRIMARY KEY);
      INSERT INTO @keys VALUES ${values};
      DECLARE @resource nvarchar(255), @result int = 0;
      WHILE EXISTS (SELECT 1 FROM @keys) BEGIN
        SELECT TOP (1) @resource=resource FROM @keys ORDER BY resource;
        EXEC @result=sys.sp_getapplock @Resource=@resource, @LockMode='Exclusive',
          @LockOwner='Transaction', @LockTimeout=5000;
        IF @result NOT IN (0,1) BREAK;
        DELETE FROM @keys WHERE resource=@resource;
      END;
      SELECT @result AS result;`);
    if (!result || (result.result !== 0 && result.result !== 1)) throw new ConflictException('Stock resource is busy; retry');
  }
  private async write<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try { return await this.prisma.$transaction(work, { isolationLevel: 'Serializable', maxWait: 5_000, timeout: 30_000 }); }
      catch (error) {
        if (this.code(error) !== 'P2034' || attempt === 2) throw error;
        await delay(25 * 2 ** attempt);
      }
    }
  }
  private code(error: unknown): unknown { return error && typeof error === 'object' && 'code' in error ? error.code : undefined; }
  private async run<T>(work: () => PromiseLike<T>): Promise<T> {
    try { return await work(); } catch (error) {
      if (error instanceof ZodError) throw new BadRequestException(error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
      switch (this.code(error)) {
        case 'P2002': throw new ConflictException('A serial code already exists; for a return, use its existing serialNumberId');
        case 'P2003': throw new ConflictException('A referenced record is missing or changed');
        case 'P2025': throw new NotFoundException('Movement or related record not found');
        case 'P2034': throw new ConflictException('Concurrent stock changes; refresh and retry');
        case 'P2028': throw new ServiceUnavailableException('Transaction could not complete; refresh before retrying');
        case 'P2000': case 'P2020': throw new BadRequestException('A value exceeds database limits');
        default: throw error;
      }
    }
  }
}
