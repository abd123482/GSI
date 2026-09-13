import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { RequirePermissions } from '../auth/decorators/permissions.decorator.js';
import { StockService } from './stock.service.js';
import type {
  CreateStockDTO,
  UpdateStockDTO,
  SearchStockDTO,
  PaginationDTO,
} from './dto/index.js';

@UseGuards(ClerkAuthGuard, PermissionsGuard)
@Controller('stocks')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @RequirePermissions('stock.create')
  @Post()
  async createStock(@Body() dto: CreateStockDTO) {
    return this.stockService.createStock(dto);
  }

  @RequirePermissions('stock.search')
  @Get('search')
  async searchStocks(
    @Query() searchStockDTO: SearchStockDTO,
    @Query() pagination: PaginationDTO,
  ) {
    return this.stockService.searchStocks(searchStockDTO, pagination);
  }

  @RequirePermissions('stock.read')
  @Get('statuses')
  async getAllStockStatuses() {
    return this.stockService.getAllStockStatuses();
  }

  @RequirePermissions('stock.read')
  @Get(':id')
  async getStockById(@Param('id', ParseUUIDPipe) id: string) {
    return this.stockService.getStockById(id);
  }

  @RequirePermissions('stock.read')
  @Get()
  async getAllStocks(@Query() pagination: PaginationDTO) {
    return this.stockService.getAllStocks(pagination);
  }

  @RequirePermissions('stock.update')
  @Patch(':id')
  async updateStock(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStockDTO,
  ) {
    return this.stockService.updateStock(dto, id);
  }
}
