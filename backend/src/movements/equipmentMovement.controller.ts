import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { RequirePermissions } from '../auth/decorators/permissions.decorator.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';
import type {
  CreateEquipmentMovementDTO,
  SearchEquipmentMovementDTO,
} from './dto/index.js';
import { EquipmentMovementService } from './equipmentMovement.service.js';

@UseGuards(ClerkAuthGuard, PermissionsGuard)
@Controller(['movements', 'equipment-movement', 'equipment-movements'])
export class EquipmentMovementController {
  constructor(
    private readonly movementService: EquipmentMovementService,
  ) { }

  /**
   * Canonical route: POST /movements
   *
   * One request creates one movement header and one or many article lines.
   */
  @RequirePermissions('movement.create')
  @Post()
  createMovement(
    @Body() dto: CreateEquipmentMovementDTO,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.movementService.createMovement(dto, user?.userId);
  }

  /**
   * Canonical route: GET /movements?page=1&limit=20
   *
   * Optional filters:
   * movementType, equipmentId, serialNumberId,
   * sourceShelfId, destinationShelfId.
   */
  @RequirePermissions('movement.read')
  @Get()
  getMovements(@Query() query: SearchEquipmentMovementDTO) {
    return this.movementService.getMovements(query);
  }

  @RequirePermissions('movement.read')
  @Get(':id')
  getMovementById(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.movementService.getMovementById(id);
  }
}
