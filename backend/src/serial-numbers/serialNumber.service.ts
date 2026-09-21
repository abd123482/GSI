import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

import {
  type CreateSerialNumberDTO,
  createSerialNumberSchema,
  type CreateBatchSerialNumberDTO,
  createBatchSerialNumberSchema,
  type UpdateSerialNumberDTO,
  updateSerialNumberSchema,
  type UpdateSerialNumberStatusDTO,
  updateSerialNumberStatusSchema,
  type SearchSerialNumberDTO,
  searchSerialNumberSchema,
  type PaginationDTO,
  paginationSchema,
} from './dto/index.js';

const SERIAL_SELECT = {
  serialNumberId: true,
  serialNumberCode: true,
  serialNumberStatus: true,
  equipmentId: true,
  shelfId: true,

  equipment: {
    select: {
      equipmentId: true,
      equipmentName: true,
      hasSerialNumber: true,
    },
  },

  shelf: {
    select: {
      shelfId: true,
      shelfName: true,
    },
  },
} satisfies Prisma.SerialNumberSelect;

@Injectable()
export class SerialNumberService {
  constructor(private readonly prisma: PrismaService) { }

  private async getSerializedEquipmentOrThrow(
    equipmentId: string,
  ) {
    const equipment = await this.prisma.equipment.findUnique({
      where: {
        equipmentId,
      },
      select: {
        equipmentId: true,
        equipmentName: true,
        hasSerialNumber: true,
      },
    });

    if (!equipment) {
      throw new NotFoundException(
        `Equipment with ID '${equipmentId}' not found`,
      );
    }

    if (!equipment.hasSerialNumber) {
      throw new BadRequestException(
        'Serial numbers can only be created for serialized equipment',
      );
    }

    return equipment;
  }

  private async assertSerialCodeAvailable(
    serialNumberCode: string,
    excludeSerialNumberId?: string,
  ): Promise<void> {
    const existing = await this.prisma.serialNumber.findFirst({
      where: {
        serialNumberCode,

        ...(excludeSerialNumberId && {
          serialNumberId: {
            not: excludeSerialNumberId,
          },
        }),
      },
      select: {
        serialNumberId: true,
      },
    });

    if (existing) {
      throw new BadRequestException(
        `Serial number '${serialNumberCode}' already exists`,
      );
    }
  }

  async createSerialNumber(
    dto: CreateSerialNumberDTO,
  ) {
    const data = createSerialNumberSchema.parse(dto);

    await this.getSerializedEquipmentOrThrow(
      data.equipmentId,
    );

    await this.assertSerialCodeAvailable(
      data.serialNumberCode,
    );

    /*
     * Serial identity is created without a shelf.
     *
     * A serial reaches/leaves/changes a physical shelf only through
     * EquipmentMovementService.
     *
     * Equipment.equipmentQuantity for serialized equipment equals the number
     * of SerialNumber records, therefore create/delete updates that total.
     */
    return this.prisma.$transaction(async (tx) => {
      const serialNumber = await tx.serialNumber.create({
        data: {
          serialNumberCode: data.serialNumberCode,
          serialNumberStatus:
            data.serialNumberStatus ?? 'AVAILABLE',
          equipmentId: data.equipmentId,
          shelfId: null,
        },
        select: SERIAL_SELECT,
      });

      await tx.equipment.update({
        where: {
          equipmentId: data.equipmentId,
        },
        data: {
          equipmentQuantity: {
            increment: 1,
          },
        },
      });

      return serialNumber;
    });
  }

  async createBatchSerialNumbers(
    dto: CreateBatchSerialNumberDTO,
  ) {
    const data = createBatchSerialNumberSchema.parse(dto);

    await this.getSerializedEquipmentOrThrow(
      data.equipmentId,
    );

    /*
     * Normalize/detect duplicates inside the request before touching the DB.
     */
    const normalizedCodes = data.serialNumberCodes.map(
      (code) => code.trim(),
    );

    const uniqueCodes = new Set(normalizedCodes);

    if (uniqueCodes.size !== normalizedCodes.length) {
      throw new BadRequestException(
        'Duplicate serial numbers exist inside the request',
      );
    }

    /*
     * One DB query instead of one existence query per serial.
     */
    const existing = await this.prisma.serialNumber.findMany({
      where: {
        serialNumberCode: {
          in: normalizedCodes,
        },
      },
      select: {
        serialNumberCode: true,
      },
    });

    if (existing.length > 0) {
      throw new BadRequestException(
        `Serial number(s) already exist: ${existing
          .map((item) => item.serialNumberCode)
          .join(', ')}`,
      );
    }

    const count = normalizedCodes.length;

    return this.prisma.$transaction(async (tx) => {
      await tx.serialNumber.createMany({
        data: normalizedCodes.map((serialNumberCode) => ({
          serialNumberCode,
          serialNumberStatus:
            data.serialNumberStatus ?? 'AVAILABLE',
          equipmentId: data.equipmentId,
          shelfId: null,
        })),
      });

      await tx.equipment.update({
        where: {
          equipmentId: data.equipmentId,
        },
        data: {
          equipmentQuantity: {
            increment: count,
          },
        },
      });

      return {
        success: true,
        count,
        equipmentId: data.equipmentId,
      };
    });
  }

