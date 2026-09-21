import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { EquipmentMovementController } from './equipmentMovement.controller.js';
import { EquipmentMovementService } from './equipmentMovement.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [EquipmentMovementController],
  providers: [EquipmentMovementService],
  exports: [EquipmentMovementService],
})
export class EquipmentMovementModule { }
