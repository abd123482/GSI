const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../backend/src/inventory/inventory.service.ts');
let code = fs.readFileSync(filePath, 'utf8');

// 1. Patch createInventory
const oldCreateRegex = /\/\/ --------------------------------------------------------------------------\s*\n\s*async createInventory\([\s\S]*?\n\s*\/\/ --------------------------------------------------------------------------\s*\n\s*\/\/ Shared movement/;

const newCreateContent = `// --------------------------------------------------------------------------
  async createInventory(
    dto: CreateInventoryDTO,
    creatorId: string,
  ) {
    const data = createInventorySchema.parse(dto);
    const policyVersion = data.policyVersion ?? 3;
    const users = data.users;

    if (policyVersion >= 2 && users.length !== 3) {
      throw new BadRequestException(
        "L'inventaire courant requiert exactement trois contrôleurs distincts.",
      );
    }

    const equipmentIds = [
      ...new Set((data.equipmentIds ?? []).map((id) => id.trim())),
    ];

    const shelfIds = [
      ...new Set((data.shelfIds ?? []).map((id) => id.trim())),
    ];

    return this.prisma.$transaction(async (tx) => {
      const userRecords = await tx.user.findMany({
        where: {
          userId: {
            in: users.map((item) => item.userId),
          },
        },
        include: {
          role: true,
        },
      });

      if (userRecords.length !== users.length) {
        const found = new Set(userRecords.map((user) => user.userId));
        const missing = users
          .map((item) => item.userId)
          .filter((id) => !found.has(id));

        throw new NotFoundException(
          \`Utilisateur(s) introuvable(s): \${missing.join(', ')}\`,
        );
      }

      if (data.typeInventory === 'ByEquipment') {
        const equipmentCount = await tx.equipment.count({
          where: {
            equipmentId: {
              in: equipmentIds,
            },
          },
        });

        if (equipmentCount !== equipmentIds.length) {
          throw new NotFoundException(
            'Un ou plusieurs articles du périmètre sont introuvables.',
          );
        }
      }

      if (data.typeInventory === 'ByShelf') {
        const shelfCount = await tx.shelf.count({
          where: {
            shelfId: {
              in: shelfIds,
            },
          },
        });

        if (shelfCount !== shelfIds.length) {
          throw new NotFoundException(
            'Un ou plusieurs emplacements du périmètre sont introuvables.',
          );
        }
      }

      const inventory = await tx.inventory.create({
        data: {
          title: data.title,
          typeInventory: data.typeInventory,
          status: 'DRAFT',
          policyVersion,
          creatorId: creatorId || null,
        },
      });

      await tx.inventoryController.createMany({
        data: users.map((item, index) => ({
          inventoryId: inventory.inventoryId,
          userId: item.userId,
          round: index + 1,
        })),
      });

      if (data.typeInventory === 'ByEquipment' && equipmentIds.length > 0) {
        await tx.inventoryUnit.createMany({
          data: equipmentIds.map((equipmentId) => ({
            inventoryId: inventory.inventoryId,
            equipmentId,
            shelfId: null,
            status: 'DRAFT',
            reconciliationStatus: 'PENDING',
          })),
        });
      } else if (data.typeInventory === 'ByShelf' && shelfIds.length > 0) {
        await tx.inventoryUnit.createMany({
          data: shelfIds.map((shelfId) => ({
            inventoryId: inventory.inventoryId,
            equipmentId: null,
            shelfId,
            status: 'DRAFT',
            reconciliationStatus: 'PENDING',
          })),
        });
      }

      return inventory;
    });
  }

  // --------------------------------------------------------------------------
  // Shared movement`;

if (oldCreateRegex.test(code)) {
  code = code.replace(oldCreateRegex, newCreateContent);
  console.log('Successfully replaced createInventory');
} else {
  console.error('Failed to match createInventory regex!');
}

// 2. Patch getInventoryById
const oldGetByIdRegex = /async getInventoryById\([\s\S]*?\n\s*return inventory;\s*\n\s*\}/;

const newGetByIdContent = `async getInventoryById(
    inventoryId: string,
  ) {
    const inventory = await this.prisma.inventory.findUnique({
      where: { inventoryId },
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
        units: {
          include: {
            acceptedCount: {
              select: {
                countId: true,
                submittedAt: true,
                createdAt: true,
              },
            },
            counts: {
              include: {
                inventoryController: {
                  include: {
                    user: {
                      select: {
                        userId: true,
                        userName: true,
                        userEmail: true,
                      },
                    },
                  },
                },
              },
              orderBy: { createdAt: 'asc' },
            },
            equipment: true,
            shelf: true,
          },
        },
        issues: {
          include: {
            resolvedByUser: {
              select: {
                userId: true,
                userName: true,
              },
            },
          },
        },
      },
    });

    if (!inventory) {
      throw new NotFoundException(
        'Inventaire introuvable',
      );
    }

    return {
      ...inventory,
      Inventory_User: inventory.controllers?.map((c: any) => ({
        inventoryId: inventory.inventoryId,
        userId: c.userId,
        sequence: c.round - 1,
        responsibility:
          c.round === 1
            ? 'PRIMARY_COUNTER_1'
            : c.round === 2
              ? 'PRIMARY_COUNTER_2'
              : 'FINAL_CONTROLLER',
        User: c.user,
      })),
      workUnits: inventory.units?.map((u: any, index: number) => ({
        unitId: u.unitId,
        inventoryId: u.inventoryId,
        unitOrder: index,
        status: u.status,
        equipmentId: u.equipmentId,
        shelfId: u.shelfId,
        reconciliationStatus: u.reconciliationStatus,
        acceptedAttemptId: u.acceptedCountId,
        reconciledAt: u.reconciledAt,
        equipment: u.equipment,
        shelf: u.shelf,
        attempts: u.counts?.map((cnt: any) => ({
          attemptId: cnt.countId,
          unitId: cnt.unitId,
          assignedUserId: cnt.inventoryController?.userId,
          sequence: (cnt.inventoryController?.round ?? 1) - 1,
          purpose:
            cnt.inventoryController?.round === 1
              ? 'PRIMARY_1'
              : cnt.inventoryController?.round === 2
                ? 'PRIMARY_2'
                : 'FINAL_RECOUNT',
          status: cnt.submittedAt ? 'SUBMITTED' : 'IN_PROGRESS',
          submittedAt: cnt.submittedAt,
          draftData: cnt.resultData,
          assignedUser: cnt.inventoryController?.user,
        })),
        acceptedAttempt: u.acceptedCount
          ? {
              attemptId: u.acceptedCount.countId,
              unitId: u.unitId,
              submittedAt: u.acceptedCount.submittedAt,
            }
          : null,
      })),
      investigationIssues: inventory.issues ?? [],
    };
  }`;

if (oldGetByIdRegex.test(code)) {
  code = code.replace(oldGetByIdRegex, newGetByIdContent);
  console.log('Successfully replaced getInventoryById');
} else {
  console.error('Failed to match getInventoryById regex!');
}

// 3. Patch getInventoryProgress
const oldProgressRegex = /async getInventoryProgress\([\s\S]*?\n\s*\/\/ --------------------------------------------------------------------------\s*\n\s*async getInventoryComparison/;

const newProgressContent = `async getInventoryProgress(
    inventoryId: string,
  ) {
    const inventory = await this.prisma.inventory.findUnique({
      where: { inventoryId },
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
        units: {
          include: {
            counts: {
              include: {
                inventoryController: {
                  include: {
                    user: {
                      select: {
                        userId: true,
                        userName: true,
                      },
                    },
                  },
                },
              },
              orderBy: { createdAt: 'asc' },
            },
          },
        },
      },
    });

    if (!inventory) {
      throw new NotFoundException('Inventaire introuvable');
    }

    const controllers = inventory.controllers ?? [];
    const units = inventory.units ?? [];
    const totalUnits = units.length;

    const c1Completed = units.filter((unit: any) =>
      unit.counts?.some(
        (cnt: any) => cnt.inventoryController?.round === 1 && cnt.submittedAt,
      ),
    ).length;

    const c2Completed = units.filter((unit: any) =>
      unit.counts?.some(
        (cnt: any) => cnt.inventoryController?.round === 2 && cnt.submittedAt,
      ),
    ).length;

    const c3Required = units.filter((unit: any) =>
      ['THIRD_REQUIRED', 'THIRD_RESOLVED'].includes(unit.reconciliationStatus),
    ).length;

    const c3Completed = units.filter((unit: any) =>
      unit.counts?.some(
        (cnt: any) => cnt.inventoryController?.round === 3 && cnt.submittedAt,
      ),
    ).length;

    const reconciledUnits = units.filter((unit: any) =>
      ['PRIMARY_MATCH', 'THIRD_RESOLVED'].includes(unit.reconciliationStatus),
    ).length;

    const c1 = controllers.find((c: any) => c.round === 1);
    const c2 = controllers.find((c: any) => c.round === 2);
    const c3 = controllers.find((c: any) => c.round === 3);

    return {
      inventoryId: inventory.inventoryId,
      title: inventory.title,
      typeInventory: inventory.typeInventory,
      status: inventory.status,
      policyVersion: inventory.policyVersion,
      totalUnits,
      reconciledUnits,
      controllers: {
        controller1: {
          user: c1?.user ?? null,
          responsibility: 'PRIMARY_COUNTER_1',
          completedUnits: c1Completed,
          totalUnits,
          isFinished: c1Completed === totalUnits && totalUnits > 0,
        },
        controller2: {
          user: c2?.user ?? null,
          responsibility: 'PRIMARY_COUNTER_2',
          completedUnits: c2Completed,
          totalUnits,
          isFinished: c2Completed === totalUnits && totalUnits > 0,
        },
        controller3: {
          user: c3?.user ?? null,
          responsibility: 'FINAL_CONTROLLER',
          requiredUnits: c3Required,
          completedUnits: c3Completed,
          isActive: c3Required > c3Completed,
          isFinished: c3Required > 0 && c3Completed === c3Required,
        },
      },
      workUnits: units.map((unit: any, index: number) => {
        const c1Count = unit.counts?.find((c: any) => c.inventoryController?.round === 1);
        const c2Count = unit.counts?.find((c: any) => c.inventoryController?.round === 2);
        const c3Count = unit.counts?.find((c: any) => c.inventoryController?.round === 3);

        return {
          unitId: unit.unitId,
          unitOrder: index,
          equipmentId: unit.equipmentId,
          shelfId: unit.shelfId,
          status: unit.status,
          reconciliationStatus: unit.reconciliationStatus,
          acceptedAttemptId: unit.acceptedCountId,
          reconciledAt: unit.reconciledAt,
          c1Status: c1Count?.submittedAt ? 'SUBMITTED' : (c1Count ? 'IN_PROGRESS' : (inventory.status === 'IN_PROGRESS' ? 'AVAILABLE' : 'BLOCKED')),
          c2Status: c2Count?.submittedAt ? 'SUBMITTED' : (c2Count ? 'IN_PROGRESS' : 'BLOCKED'),
          c3Status: c3Count?.submittedAt ? 'SUBMITTED' : (c3Count ? 'IN_PROGRESS' : 'NOT_REQUIRED'),
        };
      }),
    };
  }

  // --------------------------------------------------------------------------
  async getInventoryComparison`;

if (oldProgressRegex.test(code)) {
  code = code.replace(oldProgressRegex, newProgressContent);
  console.log('Successfully replaced getInventoryProgress');
} else {
  console.error('Failed to match getInventoryProgress regex!');
}

// 4. Patch loadInventoryForReporting
const oldReportingRegex = /private async loadInventoryForReporting\([\s\S]*?\n\s*return inventory;\s*\n\s*\}/;

const newReportingContent = `private async loadInventoryForReporting(
    inventoryId: string,
  ) {
    const inventory = await this.prisma.inventory.findUnique({
      where: { inventoryId },
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
        units: {
          include: {
            counts: {
              include: {
                inventoryController: {
                  include: {
                    user: {
                      select: {
                        userId: true,
                        userName: true,
                      },
                    },
                  },
                },
              },
              orderBy: { createdAt: 'asc' },
            },
            acceptedCount: true,
            equipment: true,
            shelf: true,
          },
        },
      },
    });

    if (!inventory) {
      throw new NotFoundException('Inventaire introuvable');
    }

    return {
      ...inventory,
      Inventory_User: (inventory.controllers ?? []).map((c: any) => ({
        inventoryId: inventory.inventoryId,
        userId: c.userId,
        sequence: c.round - 1,
        responsibility:
          c.round === 1
            ? 'PRIMARY_COUNTER_1'
            : c.round === 2
              ? 'PRIMARY_COUNTER_2'
              : 'FINAL_CONTROLLER',
        User: c.user,
      })),
      workUnits: (inventory.units ?? []).map((u: any, index: number) => {
        const counts = u.counts ?? [];
        return {
          unitId: u.unitId,
          inventoryId: u.inventoryId,
          unitOrder: index,
          status: u.status,
          equipmentId: u.equipmentId,
          shelfId: u.shelfId,
          reconciliationStatus: u.reconciliationStatus,
          acceptedAttemptId: u.acceptedCountId,
          reconciledAt: u.reconciledAt,
          equipment: u.equipment,
          shelf: u.shelf,
          attempts: counts.map((cnt: any) => {
            let parsedOrders: any[] = [];
            if (cnt.resultData) {
              try {
                const parsed = JSON.parse(cnt.resultData);
                if (Array.isArray(parsed)) parsedOrders = parsed;
              } catch (_) {}
            }
            return {
              attemptId: cnt.countId,
              unitId: cnt.unitId,
              assignedUserId: cnt.inventoryController?.userId,
              sequence: (cnt.inventoryController?.round ?? 1) - 1,
              purpose:
                cnt.inventoryController?.round === 1
                  ? 'PRIMARY_1'
                  : cnt.inventoryController?.round === 2
                    ? 'PRIMARY_2'
                    : 'FINAL_RECOUNT',
              status: cnt.submittedAt ? 'SUBMITTED' : 'IN_PROGRESS',
              submittedAt: cnt.submittedAt,
              draftData: cnt.resultData,
              assignedUser: cnt.inventoryController?.user,
              orders: parsedOrders,
            };
          }),
          acceptedAttempt: u.acceptedCount
            ? {
                attemptId: u.acceptedCount.countId,
                unitId: u.unitId,
                submittedAt: u.acceptedCount.submittedAt,
                orders: [],
              }
            : null,
        };
      }),
    };
  }`;

if (oldReportingRegex.test(code)) {
  code = code.replace(oldReportingRegex, newReportingContent);
  console.log('Successfully replaced loadInventoryForReporting');
} else {
  console.error('Failed to match loadInventoryForReporting regex!');
}

// 5. Patch getInventoryReport
const oldReportRegex = /async getInventoryReport\([\s\S]*?\n\s*return \{\s*\n\s*inventory: \{[\s\S]*?\n\s*adjustmentMovements:\s*\n\s*inventory\.adjustmentMovements,\s*\n\s*\};\s*\n\s*\}/;

const newReportContent = `async getInventoryReport(
    inventoryId: string,
  ) {
    const comparison = await this.getInventoryComparison(inventoryId);

    const inventory = await this.prisma.inventory.findUnique({
      where: { inventoryId },
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
        issues: {
          include: {
            resolvedByUser: {
              select: {
                userId: true,
                userName: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!inventory) {
      throw new NotFoundException('Inventaire introuvable');
    }

    return {
      inventory: {
        inventoryId: inventory.inventoryId,
        title: inventory.title,
        typeInventory: inventory.typeInventory,
        status: inventory.status,
        createdAt: inventory.createdAt,
        launchedAt: inventory.launchedAt,
        finalizedAt: inventory.finalizedAt,
        policyVersion: inventory.policyVersion,
      },
      controllers: (inventory.controllers ?? []).map((c: any) => ({
        sequence: c.round - 1,
        responsibility:
          c.round === 1
            ? 'PRIMARY_COUNTER_1'
            : c.round === 2
              ? 'PRIMARY_COUNTER_2'
              : 'FINAL_CONTROLLER',
        user: c.user,
      })),
      units: comparison.units,
      summary: comparison.summary,
      baselineLaunch: {
        quantities: [],
        serials: [],
      },
      physicalTruth: {
        quantities: [],
        serials: [],
      },
      investigationIssues: inventory.issues ?? [],
      adjustmentMovements: [],
    };
  }`;

if (oldReportRegex.test(code)) {
  code = code.replace(oldReportRegex, newReportContent);
  console.log('Successfully replaced getInventoryReport');
} else {
  console.error('Failed to match getInventoryReport regex!');
}

// 6. Patch deleteInventory
const oldDeleteRegex = /async deleteInventory\([\s\S]*?\n\s*return tx\.inventory\.delete\([\s\S]*?\n\s*\};\s*\n\s*\}\);?\s*\n\s*\}/;

const newDeleteContent = `async deleteInventory(
    inventoryId: string,
  ) {
    const existing = await this.prisma.inventory.findFirst({
      where: { inventoryId },
    });

    if (!existing) {
      throw new NotFoundException('Inventaire introuvable');
    }

    return this.prisma.$transaction(async (tx) => {
      const units = await tx.inventoryUnit.findMany({
        where: { inventoryId: existing.inventoryId },
        select: { unitId: true },
      });
      const unitIds = units.map((u) => u.unitId);

      if (unitIds.length > 0) {
        await tx.inventoryUnit.updateMany({
          where: { inventoryId: existing.inventoryId },
          data: { acceptedCountId: null },
        });

        await tx.inventoryIssue.deleteMany({
          where: { inventoryId: existing.inventoryId },
        });

        await tx.inventoryCount.deleteMany({
          where: { unitId: { in: unitIds } },
        });

        await tx.inventoryUnit.deleteMany({
          where: { inventoryId: existing.inventoryId },
        });
      }

      await tx.inventoryController.deleteMany({
        where: { inventoryId: existing.inventoryId },
      });

      return tx.inventory.delete({
        where: { inventoryId: existing.inventoryId },
      });
    });
  }`;

if (oldDeleteRegex.test(code)) {
  code = code.replace(oldDeleteRegex, newDeleteContent);
  console.log('Successfully replaced deleteInventory');
} else {
  console.error('Failed to match deleteInventory regex!');
}

// 7. Patch launchInventory
const oldLaunchRegex = /async launchInventory\([\s\S]*?\n\s*return \{\s*\n\s*success: true,\s*\n\s*inventoryId,\s*\n\s*totalUnits:\s*\n\s*workUnits\.length,\s*\n\s*\};\s*\n\s*\},[\s\S]*?\n\s*\);?\s*\n\s*\}/;

