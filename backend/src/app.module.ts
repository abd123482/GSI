import { Module } from '@nestjs/common';

import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

import { EquipmentModule } from './equipment/equipment.module.js';
import { SerialNumberModule } from './serial-numbers/serialNumber.module.js';
import { EquipmentMovementModule } from './movements/equipmentMovement.module.js';
import { ShelfModule } from './shelves/shelves.module.js';
import { AuthModule } from './auth/auth.module.js';

@Module({
  imports: [
    AuthModule,
    EquipmentModule,
    SerialNumberModule,
    EquipmentMovementModule,
    ShelfModule,
  ],

  controllers: [
    AppController,
  ],

  providers: [
    AppService,
  ],
})
export class AppModule { }