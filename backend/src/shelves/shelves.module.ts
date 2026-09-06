import { Module } from '@nestjs/common';
import { ShelfService } from './shelves.service.js';
import { ShelfController } from './shelves.controller.js';

@Module({
    controllers: [ShelfController],
    providers: [ShelfService],

})
export class ShelfModule { }