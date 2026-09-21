import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  type CreateEquipmentMovementDTO,
  type CreateEquipmentMovementItemDTO,
  type MovementType,
  createEquipmentMovementSchema,
  type SearchEquipmentMovementDTO,
  searchEquipmentMovementSchema,
} from './dto/index.js';

const SQL_INT_MAX = 2_147_483_647;

const movementInclude = {
  sourceShelf: {
    select: {
      shelfId: true,
      shelfName: true,
    },
  },
  destinationShelf: {
    select: {
      shelfId: true,
      shelfName: true,
    },
  },
  createdByUser: {
    select: {
      userId: true,
      userName: true,
      userEmail: true,
    },
  },
  items: {
    orderBy: {
      rowNum: 'asc' as const,
    },
    select: {
      mouvementEquipmentId: true,
      rowNum: true,
      equipmentId: true,
      serialNumberId: true,
      mouvementQuantity: true,
      mouvementStatus: true,
      sourceShelfId: true,
      destinationShelfId: true,
      equipment: {
        select: {
          equipmentId: true,
          equipmentName: true,
          hasSerialNumber: true,
        },
      },
      serialNumber: {
        select: {
          serialNumberId: true,
          serialNumberCode: true,
          serialNumberStatus: true,
        },
      },
    },
  },
} satisfies Prisma.MouvementInclude;

@Injectable()
export class EquipmentMovementService {
  constructor(private readonly prisma: PrismaService) { }

