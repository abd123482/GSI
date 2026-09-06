import { Controller, Post, Body, Get, Query, Param, ParseUUIDPipe, Patch, Delete } from '@nestjs/common';
import { EquipmentService } from './equipment.service.js';
import type { CreateEquipmentDTO } from './dto/createEquipment.dto.js';
import type { UpdateEquipmentDTO } from './dto/updateEquipment.dto.js';
import type { PaginationDTO } from './dto/pagination.dto.js';
import * as searchEquipmentDto from './dto/searchEquipment.dto.js';

@Controller('equipment')
export class EquipmentController {
  constructor(private readonly equipmentService: EquipmentService) { }

  @Get('search')
  async searchEquipments(@Query() query: searchEquipmentDto.SearchEquipmentDTO, dto: PaginationDTO) {
    return this.equipmentService.searchEquipments(query, dto);
  }

  @Get(':id')
  async getEquipmentById(@Param('id', ParseUUIDPipe) id: string, @Query() dto: PaginationDTO) {
    return this.equipmentService.getEquipmentById(id, dto);
  }

  @Get()
  async getAllEquipments(@Query() query: PaginationDTO) {
    return this.equipmentService.getAllEquipments(query);
  }

  @Post()
  async createEquipment(@Body() data: CreateEquipmentDTO) {
    return this.equipmentService.createEquipment(data);
  }

  @Patch(':id')
  async updateEquipment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: UpdateEquipmentDTO
  ) {
    return this.equipmentService.updateEquipment(id, data);
  }

  @Delete(':id')
  async deleteEquipment(@Param('id', ParseUUIDPipe) id: string) {
    return this.equipmentService.deleteEquipment(id);
  }
}
