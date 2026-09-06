import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateEquipmentDTO, createEquipmentSchema } from './dto/createEquipment.dto.js';
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
    const exists = await this.equipmentExists(
      validatedData.equipmentName,
    );

    if (exists) {
      throw new BadRequestException(
        'Equipment with this name already exists',
      );
    }

    // Create equipment
    return await this.prisma.equipment.create({
      data: {
        equipmentName: validatedData.equipmentName,
        hasSerialNumber: validatedData.hasSerialNumber,
        equipmentQuantity: validatedData.equipmentQuantity,
        minequipmentQuantity: validatedData.minEquipmentQuantity ?? 0,
      },
      include: {
        equipmentShelfs: {
          include: {
            shelf: true,
          },
        },
      },
    });
  }

  async getAllEquipments(query: PaginationDTO) {
    const { page, limit } = paginationSchema.parse(query);
    const skip = (page - 1) * limit;
    const take = limit;

    const equipments = await this.prisma.equipment.findMany({
      skip,
      take,
      orderBy: { equipmentName: 'asc' }
    });

    const totalEquipments = await this.prisma.equipment.count();

    return {
      equipments,
      totalEquipments,
      totalPages: Math.ceil(totalEquipments / limit),
      currentPage: page,
      limit
    };
  }

  async searchEquipments(query: SearchEquipmentDTO, paginationDTO: PaginationDTO) {
    // First validate inputs of searching equipment from SearchEquipmentDTO
    const validatedData = searchEquipmentSchema.parse(query);

    const limit = paginationDTO.limit;
    const page = paginationDTO.page;
    const skip = (page - 1) * limit;
    const take = limit;

    const where: any = {};
    if (validatedData.equipmentName !== undefined) where.equipmentName = validatedData.equipmentName;
    if (validatedData.hasSerialNumber !== undefined) where.hasSerialNumber = validatedData.hasSerialNumber;
    if (validatedData.equipmentQuantity !== undefined) where.equipmentQuantity = validatedData.equipmentQuantity;
    if (validatedData.minEquipmentQuantity !== undefined) where.minequipmentQuantity = validatedData.minEquipmentQuantity;
    if (validatedData.equipmentShelfId !== undefined) where.equipmentShelfId = validatedData.equipmentShelfId;

    const equipments = await this.prisma.equipment.findMany({
      where,
      skip,
      take,
      orderBy: { equipmentName: 'asc' }
    });

    const totalEquipments = await this.prisma.equipment.count({
      where,
    });

    return {
      equipments,
      totalEquipments,
      totalPages: Math.ceil(totalEquipments / limit),
      currentPage: page,
      limit
    };
  }

  async getEquipmentById(id: string, paginationDTO: PaginationDTO) {
    const limit = paginationDTO.limit;
    const page = paginationDTO.page;
    const skip = (page - 1) * limit;
    const take = limit;

    const where: any = {};
    if (id !== undefined) where.equipmentId = id;

    if (!id || id.trim() === '') {
      throw new BadRequestException('Equipment ID is required');
    }
    const equipment = await this.prisma.equipment.findMany({
      where,
      skip,
      take,
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
    });

    if (!existingEquipment) {
      throw new NotFoundException(`Equipment with ID '${id}' not found`);
    }

    // Update equipment scalar fields
    return await this.prisma.equipment.update({
      where: { equipmentId: id },
      data: {
        ...(validatedData.equipmentName !== undefined && { equipmentName: validatedData.equipmentName }),
        ...(validatedData.hasSerialNumber !== undefined && { hasSerialNumber: validatedData.hasSerialNumber }),
        ...(validatedData.equipmentQuantity !== undefined && { equipmentQuantity: validatedData.equipmentQuantity }),
        ...(validatedData.minEquipmentQuantity !== undefined && { minequipmentQuantity: validatedData.minEquipmentQuantity }),
      },
      include: {
        equipmentShelfs: {
          include: {
            shelf: true,
          },
        },
      },
    });
  }

  async deleteEquipment(id: string) {
    // First search about equipment using getEquipmentById
    const existingEquipment = await this.equipmentExists(id);

    if (!existingEquipment) {
      throw new NotFoundException(`Equipment with ID '${id}' not found`);
    }
    // Then delete it
    return this.prisma.equipment.delete({
      where: { equipmentId: id }
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


}
