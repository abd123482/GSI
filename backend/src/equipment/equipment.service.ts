import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  CreateEquipmentDTO,
  createEquipmentSchema,
} from './dto/createEquipment.dto.js';
import { SearchEquipmentDTO, searchEquipmentSchema } from './dto/searchEquipment.dto.js';
import { UpdateEquipmentDTO, updateEquipmentSchema } from './dto/updateEquipment.dto.js';
import { PaginationDTO, paginationSchema } from './dto/pagination.dto.js';

@Injectable()
export class EquipmentService {
  constructor(private readonly prisma: PrismaService) { }

  async equipmentExists(equipmentName: string): Promise<boolean> {
    const equipment = await this.prisma.equipment.findFirst({
      where: { equipmentName }
    });
    return !!equipment;
  }

  async createEquipment(data: CreateEquipmentDTO) {
    // Validate data
    const validatedData = createEquipmentSchema.parse(data);

    // Check if equipment name already exists
    const exists = await this.equipmentExists(validatedData.equipmentName);
    if (exists) {
      throw new BadRequestException('Equipment with this name already exists');
    }

    // Create equipment directly (shelf assignments are managed exclusively via movements)
    return await this.prisma.equipment.create({
      data: {
        equipmentName: validatedData.equipmentName,
        hasSerialNumber: validatedData.hasSerialNumber,
        equipmentQuantity: validatedData.equipmentQuantity,
        minequipmentQuantity: validatedData.minEquipmentQuantity ?? 0,
      },
    });
  }

