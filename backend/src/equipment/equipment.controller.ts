import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { ClerkAuthGuard } from '../auth/clerk-auth.guard.js';
import { RequirePermissions } from '../auth/decorators/permissions.decorator.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';

import { EquipmentService } from './equipment.service.js';

import type {
  CreateEquipmentDTO,
  PaginationDTO,
  SearchEquipmentDTO,
  UpdateEquipmentDTO,
} from './dto/index.js';

@UseGuards(ClerkAuthGuard, PermissionsGuard)
@Controller(['equipment', 'equipments'])
export class EquipmentController {
  constructor(
    private readonly equipmentService: EquipmentService,
  ) { }

  @RequirePermissions('equipment.read')
  @Get('search')
  searchEquipments(
    @Query() query: SearchEquipmentDTO,
    @Query() pagination: PaginationDTO,
  ) {
    return this.equipmentService.searchEquipments(
      query,
      pagination,
    );
  }

  @RequirePermissions('equipment.read')
  @Get(':id/shelves')
  getEquipmentShelves(
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    id: string,
  ) {
    return this.equipmentService.getEquipmentShelves(id);
  }

  @RequirePermissions('equipment.read')
  @Get(':id/serial-numbers')
  getSerialNumbersByEquipmentId(
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    id: string,
    @Query() pagination: PaginationDTO,
  ) {
    return this.equipmentService.getSerialNumbersByEquipmentId(
      id,
      pagination,
    );
  }

  @RequirePermissions('equipment.read')
  @Get(':id')
  getEquipmentById(
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    id: string,
  ) {
    return this.equipmentService.getEquipmentById(id);
  }

  @RequirePermissions('equipment.read')
  @Get()
  getAllEquipments(
    @Query() pagination: PaginationDTO,
  ) {
    return this.equipmentService.getAllEquipments(
      pagination,
    );
  }

  @RequirePermissions('equipment.create')
  @Post()
  createEquipment(
    @Body() dto: CreateEquipmentDTO,
  ) {
    return this.equipmentService.createEquipment(dto);
  }

  @RequirePermissions('equipment.update')
  @Patch(':id')
  updateEquipment(
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    id: string,
    @Body() dto: UpdateEquipmentDTO,
  ) {
    return this.equipmentService.updateEquipment(
      id,
      dto,
    );
  }

  @RequirePermissions('equipment.delete')
  @Delete(':id')
  deleteEquipment(
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    id: string,
  ) {
    return this.equipmentService.deleteEquipment(id);
  }
}
