import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  Param,
  ParseUUIDPipe,
  Patch,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { EquipmentService } from './equipment.service.js';
import type { CreateEquipmentDTO } from './dto/createEquipment.dto.js';
import type { UpdateEquipmentDTO } from './dto/updateEquipment.dto.js';
import type { PaginationDTO } from './dto/pagination.dto.js';
import * as searchEquipmentDto from './dto/searchEquipment.dto.js';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { RequirePermissions } from '../auth/decorators/permissions.decorator.js';

@UseGuards(ClerkAuthGuard, PermissionsGuard)
@Controller(['equipment', 'equipments'])
export class EquipmentController {
  constructor(private readonly equipmentService: EquipmentService) { }

  @RequirePermissions('equipment.read')
  @Get('search')
  async searchEquipments(
    @Query() query: searchEquipmentDto.SearchEquipmentDTO,
    dto: PaginationDTO,
  ) {
    return this.equipmentService.searchEquipments(query, dto);
  }

  @RequirePermissions('equipment.read')
  @Get(':id/shelves')
  async getEquipmentShelves(@Param('id', ParseUUIDPipe) id: string) {
    return this.equipmentService.getEquipmentShelves(id);
  }

  @RequirePermissions('equipment.read')
  @Get(':id')
  async getEquipmentById(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.equipmentService.getEquipmentById(id);
  }

  @RequirePermissions('equipment.read')
  @Get()
  async getAllEquipments(@Query() query: PaginationDTO) {
    return this.equipmentService.getAllEquipments(query);
  }

  @RequirePermissions('equipment.create')
  @Post()
  async createEquipment(@Body() data: CreateEquipmentDTO) {
    return this.equipmentService.createEquipment(data);
  }

  @RequirePermissions('equipment.update')
  @Patch(':id')
  async updateEquipment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: UpdateEquipmentDTO,
  ) {
    return this.equipmentService.updateEquipment(id, data);
  }

  @RequirePermissions('equipment.delete')
  @Delete(':id')
  async deleteEquipment(@Param('id', ParseUUIDPipe) id: string) {
    return this.equipmentService.deleteEquipment(id);
  }
}

