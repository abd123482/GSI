import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type {
  Prisma,
} from '../generated/prisma/client.js';

import {
  PrismaService,
} from '../prisma/prisma.service.js';

import {
  type CreateEquipmentMovementDTO,
  type CreateEquipmentMovementItemDTO,
  type MovementOrigin,
  type MovementType,
  createEquipmentMovementSchema,
  type SearchEquipmentMovementDTO,
  searchEquipmentMovementSchema,
} from './dto/index.js';

const SQL_INT_MAX =
  2_147_483_647;

/**
 * DRAFT inventories have not frozen physical stock yet.
 * FINALIZED/CANCELLED inventories no longer own a live physical scope.
 *
 * Every other status is treated as active/locked. This is deliberate:
 * unknown or future workflow states fail safe instead of silently allowing
 * stock changes.
 */
const NON_LOCKING_INVENTORY_STATUSES =
  [
    'DRAFT',
    'FINALIZED',
    'CANCELLED',
  ] as const;

type EquipmentRecord = {
  equipmentId: string;
  equipmentName: string;
  hasSerialNumber: boolean;
  equipmentQuantity: number;
  equipmentStatus: string;
};

type SerialRecord = {
  serialNumberId: string;
  equipmentId: string;
  shelfId: string | null;
  serialNumberStatus: string;
};

type MovementAuditContext = {
  origin: MovementOrigin;
  inventoryId: string | null;
  reason: string | null;

  /**
   * Inventory adjustment movements are allowed to modify the inventory that
   * generated them, but still cannot collide with another active inventory.
   */
  allowedInventoryId?: string;
};

const movementInclude = {
  sourceShelf: {
    select: {
      shelfId: true,
      shelfName: true,
      stockId: true,
    },
  },

  destinationShelf: {
    select: {
      shelfId: true,
      shelfName: true,
      stockId: true,
    },
  },

  createdByUser: {
    select: {
      userId: true,
      userName: true,
      userEmail: true,
    },
  },

  inventory: {
    select: {
      inventoryId: true,
      title: true,
      status: true,
    },
  },

  items: {
    orderBy: {
      rowNum: 'asc' as const,
    },

    select: {
      mouvementEquipmentId:
        true,
      rowNum: true,
      equipmentId: true,
      equipmentTypeSnapshot:
        true,
      serialNumberId: true,
      mouvementQuantity: true,
      mouvementStatus: true,
      sourceShelfId: true,
      destinationShelfId:
        true,

      equipment: {
        select: {
          equipmentId: true,
          equipmentName: true,
          hasSerialNumber:
            true,
          equipmentStatus:
            true,
        },
      },

      serialNumber: {
        select: {
          serialNumberId: true,
          serialNumberCode: true,
          serialNumberStatus:
            true,
        },
      },
    },
  },
} satisfies Prisma.MouvementInclude;

