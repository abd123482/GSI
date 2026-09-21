import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

import {
  type CreateEquipmentDTO,
  createEquipmentSchema,
  type UpdateEquipmentDTO,
  updateEquipmentSchema,
  type SearchEquipmentDTO,
  searchEquipmentSchema,
  type PaginationDTO,
  paginationSchema,
} from './dto/index.js';

const EQUIPMENT_LIST_SELECT = {
  equipmentId: true,
  equipmentName: true,
  hasSerialNumber: true,
  equipmentQuantity: true,
  minequipmentQuantity: true,

  equipmentShelfs: {
    where: {
      equipmentQuantity: {
        gt: 0,
      },
    },
    select: {
      equipmentShelfId: true,
      equipmentId: true,
      shelfId: true,
      equipmentQuantity: true,
      shelf: {
        select: {
          shelfId: true,
          shelfName: true,
        },
      },
    },
    orderBy: {
      equipmentQuantity: 'desc' as const,
    },
  },

  _count: {
    select: {
      serialNumbers: true,
      equipmentShelfs: true,
    },
  },
} satisfies Prisma.EquipmentSelect;

@Injectable()
export class EquipmentService {
  constructor(private readonly prisma: PrismaService) { }

  private async assertEquipmentNameAvailable(
    equipmentName: string,
    excludeEquipmentId?: string,
  ): Promise<void> {
    const existing = await this.prisma.equipment.findFirst({
      where: {
        equipmentName,
        ...(excludeEquipmentId && {
          equipmentId: {
            not: excludeEquipmentId,
          },
        }),
      },
      select: {
        equipmentId: true,
      },
    });

    if (existing) {
      throw new BadRequestException(
        `Equipment '${equipmentName}' already exists`,
      );
    }
  }

  async createEquipment(dto: CreateEquipmentDTO) {
    const data = createEquipmentSchema.parse(dto);

    await this.assertEquipmentNameAvailable(data.equipmentName);

    /*
     * Equipment creation is metadata-only.
     *
     * Stock always starts at zero.
     * Physical stock must enter through POST /movements with movementType=IN.
     *
     * For serialized equipment, SerialNumberService owns serial creation and
     * maintains Equipment.equipmentQuantity as the number of serial records.
     */
    return this.prisma.equipment.create({
      data: {
        equipmentName: data.equipmentName,
        hasSerialNumber: data.hasSerialNumber,
        equipmentQuantity: 0,
        minequipmentQuantity: data.minEquipmentQuantity ?? 0,
      },
      select: {
        equipmentId: true,
        equipmentName: true,
        hasSerialNumber: true,
        equipmentQuantity: true,
        minequipmentQuantity: true,
      },
    });
  }

  async getAllEquipments(query: PaginationDTO) {
    const { page, limit } = paginationSchema.parse(query ?? {});
    const skip = (page - 1) * limit;

    const [equipments, totalEquipments] = await Promise.all([
      this.prisma.equipment.findMany({
        skip,
        take: limit,
        select: EQUIPMENT_LIST_SELECT,
        orderBy: [
          {
            equipmentName: 'asc',
          },
          {
            equipmentId: 'asc',
          },
        ],
      }),

      this.prisma.equipment.count(),
    ]);

    return {
      equipments,
      totalEquipments,
      totalPages: Math.ceil(totalEquipments / limit) || 1,
      currentPage: page,
      limit,
    };
  }

