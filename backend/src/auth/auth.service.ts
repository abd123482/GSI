import { Injectable, Logger } from '@nestjs/common';
import { createClerkClient } from '@clerk/backend';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly clerk = createClerkClient({
    secretKey: process.env.CLERK_SECRET_KEY!,
  });

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Primary resolver: finds or lazily creates a local SQL Server user for the given clerkUserId.
   * Includes role and permissions for RBAC enforcement.
   * Handles concurrent creation race conditions gracefully.
   */
  async getOrCreateLocalUser(clerkUserId: string) {
    // 1. Is this Clerk account already matched in SQL Server?
    const existingUser = await this.prisma.user.findFirst({
      where: {
        clerkUserId,
      },
      include: {
        role: {
          include: {
            permissions: true,
          },
        },
      },
    });

    if (existingUser) {
      return existingUser;
    }

    // 2. First request from this Clerk user: retrieve their profile from Clerk
    let clerkUser: any;
    try {
      clerkUser = await this.clerk.users.getUser(clerkUserId);
    } catch (err) {
      this.logger.warn(`Could not retrieve user details from Clerk for ${clerkUserId}:`, err);
    }

    const email =
      clerkUser?.emailAddresses?.find(
        (item: any) => item.id === clerkUser.primaryEmailAddressId,
      )?.emailAddress ??
      clerkUser?.emailAddresses?.[0]?.emailAddress ??
      null;

    const fullName =
      [clerkUser?.firstName, clerkUser?.lastName]
        .filter(Boolean)
        .join(' ') ||
      clerkUser?.username ||
      email;

    // 3. Create matching SQL Server User with race condition protection
    try {
      return await this.prisma.user.create({
        data: {
          clerkUserId,
          userName: fullName,
          userEmail: email,
          userStatus: 'PENDING',
        },
        include: {
          role: {
            include: {
              permissions: true,
            },
          },
        },
      });
    } catch (error: any) {
      // If concurrent request created the record first (Prisma P2002 or unique constraint)
      if (
        error?.code === 'P2002' ||
        error?.message?.includes('UX_User_ClerkUserId') ||
        error?.message?.includes('UNIQUE')
      ) {
        this.logger.log(
          `Handled concurrent user creation race condition for clerkUserId: ${clerkUserId}`,
        );
        const resolvedUser = await this.prisma.user.findFirst({
          where: { clerkUserId },
          include: {
            role: {
              include: {
                permissions: true,
              },
            },
          },
        });
        if (resolvedUser) {
          return resolvedUser;
        }
      }

      this.logger.error(
        `Failed to create local user for clerkUserId ${clerkUserId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Synchronizes profile details received from Clerk webhook (user.created, user.updated).
   * Never overwrites roleId or application-specific internal data.
   */
  async syncUserFromClerk(
    clerkUserId: string,
    profile: { userName?: string | null; userEmail?: string | null },
  ) {
    const existing = await this.prisma.user.findFirst({
      where: { clerkUserId },
    });

    if (existing) {
      return await this.prisma.user.update({
        where: { userId: existing.userId },
        data: {
          ...(profile.userName !== undefined && { userName: profile.userName }),
          ...(profile.userEmail !== undefined && { userEmail: profile.userEmail }),
        },
      });
    }

    // If user does not exist yet, create with PENDING status
    return await this.prisma.user.create({
      data: {
        clerkUserId,
        userName: profile.userName ?? null,
        userEmail: profile.userEmail ?? null,
        userStatus: 'PENDING',
      },
    });
  }

  /**
   * Soft-deletes user when deleted in Clerk (user.deleted).
   * Keeps the SQL record to preserve audit integrity in movements/equipment logs.
   */
  async disableUserFromClerk(clerkUserId: string) {
    const existing = await this.prisma.user.findFirst({
      where: { clerkUserId },
    });

    if (!existing) {
      this.logger.warn(`Clerk webhook attempted to delete non-existent user: ${clerkUserId}`);
      return null;
    }

    return await this.prisma.user.update({
      where: { userId: existing.userId },
      data: {
        userStatus: 'DISABLED',
      },
    });
  }
}