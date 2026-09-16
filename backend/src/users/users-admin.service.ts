import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { GetUsersQueryDTO } from './dto/get-users-query.dto.js';
import type { UserStatusType } from './dto/update-user-status.dto.js';

const SAFE_USER_SELECT = {
  userId: true,
  clerkUserId: true,
  userName: true,
  userEmail: true,
  roleId: true,
  userStatus: true,
  role: {
    select: {
      roleId: true,
      roleName: true,
      permissions: {
        select: {
          permissionId: true,
          permissionName: true,
        },
      },
    },
  },
};

@Injectable()
export class UsersAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getUsers(query: GetUsersQueryDTO) {
    const { status, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where = status ? { userStatus: status } : {};

    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: SAFE_USER_SELECT,
        orderBy: { userName: 'asc' },
      }),
    ]);

    return {
      data: users,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getUserById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { userId },
      select: SAFE_USER_SELECT,
    });

    if (!user) {
      throw new NotFoundException(`User with ID '${userId}' not found`);
    }

    return user;
  }

  async updateUserStatus(userId: string, status: UserStatusType) {
    const existing = await this.prisma.user.findUnique({
      where: { userId },
    });

    if (!existing) {
      throw new NotFoundException(`User with ID '${userId}' not found`);
    }

    return await this.prisma.user.update({
      where: { userId },
      data: { userStatus: status },
      select: SAFE_USER_SELECT,
    });
  }

  async updateUserRole(userId: string, roleId: string | null) {
    const existingUser = await this.prisma.user.findUnique({
      where: { userId },
    });

    if (!existingUser) {
      throw new NotFoundException(`User with ID '${userId}' not found`);
    }

    if (roleId !== null) {
      const existingRole = await this.prisma.role.findUnique({
        where: { roleId },
      });

      if (!existingRole) {
        throw new BadRequestException(`Role with ID '${roleId}' does not exist`);
      }
    }

    return await this.prisma.user.update({
      where: { userId },
      data: { roleId },
      select: SAFE_USER_SELECT,
    });
  }

  async getRoles() {
    return await this.prisma.role.findMany({
      include: {
        permissions: {
          select: {
            permissionId: true,
            permissionName: true,
          },
        },
        _count: {
          select: {
            users: true,
          },
        },
      },
      orderBy: { roleName: 'asc' },
    });
  }

  async createRole(roleName: string, permissions: string[]) {
    const trimmedRoleName = roleName.trim();
    const existingRole = await this.prisma.role.findFirst({
      where: { roleName: trimmedRoleName },
    });

    if (existingRole) {
      throw new BadRequestException(
        `Le rôle avec le nom '${trimmedRoleName}' existe déjà.`,
      );
    }

    return await this.prisma.role.create({
      data: {
        roleName: trimmedRoleName,
        permissions: {
          create: permissions.map((permissionName) => ({
            permissionName,
          })),
        },
      },
      include: {
        permissions: {
          select: {
            permissionId: true,
            permissionName: true,
          },
        },
        _count: {
          select: {
            users: true,
          },
        },
      },
    });
  }

  async editRole(roleId: string, roleName?: string, permissions?: string[]) {
    const existingRole = await this.prisma.role.findUnique({
      where: { roleId },
    });

    if (!existingRole) {
      throw new NotFoundException(`Role with ID '${roleId}' not found`);
    }

    if (existingRole.roleName.toUpperCase() === 'ADMIN') {
      throw new BadRequestException('Action interdite : Vous ne pouvez pas modifier le rôle système ADMIN.');
    }

    if (roleName) {
      const trimmedRoleName = roleName.trim();
      const duplicateRole = await this.prisma.role.findFirst({
        where: { roleName: trimmedRoleName, roleId: { not: roleId } },
      });
      if (duplicateRole) {
        throw new BadRequestException(`Le rôle avec le nom '${trimmedRoleName}' existe déjà.`);
      }
    }

    return await this.prisma.$transaction(async (tx) => {
      const data: any = {};
      if (roleName) {
        data.roleName = roleName.trim();
      }

      if (permissions) {
        // Delete existing permissions
        await tx.permission.deleteMany({
          where: { roleId },
        });

        data.permissions = {
          create: permissions.map((permissionName) => ({
            permissionName,
          })),
        };
      }

      return await tx.role.update({
        where: { roleId },
        data,
        include: {
          permissions: {
            select: {
              permissionId: true,
              permissionName: true,
            },
          },
          _count: {
            select: { users: true },
          },
        },
      });
    });
  }

  async getAvailablePermissions(): Promise<string[]> {
    const SYSTEM_PERMISSIONS = [
      'equipment.read',
      'equipment.create',
      'equipment.update',
      'equipment.delete',
      'serial-number.read',
      'serial-number.create',
      'serial-number.update',
      'serial-number.delete',
      'movement.read',
      'movement.create',
      'shelf.read',
      'shelf.create',
      'shelf.update',
      'shelf.delete',
      'stock.read',
      'stock.create',
      'stock.update',
      'stock.delete',
      'user.manage',
      'role.manage',
    ];

    const dbPermissions = await this.prisma.permission.findMany({
      select: { permissionName: true },
      distinct: ['permissionName'],
    });

    const set = new Set<string>(SYSTEM_PERMISSIONS);
    for (const p of dbPermissions) {
      if (p.permissionName) {
        set.add(p.permissionName);
      }
    }

    return Array.from(set).sort();
  }
}

