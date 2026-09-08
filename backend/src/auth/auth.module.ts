import {
  Global,
  Module,
} from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { ClerkAuthGuard } from './clerk-auth.guard.js';
import { ClerkWebhookController } from './clerk-webhook.controller.js';
import { RolesGuard } from './guards/roles.guard.js';
import { PermissionsGuard } from './guards/permissions.guard.js';

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [
    AuthController,
    ClerkWebhookController,
  ],
  providers: [
    AuthService,
    ClerkAuthGuard,
    RolesGuard,
    PermissionsGuard,
  ],
  exports: [
    AuthService,
    ClerkAuthGuard,
    RolesGuard,
    PermissionsGuard,
  ],
})
export class AuthModule {}