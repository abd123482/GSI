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
}
