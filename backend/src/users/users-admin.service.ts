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
      },
      orderBy: { roleName: 'asc' },
    });
  }
}
