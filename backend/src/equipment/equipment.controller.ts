import { Controller, Post, Body, Get, Query, Param, ParseUUIDPipe } from '@nestjs/common';
import { EquipmentService } from './equipment.service.js';
import type { CreateEquipmentDTO } from './dto/createEquipment.dto.js';

@Controller('equipment')
export class EquipmentController {
  constructor(private readonly equipmentService: EquipmentService) { }

  @Get('search')
  async searchEquipments(@Query() query: any) {
    return this.equipmentService.searchEquipments(query);
  }

  @Get('name/:name')
  async getEquipmentByName(@Param('name') name: string) {
    return this.equipmentService.getEquipmentByName(name);
  }

  @Get(':id')
  async getEquipmentById(@Param('id', ParseUUIDPipe) id: string) {
    return this.equipmentService.getEquipmentById(id);
  }

  @Get()
  async getAllEquipments() {
    return this.equipmentService.getAllEquipments();
  }

  @Post()
  async createEquipment(@Body() data: CreateEquipmentDTO) {
    return this.equipmentService.createEquipment(data);
  }
}
