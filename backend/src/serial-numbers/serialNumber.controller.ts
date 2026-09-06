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
} from '@nestjs/common';
import { SerialNumberService } from './serialNumber.service.js';
import type {
  CreateSerialNumberDTO,
  UpdateSerialNumberDTO,
  UpdateSerialNumberStatusDTO,
  PaginationDTO
} from './dto/index.js';

@Controller('serial-number')
export class SerialNumberController {
  constructor(private readonly serialNumberService: SerialNumberService) { }

  @Post()
  async createSerialNumber(@Body() data: CreateSerialNumberDTO) {
    return this.serialNumberService.createSerialNumber(data);
  }

  @Get()
  async getAllSerialNumbers(@Query() query: PaginationDTO) {
    return this.serialNumberService.getAllSerialNumbers(query);
  }

  @Get(':id')
  async getSerialNumberById(
    @Query() query: PaginationDTO,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string
  ) {
    return this.serialNumberService.getSerialNumberById(query, id);
  }

  @Get('code/:code')
  async getSerialNumberByCode(
    @Query() query: PaginationDTO,
    @Param('serialNumberCode') serialNumberCode: string
  ) {
    return this.serialNumberService.getSerialNumberByCode(query, serialNumberCode);
  }

  @Patch(':id')
  async updateSerialNumber(
    @Body() data: UpdateSerialNumberDTO,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string
  ) {
    return this.serialNumberService.updateSerialNumber(data, id);
  }

  @Get('status/:status')
  async getSerialNumberByStatus(
    @Query() query: PaginationDTO,
    @Param('status') status: string
  ) {
    return this.serialNumberService.getSerialNumberByStatus(query, status);
  }

  @Patch(':id/status')
  async updateSerialNumberStatus(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() data: UpdateSerialNumberStatusDTO
  ) {
    return this.serialNumberService.updateSerialNumberStatus(id, data);
  }
  @Delete(':id')
  async deleteSerialNumber(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string
  ) {
    return this.serialNumberService.deleteSerialNumber(id);
  }
}
