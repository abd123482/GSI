import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { EquipmentMovementController } from './equipmentMovement.controller.js';
import { EquipmentMovementService } from './equipmentMovement.service.js';

import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [EquipmentMovementController],
  providers: [EquipmentMovementService],
  exports: [EquipmentMovementService],
})
export class EquipmentMovementModule { }
