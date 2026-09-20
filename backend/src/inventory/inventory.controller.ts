import { Controller, Post, Body, Get, Param, Patch, Query, Req, UseGuards, Delete, ForbiddenException } from "@nestjs/common";
import { InventoryService } from "./inventory.service.js";
import { ClerkAuthGuard } from "../auth/clerk-auth.guard.js";
import type { AuthenticatedRequest } from "../auth/clerk-auth.guard.js";
import { PermissionsGuard } from "../auth/guards/permissions.guard.js";
import { RequirePermissions } from "../auth/decorators/permissions.decorator.js";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import type { AuthenticatedUser } from "../auth/types/authenticated-user.type.js";
import type { 
  PaginationDTO, 
  CreateInventoryDTO, 
  SubmitTaskDTO, 
  SaveDraftDTO,
  ResolveIssueDTO,
  AdjudicateDTO,
  AssignThirdUserDTO
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
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventory.createInventory(data, user?.userId ?? "");
  }

  // Allowed for any authenticated user, but filters in service if they lack global read
  @Get()
  async getInventories(@Query() pagination: PaginationDTO, @Req() req: AuthenticatedRequest) {
    const hasRead = req.authUser?.permissions?.includes('inventory.read') || req.authUser?.isAdmin;
    const filterUserId = hasRead ? undefined : req.authUser?.userId;
    return this.inventory.getInventories(pagination, filterUserId);
  }

  @RequirePermissions('inventory.count', 'inventory.adjudicate')
  @Get('my-tasks')
  async getMyTasksCurrent(@CurrentUser() user: AuthenticatedUser) {
    return this.inventory.getMyTasks(user.userId);
  }

  @RequirePermissions('inventory.count', 'inventory.adjudicate')
  @Get('my-tasks/:userId')
  async getMyTasks(
    @Param('userId') userId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    // Security: Only admins can view another user's tasks
    if (userId && userId !== user.userId && !user.isAdmin) {
      throw new ForbiddenException('Vous ne pouvez pas accéder aux tâches d\'un autre utilisateur.');
    }
    const targetUserId = (userId && userId !== 'undefined' && userId !== 'null') ? userId : user.userId;
    return this.inventory.getMyTasks(targetUserId);
  }

  @RequirePermissions('inventory.count', 'inventory.adjudicate')
  @Get('tasks/:taskId')
  async getTask(
    @Param('taskId') taskId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.inventory.getTask(taskId, user?.userId);
  }

  @RequirePermissions('inventory.count', 'inventory.adjudicate')
  @Patch('tasks/:taskId/draft')
  async saveDraft(
    @Param('taskId') taskId: string,
    @Body() data: SaveDraftDTO,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventory.saveDraft(taskId, user.userId, data);
  }

  @RequirePermissions('inventory.count', 'inventory.adjudicate')
  @Post('tasks/:taskId/submit')
  async submitTask(
    @Param('taskId') taskId: string,
    @Body() data: SubmitTaskDTO,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventory.submitCountAttempt(taskId, user.userId, data);
  }

  @RequirePermissions('inventory.read')
  @Get(':id/progress')
  async getInventoryProgress(@Param('id') inventoryId: string) {
    return this.inventory.getInventoryProgress(inventoryId);
  }

  @RequirePermissions('inventory.read')
  @Get(':id/comparison')
  async getInventoryComparison(@Param('id') inventoryId: string) {
    return this.inventory.getInventoryComparison(inventoryId);
  }

  @RequirePermissions('inventory.read')
  @Get(':id/report')
  async getInventoryReport(@Param('id') inventoryId: string) {
    return this.inventory.getInventoryReport(inventoryId);
  }

  @RequirePermissions('inventory.read')
  @Get(':id/issues')
  async getInventoryIssues(@Param('id') inventoryId: string) {
    return this.inventory.getInventoryIssues(inventoryId);
  }

  @RequirePermissions('inventory.finalize', 'inventory.create')
  @Post(':id/issues/:issueId/resolve')
  async resolveInvestigationIssue(
    @Param('id') inventoryId: string,
    @Param('issueId') issueId: string,
    @Body() data: ResolveIssueDTO,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventory.resolveInvestigationIssue(inventoryId, issueId, user.userId, data);
  }

  @RequirePermissions('inventory.launch')
  @Post(':id/launch')
  async launchInventory(@Param('id') inventoryId: string) {
    return this.inventory.launchInventory(inventoryId);
  }

  @RequirePermissions('inventory.finalize')
  @Post(':id/finalize')
  async finalizeInventory(
    @Param('id') inventoryId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventory.finalizeInventory(inventoryId, user.userId);
  }

  @RequirePermissions('inventory.read')
  @Get(':id')
  async getInventoryById(@Param('id') id: string) {
    return this.inventory.getInventoryById(id);
  }

  @RequirePermissions('inventory.delete')
  @Delete(':id')
  async deleteInventory(@Param('id') id: string) {
    return this.inventory.deleteInventory(id);
  }

  // --------------------------------------------------------------------------
  // LEGACY ROUTES
  // --------------------------------------------------------------------------

  @RequirePermissions('inventory.adjudicate', 'inventory.count')
  @Get('adjudicate/:unitId')
  async getAdjudicationUnit(@Param('unitId') unitId: string) {
    return this.inventory.getAdjudicationUnit(unitId);
  }

  @RequirePermissions('inventory.adjudicate', 'inventory.count')
  @Post(':id/work-units/:unitId/adjudicate')
  async adjudicate(
    @Param('unitId') unitId: string,
    @Body() data: AdjudicateDTO,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventory.manualAdjudicate(unitId, user.userId, data);
  }

  @RequirePermissions('inventory.launch', 'inventory.adjudicate')
  @Post(':id/work-units/:unitId/assign-third-user')
  async assignThirdUser(
    @Param('id') inventoryId: string,
    @Param('unitId') unitId: string,
    @Body() body: AssignThirdUserDTO,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventory.assignThirdUser(
      inventoryId,
      unitId,
      body.thirdUserId,
      user.userId,
      body.notes,
    );
  }

  @RequirePermissions('inventory.launch', 'inventory.adjudicate')
  @Post(':id/assign-third-user-all')
  async assignThirdUserToAll(
    @Param('id') inventoryId: string,
    @Body() body: AssignThirdUserDTO,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventory.assignThirdUserToAll(
      inventoryId,
      body.thirdUserId,
      user.userId,
      body.notes,
    );
  }

  @RequirePermissions('inventory.launch', 'inventory.finalize')
  @Post(':id/auto-complete-counts')
  async autoCompleteCounts(
    @Param('id') inventoryId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventory.autoCompleteCounts(inventoryId, user.userId);
  }

  @RequirePermissions('inventory.launch', 'inventory.count', 'inventory.adjudicate')
  @Post(':id/work-units/:unitId/notify-pending')
  async notifyPendingControllerForUnit(
    @Param('id') inventoryId: string,
    @Param('unitId') unitId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventory.notifyPendingControllerForUnit(inventoryId, unitId, user?.userId);
  }

  @RequirePermissions('inventory.launch', 'inventory.count', 'inventory.adjudicate')
  @Post(':id/notify-all-pending')
  async notifyAllPendingControllers(
    @Param('id') inventoryId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventory.notifyAllPendingControllers(inventoryId, user?.userId);
  }
}