  /**
   * Creates ONE movement header and one or many article lines.
   * The movement type/source/destination belong to the header and are copied
   * to every MovementEquipment line.
   *
   * This service is the only stock engine:
   * - EquipmentShelfs quantities
   * - Shelf total quantities
   * - standard Equipment total quantities
   * - serialized equipment locations
   */
  async createMovement(
    dto: CreateEquipmentMovementDTO,
    userId?: string,
  ) {
    const movement = createEquipmentMovementSchema.parse(dto);

    return this.prisma.$transaction(
      async (tx) => {
        const equipmentIds = [
          ...new Set(movement.items.map((item) => item.equipmentId)),
        ];

        const serialIds = [
          ...new Set(
            movement.items.flatMap((item) =>
              item.serialNumberId ? [item.serialNumberId] : [],
            ),
          ),
        ];

        if (
          serialIds.length !==
          movement.items.filter((item) => item.serialNumberId).length
        ) {
          throw new BadRequestException(
            'The same serial number cannot appear twice in one movement',
          );
        }

        await this.ensureShelvesExist(tx, movement);

        const equipments = await tx.equipment.findMany({
          where: {
            equipmentId: { in: equipmentIds },
          },
          select: {
            equipmentId: true,
            equipmentName: true,
            hasSerialNumber: true,
            equipmentQuantity: true,
          },
        });

        if (equipments.length !== equipmentIds.length) {
          const found = new Set(equipments.map((item) => item.equipmentId));
          const missing = equipmentIds.filter((id) => !found.has(id));
          throw new NotFoundException(
            `Equipment not found: ${missing.join(', ')}`,
          );
        }

        const serials = serialIds.length
          ? await tx.serialNumber.findMany({
            where: {
              serialNumberId: { in: serialIds },
            },
            select: {
              serialNumberId: true,
              equipmentId: true,
              shelfId: true,
            },
          })
          : [];

        if (serials.length !== serialIds.length) {
          const found = new Set(serials.map((item) => item.serialNumberId));
          const missing = serialIds.filter((id) => !found.has(id));
          throw new NotFoundException(
            `Serial number not found: ${missing.join(', ')}`,
          );
        }

        const equipmentById = new Map(
          equipments.map((item) => [item.equipmentId, item]),
        );
        const serialById = new Map(
          serials.map((item) => [item.serialNumberId, item]),
        );

        this.validateItems(
          movement.movementType,
          movement.sourceShelfId ?? null,
          movement.items,
          equipmentById,
          serialById,
        );

        const totalQuantity = movement.items.reduce(
          (sum, item) => sum + item.movementQuantity,
          0,
        );

        const header = await tx.mouvement.create({
          data: {
            mouvementStatus: movement.movementType,
            mouvementQuantity: totalQuantity,
            sourceShelfId: movement.sourceShelfId ?? null,
            destinationShelfId: movement.destinationShelfId ?? null,
            createdByUserId: userId ?? null,

            // Legacy parent fields are intentionally not used by new movements.
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
          movement.sourceShelfId ?? null,
          movement.destinationShelfId ?? null,
          movement.items,
          equipmentById,
          totalQuantity,
        );

        await tx.mouvementEquipment.createMany({
          data: movement.items.map((item, index) => ({
            mouvementId: header.mouvementId,
            rowNum: index + 1,
            equipmentId: item.equipmentId,
            serialNumberId: item.serialNumberId ?? null,
            mouvementQuantity: item.movementQuantity,
            mouvementStatus: movement.movementType,
            sourceShelfId: movement.sourceShelfId ?? null,
            destinationShelfId: movement.destinationShelfId ?? null,
          })),
        });

        return tx.mouvement.findUniqueOrThrow({
          where: {
            mouvementId: header.mouvementId,
          },
          include: movementInclude,
        });
      },
      {
        isolationLevel: 'Serializable',
        timeout: 30_000,
      },
    );
  }

  /**
   * Paginated movement history.
   * GET /movements?page=1&limit=20
   *
   * Optional filters:
   * movementType, equipmentId, serialNumberId, sourceShelfId,
   * destinationShelfId.
   */
  async getMovements(query: SearchEquipmentMovementDTO) {
    const filters = searchEquipmentMovementSchema.parse(query ?? {});
    const { page, limit } = filters;
    const skip = (page - 1) * limit;

    const where: Prisma.MouvementWhereInput = {};

    if (filters.movementType) {
      where.mouvementStatus = filters.movementType;
    }

    if (filters.sourceShelfId) {
      where.sourceShelfId = filters.sourceShelfId;
    }

    if (filters.destinationShelfId) {
      where.destinationShelfId = filters.destinationShelfId;
    }

    if (filters.equipmentId || filters.serialNumberId) {
      where.items = {
        some: {
          ...(filters.equipmentId && {
            equipmentId: filters.equipmentId,
          }),
          ...(filters.serialNumberId && {
            serialNumberId: filters.serialNumberId,
          }),
        },
      };
    }

    const [movements, totalMovements] = await Promise.all([
      this.prisma.mouvement.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { createdAt: 'desc' },
          { mouvementId: 'desc' },
        ],
        include: movementInclude,
      }),
      this.prisma.mouvement.count({ where }),
    ]);

