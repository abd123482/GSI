import { Controller, Post, Body, Get } from '@nestjs/common';
import { EquipmentService } from './equipment.service.js';
import type { CreateEquipmentDTO } from './dto/createEquipment.dto.js';

@Controller('equipment')
export class EquipmentController {
  constructor(private readonly equipmentService: EquipmentService) { }

  @Get()
  async getAllEquipments() {
    return this.equipmentService.getAllEquipments();
  }

  @Post()
  async createEquipment(@Body() data: CreateEquipmentDTO) {
    return this.equipmentService.createEquipment(data);
  }
}
