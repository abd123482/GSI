import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { RequirePermissions } from '../auth/decorators/permissions.decorator.js';
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
  ) {
    const validated = updateUserStatusSchema.parse(body);
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
}
