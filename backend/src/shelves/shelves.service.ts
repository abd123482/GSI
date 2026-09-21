import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

import {
  type CreateShelfDTO,
  createShelfSchema,
  type UpdateShelfDTO,
  updateShelfSchema,
  type SearchShelfDTO,
  searchShelfSchema,
  type PaginationDTO,
  paginationSchema,
} from './dto/index.js';

const SHELF_SELECT = {
  shelfId: true,
  shelfName: true,
  shelfQuantity: true,
  stockId: true,

  stock: {
    select: {
      stockId: true,
      stockName: true,
    },
  },
} satisfies Prisma.ShelfSelect;

@Injectable()
export class ShelfService {
  constructor(private readonly prisma: PrismaService) { }

  private async assertShelfNameAvailable(
    shelfName: string,
    excludeShelfId?: string,
  ): Promise<void> {
    const existing = await this.prisma.shelf.findFirst({
      where: {
        shelfName,

        ...(excludeShelfId && {
          shelfId: {
            not: excludeShelfId,
          },
        }),
      },
      select: {
        shelfId: true,
      },
    });

    if (existing) {
      throw new BadRequestException(
        `Shelf '${shelfName}' already exists`,
      );
    }
  }

  private async assertStockExists(
    stockId: string | null | undefined,
  ): Promise<void> {
    if (!stockId) {
      return;
    }

    const stock = await this.prisma.stock.findUnique({
      where: {
        stockId,
      },
      select: {
        stockId: true,
      },
    });

    if (!stock) {
      throw new NotFoundException(
        `Stock with ID '${stockId}' not found`,
      );
    }
  }

  async createShelf(dto: CreateShelfDTO) {
    const data = createShelfSchema.parse(dto);

    await Promise.all([
      this.assertShelfNameAvailable(data.shelfName),
      this.assertStockExists(data.stockId),
    ]);

    /*
     * Shelf creation is metadata-only.
     *
     * shelfQuantity always starts at zero.
     * Only EquipmentMovementService is allowed to modify physical stock.
     */
    return this.prisma.shelf.create({
      data: {
        shelfName: data.shelfName,
        shelfQuantity: 0,
        stockId: data.stockId ?? null,
      },
      select: SHELF_SELECT,
    });
  }

  async getAllShelves(pagination: PaginationDTO) {
    const { page, limit } = paginationSchema.parse(
      pagination ?? {},
    );

    const skip = (page - 1) * limit;

    const [shelves, totalShelves] = await Promise.all([
      this.prisma.shelf.findMany({
        skip,
        take: limit,
        select: SHELF_SELECT,
        orderBy: [
          {
            shelfName: 'asc',
          },
          {
            shelfId: 'asc',
          },
        ],
      }),

      this.prisma.shelf.count(),
    ]);

    return {
      shelves,
      totalShelves,
      totalPages: Math.ceil(totalShelves / limit) || 1,
      currentPage: page,
      limit,
    };
  }

  async searchShelves(
    query: SearchShelfDTO,
    pagination: PaginationDTO,
  ) {
    const filters = searchShelfSchema.parse(query ?? {});
    const { page, limit } = paginationSchema.parse(
      pagination ?? {},
    );

    const where: Prisma.ShelfWhereInput = {};

    if (filters.shelfName) {
      where.shelfName = {
        contains: filters.shelfName,
      };
    }

    if (filters.stockId) {
      where.stockId = filters.stockId;
    }

    const skip = (page - 1) * limit;

    const [shelves, totalShelves] = await Promise.all([
      this.prisma.shelf.findMany({
        where,
        skip,
        take: limit,
        select: SHELF_SELECT,
        orderBy: [
          {
            shelfName: 'asc',
          },
          {
            shelfId: 'asc',
          },
        ],
      }),

      this.prisma.shelf.count({
        where,
      }),
    ]);

    return {
      shelves,
      totalShelves,
      totalPages: Math.ceil(totalShelves / limit) || 1,
      currentPage: page,
      limit,
    };
  }

