import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { verifyToken } from '@clerk/backend';
import type { Request } from 'express';
import { AuthService } from './auth.service.js';
import type { AuthenticatedUser } from './types/authenticated-user.type.js';

export type AuthenticatedRequest = Request & {
  authUser?: AuthenticatedUser;
};

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  private readonly logger = new Logger(ClerkAuthGuard.name);

  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;

    if (!authorization || !authorization.startsWith('Bearer ')) {
      throw new UnauthorizedException('Authentication required');
    }

    const token = authorization.substring(7).trim();
    if (!token) {
      throw new UnauthorizedException('Authentication required: Bearer token is empty');
    }

    let claims: { sub?: string };
    try {
      claims = await verifyToken(token, {
        jwtKey: process.env.CLERK_JWT_KEY!,
        authorizedParties: process.env.FRONTEND_URL
          ? [process.env.FRONTEND_URL]
          : undefined,
      });
    } catch (err: any) {
      this.logger.debug(`Clerk token verification failed: ${err?.message || err}`);
      throw new UnauthorizedException('Invalid or expired Clerk session');
    }

    const clerkUserId = claims?.sub;
    if (!clerkUserId) {
      throw new UnauthorizedException('Invalid Clerk token payload');
    }

    let dbUser: any;
    try {
      dbUser = await this.authService.getOrCreateLocalUser(clerkUserId);
    } catch (dbErr: any) {
      this.logger.error(`Database error resolving user for Clerk ID ${clerkUserId}:`, dbErr);
      throw new InternalServerErrorException('Failed to resolve local user account');
    }

    if (!dbUser) {
      throw new ForbiddenException('User account could not be found or created');
    }

    // Task 9: User Status Enforcement
    // ACTIVE -> allowed
    // DISABLED / BLOCKED / INACTIVE -> 403 Forbidden
    const status = (dbUser.userStatus || '').toUpperCase();
    if (status !== 'ACTIVE') {
      throw new ForbiddenException(
        `User account is not active (status: ${dbUser.userStatus ?? 'UNKNOWN'}). Access is forbidden.`,
      );
    }

    const permissions: string[] = (dbUser.role?.permissions ?? [])
      .map((p: any) => p.permissionName)
      .filter(Boolean);

    request.authUser = {
      userId: dbUser.userId,
      clerkUserId: dbUser.clerkUserId ?? clerkUserId,
      userName: dbUser.userName ?? null,
      userEmail: dbUser.userEmail ?? null,
      roleId: dbUser.roleId ?? null,
      roleName: dbUser.role?.roleName ?? null,
      permissions,
      status: dbUser.userStatus ?? null,
    };

    return true;
  }
}