import {
    Controller,
    Get,
    Req,
    UseGuards,
} from '@nestjs/common';

import {
    ClerkAuthGuard,
    type AuthenticatedRequest,
} from './clerk-auth.guard.js';

@Controller('auth')
export class AuthController {
    @UseGuards(ClerkAuthGuard)
    @Get('me')
    getCurrentUser(
        @Req() request: AuthenticatedRequest,
    ) {
        return request.authUser;
    }
}