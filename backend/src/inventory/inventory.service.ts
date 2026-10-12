import {
  BadRequestException,
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
} from './dto/index.js';

type AttemptPurpose = 'PRIMARY_1' | 'PRIMARY_2' | 'FINAL_RECOUNT';

type UnitReconciliationStatus =
  | 'PENDING'
  | 'PRIMARY_MATCH'
  | 'THIRD_REQUIRED'
  | 'THIRD_RESOLVED';

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
          `Utilisateur(s) introuvable(s): ${missing.join(', ')}`,
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
  // Launch inventory
  // --------------------------------------------------------------------------

  async launchInventory(inventoryId: string) {
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
        throw new BadRequestException("Le périmètre de l'inventaire est vide.");
      }

      await tx.inventoryUnit.updateMany({
        where: { inventoryId },
        data: { status: 'COUNTING' },
      });

      const c1 = controllers.find((c) => c.round === 1)!;
      const c2 = controllers.find((c) => c.round === 2)!;

      // Assign initial counts only to C1 and C2.
      // C3 (third controller) is ONLY called when C1 and C2 have divergent results!
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
            message: 'Les tâches de comptage sont disponibles.',
          }),
        },
      });

      return {
        success: true,
        inventoryId,
        totalUnits: units.length,
      };
    });
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
  // Core Reconciliation: C1 vs C2 -> If diff, call C3
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

      const submittedAt = new Date();
      const resultData = JSON.stringify(data);

      await tx.inventoryCount.update({
        where: { countId: attemptId },
        data: {
          submittedAt,
          resultData,
        },
      });

      const currentRound = count.inventoryController.round;
      const unitId = count.unitId;
      const inventoryId = count.unit.inventoryId;

      // ----------------------------------------------------------------------
      // CASE 1: Round 3 (Controller 3 - Recount / Arbitration)
      // ----------------------------------------------------------------------
      if (currentRound === 3) {
        await tx.inventoryUnit.update({
          where: { unitId },
          data: {
            status: 'COMPLETED',
            reconciliationStatus: 'THIRD_RESOLVED',
            acceptedCountId: count.countId,
            reconciledAt: submittedAt,
          },
        });
      } else {
        // --------------------------------------------------------------------
        // CASE 2: Round 1 or 2 (C1 or C2)
        // Check if the other primary counter has already submitted!
        // --------------------------------------------------------------------
        const otherRound = currentRound === 1 ? 2 : 1;
        const otherCount = await tx.inventoryCount.findFirst({
          where: {
            unitId,
            inventoryController: {
              inventoryId,
              round: otherRound,
            },
          },
          include: {
            inventoryController: true,
          },
        });

        if (otherCount && otherCount.submittedAt) {
          // BOTH C1 AND C2 HAVE SUBMITTED THEIR COUNTS FOR THIS UNIT!
          const c1Data = currentRound === 1 ? resultData : otherCount.resultData;
          const c2Data = currentRound === 2 ? resultData : otherCount.resultData;

          const isMatch = areCountsIdentical(c1Data, c2Data);

          if (isMatch) {
            // C1 and C2 agree! Primary match accepted directly.
            await tx.inventoryUnit.update({
              where: { unitId },
              data: {
                status: 'COMPLETED',
                reconciliationStatus: 'PRIMARY_MATCH',
                acceptedCountId: count.countId,
                reconciledAt: submittedAt,
              },
            });
          } else {
            // ----------------------------------------------------------------
            // C1 AND C2 DIFFER! CALL TO THE THIRD CONTROLLER (C3)!
            // ----------------------------------------------------------------
            await tx.inventoryUnit.update({
              where: { unitId },
              data: {
                status: 'COUNTING',
                reconciliationStatus: 'THIRD_REQUIRED',
                acceptedCountId: null,
                reconciledAt: null,
              },
            });

            // Find Controller 3 (round 3) for this inventory:
            const c3Controller = await tx.inventoryController.findFirst({
              where: {
                inventoryId,
                round: 3,
              },
            });

            if (c3Controller) {
              // Create C3 count task if not already created
              const existingC3 = await tx.inventoryCount.findFirst({
                where: {
                  unitId,
                  inventoryControllerId: c3Controller.inventoryControllerId,
                },
              });

              let c3CountId = existingC3?.countId;

              if (!existingC3) {
                const newC3 = await tx.inventoryCount.create({
                  data: {
                    unitId,
                    inventoryControllerId: c3Controller.inventoryControllerId,
                  },
                });
                c3CountId = newC3.countId;
              }

              // Send Notification to C3
              await tx.notification.create({
                data: {
                  recipientId: c3Controller.userId,
                  eventType: 'THIRD_COUNT_REQUIRED',
                  payload: JSON.stringify({
                    inventoryId,
                    unitId,
                    taskId: c3CountId,
                    title: count.unit.inventory.title,
                    message: `Divergence constatée entre Contrôleur 1 et Contrôleur 2. Votre arbitrage (3ème comptage) est requis sur cette unité.`,
                  }),
                },
              });
            }
          }
        }
      }

      // Check if all units in inventory are resolved:
      const allUnits = await tx.inventoryUnit.findMany({
        where: { inventoryId },
        select: { reconciliationStatus: true },
      });

      const allResolved =
        allUnits.length > 0 &&
        allUnits.every(
          (u) =>
            u.reconciliationStatus === 'PRIMARY_MATCH' ||
            u.reconciliationStatus === 'THIRD_RESOLVED',
        );

      if (allResolved) {
        await tx.inventory.update({
          where: { inventoryId },
          data: {
            status: 'COMPLETED',
          },
        });
      }

      return {
        success: true,
        message: 'Comptage soumis avec succès.',
      };
    });
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
        },
      },
    });

    if (!inventory) {
      throw new NotFoundException('Inventaire introuvable');
    }

    const controllers = inventory.controllers ?? [];
    const units = inventory.units ?? [];
    const totalUnits = units.length;

    const c1Completed = units.filter((unit) =>
      unit.counts?.some(
        (cnt) => cnt.inventoryController?.round === 1 && cnt.submittedAt,
      ),
    ).length;

    const c2Completed = units.filter((unit) =>
      unit.counts?.some(
        (cnt) => cnt.inventoryController?.round === 2 && cnt.submittedAt,
      ),
    ).length;

    const c3Required = units.filter((unit) =>
      ['THIRD_REQUIRED', 'THIRD_RESOLVED'].includes(unit.reconciliationStatus),
    ).length;

    const c3Completed = units.filter((unit) =>
      unit.counts?.some(
        (cnt) => cnt.inventoryController?.round === 3 && cnt.submittedAt,
      ),
    ).length;

    const reconciledUnits = units.filter((unit) =>
      ['PRIMARY_MATCH', 'THIRD_RESOLVED'].includes(unit.reconciliationStatus),
    ).length;

    const c1 = controllers.find((c) => c.round === 1);
    const c2 = controllers.find((c) => c.round === 2);
    const c3 = controllers.find((c) => c.round === 3);

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
      workUnits: units.map((unit, index) => {
        const c1Count = unit.counts?.find(
          (c) => c.inventoryController?.round === 1,
        );
        const c2Count = unit.counts?.find(
          (c) => c.inventoryController?.round === 2,
        );
        const c3Count = unit.counts?.find(
          (c) => c.inventoryController?.round === 3,
        );

        return {
          unitId: unit.unitId,
          unitOrder: index,
          equipmentId: unit.equipmentId,
          shelfId: unit.shelfId,
          status: unit.status,
          reconciliationStatus: unit.reconciliationStatus,
          acceptedAttemptId: unit.acceptedCountId,
          reconciledAt: unit.reconciledAt,
          c1Status: c1Count?.submittedAt
            ? 'SUBMITTED'
            : c1Count
              ? 'IN_PROGRESS'
              : inventory.status === 'IN_PROGRESS'
                ? 'AVAILABLE'
                : 'BLOCKED',
          c2Status: c2Count?.submittedAt
            ? 'SUBMITTED'
            : c2Count
              ? 'IN_PROGRESS'
              : 'BLOCKED',
          c3Status: c3Count?.submittedAt
            ? 'SUBMITTED'
            : c3Count
              ? 'IN_PROGRESS'
              : unit.reconciliationStatus === 'THIRD_REQUIRED'
                ? 'AVAILABLE'
                : 'NOT_REQUIRED',
        };
      }),
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
          orderBy: { unitId: 'asc' },
        },
      },
    });

    if (!inventory) {
      throw new NotFoundException('Inventaire introuvable');
    }

    const units = (inventory.units ?? []).map((unit, index) => {
      const counts = unit.counts ?? [];
      const c1Count = counts.find((c) => c.inventoryController?.round === 1);
      const c2Count = counts.find((c) => c.inventoryController?.round === 2);
      const c3Count = counts.find((c) => c.inventoryController?.round === 3);
      const acceptedCount = unit.acceptedCount;

      const c1Obs = extractObservations(c1Count?.resultData);
      const c2Obs = extractObservations(c2Count?.resultData);
      const c3Obs = extractObservations(c3Count?.resultData);
      const accObs = extractObservations(acceptedCount?.resultData);

      const allKeys = new Set<string>();
      const addKeys = (obsList: any[]) => {
        for (const o of obsList) {
          const s = (o.scannedSerialCode || o.serialNumberCode || '').toString().trim();
          const eq = (o.observedEquipmentId || o.equipmentId || '').toString().trim();
          const sh = (o.observedShelfId || o.shelfId || '').toString().trim();
          if (s) allKeys.add(`SER|${s.toLowerCase()}|${sh.toLowerCase()}`);
          else if (eq || sh) allKeys.add(`STD|${eq.toLowerCase()}|${sh.toLowerCase()}`);
        }
      };

      addKeys(c1Obs);
      addKeys(c2Obs);
      addKeys(c3Obs);
      addKeys(accObs);

      const rows = Array.from(allKeys).map((key) => {
        const isSer = key.startsWith('SER|');
        const parts = key.split('|');
        const serialCode = isSer ? parts[1] : null;

        const findQty = (obsList: any[]) => {
          if (isSer) {
            return obsList.some(
              (o) =>
                (o.scannedSerialCode || o.serialNumberCode || '').toString().trim().toLowerCase() ===
                serialCode,
            )
              ? 1
              : 0;
          }
          const eqId = parts[1];
          const shId = parts[2];
          return obsList
            .filter(
              (o) =>
                (o.observedEquipmentId || o.equipmentId || '').toString().trim().toLowerCase() ===
                  eqId &&
                (o.observedShelfId || o.shelfId || '').toString().trim().toLowerCase() === shId,
            )
            .reduce((sum, o) => sum + Number(o.quantityCalculated ?? 0), 0);
        };

        const q1 = c1Count?.submittedAt ? findQty(c1Obs) : null;
        const q2 = c2Count?.submittedAt ? findQty(c2Obs) : null;
        const q3 = c3Count?.submittedAt ? findQty(c3Obs) : null;
        const qAcc = acceptedCount?.submittedAt ? findQty(accObs) : null;

        return {
          key,
          kind: isSer ? 'SERIALIZED' : 'STANDARD',
          equipmentId: unit.equipmentId,
          equipmentName: unit.equipment?.equipmentName ?? null,
          shelfId: unit.shelfId,
          shelfName: unit.shelf?.shelfName ?? null,
          serialNumberCode: serialCode,
          controller1: q1 !== null ? { quantity: q1, serialNumberCode: serialCode } : null,
          controller2: q2 !== null ? { quantity: q2, serialNumberCode: serialCode } : null,
          controller3: q3 !== null ? { quantity: q3, serialNumberCode: serialCode } : null,
          accepted: qAcc !== null ? { quantity: qAcc, serialNumberCode: serialCode } : null,
          controller1VsAccepted: {
            status: q1 === qAcc ? 'CONFORME' : 'DIVERGENT',
            delta: q1 !== null && qAcc !== null ? q1 - qAcc : null,
          },
          controller2VsAccepted: {
            status: q2 === qAcc ? 'CONFORME' : 'DIVERGENT',
            delta: q2 !== null && qAcc !== null ? q2 - qAcc : null,
          },
        };
      });

      return {
        unitId: unit.unitId,
        unitOrder: index,
        equipmentId: unit.equipmentId,
        shelfId: unit.shelfId,
        status: unit.status,
        reconciliationStatus: unit.reconciliationStatus,
        acceptedAttemptId: unit.acceptedCountId,
        acceptedPurpose: unit.acceptedCountId
          ? unit.acceptedCountId === c3Count?.countId
            ? 'FINAL_RECOUNT'
            : unit.acceptedCountId === c2Count?.countId
              ? 'PRIMARY_2'
              : 'PRIMARY_1'
          : null,
        attempts: {
          controller1: c1Count
            ? {
                attemptId: c1Count.countId,
                user: c1Count.inventoryController.user,
                submittedAt: c1Count.submittedAt,
              }
            : null,
          controller2: c2Count
            ? {
                attemptId: c2Count.countId,
                user: c2Count.inventoryController.user,
                submittedAt: c2Count.submittedAt,
              }
            : null,
          controller3: c3Count
            ? {
                attemptId: c3Count.countId,
                user: c3Count.inventoryController.user,
                submittedAt: c3Count.submittedAt,
              }
            : null,
        },
        rows,
      };
    });

    const summary = {
      totalUnits: units.length,
      primaryMatchedUnits: units.filter(
        (u) => u.reconciliationStatus === 'PRIMARY_MATCH',
      ).length,
      thirdRequiredUnits: units.filter(
        (u) => u.reconciliationStatus === 'THIRD_REQUIRED',
      ).length,
      thirdResolvedUnits: units.filter(
        (u) => u.reconciliationStatus === 'THIRD_RESOLVED',
      ).length,
    };

    return {
      inventoryId: inventory.inventoryId,
      title: inventory.title,
      status: inventory.status,
      typeInventory: inventory.typeInventory,
      units,
      summary,
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

      const unresolved = inventory.units.filter(
        (unit) =>
          !['PRIMARY_MATCH', 'THIRD_RESOLVED'].includes(
            unit.reconciliationStatus,
          ) || !unit.acceptedCountId,
      );

      if (unresolved.length > 0) {
        throw new BadRequestException(
          'Toutes les unités doivent être réconciliées avant la finalisation.',
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

      // B. Serialized items
      const allSerialCodes = new Set([
        ...theoreticalSerials.keys(),
        ...countedSerials.keys(),
      ]);

      for (const code of allSerialCodes) {
        const th = theoreticalSerials.get(code);
        const cnt = countedSerials.get(code);

        if (th && cnt) {
          if (th.shelfId.toLowerCase() !== cnt.shelfId.toLowerCase()) {
            // Relocation / Transfer
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
          // Newly found in stock
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
          // Missing from shelf
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
      // 5. Create Mouvements in DB
      // ----------------------------------------------------------------------
      const title = inventory.title || inventory.inventoryId;

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

      affectedEquipmentIds = Array.from(
        new Set([
          ...inItems.map((i) => i.equipmentId),
          ...outItems.map((i) => i.equipmentId),
        ]),
      );

      // ----------------------------------------------------------------------
      // 6. Update inventory status to FINALIZED
      // ----------------------------------------------------------------------
      const updated = await tx.inventory.update({
        where: { inventoryId },
        data: {
          status: 'FINALIZED',
          finalizedAt: new Date(),
          adjustmentApproverId: finalizerId || null,
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
  // Deletion
  // --------------------------------------------------------------------------

  async deleteInventory(inventoryId: string) {
    const existing = await this.prisma.inventory.findFirst({
      where: { inventoryId },
    });

    if (!existing) {
      throw new NotFoundException('Inventaire introuvable');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.movementEquipment.deleteMany({
        where: { movement: { inventoryId: existing.inventoryId } },
      });

      await tx.mouvement.deleteMany({
        where: { inventoryId: existing.inventoryId },
      });

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
  }

  // --------------------------------------------------------------------------
  // Adjudication & Manual Third User Assignment (Legacy/Admin routes)
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
        purpose:
          cnt.inventoryController.round === 1
            ? 'PRIMARY_1'
            : cnt.inventoryController.round === 2
              ? 'PRIMARY_2'
              : 'FINAL_RECOUNT',
        status: cnt.submittedAt ? 'SUBMITTED' : 'IN_PROGRESS',
        submittedAt: cnt.submittedAt,
        draftData: cnt.resultData,
        assignedUser: cnt.inventoryController.user,
        orders: extractObservations(cnt.resultData),
      })),
    };
  }

  async manualAdjudicate(
    unitId: string,
    _adjudicatorId: string,
    data: AdjudicateDTO,
  ) {
    const unit = await this.prisma.inventoryUnit.findUnique({
      where: { unitId },
      include: {
        counts: true,
      },
    });

    if (!unit) {
      throw new NotFoundException('Unité introuvable');
    }

    const targetCountId = data.selectedAttemptId ?? data.selectedCountId;
    const acceptedCount =
      (targetCountId ? unit.counts.find((c) => c.countId === targetCountId) : null) ??
      unit.counts[0];

    await this.prisma.inventoryUnit.update({
      where: { unitId },
      data: {
        status: 'COMPLETED',
        reconciliationStatus: 'THIRD_RESOLVED',
        acceptedCountId: acceptedCount?.countId ?? null,
        reconciledAt: new Date(),
      },
    });

    return {
      success: true,
      message: 'Adjudication effectuée avec succès.',
    };
  }

  async assignThirdUser(
    inventoryId: string,
    unitId: string,
    thirdUserId: string,
    _currentUserId: string,
    _notes?: string,
  ) {
    let c3 = await this.prisma.inventoryController.findFirst({
      where: { inventoryId, round: 3 },
    });

    if (c3) {
      await this.prisma.inventoryController.update({
        where: { inventoryControllerId: c3.inventoryControllerId },
        data: { userId: thirdUserId },
      });
    } else {
      c3 = await this.prisma.inventoryController.create({
        data: {
          inventoryId,
          userId: thirdUserId,
          round: 3,
        },
      });
    }

    const existingCount = await this.prisma.inventoryCount.findFirst({
      where: { unitId, inventoryControllerId: c3.inventoryControllerId },
    });

    if (!existingCount) {
      await this.prisma.inventoryCount.create({
        data: {
          unitId,
          inventoryControllerId: c3.inventoryControllerId,
        },
      });
    }

    await this.prisma.inventoryUnit.update({
      where: { unitId },
      data: {
        reconciliationStatus: 'THIRD_REQUIRED',
        status: 'COUNTING',
      },
    });

    return {
      success: true,
      message: 'Troisième contrôleur assigné avec succès.',
    };
  }

  async assignThirdUserToAll(
    inventoryId: string,
    thirdUserId: string,
    currentUserId: string,
    notes?: string,
  ) {
    const units = await this.prisma.inventoryUnit.findMany({
      where: { inventoryId },
    });

    for (const unit of units) {
      await this.assignThirdUser(
        inventoryId,
        unit.unitId,
        thirdUserId,
        currentUserId,
        notes,
      );
    }

    return {
      success: true,
      message: 'Troisième contrôleur assigné à toutes les unités.',
    };
  }

  async autoCompleteCounts(
    inventoryId: string,
    _currentUserId: string,
  ) {
    return {
      success: true,
      message: 'Auto-complete bypass route',
    };
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
