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

import { ShelfService } from './shelves.service.js';

import type {
  CreateShelfDTO,
  PaginationDTO,
  SearchShelfDTO,
  UpdateShelfDTO,
} from './dto/index.js';

@UseGuards(ClerkAuthGuard, PermissionsGuard)
@Controller('shelves')
export class ShelfController {
  constructor(
    private readonly shelfService: ShelfService,
  ) { }

  @RequirePermissions('shelf.read')
  @Get('search')
  searchShelves(
    @Query() query: SearchShelfDTO,
    @Query() pagination: PaginationDTO,
  ) {
    return this.shelfService.searchShelves(
      query,
      pagination,
    );
  }

  @RequirePermissions('shelf.read')
  @Get('name/:name')
  getShelfByName(
    @Param('name') name: string,
    @Query() pagination: PaginationDTO,
  ) {
    return this.shelfService.getShelfByName(
      name,
      pagination,
    );
  }



  @RequirePermissions('shelf.read')
  @Get(':id/serial-numbers')
  getShelfSerialNumbers(
    @Param(
      'id',
      new ParseUUIDPipe({ version: '4' }),
    )
    id: string,

    @Query() pagination: PaginationDTO,
  ) {
    return this.shelfService.getShelfSerialNumbers(
      id,
      pagination,
    );
  }

  @RequirePermissions('shelf.read')
  @Get(':id')
  getShelfById(
    @Param(
      'id',
      new ParseUUIDPipe({ version: '4' }),
    )
    id: string,
  ) {
    return this.shelfService.getShelfById(id);
  }

  @RequirePermissions('shelf.read')
  @Get()
  getAllShelves(
    @Query() pagination: PaginationDTO,
  ) {
    return this.shelfService.getAllShelves(
      pagination,
    );
  }

  @RequirePermissions('shelf.create')
  @Post()
  createShelf(
    @Body() dto: CreateShelfDTO,
  ) {
    return this.shelfService.createShelf(dto);
  }

  @RequirePermissions('shelf.update')
  @Patch(':id')
  updateShelf(
    @Param(
      'id',
      new ParseUUIDPipe({ version: '4' }),
    )
    id: string,

    @Body() dto: UpdateShelfDTO,
  ) {
    return this.shelfService.updateShelf(
      id,
      dto,
    );
  }

  @RequirePermissions('shelf.delete')
  @Delete(':id')
  deleteShelf(
    @Param(
      'id',
      new ParseUUIDPipe({ version: '4' }),
    )
    id: string,
  ) {
    return this.shelfService.deleteShelf(id);
  }
}
