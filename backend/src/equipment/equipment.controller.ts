import { Controller, Post, Body } from '@nestjs/common';
import { EquipmentService } from './equipment.service.js';
import type { CreateEquipmentDTO } from './dto/createEquipment.dto.js';

@Controller('equipment')
export class EquipmentController {
  constructor(private readonly equipmentService: EquipmentService) { }

  @Post()
  async createEquipment(@Body() data: CreateEquipmentDTO) {
    return this.equipmentService.createEquipment(data);
  }
}
