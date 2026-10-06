import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { z, ZodError } from 'zod';

import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  createEquipmentMovementSchema,
  searchEquipmentMovementSchema,
  type MovementOrigin,
} from './dto/index.js';

const MAX = 2_147_483_647;
const UNLOCKED_INVENTORIES = ['DRAFT', 'FINALIZED', 'CANCELLED'];
const uuid = z.string().trim().uuid().transform((v) => v.toLowerCase());
const unique = <T>(values: T[]) => [...new Set(values)];

const shelfSelect = {
  shelfId: true,
  shelfName: true,
  stockId: true,
} as const;

const equipmentSelect = {
  equipmentId: true,
  equipmentName: true,
  hasSerialNumber: true,
  equipmentStatus: true,
} satisfies Prisma.EquipmentSelect;

const movementInclude = {
  createdByUser: {
    select: { userId: true, userName: true, userEmail: true },
  },
  inventory: {
    select: { inventoryId: true, title: true, status: true },
  },
  items: {
    orderBy: { movementEquipmentId: 'asc' },
    include: {
      equipment: { select: equipmentSelect },
      serialNumber: {
        select: {
          serialNumberId: true,
          serialNumberCode: true,
          serialNumberStatus: true,
        },
      },
      sourceShelf: { select: shelfSelect },
      destinationShelf: { select: shelfSelect },
    },
  },
} satisfies Prisma.MouvementInclude;

type Audit = {
  origin: MovementOrigin;
  inventoryId: string | null;
  reason: string | null;
};

type Item = z.output<typeof createEquipmentMovementSchema>['items'][number];

type SerialBalance = {
  serialNumberId: string;
  shelfId: string;
  quantity: bigint;
};

@Injectable()
export class EquipmentMovementService {
  constructor(private readonly prisma: PrismaService) { }

  createMovement(dto: unknown, userId?: string) {
    return this.create(dto, userId, {
      origin: 'USER',
      inventoryId: null,
      reason: null,
    });
  }

  createInventoryAdjustmentMovement(
    dto: unknown,
    inventoryId: string,
    reason: string,
    userId?: string,
  ) {
    return this.create(dto, userId, {
      origin: 'INVENTORY_ADJUSTMENT',
      inventoryId: uuid.parse(inventoryId),
      reason: z.string().trim().min(1).max(1000).parse(reason),
    });
  }

