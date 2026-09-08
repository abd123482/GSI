import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  CreateSerialNumberDTO,
  createSerialNumberSchema,
  UpdateSerialNumberDTO,
  updateSerialNumberSchema,
  UpdateSerialNumberStatusDTO,
  updateSerialNumberStatusSchema,
  PaginationDTO
} from './dto/index.js';

@Injectable()
export class SerialNumberService {
  constructor(private readonly prisma: PrismaService) { }

  async serialNumberExists(serialNumberCode: string, dto: PaginationDTO): Promise<boolean> {
    const { limit, page } = dto;
    const skip = (page - 1) * limit;
    const totalSerialNumber = await this.prisma.serialNumber.count({ where: { serialNumberCode } });
    return totalSerialNumber > 0;
  }

  async createSerialNumber(
    serialNumberdto: CreateSerialNumberDTO
  ): Promise<void> {
    const existingSerialNumber = await this.serialNumberExists(serialNumberdto.serialNumberCode, { limit: 10, page: 1 });

    if (existingSerialNumber) {
      throw new BadRequestException('Serial number already exists');
    }

    await this.prisma.serialNumber.create({
      data: serialNumberdto,
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
        ...(validatedData.shelfId !== undefined && {
          shelfId: validatedData.shelfId,
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
          const shelfAllocation = await tx.equipmentShelfs.findUnique({
            where: {
              equipmentId_shelfId: {
                equipmentId: existingSerialNumber.equipmentId,
                shelfId: existingSerialNumber.shelfId,
              },
            },
          });
          if (shelfAllocation && shelfAllocation.equipmentQuantity > 0) {
            await tx.equipmentShelfs.update({
              where: {
                equipmentId_shelfId: {
                  equipmentId: existingSerialNumber.equipmentId,
                  shelfId: existingSerialNumber.shelfId,
                },
              },
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

  async insertSerialNumberToShelf(serialNumberId: string, shelfId: string) {
    const existingSerialNumber = await this.serialNumberExists(serialNumberId, { limit: 10, page: 1 });

    if (!existingSerialNumber) {
      throw new BadRequestException('Serial number does not exist');
    }

    const existingShelf = await this.prisma.shelf.findUnique({
      where: { shelfId },
    });

    if (!existingShelf) {
      throw new BadRequestException('Shelf does not exist');
    }

    await this.prisma.serialNumber.update({
      where: { serialNumberId },
      data: { shelfId }
    })
  }
}