  async searchEquipments(
    query: SearchEquipmentDTO,
    pagination: PaginationDTO,
  ) {
    const filters = searchEquipmentSchema.parse(query ?? {});
    const { page, limit } = paginationSchema.parse(pagination ?? {});
    const skip = (page - 1) * limit;

    const where: Prisma.EquipmentWhereInput = {};

    if (filters.equipmentName) {
      where.equipmentName = {
        contains: filters.equipmentName,
      };
    }

    if (filters.hasSerialNumber !== undefined) {
      where.hasSerialNumber = filters.hasSerialNumber;
    }

    if (filters.equipmentQuantity !== undefined) {
      where.equipmentQuantity = filters.equipmentQuantity;
    }

    if (filters.minEquipmentQuantity !== undefined) {
      where.minequipmentQuantity = filters.minEquipmentQuantity;
    }

    if (filters.shelfId || filters.equipmentShelfId) {
      where.equipmentShelfs = {
        some: {
          ...(filters.shelfId && {
            shelfId: filters.shelfId,
          }),

          ...(filters.equipmentShelfId && {
            equipmentShelfId: filters.equipmentShelfId,
          }),
        },
      };
    }

    const [equipments, totalEquipments] = await Promise.all([
      this.prisma.equipment.findMany({
        where,
        skip,
        take: limit,
        select: EQUIPMENT_LIST_SELECT,
        orderBy: [
          {
            equipmentName: 'asc',
          },
          {
            equipmentId: 'asc',
          },
        ],
      }),

      this.prisma.equipment.count({
        where,
      }),
    ]);

    return {
      equipments,
      totalEquipments,
      totalPages: Math.ceil(totalEquipments / limit) || 1,
      currentPage: page,
      limit,
    };
  }

  async getEquipmentById(id: string) {
    const equipmentId = id?.trim();

    if (!equipmentId) {
      throw new BadRequestException('Equipment ID is required');
    }

    /*
     * Do not include all serial numbers here.
     * An equipment may have thousands/millions of serial rows.
     * Use GET /equipment/:id/serial-numbers for paginated serial retrieval.
     */
    const equipment = await this.prisma.equipment.findUnique({
      where: {
        equipmentId,
      },
      select: EQUIPMENT_LIST_SELECT,
    });

    if (!equipment) {
      throw new NotFoundException(
        `Equipment with ID '${equipmentId}' not found`,
      );
    }

    return equipment;
  }

  async updateEquipment(
    id: string,
    dto: UpdateEquipmentDTO,
  ) {
    const equipmentId = id?.trim();

    if (!equipmentId) {
      throw new BadRequestException('Equipment ID is required');
    }

    const data = updateEquipmentSchema.parse(dto);

    const current = await this.prisma.equipment.findUnique({
      where: {
        equipmentId,
      },
      select: {
        equipmentId: true,
        equipmentName: true,
      },
    });

    if (!current) {
      throw new NotFoundException(
        `Equipment with ID '${equipmentId}' not found`,
      );
    }

    if (
      data.equipmentName !== undefined &&
      data.equipmentName !== current.equipmentName
    ) {
      await this.assertEquipmentNameAvailable(
        data.equipmentName,
        equipmentId,
      );
    }

    /*
     * equipmentQuantity is NOT editable here.
     * It changes through MovementService for standard equipment and through
     * SerialNumberService create/delete for serialized equipment.
     *
     * hasSerialNumber is intentionally immutable after creation. Converting
     * an existing article between standard/serialized modes creates difficult
     * historical and stock invariants and is intentionally not supported here.
     */
    return this.prisma.equipment.update({
      where: {
        equipmentId,
      },
      data: {
        ...(data.equipmentName !== undefined && {
          equipmentName: data.equipmentName,
        }),

        ...(data.minEquipmentQuantity !== undefined && {
          minequipmentQuantity: data.minEquipmentQuantity,
        }),
      },
      select: {
        equipmentId: true,
        equipmentName: true,
        hasSerialNumber: true,
        equipmentQuantity: true,
        minequipmentQuantity: true,
      },
    });
  }

