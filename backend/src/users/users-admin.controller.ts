import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { RequirePermissions } from '../auth/decorators/permissions.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';
import { UsersAdminService } from './users-admin.service.js';
import {
  type UpdateUserStatusDTO,
  updateUserStatusSchema,
} from './dto/update-user-status.dto.js';
import {
  type UpdateUserRoleDTO,
  updateUserRoleSchema,
} from './dto/update-user-role.dto.js';
import {
  type GetUsersQueryDTO,
  getUsersQuerySchema,
} from './dto/get-users-query.dto.js';
import {
  type CreateRoleDTO,
  createRoleSchema,
} from './dto/create-role.dto.js';
import {
  type EditRoleDTO,
  editRoleSchema,
} from './dto/edit-role.dto.js';

@UseGuards(ClerkAuthGuard, PermissionsGuard)
@Controller('admin')
export class UsersAdminController {
  constructor(private readonly usersAdminService: UsersAdminService) {}

  @RequirePermissions('user.manage')
  @Get('users')
  async getUsers(@Query() query: GetUsersQueryDTO) {
    const validated = getUsersQuerySchema.parse(query);
    return this.usersAdminService.getUsers(validated);
  }

  @RequirePermissions('user.manage')
  @Get('users/:userId')
  async getUserById(
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
  ) {
    return this.usersAdminService.getUserById(userId);
  }

  @RequirePermissions('user.manage')
  @Patch('users/:userId/status')
  async updateUserStatus(
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
    @Body() body: UpdateUserStatusDTO,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    const validated = updateUserStatusSchema.parse(body);

    if (userId === currentUser.userId && validated.status === 'DISABLED') {
      throw new BadRequestException(
        'Action interdite : Vous ne pouvez pas désactiver votre propre compte administrateur.',
      );
    }

    return this.usersAdminService.updateUserStatus(userId, validated.status);
  }

  @RequirePermissions('role.manage')
  @Patch('users/:userId/role')
  async updateUserRole(
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
    @Body() body: UpdateUserRoleDTO,
  ) {
    const validated = updateUserRoleSchema.parse(body);
    return this.usersAdminService.updateUserRole(userId, validated.roleId);
  }

  @RequirePermissions('role.manage')
  @Get('roles')
  async getRoles() {
    return this.usersAdminService.getRoles();
  }

  @RequirePermissions('role.manage')
  @Post('roles')
  async createRole(@Body() body: CreateRoleDTO) {
    const validated = createRoleSchema.parse(body);
    return this.usersAdminService.createRole(
      validated.roleName,
      validated.permissions,
    );
  }

  @RequirePermissions('role.manage')
  @Patch('roles/:roleId')
  async editRole(
    @Param('roleId', new ParseUUIDPipe({ version: '4' })) roleId: string,
    @Body() body: EditRoleDTO,
  ) {
    const validated = editRoleSchema.parse(body);
    return this.usersAdminService.editRole(
      roleId,
      validated.roleName,
      validated.permissions,
    );
  }

  @RequirePermissions('role.manage')
  @Get('permissions')
  async getPermissions() {
    return this.usersAdminService.getAvailablePermissions();
  }
}