const newLaunchContent = `async launchInventory(
    inventoryId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const inventory = await tx.inventory.findUnique({
        where: { inventoryId },
        include: {
          controllers: {
            orderBy: { round: 'asc' },
          },
          units: true,
        },
      });

      if (!inventory) {
        throw new NotFoundException('Inventaire introuvable');
      }

      if (inventory.status !== 'DRAFT') {
        throw new BadRequestException(
          'Seul un inventaire au statut DRAFT peut être lancé.',
        );
      }

      const controllers = inventory.controllers ?? [];
      if (controllers.length !== 3) {
        throw new BadRequestException(
          'Trois contrôleurs distincts doivent être préassignés avant le lancement.',
        );
      }

      const units = inventory.units ?? [];
      if (units.length === 0) {
        throw new BadRequestException(
          "Le périmètre de l'inventaire est vide.",
        );
      }

      await tx.inventoryUnit.updateMany({
        where: { inventoryId },
        data: { status: 'COUNTING' },
      });

      const c1 = controllers.find((c: any) => c.round === 1)!;
      const c2 = controllers.find((c: any) => c.round === 2)!;

      for (const unit of units) {
        await tx.inventoryCount.create({
          data: {
            unitId: unit.unitId,
            inventoryControllerId: c1.inventoryControllerId,
          },
        });
        await tx.inventoryCount.create({
          data: {
            unitId: unit.unitId,
            inventoryControllerId: c2.inventoryControllerId,
          },
        });
      }

      await tx.inventory.update({
        where: { inventoryId },
        data: {
          status: 'IN_PROGRESS',
          launchedAt: new Date(),
        },
      });

      await tx.notification.create({
        data: {
          recipientId: c1.userId,
          eventType: 'INVENTORY_TASK_AVAILABLE',
          payload: JSON.stringify({
            inventoryId,
            title: inventory.title,
            message: 'La première unité de comptage est disponible.',
          }),
        },
      });

      return {
        success: true,
        inventoryId,
        totalUnits: units.length,
      };
    });
  }`;

if (oldLaunchRegex.test(code)) {
  code = code.replace(oldLaunchRegex, newLaunchContent);
  console.log('Successfully replaced launchInventory');
} else {
  console.error('Failed to match launchInventory regex!');
}

fs.writeFileSync(filePath, code, 'utf8');
console.log('Done writing patched inventory.service.ts');
