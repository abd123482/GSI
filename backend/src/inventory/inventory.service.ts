import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';

import {
  type AdjudicateDTO,
  type AssignThirdUserDTO,
  type CreateInventoryDTO,
  createInventorySchema,
  type PaginationDTO,
  paginationSchema,
  type ResolveIssueDTO,
  resolveIssueSchema,
  type SaveDraftDTO,
  saveDraftSchema,
  type SubmitTaskDTO,
  submitTaskSchema,
  type UpdateRosterDTO,
  updateRosterSchema,
} from './dto/index.js';

import {
  calculateStockVariances,
  compareInventoryRound,
  compareUnitSubmissions,
  parseCountSubmission,
  type BaselineSerializedItem,
  type BaselineStandardItem,
  type ControllerInfo,
  type FrozenBaselineSnapshot,
  type NormalizedObservation,
  type ParsedSubmission,
  type RoundComparisonResult,
} from './inventory-engine.js';

type AttemptPurpose = 'PRIMARY_1' | 'PRIMARY_2' | 'FINAL_RECOUNT';

type UnitReconciliationStatus =
  | 'PENDING'
  | 'PRIMARY_MATCH'
  | 'THIRD_REQUIRED'
  | 'THIRD_RESOLVED'
  | 'CONVERGED'
  | 'RECOUNT_REQUIRED';

type ReportCell = {
  quantity: number;
  serialNumberCode: string | null;
  serialNumberId: string | null;
  equipmentId: string | null;
  equipmentName: string | null;
  shelfId: string | null;
  shelfName: string | null;
  isUnexpected: boolean;
  notes: string[];
};

async function buildFrozenBaselineSnapshot(
  tx: Prisma.TransactionClient,
  typeInventory: 'ByEquipment' | 'ByShelf',
  units: Array<{ equipmentId: string | null; shelfId: string | null }>,
): Promise<FrozenBaselineSnapshot> {
  const scopedEquipmentIds = units.map((u) => u.equipmentId).filter(Boolean) as string[];
  const scopedShelfIds = units.map((u) => u.shelfId).filter(Boolean) as string[];

  const standardMovements = await tx.$queryRaw<
    { equipmentId: string; shelfId: string; balance: number }[]
  >(Prisma.sql`
    SELECT 
      CAST(d.equipmentId AS varchar(36)) AS equipmentId,
      CAST(d.shelfId AS varchar(36)) AS shelfId,
      SUM(d.qty) AS balance
    FROM (
      SELECT m.equipmentId, m.destinationShelfId AS shelfId, CAST(m.equipmentQuantity AS bigint) AS qty
      FROM dbo.MovementEquipment m
      JOIN dbo.Equipment e ON e.equipmentId = m.equipmentId
      WHERE e.hasSerialNumber = 0 AND m.destinationShelfId IS NOT NULL

      UNION ALL

      SELECT m.equipmentId, m.sourceShelfId AS shelfId, -CAST(m.equipmentQuantity AS bigint) AS qty
      FROM dbo.MovementEquipment m
      JOIN dbo.Equipment e ON e.equipmentId = m.equipmentId
      WHERE e.hasSerialNumber = 0 AND m.sourceShelfId IS NOT NULL
    ) d
    GROUP BY d.equipmentId, d.shelfId
    HAVING SUM(d.qty) <> 0
  `);

  const serialMovements = await tx.$queryRaw<
    { serialNumberId: string; equipmentId: string; shelfId: string; balance: number }[]
  >(Prisma.sql`
    SELECT 
      CAST(d.serialNumberId AS varchar(36)) AS serialNumberId,
      CAST(d.equipmentId AS varchar(36)) AS equipmentId,
      CAST(d.shelfId AS varchar(36)) AS shelfId,
      SUM(d.qty) AS balance
    FROM (
      SELECT m.serialNumberId, m.equipmentId, m.destinationShelfId AS shelfId, CAST(m.equipmentQuantity AS bigint) AS qty
      FROM dbo.MovementEquipment m
      WHERE m.serialNumberId IS NOT NULL AND m.destinationShelfId IS NOT NULL

      UNION ALL

      SELECT m.serialNumberId, m.equipmentId, m.sourceShelfId AS shelfId, -CAST(m.equipmentQuantity AS bigint) AS qty
      FROM dbo.MovementEquipment m
      WHERE m.serialNumberId IS NOT NULL AND m.sourceShelfId IS NOT NULL
    ) d
    GROUP BY d.serialNumberId, d.equipmentId, d.shelfId
    HAVING SUM(d.qty) > 0
  `);

  const scopedEqSet = new Set(scopedEquipmentIds.map((id) => id.toLowerCase()));
  const scopedShSet = new Set(scopedShelfIds.map((id) => id.toLowerCase()));

  const inScope = (eqId?: string | null, shId?: string | null) => {
    const eq = (eqId ?? '').toLowerCase();
    const sh = (shId ?? '').toLowerCase();
    if (typeInventory === 'ByEquipment') return Boolean(eq && scopedEqSet.has(eq));
    if (typeInventory === 'ByShelf') return Boolean(sh && scopedShSet.has(sh));
    return Boolean((eq && scopedEqSet.has(eq)) || (sh && scopedShSet.has(sh)));
  };

  const standardItems: BaselineStandardItem[] = [];
  for (const row of standardMovements) {
    if (inScope(row.equipmentId, row.shelfId)) {
      standardItems.push({
        equipmentId: row.equipmentId.toLowerCase(),
        shelfId: row.shelfId.toLowerCase(),
        expectedQuantity: Number(row.balance),
      });
    }
  }

  const allSerials = await tx.serialNumber.findMany({
    select: { serialNumberId: true, serialNumberCode: true, equipmentId: true },
  });
  const serialById = new Map(allSerials.map((s) => [s.serialNumberId.toLowerCase(), s]));

  const serializedItems: BaselineSerializedItem[] = [];
  for (const row of serialMovements) {
    if (!row.serialNumberId) continue;
    const s = serialById.get(row.serialNumberId.toLowerCase());
    if (!s) continue;
    if (inScope(row.equipmentId, row.shelfId)) {
      serializedItems.push({
        serialNumberId: row.serialNumberId.toLowerCase(),
        serialNumberCode: s.serialNumberCode.trim(),
        equipmentId: row.equipmentId.toLowerCase(),
        expectedShelfId: row.shelfId.toLowerCase(),
      });
    }
  }

  return {
    version: 1,
    frozenAt: new Date().toISOString(),
    typeInventory,
    scope: {
      equipmentIds: scopedEquipmentIds,
      shelfIds: scopedShelfIds,
    },
    standardItems,
    serializedItems,
  };
}