  async getSerialNumbers(
    query: SearchSerialNumberDTO,
    pagination: PaginationDTO,
  ) {
    const filters = searchSerialNumberSchema.parse(
      query ?? {},
    );

    const { page, limit } = paginationSchema.parse(
      pagination ?? {},
    );

    const where: Prisma.SerialNumberWhereInput = {};

    if (filters.serialNumberCode) {
      where.serialNumberCode = {
        contains: filters.serialNumberCode,
      };
    }

    if (filters.serialNumberStatus) {
      where.serialNumberStatus =
        filters.serialNumberStatus;
    }

    if (filters.equipmentId) {
      where.equipmentId = filters.equipmentId;
    }

    if (filters.shelfId) {
      where.shelfId = filters.shelfId;
    }

    const skip = (page - 1) * limit;

    const [serialNumbers, totalSerialNumbers] =
      await Promise.all([
        this.prisma.serialNumber.findMany({
          where,
          skip,
          take: limit,
          select: SERIAL_SELECT,
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
          where,
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

  async getSerialNumberById(id: string) {
    const serialNumberId = id?.trim();

    if (!serialNumberId) {
      throw new BadRequestException(
        'Serial number ID is required',
      );
    }

    const serialNumber =
      await this.prisma.serialNumber.findUnique({
        where: {
          serialNumberId,
        },
        select: SERIAL_SELECT,
      });

    if (!serialNumber) {
      throw new NotFoundException(
        `Serial number with ID '${serialNumberId}' not found`,
      );
    }

    return serialNumber;
  }

  async getSerialNumberByCode(code: string) {
    const serialNumberCode = code?.trim();

    if (!serialNumberCode) {
      throw new BadRequestException(
        'Serial number code is required',
      );
    }

    const serialNumber =
      await this.prisma.serialNumber.findFirst({
        where: {
          serialNumberCode,
        },
        select: SERIAL_SELECT,
      });

    if (!serialNumber) {
      throw new NotFoundException(
        `Serial number '${serialNumberCode}' not found`,
      );
    }

    return serialNumber;
  }

  async updateSerialNumber(
    id: string,
    dto: UpdateSerialNumberDTO,
  ) {
    const serialNumberId = id?.trim();

    if (!serialNumberId) {
      throw new BadRequestException(
        'Serial number ID is required',
      );
    }

    const data = updateSerialNumberSchema.parse(dto);

    const current =
      await this.prisma.serialNumber.findUnique({
        where: {
          serialNumberId,
        },
        select: {
          serialNumberId: true,
          serialNumberCode: true,
        },
      });

    if (!current) {
      throw new NotFoundException(
        `Serial number with ID '${serialNumberId}' not found`,
      );
    }

    if (
      data.serialNumberCode !== undefined &&
      data.serialNumberCode !== current.serialNumberCode
    ) {
      await this.assertSerialCodeAvailable(
        data.serialNumberCode,
        serialNumberId,
      );
    }

    /*
     * equipmentId and shelfId are intentionally not editable here.
     *
     * - equipment ownership is immutable after creation.
     * - physical location changes only through MovementService.
     */
    return this.prisma.serialNumber.update({
      where: {
        serialNumberId,
      },
      data: {
        ...(data.serialNumberCode !== undefined && {
          serialNumberCode:
            data.serialNumberCode,
        }),

        ...(data.serialNumberStatus !== undefined && {
          serialNumberStatus:
            data.serialNumberStatus,
        }),
      },
      select: SERIAL_SELECT,
    });
  }

  async updateSerialNumberStatus(
    id: string,
    dto: UpdateSerialNumberStatusDTO,
  ) {
    const data =
      updateSerialNumberStatusSchema.parse(dto);

    return this.updateSerialNumber(id, {
      serialNumberStatus:
        data.serialNumberStatus,
    });
  }

  async deleteSerialNumber(id: string) {
    const serialNumberId = id?.trim();

    if (!serialNumberId) {
      throw new BadRequestException(
        'Serial number ID is required',
      );
    }

    const serialNumber =
      await this.prisma.serialNumber.findUnique({
        where: {
          serialNumberId,
        },
        select: {
          serialNumberId: true,
          serialNumberCode: true,
          equipmentId: true,
          shelfId: true,
        },
      });

    if (!serialNumber) {
      throw new NotFoundException(
        `Serial number with ID '${serialNumberId}' not found`,
      );
    }

    /*
     * A serial currently on a shelf must leave stock through an OUT movement.
     * SerialNumberService must never secretly modify physical stock.
     */
    if (serialNumber.shelfId) {
      throw new BadRequestException(
        'This serial number is currently on a shelf. Create an OUT movement before deleting it.',
      );
    }

    /*
     * Never destroy movement history to make a serial deletable.
     */
    const [movementLine, legacyMovementHeader] =
      await Promise.all([
        this.prisma.mouvementEquipment.findFirst({
          where: {
            serialNumberId,
          },
          select: {
            mouvementEquipmentId: true,
          },
        }),

        this.prisma.mouvement.findFirst({
          where: {
            serialNumberId,
          },
          select: {
            mouvementId: true,
          },
        }),
      ]);

    if (movementLine || legacyMovementHeader) {
      throw new BadRequestException(
        'This serial number has movement history and cannot be physically deleted',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const deleted = await tx.serialNumber.delete({
        where: {
          serialNumberId,
        },
        select: SERIAL_SELECT,
      });

      if (serialNumber.equipmentId) {
        /*
         * Conditional decrement protects against an already-corrupt zero total.
         */
        const changed = await tx.equipment.updateMany({
          where: {
            equipmentId:
              serialNumber.equipmentId,
            equipmentQuantity: {
              gt: 0,
            },
          },
          data: {
            equipmentQuantity: {
              decrement: 1,
            },
          },
        });

        if (changed.count !== 1) {
          throw new BadRequestException(
            'Equipment serialized quantity is inconsistent',
          );
        }
      }

      return deleted;
    });
  }
}