  async getAllEquipments(query: PaginationDTO) {
    const { page, limit } = paginationSchema.parse(query);
    const skip = (page - 1) * limit;
    const take = limit;
    const [equipments, totalEquipments] = await Promise.all([this.prisma.equipment.findMany({
      skip,
      take,
      orderBy: { equipmentName: 'asc' },
      include: {
        serialNumbers: {
          orderBy: { serialNumberCode: 'asc' },
          include: {
            shelf: {
              select: {
                shelfId: true,
                shelfName: true,
              },
            },
          },
        },
        equipmentShelfs: {
          include: {
            shelf: {
              select: {
                shelfId: true,
                shelfName: true,
              },
            },
          },
        },
      },
    }),

    this.prisma.equipment.count()
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
    paginationDTO: PaginationDTO = { page: 1, limit: 10 },
  ) {
    const validatedData = searchEquipmentSchema.parse(query);

    const limit = paginationDTO?.limit || 10;
    const page = paginationDTO?.page || 1;
    const skip = (page - 1) * limit;
    const take = limit;

    const where: any = {};
    if (validatedData.equipmentName !== undefined)
      where.equipmentName = { contains: validatedData.equipmentName };
    if (validatedData.hasSerialNumber !== undefined)
      where.hasSerialNumber = validatedData.hasSerialNumber;
    if (validatedData.equipmentQuantity !== undefined)
      where.equipmentQuantity = validatedData.equipmentQuantity;
    if (validatedData.minEquipmentQuantity !== undefined)
      where.minequipmentQuantity = validatedData.minEquipmentQuantity;
    if (validatedData.equipmentShelfId !== undefined)
      where.equipmentShelfId = validatedData.equipmentShelfId;

    const [equipments, totalEquipments] = await Promise.all([
      this.prisma.equipment.findMany({
        where,
        skip,
        take,
        orderBy: { equipmentName: 'asc' },
        include: {
          serialNumbers: {
            orderBy: { serialNumberCode: 'asc' },
            include: {
              shelf: {
                select: {
                  shelfId: true,
                  shelfName: true,
                },
              },
            },
          },
          equipmentShelfs: {
            include: {
              shelf: {
                select: {
                  shelfId: true,
                  shelfName: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.equipment.count({
        where,
      })
    ])


    return {
      equipments,
      totalEquipments,
      totalPages: Math.ceil(totalEquipments / limit) || 1,
      currentPage: page,
      limit,
    };
  }

  async getEquipmentById(id: string) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Equipment ID is required');
    }

    const equipment = await this.prisma.equipment.findUnique({
      where: { equipmentId: id.trim() },
      include: {
        serialNumbers: {
          orderBy: { serialNumberCode: 'asc' },
          include: {
            shelf: {
              select: {
                shelfId: true,
                shelfName: true,
              },
            },
          },
        },
        equipmentShelfs: {
          include: {
            shelf: {
              select: {
                shelfId: true,
                shelfName: true,
              },
            },
          },
        },
      },
    });

    if (!equipment) {
      throw new NotFoundException(`Equipment with ID '${id}' not found`);
    }

    return equipment;
  }

  async updateEquipment(id: string, data: UpdateEquipmentDTO) {
    // Validate inputs
    const validatedData = updateEquipmentSchema.parse(data);

    // Check if equipment already exists
    const existingEquipment = await this.prisma.equipment.findUnique({
      where: { equipmentId: id },
      include: { serialNumbers: true },
    });

    if (!existingEquipment) {
      throw new NotFoundException(`Équipement avec l'identifiant '${id}' introuvable.`);
    }

    // Check name uniqueness if equipmentName is modified
    if (
      validatedData.equipmentName &&
      validatedData.equipmentName !== existingEquipment.equipmentName
    ) {
      const nameExists = await this.prisma.equipment.findFirst({
        where: {
          equipmentName: validatedData.equipmentName,
          equipmentId: { not: id },
        },
      });
      if (nameExists) {
        throw new BadRequestException(
          `Un équipement nommé '${validatedData.equipmentName}' existe déjà.`,
        );
      }
    }

    // Perform update in a transaction
    return await this.prisma.$transaction(async (tx) => {
      // If converting from serialized to non-serialized: delete child serial numbers
      if (validatedData.hasSerialNumber === false && existingEquipment.hasSerialNumber) {
        // Delete all movements referencing these serial numbers
        const snIds = existingEquipment.serialNumbers.map((s) => s.serialNumberId);
        if (snIds.length > 0) {
          await tx.mouvement.deleteMany({
            where: { serialNumberId: { in: snIds } },
          });
          await tx.serialNumber.deleteMany({
            where: { equipmentId: id },
          });
        }
      }

      return await tx.equipment.update({
        where: { equipmentId: id },
        data: {
          ...(validatedData.equipmentName !== undefined && {
            equipmentName: validatedData.equipmentName,
          }),
          ...(validatedData.hasSerialNumber !== undefined && {
            hasSerialNumber: validatedData.hasSerialNumber,
          }),
          ...(validatedData.equipmentQuantity !== undefined && {
            equipmentQuantity: validatedData.equipmentQuantity,
          }),
          ...(validatedData.minEquipmentQuantity !== undefined && {
            minequipmentQuantity: validatedData.minEquipmentQuantity,
          }),
        },
        include: {
          serialNumbers: {
            include: {
              shelf: true,
            },
          },
          equipmentShelfs: {
            include: {
              shelf: true,
            },
          },
        },
      });
    });
  }

  async deleteEquipment(id: string) {
    const existingEquipment = await this.prisma.equipment.findUnique({
      where: { equipmentId: id },
      include: {
        serialNumbers: true,
        equipmentShelfs: true,
      },
    });

    if (!existingEquipment) {
      throw new NotFoundException(`Équipement avec l'identifiant '${id}' introuvable.`);
    }

    return await this.prisma.$transaction(async (tx) => {
      // 1. Delete all child serial numbers and their movement references
      const snIds = existingEquipment.serialNumbers.map((s) => s.serialNumberId);
      if (snIds.length > 0) {
        await tx.mouvement.deleteMany({
          where: { serialNumberId: { in: snIds } },
        });
        await tx.serialNumber.deleteMany({
          where: { equipmentId: id },
        });
      }

      // 2. Delete equipment movements
      await tx.mouvement.deleteMany({
        where: { equipmentId: id },
      });

      // 3. Delete equipment shelf allocations
      await tx.equipmentShelfs.deleteMany({
        where: { equipmentId: id },
      });

      // 4. Finally delete the equipment
      return await tx.equipment.delete({
        where: { equipmentId: id },
      });
    });
  }

  async getSerialNumbersByEquipmentId(equipmentId: string, paginationDTO: PaginationDTO) {
    const limit = paginationDTO.limit;
    const page = paginationDTO.page;
    const skip = (page - 1) * limit;
    const take = limit;

    const exist = await this.equipmentExists(equipmentId)
    if (!exist) {
      throw new NotFoundException(`Equipment with ID '${equipmentId}' not found`);
    }

    // Return all serial number tuples that belong to this equipment
    return this.prisma.serialNumber.findMany({
      where: { equipmentId },
      skip,
      take,
    });
  }



  async getEquipmentShelves(equipmentId: string) {
    const equipment = await this.prisma.equipment.findUnique({
      where: { equipmentId },
      include: {
        equipmentShelfs: {
          include: { shelf: true },
          orderBy: { equipmentQuantity: 'desc' },
        },
        serialNumbers: {
          include: { shelf: true },
          orderBy: { serialNumberCode: 'asc' },
        },
      },
    });

    if (!equipment) {
      throw new NotFoundException(`Equipment with ID '${equipmentId}' not found`);
    }

    const totalAllocated = equipment.hasSerialNumber
      ? equipment.serialNumbers.filter((s) => s.shelfId !== null).length
      : equipment.equipmentShelfs.reduce((sum, es) => sum + (es.equipmentQuantity ?? 0), 0);

    const unallocatedQuantity = Math.max(0, equipment.equipmentQuantity - totalAllocated);

    return {
      ...equipment,
      totalAllocated,
      unallocatedQuantity,
      shelvesCount: equipment.equipmentShelfs.length,
    };
  }
}