  async getShelfById(id: string) {
    const shelfId = id?.trim();

    if (!shelfId) {
      throw new BadRequestException('Shelf ID is required');
    }

    const shelf = await this.prisma.shelf.findUnique({
      where: {
        shelfId,
      },
      select: SHELF_SELECT,
    });

    if (!shelf) {
      throw new NotFoundException(
        `Shelf with ID '${shelfId}' not found`,
      );
    }

    return shelf;
  }

  async getShelfByName(
    shelfName: string,
    pagination: PaginationDTO,
  ) {
    const name = shelfName?.trim();

    if (!name) {
      throw new BadRequestException(
        'Shelf name is required',
      );
    }

    return this.searchShelves(
      {
        shelfName: name,
      },
      pagination,
    );
  }

  async updateShelf(
    id: string,
    dto: UpdateShelfDTO,
  ) {
    const shelfId = id?.trim();

    if (!shelfId) {
      throw new BadRequestException('Shelf ID is required');
    }

    const data = updateShelfSchema.parse(dto);

    const current = await this.prisma.shelf.findUnique({
      where: {
        shelfId,
      },
      select: {
        shelfId: true,
        shelfName: true,
      },
    });

    if (!current) {
      throw new NotFoundException(
        `Shelf with ID '${shelfId}' not found`,
      );
    }

    await Promise.all([
      data.shelfName !== undefined &&
        data.shelfName !== current.shelfName
        ? this.assertShelfNameAvailable(
          data.shelfName,
          shelfId,
        )
        : Promise.resolve(),

      data.stockId !== undefined
        ? this.assertStockExists(data.stockId)
        : Promise.resolve(),
    ]);

    /*
     * shelfQuantity is intentionally not editable here.
     * Physical quantity changes happen only through MovementService.
     */
    return this.prisma.shelf.update({
      where: {
        shelfId,
      },
      data: {
        ...(data.shelfName !== undefined && {
          shelfName: data.shelfName,
        }),

        ...(data.stockId !== undefined && {
          stockId: data.stockId,
        }),
      },
      select: SHELF_SELECT,
    });
  }

  async deleteShelf(id: string) {
    const shelfId = id?.trim();

    if (!shelfId) {
      throw new BadRequestException('Shelf ID is required');
    }

    const shelf = await this.prisma.shelf.findUnique({
      where: {
        shelfId,
      },
      select: {
        shelfId: true,
        shelfName: true,
      },
    });

    if (!shelf) {
      throw new NotFoundException(
        `Shelf with ID '${shelfId}' not found`,
      );
    }

    /*
     * A shelf cannot be physically removed while it contains stock,
     * contains serialized equipment, or is referenced by movement history.
     *
     * We intentionally do NOT delete movement history.
     */
    const [
      positiveAllocation,
      serialOnShelf,
      movementLine,
      legacyMovementHeader,
    ] = await Promise.all([
      this.prisma.equipmentShelfs.findFirst({
        where: {
          shelfId,
          equipmentQuantity: {
            gt: 0,
          },
        },
        select: {
          equipmentShelfId: true,
        },
      }),

      this.prisma.serialNumber.findFirst({
        where: {
          shelfId,
        },
        select: {
          serialNumberId: true,
        },
      }),

      this.prisma.mouvementEquipment.findFirst({
        where: {
          OR: [
            {
              sourceShelfId: shelfId,
            },
            {
              destinationShelfId: shelfId,
            },
          ],
        },
        select: {
          mouvementEquipmentId: true,
        },
      }),

      this.prisma.mouvement.findFirst({
        where: {
          OR: [
            {
              sourceShelfId: shelfId,
            },
            {
              destinationShelfId: shelfId,
            },
          ],
        },
        select: {
          mouvementId: true,
        },
      }),
    ]);

    if (positiveAllocation) {
      throw new BadRequestException(
        'This shelf still contains equipment stock',
      );
    }

    if (serialOnShelf) {
      throw new BadRequestException(
        'This shelf still contains serialized equipment',
      );
    }

    if (movementLine || legacyMovementHeader) {
      throw new BadRequestException(
        'This shelf is referenced by movement history and cannot be physically deleted',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      /*
       * Zero-value EquipmentShelfs rows are operational leftovers, not
       * movement history, so they can be safely removed before shelf deletion.
       */
      await tx.equipmentShelfs.deleteMany({
        where: {
          shelfId,
        },
      });

      return tx.shelf.delete({
        where: {
          shelfId,
        },
        select: SHELF_SELECT,
      });
    });
  }

