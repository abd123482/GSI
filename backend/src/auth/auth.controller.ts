import {
  Controller,
  Get,
  UseGuards,
} from '@nestjs/common';
import { ClerkAuthGuard } from './clerk-auth.guard.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import type { AuthenticatedUser } from './types/authenticated-user.type.js';

@Controller('auth')
export class AuthController {
  @UseGuards(ClerkAuthGuard)
  @Get('me')
  getCurrentUser(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }
}