    return {
      movements,
      totalMovements,
      totalPages: Math.ceil(totalMovements / limit) || 1,
      currentPage: page,
      limit,
    };
  }

  async getMovementById(movementId: string) {
    const movement = await this.prisma.mouvement.findUnique({
      where: {
        mouvementId: movementId,
      },
      include: movementInclude,
    });

    if (!movement) {
      throw new NotFoundException(
        `Movement with ID '${movementId}' not found`,
      );
    }

    return movement;
  }

  private async ensureShelvesExist(
    tx: Prisma.TransactionClient,
    movement: CreateEquipmentMovementDTO,
  ) {
    const shelfIds = [
      ...new Set(
        [movement.sourceShelfId, movement.destinationShelfId].filter(
          (value): value is string => Boolean(value),
        ),
      ),
    ];

    if (!shelfIds.length) {
      return;
    }

    const shelves = await tx.shelf.findMany({
      where: {
        shelfId: { in: shelfIds },
      },
      select: {
        shelfId: true,
      },
    });

    if (shelves.length !== shelfIds.length) {
      const found = new Set(shelves.map((item) => item.shelfId));
      const missing = shelfIds.filter((id) => !found.has(id));
      throw new NotFoundException(
        `Shelf not found: ${missing.join(', ')}`,
      );
    }
  }

  private validateItems(
    movementType: MovementType,
    sourceShelfId: string | null,
    items: CreateEquipmentMovementItemDTO[],
    equipmentById: Map<
      string,
      {
        equipmentId: string;
        equipmentName: string;
        hasSerialNumber: boolean;
        equipmentQuantity: number;
      }
    >,
    serialById: Map<
      string,
      {
        serialNumberId: string;
        equipmentId: string | null;
        shelfId: string | null;
      }
    >,
  ) {
    const standardEquipmentSeen = new Set<string>();

    for (const item of items) {
      const equipment = equipmentById.get(item.equipmentId)!;

      if (equipment.hasSerialNumber) {
        if (!item.serialNumberId) {
          throw new BadRequestException(
            `A serial number is required for '${equipment.equipmentName}'`,
          );
        }

        if (item.movementQuantity !== 1) {
          throw new BadRequestException(
            `Serialized equipment '${equipment.equipmentName}' must have quantity 1 per line`,
          );
        }

        const serial = serialById.get(item.serialNumberId);
        if (!serial) {
          throw new NotFoundException(
            `Serial number '${item.serialNumberId}' not found`,
          );
        }

        if (serial.equipmentId !== item.equipmentId) {
          throw new BadRequestException(
            `Serial number '${item.serialNumberId}' does not belong to equipment '${item.equipmentId}'`,
          );
        }

        if (movementType === 'IN') {
          if (serial.shelfId !== null) {
            throw new BadRequestException(
              `Serial number '${item.serialNumberId}' is already assigned to a shelf`,
            );
          }
        } else if (serial.shelfId !== sourceShelfId) {
          throw new BadRequestException(
            `Serial number '${item.serialNumberId}' is not on the movement source shelf`,
          );
        }
      } else {
        if (item.serialNumberId) {
          throw new BadRequestException(
            `Equipment '${equipment.equipmentName}' is not serialized`,
          );
        }

        if (standardEquipmentSeen.has(item.equipmentId)) {
          throw new BadRequestException(
            `Standard equipment '${equipment.equipmentName}' can appear only once in a movement`,
          );
        }

        standardEquipmentSeen.add(item.equipmentId);
      }
    }
  }

  private async applyStockChanges(
    tx: Prisma.TransactionClient,
    movementType: MovementType,
    sourceShelfId: string | null,
    destinationShelfId: string | null,
    items: CreateEquipmentMovementItemDTO[],
    equipmentById: Map<
      string,
      {
        equipmentId: string;
        equipmentName: string;
        hasSerialNumber: boolean;
        equipmentQuantity: number;
      }
    >,
    totalQuantity: number,
  ) {
    const allocationTotals = new Map<string, number>();
    const standardTotals = new Map<string, number>();
    const serialIds: string[] = [];

    for (const item of items) {
      allocationTotals.set(
        item.equipmentId,
        (allocationTotals.get(item.equipmentId) ?? 0) +
        item.movementQuantity,
      );

      const equipment = equipmentById.get(item.equipmentId)!;

      if (equipment.hasSerialNumber) {
        serialIds.push(item.serialNumberId!);
      } else {
        standardTotals.set(
          item.equipmentId,
          (standardTotals.get(item.equipmentId) ?? 0) +
          item.movementQuantity,
        );
      }
    }

    if (sourceShelfId) {
      for (const [equipmentId, quantity] of allocationTotals) {
        const updated = await tx.equipmentShelfs.updateMany({
          where: {
            equipmentId,
            shelfId: sourceShelfId,
            equipmentQuantity: { gte: quantity },
          },
          data: {
            equipmentQuantity: { decrement: quantity },
          },
        });

        if (updated.count !== 1) {
          throw new BadRequestException(
            `Insufficient quantity for equipment '${equipmentId}' on source shelf`,
          );
        }
      }

      const sourceShelfUpdated = await tx.shelf.updateMany({
        where: {
          shelfId: sourceShelfId,
          shelfQuantity: { gte: totalQuantity },
        },
        data: {
          shelfQuantity: { decrement: totalQuantity },
        },
      });

      if (sourceShelfUpdated.count !== 1) {
        throw new BadRequestException(
          'Source shelf quantity is insufficient or inconsistent',
        );
      }
    }

    if (destinationShelfId) {
      const destinationAllocations = await tx.equipmentShelfs.findMany({
        where: {
          shelfId: destinationShelfId,
          equipmentId: {
            in: [...allocationTotals.keys()],
          },
        },
        select: {
          equipmentShelfId: true,
          equipmentId: true,
          equipmentQuantity: true,
        },
      });

      const allocationByEquipment = new Map(
        destinationAllocations
          .filter((item) => item.equipmentId !== null)
          .map((item) => [item.equipmentId!, item]),
      );

      for (const [equipmentId, quantity] of allocationTotals) {
        const allocation = allocationByEquipment.get(equipmentId);

        if (!allocation) {
          await tx.equipmentShelfs.create({
            data: {
              equipmentId,
              shelfId: destinationShelfId,
              equipmentQuantity: quantity,
            },
          });
          continue;
        }

        const currentQuantity = allocation.equipmentQuantity ?? 0;
        if (currentQuantity > SQL_INT_MAX - quantity) {
          throw new BadRequestException(
            `Destination allocation exceeds SQL Server INT capacity for equipment '${equipmentId}'`,
          );
        }

        await tx.equipmentShelfs.update({
          where: {
            equipmentShelfId: allocation.equipmentShelfId,
          },
          data: {
            equipmentQuantity:
              allocation.equipmentQuantity === null
                ? quantity
                : { increment: quantity },
          },
        });
      }

      const destinationShelf = await tx.shelf.findUnique({
        where: { shelfId: destinationShelfId },
        select: { shelfQuantity: true },
      });

      if (!destinationShelf) {
        throw new NotFoundException(
          `Destination shelf '${destinationShelfId}' not found`,
        );
      }

      const currentShelfQuantity = destinationShelf.shelfQuantity ?? 0;
      if (currentShelfQuantity > SQL_INT_MAX - totalQuantity) {
        throw new BadRequestException(
          'Destination shelf quantity exceeds SQL Server INT capacity',
        );
      }

      await tx.shelf.update({
        where: { shelfId: destinationShelfId },
        data: {
          shelfQuantity:
            destinationShelf.shelfQuantity === null
              ? totalQuantity
              : { increment: totalQuantity },
        },
      });
    }

    if (movementType === 'IN') {
      for (const [equipmentId, quantity] of standardTotals) {
        const updated = await tx.equipment.updateMany({
          where: {
            equipmentId,
            equipmentQuantity: { lte: SQL_INT_MAX - quantity },
          },
          data: {
            equipmentQuantity: { increment: quantity },
          },
        });

        if (updated.count !== 1) {
          throw new BadRequestException(
            `Equipment quantity exceeds SQL Server INT capacity for '${equipmentId}'`,
          );
        }
      }
    }

    if (movementType === 'OUT') {
      for (const [equipmentId, quantity] of standardTotals) {
        const updated = await tx.equipment.updateMany({
          where: {
            equipmentId,
            equipmentQuantity: { gte: quantity },
          },
          data: {
            equipmentQuantity: { decrement: quantity },
          },
        });

        if (updated.count !== 1) {
          throw new BadRequestException(
            `Global equipment quantity is insufficient for '${equipmentId}'`,
          );
        }
      }
    }

    if (serialIds.length) {
      const expectedShelfId = movementType === 'IN' ? null : sourceShelfId;
      const nextShelfId = movementType === 'OUT' ? null : destinationShelfId;

      const updatedSerials = await tx.serialNumber.updateMany({
        where: {
          serialNumberId: { in: serialIds },
          shelfId: expectedShelfId,
        },
        data: {
          shelfId: nextShelfId,
        },
      });

      if (updatedSerials.count !== serialIds.length) {
        throw new BadRequestException(
          'One or more serial number locations changed; refresh and retry',
        );
      }
    }
  }
}
