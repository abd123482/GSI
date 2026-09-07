import { Injectable } from '@nestjs/common';
import { createClerkClient } from '@clerk/backend';

import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class AuthService {
    private readonly clerk = createClerkClient({
        secretKey: process.env.CLERK_SECRET_KEY!,
    });

    constructor(private readonly prisma: PrismaService) { }

    async getOrCreateLocalUser(clerkUserId: string) {
        // 1. Is this Clerk account already matched with SQL Server?
        const existingUser = await this.prisma.user.findFirst({
            where: {
                clerkUserId,
            },
            include: {
                role: true,
            },
        });

        if (existingUser) {
            return existingUser;
        }

        // 2. First request from this Clerk user:
        // retrieve their profile from Clerk
        const clerkUser = await this.clerk.users.getUser(clerkUserId);

        const email =
            clerkUser.emailAddresses.find(
                (item) => item.id === clerkUser.primaryEmailAddressId,
            )?.emailAddress ??
            clerkUser.emailAddresses[0]?.emailAddress ??
            null;

        const fullName =
            [clerkUser.firstName, clerkUser.lastName]
                .filter(Boolean)
                .join(' ') ||
            clerkUser.username ||
            email;

        // 3. Create matching SQL Server User
        return this.prisma.user.create({
            data: {
                clerkUserId,
                userName: fullName,
                userEmail: email,
                userStatus: 'ACTIVE',

                // roleId can remain NULL until you assign a role
            },
            include: {
                role: true,
            },
        });
    }
}