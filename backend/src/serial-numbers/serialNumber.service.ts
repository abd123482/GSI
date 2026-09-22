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
      equipmentStatus: true,
    },
  },

  shelf: {
    select: {
      shelfId: true,
      shelfName: true,
      stockId: true,
    },
  },
} satisfies Prisma.SerialNumberSelect;

@Injectable()
export class SerialNumberService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  private async getSerializedEquipmentOrThrow(
    equipmentId: string,
  ) {
    const equipment =
      await this.prisma.equipment.findUnique({
        where: {
          equipmentId,
        },
        select: {
          equipmentId: true,
          equipmentName: true,
          hasSerialNumber: true,
          equipmentStatus: true,
        },
      });

    if (!equipment) {
      throw new NotFoundException(
        `Equipment with ID '${equipmentId}' not found`,
      );
    }

    if (
      !equipment.hasSerialNumber
    ) {
      throw new BadRequestException(
        'Serial numbers can only be created for serialized equipment',
      );
    }

    return equipment;
  }

  private async assertSerialCodeAvailable(
    serialNumberCode: string,
  ): Promise<void> {
    const existing =
      await this.prisma.serialNumber.findUnique({
        where: {
          serialNumberCode,
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
    const data =
      createSerialNumberSchema.parse(dto);

    await this.getSerializedEquipmentOrThrow(
      data.equipmentId,
    );

    await this.assertSerialCodeAvailable(
      data.serialNumberCode,
    );

    /*
     * Identity creation does NOT change physical equipment quantity.
     * shelfId starts NULL.
     * Physical stock enters through an IN movement.
     */
    return this.prisma.serialNumber.create({
      data: {
        serialNumberCode:
          data.serialNumberCode,
        serialNumberStatus:
          data.serialNumberStatus ??
          'AVAILABLE',
        equipmentId:
          data.equipmentId,
        shelfId: null,
      },
      select: SERIAL_SELECT,
    });
  }

  async createBatchSerialNumbers(
    dto: CreateBatchSerialNumberDTO,
  ) {
    const data =
      createBatchSerialNumberSchema.parse(
        dto,
      );

    await this.getSerializedEquipmentOrThrow(
      data.equipmentId,
    );

    const normalizedCodes =
      data.serialNumberCodes.map(
        (code) => code.trim(),
      );

    if (
      new Set(normalizedCodes).size !==
      normalizedCodes.length
    ) {
      throw new BadRequestException(
        'Duplicate serial numbers exist inside the request',
      );
    }

    const existing =
      await this.prisma.serialNumber.findMany({
        where: {
          serialNumberCode: {
            in: normalizedCodes,
          },
        },
        select: {
          serialNumberCode: true,
        },
      });

    if (
      existing.length > 0
    ) {
      throw new BadRequestException(
        `Serial number(s) already exist: ${existing
          .map(
            (item) =>
              item.serialNumberCode,
          )
          .join(', ')}`,
      );
    }

    const result =
      await this.prisma.serialNumber.createMany({
        data: normalizedCodes.map(
          (serialNumberCode) => ({
            serialNumberCode,
            serialNumberStatus:
              data.serialNumberStatus ??
              'AVAILABLE',
            equipmentId:
              data.equipmentId,
            shelfId: null,
          }),
        ),
      });

    return {
      success: true,
      count: result.count,
      equipmentId:
        data.equipmentId,
    };
  }

  async getSerialNumbers(
    query: SearchSerialNumberDTO,
    pagination: PaginationDTO,
  ) {
    const filters =
      searchSerialNumberSchema.parse(
        query ?? {},
      );

    const {
      page,
      limit,
    } = paginationSchema.parse(
      pagination ?? {},
    );

    const where:
      Prisma.SerialNumberWhereInput =
      {};

    if (
      filters.serialNumberCode
    ) {
      where.serialNumberCode = {
        contains:
          filters.serialNumberCode,
      };
    }

    if (
      filters.serialNumberStatus
    ) {
      where.serialNumberStatus =
        filters.serialNumberStatus;
    }

    if (filters.equipmentId) {
      where.equipmentId =
        filters.equipmentId;
    }

    if (filters.shelfId) {
      where.shelfId =
        filters.shelfId;
    }

    const skip =
      (page - 1) * limit;

    const [
      serialNumbers,
      totalSerialNumbers,
    ] = await Promise.all([
      this.prisma.serialNumber.findMany({
        where,
        skip,
        take: limit,
        select: SERIAL_SELECT,
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
        where,
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

  async getSerialNumberById(
    id: string,
  ) {
    const serialNumberId =
      id?.trim();

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

  async getSerialNumberByCode(
    code: string,
  ) {
    const serialNumberCode =
      code?.trim();

    if (!serialNumberCode) {
      throw new BadRequestException(
        'Serial number code is required',
      );
    }

    const serialNumber =
      await this.prisma.serialNumber.findUnique({
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
    const serialNumberId =
      id?.trim();

    if (!serialNumberId) {
      throw new BadRequestException(
        'Serial number ID is required',
      );
    }

    const data =
      updateSerialNumberSchema.parse(
        dto,
      );

    const current =
      await this.prisma.serialNumber.findUnique({
        where: {
          serialNumberId,
        },
        select: {
          serialNumberId: true,
        },
      });

    if (!current) {
      throw new NotFoundException(
        `Serial number with ID '${serialNumberId}' not found`,
      );
    }

    /*
     * serialNumberCode, equipmentId and shelfId are immutable here.
     * Only status is editable.
     */
    return this.prisma.serialNumber.update({
      where: {
        serialNumberId,
      },
      data: {
        serialNumberStatus:
          data.serialNumberStatus,
      },
      select: SERIAL_SELECT,
    });
  }

  async updateSerialNumberStatus(
    id: string,
    dto: UpdateSerialNumberStatusDTO,
  ) {
    const data =
      updateSerialNumberStatusSchema.parse(
        dto,
      );

    return this.updateSerialNumber(
      id,
      {
        serialNumberStatus:
          data.serialNumberStatus,
      },
    );
  }

  async deleteSerialNumber(
    id: string,
  ) {
    const serialNumberId =
      id?.trim();

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

    if (serialNumber.shelfId) {
      throw new BadRequestException(
        'This serial number is currently on a shelf. Create an OUT movement before deleting it.',
      );
    }

    const [
      movementLine,
      legacyMovementHeader,
    ] = await Promise.all([
      this.prisma.mouvementEquipment.findFirst({
        where: {
          serialNumberId,
        },
        select: {
          mouvementEquipmentId:
            true,
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

    if (
      movementLine ||
      legacyMovementHeader
    ) {
      throw new BadRequestException(
        'This serial number has movement history and cannot be physically deleted',
      );
    }

    /*
     * Identity deletion does NOT change physical equipment quantity.
     */
    return this.prisma.serialNumber.delete({
      where: {
        serialNumberId,
      },
      select: SERIAL_SELECT,
    });
  }
}
