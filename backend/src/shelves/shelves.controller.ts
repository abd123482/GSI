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
import { ShelfService } from './shelves.service.js';
import type {
  CreateShelfDTO,
  UpdateShelfDTO,
  SearchShelfDTO,
  PaginationDTO,
} from './dto/index.js';

@Controller('shelves')
export class ShelfController {
  constructor(private readonly shelfService: ShelfService) {}

  @Post()
  async createShelf(@Body() dto: CreateShelfDTO) {
    return this.shelfService.createShelf(dto);
  }

  @Get('search')
  async searchShelves(
    @Query() searchShelfDTO: SearchShelfDTO,
    @Query() pagination: PaginationDTO,
  ) {
    return this.shelfService.searchShelves(searchShelfDTO, pagination);
  }

  @Get('name/:name')
  async getShelfByName(
    @Param('name') name: string,
    @Query() pagination: PaginationDTO,
  ) {
    return this.shelfService.getShelfByName(pagination, name);
  }

  @Get(':id')
  async getShelfById(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() pagination: PaginationDTO,
  ) {
    return this.shelfService.getShelfById(pagination, id);
  }

  @Get()
  async getAllShelves(@Query() pagination: PaginationDTO) {
    return this.shelfService.getAllShelves(pagination);
  }

  @Patch(':id')
  async updateShelf(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateShelfDTO,
  ) {
    return this.shelfService.updateShelf(dto, id);
  }

  @Delete(':id')
  async deleteShelf(@Param('id', ParseUUIDPipe) id: string) {
    return this.shelfService.deleteShelf(id);
  }
}
