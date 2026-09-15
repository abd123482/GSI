import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateOrderDTO } from './dto/createOrder.dto.js';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async createOrder(dto: CreateOrderDTO) {
    return await this.prisma.order.create({
      data: {
        inventoryId: dto.inventoryId ?? null,
        serialNumberId: dto.serialNumberId ?? null,
        equipmentId: dto.equipmentId ?? null,
        shelfId: dto.shelfId ?? null,
        roleId: dto.roleId ?? null,
        userId: dto.userId ?? null,
        quantityCalculated: dto.quantityCalculated ?? null,
      },
      include: {
        inventory: true,
        serialNumber: true,
        equipment: true,
        shelf: true,
        role: true,
        user: true,
      },
    });
  }

  async getAllOrders() {
    return await this.prisma.order.findMany({
      include: {
        inventory: true,
        serialNumber: true,
        equipment: true,
        shelf: true,
        role: true,
        user: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOrderById(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { orderId },
      include: {
        inventory: true,
        serialNumber: true,
        equipment: true,
        shelf: true,
        role: true,
        user: true,
      },
    });
    if (!order) {
      throw new NotFoundException(`Order with ID '${orderId}' not found`);
    }
    return order;
  }
}