  private async create(dto: unknown, userId: string | undefined, audit: Audit) {
    return this.run(async () => {
      const { movementType, items } = createEquipmentMovementSchema.parse(dto);
      const createdByUserId = userId ? uuid.parse(userId) : null;

      const equipmentIds = unique(items.map(i => i.equipmentId));
      const shelfIds = unique(
        items.flatMap(i =>
          [i.sourceShelfId, i.destinationShelfId].filter(
            (id): id is string => Boolean(id),
          ),
        ),
      );
      const existingSerialIds = unique(
        items.flatMap(i => (i.serialNumberId ? [i.serialNumberId] : [])),
      );

      const resolved = items.map(i => ({
        ...i,
        serialNumberId:
          i.serialNumberId ?? (i.serialNumberCode ? randomUUID() : null),
      }));

      return this.write(async tx => {
        await this.lock(tx, [
          ...equipmentIds.map(id => `SOMIPHARM:EQUIPMENT:${id}`),
          ...shelfIds.map(id => `SOMIPHARM:SHELF:${id}`),
          ...existingSerialIds.map(id => `SOMIPHARM:SERIAL:${id}`),
        ]);

        const [equipments, activeShelves, serials] = await Promise.all([
          tx.equipment.findMany({
            where: { equipmentId: { in: equipmentIds } },
            select: equipmentSelect,
          }),
          tx.shelf.findMany({
            where: {
              shelfId: { in: shelfIds },
              status: true,
              stock: { status: true },
            },
            select: { shelfId: true },
          }),
          existingSerialIds.length
            ? tx.serialNumber.findMany({
              where: { serialNumberId: { in: existingSerialIds } },
              select: {
                serialNumberId: true,
                equipmentId: true,
              },
            })
            : Promise.resolve([]),
        ]);

        if (equipments.length !== equipmentIds.length)
          throw new NotFoundException('One or more equipment records do not exist');

        if (
          equipments.some(
            e => String(e.equipmentStatus).toUpperCase() !== 'ACTIVE',
          )
        )
          throw new ConflictException('Equipment is inactive');

        if (activeShelves.length !== shelfIds.length)
          throw new ConflictException(
            'Every shelf and its stock must exist and be active',
          );

        if (serials.length !== existingSerialIds.length)
          throw new NotFoundException('One or more serial numbers do not exist');

        const equipmentById = new Map(
          equipments.map(e => [e.equipmentId.toLowerCase(), e]),
        );
        const serialById = new Map(
          serials.map(s => [s.serialNumberId.toLowerCase(), s]),
        );

        for (const item of items) {
          const equipment = equipmentById.get(item.equipmentId)!;
          const hasSerial = Boolean(item.serialNumberId || item.serialNumberCode);

          if (equipment.hasSerialNumber !== hasSerial) {
            throw new BadRequestException(
              `'${equipment.equipmentName}' ${equipment.hasSerialNumber ? 'requires' : 'does not accept'
              } a serial number`,
            );
          }

          if (item.serialNumberId) {
            const serial = serialById.get(item.serialNumberId)!;
            if (serial.equipmentId.toLowerCase() !== item.equipmentId)
              throw new ConflictException(
                'Serial number does not belong to this equipment',
              );
          }
        }

        await this.checkInventoryLocks(
          tx,
          equipmentIds,
          shelfIds,
          audit.inventoryId,
        );

        if (existingSerialIds.length) {
          const locations = await this.serialLocations(tx, existingSerialIds);

          for (const item of items) {
            if (!item.serialNumberId) continue;

            const current = locations.get(item.serialNumberId) ?? [];

            if (movementType === 'IN') {
              if (current.length)
                throw new ConflictException(
                  'This serial number is already inside stock',
                );
            } else {
              if (
                current.length !== 1 ||
                current[0]!.quantity !== 1n ||
                current[0]!.shelfId.toLowerCase() !== item.sourceShelfId
              ) {
                throw new ConflictException(
                  'Serial number is not currently on the selected source shelf',
                );
              }
            }
          }
        }

        if (movementType !== 'IN') {
          await this.checkStandardSourceBalances(
            tx,
            items.filter(i => !equipmentById.get(i.equipmentId)!.hasSerialNumber),
          );
        }

        const newSerials = resolved.filter(
          i => i.serialNumberCode !== undefined,
        );

        if (newSerials.length) {
          const created = await tx.serialNumber.createMany({
            data: newSerials.map(i => ({
              serialNumberId: i.serialNumberId!,
              serialNumberCode: i.serialNumberCode!,
              serialNumberStatus: 'ACTIVE',
              equipmentId: i.equipmentId,
            })),
          });

          if (created.count !== newSerials.length)
            throw new ConflictException('Serial number creation was incomplete');
        }

        return tx.mouvement.create({
          data: {
            mouvementStatus: movementType,
            createdByUserId,
            origin: audit.origin === 'USER',
            inventoryId: audit.inventoryId,
            reason: audit.reason,
            items: {
              createMany: {
                data: resolved.map(i => ({
                  equipmentId: i.equipmentId,
                  sourceShelfId: i.sourceShelfId ?? null,
                  destinationShelfId: i.destinationShelfId ?? null,
                  serialNumberId: i.serialNumberId,
                  equipmentQuantity: i.movementQuantity,
                  equipmentTypeSnapshot: equipmentById.get(i.equipmentId)!
                    .hasSerialNumber
                    ? 'SERIALIZED'
                    : 'STANDARD',
                })),
              },
            },
          },
          include: movementInclude,
        });
      });
    });
  }

