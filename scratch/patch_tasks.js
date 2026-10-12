const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../backend/src/inventory/inventory.service.ts');
let code = fs.readFileSync(filePath, 'utf8');

const oldRegex = /async getMyTasks\([\s\S]*?\n\s*return \{\s*\n\s*success: true,\s*\n\s*attemptId,\s*\n\s*unitOrder,\s*\n\s*\};\s*\n\s*\},[\s\S]*?\n\s*\);?\s*\n\s*\}/;

const newTasks = `async getMyTasks(
    userId: string,
  ) {
    const counts = await this.prisma.inventoryCount.findMany({
      where: {
        inventoryController: {
          userId,
        },
        submittedAt: null,
        unit: {
          inventory: {
            status: 'IN_PROGRESS',
          },
        },
      },
      include: {
        inventoryController: {
          include: {
            user: true,
          },
        },
        unit: {
          include: {
            equipment: true,
            shelf: true,
            inventory: {
              select: {
                inventoryId: true,
                title: true,
                typeInventory: true,
                status: true,
                policyVersion: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return counts.map((count, index) => ({
      attemptId: count.countId,
      unitId: count.unitId,
      assignedUserId: count.inventoryController.userId,
      sequence: (count.inventoryController.round ?? 1) - 1,
      purpose:
        count.inventoryController.round === 1
          ? 'PRIMARY_1'
          : count.inventoryController.round === 2
            ? 'PRIMARY_2'
            : 'FINAL_RECOUNT',
      status: count.submittedAt ? 'SUBMITTED' : 'AVAILABLE',
      submittedAt: count.submittedAt,
      draftData: count.resultData,
      assignedUser: count.inventoryController.user,
      unit: {
        ...count.unit,
        unitOrder: index,
      },
    }));
  }

  async getTask(
    attemptId: string,
    currentUserId?: string,
  ) {
    const count = await this.prisma.inventoryCount.findUnique({
      where: { countId: attemptId },
      include: {
        inventoryController: {
          include: {
            user: true,
            inventory: {
              include: {
                controllers: {
                  include: {
                    user: {
                      select: {
                        userId: true,
                        userName: true,
                        userEmail: true,
                      },
                    },
                  },
                  orderBy: { round: 'asc' },
                },
              },
            },
          },
        },
        unit: {
          include: {
            inventory: true,
            equipment: true,
            shelf: true,
          },
        },
      },
    });

    if (!count) {
      throw new NotFoundException('Tâche introuvable');
    }

    if (currentUserId && count.inventoryController.userId !== currentUserId) {
      throw new ForbiddenException(
        "Vous n'êtes pas le contrôleur assigné à cette tâche.",
      );
    }

    const unit = count.unit;
    let scopeLabel = 'Unité de travail';
    let isSerialized = false;
    let expectedShelves: any[] = [];

    if (unit.equipment) {
      scopeLabel = unit.equipment.equipmentName ?? 'Article';
      isSerialized = Boolean(unit.equipment.hasSerialNumber);
    } else if (unit.shelf) {
      scopeLabel = unit.shelf.shelfName ?? 'Emplacement';
    }

    let parsedOrders: any[] = [];
    if (count.resultData) {
      try {
        const parsed = JSON.parse(count.resultData);
        if (Array.isArray(parsed?.orders)) parsedOrders = parsed.orders;
        else if (Array.isArray(parsed)) parsedOrders = parsed;
      } catch (_) {}
    }

    return {
      attemptId: count.countId,
      unitId: count.unitId,
      assignedUserId: count.inventoryController.userId,
      sequence: (count.inventoryController.round ?? 1) - 1,
      purpose:
        count.inventoryController.round === 1
          ? 'PRIMARY_1'
          : count.inventoryController.round === 2
            ? 'PRIMARY_2'
            : 'FINAL_RECOUNT',
      status: count.submittedAt ? 'SUBMITTED' : 'AVAILABLE',
      submittedAt: count.submittedAt,
      draftData: count.resultData,
      assignedUser: count.inventoryController.user,
      unit: {
        ...unit,
        unitOrder: 0,
      },
      orders: parsedOrders,
      scopeLabel,
      isSerialized,
      expectedShelves,
    };
  }

  async saveDraft(
    attemptId: string,
    userId: string,
    dto: SaveDraftDTO,
  ) {
    const data = saveDraftSchema.parse(dto);

    const count = await this.prisma.inventoryCount.findUnique({
      where: { countId: attemptId },
      include: { inventoryController: true },
    });

    if (!count) {
      throw new NotFoundException('Tâche introuvable');
    }

    if (count.inventoryController.userId !== userId) {
      throw new ForbiddenException(
        "Vous n'êtes pas le contrôleur assigné à cette tâche.",
      );
    }

    if (count.submittedAt) {
      throw new BadRequestException('Cette tâche a déjà été soumise.');
    }

    await this.prisma.inventoryCount.update({
      where: { countId: attemptId },
      data: {
        resultData: JSON.stringify(data),
      },
    });

    return {
      success: true,
      message: 'Brouillon enregistré avec succès.',
    };
  }

  async submitCountAttempt(
    attemptId: string,
    userId: string,
    dto: SubmitTaskDTO,
  ) {
    const data = submitTaskSchema.parse(dto);

    if (data.isDraft) {
      return this.saveDraft(attemptId, userId, data);
    }

    return this.prisma.$transaction(async (tx) => {
      const count = await tx.inventoryCount.findUnique({
        where: { countId: attemptId },
        include: {
          inventoryController: true,
          unit: {
            include: {
              inventory: true,
            },
          },
        },
      });

      if (!count) {
        throw new NotFoundException('Tâche introuvable');
      }

      if (count.inventoryController.userId !== userId) {
        throw new ForbiddenException(
          "Vous n'êtes pas le contrôleur assigné à cette tâche.",
        );
      }

      if (count.submittedAt) {
        throw new BadRequestException('Cette tâche a déjà été soumise.');
      }

      await tx.inventoryCount.update({
        where: { countId: attemptId },
        data: {
          submittedAt: new Date(),
          resultData: JSON.stringify(data),
        },
      });

      const otherCounts = await tx.inventoryCount.findMany({
        where: { unitId: count.unitId },
        include: { inventoryController: true },
      });

      const c1 = otherCounts.find((c) => c.inventoryController.round === 1);
      const c2 = otherCounts.find((c) => c.inventoryController.round === 2);

      if (c1?.submittedAt && c2?.submittedAt) {
        await tx.inventoryUnit.update({
          where: { unitId: count.unitId },
          data: {
            status: 'COMPLETED',
            reconciliationStatus: 'PRIMARY_MATCH',
            acceptedCountId: count.countId,
            reconciledAt: new Date(),
          },
        });
      }

      return {
        success: true,
        message: 'Comptage soumis avec succès.',
      };
    });
  }`;

if (oldRegex.test(code)) {
  code = code.replace(oldRegex, newTasks);
  fs.writeFileSync(filePath, code, 'utf8');
  console.log('Successfully updated getMyTasks, getTask, saveDraft, and submitCountAttempt!');
} else {
  console.error('Failed to match oldRegex for tasks!');
}
