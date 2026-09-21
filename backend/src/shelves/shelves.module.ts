import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module.js';

import { ShelfController } from './shelves.controller.js';
import { ShelfService } from './shelves.service.js';

@Module({
    imports: [PrismaModule],
    controllers: [ShelfController],
    providers: [ShelfService],
    exports: [ShelfService],
})
export class ShelfModule { }
