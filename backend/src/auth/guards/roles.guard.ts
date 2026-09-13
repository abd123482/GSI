import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import type { AuthenticatedRequest } from '../clerk-auth.guard.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.authUser;

    if (!user || !user.roleName) {
      throw new ForbiddenException('Access denied: User has no assigned role');
    }

    // Universal Admin Superuser Bypass:
    // Any user with role 'ADMIN' or with isAdmin flag has access to all role-restricted routes
    if (user.roleName.trim().toUpperCase() === 'ADMIN' || user.isAdmin === true) {
      return true;
    }

    const hasRole = requiredRoles.includes(user.roleName);
    if (!hasRole) {
      throw new ForbiddenException(
        `Access denied: Required role(s) [${requiredRoles.join(', ')}] not held by user (current role: ${user.roleName})`,
      );
    }

    return true;
  }
}
