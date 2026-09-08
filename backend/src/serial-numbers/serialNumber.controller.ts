import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { RequirePermissions } from '../auth/decorators/permissions.decorator.js';
import { SerialNumberService } from './serialNumber.service.js';
import type {
  CreateSerialNumberDTO,
  UpdateSerialNumberDTO,
  UpdateSerialNumberStatusDTO,
  PaginationDTO,
} from './dto/index.js';

@UseGuards(ClerkAuthGuard, PermissionsGuard)
@Controller('serial-number')
export class SerialNumberController {
  constructor(private readonly serialNumberService: SerialNumberService) {}

  @RequirePermissions('serial-number.create')
  @Post()
  async createSerialNumber(@Body() data: CreateSerialNumberDTO) {
    return this.serialNumberService.createSerialNumber(data);
  }

  @RequirePermissions('serial-number.read')
  @Get()
  async getAllSerialNumbers(@Query() query: PaginationDTO) {
    return this.serialNumberService.getAllSerialNumbers(query);
  }

  @RequirePermissions('serial-number.read')
  @Get(':id')
  async getSerialNumberById(
    @Query() query: PaginationDTO,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.serialNumberService.getSerialNumberById(query, id);
  }

  @RequirePermissions('serial-number.read')
  @Get('code/:code')
  async getSerialNumberByCode(
    @Query() query: PaginationDTO,
    @Param('serialNumberCode') serialNumberCode: string,
  ) {
    return this.serialNumberService.getSerialNumberByCode(query, serialNumberCode);
  }

  @RequirePermissions('serial-number.update')
  @Patch(':id')
  async updateSerialNumber(
    @Body() data: UpdateSerialNumberDTO,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.serialNumberService.updateSerialNumber(data, id);
  }

  @RequirePermissions('serial-number.read')
  @Get('status/:status')
  async getSerialNumberByStatus(
    @Query() query: PaginationDTO,
    @Param('status') status: string,
  ) {
    return this.serialNumberService.getSerialNumberByStatus(query, status);
  }

  @RequirePermissions('serial-number.update')
  @Patch(':id/status')
  async updateSerialNumberStatus(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() data: UpdateSerialNumberStatusDTO,
  ) {
    return this.serialNumberService.updateSerialNumberStatus(id, data);
  }

  @RequirePermissions('serial-number.delete')
  @Delete(':id')
  async deleteSerialNumber(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.serialNumberService.deleteSerialNumber(id);
  }
}
