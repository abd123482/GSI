import { Module } from '@nestjs/common';
import { SerialNumberController } from './serialNumber.controller.js';
import { SerialNumberService } from './serialNumber.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [SerialNumberController],
  providers: [SerialNumberService],
  exports: [SerialNumberService],
})
export class SerialNumberModule {}
