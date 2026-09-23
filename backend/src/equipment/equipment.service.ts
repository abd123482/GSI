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
  equipmentStatus: true,

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
          stockId: true,
        },
      },
    },
    orderBy: {
      equipmentQuantity:
        'desc' as const,
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
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  private async assertEquipmentNameAvailable(
    equipmentName: string,
    excludeEquipmentId?: string,
  ): Promise<void> {
    const existing =
      await this.prisma.equipment.findFirst({
        where: {
          equipmentName,
          ...(excludeEquipmentId
            ? {
                equipmentId: {
                  not:
                    excludeEquipmentId,
                },
              }
            : {}),
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

  async createEquipment(
    dto: CreateEquipmentDTO,
  ) {
    const data =
      createEquipmentSchema.parse(dto);

    await this.assertEquipmentNameAvailable(
      data.equipmentName,
    );

    return this.prisma.equipment.create({
      data: {
        equipmentName:
          data.equipmentName,
        hasSerialNumber:
          data.hasSerialNumber,
        equipmentQuantity: 0,
        minequipmentQuantity:
          data.minEquipmentQuantity ??
          0,
        equipmentStatus:
          data.equipmentStatus ??
          'ACTIVE',
      },
      select: {
        equipmentId: true,
        equipmentName: true,
        hasSerialNumber: true,
        equipmentQuantity: true,
        minequipmentQuantity: true,
        equipmentStatus: true,
      },
    });
  }

  async getAllEquipments(
    query: PaginationDTO,
  ) {
    const {
      page,
      limit,
    } = paginationSchema.parse(
      query ?? {},
    );

    const skip =
      (page - 1) * limit;

    const [
      equipments,
      totalEquipments,
    ] = await Promise.all([
      this.prisma.equipment.findMany({
        skip,
        take: limit,
        select:
          EQUIPMENT_LIST_SELECT,
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
      totalPages:
        Math.ceil(
          totalEquipments / limit,
        ) || 1,
      currentPage: page,
      limit,
    };
  }

  async searchEquipments(
    query: SearchEquipmentDTO,
    pagination: PaginationDTO,
  ) {
    const filters =
      searchEquipmentSchema.parse(
        query ?? {},
      );

    const {
      page,
      limit,
    } = paginationSchema.parse(
      pagination ?? {},
    );

    const skip =
      (page - 1) * limit;

    const where:
      Prisma.EquipmentWhereInput = {};

    if (filters.equipmentName) {
      where.equipmentName = {
        contains:
          filters.equipmentName,
      };
    }

    if (
      filters.hasSerialNumber !==
      undefined
    ) {
      where.hasSerialNumber =
        filters.hasSerialNumber;
    }

    if (filters.equipmentStatus) {
      where.equipmentStatus =
        filters.equipmentStatus;
    }

    if (
      filters.equipmentQuantity !==
      undefined
    ) {
      where.equipmentQuantity =
        filters.equipmentQuantity;
    }

    if (
      filters.minEquipmentQuantity !==
      undefined
    ) {
      where.minequipmentQuantity =
        filters.minEquipmentQuantity;
    }

    if (
      filters.shelfId ||
      filters.equipmentShelfId
    ) {
      where.equipmentShelfs = {
        some: {
          ...(filters.shelfId
            ? {
                shelfId:
                  filters.shelfId,
              }
            : {}),

          ...(filters.equipmentShelfId
            ? {
                equipmentShelfId:
                  filters.equipmentShelfId,
              }
            : {}),
        },
      };
    }

    const [
      equipments,
      totalEquipments,
    ] = await Promise.all([
      this.prisma.equipment.findMany({
        where,
        skip,
        take: limit,
        select:
          EQUIPMENT_LIST_SELECT,
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
      totalPages:
        Math.ceil(
          totalEquipments / limit,
        ) || 1,
      currentPage: page,
      limit,
    };
  }

  async getEquipmentById(
    id: string,
  ) {
    const equipmentId =
      id?.trim();

    if (!equipmentId) {
      throw new BadRequestException(
        'Equipment ID is required',
      );
    }

    const equipment =
      await this.prisma.equipment.findUnique({
        where: {
          equipmentId,
        },
        select:
          EQUIPMENT_LIST_SELECT,
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
    const equipmentId =
      id?.trim();

    if (!equipmentId) {
      throw new BadRequestException(
        'Equipment ID is required',
      );
    }

    const data =
      updateEquipmentSchema.parse(dto);

    const current =
      await this.prisma.equipment.findUnique({
        where: {
          equipmentId,
        },
        select: {
          equipmentId: true,
          equipmentName: true,
          hasSerialNumber: true,
          equipmentQuantity: true,
          equipmentStatus: true,
        },
      });

    if (!current) {
      throw new NotFoundException(
        `Equipment with ID '${equipmentId}' not found`,
      );
    }

    if (
      data.equipmentName !==
        undefined &&
      data.equipmentName !==
        current.equipmentName
    ) {
      await this.assertEquipmentNameAvailable(
        data.equipmentName,
        equipmentId,
      );
    }

    if (
      current.hasSerialNumber &&
      data.hasSerialNumber === false
    ) {
      throw new BadRequestException(
        'Serialized equipment cannot be converted back to standard equipment',
      );
    }

    const convertingToSerialized =
      !current.hasSerialNumber &&
      data.hasSerialNumber === true;

    if (
      !convertingToSerialized &&
      data.conversionSerials !==
        undefined
    ) {
      throw new BadRequestException(
        'conversionSerials are only valid during Standard -> Serialized conversion',
      );
    }

    if (convertingToSerialized) {
      return this.convertStandardToSerialized(
        equipmentId,
        data,
      );
    }

    return this.prisma.equipment.update({
      where: {
        equipmentId,
      },
      data: {
        ...(data.equipmentName !==
          undefined && {
          equipmentName:
            data.equipmentName,
        }),

        ...(data.minEquipmentQuantity !==
          undefined && {
          minequipmentQuantity:
            data.minEquipmentQuantity,
        }),

        ...(data.equipmentStatus !==
          undefined && {
          equipmentStatus:
            data.equipmentStatus,
        }),
      },
      select: {
        equipmentId: true,
        equipmentName: true,
        hasSerialNumber: true,
        equipmentQuantity: true,
        minequipmentQuantity: true,
        equipmentStatus: true,
      },
    });
  }

  private async convertStandardToSerialized(
    equipmentId: string,
    data: ReturnType<
      typeof updateEquipmentSchema.parse
    >,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const current =
          await tx.equipment.findUnique({
            where: {
              equipmentId,
            },
            select: {
              equipmentId: true,
              equipmentName: true,
              hasSerialNumber: true,
              equipmentQuantity: true,
              equipmentStatus: true,
              equipmentShelfs: {
                where: {
                  equipmentQuantity: {
                    gt: 0,
                  },
                },
                select: {
                  shelfId: true,
                  equipmentQuantity:
                    true,
                },
              },
              _count: {
                select: {
                  serialNumbers: true,
                },
              },
            },
          });

        if (!current) {
          throw new NotFoundException(
            `Equipment with ID '${equipmentId}' not found`,
          );
        }

        const resource = `SOMIPHARM:EQUIPMENT:${equipmentId.toLowerCase()}`;
        const lockQuery = await tx.$queryRaw<Array<{ lockResult: number }>>`
          DECLARE @lockResult int;
          EXEC @lockResult = sys.sp_getapplock
            @Resource = ${resource},
            @LockMode = 'Exclusive',
            @LockOwner = 'Transaction',
            @LockTimeout = 10000;
          SELECT @lockResult AS lockResult;
        `;
        const lockResult = Number(lockQuery[0]?.lockResult);
        if (!Number.isFinite(lockResult) || lockResult < 0) {
          throw new BadRequestException('Equipment is currently busy. Please try again.');
        }

        if (
          current.hasSerialNumber
        ) {
          throw new BadRequestException(
            'Equipment is already serialized',
          );
        }

        if (
          current._count.serialNumbers >
          0
        ) {
          throw new BadRequestException(
            'Standard equipment already has serial records and cannot be converted safely',
          );
        }

        const conversionSerials =
          data.conversionSerials ?? [];

        if (
          current.equipmentQuantity ===
          0
        ) {
          if (
            conversionSerials.length >
            0
          ) {
            throw new BadRequestException(
              'Equipment has no physical stock; conversion serial mappings are not required',
            );
          }

          return tx.equipment.update({
            where: {
              equipmentId,
            },
            data: {
              hasSerialNumber: true,

              ...(data.equipmentName !==
                undefined && {
                equipmentName:
                  data.equipmentName,
              }),

              ...(data.minEquipmentQuantity !==
                undefined && {
                minequipmentQuantity:
                  data.minEquipmentQuantity,
              }),

              ...(data.equipmentStatus !==
                undefined && {
                equipmentStatus:
                  data.equipmentStatus,
              }),
            },
            select: {
              equipmentId: true,
              equipmentName: true,
              hasSerialNumber: true,
              equipmentQuantity: true,
              minequipmentQuantity: true,
              equipmentStatus: true,
            },
          });
        }

        const allocatedTotal =
          current.equipmentShelfs.reduce(
            (
              sum,
              allocation,
            ) =>
              sum +
              allocation.equipmentQuantity,
            0,
          );

        if (
          allocatedTotal !==
          current.equipmentQuantity
        ) {
          throw new BadRequestException(
            'Equipment physical quantity and shelf allocations are inconsistent; conversion is blocked',
          );
        }

        if (
          conversionSerials.length !==
          current.equipmentQuantity
        ) {
          throw new BadRequestException(
            `Conversion requires exactly ${current.equipmentQuantity} serial codes mapped to the current shelves`,
          );
        }

        const normalized =
          conversionSerials.map(
            (item) => ({
              serialNumberCode:
                item.serialNumberCode.trim(),
              shelfId:
                item.shelfId,
            }),
          );

        const codes =
          normalized.map(
            (item) =>
              item.serialNumberCode,
          );

        if (
          new Set(codes).size !==
          codes.length
        ) {
          throw new BadRequestException(
            'Duplicate serial number codes exist in the conversion request',
          );
        }

        const allocationByShelf =
          new Map(
            current.equipmentShelfs.map(
              (allocation) => [
                allocation.shelfId,
                allocation.equipmentQuantity,
              ],
            ),
          );

        const conversionCountByShelf =
          new Map<string, number>();

        for (
          const item of normalized
        ) {
          if (
            !allocationByShelf.has(
              item.shelfId,
            )
          ) {
            throw new BadRequestException(
              `Shelf '${item.shelfId}' does not contain this equipment`,
            );
          }

          conversionCountByShelf.set(
            item.shelfId,
            (conversionCountByShelf.get(
              item.shelfId,
            ) ?? 0) + 1,
          );
        }

        for (
          const [
            shelfId,
            quantity,
          ] of allocationByShelf
        ) {
          if (
            (conversionCountByShelf.get(
              shelfId,
            ) ?? 0) !== quantity
          ) {
            throw new BadRequestException(
              `Serial mapping count does not match physical quantity on shelf '${shelfId}'`,
            );
          }
        }

        const existingCodes =
          await tx.serialNumber.findMany({
            where: {
              serialNumberCode: {
                in: codes,
              },
            },
            select: {
              serialNumberCode: true,
            },
          });

        if (
          existingCodes.length > 0
        ) {
          throw new BadRequestException(
            `Serial number(s) already exist: ${existingCodes
              .map(
                (item) =>
                  item.serialNumberCode,
              )
              .join(', ')}`,
          );
        }

        await tx.serialNumber.createMany({
          data: normalized.map(
            (item) => ({
              serialNumberCode:
                item.serialNumberCode,
              serialNumberStatus:
                'AVAILABLE',
              equipmentId,
              shelfId:
                item.shelfId,
            }),
          ),
        });

        return tx.equipment.update({
          where: {
            equipmentId,
          },
          data: {
            hasSerialNumber: true,

            ...(data.equipmentName !==
              undefined && {
              equipmentName:
                data.equipmentName,
            }),

            ...(data.minEquipmentQuantity !==
              undefined && {
              minequipmentQuantity:
                data.minEquipmentQuantity,
            }),

            ...(data.equipmentStatus !==
              undefined && {
              equipmentStatus:
                data.equipmentStatus,
            }),
          },
          select: {
            equipmentId: true,
            equipmentName: true,
            hasSerialNumber: true,
            equipmentQuantity: true,
            minequipmentQuantity: true,
            equipmentStatus: true,
          },
        });
      },
      {
        isolationLevel:
          'Serializable',
        timeout: 30_000,
      },
    );
  }

  async deleteEquipment(
    id: string,
  ) {
    const equipmentId =
      id?.trim();

    if (!equipmentId) {
      throw new BadRequestException(
        'Equipment ID is required',
      );
    }

    const equipment =
      await this.prisma.equipment.findUnique({
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
          mouvementEquipmentId:
            true,
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

    if (
      movementLine ||
      legacyMovementHeader
    ) {
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

    return this.prisma.$transaction(
      async (tx) => {
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
            equipmentStatus: true,
          },
        });
      },
    );
  }

  async getEquipmentShelves(
    equipmentId: string,
  ) {
    const id =
      equipmentId?.trim();

    if (!id) {
      throw new BadRequestException(
        'Equipment ID is required',
      );
    }

    const equipment =
      await this.prisma.equipment.findUnique({
        where: {
          equipmentId: id,
        },
        select: {
          equipmentId: true,
          equipmentName: true,
          hasSerialNumber: true,
          equipmentQuantity: true,
          equipmentStatus: true,

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
                  stockId: true,
                },
              },
            },
            orderBy: {
              equipmentQuantity:
                'desc',
            },
          },
        },
      });

    if (!equipment) {
      throw new NotFoundException(
        `Equipment with ID '${id}' not found`,
      );
    }

    const totalAllocated =
      equipment.equipmentShelfs.reduce(
        (
          sum,
          allocation,
        ) =>
          sum +
          allocation.equipmentQuantity,
        0,
      );

    return {
      ...equipment,
      totalAllocated,
      unallocatedQuantity:
        Math.max(
          0,
          equipment.equipmentQuantity -
            totalAllocated,
        ),
      shelvesCount:
        equipment.equipmentShelfs
          .length,
    };
  }

  async getSerialNumbersByEquipmentId(
    equipmentId: string,
    pagination: PaginationDTO,
  ) {
    const id =
      equipmentId?.trim();

    if (!id) {
      throw new BadRequestException(
        'Equipment ID is required',
      );
    }

    const {
      page,
      limit,
    } = paginationSchema.parse(
      pagination ?? {},
    );

    const equipment =
      await this.prisma.equipment.findUnique({
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

    if (
      !equipment.hasSerialNumber
    ) {
      return {
        serialNumbers: [],
        totalSerialNumbers: 0,
        totalPages: 1,
        currentPage: page,
        limit,
      };
    }

    const skip =
      (page - 1) * limit;

    const [
      serialNumbers,
      totalSerialNumbers,
    ] = await Promise.all([
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
              stockId: true,
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
        Math.ceil(
          totalSerialNumbers / limit,
        ) || 1,
      currentPage: page,
      limit,
    };
  }
}