  async deleteEquipment(id: string) {
    const equipmentId = id?.trim();

    if (!equipmentId) {
      throw new BadRequestException('Equipment ID is required');
    }

    const equipment = await this.prisma.equipment.findUnique({
      where: {
        equipmentId,
      },
      select: {
        equipmentId: true,
        equipmentName: true,
      },
    });

    if (!equipment) {
      throw new NotFoundException(
        `Equipment with ID '${equipmentId}' not found`,
      );
    }

    /*
     * Never delete movement history to make an equipment deletable.
     * History is immutable audit data.
     */
    const [
      movementLine,
      legacyMovementHeader,
      serialNumber,
      positiveAllocation,
    ] = await Promise.all([
      this.prisma.mouvementEquipment.findFirst({
        where: {
          equipmentId,
        },
        select: {
          mouvementEquipmentId: true,
        },
      }),

      this.prisma.mouvement.findFirst({
        where: {
          equipmentId,
        },
        select: {
          mouvementId: true,
        },
      }),

      this.prisma.serialNumber.findFirst({
        where: {
          equipmentId,
        },
        select: {
          serialNumberId: true,
        },
      }),

      this.prisma.equipmentShelfs.findFirst({
        where: {
          equipmentId,
          equipmentQuantity: {
            gt: 0,
          },
        },
        select: {
          equipmentShelfId: true,
        },
      }),
    ]);

    if (movementLine || legacyMovementHeader) {
      throw new BadRequestException(
        'This equipment has movement history and cannot be physically deleted',
      );
    }

    if (serialNumber) {
      throw new BadRequestException(
        'Delete or retire the equipment serial numbers before deleting the equipment',
      );
    }

    if (positiveAllocation) {
      throw new BadRequestException(
        'This equipment still has stock allocated to a shelf',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      /*
       * Zero-value allocation rows are not history and may be removed.
       */
      await tx.equipmentShelfs.deleteMany({
        where: {
          equipmentId,
        },
      });

      return tx.equipment.delete({
        where: {
          equipmentId,
        },
        select: {
          equipmentId: true,
          equipmentName: true,
          hasSerialNumber: true,
          equipmentQuantity: true,
          minequipmentQuantity: true,
        },
      });
    });
  }

  async getEquipmentShelves(equipmentId: string) {
    const id = equipmentId?.trim();

    if (!id) {
      throw new BadRequestException('Equipment ID is required');
    }

    const equipment = await this.prisma.equipment.findUnique({
      where: {
        equipmentId: id,
      },
      select: {
        equipmentId: true,
        equipmentName: true,
        hasSerialNumber: true,
        equipmentQuantity: true,

        equipmentShelfs: {
          where: {
            equipmentQuantity: {
              gt: 0,
            },
          },
          select: {
            equipmentShelfId: true,
            shelfId: true,
            equipmentQuantity: true,
            shelf: {
              select: {
                shelfId: true,
                shelfName: true,
              },
            },
          },
          orderBy: {
            equipmentQuantity: 'desc',
          },
        },
      },
    });

    if (!equipment) {
      throw new NotFoundException(
        `Equipment with ID '${id}' not found`,
      );
    }

    const totalAllocated = equipment.equipmentShelfs.reduce(
      (sum, allocation) =>
        sum + (allocation.equipmentQuantity ?? 0),
      0,
    );

    return {
      ...equipment,
      totalAllocated,
      unallocatedQuantity: Math.max(
        0,
        equipment.equipmentQuantity - totalAllocated,
      ),
      shelvesCount: equipment.equipmentShelfs.length,
    };
  }

  async getSerialNumbersByEquipmentId(
    equipmentId: string,
    pagination: PaginationDTO,
  ) {
    const id = equipmentId?.trim();

    if (!id) {
      throw new BadRequestException('Equipment ID is required');
    }

    const { page, limit } = paginationSchema.parse(
      pagination ?? {},
    );

    const equipment = await this.prisma.equipment.findUnique({
      where: {
        equipmentId: id,
      },
      select: {
        equipmentId: true,
        hasSerialNumber: true,
      },
    });

    if (!equipment) {
      throw new NotFoundException(
        `Equipment with ID '${id}' not found`,
      );
    }

    if (!equipment.hasSerialNumber) {
      return {
        serialNumbers: [],
        totalSerialNumbers: 0,
        totalPages: 1,
        currentPage: page,
        limit,
      };
    }

    const skip = (page - 1) * limit;

    const [serialNumbers, totalSerialNumbers] =
      await Promise.all([
        this.prisma.serialNumber.findMany({
          where: {
            equipmentId: id,
          },
          skip,
          take: limit,
          select: {
            serialNumberId: true,
            serialNumberCode: true,
            serialNumberStatus: true,
            equipmentId: true,
            shelfId: true,
            shelf: {
              select: {
                shelfId: true,
                shelfName: true,
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
            equipmentId: id,
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
