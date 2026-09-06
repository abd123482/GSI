import { Module } from '@nestjs/common';
import { EquipmentMovementController } from './equipmentMovement.controller.js';
import { EquipmentMovementService } from './equipmentMovement.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [EquipmentMovementController],
  providers: [EquipmentMovementService],
  exports: [EquipmentMovementService],
})
export class EquipmentMovementModule {}