  async getMovements(query: unknown = {}) {
    return this.run(async () => {
      const f = searchEquipmentMovementSchema.parse(query ?? {});
      const skip = (f.page - 1) * f.limit;

      if (!Number.isSafeInteger(skip) || skip > MAX)
        throw new BadRequestException('Page is too large');

      const itemWhere: Prisma.MovementEquipmentWhereInput = {
        ...(f.equipmentId && { equipmentId: f.equipmentId }),
        ...(f.serialNumberId && { serialNumberId: f.serialNumberId }),
        ...(f.sourceShelfId && { sourceShelfId: f.sourceShelfId }),
        ...(f.destinationShelfId && {
          destinationShelfId: f.destinationShelfId,
        }),
      };

      const where: Prisma.MouvementWhereInput = {
        ...(f.movementType && { mouvementStatus: f.movementType }),
        ...(f.origin && { origin: f.origin === 'USER' }),
        ...(f.inventoryId && { inventoryId: f.inventoryId }),
        ...(Object.keys(itemWhere).length && { items: { some: itemWhere } }),
      };

      const [movements, totalMovements] = await Promise.all([
        this.prisma.mouvement.findMany({
          where,
          skip,
          take: f.limit,
          include: movementInclude,
          orderBy: [
            { happenedAt: 'desc' },
            { mouvementId: 'desc' },
          ],
        }),
        this.prisma.mouvement.count({ where }),
      ]);

      return {
        movements,
        totalMovements,
        totalPages: Math.max(1, Math.ceil(totalMovements / f.limit)),
        currentPage: f.page,
        limit: f.limit,
      };
    });
  }

  getMovementById(id: string) {
    return this.run(() =>
      this.prisma.mouvement.findUniqueOrThrow({
        where: { mouvementId: uuid.parse(id) },
        include: movementInclude,
      }),
    );
  }

  private async checkInventoryLocks(
    tx: Prisma.TransactionClient,
    equipmentIds: string[],
    shelfIds: string[],
    inventoryId: string | null,
  ) {
    if (inventoryId) {
      const inventory = await tx.inventory.findUnique({
        where: { inventoryId },
        select: { status: true },
      });

      if (!inventory || UNLOCKED_INVENTORIES.includes(inventory.status))
        throw new ConflictException(
          'Inventory adjustment requires an active inventory',
        );
    }

    const conflict = await tx.inventoryUnit.findFirst({
      where: {
        OR: [
          { equipmentId: { in: equipmentIds } },
          { shelfId: { in: shelfIds } },
        ],
        inventory: {
          status: { notIn: UNLOCKED_INVENTORIES },
          ...(inventoryId && { inventoryId: { not: inventoryId } }),
        },
      },
      select: { unitId: true },
    });

    if (conflict)
      throw new ConflictException('Movement is blocked by an active inventory');
  }

  private async checkStandardSourceBalances(
    tx: Prisma.TransactionClient,
    items: Item[],
  ) {
    if (!items.length) return;

    const needs = new Map<string, number>();

    for (const item of items) {
      const key = `${item.equipmentId}|${item.sourceShelfId}`;
      needs.set(key, (needs.get(key) ?? 0) + item.movementQuantity);
    }

    const values = Prisma.join(
      [...needs.keys()].map(key => {
        const [equipmentId, shelfId] = key.split('|');
        return Prisma.sql`(
          CAST(${equipmentId} AS uniqueidentifier),
          CAST(${shelfId} AS uniqueidentifier)
        )`;
      }),
    );

    const balances = await tx.$queryRaw<
      { equipmentId: string; shelfId: string; quantity: bigint }[]
    >(Prisma.sql`
      WITH wanted(equipmentId, shelfId) AS (
        SELECT * FROM (VALUES ${values}) v(equipmentId, shelfId)
      ),
      deltas AS (
        SELECT m.equipmentId, m.destinationShelfId AS shelfId,
               CAST(m.equipmentQuantity AS bigint) AS qty
        FROM dbo.MovementEquipment m
        JOIN wanted w
          ON w.equipmentId = m.equipmentId
         AND w.shelfId = m.destinationShelfId

        UNION ALL

        SELECT m.equipmentId, m.sourceShelfId,
               -CAST(m.equipmentQuantity AS bigint)
        FROM dbo.MovementEquipment m
        JOIN wanted w
          ON w.equipmentId = m.equipmentId
         AND w.shelfId = m.sourceShelfId
      )
      SELECT w.equipmentId, w.shelfId, COALESCE(SUM(d.qty), 0) AS quantity
      FROM wanted w
      LEFT JOIN deltas d
        ON d.equipmentId = w.equipmentId
       AND d.shelfId = w.shelfId
      GROUP BY w.equipmentId, w.shelfId;
    `);

    for (const row of balances) {
      const needed = needs.get(
        `${row.equipmentId.toLowerCase()}|${row.shelfId.toLowerCase()}`,
      );

      if (needed === undefined || row.quantity < BigInt(needed))
        throw new ConflictException(
          'Insufficient equipment quantity on the source shelf',
        );
    }
  }

