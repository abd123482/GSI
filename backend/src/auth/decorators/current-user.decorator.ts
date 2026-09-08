import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest } from '../clerk-auth.guard.js';
import type { AuthenticatedUser } from '../types/authenticated-user.type.js';

export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.authUser;
    return data && user ? user[data] : user;
  },
);
