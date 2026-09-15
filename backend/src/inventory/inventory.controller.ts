import { Controller, Post, Body } from "@nestjs/common";
import { InventoryService } from "./inventory.service.js";
import type { CreateInventoryDTO } from "./dto/createInventory.dto.js";
import { UseGuards } from "@nestjs/common";
import { ClerkAuthGuard } from "../auth/clerk-auth.guard.js";
import { PermissionsGuard } from "../auth/guards/permissions.guard.js";
import { RequirePermissions } from "../auth/decorators/permissions.decorator.js";

@UseGuards(ClerkAuthGuard, PermissionsGuard)
@Controller('inventory')
export class InventoryController {
  constructor(
    private readonly inventory: InventoryService
  ) { }
  @RequirePermissions('inventory.create')
  @Post()
  async createInventory(
    @Body() data: CreateInventoryDTO
  ) {
    return this.inventory.createEnventory(data)
  }

}