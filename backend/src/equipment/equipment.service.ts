import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateEquipmentDTO, createEquipmentSchema } from './dto/createEquipment.dto.js';

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
}
