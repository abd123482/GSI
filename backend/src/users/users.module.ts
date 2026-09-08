import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { UsersAdminController } from './users-admin.controller.js';
import { UsersAdminService } from './users-admin.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [UsersAdminController],
  providers: [UsersAdminService],
  exports: [UsersAdminService],
})
export class UsersModule {}