  async getShelfEquipment(
    id: string,
    pagination: PaginationDTO,
  ) {
    const shelfId = id?.trim();

    if (!shelfId) {
      throw new BadRequestException('Shelf ID is required');
    }

    const { page, limit } = paginationSchema.parse(
      pagination ?? {},
    );

    const shelf = await this.prisma.shelf.findUnique({
      where: {
        shelfId,
      },
      select: {
        shelfId: true,
      },
    });

    if (!shelf) {
      throw new NotFoundException(
        `Shelf with ID '${shelfId}' not found`,
      );
    }

    const skip = (page - 1) * limit;

    /*
     * Do not load the entire shelf stock in getShelfById().
     * Use this paginated route instead.
     */
    const where: Prisma.EquipmentShelfsWhereInput = {
      shelfId,
      equipmentQuantity: {
        gt: 0,
      },
    };

    const [allocations, totalAllocations] =
      await Promise.all([
        this.prisma.equipmentShelfs.findMany({
          where,
          skip,
          take: limit,
          select: {
            equipmentShelfId: true,
            equipmentId: true,
            shelfId: true,
            equipmentQuantity: true,

            equipment: {
              select: {
                equipmentId: true,
                equipmentName: true,
                hasSerialNumber: true,
                equipmentQuantity: true,
                minequipmentQuantity: true,
              },
            },
          },
          orderBy: [
            {
              equipmentQuantity: 'desc',
            },
            {
              equipmentShelfId: 'asc',
            },
          ],
        }),

        this.prisma.equipmentShelfs.count({
          where,
        }),
      ]);

    return {
      allocations,
      totalAllocations,
      totalPages:
        Math.ceil(totalAllocations / limit) || 1,
      currentPage: page,
      limit,
    };
  }

  async getShelfSerialNumbers(
    id: string,
    pagination: PaginationDTO,
  ) {
    const shelfId = id?.trim();

    if (!shelfId) {
      throw new BadRequestException('Shelf ID is required');
    }

    const { page, limit } = paginationSchema.parse(
      pagination ?? {},
    );

    const shelf = await this.prisma.shelf.findUnique({
      where: {
        shelfId,
      },
      select: {
        shelfId: true,
      },
    });

    if (!shelf) {
      throw new NotFoundException(
        `Shelf with ID '${shelfId}' not found`,
      );
    }

    const skip = (page - 1) * limit;

    const [serialNumbers, totalSerialNumbers] =
      await Promise.all([
        this.prisma.serialNumber.findMany({
          where: {
            shelfId,
          },
          skip,
          take: limit,

          select: {
            serialNumberId: true,
            serialNumberCode: true,
            serialNumberStatus: true,
            equipmentId: true,
            shelfId: true,

            equipment: {
              select: {
                equipmentId: true,
                equipmentName: true,
              },
            },
          },

          orderBy: [
            {
              serialNumberCode: 'asc',
            },
            {
              serialNumberId: 'asc',
            },
          ],
        }),

        this.prisma.serialNumber.count({
          where: {
            shelfId,
          },
        }),
      ]);

    return {
      serialNumbers,
      totalSerialNumbers,
      totalPages:
        Math.ceil(totalSerialNumbers / limit) || 1,
      currentPage: page,
      limit,
    };
  }
}
