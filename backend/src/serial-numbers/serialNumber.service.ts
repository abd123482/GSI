import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  CreateSerialNumberDTO,
  createSerialNumberSchema,
  CreateBatchSerialNumberDTO,
  createBatchSerialNumberSchema,
  UpdateSerialNumberDTO,
  updateSerialNumberSchema,
  UpdateSerialNumberStatusDTO,
  updateSerialNumberStatusSchema,
  PaginationDTO,
} from './dto/index.js';

@Injectable()
export class SerialNumberService {
  constructor(private readonly prisma: PrismaService) { }

  async serialNumberExists(serialNumberCode: string): Promise<boolean> {
    const totalSerialNumber = await this.prisma.serialNumber.findFirst({ where: { serialNumberCode } });
    return totalSerialNumber != null;
  }

  async createSerialNumber(data: CreateSerialNumberDTO) {
    const validated = createSerialNumberSchema.parse(data);

    // Verify equipment exists
    const equipment = await this.prisma.equipment.findUnique({
      where: { equipmentId: validated.equipmentId },
    });
    if (!equipment) {
      throw new NotFoundException(`Équipement introuvable (ID: ${validated.equipmentId})`);
    }

    // Check code uniqueness
    const existing = await this.serialNumberExists(validated.serialNumberCode)
    if (existing) {
      throw new BadRequestException(`Le numéro de série '${validated.serialNumberCode}' existe déjà`);
    }

    return await this.prisma.$transaction(async (tx) => {
      const created = await tx.serialNumber.create({
        data: {
          serialNumberCode: validated.serialNumberCode,
          equipmentId: validated.equipmentId,
          shelfId: null, // Placed into shelves exclusively via movement logic
          serialNumberStatus: validated.serialNumberStatus ?? 'AVAILABLE',
        },
        include: {
          shelf: {
            select: { shelfId: true, shelfName: true },
          },
        },
      });

      // Auto-increment parent equipment quantity
      await tx.equipment.update({
        where: { equipmentId: validated.equipmentId },
        data: {
          equipmentQuantity: { increment: 1 },
        },
      });

      return created;
    });
  }

  async createBatchSerialNumbers(data: CreateBatchSerialNumberDTO) {
    const validated = createBatchSerialNumberSchema.parse(data);

    // Verify equipment exists
    const equipment = await this.prisma.equipment.findUnique({
      where: { equipmentId: validated.equipmentId },
    });
    if (!equipment) {
      throw new NotFoundException(`Équipement introuvable (ID: ${validated.equipmentId})`);
    }

    // Check uniqueness within the batch
    const uniqueSet = new Set(validated.serialNumberCodes);
    if (uniqueSet.size !== validated.serialNumberCodes.length) {
      throw new BadRequestException('Certains numéros de série sont en double dans la liste fournie');
    }

    // Check uniqueness in the database
    const existingInDb = await this.prisma.serialNumber.findMany({
      where: {
        serialNumberCode: { in: validated.serialNumberCodes },
      },
      select: { serialNumberCode: true },
    });
    if (existingInDb.length > 0) {
      const duplicates = existingInDb.map((s) => s.serialNumberCode).join(', ');
      throw new BadRequestException(`Ces numéros de série existent déjà dans la base : ${duplicates}`);
    }

    const count = validated.serialNumberCodes.length;

    return await this.prisma.$transaction(async (tx) => {
      // Bulk insert serial numbers without shelf (shelf assignments are managed via movements)
      await tx.serialNumber.createMany({
        data: validated.serialNumberCodes.map((code) => ({
          serialNumberCode: code,
          equipmentId: validated.equipmentId,
          shelfId: null,
          serialNumberStatus: validated.serialNumberStatus ?? 'AVAILABLE',
        })),
      });

      // Increment parent equipment quantity
      await tx.equipment.update({
        where: { equipmentId: validated.equipmentId },
        data: {
          equipmentQuantity: { increment: count },
        },
      });

      return {
        success: true,
        count,
        equipmentId: validated.equipmentId,
        shelfId: null,
      };
    });
  }

  async getAllSerialNumbers(paginationdto: PaginationDTO) {
    const { limit, page } = paginationdto;
    const skip = (page - 1) * limit;
    return await this.prisma.serialNumber.findMany({
      skip,
      take: limit,
    })
  }

  async getSerialNumberById(paginationdto: PaginationDTO, id: string) {
    const { limit, page } = paginationdto;
    const skip = (page - 1) * limit;
    return await this.prisma.serialNumber.findMany({
      skip,
      take: limit,
      where: { serialNumberId: id }
    })
  }