@Injectable()
export class EquipmentMovementService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Public user movement.
   *
   * The client cannot choose origin/inventoryId/reason. Normal user movements
   * always have origin=USER.
   */
  async createMovement(
    dto: CreateEquipmentMovementDTO,
    userId?: string,
  ) {
    return this.createMovementInternal(
      dto,
      userId,
      {
        origin: 'USER',
        inventoryId: null,
        reason: null,
      },
    );
  }

  /**
   * Internal entry point for inventory finalization.
   *
   * This method is intentionally NOT exposed by the movement controller.
   * It creates normal stock mutations, but records the inventory audit link.
   */
  async createInventoryAdjustmentMovement(
    dto: CreateEquipmentMovementDTO,
    inventoryId: string,
    reason: string,
    userId?: string,
  ) {
    const normalizedInventoryId =
      inventoryId?.trim();

    const normalizedReason =
      reason?.trim();

    if (!normalizedInventoryId) {
      throw new BadRequestException(
        'Inventory ID is required for an inventory adjustment movement',
      );
    }

    if (!normalizedReason) {
      throw new BadRequestException(
        'A reason is required for an inventory adjustment movement',
      );
    }

    return this.createMovementInternal(
      dto,
      userId,
      {
        origin:
          'INVENTORY_ADJUSTMENT',
        inventoryId:
          normalizedInventoryId,
        reason:
          normalizedReason,
        allowedInventoryId:
          normalizedInventoryId,
      },
    );
  }

  private async createMovementInternal(
    dto: CreateEquipmentMovementDTO,
    userId: string | undefined,
    audit: MovementAuditContext,
  ) {
    const movement =
      createEquipmentMovementSchema.parse(
        dto,
      );

    return this.prisma.$transaction(
      async (tx) => {
        const equipmentIds = [
          ...new Set(
            movement.items.map(
              (item) =>
                item.equipmentId,
            ),
          ),
        ];

        const serialIds = [
          ...new Set(
            movement.items.flatMap(
              (item) =>
                item.serialNumberId
                  ? [
                      item.serialNumberId,
                    ]
                  : [],
            ),
          ),
        ];

        const shelfIds = [
          ...new Set(
            [
              movement.sourceShelfId,
              movement.destinationShelfId,
            ].filter(
              (
                value,
              ): value is string =>
                Boolean(value),
            ),
          ),
        ];

        if (
          serialIds.length !==
          movement.items.filter(
            (item) =>
              item.serialNumberId,
          ).length
        ) {
          throw new BadRequestException(
            'The same serial number cannot appear twice in one movement',
          );
        }

        /**
         * Application locks give movements a stable resource order and provide
         * a lock protocol that InventoryService can share when launch/finalize
         * is rewritten.
         */
        await this.acquireResourceLocks(
          tx,
          equipmentIds,
          shelfIds,
          serialIds,
        );

        await this.ensureShelvesAreActive(
          tx,
          shelfIds,
        );

        const equipments =
          await tx.equipment.findMany({
            where: {
              equipmentId: {
                in: equipmentIds,
              },
            },

            select: {
              equipmentId: true,
              equipmentName: true,
              hasSerialNumber:
                true,
              equipmentQuantity:
                true,
              equipmentStatus:
                true,
            },
          });

        if (
          equipments.length !==
          equipmentIds.length
        ) {
          const found =
            new Set(
              equipments.map(
                (item) =>
                  item.equipmentId,
              ),
            );

          const missing =
            equipmentIds.filter(
              (id) =>
                !found.has(id),
            );

          throw new NotFoundException(
            `Equipment not found: ${missing.join(', ')}`,
          );
        }

        const inactiveEquipment =
          equipments.find(
            (item) =>
              item.equipmentStatus !==
              'ACTIVE',
          );

        if (inactiveEquipment) {
          throw new BadRequestException(
            `Equipment '${inactiveEquipment.equipmentName}' is INACTIVE and cannot be moved`,
          );
        }

        const serials =
          serialIds.length > 0
            ? await tx.serialNumber.findMany(
                {
                  where: {
                    serialNumberId: {
                      in: serialIds,
                    },
                  },

                  select: {
                    serialNumberId:
                      true,
                    equipmentId:
                      true,
                    shelfId: true,
                    serialNumberStatus:
                      true,
                  },
                },
              )
            : [];

        if (
          serials.length !==
          serialIds.length
        ) {
          const found =
            new Set(
              serials.map(
                (item) =>
                  item.serialNumberId,
              ),
            );

          const missing =
            serialIds.filter(
              (id) =>
                !found.has(id),
            );

          throw new NotFoundException(
            `Serial number not found: ${missing.join(', ')}`,
          );
        }

        /**
         * The active-inventory check happens inside the same Serializable
         * transaction and after resource locks are acquired.
         */
        await this.assertNoActiveInventoryConflict(
          tx,
          equipmentIds,
          shelfIds,
          audit.allowedInventoryId,
        );

        const equipmentById =
          new Map<
            string,
            EquipmentRecord
          >(
            equipments.map(
              (item) => [
                item.equipmentId,
                item,
              ],
            ),
          );

        const serialById =
          new Map<
            string,
            SerialRecord
          >(
            serials.map(
              (item) => [
                item.serialNumberId,
                item,
              ],
            ),
          );

        this.validateItems(
          movement.movementType,
          movement.sourceShelfId ??
            null,
          movement.items,
          equipmentById,
          serialById,
        );

        const totalQuantity =
          movement.items.reduce(
            (
              sum,
              item,
            ) =>
              sum +
              item.movementQuantity,
            0,
          );

        const header =
          await tx.mouvement.create({
            data: {
              mouvementStatus:
                movement.movementType,

              mouvementQuantity:
                totalQuantity,

              sourceShelfId:
                movement.sourceShelfId ??
                null,

              destinationShelfId:
                movement.destinationShelfId ??
                null,

              createdByUserId:
                userId ?? null,

              origin:
                audit.origin,

              inventoryId:
                audit.inventoryId,

              reason:
                audit.reason,

              /**
               * Legacy compatibility fields are deliberately not used by
               * canonical multi-line movements.
               */
              equipmentId: null,
              serialNumberId: null,
            },

            select: {
              mouvementId: true,
            },
          });

        await this.applyStockChanges(
          tx,
          movement.movementType,
          movement.sourceShelfId ??
            null,
          movement.destinationShelfId ??
            null,
          movement.items,
          equipmentById,
          totalQuantity,
        );

        await tx.mouvementEquipment.createMany(
          {
            data: movement.items.map(
              (
                item,
                index,
              ) => {
                const equipment =
                  equipmentById.get(
                    item.equipmentId,
                  )!;

                return {
                  mouvementId:
                    header.mouvementId,

                  rowNum:
                    index + 1,

                  equipmentId:
                    item.equipmentId,

                  equipmentTypeSnapshot:
                    equipment.hasSerialNumber
                      ? 'SERIALIZED'
                      : 'STANDARD',

                  serialNumberId:
                    item.serialNumberId ??
                    null,

                  mouvementQuantity:
                    item.movementQuantity,

                  mouvementStatus:
                    movement.movementType,

                  sourceShelfId:
                    movement.sourceShelfId ??
                    null,

                  destinationShelfId:
                    movement.destinationShelfId ??
                    null,
                };
              },
            ),
          },
        );

        return tx.mouvement.findUniqueOrThrow(
          {
            where: {
              mouvementId:
                header.mouvementId,
            },

            include:
              movementInclude,
          },
        );
      },
      {
        isolationLevel:
          'Serializable',
        timeout: 30_000,
      },
    );
  }

  async getMovements(
    query: SearchEquipmentMovementDTO,
  ) {
    const filters =
      searchEquipmentMovementSchema.parse(
        query ?? {},
      );

    const {
      page,
      limit,
    } = filters;

    const skip =
      (page - 1) * limit;

    const where:
      Prisma.MouvementWhereInput =
      {};

    if (
      filters.movementType
    ) {
      where.mouvementStatus =
        filters.movementType;
    }

    if (filters.origin) {
      where.origin =
        filters.origin;
    }

    if (filters.inventoryId) {
      where.inventoryId =
        filters.inventoryId;
    }

    if (
      filters.sourceShelfId
    ) {
      where.sourceShelfId =
        filters.sourceShelfId;
    }

    if (
      filters.destinationShelfId
    ) {
      where.destinationShelfId =
        filters.destinationShelfId;
    }

    if (
      filters.equipmentId ||
      filters.serialNumberId
    ) {
      where.items = {
        some: {
          ...(filters.equipmentId
            ? {
                equipmentId:
                  filters.equipmentId,
              }
            : {}),

          ...(filters.serialNumberId
            ? {
                serialNumberId:
                  filters.serialNumberId,
              }
            : {}),
        },
      };
    }

    const [
      movements,
      totalMovements,
    ] = await Promise.all([
      this.prisma.mouvement.findMany(
        {
          where,
          skip,
          take: limit,

          orderBy: [
            {
              createdAt: 'desc',
            },
            {
              mouvementId:
                'desc',
            },
          ],

          include:
            movementInclude,
        },
      ),

      this.prisma.mouvement.count(
        {
          where,
        },
      ),
    ]);

    return {
      movements,
      totalMovements,

      totalPages:
        Math.ceil(
          totalMovements / limit,
        ) || 1,

      currentPage:
        page,

      limit,
    };
  }

  async getMovementById(
    movementId: string,
  ) {
    const movement =
      await this.prisma.mouvement.findUnique({
        where: {
          mouvementId:
            movementId,
        },

        include:
          movementInclude,
      });

    if (!movement) {
      throw new NotFoundException(
        `Movement with ID '${movementId}' not found`,
      );
    }

    return movement;
  }

  private async acquireResourceLocks(
    tx: Prisma.TransactionClient,
    equipmentIds: string[],
    shelfIds: string[],
    serialIds: string[],
  ): Promise<void> {
    const resources = [
      ...equipmentIds.map(
        (id) =>
          `SOMIPHARM:EQUIPMENT:${id.toLowerCase()}`,
      ),

      ...shelfIds.map(
        (id) =>
          `SOMIPHARM:SHELF:${id.toLowerCase()}`,
      ),

      ...serialIds.map(
        (id) =>
          `SOMIPHARM:SERIAL:${id.toLowerCase()}`,
      ),
    ].sort();

    for (
      const resource of resources
    ) {
      const result =
        await tx.$queryRaw<
          Array<{
            lockResult:
              number;
          }>
        >`
          DECLARE @lockResult int;

          EXEC @lockResult =
            sys.sp_getapplock
              @Resource = ${resource},
              @LockMode = 'Exclusive',
              @LockOwner = 'Transaction',
              @LockTimeout = 10000;

          SELECT
            @lockResult AS lockResult;
        `;

      const lockResult =
        Number(
          result[0]
            ?.lockResult,
        );

      /**
       * sp_getapplock:
       * >= 0 => success
       * < 0  => timeout/cancel/deadlock/error
       */
      if (
        !Number.isFinite(
          lockResult,
        ) ||
        lockResult < 0
      ) {
        throw new BadRequestException(
          `Stock resource is busy. Refresh and retry the movement.`,
        );
      }
    }
  }

  private async ensureShelvesAreActive(
    tx: Prisma.TransactionClient,
    shelfIds: string[],
  ): Promise<void> {
    if (
      shelfIds.length === 0
    ) {
      return;
    }

    const shelves =
      await tx.shelf.findMany({
        where: {
          shelfId: {
            in: shelfIds,
          },
        },

        select: {
          shelfId: true,
          shelfName: true,
          stockId: true,

          stock: {
            select: {
              stockId: true,
              stockName: true,

              stockStatus: {
                select: {
                  stockStatusName:
                    true,
                },
              },
            },
          },
        },
      });

    if (
      shelves.length !==
      shelfIds.length
    ) {
      const found =
        new Set(
          shelves.map(
            (item) =>
              item.shelfId,
          ),
        );

      const missing =
        shelfIds.filter(
          (id) =>
            !found.has(id),
        );

      throw new NotFoundException(
        `Shelf not found: ${missing.join(', ')}`,
      );
    }

    const inactiveShelf =
      shelves.find(
        (shelf) =>
          shelf.stock
            .stockStatus
            .stockStatusName !==
          'ACTIVE',
      );

    if (inactiveShelf) {
      throw new BadRequestException(
        `Shelf '${inactiveShelf.shelfName ?? inactiveShelf.shelfId}' belongs to an INACTIVE stock and cannot be used in movements`,
      );
    }
  }

  private async assertNoActiveInventoryConflict(
    tx: Prisma.TransactionClient,
    equipmentIds: string[],
    shelfIds: string[],
    allowedInventoryId?: string,
  ): Promise<void> {
    const scopeFilters:
      Prisma.InventoryWorkUnitWhereInput[] =
      [];

    if (
      equipmentIds.length > 0
    ) {
      scopeFilters.push({
        equipmentId: {
          in: equipmentIds,
        },
      });
    }

    if (
      shelfIds.length > 0
    ) {
      scopeFilters.push({
        shelfId: {
          in: shelfIds,
        },
      });
    }

    if (
      scopeFilters.length === 0
    ) {
      return;
    }

    const conflict =
      await tx.inventoryWorkUnit.findFirst(
        {
          where: {
            OR:
              scopeFilters,

            inventory: {
              status: {
                notIn: [
                  ...NON_LOCKING_INVENTORY_STATUSES,
                ],
              },

              ...(allowedInventoryId
                ? {
                    inventoryId: {
                      not:
                        allowedInventoryId,
                    },
                  }
                : {}),
            },
          },

          select: {
            unitId: true,
            equipmentId: true,
            shelfId: true,

            inventory: {
              select: {
                inventoryId:
                  true,
                title: true,
                status: true,
              },
            },
          },
        },
      );

    if (conflict) {
      throw new BadRequestException(
        `Movement blocked: resource is currently controlled by active inventory '${conflict.inventory.title ?? conflict.inventory.inventoryId}' (${conflict.inventory.status})`,
      );
    }
  }

  private validateItems(
    movementType: MovementType,
    sourceShelfId:
      string | null,
    items:
      CreateEquipmentMovementItemDTO[],
    equipmentById:
      Map<
        string,
        EquipmentRecord
      >,
    serialById:
      Map<
        string,
        SerialRecord
      >,
  ) {
    const standardEquipmentSeen =
      new Set<string>();

    for (
      const item of items
    ) {
      const equipment =
        equipmentById.get(
          item.equipmentId,
        )!;

      if (
        equipment.hasSerialNumber
      ) {
        if (
          !item.serialNumberId
        ) {
          throw new BadRequestException(
            `A serial number is required for '${equipment.equipmentName}'`,
          );
        }

        if (
          item.movementQuantity !==
          1
        ) {
          throw new BadRequestException(
            `Serialized equipment '${equipment.equipmentName}' must have quantity 1 per line`,
          );
        }

        const serial =
          serialById.get(
            item.serialNumberId,
          );

        if (!serial) {
          throw new NotFoundException(
            `Serial number '${item.serialNumberId}' not found`,
          );
        }

        if (
          serial.equipmentId !==
          item.equipmentId
        ) {
          throw new BadRequestException(
            `Serial number '${item.serialNumberId}' does not belong to equipment '${item.equipmentId}'`,
          );
        }

        if (
          movementType ===
          'IN'
        ) {
          if (
            serial.shelfId !==
            null
          ) {
            throw new BadRequestException(
              `Serial number '${item.serialNumberId}' is already assigned to a shelf`,
            );
          }
        } else if (
          serial.shelfId !==
          sourceShelfId
        ) {
          throw new BadRequestException(
            `Serial number '${item.serialNumberId}' is not on the movement source shelf`,
          );
        }
      } else {
        if (
          item.serialNumberId
        ) {
          throw new BadRequestException(
            `Equipment '${equipment.equipmentName}' is not serialized`,
          );
        }

        if (
          standardEquipmentSeen.has(
            item.equipmentId,
          )
        ) {
          throw new BadRequestException(
            `Standard equipment '${equipment.equipmentName}' can appear only once in a movement`,
          );
        }

        standardEquipmentSeen.add(
          item.equipmentId,
        );
      }
    }
  }

  private async applyStockChanges(
    tx: Prisma.TransactionClient,
    movementType: MovementType,
    sourceShelfId:
      string | null,
    destinationShelfId:
      string | null,
    items:
      CreateEquipmentMovementItemDTO[],
    equipmentById:
      Map<
        string,
        EquipmentRecord
      >,
    totalQuantity: number,
  ) {
    const allocationTotals =
      new Map<
        string,
        number
      >();

    /**
     * Physical Equipment.equipmentQuantity is movement-owned for BOTH standard
     * and serialized equipment.
     */
    const globalTotals =
      new Map<
        string,
        number
      >();

    const serializedItems:
      CreateEquipmentMovementItemDTO[] =
      [];

    for (
      const item of items
    ) {
      allocationTotals.set(
        item.equipmentId,
        (allocationTotals.get(
          item.equipmentId,
        ) ?? 0) +
          item.movementQuantity,
      );

      globalTotals.set(
        item.equipmentId,
        (globalTotals.get(
          item.equipmentId,
        ) ?? 0) +
          item.movementQuantity,
      );

      const equipment =
        equipmentById.get(
          item.equipmentId,
        )!;

      if (
        equipment.hasSerialNumber
      ) {
        serializedItems.push(
          item,
        );
      }
    }

    if (sourceShelfId) {
      for (
        const [
          equipmentId,
          quantity,
        ] of allocationTotals
      ) {
        const updated =
          await tx.equipmentShelfs.updateMany(
            {
              where: {
                equipmentId,
                shelfId:
                  sourceShelfId,

                equipmentQuantity:
                  {
                    gte:
                      quantity,
                  },
              },

              data: {
                equipmentQuantity:
                  {
                    decrement:
                      quantity,
                  },
              },
            },
          );

        if (
          updated.count !== 1
        ) {
          throw new BadRequestException(
            `Insufficient quantity for equipment '${equipmentId}' on source shelf`,
          );
        }
      }

      const sourceShelfUpdated =
        await tx.shelf.updateMany({
          where: {
            shelfId:
              sourceShelfId,

            shelfQuantity: {
              gte:
                totalQuantity,
            },
          },

          data: {
            shelfQuantity: {
              decrement:
                totalQuantity,
            },
          },
        });

      if (
        sourceShelfUpdated.count !==
        1
      ) {
        throw new BadRequestException(
          'Source shelf quantity is insufficient or inconsistent',
        );
      }
    }

    if (
      destinationShelfId
    ) {
      const destinationAllocations =
        await tx.equipmentShelfs.findMany(
          {
            where: {
              shelfId:
                destinationShelfId,

              equipmentId: {
                in: [
                  ...allocationTotals.keys(),
                ],
              },
            },

            select: {
              equipmentShelfId:
                true,
              equipmentId: true,
              equipmentQuantity:
                true,
            },
          },
        );

      const allocationByEquipment =
        new Map(
          destinationAllocations.map(
            (item) => [
              item.equipmentId,
              item,
            ],
          ),
        );

      for (
        const [
          equipmentId,
          quantity,
        ] of allocationTotals
      ) {
        const allocation =
          allocationByEquipment.get(
            equipmentId,
          );

        if (!allocation) {
          await tx.equipmentShelfs.create(
            {
              data: {
                equipmentId,
                shelfId:
                  destinationShelfId,
                equipmentQuantity:
                  quantity,
              },
            },
          );

          continue;
        }

        if (
          allocation.equipmentQuantity >
          SQL_INT_MAX -
            quantity
        ) {
          throw new BadRequestException(
            `Destination allocation exceeds SQL Server INT capacity for equipment '${equipmentId}'`,
          );
        }

        const updated =
          await tx.equipmentShelfs.updateMany(
            {
              where: {
                equipmentShelfId:
                  allocation.equipmentShelfId,

                equipmentQuantity:
                  {
                    lte:
                      SQL_INT_MAX -
                      quantity,
                  },
              },

              data: {
                equipmentQuantity:
                  {
                    increment:
                      quantity,
                  },
              },
            },
          );

        if (
          updated.count !== 1
        ) {
          throw new BadRequestException(
            `Destination allocation changed or exceeded SQL Server INT capacity for equipment '${equipmentId}'`,
          );
        }
      }

      const destinationShelf =
        await tx.shelf.findUnique({
          where: {
            shelfId:
              destinationShelfId,
          },

          select: {
            shelfQuantity:
              true,
          },
        });

      if (
        !destinationShelf
      ) {
        throw new NotFoundException(
          `Destination shelf '${destinationShelfId}' not found`,
        );
      }

      if (
        destinationShelf.shelfQuantity >
        SQL_INT_MAX -
          totalQuantity
      ) {
        throw new BadRequestException(
          'Destination shelf quantity exceeds SQL Server INT capacity',
        );
      }

      const destinationUpdated =
        await tx.shelf.updateMany({
          where: {
            shelfId:
              destinationShelfId,

            shelfQuantity: {
              lte:
                SQL_INT_MAX -
                totalQuantity,
            },
          },

          data: {
            shelfQuantity: {
              increment:
                totalQuantity,
            },
          },
        });

      if (
        destinationUpdated.count !==
        1
      ) {
        throw new BadRequestException(
          'Destination shelf quantity changed or exceeds SQL Server INT capacity',
        );
      }
    }

    /**
     * Global physical equipment totals.
     *
     * IN       => +quantity
     * OUT      => -quantity
     * TRANSFER => unchanged
     */
    if (
      movementType ===
      'IN'
    ) {
      for (
        const [
          equipmentId,
          quantity,
        ] of globalTotals
      ) {
        const updated =
          await tx.equipment.updateMany(
            {
              where: {
                equipmentId,
                equipmentStatus:
                  'ACTIVE',

                equipmentQuantity:
                  {
                    lte:
                      SQL_INT_MAX -
                      quantity,
                  },
              },

              data: {
                equipmentQuantity:
                  {
                    increment:
                      quantity,
                  },
              },
            },
          );

        if (
          updated.count !== 1
        ) {
          throw new BadRequestException(
            `Equipment quantity changed, equipment became inactive, or SQL Server INT capacity was exceeded for '${equipmentId}'`,
          );
        }
      }
    }

    if (
      movementType ===
      'OUT'
    ) {
      for (
        const [
          equipmentId,
          quantity,
        ] of globalTotals
      ) {
        const updated =
          await tx.equipment.updateMany(
            {
              where: {
                equipmentId,
                equipmentStatus:
                  'ACTIVE',

                equipmentQuantity:
                  {
                    gte:
                      quantity,
                  },
              },

              data: {
                equipmentQuantity:
                  {
                    decrement:
                      quantity,
                  },
              },
            },
          );

        if (
          updated.count !== 1
        ) {
          throw new BadRequestException(
            `Global equipment quantity is insufficient or equipment is no longer ACTIVE for '${equipmentId}'`,
          );
        }
      }
    }

    /**
     * Serialized location changes are guarded one serial at a time so the
     * update predicate verifies serial identity, ownership and source location.
     */
    for (
      const item of serializedItems
    ) {
      const expectedShelfId =
        movementType === 'IN'
          ? null
          : sourceShelfId;

      const nextShelfId =
        movementType === 'OUT'
          ? null
          : destinationShelfId;

      const updated =
        await tx.serialNumber.updateMany(
          {
            where: {
              serialNumberId:
                item.serialNumberId!,

              equipmentId:
                item.equipmentId,

              shelfId:
                expectedShelfId,
            },

            data: {
              shelfId:
                nextShelfId,
            },
          },
        );

      if (
        updated.count !== 1
      ) {
        throw new BadRequestException(
          `Serial number '${item.serialNumberId}' location or ownership changed; refresh and retry`,
        );
      }
    }
  }
}
