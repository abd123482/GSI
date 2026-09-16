import { Module } from '@nestjs/common';

import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

import { EquipmentModule } from './equipment/equipment.module.js';
import { SerialNumberModule } from './serial-numbers/serialNumber.module.js';
import { EquipmentMovementModule } from './movements/equipmentMovement.module.js';
import { ShelfModule } from './shelves/shelves.module.js';
import { StockModule } from './stock/stock.module.js';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { OrdersModule } from './orders/orders.module.js';
import { InventoryModule } from './inventory/inventory.module.js';

@Module({
  imports: [
    AuthModule,
    UsersModule,
    EquipmentModule,
    SerialNumberModule,
    EquipmentMovementModule,
    ShelfModule,
    StockModule,
    OrdersModule,
    InventoryModule,
  ],

  controllers: [
    AppController,
  ],

  providers: [
    AppService,
  ],
})
export class AppModule { }