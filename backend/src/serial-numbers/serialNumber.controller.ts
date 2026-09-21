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

import { SerialNumberService } from './serialNumber.service.js';

import type {
  CreateBatchSerialNumberDTO,
  CreateSerialNumberDTO,
  PaginationDTO,
  SearchSerialNumberDTO,
  UpdateSerialNumberDTO,
  UpdateSerialNumberStatusDTO,
} from './dto/index.js';

@UseGuards(ClerkAuthGuard, PermissionsGuard)
@Controller(['serial-number', 'serial-numbers'])
export class SerialNumberController {
  constructor(
    private readonly serialNumberService:
      SerialNumberService,
  ) { }

  @RequirePermissions('serial-number.create')
  @Post('batch')
  createBatchSerialNumbers(
    @Body() dto: CreateBatchSerialNumberDTO,
  ) {
    return this.serialNumberService
      .createBatchSerialNumbers(dto);
  }

  @RequirePermissions('serial-number.create')
  @Post()
  createSerialNumber(
    @Body() dto: CreateSerialNumberDTO,
  ) {
    return this.serialNumberService
      .createSerialNumber(dto);
  }

  /*
   * Canonical paginated/search route.
   *
   * Examples:
   * GET /serial-numbers?page=1&limit=20
   * GET /serial-numbers?equipmentId=<uuid>
   * GET /serial-numbers?serialNumberStatus=AVAILABLE
   * GET /serial-numbers?serialNumberCode=ABC
   */
  @RequirePermissions('serial-number.read')
  @Get()
  getSerialNumbers(
    @Query() query: SearchSerialNumberDTO,
    @Query() pagination: PaginationDTO,
  ) {
    return this.serialNumberService.getSerialNumbers(
      query,
      pagination,
    );
  }

  /*
   * Compatibility route for exact code lookup.
   */
  @RequirePermissions('serial-number.read')
  @Get('code/:code')
  getSerialNumberByCode(
    @Param('code') code: string,
  ) {
    return this.serialNumberService
      .getSerialNumberByCode(code);
  }

  /*
   * Compatibility route for status filtering.
   */
  @RequirePermissions('serial-number.read')
  @Get('status/:status')
  getSerialNumbersByStatus(
    @Param('status') status: string,
    @Query() pagination: PaginationDTO,
  ) {
    return this.serialNumberService.getSerialNumbers(
      {
        serialNumberStatus: status,
      },
      pagination,
    );
  }

  @RequirePermissions('serial-number.update')
  @Patch(':id/status')
  updateSerialNumberStatus(
    @Param(
      'id',
      new ParseUUIDPipe({ version: '4' }),
    )
    id: string,

    @Body() dto: UpdateSerialNumberStatusDTO,
  ) {
    return this.serialNumberService
      .updateSerialNumberStatus(id, dto);
  }

  @RequirePermissions('serial-number.read')
  @Get(':id')
  getSerialNumberById(
    @Param(
      'id',
      new ParseUUIDPipe({ version: '4' }),
    )
    id: string,
  ) {
    return this.serialNumberService
      .getSerialNumberById(id);
  }

  @RequirePermissions('serial-number.update')
  @Patch(':id')
  updateSerialNumber(
    @Param(
      'id',
      new ParseUUIDPipe({ version: '4' }),
    )
    id: string,

    @Body() dto: UpdateSerialNumberDTO,
  ) {
    return this.serialNumberService
      .updateSerialNumber(id, dto);
  }

  @RequirePermissions('serial-number.delete')
  @Delete(':id')
  deleteSerialNumber(
    @Param(
      'id',
      new ParseUUIDPipe({ version: '4' }),
    )
    id: string,
  ) {
    return this.serialNumberService
      .deleteSerialNumber(id);
  }
}
