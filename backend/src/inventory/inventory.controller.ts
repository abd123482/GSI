import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { ClerkAuthGuard } from '../auth/clerk-auth.guard.js';
import type { AuthenticatedRequest } from '../auth/clerk-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { RequirePermissions } from '../auth/decorators/permissions.decorator.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';

import type {
  AdjudicateDTO,
  AssignThirdUserDTO,
  CreateInventoryDTO,
  PaginationDTO,
  ResolveIssueDTO,
  SaveDraftDTO,
  SubmitTaskDTO,
} from './dto/index.js';

import { InventoryService } from './inventory.service.js';

@UseGuards(ClerkAuthGuard, PermissionsGuard)
@Controller('inventory')
export class InventoryController {
  constructor(
    private readonly inventory: InventoryService,
  ) {}

  @RequirePermissions('inventory.create')
  @Post()
  createInventory(
    @Body() data: CreateInventoryDTO,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventory.createInventory(
      data,
      user?.userId ?? '',
    );
  }

  @Get()
  getInventories(
    @Query() pagination: PaginationDTO,
    @Req() req: AuthenticatedRequest,
  ) {
    const hasRead =
      req.authUser?.permissions?.includes('inventory.read') ||
      req.authUser?.isAdmin;

    const filterUserId = hasRead
      ? undefined
      : req.authUser?.userId;

    return this.inventory.getInventories(
      pagination,
      filterUserId,
    );
  }

  @RequirePermissions('inventory.count', 'inventory.adjudicate')
  @Get('my-tasks')
  getMyTasksCurrent(
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventory.getMyTasks(user.userId);
  }

  @RequirePermissions('inventory.count', 'inventory.adjudicate')
  @Get('my-tasks/:userId')
  getMyTasks(
    @Param('userId') userId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (
      userId &&
      userId !== user.userId &&
      !user.isAdmin
    ) {
      throw new ForbiddenException(
        "Vous ne pouvez pas accéder aux tâches d'un autre utilisateur.",
      );
    }

    const targetUserId =
      userId &&
      userId !== 'undefined' &&
      userId !== 'null'
        ? userId
        : user.userId;

    return this.inventory.getMyTasks(targetUserId);
  }

  @RequirePermissions('inventory.count', 'inventory.adjudicate')
  @Get('tasks/:taskId')
  getTask(
    @Param('taskId') taskId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventory.getTask(
      taskId,
      user?.userId,
    );
  }

  @RequirePermissions('inventory.count', 'inventory.adjudicate')
  @Patch('tasks/:taskId/draft')
  saveDraft(
    @Param('taskId') taskId: string,
    @Body() data: SaveDraftDTO,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventory.saveDraft(
      taskId,
      user.userId,
      data,
    );
  }

  @RequirePermissions('inventory.count', 'inventory.adjudicate')
  @Post('tasks/:taskId/submit')
  submitTask(
    @Param('taskId') taskId: string,
    @Body() data: SubmitTaskDTO,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventory.submitCountAttempt(
      taskId,
      user.userId,
      data,
    );
  }

  @RequirePermissions('inventory.read')
  @Get(':id/progress')
  getInventoryProgress(
    @Param('id') inventoryId: string,
  ) {
    return this.inventory.getInventoryProgress(inventoryId);
  }

  @RequirePermissions('inventory.read')
  @Get(':id/comparison')
  getInventoryComparison(
    @Param('id') inventoryId: string,
  ) {
    return this.inventory.getInventoryComparison(inventoryId);
  }

  @RequirePermissions('inventory.read')
  @Get(':id/report')
  getInventoryReport(
    @Param('id') inventoryId: string,
  ) {
    return this.inventory.getInventoryReport(inventoryId);
  }

  @RequirePermissions('inventory.read')
  @Get(':id/issues')
  getInventoryIssues(
    @Param('id') inventoryId: string,
  ) {
    return this.inventory.getInventoryIssues(inventoryId);
  }

  @RequirePermissions('inventory.finalize', 'inventory.create')
  @Post(':id/issues/:issueId/resolve')
  resolveInvestigationIssue(
    @Param('id') inventoryId: string,
    @Param('issueId') issueId: string,
    @Body() data: ResolveIssueDTO,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventory.resolveInvestigationIssue(
      inventoryId,
      issueId,
      user.userId,
      data,
    );
  }

  @RequirePermissions('inventory.launch')
  @Post(':id/launch')
  launchInventory(
    @Param('id') inventoryId: string,
  ) {
    return this.inventory.launchInventory(inventoryId);
  }

  @RequirePermissions('inventory.finalize')
  @Post(':id/finalize')
  finalizeInventory(
    @Param('id') inventoryId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventory.finalizeInventory(
      inventoryId,
      user.userId,
    );
  }

  @RequirePermissions('inventory.read')
  @Get(':id')
  getInventoryById(
    @Param('id') id: string,
  ) {
    return this.inventory.getInventoryById(id);
  }

  @RequirePermissions('inventory.delete')
  @Delete(':id')
  deleteInventory(
    @Param('id') id: string,
  ) {
    return this.inventory.deleteInventory(id);
  }

  // Legacy compatibility routes.

  @RequirePermissions('inventory.adjudicate', 'inventory.count')
  @Get('adjudicate/:unitId')
  getAdjudicationUnit(
    @Param('unitId') unitId: string,
  ) {
    return this.inventory.getAdjudicationUnit(unitId);
  }

  @RequirePermissions('inventory.adjudicate', 'inventory.count')
  @Post(':id/work-units/:unitId/adjudicate')
  adjudicate(
    @Param('unitId') unitId: string,
    @Body() data: AdjudicateDTO,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventory.manualAdjudicate(
      unitId,
      user.userId,
      data,
    );
  }

  @RequirePermissions('inventory.launch', 'inventory.adjudicate')
  @Post(':id/work-units/:unitId/assign-third-user')
  assignThirdUser(
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
  assignThirdUserToAll(
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
  autoCompleteCounts(
    @Param('id') inventoryId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventory.autoCompleteCounts(
      inventoryId,
      user.userId,
    );
  }

  @RequirePermissions(
    'inventory.launch',
    'inventory.count',
    'inventory.adjudicate',
  )
  @Post(':id/work-units/:unitId/notify-pending')
  notifyPendingControllerForUnit(
    @Param('id') inventoryId: string,
    @Param('unitId') unitId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventory.notifyPendingControllerForUnit(
      inventoryId,
      unitId,
      user?.userId,
    );
  }

  @RequirePermissions(
    'inventory.launch',
    'inventory.count',
    'inventory.adjudicate',
  )
  @Post(':id/notify-all-pending')
  notifyAllPendingControllers(
    @Param('id') inventoryId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventory.notifyAllPendingControllers(
      inventoryId,
      user?.userId,
    );
  }
}
