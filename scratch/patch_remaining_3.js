const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../backend/src/inventory/inventory.service.ts');
let code = fs.readFileSync(filePath, 'utf8');

// 1. Replace createInventory body
const oldCreate = `      const inventory =
        await tx.inventory.create({
          data: {
            title: data.title,
            typeInventory: data.typeInventory,
            status: 'DRAFT',
            policyVersion,
            creatorId: creatorId || null,
            equipmentScopeIds:
              equipmentIds.length
                ? JSON.stringify(equipmentIds)
                : null,
            shelfScopeIds:
              shelfIds.length
                ? JSON.stringify(shelfIds)
                : null,
            thirdCountRequired: false,
            finalResultSource: null,
          },
        });

      const userMap = new Map(
        userRecords.map((user) => [
          user.userId,
          user,
        ]),
      );

      const participants = users.map(
        (item, index) => {
          const responsibility =
            index === 0
              ? 'PRIMARY_COUNTER_1'
              : index === 1
                ? 'PRIMARY_COUNTER_2'
                : 'FINAL_CONTROLLER';

          const user = userMap.get(item.userId);

          return {
            inventoryId: inventory.inventoryId,
            userId: item.userId,
            sequence: index,
            responsibility:
              policyVersion >= 2
                ? responsibility
                : item.responsibility ??
                  responsibility,
            roleSnapshot:
              user?.role?.roleName ??
              'USER',
          };
        },
      );

      await tx.inventory_User.createMany({
        data: participants,
      });

      return inventory;`;

const newCreate = `      const inventory = await tx.inventory.create({
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

      return inventory;`;

const normOldCreate = oldCreate.replace(/\r\n/g, '\n');
const normCode = code.replace(/\r\n/g, '\n');

if (normCode.includes(normOldCreate)) {
  code = normCode.replace(normOldCreate, newCreate);
  console.log('Successfully replaced createInventory');
} else {
  console.error('Failed to find createInventory target chunk!');
}

// 2. Replace getInventoryProgress
const progressRegex = /async getInventoryProgress\([\s\S]*?\n\s*workUnits:\s*\n\s*inventory\.workUnits\.map\([\s\S]*?\n\s*\),\s*\n\s*\};\s*\n\s*\}/;

const newProgress = `async getInventoryProgress(
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
  }`;

if (progressRegex.test(code)) {
  code = code.replace(progressRegex, newProgress);
  console.log('Successfully replaced getInventoryProgress');
} else {
  console.error('Failed to match getInventoryProgress regex!');
}

// 3. Replace deleteInventory
const deleteRegex = /async deleteInventory\([\s\S]*?\n\s*return tx\.inventory\.delete\([\s\S]*?\n\s*\};\s*\n\s*\}\);?\s*\n\s*\}/;

const newDelete = `async deleteInventory(
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

if (deleteRegex.test(code)) {
  code = code.replace(deleteRegex, newDelete);
  console.log('Successfully replaced deleteInventory');
} else {
  console.error('Failed to match deleteInventory regex!');
}

fs.writeFileSync(filePath, code, 'utf8');
console.log('Done writing remaining 3 patches!');