function extractObservations(resultData: string | null | undefined): any[] {
  if (!resultData) return [];
  try {
    const parsed = JSON.parse(resultData);
    if (Array.isArray(parsed?.observations)) return parsed.observations;
    if (Array.isArray(parsed?.orders)) return parsed.orders;
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch {
    return [];
  }
}

function buildObservationMap(observations: any[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const obs of observations) {
    const serial = (
      obs.scannedSerialCode ||
      obs.serialNumberCode ||
      obs.serialNumber?.serialNumberCode ||
      ''
    )
      .toString()
      .trim()
      .toLowerCase();

    const equipmentId = (
      obs.observedEquipmentId ||
      obs.equipmentId ||
      ''
    )
      .toString()
      .trim()
      .toLowerCase();

    const shelfId = (
      obs.observedShelfId ||
      obs.shelfId ||
      ''
    )
      .toString()
      .trim()
      .toLowerCase();

    if (serial) {
      const key = `SER|${serial}|${shelfId}`;
      map.set(key, (map.get(key) ?? 0) + 1);
    } else if (equipmentId || shelfId) {
      const key = `STD|${equipmentId}|${shelfId}`;
      const qty = Number(obs.quantityCalculated ?? obs.equipmentQuantity ?? 0);
      map.set(key, (map.get(key) ?? 0) + qty);
    }
  }
  return map;
}

function areCountsIdentical(
  resultData1: string | null | undefined,
  resultData2: string | null | undefined,
): boolean {
  const obs1 = extractObservations(resultData1);
  const obs2 = extractObservations(resultData2);

  const map1 = buildObservationMap(obs1);
  const map2 = buildObservationMap(obs2);

  if (map1.size !== map2.size) {
    return false;
  }

  for (const [key, qty1] of map1.entries()) {
    const qty2 = map2.get(key);
    if (qty2 !== qty1) {
      return false;
    }
  }

  return true;
}

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // --------------------------------------------------------------------------
  // Basic CRUD
  // --------------------------------------------------------------------------

  async getInventories(
    pagination: PaginationDTO,
    filterUserId?: string,
  ) {
    const { page, limit } = paginationSchema.parse(pagination ?? {});
    const skip = (page - 1) * limit;

    const where: Prisma.InventoryWhereInput = filterUserId
      ? {
          controllers: {
            some: {
              userId: filterUserId,
            },
          },
        }
      : {};

    const [inventories, totalInventories] = await Promise.all([
      this.prisma.inventory.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ createdAt: 'desc' }, { inventoryId: 'desc' }],
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
            select: {
              unitId: true,
              status: true,
              equipmentId: true,
              shelfId: true,
              reconciliationStatus: true,
              acceptedCountId: true,
              reconciledAt: true,
            },
          },
          _count: {
            select: {
              issues: true,
            },
          },
        },
      }),
      this.prisma.inventory.count({ where }),
    ]);

    return {
      inventories: inventories.map((inv) => ({
        ...inv,
        Inventory_User: inv.controllers?.map((c) => ({
          inventoryId: inv.inventoryId,
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
        workUnits: inv.units,
        _count: {
          investigationIssues: inv._count?.issues ?? 0,
        },
      })),
      totalInventories,
      totalPages: Math.ceil(totalInventories / limit) || 1,
      currentPage: page,
      limit,
    };
  }

  async getInventoryById(inventoryId: string) {
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
      throw new NotFoundException('Inventaire introuvable');
    }

    return {
      ...inventory,
      Inventory_User: inventory.controllers?.map((c) => ({
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
      workUnits: inventory.units?.map((u, index) => ({
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
        attempts: u.counts?.map((cnt) => ({
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
  }

  async createInventory(
    dto: CreateInventoryDTO,
    creatorId: string,
  ) {
    const data = createInventorySchema.parse(dto);
    const users = data.users;

    if (users.length < 3) {
      throw new BadRequestException(
        "L'inventaire requiert au moins trois contrôleurs distincts.",
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
          userStatus: 'ACTIVE',
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
          `Utilisateur(s) introuvable(s) ou inactif(s): ${missing.join(', ')}`,
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
          policyVersion: 4,
          creatorId: creatorId || null,
          roundNumber: 1,
          version: 1,
        },
      });

      await tx.inventory.update({
        where: { inventoryId: inventory.inventoryId },
        data: { rootInventoryId: inventory.inventoryId },
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
          data: equipmentIds.map((equipmentId, index) => ({
            inventoryId: inventory.inventoryId,
            equipmentId,
            shelfId: null,
            unitOrder: index,
            status: 'DRAFT',
            reconciliationStatus: 'PENDING',
          })),
        });
      } else if (data.typeInventory === 'ByShelf' && shelfIds.length > 0) {
        await tx.inventoryUnit.createMany({
          data: shelfIds.map((shelfId, index) => ({
            inventoryId: inventory.inventoryId,
            equipmentId: null,
            shelfId,
            unitOrder: index,
            status: 'DRAFT',
            reconciliationStatus: 'PENDING',
          })),
        });
      }

      return inventory;
    });
  }

  // --------------------------------------------------------------------------
  // Update Draft Roster
  // --------------------------------------------------------------------------

  async updateDraftRoster(inventoryId: string, dto: UpdateRosterDTO) {
    const data = updateRosterSchema.parse(dto);
    return this.prisma.$transaction(async (tx) => {
      const inventory = await tx.inventory.findUnique({
        where: { inventoryId },
        select: { inventoryId: true, status: true },
      });

      if (!inventory) {
        throw new NotFoundException('Inventaire introuvable');
      }

      if (inventory.status !== 'DRAFT') {
        throw new BadRequestException(
          'Seul un inventaire en statut DRAFT permet de modifier les contrôleurs.',
        );
      }

      const users = await tx.user.findMany({
        where: {
          userId: { in: data.users.map((u) => u.userId) },
          userStatus: 'ACTIVE',
        },
        select: { userId: true },
      });

      if (users.length !== data.users.length) {
        throw new BadRequestException('Un ou plusieurs utilisateurs sont invalides ou inactifs.');
      }

      await tx.inventoryController.deleteMany({
        where: { inventoryId },
      });

      await tx.inventoryController.createMany({
        data: data.users.map((item, index) => ({
          inventoryId,
          userId: item.userId,
          round: index + 1,
        })),
      });

      return {
        success: true,
        message: 'Contrôleurs mis à jour avec succès.',
      };
    });
  }

  // --------------------------------------------------------------------------
  // Launch inventory
  // --------------------------------------------------------------------------

  async launchInventory(inventoryId: string) {
    const launchResult = await this.prisma.$transaction(async (tx) => {
      const inventory = await tx.inventory.findUnique({
        where: { inventoryId },
        include: {
          controllers: {
            orderBy: { round: 'asc' },
          },
          units: {
            orderBy: { unitOrder: 'asc' },
          },
          rootInventory: true,
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
      if (controllers.length < 3) {
        throw new BadRequestException(
          'Au moins trois contrôleurs distincts doivent être préassignés avant le lancement.',
        );
      }

      const units = inventory.units ?? [];
      if (units.length === 0) {
        throw new BadRequestException("Le périmètre de l'inventaire est vide.");
      }

      const targetRootId = inventory.rootInventoryId ?? inventoryId;

      // Check stock locking against other active campaigns
      const equipmentIds = units.map((u) => u.equipmentId).filter(Boolean) as string[];
      const shelfIds = units.map((u) => u.shelfId).filter(Boolean) as string[];

      const conditions: Prisma.InventoryUnitWhereInput[] = [];
      if (equipmentIds.length > 0) conditions.push({ equipmentId: { in: equipmentIds } });
      if (shelfIds.length > 0) conditions.push({ shelfId: { in: shelfIds } });

      if (conditions.length > 0) {
        const conflict = await tx.inventoryUnit.findFirst({
          where: {
            OR: conditions,
            inventory: {
              status: { notIn: ['FINALIZED', 'CANCELLED'] },
              launchedAt: { not: null },
              validatedInventoryId: null,
              OR: [
                { rootInventoryId: null },
                {
                  rootInventory: {
                    is: {
                      validatedInventoryId: null,
                      status: { notIn: ['FINALIZED', 'CANCELLED'] },
                    },
                  },
                },
              ],
              AND: [
                { rootInventoryId: { not: targetRootId } },
                { inventoryId: { not: targetRootId } },
              ],
            },
          },
          select: { unitId: true },
        });

        if (conflict) {
          throw new ConflictException(
            'Le lancement est bloqué : un ou plusieurs éléments sont verrouillés par un autre inventaire actif.',
          );
        }
      }

      // Freeze baseline snapshotData if root round 1, or reuse root's snapshot
      let snapshotDataString = inventory.snapshotData;
      if (inventory.roundNumber === 1 || !snapshotDataString) {
        if (inventory.rootInventory?.snapshotData) {
          snapshotDataString = inventory.rootInventory.snapshotData;
        } else {
          const snapshotObj = await buildFrozenBaselineSnapshot(
            tx,
            inventory.typeInventory as 'ByEquipment' | 'ByShelf',
            units,
          );
          snapshotDataString = JSON.stringify(snapshotObj);
        }
      }

      // Create counts for ALL controllers and ALL units (batched insert)
      const countRecords = units.flatMap((unit) =>
        controllers.map((ctrl) => ({
          unitId: unit.unitId,
          inventoryControllerId: ctrl.inventoryControllerId,
        })),
      );

      await tx.inventoryCount.createMany({
        data: countRecords,
      });

      await tx.inventoryUnit.updateMany({
        where: { inventoryId },
        data: { status: 'COUNTING' },
      });

      await tx.inventory.update({
        where: { inventoryId },
        data: {
          status: 'IN_PROGRESS',
          launchedAt: new Date(),
          snapshotData: snapshotDataString,
        },
      });

      // On launch: ONLY notify the first controller (round 1)
      const firstCtrl = controllers.find((c) => (c.round ?? 1) === 1) ?? controllers[0];
      const firstControllerUserId = firstCtrl?.userId;

      return {
        success: true,
        inventoryId,
        totalUnits: units.length,
        controllersCount: controllers.length,
        title: inventory.title,
        firstControllerUserId,
      };
    });

    // Notify ONLY the first controller to start counting the first unit
    if (launchResult.firstControllerUserId && this.prisma.notification?.create) {
      try {
        await this.prisma.notification.create({
          data: {
            recipientId: launchResult.firstControllerUserId,
            eventType: 'INVENTORY_TASK_AVAILABLE',
            payload: JSON.stringify({
              inventoryId: launchResult.inventoryId,
              title: launchResult.title,
              message: "L'inventaire est lancé. Vous pouvez commencer le comptage de vos unités.",
            }),
          },
        });
      } catch (err) {
        this.logger.warn(`Failed to dispatch launch notification to ${launchResult.firstControllerUserId}: ${(err as Error).message}`);
      }
    }

    return {
      success: true,
      inventoryId: launchResult.inventoryId,
      totalUnits: launchResult.totalUnits,
      controllersCount: launchResult.controllersCount,
    };
  }

  // --------------------------------------------------------------------------
  // Tasks (Counter UI)
  // --------------------------------------------------------------------------

  async getMyTasks(userId: string) {
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
        unit: {
          unitOrder: 'asc',
        },
      },
    });

    // Check which units are ready (unlocked by predecessor completion)
    const higherRoundCounts = counts.filter((c) => (c.inventoryController.round ?? 1) > 1);
    let predecessorSubmittedSet = new Set<string>();

    if (higherRoundCounts.length > 0) {
      const predChecks = await this.prisma.inventoryCount.findMany({
        where: {
          unitId: { in: higherRoundCounts.map((c) => c.unitId) },
          submittedAt: { not: null },
        },
        select: {
          unitId: true,
          inventoryController: {
            select: {
              inventoryId: true,
              round: true,
            },
          },
        },
      });

      predecessorSubmittedSet = new Set(
        predChecks.map(
          (p) => `${p.inventoryController.inventoryId}|${p.unitId}|${p.inventoryController.round}`,
        ),
      );
    }

    return counts.map((count, index) => {
      const round = count.inventoryController.round ?? 1;
      const isReady =
        round === 1 ||
        predecessorSubmittedSet.has(
          `${count.inventoryController.inventoryId}|${count.unitId}|${round - 1}`,
        );

      return {
        attemptId: count.countId,
        unitId: count.unitId,
        assignedUserId: count.inventoryController.userId,
        sequence: round - 1,
        purpose:
          round === 1
            ? 'PRIMARY_1'
            : round === 2
              ? 'PRIMARY_2'
              : 'FINAL_RECOUNT',
        status: count.submittedAt ? 'SUBMITTED' : isReady ? 'AVAILABLE' : 'WAITING_PREVIOUS',
        isReady,
        submittedAt: count.submittedAt,
        draftData: count.resultData,
        assignedUser: count.inventoryController.user,
        unit: {
          ...count.unit,
          unitOrder: count.unit.unitOrder ?? index,
        },
      };
    });
  }

  async getTask(attemptId: string, currentUserId?: string) {
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

    const currentRound = count.inventoryController.round ?? 1;
    let isReady = true;
    if (currentRound > 1) {
      const unsubmittedPred = await this.prisma.inventoryCount.findFirst({
        where: {
          unitId: count.unitId,
          inventoryController: {
            inventoryId: count.inventoryController.inventoryId,
            round: currentRound - 1,
          },
          submittedAt: null,
        },
      });
      if (unsubmittedPred) {
        isReady = false;
      }
    }

    const unit = count.unit;
    let scopeLabel = 'Unité de travail';
    let isSerialized = false;
    let expectedShelves: any[] = [];
    let expectedEquipments: any[] = [];

    if (unit.equipment) {
      scopeLabel = unit.equipment.equipmentName ?? 'Article';
      isSerialized = Boolean(unit.equipment.hasSerialNumber);
    } else if (unit.shelf) {
      scopeLabel = unit.shelf.shelfName ?? 'Emplacement';
    }

    const parsedOrders = extractObservations(count.resultData);

    return {
      attemptId: count.countId,
      unitId: count.unitId,
      assignedUserId: count.inventoryController.userId,
      sequence: currentRound - 1,
      purpose:
        currentRound === 1
          ? 'PRIMARY_1'
          : currentRound === 2
            ? 'PRIMARY_2'
            : 'FINAL_RECOUNT',
      status: count.submittedAt ? 'SUBMITTED' : isReady ? 'AVAILABLE' : 'WAITING_PREVIOUS',
      isReady,
      submittedAt: count.submittedAt,
      draftData: count.resultData,
      assignedUser: count.inventoryController.user,
      unit: {
        ...unit,
        unitOrder: unit.unitOrder ?? 0,
      },
      orders: parsedOrders,
      scopeLabel,
      isSerialized,
      expectedShelves,
      expectedEquipments,
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

  // --------------------------------------------------------------------------
  // Core Reconciliation: Unanimous agreement across all N controllers
  // --------------------------------------------------------------------------

  async submitCountAttempt(
    attemptId: string,
    userId: string,
    dto: SubmitTaskDTO,
  ) {
    const data = submitTaskSchema.parse(dto);

    if (data.isDraft) {
      return this.saveDraft(attemptId, userId, data);
    }

    const submitResult = await this.prisma.$transaction(async (tx) => {
      const count = await tx.inventoryCount.findUnique({
        where: { countId: attemptId },
        include: {
          inventoryController: {
            include: {
              inventory: {
                include: {
                  controllers: { orderBy: { round: 'asc' } },
                  units: { orderBy: { unitOrder: 'asc' } },
                  rootInventory: true,
                },
              },
            },
          },
          unit: {
            include: {
              equipment: true,
              shelf: true,
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
        return {
          success: true,
          message: 'Cette tâche a déjà été enregistrée.',
        };
      }

      const inventory = count.inventoryController.inventory;
      const inventoryId = inventory.inventoryId;
      const controllers = inventory.controllers;
      const units = inventory.units;
      const totalUnits = units.length;
      const totalControllers = controllers.length;
      const totalRequired = totalUnits * totalControllers;

      // Sequential check: if this controller is round > 1, predecessor must have submitted for this unit
      const currentRound = count.inventoryController.round ?? 1;
      if (currentRound > 1) {
        const unsubmittedPred = await tx.inventoryCount.findFirst({
          where: {
            unitId: count.unitId,
            inventoryController: {
              inventoryId,
              round: currentRound - 1,
            },
            submittedAt: null,
          },
        });
        if (unsubmittedPred) {
          throw new BadRequestException(
            "Cette unité n'a pas encore été comptée par le contrôleur précédent. Les unités sont traitées dans l'ordre synchronisé.",
          );
        }
      }

      const submittedAt = new Date();
      const resultData = JSON.stringify(data);

      await tx.inventoryCount.update({
        where: { countId: attemptId },
        data: {
          submittedAt,
          resultData,
        },
      });

      // Synchronized notification by unit: notify the next controller for THIS UNIT
      const nextController = controllers.find((c) => (c.round ?? 0) === currentRound + 1);
      let nextUnitNotification: {
        recipientId: string;
        inventoryId: string;
        unitId: string;
        taskId?: string;
        title: string;
        unitName: string;
      } | null = null;

      if (nextController) {
        const nextCount = await tx.inventoryCount.findFirst({
          where: {
            unitId: count.unitId,
            inventoryControllerId: nextController.inventoryControllerId,
          },
        });

        const unitLabel =
          count.unit.equipment?.equipmentName ||
          count.unit.shelf?.shelfName ||
          (count.unit.unitOrder != null ? `Unité #${count.unit.unitOrder + 1}` : 'Unité de travail');

        nextUnitNotification = {
          recipientId: nextController.userId,
          inventoryId,
          unitId: count.unitId,
          taskId: nextCount?.countId,
          title: inventory.title ?? 'Inventaire',
          unitName: unitLabel,
        };
      }

      // Count submitted tasks across this round
      const submittedCount = await tx.inventoryCount.count({
        where: {
          inventoryController: { inventoryId },
          submittedAt: { not: null },
        },
      });

      if (submittedCount < totalRequired) {
        return {
          success: true,
          isRoundComplete: false,
          status: 'IN_PROGRESS',
          submittedCount,
          totalRequired,
          nextUnitNotification,
        };
      }

      // ALL REQUIRED COUNTS SUBMITTED!
      const roundUnits = await tx.inventoryUnit.findMany({
        where: { inventoryId },
        include: {
          counts: {
            include: { inventoryController: true },
          },
        },
        orderBy: { unitOrder: 'asc' },
      });

      const unitSubmissions = new Map<string, Map<string, ParsedSubmission>>();
      for (const u of roundUnits) {
        const subMap = new Map<string, ParsedSubmission>();
        for (const cnt of u.counts) {
          const parsed = parseCountSubmission(
            cnt.resultData,
            cnt.inventoryControllerId,
            cnt.inventoryController.userId,
            cnt.submittedAt,
          );
          subMap.set(cnt.inventoryControllerId, parsed);
        }
        unitSubmissions.set(u.unitId, subMap);
      }

      const controllerInfos: ControllerInfo[] = controllers.map((c, idx) => ({
        controllerId: c.inventoryControllerId,
        userId: c.userId,
        sequence: idx,
        round: c.round,
      }));

      let baselineSnapshot: FrozenBaselineSnapshot | null = null;
      const rawSnapshot = inventory.snapshotData ?? inventory.rootInventory?.snapshotData;
      if (rawSnapshot) {
        try {
          baselineSnapshot = JSON.parse(rawSnapshot);
        } catch {
          baselineSnapshot = null;
        }
      }

      const roundResult = compareInventoryRound(
        units.map((u) => ({ unitId: u.unitId, equipmentId: u.equipmentId, shelfId: u.shelfId })),
        controllerInfos,
        unitSubmissions,
        baselineSnapshot,
      );

      if (roundResult.isUnanimous) {
        // UNANIMOUS AGREEMENT ACROSS ALL CONTROLLERS AND UNITS!
        const firstCtrl = controllers[0];
        for (const u of roundUnits) {
          const repCount = u.counts.find(
            (c) => c.inventoryControllerId === firstCtrl.inventoryControllerId,
          );
          await tx.inventoryUnit.update({
            where: { unitId: u.unitId },
            data: {
              status: 'COMPLETED',
              reconciliationStatus: 'CONVERGED',
              acceptedCountId: repCount?.countId ?? u.counts[0]?.countId,
              reconciledAt: submittedAt,
            },
          });
        }

        await tx.inventory.update({
          where: { inventoryId },
          data: {
            status: 'CONVERGED',
          },
        });

        // Save stock variance issues if any
        if (roundResult.stockVariances.length > 0) {
          for (const variance of roundResult.stockVariances) {
            await tx.inventoryIssue.create({
              data: {
                inventoryId,
                unitId: variance.unitId || null,
                type: variance.varianceType,
                issueCategory: 'STOCK_VARIANCE',
                status: 'OPEN',
                originatingRound: inventory.roundNumber,
                data: JSON.stringify(variance),
              },
            });
          }
        }

        // Resolve historical disagreement issues from earlier rounds on this campaign
        const rootId = inventory.rootInventoryId ?? inventoryId;
        await tx.inventoryIssue.updateMany({
          where: {
            issueCategory: 'DISAGREEMENT',
            inventory: {
              OR: [{ rootInventoryId: rootId }, { inventoryId: rootId }],
            },
            status: 'OPEN',
          },
          data: {
            status: 'RESOLVED',
            resolutionDisposition: 'RESOLVED_BY_RECOUNT',
            resolutionReason: `Résolu par recomptage unanime au tour ${inventory.roundNumber}`,
            resolvedAt: submittedAt,
          },
        });

        return {
          success: true,
          isRoundComplete: true,
          isUnanimous: true,
          status: 'CONVERGED',
          message: 'Comptage validé avec accord unanime.',
          nextUnitNotification,
        };
      } else {
        // CONTROLLERS DISAGREED! RECOUNT REQUIRED!
        for (const u of roundUnits) {
          const unitComp = roundResult.unitResults.get(u.unitId);
          if (unitComp && !unitComp.isMatch) {
            await tx.inventoryUnit.update({
              where: { unitId: u.unitId },
              data: {
                status: 'DIVERGENT',
                reconciliationStatus: 'RECOUNT_REQUIRED',
                reconciledAt: null,
                acceptedCountId: null,
              },
            });

            // Record disagreement issues
            for (const d of unitComp.disagreements) {
              await tx.inventoryIssue.create({
                data: {
                  inventoryId,
                  unitId: u.unitId,
                  type: 'CONTROLLER_DISAGREEMENT',
                  issueCategory: 'DISAGREEMENT',
                  status: 'OPEN',
                  originatingRound: inventory.roundNumber,
                  data: JSON.stringify(d),
                },
              });
            }
          } else {
            await tx.inventoryUnit.update({
              where: { unitId: u.unitId },
              data: {
                status: 'COMPLETED',
                reconciliationStatus: 'RECOUNT_REQUIRED',
              },
            });
          }
        }

        await tx.inventory.update({
          where: { inventoryId },
          data: {
            status: 'RECOUNT_REQUIRED',
          },
        });

        // Atomically create continuation child round in DRAFT if not already created
        const rootId = inventory.rootInventoryId ?? inventoryId;
        const rootInv = inventory.rootInventory ?? inventory;

        const existingChild = await tx.inventory.findFirst({
          where: { parentInventoryId: inventoryId },
        });

        const child = existingChild ?? await tx.inventory.create({
          data: {
            title: `${rootInv.title || 'Inventaire'} - Tour ${inventory.roundNumber + 1}`,
            typeInventory: inventory.typeInventory,
            status: 'DRAFT',
            parentInventoryId: inventoryId,
            rootInventoryId: rootId,
            roundNumber: inventory.roundNumber + 1,
            policyVersion: inventory.policyVersion ?? 4,
            snapshotData: rawSnapshot ?? null,
            creatorId: inventory.creatorId,
          },
        });

        if (!existingChild) {
          const childId = child.inventoryId;
          // Inherit full original scope
          await tx.inventoryUnit.createMany({
            data: units.map((u, idx) => ({
              inventoryId: childId,
              equipmentId: u.equipmentId,
              shelfId: u.shelfId,
              unitOrder: idx,
              status: 'DRAFT',
              reconciliationStatus: 'PENDING',
            })),
          });

          // Inherit default roster
          await tx.inventoryController.createMany({
            data: controllers.map((c, idx) => ({
              inventoryId: childId,
              userId: c.userId,
              round: idx + 1,
            })),
          });
        }

        return {
          success: true,
          isRoundComplete: true,
          isUnanimous: false,
          status: 'RECOUNT_REQUIRED',
          nextChildId: child.inventoryId,
          message: 'Divergence constatée. Un nouveau tour de recomptage a été généré.',
          nextUnitNotification,
        };
      }
    });

    // Unit-synchronized notification: alert the next controller for this specific unit
    if (submitResult.nextUnitNotification && this.prisma.notification?.create) {
      try {
        await this.prisma.notification.create({
          data: {
            recipientId: submitResult.nextUnitNotification.recipientId,
            eventType: 'INVENTORY_UNIT_AVAILABLE',
            payload: JSON.stringify({
              inventoryId: submitResult.nextUnitNotification.inventoryId,
              unitId: submitResult.nextUnitNotification.unitId,
              taskId: submitResult.nextUnitNotification.taskId,
              title: submitResult.nextUnitNotification.title,
              message: `L'unité "${submitResult.nextUnitNotification.unitName}" est maintenant prête pour votre comptage.`,
            }),
          },
        });
      } catch (err) {
        this.logger.warn(
          `Failed to dispatch unit notification to ${submitResult.nextUnitNotification.recipientId}: ${(err as Error).message}`,
        );
      }
    }

    return submitResult;
  }

  // --------------------------------------------------------------------------
  // Progress & Reporting
  // --------------------------------------------------------------------------

  async getInventoryProgress(inventoryId: string) {
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
          orderBy: { unitOrder: 'asc' },
        },
        subInventories: {
          select: { inventoryId: true, status: true, roundNumber: true },
        },
      },
    });

    if (!inventory) {
      throw new NotFoundException('Inventaire introuvable');
    }

    const controllers = inventory.controllers ?? [];
    const units = inventory.units ?? [];
    const totalUnits = units.length;

    const dynamicControllers = controllers.map((c, idx) => {
      const completed = units.filter((unit) =>
        unit.counts?.some(
          (cnt) => cnt.inventoryControllerId === c.inventoryControllerId && cnt.submittedAt,
        ),
      ).length;
      return {
        controllerId: c.inventoryControllerId,
        userId: c.userId,
        sequence: idx,
        round: c.round,
        user: c.user,
        responsibility: `CONTROLLER_${c.round}`,
        completedUnits: completed,
        totalUnits,
        isFinished: completed === totalUnits && totalUnits > 0,
      };
    });

    const reconciledUnits = units.filter((unit) =>
      ['CONVERGED', 'PRIMARY_MATCH', 'THIRD_RESOLVED'].includes(unit.reconciliationStatus),
    ).length;

    const c1 = dynamicControllers[0];
    const c2 = dynamicControllers[1];
    const c3 = dynamicControllers[2];

    const nextChild = inventory.subInventories?.[0];

    return {
      inventoryId: inventory.inventoryId,
      rootInventoryId: inventory.rootInventoryId,
      roundNumber: inventory.roundNumber,
      validatedInventoryId: inventory.validatedInventoryId,
      nextChildId: nextChild?.inventoryId ?? null,
      title: inventory.title,
      typeInventory: inventory.typeInventory,
      status: inventory.status,
      policyVersion: inventory.policyVersion,
      totalUnits,
      reconciledUnits,
      controllersList: dynamicControllers,
      controllers: {
        controller1: c1
          ? {
              user: c1.user,
              responsibility: 'PRIMARY_COUNTER_1',
              completedUnits: c1.completedUnits,
              totalUnits,
              isFinished: c1.isFinished,
            }
          : null,
        controller2: c2
          ? {
              user: c2.user,
              responsibility: 'PRIMARY_COUNTER_2',
              completedUnits: c2.completedUnits,
              totalUnits,
              isFinished: c2.isFinished,
            }
          : null,
        controller3: c3
          ? {
              user: c3.user,
              responsibility: 'FINAL_CONTROLLER',
              completedUnits: c3.completedUnits,
              totalUnits,
              isFinished: c3.isFinished,
            }
          : null,
      },
      workUnits: units.map((u, idx) => ({
        unitId: u.unitId,
        unitOrder: u.unitOrder ?? idx,
        equipmentId: u.equipmentId,
        shelfId: u.shelfId,
        status: u.status,
        reconciliationStatus: u.reconciliationStatus,
        acceptedAttemptId: u.acceptedCountId,
        reconciledAt: u.reconciledAt,
        countsCount: u.counts?.length ?? 0,
        submittedCount: u.counts?.filter((cnt) => cnt.submittedAt).length ?? 0,
      })),
    };
  }

  async getInventoryComparison(inventoryId: string) {
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
          orderBy: { unitOrder: 'asc' },
        },
        rootInventory: true,
      },
    });

    if (!inventory) {
      throw new NotFoundException('Inventaire introuvable');
    }

    const controllers = inventory.controllers ?? [];
    let baselineSnapshot: FrozenBaselineSnapshot | null = null;
    const rawSnapshot = inventory.snapshotData ?? inventory.rootInventory?.snapshotData;
    if (rawSnapshot) {
      try {
        baselineSnapshot = JSON.parse(rawSnapshot);
      } catch {
        baselineSnapshot = null;
      }
    }

    const [allEquipments, allShelves, allSerials] = await Promise.all([
      this.prisma.equipment.findMany({
        select: { equipmentId: true, equipmentName: true, hasSerialNumber: true },
      }),
      this.prisma.shelf.findMany({
        select: { shelfId: true, shelfName: true },
      }),
      this.prisma.serialNumber.findMany({
        select: {
          serialNumberCode: true,
          equipmentId: true,
          equipment: { select: { equipmentName: true } },
        },
      }),
    ]);

    const equipmentMap = new Map(allEquipments.map((e) => [e.equipmentId.toLowerCase(), e]));
    const shelfMap = new Map(allShelves.map((s) => [s.shelfId.toLowerCase(), s]));
    const serialMap = new Map(allSerials.map((s) => [s.serialNumberCode.trim().toLowerCase(), s]));

    const units = (inventory.units ?? []).map((unit, index) => {
      const counts = unit.counts ?? [];
      const acceptedCount = unit.acceptedCount;

      const subByCtrlId = new Map<string, { obs: any[]; count: typeof counts[0] }>();
      for (const ctrl of controllers) {
        const cnt = counts.find((c) => c.inventoryControllerId === ctrl.inventoryControllerId);
        subByCtrlId.set(ctrl.inventoryControllerId, {
          obs: extractObservations(cnt?.resultData),
          count: cnt!,
        });
      }

      const accObs = extractObservations(acceptedCount?.resultData);

      const allKeys = new Set<string>();
      const addKeys = (obsList: any[]) => {
        for (const o of obsList) {
          const s = (o.scannedSerialCode || o.serialNumberCode || '').toString().trim();
          const eq = (o.observedEquipmentId || o.equipmentId || unit.equipmentId || '').toString().trim();
          const sh = (o.observedShelfId || o.shelfId || unit.shelfId || '').toString().trim();
          if (s) allKeys.add(`SER|${s.toLowerCase()}|${sh.toLowerCase()}`);
          else if (eq || sh) allKeys.add(`STD|${eq.toLowerCase()}|${sh.toLowerCase()}`);
        }
      };

      for (const { obs } of subByCtrlId.values()) {
        addKeys(obs);
      }
      addKeys(accObs);

      const rows = Array.from(allKeys).map((key) => {
        const isSer = key.startsWith('SER|');
        const parts = key.split('|');
        const rawSerialCode = isSer ? parts[1] : null;

        const findQty = (obsList: any[]) => {
          if (isSer) {
            return obsList.some(
              (o) =>
                (o.scannedSerialCode || o.serialNumberCode || '').toString().trim().toLowerCase() ===
                rawSerialCode,
            )
              ? 1
              : 0;
          }
          const eqId = parts[1];
          const shId = parts[2];
          return obsList
            .filter(
              (o) =>
                !(o.scannedSerialCode || o.serialNumberCode) &&
                (o.observedEquipmentId || o.equipmentId || unit.equipmentId || '')
                  .toString()
                  .trim()
                  .toLowerCase() === eqId &&
                (o.observedShelfId || o.shelfId || unit.shelfId || '')
                  .toString()
                  .trim()
                  .toLowerCase() === shId,
            )
            .reduce((sum, o) => sum + Number(o.quantityCalculated ?? 0), 0);
        };

        let equipmentId: string | null = null;
        let equipmentName: string | null = null;
        let shelfId: string | null = null;
        let shelfName: string | null = null;
        let serialNumberCode: string | null = null;

        if (isSer && rawSerialCode) {
          const sObj = serialMap.get(rawSerialCode.toLowerCase());
          let obsEqId: string | null = null;
          let obsSerialRaw: string | null = null;

          for (const { obs } of subByCtrlId.values()) {
            const found = obs.find(
              (o) =>
                (o.scannedSerialCode || o.serialNumberCode || '')
                  .toString()
                  .trim()
                  .toLowerCase() === rawSerialCode.toLowerCase(),
            );
            if (found) {
              if (!obsSerialRaw) {
                obsSerialRaw = (found.scannedSerialCode || found.serialNumberCode || '').toString().trim();
              }
              if (found.observedEquipmentId || found.equipmentId) {
                obsEqId = (found.observedEquipmentId || found.equipmentId).toString().trim();
                break;
              }
            }
          }

          if (!obsEqId && accObs) {
            const found = accObs.find(
              (o) =>
                (o.scannedSerialCode || o.serialNumberCode || '')
                  .toString()
                  .trim()
                  .toLowerCase() === rawSerialCode.toLowerCase(),
            );
            if (found) {
              if (!obsSerialRaw) {
                obsSerialRaw = (found.scannedSerialCode || found.serialNumberCode || '').toString().trim();
              }
              if (found.observedEquipmentId || found.equipmentId) {
                obsEqId = (found.observedEquipmentId || found.equipmentId).toString().trim();
              }
            }
          }

          serialNumberCode = sObj?.serialNumberCode ?? obsSerialRaw ?? rawSerialCode;
          equipmentId = sObj?.equipmentId ?? obsEqId ?? unit.equipmentId ?? null;
          const eqObj = equipmentId ? equipmentMap.get(equipmentId.toLowerCase()) : null;
          equipmentName =
            eqObj?.equipmentName ??
            sObj?.equipment?.equipmentName ??
            unit.equipment?.equipmentName ??
            'Article';

          const shId = parts[2];
          const shObj = shId ? shelfMap.get(shId.toLowerCase()) : null;
          shelfId = shObj?.shelfId ?? (shId || unit.shelfId) ?? null;
          shelfName = shObj?.shelfName ?? unit.shelf?.shelfName ?? null;
        } else {
          const eqId = parts[1];
          const shId = parts[2];

          const eqObj = eqId ? equipmentMap.get(eqId.toLowerCase()) : null;
          equipmentId = eqObj?.equipmentId ?? (eqId || unit.equipmentId) ?? null;
          equipmentName = eqObj?.equipmentName ?? unit.equipment?.equipmentName ?? 'Article';

          const shObj = shId ? shelfMap.get(shId.toLowerCase()) : null;
          shelfId = shObj?.shelfId ?? (shId || unit.shelfId) ?? null;
          shelfName = shObj?.shelfName ?? unit.shelf?.shelfName ?? null;
          serialNumberCode = null;
        }

        const controllerCells: Record<string, { quantity: number | null; serialNumberCode: string | null; isSubmitted: boolean }> = {};
        for (const ctrl of controllers) {
          const data = subByCtrlId.get(ctrl.inventoryControllerId);
          const isSub = Boolean(data?.count?.submittedAt);
          controllerCells[ctrl.inventoryControllerId] = {
            quantity: isSub ? findQty(data!.obs) : null,
            serialNumberCode: isSer ? serialNumberCode : null,
            isSubmitted: isSub,
          };
        }

        const qAcc = acceptedCount?.submittedAt ? findQty(accObs) : null;

        const c1Data = controllers[0] ? controllerCells[controllers[0].inventoryControllerId] : null;
        const c2Data = controllers[1] ? controllerCells[controllers[1].inventoryControllerId] : null;
        const c3Data = controllers[2] ? controllerCells[controllers[2].inventoryControllerId] : null;

        const statusFor = (cData: { quantity: number | null } | null) => {
          if (qAcc !== null) {
            return cData?.quantity === qAcc ? 'CONFORME' : 'DIVERGENT';
          }
          if (c1Data && c2Data && c1Data.quantity !== null && c2Data.quantity !== null) {
            return c1Data.quantity === c2Data.quantity ? 'CONFORME' : 'DIVERGENT';
          }
          return 'PENDING';
        };

        return {
          key,
          kind: isSer ? 'SERIALIZED' : 'STANDARD',
          equipmentId,
          equipmentName,
          shelfId,
          shelfName,
          serialNumberCode: isSer ? serialNumberCode : null,
          controllerCells,
          controller1: c1Data?.quantity !== null && c1Data ? { quantity: c1Data.quantity, serialNumberCode: isSer ? serialNumberCode : null } : null,
          controller2: c2Data?.quantity !== null && c2Data ? { quantity: c2Data.quantity, serialNumberCode: isSer ? serialNumberCode : null } : null,
          controller3: c3Data?.quantity !== null && c3Data ? { quantity: c3Data.quantity, serialNumberCode: isSer ? serialNumberCode : null } : null,
          accepted: qAcc !== null ? { quantity: qAcc, serialNumberCode: isSer ? serialNumberCode : null } : null,
          controller1VsAccepted: {
            status: statusFor(c1Data),
            delta: c1Data?.quantity !== null && qAcc !== null && c1Data ? c1Data.quantity - qAcc : null,
          },
          controller2VsAccepted: {
            status: statusFor(c2Data),
            delta: c2Data?.quantity !== null && qAcc !== null && c2Data ? c2Data.quantity - qAcc : null,
          },
        };
      });

      return {
        unitId: unit.unitId,
        unitOrder: unit.unitOrder ?? index,
        equipmentId: unit.equipmentId,
        shelfId: unit.shelfId,
        status: unit.status,
        reconciliationStatus: unit.reconciliationStatus,
        acceptedAttemptId: unit.acceptedCountId,
        attempts: counts.map((c) => ({
          attemptId: c.countId,
          controllerId: c.inventoryControllerId,
          userId: c.inventoryController.userId,
          user: c.inventoryController.user,
          submittedAt: c.submittedAt,
        })),
        rows,
      };
    });

    const summary = {
      totalUnits: units.length,
      convergedUnits: units.filter((u) => u.reconciliationStatus === 'CONVERGED').length,
      recountRequiredUnits: units.filter((u) => u.reconciliationStatus === 'RECOUNT_REQUIRED').length,
      pendingUnits: units.filter((u) => u.reconciliationStatus === 'PENDING').length,
    };

    return {
      inventoryId: inventory.inventoryId,
      rootInventoryId: inventory.rootInventoryId,
      roundNumber: inventory.roundNumber,
      validatedInventoryId: inventory.validatedInventoryId,
      title: inventory.title,
      status: inventory.status,
      typeInventory: inventory.typeInventory,
      units,
      summary,
      controllers: controllers.map((c, idx) => ({
        controllerId: c.inventoryControllerId,
        sequence: idx,
        round: c.round,
        responsibility: `CONTROLLER_${c.round}`,
        user: c.user,
      })),
      hasBaselineSnapshot: Boolean(baselineSnapshot),
      baselineSnapshot: baselineSnapshot ?? null,
    };
  }

  async getInventoryReport(inventoryId: string) {
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
        movements: {
          include: {
            createdByUser: {
              select: {
                userId: true,
                userName: true,
                userEmail: true,
              },
            },
            items: {
              include: {
                equipment: true,
                serialNumber: true,
                sourceShelf: true,
                destinationShelf: true,
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
      controllers: (inventory.controllers ?? []).map((c) => ({
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
      adjustmentMovements: inventory.movements ?? [],
    };
  }

  // --------------------------------------------------------------------------
  // Issues & Investigation
  // --------------------------------------------------------------------------

  async getInventoryIssues(inventoryId: string) {
    return this.prisma.inventoryIssue.findMany({
      where: { inventoryId },
      include: {
        unit: true,
        resolvedByUser: {
          select: {
            userId: true,
            userName: true,
            userEmail: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async resolveInvestigationIssue(
    inventoryId: string,
    issueId: string,
    userId: string,
    dto: ResolveIssueDTO,
  ) {
    const data = resolveIssueSchema.parse(dto);

    return this.prisma.$transaction(async (tx) => {
      const issue = await tx.inventoryIssue.findUnique({
        where: { issueId },
      });

      if (!issue) {
        throw new NotFoundException("Problème d'investigation introuvable");
      }

      if (issue.inventoryId !== inventoryId) {
        throw new BadRequestException(
          'Le problème ne correspond pas à cet inventaire.',
        );
      }

      return tx.inventoryIssue.update({
        where: { issueId },
        data: {
          resolvedByUserId: userId,
          resolvedAt: new Date(),
        },
      });
    });
  }

  // --------------------------------------------------------------------------
  // Finalization
  // --------------------------------------------------------------------------

  async finalizeInventory(inventoryId: string, finalizerId: string) {
    let affectedEquipmentIds: string[] = [];

    const result = await this.prisma.$transaction(async (tx) => {
      const inventory = await tx.inventory.findUnique({
        where: { inventoryId },
        include: {
          units: {
            include: {
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

      if (inventory.status === 'FINALIZED') {
        throw new BadRequestException('Cet inventaire est déjà finalisé.');
      }

      if (inventory.status !== 'CONVERGED') {
        throw new BadRequestException(
          'Seul un inventaire ayant convergé (CONVERGED) peut être finalisé.',
        );
      }

      const openDisagreements = await tx.inventoryIssue.count({
        where: {
          inventoryId,
          issueCategory: 'DISAGREEMENT',
          status: 'OPEN',
        },
      });

      if (openDisagreements > 0) {
        throw new BadRequestException(
          'Des divergences de comptage non résolues bloquent la finalisation.',
        );
      }

      // ----------------------------------------------------------------------
      // 1. Gather all equipment definitions to know serialization status
      // ----------------------------------------------------------------------
      const allEquipments = await tx.equipment.findMany({
        select: {
          equipmentId: true,
          equipmentName: true,
          hasSerialNumber: true,
        },
      });
      const equipmentMap = new Map(
        allEquipments.map((e) => [e.equipmentId.toLowerCase(), e]),
      );

      // ----------------------------------------------------------------------
      // 2. Parse accepted physical count truth from all units
      // ----------------------------------------------------------------------
      const countedStandard = new Map<
        string,
        { equipmentId: string; shelfId: string; quantity: number }
      >();
      const countedSerials = new Map<
        string,
        { serialCode: string; equipmentId: string; shelfId: string }
      >();

      for (const unit of inventory.units) {
        const obsList = extractObservations(unit.acceptedCount?.resultData);
        for (const obs of obsList) {
          const serialCode = (
            obs.scannedSerialCode ||
            obs.serialNumberCode ||
            ''
          )
            .toString()
            .trim();

          const rawEqId = (
            obs.observedEquipmentId ||
            obs.equipmentId ||
            unit.equipmentId ||
            ''
          )
            .toString()
            .trim();
          const rawShId = (
            obs.observedShelfId ||
            obs.shelfId ||
            unit.shelfId ||
            ''
          )
            .toString()
            .trim();

          if (serialCode) {
            if (rawShId) {
              countedSerials.set(serialCode.toLowerCase(), {
                serialCode,
                equipmentId: rawEqId,
                shelfId: rawShId,
              });
            }
          } else if (rawEqId && rawShId) {
            const eqDef = equipmentMap.get(rawEqId.toLowerCase());
            if (!eqDef?.hasSerialNumber) {
              const key = `${rawEqId.toLowerCase()}|${rawShId.toLowerCase()}`;
              const prev = countedStandard.get(key);
              const qty = Number(obs.quantityCalculated ?? 0);
              countedStandard.set(key, {
                equipmentId: rawEqId,
                shelfId: rawShId,
                quantity: (prev?.quantity ?? 0) + (isNaN(qty) ? 0 : qty),
              });
            }
          }
        }
      }

      // ----------------------------------------------------------------------
      // 3. Compute current theoretical book stock for the scope
      // ----------------------------------------------------------------------
      const scopedShelfIds = new Set(
        inventory.units
          .map((u) => u.shelfId?.toLowerCase())
          .filter(Boolean) as string[],
      );
      const scopedEquipmentIds = new Set(
        inventory.units
          .map((u) => u.equipmentId?.toLowerCase())
          .filter(Boolean) as string[],
      );

      const standardMovements = await tx.$queryRaw<
        { equipmentId: string; shelfId: string; balance: number }[]
      >(Prisma.sql`
        SELECT 
          CAST(d.equipmentId AS varchar(36)) AS equipmentId,
          CAST(d.shelfId AS varchar(36)) AS shelfId,
          SUM(d.qty) AS balance
        FROM (
          SELECT m.equipmentId, m.destinationShelfId AS shelfId, CAST(m.equipmentQuantity AS bigint) AS qty
          FROM dbo.MovementEquipment m
          JOIN dbo.Equipment e ON e.equipmentId = m.equipmentId
          WHERE e.hasSerialNumber = 0 AND m.destinationShelfId IS NOT NULL

          UNION ALL

          SELECT m.equipmentId, m.sourceShelfId AS shelfId, -CAST(m.equipmentQuantity AS bigint) AS qty
          FROM dbo.MovementEquipment m
          JOIN dbo.Equipment e ON e.equipmentId = m.equipmentId
          WHERE e.hasSerialNumber = 0 AND m.sourceShelfId IS NOT NULL
        ) d
        GROUP BY d.equipmentId, d.shelfId
        HAVING SUM(d.qty) <> 0
      `);

      const theoreticalStandard = new Map<
        string,
        { equipmentId: string; shelfId: string; quantity: number }
      >();
      for (const row of standardMovements) {
        const eqId = row.equipmentId.toLowerCase();
        const shId = row.shelfId.toLowerCase();
        const inScope =
          inventory.typeInventory === 'ByShelf'
            ? scopedShelfIds.has(shId)
            : inventory.typeInventory === 'ByEquipment'
              ? scopedEquipmentIds.has(eqId)
              : scopedShelfIds.has(shId) || scopedEquipmentIds.has(eqId);

        if (inScope) {
          theoreticalStandard.set(`${eqId}|${shId}`, {
            equipmentId: row.equipmentId,
            shelfId: row.shelfId,
            quantity: Number(row.balance),
          });
        }
      }

      const serialMovements = await tx.$queryRaw<
        {
          serialNumberId: string;
          equipmentId: string;
          shelfId: string;
          balance: number;
        }[]
      >(Prisma.sql`
        SELECT 
          CAST(d.serialNumberId AS varchar(36)) AS serialNumberId,
          CAST(d.equipmentId AS varchar(36)) AS equipmentId,
          CAST(d.shelfId AS varchar(36)) AS shelfId,
          SUM(d.qty) AS balance
        FROM (
          SELECT m.serialNumberId, m.equipmentId, m.destinationShelfId AS shelfId, CAST(m.equipmentQuantity AS bigint) AS qty
          FROM dbo.MovementEquipment m
          WHERE m.serialNumberId IS NOT NULL AND m.destinationShelfId IS NOT NULL

          UNION ALL

          SELECT m.serialNumberId, m.equipmentId, m.sourceShelfId AS shelfId, -CAST(m.equipmentQuantity AS bigint) AS qty
          FROM dbo.MovementEquipment m
          WHERE m.serialNumberId IS NOT NULL AND m.sourceShelfId IS NOT NULL
        ) d
        GROUP BY d.serialNumberId, d.equipmentId, d.shelfId
        HAVING SUM(d.qty) > 0
      `);

      const allSerials = await tx.serialNumber.findMany({
        select: {
          serialNumberId: true,
          serialNumberCode: true,
          equipmentId: true,
        },
      });
      const serialByCode = new Map(
        allSerials.map((s) => [s.serialNumberCode.trim().toLowerCase(), s]),
      );
      const serialById = new Map(
        allSerials.map((s) => [s.serialNumberId.toLowerCase(), s]),
      );

      const theoreticalSerials = new Map<
        string,
        {
          serialNumberId: string;
          serialCode: string;
          equipmentId: string;
          shelfId: string;
        }
      >();
      for (const row of serialMovements) {
        const sRecord = serialById.get(row.serialNumberId.toLowerCase());
        if (!sRecord) continue;
        const shId = row.shelfId.toLowerCase();
        const eqId = row.equipmentId.toLowerCase();
        const inScope =
          inventory.typeInventory === 'ByShelf'
            ? scopedShelfIds.has(shId)
            : inventory.typeInventory === 'ByEquipment'
              ? scopedEquipmentIds.has(eqId)
              : scopedShelfIds.has(shId) || scopedEquipmentIds.has(eqId);

        if (inScope) {
          theoreticalSerials.set(sRecord.serialNumberCode.trim().toLowerCase(), {
            serialNumberId: row.serialNumberId,
            serialCode: sRecord.serialNumberCode,
            equipmentId: row.equipmentId,
            shelfId: row.shelfId,
          });
        }
      }

      // ----------------------------------------------------------------------
      // 4. Calculate Deltas and Generate Movement Items
      // ----------------------------------------------------------------------
      const inItems: Array<{
        equipmentId: string;
        destinationShelfId: string | null;
        sourceShelfId: string | null;
        serialNumberId: string | null;
        equipmentQuantity: number;
        equipmentTypeSnapshot: string;
      }> = [];

      const outItems: Array<{
        equipmentId: string;
        destinationShelfId: string | null;
        sourceShelfId: string | null;
        serialNumberId: string | null;
        equipmentQuantity: number;
        equipmentTypeSnapshot: string;
      }> = [];

      // A. Standard items
      const allStandardKeys = new Set([
        ...theoreticalStandard.keys(),
        ...countedStandard.keys(),
      ]);

      for (const key of allStandardKeys) {
        const th = theoreticalStandard.get(key);
        const cnt = countedStandard.get(key);
        const equipmentId = cnt?.equipmentId ?? th?.equipmentId;
        const shelfId = cnt?.shelfId ?? th?.shelfId;
        if (!equipmentId || !shelfId) continue;

        const thQty = th?.quantity ?? 0;
        const cntQty = cnt?.quantity ?? 0;
        const delta = cntQty - thQty;

        if (delta > 0) {
          inItems.push({
            equipmentId,
            destinationShelfId: shelfId,
            sourceShelfId: null,
            serialNumberId: null,
            equipmentQuantity: delta,
            equipmentTypeSnapshot: 'STANDARD',
          });
        } else if (delta < 0) {
          outItems.push({
            equipmentId,
            sourceShelfId: shelfId,
            destinationShelfId: null,
            serialNumberId: null,
            equipmentQuantity: Math.abs(delta),
            equipmentTypeSnapshot: 'STANDARD',
          });
        }
      }

      // B. Serialized items (Relocations: OUT first, then IN)
      const allSerialCodes = new Set([
        ...theoreticalSerials.keys(),
        ...countedSerials.keys(),
      ]);

      for (const code of allSerialCodes) {
        const th = theoreticalSerials.get(code);
        const cnt = countedSerials.get(code);

        if (th && cnt) {
          if (th.shelfId.toLowerCase() !== cnt.shelfId.toLowerCase()) {
            outItems.push({
              equipmentId: th.equipmentId,
              sourceShelfId: th.shelfId,
              destinationShelfId: null,
              serialNumberId: th.serialNumberId,
              equipmentQuantity: 1,
              equipmentTypeSnapshot: 'SERIALIZED',
            });
            inItems.push({
              equipmentId: th.equipmentId,
              destinationShelfId: cnt.shelfId,
              sourceShelfId: null,
              serialNumberId: th.serialNumberId,
              equipmentQuantity: 1,
              equipmentTypeSnapshot: 'SERIALIZED',
            });
          }
        } else if (!th && cnt) {
          let serialRecord = serialByCode.get(code);
          if (!serialRecord && cnt.equipmentId) {
            serialRecord = await tx.serialNumber.create({
              data: {
                serialNumberCode: cnt.serialCode,
                equipmentId: cnt.equipmentId,
                serialNumberStatus: 'AVAILABLE',
              },
            });
            serialByCode.set(code, serialRecord);
          }
          if (serialRecord) {
            inItems.push({
              equipmentId: serialRecord.equipmentId,
              destinationShelfId: cnt.shelfId,
              sourceShelfId: null,
              serialNumberId: serialRecord.serialNumberId,
              equipmentQuantity: 1,
              equipmentTypeSnapshot: 'SERIALIZED',
            });
          }
        } else if (th && !cnt) {
          outItems.push({
            equipmentId: th.equipmentId,
            sourceShelfId: th.shelfId,
            destinationShelfId: null,
            serialNumberId: th.serialNumberId,
            equipmentQuantity: 1,
            equipmentTypeSnapshot: 'SERIALIZED',
          });
        }
      }

      // ----------------------------------------------------------------------
      // 5. Create OUT movements first, then IN movements in DB
      // ----------------------------------------------------------------------
      const title = inventory.title || inventory.inventoryId;

      if (outItems.length > 0) {
        await tx.mouvement.create({
          data: {
            mouvementStatus: true, // OUT
            createdByUserId: finalizerId || null,
            inventoryId: inventory.inventoryId,
            origin: false,
            reason: `Régularisation inventaire (Sortie / Déficit) - ${title}`,
            happenedAt: new Date(),
            items: {
              createMany: {
                data: outItems,
              },
            },
          },
        });
      }

      if (inItems.length > 0) {
        await tx.mouvement.create({
          data: {
            mouvementStatus: false, // IN
            createdByUserId: finalizerId || null,
            inventoryId: inventory.inventoryId,
            origin: false,
            reason: `Régularisation inventaire (Entrée / Surplus) - ${title}`,
            happenedAt: new Date(),
            items: {
              createMany: {
                data: inItems,
              },
            },
          },
        });
      }

      affectedEquipmentIds = Array.from(
        new Set([
          ...inItems.map((i) => i.equipmentId),
          ...outItems.map((i) => i.equipmentId),
        ]),
      );

      // ----------------------------------------------------------------------
      // 6. Update inventory status to FINALIZED & link root validatedInventoryId
      // ----------------------------------------------------------------------
      const updated = await tx.inventory.update({
        where: { inventoryId },
        data: {
          status: 'FINALIZED',
          finalizedAt: new Date(),
          adjustmentApproverId: finalizerId || null,
        },
      });

      const rootId = inventory.rootInventoryId ?? inventoryId;
      await tx.inventory.update({
        where: { inventoryId: rootId },
        data: {
          validatedInventoryId: inventoryId,
        },
      });

      this.logger.log(
        `Inventory ${inventoryId} finalized successfully with ${inItems.length + outItems.length} adjustment items.`,
      );

      return updated;
    });

    if (affectedEquipmentIds.length > 0) {
      await this.notificationsService
        .checkAndSendLowStockAlerts(affectedEquipmentIds)
        .catch((err) => {
          this.logger.error('Failed to trigger low stock alerts', err);
        });
    }

    return result;
  }

  // --------------------------------------------------------------------------
  // Deletion & Cancellation
  // --------------------------------------------------------------------------

  async deleteInventory(inventoryId: string) {
    const existing = await this.prisma.inventory.findFirst({
      where: { inventoryId },
    });

    if (!existing) {
      throw new NotFoundException('Inventaire introuvable');
    }

    if (existing.status === 'FINALIZED') {
      throw new BadRequestException('Impossible de supprimer un inventaire déjà finalisé.');
    }

    const movementsCount = await this.prisma.mouvement.count({
      where: { inventoryId: existing.inventoryId },
    });

    if (movementsCount > 0) {
      throw new BadRequestException(
        'Impossible de supprimer un inventaire avec des mouvements de stock enregistrés.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.inventoryIssue.deleteMany({
        where: { inventoryId: existing.inventoryId },
      });

      await tx.inventoryCount.deleteMany({
        where: {
          inventoryController: { inventoryId: existing.inventoryId },
        },
      });

      await tx.inventoryUnit.deleteMany({
        where: { inventoryId: existing.inventoryId },
      });

      await tx.inventoryController.deleteMany({
        where: { inventoryId: existing.inventoryId },
      });

      return tx.inventory.delete({
        where: { inventoryId: existing.inventoryId },
      });
    });
  }

  async cancelInventory(inventoryId: string, reason?: string) {
    return this.prisma.$transaction(async (tx) => {
      const inventory = await tx.inventory.findUnique({
        where: { inventoryId },
      });
      if (!inventory) {
        throw new NotFoundException('Inventaire introuvable');
      }
      if (inventory.status === 'FINALIZED') {
        throw new BadRequestException('Un inventaire déjà finalisé ne peut pas être annulé.');
      }

      const updated = await tx.inventory.update({
        where: { inventoryId },
        data: {
          status: 'CANCELLED',
          cancellationReason: reason ?? 'Annulation manuelle autorisée',
        },
      });

      return {
        success: true,
        message: 'Inventaire annulé avec succès.',
        inventory: updated,
      };
    });
  }

  async getInventoryRounds(inventoryId: string) {
    const inv = await this.prisma.inventory.findUnique({
      where: { inventoryId },
      select: { rootInventoryId: true, inventoryId: true },
    });
    if (!inv) throw new NotFoundException('Inventaire introuvable');

    const rootId = inv.rootInventoryId ?? inv.inventoryId;
    const rounds = await this.prisma.inventory.findMany({
      where: {
        OR: [{ rootInventoryId: rootId }, { inventoryId: rootId }],
      },
      include: {
        controllers: {
          include: {
            user: { select: { userId: true, userName: true, userEmail: true } },
          },
          orderBy: { round: 'asc' },
        },
        _count: {
          select: { units: true, issues: true },
        },
      },
      orderBy: { roundNumber: 'asc' },
    });

    return rounds.map((r) => ({
      inventoryId: r.inventoryId,
      roundNumber: r.roundNumber,
      title: r.title,
      status: r.status,
      launchedAt: r.launchedAt,
      finalizedAt: r.finalizedAt,
      parentInventoryId: r.parentInventoryId,
      rootInventoryId: r.rootInventoryId,
      unitsCount: r._count.units,
      issuesCount: r._count.issues,
      controllers: r.controllers.map((c) => ({
        controllerId: c.inventoryControllerId,
        userId: c.userId,
        round: c.round,
        user: c.user,
      })),
    }));
  }

  // --------------------------------------------------------------------------
  // Adjudication & Manual Third User Assignment (Disabled for Unanimity)
  // --------------------------------------------------------------------------

  async getAdjudicationUnit(unitId: string) {
    const unit = await this.prisma.inventoryUnit.findUnique({
      where: { unitId },
      include: {
        inventory: true,
        counts: {
          include: {
            inventoryController: {
              include: {
                user: true,
              },
            },
          },
        },
        equipment: true,
        shelf: true,
      },
    });

    if (!unit) {
      throw new NotFoundException('Unité introuvable');
    }

    return {
      ...unit,
      attempts: unit.counts.map((cnt) => ({
        attemptId: cnt.countId,
        unitId: cnt.unitId,
        assignedUserId: cnt.inventoryController.userId,
        sequence: (cnt.inventoryController.round ?? 1) - 1,
        status: cnt.submittedAt ? 'SUBMITTED' : 'IN_PROGRESS',
        submittedAt: cnt.submittedAt,
        draftData: cnt.resultData,
        assignedUser: cnt.inventoryController.user,
        orders: extractObservations(cnt.resultData),
      })),
    };
  }

  async manualAdjudicate(
    _unitId: string,
    _adjudicatorId: string,
    _data: AdjudicateDTO,
  ) {
    throw new BadRequestException(
      "L'adjudication manuelle est désactivée. Le nouveau processus requiert un recomptage complet et unanime des contrôleurs.",
    );
  }

  async assignThirdUser(
    _inventoryId: string,
    _unitId: string,
    _thirdUserId: string,
    _currentUserId: string,
    _notes?: string,
  ) {
    throw new BadRequestException(
      "L'assignation manuelle d'un contrôleur individuel est désactivée. Veuillez modifier le roster en statut DRAFT avant lancement.",
    );
  }

  async assignThirdUserToAll(
    _inventoryId: string,
    _thirdUserId: string,
    _currentUserId: string,
    _notes?: string,
  ) {
    throw new BadRequestException(
      "L'assignation manuelle d'un contrôleur est désactivée. Veuillez modifier le roster en statut DRAFT.",
    );
  }

  async autoCompleteCounts(
    _inventoryId: string,
    _currentUserId: string,
  ) {
    throw new BadRequestException("L'auto-complétion est désactivée.");
  }

  async notifyPendingControllerForUnit(
    inventoryId: string,
    unitId: string,
    _senderUserId?: string,
  ) {
    const count = await this.prisma.inventoryCount.findFirst({
      where: {
        unitId,
        unit: {
          inventoryId,
        },
        submittedAt: null,
      },
      include: {
        inventoryController: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    if (!count) {
      throw new NotFoundException('Aucune tâche en attente pour cette unité.');
    }

    await this.prisma.notification.create({
      data: {
        recipientId: count.inventoryController.userId,
        eventType: 'INVENTORY_TASK_REMINDER',
        payload: JSON.stringify({
          inventoryId,
          unitId,
          taskId: count.countId,
        }),
      },
    });

    return {
      success: true,
      message: 'Notification envoyée',
    };
  }

  async notifyAllPendingControllers(
    inventoryId: string,
    _senderUserId?: string,
  ) {
    const counts = await this.prisma.inventoryCount.findMany({
      where: {
        unit: {
          inventoryId,
        },
        submittedAt: null,
      },
      include: {
        inventoryController: true,
      },
    });

    for (const count of counts) {
      await this.prisma.notification.create({
        data: {
          recipientId: count.inventoryController.userId,
          eventType: 'INVENTORY_TASK_REMINDER',
          payload: JSON.stringify({
            inventoryId,
            unitId: count.unitId,
            taskId: count.countId,
          }),
        },
      });
    }

    return {
      success: true,
      notified: counts.length,
    };
  }
}