  private async serialLocations(
    tx: Prisma.TransactionClient,
    serialIds: string[],
  ) {
    const values = Prisma.join(
      serialIds.map(
        id => Prisma.sql`(CAST(${id} AS uniqueidentifier))`,
      ),
    );

    const rows = await tx.$queryRaw<SerialBalance[]>(Prisma.sql`
      WITH wanted(serialNumberId) AS (
        SELECT * FROM (VALUES ${values}) v(serialNumberId)
      ),
      deltas AS (
        SELECT m.serialNumberId, m.destinationShelfId AS shelfId,
               CAST(m.equipmentQuantity AS bigint) AS qty
        FROM dbo.MovementEquipment m
        JOIN wanted w ON w.serialNumberId = m.serialNumberId
        WHERE m.destinationShelfId IS NOT NULL

        UNION ALL

        SELECT m.serialNumberId, m.sourceShelfId,
               -CAST(m.equipmentQuantity AS bigint)
        FROM dbo.MovementEquipment m
        JOIN wanted w ON w.serialNumberId = m.serialNumberId
        WHERE m.sourceShelfId IS NOT NULL
      ),
      balances AS (
        SELECT serialNumberId, shelfId, SUM(qty) AS quantity
        FROM deltas
        GROUP BY serialNumberId, shelfId
      )
      SELECT serialNumberId, shelfId, quantity
      FROM balances
      WHERE quantity <> 0;
    `);

    const result = new Map<string, SerialBalance[]>();

    for (const row of rows) {
      const id = row.serialNumberId.toLowerCase();
      const group = result.get(id);
      if (group) group.push(row);
      else result.set(id, [row]);
    }

    return result;
  }

  private async lock(tx: Prisma.TransactionClient, resources: string[]) {
    const keys = unique(resources).sort();
    if (!keys.length) return;

    const values = Prisma.join(keys.map(key => Prisma.sql`(${key})`));

    const [result] = await tx.$queryRaw<{ result: number }[]>(Prisma.sql`
      DECLARE @keys TABLE (
        resource nvarchar(255) COLLATE Latin1_General_100_BIN2 PRIMARY KEY
      );
      INSERT INTO @keys VALUES ${values};

      DECLARE @resource nvarchar(255), @result int = 0;

      WHILE EXISTS (SELECT 1 FROM @keys)
      BEGIN
        SELECT TOP (1) @resource = resource
        FROM @keys ORDER BY resource;

        EXEC @result = sys.sp_getapplock
          @Resource = @resource,
          @LockMode = 'Exclusive',
          @LockOwner = 'Transaction',
          @LockTimeout = 5000;

        IF @result NOT IN (0, 1) BREAK;
        DELETE FROM @keys WHERE resource = @resource;
      END;

      SELECT @result AS result;
    `);

    if (!result || ![0, 1].includes(result.result))
      throw new ConflictException('Stock resource is busy; retry');
  }

  private async write<T>(
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.prisma.$transaction(work, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 5_000,
          timeout: 30_000,
        });
      } catch (error) {
        if (this.code(error) !== 'P2034' || attempt >= 2) throw error;
        await delay(25 * 2 ** attempt);
      }
    }
  }

  private code(error: unknown) {
    return error &&
      typeof error === 'object' &&
      'code' in error &&
      typeof error.code === 'string'
      ? error.code
      : undefined;
  }

  private async run<T>(work: () => PromiseLike<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (error instanceof ZodError)
        throw new BadRequestException(
          error.issues
            .map(i => `${i.path.join('.') || 'request'}: ${i.message}`)
            .join('; '),
        );

      switch (this.code(error)) {
        case 'P2002':
          throw new ConflictException(
            'Serial number code already exists; use its existing serialNumberId for a return',
          );
        case 'P2003':
          throw new ConflictException(
            'A referenced record is missing or prevents this movement',
          );
        case 'P2025':
          throw new NotFoundException('Movement or related record not found');
        case 'P2034':
          throw new ConflictException(
            'Concurrent stock changes; refresh and retry',
          );
        case 'P2028':
          throw new ServiceUnavailableException(
            'Transaction could not complete; refresh before retrying',
          );
        case 'P2000':
        case 'P2020':
          throw new BadRequestException('A value exceeds database limits');
        default:
          throw error;
      }
    }
  }
}
