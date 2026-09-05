import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateEquipmentDTO, createEquipmentSchema } from './dto/createEquipment.dto.js';
import { SearchEquipmentDTO, searchEquipmentSchema } from './dto/searchEquipment.dto.js';
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
    if (data.equipmentName) {
      data.equipmentName = data.equipmentName.trim();
    }

    // Validate input using Zod schema
    const validatedData = createEquipmentSchema.parse(data);

    // Check if equipment already exists
    const exists = await this.equipmentExists(validatedData.equipmentName);
    if (exists) {
      throw new BadRequestException('Equipment with this name already exists');
    }

    // Create new equipment tuple and insert into schema
    return this.prisma.equipment.create({
      data: {
        equipmentName: validatedData.equipmentName,
        hasSerialNumber: validatedData.hasSerialNumber,
        equipmentQuantity: validatedData.equipmentQuantity,
        minequipmentQuantity: validatedData.minEquipmentQuantity || 0,
        equipmentShelfId: validatedData.equipmentShelfId,
      }
    });
  }

  async getAllEquipments() {
    // Retrieve all equipment records, ordered by equipmentName to utilize the index
    return this.prisma.equipment.findMany({
      orderBy: { equipmentName: 'asc' }
    });
  }

  async searchEquipments(query: SearchEquipmentDTO) {
    // First validate inputs of searching equipment from SearchEquipmentDTO
    const validatedData = searchEquipmentSchema.parse(query);

    const where: any = {};
    if (validatedData.equipmentName !== undefined) where.equipmentName = validatedData.equipmentName;
    if (validatedData.hasSerialNumber !== undefined) where.hasSerialNumber = validatedData.hasSerialNumber;
    if (validatedData.equipmentQuantity !== undefined) where.equipmentQuantity = validatedData.equipmentQuantity;
    if (validatedData.minEquipmentQuantity !== undefined) where.minequipmentQuantity = validatedData.minEquipmentQuantity;
    if (validatedData.equipmentShelfId !== undefined) where.equipmentShelfId = validatedData.equipmentShelfId;

    return this.prisma.equipment.findMany({
      where,
    });
  }

  async getEquipmentByName(name: string) {
    if (!name || name.trim() === '') {
      throw new BadRequestException('Equipment name is required');
    }
    const equipment = await this.prisma.equipment.findFirst({
      where: { equipmentName: name }
    });
    if (!equipment) {
      throw new NotFoundException(`Equipment with name '${name}' not found`);
    }
    return equipment;
  }

  async getEquipmentById(id: string) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Equipment ID is required');
    }
    const equipment = await this.prisma.equipment.findUnique({
      where: { equipmentId: id }
    });
    if (!equipment) {
      throw new NotFoundException(`Equipment with ID '${id}' not found`);
    }
    return equipment;
  }
}
