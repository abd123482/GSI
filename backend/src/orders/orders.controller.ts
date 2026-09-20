import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard.js';
import { OrdersService } from './orders.service.js';
import type { CreateOrderDTO } from './dto/createOrder.dto.js';

@UseGuards(ClerkAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  async createOrder(@Body() dto: CreateOrderDTO) {
    if (dto.inventoryId) {
      throw new BadRequestException('Cannot associate inventory directly via generic order endpoint. Inventory observations must be submitted through authorized inventory count tasks.');
    }
    return this.ordersService.createOrder(dto);
  }

  @Get()
  async getAllOrders() {
    return this.ordersService.getAllOrders();
  }

  @Get(':id')
  async getOrderById(@Param('id', ParseUUIDPipe) id: string) {
    return this.ordersService.getOrderById(id);
  }
}
