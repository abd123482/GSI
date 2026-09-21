import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module.js';

import { SerialNumberController } from './serialNumber.controller.js';
import { SerialNumberService } from './serialNumber.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [SerialNumberController],
  providers: [SerialNumberService],
  exports: [SerialNumberService],
})
export class SerialNumberModule { }