  async getSerialNumberByCode(paginationdto: PaginationDTO, serialNumberCode: string) {
    const { limit, page } = paginationdto;
    const skip = (page - 1) * limit;
    return await this.prisma.serialNumber.findMany({
      skip,
      take: limit,
      where: { serialNumberCode }
    })
  }


  async updateSerialNumber(serialNumberdto: UpdateSerialNumberDTO, id: string) {
    const validatedData = updateSerialNumberSchema.parse(serialNumberdto);

    const existingSerialNumber = await this.prisma.serialNumber.findUnique({
      where: { serialNumberId: id },
    });

    if (!existingSerialNumber) {
      throw new NotFoundException(`Numéro de série avec l'identifiant '${id}' introuvable.`);
    }

    if (
      validatedData.serialNumberCode &&
      validatedData.serialNumberCode !== existingSerialNumber.serialNumberCode
    ) {
      const codeTaken = await this.prisma.serialNumber.findFirst({
        where: {
          serialNumberCode: validatedData.serialNumberCode,
          serialNumberId: { not: id },
        },
      });
      if (codeTaken) {
        throw new BadRequestException(
          `Le numéro de série '${validatedData.serialNumberCode}' existe déjà.`,
        );
      }
    }

    return await this.prisma.serialNumber.update({
      where: { serialNumberId: id },
      data: {
        ...(validatedData.serialNumberCode !== undefined && {
          serialNumberCode: validatedData.serialNumberCode,
        }),
        ...(validatedData.serialNumberStatus !== undefined && {
          serialNumberStatus: validatedData.serialNumberStatus,
        }),
        ...(validatedData.equipmentId !== undefined && {
          equipmentId: validatedData.equipmentId,
        }),
      },
      include: {
        shelf: true,
        equipment: true,
      },
    });
  }

  async getSerialNumberByStatus(paginationdto: PaginationDTO, serialNumberStatus: string) {
    const { limit, page } = paginationdto;
    const skip = (page - 1) * limit;
    return await this.prisma.serialNumber.findMany({
      skip,
      take: limit,
      where: { serialNumberStatus },
      include: {
        shelf: true,
        equipment: true,
      },
    });
  }

  async updateSerialNumberStatus(id: string, dto: UpdateSerialNumberStatusDTO) {
    const validatedData = updateSerialNumberStatusSchema.parse(dto);

    const existingSerialNumber = await this.prisma.serialNumber.findUnique({
      where: { serialNumberId: id },
    });

    if (!existingSerialNumber) {
      throw new NotFoundException(`Numéro de série avec l'identifiant '${id}' introuvable.`);
    }

    return await this.prisma.serialNumber.update({
      where: { serialNumberId: id },
      data: { serialNumberStatus: validatedData.serialNumberStatus },
      include: {
        shelf: true,
        equipment: true,
      },
    });
  }

  async deleteSerialNumber(id: string) {
    const existingSerialNumber = await this.prisma.serialNumber.findUnique({
      where: { serialNumberId: id },
      include: {
        equipment: true,
      },
    });

    if (!existingSerialNumber) {
      throw new NotFoundException(`Numéro de série avec l'identifiant '${id}' introuvable.`);
    }

    return await this.prisma.$transaction(async (tx) => {
      // 1. Delete or unlink any movements associated with this serial number
      await tx.mouvement.deleteMany({
        where: { serialNumberId: id },
      });

      // 2. Delete the serial number
      const deleted = await tx.serialNumber.delete({
        where: { serialNumberId: id },
      });

      // 3. If equipment is serialized, decrement its equipmentQuantity by 1
      if (existingSerialNumber.equipmentId && existingSerialNumber.equipment?.hasSerialNumber) {
        await tx.equipment.update({
          where: { equipmentId: existingSerialNumber.equipmentId },
          data: {
            equipmentQuantity: {
              decrement: 1,
            },
          },
        });

        if (existingSerialNumber.shelfId) {
          const shelfAllocation = await tx.equipmentShelfs.findFirst({
            where: {
              equipmentId: existingSerialNumber.equipmentId,
              shelfId: existingSerialNumber.shelfId,
            },
            orderBy: { equipmentQuantity: 'desc' },
          });
          if (shelfAllocation && (shelfAllocation.equipmentQuantity ?? 0) > 0) {
            await tx.equipmentShelfs.update({
              where: { equipmentShelfId: shelfAllocation.equipmentShelfId },
              data: {
                equipmentQuantity: {
                  decrement: 1,
                },
              },
            });
          }
        }
      }

      return deleted;
    });
  }

}
