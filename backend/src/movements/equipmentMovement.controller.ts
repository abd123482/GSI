import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { RequirePermissions } from '../auth/decorators/permissions.decorator.js';
import { EquipmentMovementService } from './equipmentMovement.service.js';
import type {
  CreateEquipmentMovementDTO,
  CreateEntryMovementWithEquipmentDTO,
  SearchEquipmentMovementDTO,
  PaginationDTO,
} from './dto/index.js';

@UseGuards(ClerkAuthGuard, PermissionsGuard)
@Controller(['equipment-movement', 'equipment-movements'])
export class EquipmentMovementController {
  constructor(
    private readonly equipmentMovementService: EquipmentMovementService,
  ) {}

  @RequirePermissions('movement.create')
  @Post('entry-with-equipment')
  async createEntryMovementWithEquipment(
    @Body() dto: CreateEntryMovementWithEquipmentDTO,
  ) {
    return this.equipmentMovementService.createEntryMovementWithEquipment(dto);
  }

  @RequirePermissions('movement.create')
  @Post()
  async createEquipmentMovement(@Body() dto: CreateEquipmentMovementDTO) {
    return this.equipmentMovementService.createEquipmentMovement(dto);
  }

  @RequirePermissions('movement.read')
  @Get()
  async getAllEquipmentMovements(@Query() pagination: PaginationDTO) {
    return this.equipmentMovementService.getAllEquipmentMovements(pagination);
  }

  @RequirePermissions('movement.read')
  @Get('search')
  async searchEquipmentMovements(
    @Query() query: SearchEquipmentMovementDTO,
    @Query() pagination: PaginationDTO,
  ) {
    return this.equipmentMovementService.searchEquipmentMovements(
      query,
      pagination,
    );
  }

  @RequirePermissions('movement.read')
  @Get('type/:type')
  async getMovementsByType(
    @Param('type') type: string,
    @Query() pagination: PaginationDTO,
  ) {
    return this.equipmentMovementService.getMovementsByType(pagination, type);
  }

  @RequirePermissions('movement.read')
  @Get('equipment/:equipmentId')
  async getMovementsByEquipmentId(
    @Param('equipmentId', new ParseUUIDPipe({ version: '4' }))
    equipmentId: string,
    @Query() pagination: PaginationDTO,
  ) {
    return this.equipmentMovementService.getMovementsByEquipmentId(
      pagination,
      equipmentId,
    );
  }

  @RequirePermissions('movement.read')
  @Get('serial-number/:serialNumberId')
  async getMovementsBySerialNumberId(
    @Param('serialNumberId', new ParseUUIDPipe({ version: '4' }))
    serialNumberId: string,
    @Query() pagination: PaginationDTO,
  ) {
    return this.equipmentMovementService.getMovementsBySerialNumberId(
      pagination,
      serialNumberId,
    );
  }

  @RequirePermissions('movement.read')
  @Get('source-shelf/:shelfId')
  async getMovementsBySourceShelfId(
    @Param('shelfId', new ParseUUIDPipe({ version: '4' })) shelfId: string,
    @Query() pagination: PaginationDTO,
  ) {
    return this.equipmentMovementService.getMovementsBySourceShelfId(
      pagination,
      shelfId,
    );
  }

  @RequirePermissions('movement.read')
  @Get('destination-shelf/:shelfId')
  async getMovementsByDestinationShelfId(
    @Param('shelfId', new ParseUUIDPipe({ version: '4' })) shelfId: string,
    @Query() pagination: PaginationDTO,
  ) {
    return this.equipmentMovementService.getMovementsByDestinationShelfId(
      pagination,
      shelfId,
    );
  }

  @RequirePermissions('movement.read')
  @Get(':id')
  async getEquipmentMovementById(
    @Query() pagination: PaginationDTO,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.equipmentMovementService.getEquipmentMovementById(
      pagination,
      id,
    );
  }
}
