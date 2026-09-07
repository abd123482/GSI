import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';

import { verifyToken } from '@clerk/backend';
import type { Request } from 'express';

import { AuthService } from './auth.service.js';

export type AuthenticatedRequest = Request & {
    authUser?: {
        clerkUserId: string;
        userId: string;
        roleId: string | null;
        status: string | null;
    };
};

@Injectable()
export class ClerkAuthGuard implements CanActivate {
    constructor(private readonly authService: AuthService) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request =
            context.switchToHttp().getRequest<AuthenticatedRequest>();

        const authorization = request.headers.authorization;

        if (!authorization?.startsWith('Bearer ')) {
            throw new UnauthorizedException('Authentication required');
        }

        const token = authorization.substring(7);

        try {
            const claims = await verifyToken(token, {
                jwtKey: process.env.CLERK_JWT_KEY!,
                authorizedParties: [
                    process.env.FRONTEND_URL!,
                ],
            });

            const clerkUserId = claims.sub;

            if (!clerkUserId) {
                throw new UnauthorizedException('Invalid Clerk user');
            }

            const dbUser =
                await this.authService.getOrCreateLocalUser(clerkUserId);

            request.authUser = {
                clerkUserId,
                userId: dbUser.userId,
                roleId: dbUser.roleId ?? null,
                status: dbUser.userStatus ?? null,
            };

            return true;
        } catch {
            throw new UnauthorizedException(
                'Invalid or expired Clerk session',
            );
        }
    }
}