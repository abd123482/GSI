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
import { ShelfService } from './shelves.service.js';
import type {
  CreateShelfDTO,
  UpdateShelfDTO,
  SearchShelfDTO,
  PaginationDTO,
} from './dto/index.js';

@UseGuards(ClerkAuthGuard, PermissionsGuard)
@Controller('shelves')
export class ShelfController {
  constructor(private readonly shelfService: ShelfService) {}

  @RequirePermissions('shelf.create')
  @Post()
  async createShelf(@Body() dto: CreateShelfDTO) {
    return this.shelfService.createShelf(dto);
  }

  @RequirePermissions('shelf.read')
  @Get('search')
  async searchShelves(
    @Query() searchShelfDTO: SearchShelfDTO,
    @Query() pagination: PaginationDTO,
  ) {
    return this.shelfService.searchShelves(searchShelfDTO, pagination);
  }

  @RequirePermissions('shelf.read')
  @Get('name/:name')
  async getShelfByName(
    @Param('name') name: string,
    @Query() pagination: PaginationDTO,
  ) {
    return this.shelfService.getShelfByName(pagination, name);
  }

  @RequirePermissions('shelf.read')
  @Get(':id')
  async getShelfById(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() pagination: PaginationDTO,
  ) {
    return this.shelfService.getShelfById(pagination, id);
  }

  @RequirePermissions('shelf.read')
  @Get()
  async getAllShelves(@Query() pagination: PaginationDTO) {
    return this.shelfService.getAllShelves(pagination);
  }

  @RequirePermissions('shelf.update')
  @Patch(':id')
  async updateShelf(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateShelfDTO,
  ) {
    return this.shelfService.updateShelf(dto, id);
  }

  @RequirePermissions('shelf.delete')
  @Delete(':id')
  async deleteShelf(@Param('id', ParseUUIDPipe) id: string) {
    return this.shelfService.deleteShelf(id);
  }
}
