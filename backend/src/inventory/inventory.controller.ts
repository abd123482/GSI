import { Controller, Post, Body, Get, Param, Patch, Query } from "@nestjs/common";
import { InventoryService } from "./inventory.service.js";
import { UseGuards } from "@nestjs/common";
import { ClerkAuthGuard } from "../auth/clerk-auth.guard.js";
import { PermissionsGuard } from "../auth/guards/permissions.guard.js";
import { RequirePermissions } from "../auth/decorators/permissions.decorator.js";
import type { 
  PaginationDTO, 
  CreateInventoryDTO, 
  SubmitTaskDTO, 
  AdjudicateDTO 
} from "./dto/index.js";

@UseGuards(ClerkAuthGuard, PermissionsGuard)
@Controller('inventory')
export class InventoryController {
  constructor(
    private readonly inventory: InventoryService
  ) { }

  @RequirePermissions('inventory.create')
  @Post()
  async createInventory(
    @Body() data: CreateInventoryDTO,
  ) {
    // Assuming req.user is populated by ClerkAuthGuard, pass the user ID
    // Hardcoded to empty string for now, will extract from req context in real auth
    return this.inventory.createInventory(data, "");
  }

  @RequirePermissions('inventory.read')
  @Get()
  async getInventories(@Query() pagination: PaginationDTO) {
    return this.inventory.getInventories(pagination);
  }

  @RequirePermissions('inventory.read')
  @Get(':id')
  async getInventoryById(@Param('id') id: string) {
    return this.inventory.getInventoryById(id);
  }

  @RequirePermissions('inventory.launch')
  @Post(':id/launch')
  async launchInventory(@Param('id') inventoryId: string) {
    return this.inventory.launchInventory(inventoryId);
  }

  @RequirePermissions('inventory.count')
  @Get('my-tasks/:userId')
  async getMyTasks(@Param('userId') userId: string) {
    return this.inventory.getMyTasks(userId);
  }

  @RequirePermissions('inventory.count')
  @Get('tasks/:taskId')
  async getTask(@Param('taskId') taskId: string) {
    return this.inventory.getTask(taskId);
  }

  @RequirePermissions('inventory.count')
  @Post('tasks/:taskId/submit')
  async submitTask(
    @Param('taskId') taskId: string,
    @Body() data: SubmitTaskDTO
  ) {
    return this.inventory.submitCountAttempt(taskId, "", data);
  }

  @RequirePermissions('inventory.adjudicate')
  @Get('adjudicate/:unitId')
  async getAdjudicationUnit(@Param('unitId') unitId: string) {
    return this.inventory.getAdjudicationUnit(unitId);
  }

  @RequirePermissions('inventory.adjudicate')
  @Post(':id/work-units/:unitId/adjudicate')
  async adjudicate(
    @Param('unitId') unitId: string,
    @Body() data: AdjudicateDTO
  ) {
    return this.inventory.manualAdjudicate(unitId, "", data);
  }

  @RequirePermissions('inventory.finalize')
  @Get(':id/adjustments/preview')
  async previewAdjustments(@Param('id') inventoryId: string) {
    return this.inventory.previewAdjustments(inventoryId);
  }

  @RequirePermissions('inventory.finalize')
  @Post(':id/finalize')
  async finalizeInventory(@Param('id') inventoryId: string) {
    return this.inventory.finalizeInventory(inventoryId, "");
  }
}