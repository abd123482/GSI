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
  stockId: true,
  status: true,
  stock: {
    select: {
      stockId: true,
      stockName: true,
      status: true
    },
  },
} satisfies Prisma.ShelfSelect;

@Injectable()
export class ShelfService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  private async assertShelfNameAvailable(
    shelfName: string,
    excludeShelfId?: string,
  ): Promise<void> {
    const existing =
      await this.prisma.shelf.findFirst({
        where: {
          shelfName,
          ...(excludeShelfId
            ? {
                shelfId: {
                  not: excludeShelfId,
                },
              }
            : {}),
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

  private async assertStockIsActive(
    stockId: string,
  ): Promise<void> {
    const stock =
      await this.prisma.stock.findUnique({
        where: {
          stockId,
        },
        select: {
          stockId: true,
          stockName: true,
          status: true,
        },
      });

    if (!stock) {
      throw new NotFoundException(
        `Stock with ID '${stockId}' not found`,
      );
    }

    if (!stock.status) {
      throw new BadRequestException(
        `Stock '${stock.stockName ?? stockId}' is INACTIVE and cannot receive shelves`,
      );
    }
  }

  private async assertShelfExists(
    shelfId: string,
  ): Promise<void> {
    const shelf =
      await this.prisma.shelf.findUnique({
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
  }

  async createShelf(
    dto: CreateShelfDTO,
  ) {
    const data =
      createShelfSchema.parse(dto);

    await Promise.all([
      this.assertShelfNameAvailable(
        data.shelfName,
      ),
      this.assertStockIsActive(
        data.stockId,
      ),
    ]);


    return this.prisma.shelf.create({
      data: {
        shelfName: data.shelfName,
        stockId: data.stockId,
        status: data.status ?? true,
      },
      select: SHELF_SELECT,
    });
  }

  async getAllShelves(
    pagination: PaginationDTO,
  ) {
    const { page, limit } =
      paginationSchema.parse(
        pagination ?? {},
      );

    const skip =
      (page - 1) * limit;

    const [
      shelves,
      totalShelves,
    ] = await Promise.all([
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
      totalPages:
        Math.ceil(
          totalShelves / limit,
        ) || 1,
      currentPage: page,
      limit,
    };
  }

  async searchShelves(
    query: SearchShelfDTO,
    pagination: PaginationDTO,
  ) {
    const filters =
      searchShelfSchema.parse(
        query ?? {},
      );

    const { page, limit } =
      paginationSchema.parse(
        pagination ?? {},
      );

    const where:
      any = {};

    if (filters.shelfName) {
      where.shelfName = {
        contains:
          filters.shelfName,
      };
    }

    if (filters.stockId) {
      where.stockId =
        filters.stockId;
    }

    if (filters.status !== undefined) {
      where.status = filters.status;
    }

    const skip =
      (page - 1) * limit;

    const [
      shelves,
      totalShelves,
    ] = await Promise.all([
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
      totalPages:
        Math.ceil(
          totalShelves / limit,
        ) || 1,
      currentPage: page,
      limit,
    };
  }

  async getShelfById(
    id: string,
  ) {
    const shelfId =
      id?.trim();

    if (!shelfId) {
      throw new BadRequestException(
        'Shelf ID is required',
      );
    }

    const shelf =
      await this.prisma.shelf.findUnique({
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
    const name =
      shelfName?.trim();

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
    const shelfId =
      id?.trim();

    if (!shelfId) {
      throw new BadRequestException(
        'Shelf ID is required',
      );
    }

    const data =
      updateShelfSchema.parse(dto);

    const current =
      await this.prisma.shelf.findUnique({
        where: {
          shelfId,
        },
        select: {
          shelfId: true,
          shelfName: true,
          stockId: true,
        },
      });

    if (!current) {
      throw new NotFoundException(
        `Shelf with ID '${shelfId}' not found`,
      );
    }

    if (data.status === false) {
      const serialOnShelf = await this.prisma.serialNumber.findFirst({
        where: { shelfId },
      });
      if (serialOnShelf) {
        throw new BadRequestException('Cannot set shelf to INACTIVE if it contains serialized items');
      }
    }

    const validations:
      Promise<void>[] = [];

    if (
      data.shelfName !== undefined &&
      data.shelfName !==
        current.shelfName
    ) {
      validations.push(
        this.assertShelfNameAvailable(
          data.shelfName,
          shelfId,
        ),
      );
    }

    if (
      data.stockId !== undefined &&
      data.stockId !==
        current.stockId
    ) {
      validations.push(
        this.assertStockIsActive(
          data.stockId,
        ),
      );
    }

    await Promise.all(
      validations,
    );

    return this.prisma.shelf.update({
      where: {
        shelfId,
      },
      data: {
        ...(data.shelfName !==
          undefined && {
          shelfName:
            data.shelfName,
        }),
        ...(data.stockId !==
          undefined && {
          stockId:
            data.stockId,
        }),
        ...(data.status !== undefined && {
          status: data.status,
        }),
      },
      select: SHELF_SELECT,
    });
  }

  async deleteShelf(
    id: string,
  ) {
    const shelfId =
      id?.trim();

    if (!shelfId) {
      throw new BadRequestException(
        'Shelf ID is required',
      );
    }

    const shelf =
      await this.prisma.shelf.findUnique({
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

    const [
      serialOnShelf,
      movementLine,
      legacyMovementHeader,
    ] = await Promise.all([

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
              sourceShelfId:
                shelfId,
            },
            {
              destinationShelfId:
                shelfId,
            },
          ],
        },
        select: {
          mouvementEquipmentId:
            true,
        },
      }),

      this.prisma.mouvement.findFirst({
        where: {
          OR: [
            {
              sourceShelfId:
                shelfId,
            },
            {
              destinationShelfId:
                shelfId,
            },
          ],
        },
        select: {
          mouvementId: true,
        },
      }),
    ]);

    if (serialOnShelf) {
      throw new BadRequestException(
        'This shelf still contains serialized equipment',
      );
    }

    if (
      movementLine ||
      legacyMovementHeader
    ) {
      throw new BadRequestException(
        'This shelf is referenced by movement history and cannot be physically deleted',
      );
    }

    return this.prisma.$transaction(
      async (tx) => {
        return tx.shelf.delete({
          where: {
            shelfId,
          },
          select: SHELF_SELECT,
        });
      },
    );
  }



  async getShelfSerialNumbers(
    id: string,
    pagination: PaginationDTO,
  ) {
    const shelfId =
      id?.trim();

    if (!shelfId) {
      throw new BadRequestException(
        'Shelf ID is required',
      );
    }

    const { page, limit } =
      paginationSchema.parse(
        pagination ?? {},
      );

    await this.assertShelfExists(
      shelfId,
    );

    const skip =
      (page - 1) * limit;

    const [
      serialNumbers,
      totalSerialNumbers,
    ] = await Promise.all([
      this.prisma.serialNumber.findMany({
        where: {
          shelfId,
        },
        skip,
        take: limit,
        select: {
          serialNumberId: true,
          serialNumberCode:
            true,
          serialNumberStatus:
            true,
          equipmentId: true,
          shelfId: true,
          equipment: {
            select: {
              equipmentId: true,
              equipmentName:
                true,
              equipmentStatus:
                true,
            },
          },
        },
        orderBy: [
          {
            serialNumberCode:
              'asc',
          },
          {
            serialNumberId:
              'asc',
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
        Math.ceil(
          totalSerialNumbers /
            limit,
        ) || 1,
      currentPage: page,
      limit,
    };
  }
}
