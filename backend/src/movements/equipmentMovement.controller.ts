import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { EquipmentMovementService } from './equipmentMovement.service.js';
import type {
  CreateEquipmentMovementDTO,
  SearchEquipmentMovementDTO,
  PaginationDTO,
} from './dto/index.js';

@Controller(['equipment-movement', 'equipment-movements'])
export class EquipmentMovementController {
  constructor(private readonly equipmentMovementService: EquipmentMovementService) {}

  @Post()
  async createEquipmentMovement(@Body() dto: CreateEquipmentMovementDTO) {
    return this.equipmentMovementService.createEquipmentMovement(dto);
  }

  @Get()
  async getAllEquipmentMovements(@Query() pagination: PaginationDTO) {
    return this.equipmentMovementService.getAllEquipmentMovements(pagination);
  }

  @Get('search')
  async searchEquipmentMovements(
    @Query() query: SearchEquipmentMovementDTO,
    @Query() pagination: PaginationDTO
  ) {
    return this.equipmentMovementService.searchEquipmentMovements(query, pagination);
  }

  @Get('type/:type')
  async getMovementsByType(
    @Param('type') type: string,
    @Query() pagination: PaginationDTO
  ) {
    return this.equipmentMovementService.getMovementsByType(pagination, type);
  }

  @Get('equipment/:equipmentId')
  async getMovementsByEquipmentId(
    @Param('equipmentId', new ParseUUIDPipe({ version: '4' })) equipmentId: string,
    @Query() pagination: PaginationDTO
  ) {
    return this.equipmentMovementService.getMovementsByEquipmentId(pagination, equipmentId);
  }

  @Get('serial-number/:serialNumberId')
  async getMovementsBySerialNumberId(
    @Param('serialNumberId', new ParseUUIDPipe({ version: '4' })) serialNumberId: string,
    @Query() pagination: PaginationDTO
  ) {
    return this.equipmentMovementService.getMovementsBySerialNumberId(pagination, serialNumberId);
  }

  @Get('source-shelf/:shelfId')
  async getMovementsBySourceShelfId(
    @Param('shelfId', new ParseUUIDPipe({ version: '4' })) shelfId: string,
    @Query() pagination: PaginationDTO
  ) {
    return this.equipmentMovementService.getMovementsBySourceShelfId(pagination, shelfId);
  }

  @Get('destination-shelf/:shelfId')
  async getMovementsByDestinationShelfId(
    @Param('shelfId', new ParseUUIDPipe({ version: '4' })) shelfId: string,
    @Query() pagination: PaginationDTO
  ) {
    return this.equipmentMovementService.getMovementsByDestinationShelfId(pagination, shelfId);
  }

  @Get(':id')
  async getEquipmentMovementById(
    @Query() pagination: PaginationDTO,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string
  ) {
    return this.equipmentMovementService.getEquipmentMovementById(pagination, id);
  }
}
