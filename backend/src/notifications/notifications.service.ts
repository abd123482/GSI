import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getMyNotifications(userId: string) {
    const notifications = await this.prisma.notification.findMany({
      where: { recipientId: userId },
      orderBy: { createdAt: 'desc' },
      take: 25,
    });

    return notifications.map((n) => {
      let parsedPayload: any = {};
      if (n.payload) {
        try {
          parsedPayload = JSON.parse(n.payload);
        } catch {
          parsedPayload = { message: n.payload };
        }
      }
      return {
        ...n,
        payload: parsedPayload,
      };
    });
  }

  async getUnreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: {
        recipientId: userId,
        readAt: null,
      },
    });
    return { count };
  }

  async markAsRead(notificationId: string, userId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { notificationId },
    });
    if (!notification || notification.recipientId !== userId) {
      throw new NotFoundException('Notification not found');
    }

    return this.prisma.notification.update({
      where: { notificationId },
      data: { readAt: new Date() },
    });
  }

  async markAllAsRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: {
        recipientId: userId,
        readAt: null,
      },
      data: { readAt: new Date() },
    });
    return { success: true };
  }

  async createNotification(recipientId: string, eventType: string, payload: any) {
    return this.prisma.notification.create({
      data: {
        recipientId,
        eventType,
        payload: typeof payload === 'string' ? payload : JSON.stringify(payload),
      },
    });
  }

  async checkAndSendLowStockAlerts(equipmentIds: string[]) {
    if (!equipmentIds || equipmentIds.length === 0) return;

    // Filter unique IDs
    const uniqueIds = Array.from(new Set(equipmentIds));

    const equipments = await this.prisma.equipment.findMany({
      where: {
        equipmentId: { in: uniqueIds },
      },
    });

    const lowStockEquipments = equipments.filter(
      (eq) => eq.equipmentQuantity <= eq.minequipmentQuantity
    );

    if (lowStockEquipments.length === 0) return;

    // Find all active users with 'equipment.update' permission (admins/managers)
    const admins = await this.prisma.user.findMany({
      where: {
        userStatus: 'ACTIVE',
        role: {
          permissions: {
            some: {
              permissionName: 'equipment.update',
            },
          },
        },
      },
    });

    if (admins.length === 0) return;

    // Dispatch notifications for each equipment to each admin
    const notificationPromises = [];
    for (const eq of lowStockEquipments) {
      for (const admin of admins) {
        notificationPromises.push(
          this.createNotification(admin.userId, 'LOW_STOCK_ALERT', {
            message: `Alerte Stock: L'article "${eq.equipmentName}" est tombé à ${eq.equipmentQuantity} (Min: ${eq.minequipmentQuantity})`,
            equipmentId: eq.equipmentId,
            equipmentName: eq.equipmentName,
            quantity: eq.equipmentQuantity,
            minQuantity: eq.minequipmentQuantity,
          })
        );
      }
    }

    await Promise.all(notificationPromises);
  }
}
