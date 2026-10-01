import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';

import {
  type AdjudicateDTO,
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

type AttemptPurpose =
  | 'PRIMARY_1'
  | 'PRIMARY_2'
  | 'FINAL_RECOUNT';

type UnitReconciliationStatus =
  | 'PENDING'
  | 'PRIMARY_MATCH'
  | 'THIRD_REQUIRED'
  | 'THIRD_RESOLVED';

type CanonicalStandardValue = {
  equipmentId: string;
  shelfId: string;
  quantity: number;
};

type CanonicalSerialValue = {
  serialCode: string;
  serialNumberId: string | null;
  equipmentId: string;
  shelfId: string | null;
};

type CanonicalAttempt = {
  standard: Map<string, CanonicalStandardValue>;
  serials: Map<string, CanonicalSerialValue>;
  unknown: Set<string>;
};

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

const RECONCILED_STATUSES: UnitReconciliationStatus[] = [
  'PRIMARY_MATCH',
  'THIRD_RESOLVED',
];

const NON_LOCKING_INVENTORY_STATUSES = [
  'DRAFT',
  'FINALIZED',
  'CANCELLED',
] as const;

const SQL_INT_MAX = 2_147_483_647;

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
    const { page, limit } = paginationSchema.parse(
      pagination ?? {},
    );

    const skip = (page - 1) * limit;

    const where: Prisma.InventoryWhereInput =
      filterUserId
        ? {
            Inventory_User: {
              some: {
                userId: filterUserId,
              },
            },
          }
        : {};

    const [inventories, totalInventories] =
      await Promise.all([
        this.prisma.inventory.findMany({
          where,
          skip,
          take: limit,
          orderBy: [
            { createdAt: 'desc' },
            { inventoryId: 'desc' },
          ],
          include: {
            Inventory_User: {
              include: {
                User: {
                  select: {
                    userId: true,
                    userName: true,
                    userEmail: true,
                  },
                },
              },
              orderBy: { sequence: 'asc' },
            },
            workUnits: {
              select: {
                unitId: true,
                unitOrder: true,
                status: true,
                equipmentId: true,
                shelfId: true,
                reconciliationStatus: true,
                acceptedAttemptId: true,
                reconciledAt: true,
              },
              orderBy: { unitOrder: 'asc' },
            },
            _count: {
              select: {
                investigationIssues: true,
              },
            },
          },
        }),
        this.prisma.inventory.count({ where }),
      ]);

    return {
      inventories,
      totalInventories,
      totalPages:
        Math.ceil(totalInventories / limit) || 1,
      currentPage: page,
      limit,
    };
  }

  async getInventoryById(
    inventoryId: string,
  ) {
    const inventory =
      await this.prisma.inventory.findUnique({
        where: { inventoryId },
        include: {
          Inventory_User: {
            include: {
              User: {
                select: {
                  userId: true,
                  userName: true,
                  userEmail: true,
                },
              },
            },
            orderBy: { sequence: 'asc' },
          },
          workUnits: {
            include: {
              acceptedAttempt: {
                select: {
                  attemptId: true,
                  sequence: true,
                  purpose: true,
                  status: true,
                  submittedAt: true,
                  assignedUserId: true,
                },
              },
              attempts: {
                include: {
                  assignedUser: {
                    select: {
                      userId: true,
                      userName: true,
                      userEmail: true,
                    },
                  },
                },
                orderBy: { sequence: 'asc' },
              },
            },
            orderBy: { unitOrder: 'asc' },
          },
          investigationIssues: {
            include: {
              equipment: {
                select: {
                  equipmentId: true,
                  equipmentName: true,
                },
              },
              serialNumber: {
                select: {
                  serialNumberId: true,
                  serialNumberCode: true,
                },
              },
              expectedShelf: {
                select: {
                  shelfId: true,
                  shelfName: true,
                },
              },
              finalObservedShelf: {
                select: {
                  shelfId: true,
                  shelfName: true,
                },
              },
              resolutionShelf: {
                select: {
                  shelfId: true,
                  shelfName: true,
                },
              },
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

    return inventory;
  }

  async createInventory(
    dto: CreateInventoryDTO,
    creatorId: string,
  ) {
    const data = createInventorySchema.parse(dto);
    const policyVersion = data.policyVersion ?? 3;
    const users = data.users;

    if (
      policyVersion >= 2 &&
      users.length !== 3
    ) {
      throw new BadRequestException(
        "L'inventaire courant requiert exactement trois contrôleurs distincts.",
      );
    }

    const equipmentIds = [
      ...new Set(
        (data.equipmentIds ?? []).map((id) =>
          id.trim(),
        ),
      ),
    ];

    const shelfIds = [
      ...new Set(
        (data.shelfIds ?? []).map((id) =>
          id.trim(),
        ),
      ),
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

      if (
        userRecords.length !== users.length
      ) {
        const found = new Set(
          userRecords.map((user) => user.userId),
        );

        const missing = users
          .map((item) => item.userId)
          .filter((id) => !found.has(id));

        throw new NotFoundException(
          `Utilisateur(s) introuvable(s): ${missing.join(', ')}`,
        );
      }

      if (
        data.typeInventory === 'ByEquipment'
      ) {
        const equipmentCount =
          await tx.equipment.count({
            where: {
              equipmentId: {
                in: equipmentIds,
              },
            },
          });

        if (
          equipmentCount !== equipmentIds.length
        ) {
          throw new NotFoundException(
            'Un ou plusieurs articles du périmètre sont introuvables.',
          );
        }
      }

      if (
        data.typeInventory === 'ByShelf'
      ) {
        const shelfCount =
          await tx.shelf.count({
            where: {
              shelfId: {
                in: shelfIds,
              },
            },
          });

        if (
          shelfCount !== shelfIds.length
        ) {
          throw new NotFoundException(
            'Un ou plusieurs emplacements du périmètre sont introuvables.',
          );
        }
      }

      const inventory =
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

      return inventory;
    });
  }

  // --------------------------------------------------------------------------
  // Shared movement / inventory race locks
  // --------------------------------------------------------------------------

  private async acquireResourceLocks(
    tx: Prisma.TransactionClient,
    equipmentIds: string[],
    shelfIds: string[],
    serialIds: string[] = [],
  ) {
    const resources = [
      ...equipmentIds.map(
        (id) =>
          `SOMIPHARM:EQUIPMENT:${id.toLowerCase()}`,
      ),
      ...shelfIds.map(
        (id) =>
          `SOMIPHARM:SHELF:${id.toLowerCase()}`,
      ),
      ...serialIds.map(
        (id) =>
          `SOMIPHARM:SERIAL:${id.toLowerCase()}`,
      ),
    ]
      .filter(
        (value, index, array) =>
          array.indexOf(value) === index,
      )
      .sort();

    for (const resource of resources) {
      const result = await tx.$queryRaw<
        Array<{ lockResult: number }>
      >`
        DECLARE @lockResult int;

        EXEC @lockResult =
          sys.sp_getapplock
            @Resource = ${resource},
            @LockMode = 'Exclusive',
            @LockOwner = 'Transaction',
            @LockTimeout = 10000;

        SELECT @lockResult AS lockResult;
      `;

      const lockResult = Number(
        result[0]?.lockResult,
      );

      if (
        !Number.isFinite(lockResult) ||
        lockResult < 0
      ) {
        throw new BadRequestException(
          'Une ressource de stock est occupée par une autre opération. Actualisez puis réessayez.',
        );
      }
    }
  }

  private async assertNoOtherActiveInventory(
    tx: Prisma.TransactionClient,
    inventoryId: string,
    equipmentIds: string[],
    shelfIds: string[],
  ) {
    const scope:
      Prisma.InventoryWorkUnitWhereInput[] = [];

    if (equipmentIds.length) {
      scope.push({
        equipmentId: {
          in: equipmentIds,
        },
      });
    }

    if (shelfIds.length) {
      scope.push({
        shelfId: {
          in: shelfIds,
        },
      });
    }

    if (!scope.length) {
      return;
    }

    const conflict =
      await tx.inventoryWorkUnit.findFirst({
        where: {
          OR: scope,
          inventory: {
            inventoryId: {
              not: inventoryId,
            },
            status: {
              notIn: [
                ...NON_LOCKING_INVENTORY_STATUSES,
              ],
            },
          },
        },
        select: {
          unitId: true,
          inventory: {
            select: {
              inventoryId: true,
              title: true,
              status: true,
            },
          },
        },
      });

    if (conflict) {
      throw new BadRequestException(
        `Le périmètre est déjà contrôlé par l'inventaire actif '${conflict.inventory.title ?? conflict.inventory.inventoryId}'.`,
      );
    }
  }

  // --------------------------------------------------------------------------
  // Launch
  // --------------------------------------------------------------------------

  async launchInventory(
    inventoryId: string,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const inventory =
          await tx.inventory.findUnique({
            where: { inventoryId },
            include: {
              Inventory_User: {
                orderBy: {
                  sequence: 'asc',
                },
              },
            },
          });

        if (!inventory) {
          throw new NotFoundException(
            'Inventaire introuvable',
          );
        }

        if (
          inventory.status !== 'DRAFT'
        ) {
          throw new BadRequestException(
            'Seul un inventaire au statut DRAFT peut être lancé.',
          );
        }

        const participants =
          inventory.Inventory_User;

        if (
          participants.length !== 3
        ) {
          throw new BadRequestException(
            'Trois contrôleurs distincts doivent être préassignés avant le lancement.',
          );
        }

        const controller1 = participants[0];
        const controller2 = participants[1];

        const equipmentIds =
          this.parseScopeIds(
            inventory.equipmentScopeIds,
          );

        const shelfIds =
          this.parseScopeIds(
            inventory.shelfScopeIds,
          );

        if (
          inventory.typeInventory ===
            'ByEquipment' &&
          !equipmentIds.length
        ) {
          throw new BadRequestException(
            "Le périmètre article de l'inventaire est vide.",
          );
        }

        if (
          inventory.typeInventory ===
            'ByShelf' &&
          !shelfIds.length
        ) {
          throw new BadRequestException(
            "Le périmètre emplacement de l'inventaire est vide.",
          );
        }

        await this.acquireResourceLocks(
          tx,
          equipmentIds,
          shelfIds,
        );

        await this.assertNoOtherActiveInventory(
          tx,
          inventoryId,
          equipmentIds,
          shelfIds,
        );

        const workUnits: Array<{
          unitId: string;
          unitOrder: number;
          equipmentId: string | null;
          shelfId: string | null;
        }> = [];

        if (
          inventory.typeInventory ===
          'ByEquipment'
        ) {
          const equipmentRows =
            await tx.equipment.findMany({
              where: {
                equipmentId: {
                  in: equipmentIds,
                },
              },
              select: {
                equipmentId: true,
              },
            });

          if (
            equipmentRows.length !==
            equipmentIds.length
          ) {
            throw new NotFoundException(
              'Un article du périmètre a été supprimé ou est introuvable.',
            );
          }

          for (
            let index = 0;
            index < equipmentIds.length;
            index += 1
          ) {
            const equipmentId =
              equipmentIds[index];

            const unit =
              await tx.inventoryWorkUnit.create({
                data: {
                  inventoryId,
                  equipmentId,
                  shelfId: null,
                  unitOrder: index,
                  status: 'COUNTING',
                  reconciliationStatus:
                    'PENDING',
                  acceptedAttemptId: null,
                  reconciledAt: null,
                },
                select: {
                  unitId: true,
                  unitOrder: true,
                  equipmentId: true,
                  shelfId: true,
                },
              });

            workUnits.push(unit);

            await this.snapshotEquipmentAtLaunch(
              tx,
              inventoryId,
              equipmentId,
            );
          }
        } else {
          const shelfRows =
            await tx.shelf.findMany({
              where: {
                shelfId: {
                  in: shelfIds,
                },
              },
              select: {
                shelfId: true,
              },
            });

          if (
            shelfRows.length !==
            shelfIds.length
          ) {
            throw new NotFoundException(
              'Un emplacement du périmètre a été supprimé ou est introuvable.',
            );
          }

          for (
            let index = 0;
            index < shelfIds.length;
            index += 1
          ) {
            const shelfId = shelfIds[index];

            const unit =
              await tx.inventoryWorkUnit.create({
                data: {
                  inventoryId,
                  equipmentId: null,
                  shelfId,
                  unitOrder: index,
                  status: 'COUNTING',
                  reconciliationStatus:
                    'PENDING',
                  acceptedAttemptId: null,
                  reconciledAt: null,
                },
                select: {
                  unitId: true,
                  unitOrder: true,
                  equipmentId: true,
                  shelfId: true,
                },
              });

            workUnits.push(unit);

            await this.snapshotShelfAtLaunch(
              tx,
              inventoryId,
              shelfId,
            );
          }
        }

        let firstC1AttemptId:
          string | null = null;

        for (
          let index = 0;
          index < workUnits.length;
          index += 1
        ) {
          const unit = workUnits[index];

          const c1 =
            await tx.inventoryCountAttempt.create({
              data: {
                unitId: unit.unitId,
                assignedUserId:
                  controller1.userId,
                sequence: 0,
                purpose: 'PRIMARY_1',
                status:
                  index === 0
                    ? 'AVAILABLE'
                    : 'BLOCKED',
              },
            });

          if (index === 0) {
            firstC1AttemptId =
              c1.attemptId;
          }

          await tx.inventoryCountAttempt.create({
            data: {
              unitId: unit.unitId,
              assignedUserId:
                controller2.userId,
              sequence: 1,
              purpose: 'PRIMARY_2',
              status: 'BLOCKED',
            },
          });

          // C3 is intentionally NOT created at launch.
        }

        await tx.inventory.update({
          where: { inventoryId },
          data: {
            status: 'IN_PROGRESS',
            launchedAt: new Date(),
            thirdCountRequired: false,
            finalResultSource:
              'PER_UNIT_RECONCILIATION',
          },
        });

        if (firstC1AttemptId) {
          await tx.notification.create({
            data: {
              recipientId:
                controller1.userId,
              eventType:
                'INVENTORY_TASK_AVAILABLE',
              payload: JSON.stringify({
                inventoryId,
                taskId:
                  firstC1AttemptId,
                title:
                  inventory.title,
                unitOrder: 0,
                message:
                  'La première unité de comptage est disponible.',
              }),
            },
          });
        }

        return {
          success: true,
          inventoryId,
          totalUnits:
            workUnits.length,
        };
      },
      {
        isolationLevel: 'Serializable',
        timeout: 30_000,
      },
    );
  }

  private parseScopeIds(
    raw: string | null,
  ): string[] {
    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw);

      if (!Array.isArray(parsed)) {
        return [];
      }

      return [
        ...new Set(
          parsed
            .filter(
              (value) =>
                typeof value === 'string',
            )
            .map((value) => value.trim())
            .filter(Boolean),
        ),
      ];
    } catch {
      throw new BadRequestException(
        "Le périmètre enregistré de l'inventaire est illisible.",
      );
    }
  }

  private async snapshotEquipmentAtLaunch(
    tx: Prisma.TransactionClient,
    inventoryId: string,
    equipmentId: string,
  ) {
    const allocations: any[] = [];

    if (allocations.length) {
      await tx.inventory_Equipment_Shelf_Snapshot.createMany({
        data: allocations.map((row) => ({
          inventoryId,
          equipmentId: row.equipmentId,
          shelfId: row.shelfId,
          phase: 'LIVE_AT_LAUNCH',
          quantity: row.equipmentQuantity,
          provenance:
            'LIVE_EQUIPMENT_SHELFS',
        })),
      });
    }

    const serials =
      await tx.serialNumber.findMany({
        where: { equipmentId },
        select: {
          serialNumberId: true,
          serialNumberCode: true,
          serialNumberStatus: true,
          equipmentId: true,
          shelfId: true,
        },
      });

    if (serials.length) {
      await tx.inventory_SerialNumber_Snapshot.createMany({
        data: serials.map((serial) => ({
          inventoryId,
          equipmentId: serial.equipmentId,
          shelfId: serial.shelfId,
          serialNumberId:
            serial.serialNumberId,
          serialNumberCode:
            serial.serialNumberCode,
          serialNumberStatus:
            serial.serialNumberStatus,
          phase: 'LIVE_AT_LAUNCH',
          provenance:
            'LIVE_SERIAL_NUMBERS',
        })),
      });
    }
  }

  private async snapshotShelfAtLaunch(
    tx: Prisma.TransactionClient,
    inventoryId: string,
    shelfId: string,
  ) {
    const allocations: any[] = [];

    if (allocations.length) {
      await tx.inventory_Equipment_Shelf_Snapshot.createMany({
        data: allocations.map((row) => ({
          inventoryId,
          equipmentId: row.equipmentId,
          shelfId: row.shelfId,
          phase: 'LIVE_AT_LAUNCH',
          quantity: row.equipmentQuantity,
          provenance:
            'LIVE_EQUIPMENT_SHELFS',
        })),
      });
    }

    const serials =
      await tx.serialNumber.findMany({
        where: { shelfId },
        select: {
          serialNumberId: true,
          serialNumberCode: true,
          serialNumberStatus: true,
          equipmentId: true,
          shelfId: true,
        },
      });

    if (serials.length) {
      await tx.inventory_SerialNumber_Snapshot.createMany({
        data: serials.map((serial) => ({
          inventoryId,
          equipmentId: serial.equipmentId,
          shelfId: serial.shelfId,
          serialNumberId:
            serial.serialNumberId,
          serialNumberCode:
            serial.serialNumberCode,
          serialNumberStatus:
            serial.serialNumberStatus,
          phase: 'LIVE_AT_LAUNCH',
          provenance:
            'LIVE_SERIAL_NUMBERS',
        })),
      });
    }
  }


// --------------------------------------------------------------------------
// Tasks
// --------------------------------------------------------------------------

async getMyTasks(
  userId: string,
) {
  return this.prisma.inventoryCountAttempt.findMany({
    where: {
      assignedUserId: userId,
      status: {
        in: [
          'AVAILABLE',
          'IN_PROGRESS',
        ],
      },
      unit: {
        inventory: {
          status: {
            in: [
              'IN_PROGRESS',
            ],
          },
        },
      },
    },
    include: {
      unit: {
        include: {
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
    orderBy: [
      {
        unit: {
          unitOrder: 'asc',
        },
      },
      {
        sequence: 'asc',
      },
    ],
  });
}

async getTask(
  attemptId: string,
  currentUserId?: string,
) {
  const attempt =
    await this.prisma.inventoryCountAttempt.findUnique({
      where: { attemptId },
      include: {
        unit: {
          include: {
            inventory: {
              include: {
                Inventory_User: {
                  include: {
                    User: {
                      select: {
                        userId: true,
                        userName: true,
                        userEmail: true,
                      },
                    },
                  },
                  orderBy: {
                    sequence: 'asc',
                  },
                },
              },
            },
          },
        },
        orders: {
          include: {
            serialNumber: {
              select: {
                serialNumberId: true,
                serialNumberCode: true,
              },
            },
            equipment: {
              select: {
                equipmentId: true,
                equipmentName: true,
                hasSerialNumber: true,
              },
            },
            shelf: {
              select: {
                shelfId: true,
                shelfName: true,
              },
            },
          },
        },
      },
    });

  if (!attempt) {
    throw new NotFoundException(
      'Tâche introuvable',
    );
  }

  if (
    currentUserId &&
    attempt.assignedUserId !== currentUserId
  ) {
    throw new ForbiddenException(
      "Vous n'êtes pas le contrôleur assigné à cette tâche.",
    );
  }

  let scopeLabel = 'Unité de travail';
  let isSerialized = false;
  let expectedEquipments: Array<{
    equipmentId: string;
    equipmentName: string;
    hasSerialNumber: boolean;
    quantity: number;
  }> = [];

  let expectedShelves: Array<{
    shelfId: string;
    shelfName: string;
    quantity: number;
  }> = [];

  if (attempt.unit.equipmentId) {
    const equipment =
      await this.prisma.equipment.findUnique({
        where: {
          equipmentId:
            attempt.unit.equipmentId,
        },
        select: {
          equipmentName: true,
          hasSerialNumber: true,
        },
      });

    scopeLabel =
      equipment?.equipmentName ??
      'Article inconnu';

    isSerialized =
      Boolean(
        equipment?.hasSerialNumber,
      );

    const equipmentShelfs = [] as any[];

    const shelfMap = new Map<string, { shelfId: string; shelfName: string; quantity: number }>();
    for (const es of equipmentShelfs) {
      if (es.shelf && es.shelfId) {
        shelfMap.set(es.shelfId, {
          shelfId: es.shelfId,
          shelfName: es.shelf.shelfName ?? 'Emplacement',
          quantity: es.equipmentQuantity,
        });
      }
    }

    if (isSerialized) {
      const serialShelvesCounts = await this.prisma.serialNumber.groupBy({
        by: ['shelfId'],
        where: {
          equipmentId: attempt.unit.equipmentId,
          shelfId: { not: null },
        },
        _count: {
          _all: true,
        },
      });

      const missingShelfIds = serialShelvesCounts
        .map(g => g.shelfId)
        .filter((id): id is string => Boolean(id) && !shelfMap.has(id as string));

      let missingShelvesMap = new Map<string, string>();
      if (missingShelfIds.length > 0) {
        const missingShelves = await this.prisma.shelf.findMany({
          where: { shelfId: { in: missingShelfIds } },
          select: { shelfId: true, shelfName: true },
        });
        for (const s of missingShelves) {
          missingShelvesMap.set(s.shelfId, s.shelfName ?? 'Emplacement');
        }
      }

      for (const group of serialShelvesCounts) {
        if (!group.shelfId) continue;
        const sId = group.shelfId;
        const count = group._count._all;

        const existing = shelfMap.get(sId);
        if (existing) {
          if (count > 0 && existing.quantity === 0) {
            existing.quantity = count;
          }
        } else {
          shelfMap.set(sId, {
            shelfId: sId,
            shelfName: missingShelvesMap.get(sId) ?? 'Emplacement',
            quantity: count,
          });
        }
      }
    }

    expectedShelves = Array.from(shelfMap.values());
  } else if (attempt.unit.shelfId) {
    const shelf =
      await this.prisma.shelf.findUnique({
        where: {
          shelfId:
            attempt.unit.shelfId,
        },
        select: {
          shelfName: true,
        },
      });

    scopeLabel =
      shelf?.shelfName ??
      'Emplacement inconnu';
  }

  return {
    ...attempt,
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
  const data =
    saveDraftSchema.parse(dto);

  const attempt =
    await this.prisma.inventoryCountAttempt.findUnique({
      where: { attemptId },
    });

  if (!attempt) {
    throw new NotFoundException(
      'Tâche introuvable',
    );
  }

  if (
    attempt.assignedUserId !== userId
  ) {
    throw new ForbiddenException(
      "Vous n'êtes pas le contrôleur assigné à cette tâche.",
    );
  }

  if (
    ![
      'AVAILABLE',
      'IN_PROGRESS',
    ].includes(attempt.status)
  ) {
    throw new BadRequestException(
      `Cette tâche ne peut plus être modifiée (statut: ${attempt.status}).`,
    );
  }

  await this.prisma.inventoryCountAttempt.update({
    where: { attemptId },
    data: {
      status: 'IN_PROGRESS',
      draftData:
        JSON.stringify(data),
    },
  });

  return {
    success: true,
    message:
      'Brouillon enregistré avec succès.',
  };
}

async submitCountAttempt(
  attemptId: string,
  userId: string,
  dto: SubmitTaskDTO,
) {
  const data =
    submitTaskSchema.parse(dto);

  if (data.isDraft) {
    return this.saveDraft(
      attemptId,
      userId,
      data,
    );
  }

  return this.prisma.$transaction(
    async (tx) => {
      const attempt =
        await tx.inventoryCountAttempt.findUnique({
          where: { attemptId },
          include: {
            unit: {
              include: {
                inventory: true,
              },
            },
          },
        });

      if (!attempt) {
        throw new NotFoundException(
          'Tâche introuvable',
        );
      }

      if (
        attempt.assignedUserId !== userId
      ) {
        throw new ForbiddenException(
          "Vous n'êtes pas le contrôleur assigné à cette tâche.",
        );
      }

      if (
        ![
          'AVAILABLE',
          'IN_PROGRESS',
        ].includes(attempt.status)
      ) {
        throw new BadRequestException(
          `Cette tâche ne peut pas être soumise car elle est au statut '${attempt.status}'.`,
        );
      }

      if (
        attempt.unit.inventory.status !==
        'IN_PROGRESS'
      ) {
        throw new BadRequestException(
          "L'inventaire n'est pas en cours.",
        );
      }

      if (
        attempt.purpose ===
          'FINAL_RECOUNT' &&
        attempt.unit.reconciliationStatus !==
          'THIRD_REQUIRED'
      ) {
        throw new BadRequestException(
          "Cette unité ne nécessite pas de troisième comptage.",
        );
      }

      const inventoryId =
        attempt.unit.inventoryId;

      const unitOrder =
        attempt.unit.unitOrder;

      if (
        attempt.purpose ===
          'PRIMARY_1' ||
        attempt.purpose ===
          'PRIMARY_2'
      ) {
        await this.assertPreviousPrimaryUnitSubmitted(
          tx,
          inventoryId,
          attempt.purpose as AttemptPurpose,
          userId,
          unitOrder,
        );
      }

      const orders =
        await this.buildOrdersFromObservations(
          tx,
          attempt,
          userId,
          data.observations,
        );

      await tx.order.deleteMany({
        where: { attemptId },
      });

      for (const order of orders) {
        await tx.order.create({
          data: order,
        });
      }

      await tx.inventoryCountAttempt.update({
        where: { attemptId },
        data: {
          status: 'SUBMITTED',
          submittedAt: new Date(),
          draftData: null,
        },
      });

      if (
        attempt.purpose ===
        'PRIMARY_1'
      ) {
        await this.advancePrimaryOne(
          tx,
          inventoryId,
          unitOrder,
          userId,
        );
      }

      if (
        attempt.purpose ===
        'PRIMARY_2'
      ) {
        // Compare this exact unit immediately.
        await this.reconcileUnit(
          tx,
          attempt.unitId,
        );

        await this.advancePrimaryTwo(
          tx,
          inventoryId,
          unitOrder,
          userId,
        );
      }

      if (
        attempt.purpose ===
        'FINAL_RECOUNT'
      ) {
        await tx.inventoryWorkUnit.update({
          where: {
            unitId:
              attempt.unitId,
          },
          data: {
            status: 'VALIDATED',
            reconciliationStatus:
              'THIRD_RESOLVED',
            acceptedAttemptId:
              attemptId,
            reconciledAt:
              new Date(),
          },
        });
      }

      await this.refreshInventoryCompletion(
        tx,
        inventoryId,
      );

      return {
        success: true,
        attemptId,
        unitOrder,
      };
    },
    {
      isolationLevel: 'Serializable',
      timeout: 30_000,
    },
  );
}

private async assertPreviousPrimaryUnitSubmitted(
  tx: Prisma.TransactionClient,
  inventoryId: string,
  purpose: AttemptPurpose,
  userId: string,
  unitOrder: number,
) {
  if (unitOrder <= 0) {
    return;
  }

  const previous =
    await tx.inventoryCountAttempt.findFirst({
      where: {
        assignedUserId: userId,
        purpose,
        unit: {
          inventoryId,
          unitOrder:
            unitOrder - 1,
        },
      },
      select: {
        status: true,
      },
    });

  if (
    previous?.status !== 'SUBMITTED'
  ) {
    throw new BadRequestException(
      "L'unité précédente doit être soumise avant celle-ci.",
    );
  }
}

private async buildOrdersFromObservations(
  tx: Prisma.TransactionClient,
  attempt: any,
  userId: string,
  observations: any[],
) {
  const orders:
    Prisma.OrderUncheckedCreateInput[] = [];

  const scanned =
    new Set<string>();

  for (const observation of observations) {
    const targetEquipmentId =
      observation.equipmentId ??
      observation.observedEquipmentId ??
      attempt.unit.equipmentId ??
      null;

    const targetShelfId =
      observation.shelfId ??
      observation.observedShelfId ??
      attempt.unit.shelfId ??
      null;

    if (
      observation.scannedSerialCode
    ) {
      const code =
        observation.scannedSerialCode.trim();

      const codeKey =
        code.toLowerCase();

      if (scanned.has(codeKey)) {
        throw new BadRequestException(
          `Le numéro de série '${code}' a été compté plusieurs fois dans cette même tentative.`,
        );
      }

      scanned.add(codeKey);

      const matches =
        await tx.serialNumber.findMany({
          where: {
            serialNumberCode: code,
          },
          select: {
            serialNumberId: true,
            equipmentId: true,
            shelfId: true,
          },
        });

      const match =
        matches.length === 1
          ? matches[0]
          : null;

      const observedEquipmentId =
        observation.observedEquipmentId ??
        match?.equipmentId ??
        targetEquipmentId;

      const observedShelfId =
        observation.observedShelfId ??
        targetShelfId ??
        match?.shelfId ??
        null;

      const isUnexpected =
        Boolean(
          observation.isUnexpected,
        ) ||
        !match ||
        Boolean(
          targetEquipmentId &&
          match.equipmentId !==
            targetEquipmentId,
        ) ||
        Boolean(
          targetShelfId &&
          match.shelfId !==
            targetShelfId,
        );

      orders.push({
        inventoryId:
          attempt.unit.inventoryId,
        attemptId:
          attempt.attemptId,
        userId,
        equipmentId:
          observedEquipmentId,
        shelfId:
          observedShelfId,
        observedEquipmentId,
        observedShelfId,
        serialNumberId:
          match?.serialNumberId ??
          null,
        scannedSerialCode: code,
        quantityCalculated: 1,
        isExplicitZero: false,
        isUnexpected,
        notes:
          observation.notes ??
          null,
        unknownItemEvidence:
          !match
            ? observation.unknownItemEvidence ??
              `Unknown serial: ${code}`
            : observation.unknownItemEvidence ??
              null,
      });

      continue;
    }

    const quantity =
      Number(
        observation.quantityCalculated ??
          0,
      );

    orders.push({
      inventoryId:
        attempt.unit.inventoryId,
      attemptId:
        attempt.attemptId,
      userId,
      equipmentId:
        targetEquipmentId,
      shelfId:
        targetShelfId,
      observedEquipmentId:
        observation.observedEquipmentId ??
        targetEquipmentId,
      observedShelfId:
        observation.observedShelfId ??
        targetShelfId,
      serialNumberId: null,
      scannedSerialCode: null,
      quantityCalculated: quantity,
      isExplicitZero:
        Boolean(
          observation.isExplicitZero,
        ) ||
        quantity === 0,
      isUnexpected:
        Boolean(
          observation.isUnexpected,
        ),
      notes:
        observation.notes ??
        null,
      unknownItemEvidence:
        observation.unknownItemEvidence ??
        null,
    });
  }

  return orders;
}

private async advancePrimaryOne(
  tx: Prisma.TransactionClient,
  inventoryId: string,
  unitOrder: number,
  userId: string,
) {
  const units =
    await tx.inventoryWorkUnit.findMany({
      where: { inventoryId },
      orderBy: {
        unitOrder: 'asc',
      },
      select: {
        unitId: true,
        unitOrder: true,
      },
    });

  const nextUnit =
    units.find(
      (unit) =>
        unit.unitOrder ===
        unitOrder + 1,
    );

  if (nextUnit) {
    const nextC1 =
      await tx.inventoryCountAttempt.findFirst({
        where: {
          unitId: nextUnit.unitId,
          assignedUserId: userId,
          purpose: 'PRIMARY_1',
        },
      });

    if (
      nextC1?.status === 'BLOCKED'
    ) {
      await tx.inventoryCountAttempt.update({
        where: {
          attemptId:
            nextC1.attemptId,
        },
        data: {
          status: 'AVAILABLE',
        },
      });

      await this.notifyAttemptAvailable(
        tx,
        nextC1.assignedUserId,
        inventoryId,
        nextC1.attemptId,
        nextUnit.unitOrder,
        'PRIMARY_1',
      );
    }
  }

  const currentUnit =
    units.find(
      (unit) =>
        unit.unitOrder ===
        unitOrder,
    );

  if (!currentUnit) {
    return;
  }

  const c2 =
    await tx.inventoryCountAttempt.findFirst({
      where: {
        unitId:
          currentUnit.unitId,
        purpose: 'PRIMARY_2',
      },
    });

  if (
    !c2 ||
    c2.status !== 'BLOCKED'
  ) {
    return;
  }

  let mayUnlock =
    unitOrder === 0;

  if (unitOrder > 0) {
    const previousUnit =
      units.find(
        (unit) =>
          unit.unitOrder ===
          unitOrder - 1,
      );

    if (previousUnit) {
      const previousC2 =
        await tx.inventoryCountAttempt.findFirst({
          where: {
            unitId:
              previousUnit.unitId,
            assignedUserId:
              c2.assignedUserId,
            purpose: 'PRIMARY_2',
            status: 'SUBMITTED',
          },
          select: {
            attemptId: true,
          },
        });

      mayUnlock =
        Boolean(previousC2);
    }
  }

  if (mayUnlock) {
    await tx.inventoryCountAttempt.update({
      where: {
        attemptId:
          c2.attemptId,
      },
      data: {
        status: 'AVAILABLE',
      },
    });

    await this.notifyAttemptAvailable(
      tx,
      c2.assignedUserId,
      inventoryId,
      c2.attemptId,
      unitOrder,
      'PRIMARY_2',
    );
  }
}

private async advancePrimaryTwo(
  tx: Prisma.TransactionClient,
  inventoryId: string,
  unitOrder: number,
  userId: string,
) {
  const nextUnit =
    await tx.inventoryWorkUnit.findFirst({
      where: {
        inventoryId,
        unitOrder:
          unitOrder + 1,
      },
      select: {
        unitId: true,
        unitOrder: true,
      },
    });

  if (!nextUnit) {
    return;
  }

  const nextC1 =
    await tx.inventoryCountAttempt.findFirst({
      where: {
        unitId:
          nextUnit.unitId,
        purpose: 'PRIMARY_1',
        status: 'SUBMITTED',
      },
      select: {
        attemptId: true,
      },
    });

  if (!nextC1) {
    return;
  }

  const nextC2 =
    await tx.inventoryCountAttempt.findFirst({
      where: {
        unitId:
          nextUnit.unitId,
        assignedUserId: userId,
        purpose: 'PRIMARY_2',
      },
    });

  if (
    nextC2?.status === 'BLOCKED'
  ) {
    await tx.inventoryCountAttempt.update({
      where: {
        attemptId:
          nextC2.attemptId,
      },
      data: {
        status: 'AVAILABLE',
      },
    });

    await this.notifyAttemptAvailable(
      tx,
      nextC2.assignedUserId,
      inventoryId,
      nextC2.attemptId,
      nextUnit.unitOrder,
      'PRIMARY_2',
    );
  }
}

private async notifyAttemptAvailable(
  tx: Prisma.TransactionClient,
  recipientId: string,
  inventoryId: string,
  attemptId: string,
  unitOrder: number,
  purpose: AttemptPurpose,
) {
  await tx.notification.create({
    data: {
      recipientId,
      eventType:
        'INVENTORY_TASK_AVAILABLE',
      payload: JSON.stringify({
        inventoryId,
        taskId: attemptId,
        unitOrder,
        purpose,
      }),
    },
  });
}

// --------------------------------------------------------------------------
// Per-unit reconciliation
// --------------------------------------------------------------------------

async reconcilePrimaryInventory(
  inventoryId: string,
  txClient?: Prisma.TransactionClient,
) {
  const run =
    async (
      tx: Prisma.TransactionClient,
    ) => {
      const units =
        await tx.inventoryWorkUnit.findMany({
          where: {
            inventoryId,
            reconciliationStatus:
              'PENDING',
          },
          include: {
            attempts: {
              where: {
                status: 'SUBMITTED',
                purpose: {
                  in: [
                    'PRIMARY_1',
                    'PRIMARY_2',
                  ],
                },
              },
              include: {
                orders: {
                  include: {
                    serialNumber: true,
                    equipment: true,
                    shelf: true,
                  },
                },
              },
            },
          },
          orderBy: {
            unitOrder: 'asc',
          },
        });

      const reconciled: Array<{
        unitId: string;
        result: string;
      }> = [];

      for (const unit of units) {
        const c1 =
          unit.attempts.find(
            (attempt) =>
              attempt.purpose ===
              'PRIMARY_1',
          );

        const c2 =
          unit.attempts.find(
            (attempt) =>
              attempt.purpose ===
              'PRIMARY_2',
          );

        if (!c1 || !c2) {
          continue;
        }

        const result =
          await this.reconcileUnitLoaded(
            tx,
            unit,
            c1,
            c2,
          );

        reconciled.push({
          unitId:
            unit.unitId,
          result,
        });
      }

      await this.refreshInventoryCompletion(
        tx,
        inventoryId,
      );

      return {
        inventoryId,
        reconciled,
      };
    };

  if (txClient) {
    return run(txClient);
  }

  return this.prisma.$transaction(
    run,
    {
      isolationLevel: 'Serializable',
      timeout: 30_000,
    },
  );
}

private async reconcileUnit(
  tx: Prisma.TransactionClient,
  unitId: string,
) {
  const unit =
    await tx.inventoryWorkUnit.findUnique({
      where: { unitId },
      include: {
        attempts: {
          where: {
            status: 'SUBMITTED',
          },
          include: {
            orders: {
              include: {
                serialNumber: true,
                equipment: true,
                shelf: true,
              },
            },
          },
        },
      },
    });

  if (!unit) {
    throw new NotFoundException(
      'Unité de travail introuvable',
    );
  }

  if (
    unit.reconciliationStatus !==
    'PENDING'
  ) {
    return unit.reconciliationStatus;
  }

  const c1 =
    unit.attempts.find(
      (attempt) =>
        attempt.purpose ===
        'PRIMARY_1',
    );

  const c2 =
    unit.attempts.find(
      (attempt) =>
        attempt.purpose ===
        'PRIMARY_2',
    );

  if (!c1 || !c2) {
    return 'PENDING';
  }

  return this.reconcileUnitLoaded(
    tx,
    unit,
    c1,
    c2,
  );
}

private async reconcileUnitLoaded(
  tx: Prisma.TransactionClient,
  unit: any,
  c1: any,
  c2: any,
) {
  const first =
    this.canonicalizeAttempt(
      unit,
      c1,
    );

  const second =
    this.canonicalizeAttempt(
      unit,
      c2,
    );

  if (
    this.canonicalAttemptsEqual(
      first,
      second,
    )
  ) {
    await tx.inventoryWorkUnit.update({
      where: {
        unitId: unit.unitId,
      },
      data: {
        status: 'VALIDATED',
        reconciliationStatus:
          'PRIMARY_MATCH',
        acceptedAttemptId:
          c1.attemptId,
        reconciledAt:
          new Date(),
      },
    });

    return 'PRIMARY_MATCH';
  }

  const inventory =
    await tx.inventory.findUnique({
      where: {
        inventoryId:
          unit.inventoryId,
      },
      include: {
        Inventory_User: {
          orderBy: {
            sequence: 'asc',
          },
        },
      },
    });

  if (!inventory) {
    throw new NotFoundException(
      'Inventaire introuvable',
    );
  }

  const controller3 =
    inventory.Inventory_User.find(
      (participant) =>
        participant.sequence === 2,
    );

  if (!controller3) {
    throw new BadRequestException(
      "Un écart C1/C2 nécessite un troisième contrôleur, mais aucun contrôleur final n'est assigné.",
    );
  }

  let c3 =
    await tx.inventoryCountAttempt.findFirst({
      where: {
        unitId: unit.unitId,
        purpose:
          'FINAL_RECOUNT',
      },
    });

  if (!c3) {
    c3 =
      await tx.inventoryCountAttempt.create({
        data: {
          unitId: unit.unitId,
          assignedUserId:
            controller3.userId,
          sequence: 2,
          purpose:
            'FINAL_RECOUNT',
          status: 'AVAILABLE',
          linkedPriorAttemptId:
            c2.attemptId,
        },
      });
  } else if (
    c3.status === 'BLOCKED'
  ) {
    c3 =
      await tx.inventoryCountAttempt.update({
        where: {
          attemptId:
            c3.attemptId,
        },
        data: {
          status: 'AVAILABLE',
        },
      });
  }

  await tx.inventoryWorkUnit.update({
    where: {
      unitId: unit.unitId,
    },
    data: {
      status:
        'RECOUNT_REQUIRED',
      reconciliationStatus:
        'THIRD_REQUIRED',
      acceptedAttemptId: null,
      reconciledAt: null,
    },
  });

  await tx.inventory.update({
    where: {
      inventoryId:
        unit.inventoryId,
    },
    data: {
      // Compatibility only. Per-unit status is authoritative.
      thirdCountRequired: true,
      finalResultSource:
        'PER_UNIT_ACCEPTED_ATTEMPT',
    },
  });

  await tx.notification.create({
    data: {
      recipientId:
        controller3.userId,
      eventType:
        'INVENTORY_THIRD_COUNT_REQUIRED',
      payload: JSON.stringify({
        inventoryId:
          unit.inventoryId,
        unitId:
          unit.unitId,
        unitOrder:
          unit.unitOrder,
        taskId:
          c3.attemptId,
        message:
          `Un écart C1/C2 a été détecté uniquement sur l'unité #${unit.unitOrder + 1}.`,
      }),
    },
  });

  return 'THIRD_REQUIRED';
}

private canonicalizeAttempt(
  unit: any,
  attempt: any,
): CanonicalAttempt {
  const standard =
    new Map<
      string,
      CanonicalStandardValue
    >();

  const serials =
    new Map<
      string,
      CanonicalSerialValue
    >();

  const unknown =
    new Set<string>();

  for (
    const order of
    attempt.orders ?? []
  ) {
    const equipmentId =
      (
        order.observedEquipmentId ??
        order.equipmentId ??
        unit.equipmentId ??
        ''
      )
        .toString()
        .trim();

    const shelfId =
      (
        order.observedShelfId ??
        order.shelfId ??
        unit.shelfId ??
        ''
      )
        .toString()
        .trim();

    const serialCode =
      (
        order.scannedSerialCode ??
        order.serialNumber
          ?.serialNumberCode ??
        ''
      )
        .toString()
        .trim();

    if (serialCode) {
      serials.set(
        serialCode.toLowerCase(),
        {
          serialCode,
          serialNumberId:
            order.serialNumberId ??
            null,
          equipmentId,
          shelfId:
            shelfId || null,
        },
      );

      continue;
    }

    if (
      equipmentId &&
      shelfId
    ) {
      const key =
        `${equipmentId.toLowerCase()}:${shelfId.toLowerCase()}`;

      const quantity =
        Number(
          order.quantityCalculated ??
            0,
        );

      const existing =
        standard.get(key);

      standard.set(
        key,
        {
          equipmentId,
          shelfId,
          quantity:
            (
              existing
                ?.quantity ??
              0
            ) +
            quantity,
        },
      );

      continue;
    }

    if (
      order.unknownItemEvidence
    ) {
      unknown.add(
        String(
          order.unknownItemEvidence,
        )
          .trim()
          .toLowerCase(),
      );
    }
  }

  return {
    standard,
    serials,
    unknown,
  };
}

private canonicalAttemptsEqual(
  left: CanonicalAttempt,
  right: CanonicalAttempt,
) {
  const standardKeys =
    new Set([
      ...left.standard.keys(),
      ...right.standard.keys(),
    ]);

  for (
    const key of standardKeys
  ) {
    if (
      (
        left.standard.get(key)
          ?.quantity ?? 0
      ) !==
      (
        right.standard.get(key)
          ?.quantity ?? 0
      )
    ) {
      return false;
    }
  }

  if (
    left.serials.size !==
    right.serials.size
  ) {
    return false;
  }

  for (
    const [code, value] of
    left.serials
  ) {
    const other =
      right.serials.get(code);

    if (!other) {
      return false;
    }

    if (
      value.equipmentId.toLowerCase() !==
        other.equipmentId.toLowerCase() ||
      (
        value.shelfId ?? ''
      ).toLowerCase() !==
        (
          other.shelfId ?? ''
        ).toLowerCase()
    ) {
      return false;
    }
  }

  if (
    left.unknown.size !==
    right.unknown.size
  ) {
    return false;
  }

  for (
    const value of left.unknown
  ) {
    if (
      !right.unknown.has(value)
    ) {
      return false;
    }
  }

  return true;
}

private async refreshInventoryCompletion(
  tx: Prisma.TransactionClient,
  inventoryId: string,
) {
  const total =
    await tx.inventoryWorkUnit.count({
      where: { inventoryId },
    });

  if (!total) {
    return;
  }

  const pending =
    await tx.inventoryWorkUnit.count({
      where: {
        inventoryId,
        reconciliationStatus: {
          notIn:
            RECONCILED_STATUSES,
        },
      },
    });

  const thirdRequired =
    await tx.inventoryWorkUnit.count({
      where: {
        inventoryId,
        reconciliationStatus:
          'THIRD_REQUIRED',
      },
    });

  if (pending === 0) {
    const inventory =
      await tx.inventory.update({
        where: { inventoryId },
        data: {
          status: 'COMPLETED',
          thirdCountRequired: false,
          finalResultSource:
            'PER_UNIT_ACCEPTED_ATTEMPT',
        },
      });

    if (inventory.creatorId) {
      await tx.notification.create({
        data: {
          recipientId:
            inventory.creatorId,
          eventType:
            'INVENTORY_COUNTS_COMPLETED',
          payload: JSON.stringify({
            inventoryId,
            title:
              inventory.title,
            message:
              "Toutes les unités ont un résultat accepté. L'inventaire est prêt à être finalisé.",
          }),
        },
      });
    }

    return;
  }

  await tx.inventory.update({
    where: { inventoryId },
    data: {
      status: 'IN_PROGRESS',
      thirdCountRequired:
        thirdRequired > 0,
      finalResultSource:
        'PER_UNIT_ACCEPTED_ATTEMPT',
    },
  });
}


// --------------------------------------------------------------------------
// Progress + report rows
// --------------------------------------------------------------------------

async getInventoryProgress(
  inventoryId: string,
) {
  const inventory =
    await this.prisma.inventory.findUnique({
      where: { inventoryId },
      include: {
        Inventory_User: {
          include: {
            User: {
              select: {
                userId: true,
                userName: true,
                userEmail: true,
              },
            },
          },
          orderBy: {
            sequence: 'asc',
          },
        },
        workUnits: {
          include: {
            attempts: {
              include: {
                assignedUser: {
                  select: {
                    userId: true,
                    userName: true,
                  },
                },
              },
              orderBy: {
                sequence: 'asc',
              },
            },
          },
          orderBy: {
            unitOrder: 'asc',
          },
        },
      },
    });

  if (!inventory) {
    throw new NotFoundException(
      'Inventaire introuvable',
    );
  }

  const totalUnits =
    inventory.workUnits.length;

  const participants =
    inventory.Inventory_User;

  const countSubmitted =
    (purpose: AttemptPurpose) =>
      inventory.workUnits.filter(
        (unit) =>
          unit.attempts.some(
            (attempt) =>
              attempt.purpose === purpose &&
              attempt.status === 'SUBMITTED',
          ),
      ).length;

  const c1Completed =
    countSubmitted('PRIMARY_1');

  const c2Completed =
    countSubmitted('PRIMARY_2');

  const c3Required =
    inventory.workUnits.filter(
      (unit) =>
        [
          'THIRD_REQUIRED',
          'THIRD_RESOLVED',
        ].includes(
          unit.reconciliationStatus,
        ),
    ).length;

  const c3Completed =
    countSubmitted(
      'FINAL_RECOUNT',
    );

  const reconciledUnits =
    inventory.workUnits.filter(
      (unit) =>
        RECONCILED_STATUSES.includes(
          unit.reconciliationStatus as UnitReconciliationStatus,
        ),
    ).length;

  return {
    inventoryId:
      inventory.inventoryId,
    title:
      inventory.title,
    typeInventory:
      inventory.typeInventory,
    status:
      inventory.status,
    policyVersion:
      inventory.policyVersion,
    totalUnits,
    reconciledUnits,

    controllers: {
      controller1: {
        user:
          participants[0]?.User ??
          null,
        responsibility:
          'PRIMARY_COUNTER_1',
        completedUnits:
          c1Completed,
        totalUnits,
        isFinished:
          c1Completed === totalUnits &&
          totalUnits > 0,
      },

      controller2: {
        user:
          participants[1]?.User ??
          null,
        responsibility:
          'PRIMARY_COUNTER_2',
        completedUnits:
          c2Completed,
        totalUnits,
        isFinished:
          c2Completed === totalUnits &&
          totalUnits > 0,
      },

      controller3: {
        user:
          participants[2]?.User ??
          null,
        responsibility:
          'FINAL_CONTROLLER',
        requiredUnits:
          c3Required,
        completedUnits:
          c3Completed,
        isActive:
          c3Required > c3Completed,
        isFinished:
          c3Required > 0 &&
          c3Completed === c3Required,
      },
    },

    workUnits:
      inventory.workUnits.map(
        (unit) => ({
          unitId:
            unit.unitId,
          unitOrder:
            unit.unitOrder,
          equipmentId:
            unit.equipmentId,
          shelfId:
            unit.shelfId,
          status:
            unit.status,
          reconciliationStatus:
            unit.reconciliationStatus,
          acceptedAttemptId:
            unit.acceptedAttemptId,
          reconciledAt:
            unit.reconciledAt,

          c1Status:
            unit.attempts.find(
              (attempt) =>
                attempt.purpose ===
                'PRIMARY_1',
            )?.status ??
            'BLOCKED',

          c2Status:
            unit.attempts.find(
              (attempt) =>
                attempt.purpose ===
                'PRIMARY_2',
            )?.status ??
            'BLOCKED',

          c3Status:
            unit.attempts.find(
              (attempt) =>
                attempt.purpose ===
                'FINAL_RECOUNT',
            )?.status ??
            'NOT_REQUIRED',
        }),
      ),
  };
}

async getInventoryComparison(
  inventoryId: string,
) {
  const inventory =
    await this.loadInventoryForReporting(
      inventoryId,
    );

  const units =
    inventory.workUnits.map(
      (unit: any) =>
        this.buildUnitReport(unit),
    );

  return {
    inventoryId:
      inventory.inventoryId,
    title:
      inventory.title,
    status:
      inventory.status,
    typeInventory:
      inventory.typeInventory,
    units,
    summary:
      this.summarizeUnitReports(
        units,
      ),
  };
}

private async loadInventoryForReporting(
  inventoryId: string,
) {
  const inventory =
    await this.prisma.inventory.findUnique({
      where: { inventoryId },
      include: {
        Inventory_User: {
          include: {
            User: {
              select: {
                userId: true,
                userName: true,
                userEmail: true,
              },
            },
          },
          orderBy: {
            sequence: 'asc',
          },
        },
        workUnits: {
          include: {
            attempts: {
              where: {
                status: 'SUBMITTED',
              },
              include: {
                orders: {
                  include: {
                    equipment: true,
                    shelf: true,
                    serialNumber: true,
                  },
                },
                assignedUser: {
                  select: {
                    userId: true,
                    userName: true,
                  },
                },
              },
              orderBy: {
                sequence: 'asc',
              },
            },
            acceptedAttempt: {
              include: {
                orders: {
                  include: {
                    equipment: true,
                    shelf: true,
                    serialNumber: true,
                  },
                },
              },
            },
          },
          orderBy: {
            unitOrder: 'asc',
          },
        },
      },
    });

  if (!inventory) {
    throw new NotFoundException(
      'Inventaire introuvable',
    );
  }

  return inventory;
}

private buildUnitReport(
  unit: any,
) {
  const c1 =
    unit.attempts.find(
      (attempt: any) =>
        attempt.purpose ===
        'PRIMARY_1',
    ) ?? null;

  const c2 =
    unit.attempts.find(
      (attempt: any) =>
        attempt.purpose ===
        'PRIMARY_2',
    ) ?? null;

  const c3 =
    unit.attempts.find(
      (attempt: any) =>
        attempt.purpose ===
        'FINAL_RECOUNT',
    ) ?? null;

  const accepted =
    unit.acceptedAttempt ??
    (
      unit.acceptedAttemptId
        ? unit.attempts.find(
            (attempt: any) =>
              attempt.attemptId ===
              unit.acceptedAttemptId,
          )
        : null
    );

  const c1Cells =
    this.attemptCells(
      unit,
      c1,
    );

  const c2Cells =
    this.attemptCells(
      unit,
      c2,
    );

  const c3Cells =
    this.attemptCells(
      unit,
      c3,
    );

  const finalCells =
    this.attemptCells(
      unit,
      accepted,
    );

  const keys =
    new Set([
      ...c1Cells.keys(),
      ...c2Cells.keys(),
      ...c3Cells.keys(),
      ...finalCells.keys(),
    ]);

  const rows =
    [...keys]
      .sort()
      .map((key) => {
        const first =
          c1Cells.get(key) ??
          null;

        const second =
          c2Cells.get(key) ??
          null;

        const third =
          c3Cells.get(key) ??
          null;

        const final =
          finalCells.get(key) ??
          null;

        const sample =
          final ??
          third ??
          second ??
          first;

        const kind =
          key.startsWith('SER|')
            ? 'SERIALIZED'
            : key.startsWith('STD|')
              ? 'STANDARD'
              : 'UNKNOWN';

        return {
          key,
          kind,
          equipmentId:
            sample?.equipmentId ??
            null,
          equipmentName:
            sample?.equipmentName ??
            null,
          shelfId:
            sample?.shelfId ??
            null,
          shelfName:
            sample?.shelfName ??
            null,
          serialNumberCode:
            sample?.serialNumberCode ??
            null,

          controller1:
            first,
          controller2:
            second,
          controller3:
            third,
          accepted:
            final,

          controller1VsAccepted:
            this.compareReportCells(
              kind,
              first,
              final,
            ),

          controller2VsAccepted:
            this.compareReportCells(
              kind,
              second,
              final,
            ),
        };
      });

  return {
    unitId:
      unit.unitId,
    unitOrder:
      unit.unitOrder,
    equipmentId:
      unit.equipmentId,
    shelfId:
      unit.shelfId,
    status:
      unit.status,
    reconciliationStatus:
      unit.reconciliationStatus,
    acceptedAttemptId:
      unit.acceptedAttemptId,
    acceptedPurpose:
      accepted?.purpose ??
      null,

    attempts: {
      controller1: c1
        ? {
            attemptId:
              c1.attemptId,
            user:
              c1.assignedUser ??
              null,
            submittedAt:
              c1.submittedAt,
          }
        : null,

      controller2: c2
        ? {
            attemptId:
              c2.attemptId,
            user:
              c2.assignedUser ??
              null,
            submittedAt:
              c2.submittedAt,
          }
        : null,

      controller3: c3
        ? {
            attemptId:
              c3.attemptId,
            user:
              c3.assignedUser ??
              null,
            submittedAt:
              c3.submittedAt,
          }
        : null,
    },

    rows,
  };
}

private attemptCells(
  unit: any,
  attempt: any,
) {
  const cells =
    new Map<
      string,
      ReportCell
    >();

  if (!attempt) {
    return cells;
  }

  for (
    const order of
    attempt.orders ?? []
  ) {
    const equipmentId =
      order.observedEquipmentId ??
      order.equipmentId ??
      unit.equipmentId ??
      null;

    const shelfId =
      order.observedShelfId ??
      order.shelfId ??
      unit.shelfId ??
      null;

    const serialCode =
      (
        order.scannedSerialCode ??
        order.serialNumber
          ?.serialNumberCode ??
        ''
      )
        .toString()
        .trim();

    if (serialCode) {
      const key =
        `SER|${serialCode.toLowerCase()}`;

      cells.set(
        key,
        {
          quantity: 1,
          serialNumberCode:
            serialCode,
          serialNumberId:
            order.serialNumberId ??
            null,
          equipmentId,
          equipmentName:
            order.equipment
              ?.equipmentName ??
            null,
          shelfId,
          shelfName:
            order.shelf
              ?.shelfName ??
            null,
          isUnexpected:
            Boolean(
              order.isUnexpected,
            ),
          notes:
            order.notes
              ? [order.notes]
              : [],
        },
      );

      continue;
    }

    if (
      equipmentId &&
      shelfId
    ) {
      const key =
        `STD|${equipmentId.toLowerCase()}|${shelfId.toLowerCase()}`;

      const existing =
        cells.get(key);

      cells.set(
        key,
        {
          quantity:
            (
              existing?.quantity ??
              0
            ) +
            Number(
              order.quantityCalculated ??
                0,
            ),
          serialNumberCode:
            null,
          serialNumberId:
            null,
          equipmentId,
          equipmentName:
            order.equipment
              ?.equipmentName ??
            existing
              ?.equipmentName ??
            null,
          shelfId,
          shelfName:
            order.shelf
              ?.shelfName ??
            existing
              ?.shelfName ??
            null,
          isUnexpected:
            Boolean(
              existing?.isUnexpected,
            ) ||
            Boolean(
              order.isUnexpected,
            ),
          notes: [
            ...(
              existing?.notes ??
              []
            ),
            ...(
              order.notes
                ? [order.notes]
                : []
            ),
          ],
        },
      );

      continue;
    }

    if (
      order.unknownItemEvidence
    ) {
      const value =
        String(
          order.unknownItemEvidence,
        );

      const key =
        `UNK|${value.toLowerCase()}`;

      cells.set(
        key,
        {
          quantity:
            Number(
              order.quantityCalculated ??
                1,
            ),
          serialNumberCode:
            serialCode || null,
          serialNumberId:
            order.serialNumberId ??
            null,
          equipmentId,
          equipmentName: null,
          shelfId,
          shelfName: null,
          isUnexpected: true,
          notes: [value],
        },
      );
    }
  }

  return cells;
}

private compareReportCells(
  kind: string,
  controller:
    ReportCell | null,
  accepted:
    ReportCell | null,
) {
  if (!accepted) {
    return {
      status: 'PENDING',
      delta: null,
      missing: 0,
      surplus: 0,
    };
  }

  if (kind === 'STANDARD') {
    const controllerQuantity =
      controller?.quantity ?? 0;

    const delta =
      controllerQuantity -
      accepted.quantity;

    if (delta === 0) {
      return {
        status: 'CONFORME',
        delta: 0,
        missing: 0,
        surplus: 0,
      };
    }

    if (delta < 0) {
      return {
        status: 'MANQUE',
        delta,
        missing:
          Math.abs(delta),
        surplus: 0,
      };
    }

    return {
      status: 'SURPLUS',
      delta,
      missing: 0,
      surplus: delta,
    };
  }

  if (
    kind === 'SERIALIZED'
  ) {
    if (!controller) {
      return {
        status: 'MANQUE',
        delta: -1,
        missing: 1,
        surplus: 0,
      };
    }

    if (
      (
        controller.equipmentId ??
        ''
      ).toLowerCase() !==
      (
        accepted.equipmentId ??
        ''
      ).toLowerCase()
    ) {
      return {
        status:
          'MAUVAIS_ARTICLE',
        delta: 0,
        missing: 0,
        surplus: 0,
      };
    }

    if (
      (
        controller.shelfId ??
        ''
      ).toLowerCase() !==
      (
        accepted.shelfId ??
        ''
      ).toLowerCase()
    ) {
      return {
        status:
          'MAUVAISE_POSITION',
        delta: 0,
        missing: 0,
        surplus: 0,
      };
    }

    return {
      status: 'CONFORME',
      delta: 0,
      missing: 0,
      surplus: 0,
    };
  }

  return {
    status:
      controller
        ? 'ECART'
        : 'MANQUE',
    delta: null,
    missing:
      controller
        ? 0
        : 1,
    surplus: 0,
  };
}

private summarizeUnitReports(
  units: any[],
) {
  let primaryMatchUnits =
    0;
  let thirdResolvedUnits =
    0;
  let thirdRequiredUnits =
    0;
  let compliantRows = 0;
  let controller1Missing =
    0;
  let controller1Surplus =
    0;
  let controller2Missing =
    0;
  let controller2Surplus =
    0;
  let locationMismatches =
    0;

  for (const unit of units) {
    if (
      unit.reconciliationStatus ===
      'PRIMARY_MATCH'
    ) {
      primaryMatchUnits += 1;
    }

    if (
      unit.reconciliationStatus ===
      'THIRD_RESOLVED'
    ) {
      thirdResolvedUnits += 1;
    }

    if (
      unit.reconciliationStatus ===
      'THIRD_REQUIRED'
    ) {
      thirdRequiredUnits += 1;
    }

    for (const row of unit.rows) {
      if (
        row.controller1VsAccepted
          .status ===
          'CONFORME' &&
        row.controller2VsAccepted
          .status ===
          'CONFORME'
      ) {
        compliantRows += 1;
      }

      controller1Missing +=
        row.controller1VsAccepted
          .missing ?? 0;

      controller1Surplus +=
        row.controller1VsAccepted
          .surplus ?? 0;

      controller2Missing +=
        row.controller2VsAccepted
          .missing ?? 0;

      controller2Surplus +=
        row.controller2VsAccepted
          .surplus ?? 0;

      if (
        [
          row.controller1VsAccepted
            .status,
          row.controller2VsAccepted
            .status,
        ].includes(
          'MAUVAISE_POSITION',
        )
      ) {
        locationMismatches += 1;
      }
    }
  }

  return {
    totalUnits:
      units.length,
    primaryMatchUnits,
    thirdRequiredUnits,
    thirdResolvedUnits,
    compliantRows,
    controller1: {
      missing:
        controller1Missing,
      surplus:
        controller1Surplus,
    },
    controller2: {
      missing:
        controller2Missing,
      surplus:
        controller2Surplus,
    },
    locationMismatches,
  };
}


  // --------------------------------------------------------------------------
  // Finalization + append-only adjustment movements
  // --------------------------------------------------------------------------

  async finalizeInventory(
    inventoryId: string,
    finalizerId: string,
  ) {
    const result = await this.prisma.$transaction(
      async (tx) => {
        const inventory =
          await tx.inventory.findUnique({
            where: { inventoryId },
            include: {
              workUnits: {
                include: {
                  acceptedAttempt: {
                    include: {
                      orders: {
                        include: {
                          serialNumber: true,
                          equipment: true,
                          shelf: true,
                        },
                      },
                    },
                  },
                },
                orderBy: {
                  unitOrder: 'asc',
                },
              },
            },
          });

        if (!inventory) {
          throw new NotFoundException(
            'Inventaire introuvable',
          );
        }

        if (
          inventory.status ===
          'FINALIZED'
        ) {
          throw new BadRequestException(
            'Cet inventaire est déjà finalisé.',
          );
        }

        if (
          inventory.status !==
          'COMPLETED'
        ) {
          throw new BadRequestException(
            'Toutes les unités doivent être réconciliées avant la finalisation.',
          );
        }

        const unresolved =
          inventory.workUnits.filter(
            (unit) =>
              !RECONCILED_STATUSES.includes(
                unit.reconciliationStatus as UnitReconciliationStatus,
              ) ||
              !unit.acceptedAttempt,
          );

        if (unresolved.length) {
          throw new BadRequestException(
            "Une ou plusieurs unités n'ont pas encore de tentative acceptée.",
          );
        }

        const scopeEquipmentIds =
          this.parseScopeIds(
            inventory.equipmentScopeIds,
          );

        const scopeShelfIds =
          this.parseScopeIds(
            inventory.shelfScopeIds,
          );

        await this.acquireResourceLocks(
          tx,
          scopeEquipmentIds,
          scopeShelfIds,
        );

        await this.assertNoOtherActiveInventory(
          tx,
          inventoryId,
          scopeEquipmentIds,
          scopeShelfIds,
        );

        const accepted =
          this.buildAcceptedPhysicalTruth(
            inventory.workUnits,
          );

        await tx.inventory_Equipment_Shelf_Snapshot.deleteMany({
          where: {
            inventoryId,
            phase: 'FINALIZED',
          },
        });

        await tx.inventory_SerialNumber_Snapshot.deleteMany({
          where: {
            inventoryId,
            phase: 'FINALIZED',
          },
        });

        for (
          const value of
          accepted.physical.values()
        ) {
          await tx.inventory_Equipment_Shelf_Snapshot.create({
            data: {
              inventoryId,
              equipmentId:
                value.equipmentId,
              shelfId:
                value.shelfId,
              phase: 'FINALIZED',
              quantity:
                value.quantity,
              provenance:
                'PER_UNIT_ACCEPTED_ATTEMPT',
            },
          });
        }

        for (
          const serial of
          accepted.serials.values()
        ) {
          await tx.inventory_SerialNumber_Snapshot.create({
            data: {
              inventoryId,
              equipmentId:
                serial.equipmentId,
              shelfId:
                serial.shelfId,
              serialNumberId:
                serial.serialNumberId,
              serialNumberCode:
                serial.serialCode,
              phase: 'FINALIZED',
              provenance:
                'PER_UNIT_ACCEPTED_ATTEMPT',
            },
          });
        }

        const launchPhysical =
          await tx.inventory_Equipment_Shelf_Snapshot.findMany({
            where: {
              inventoryId,
              phase:
                'LIVE_AT_LAUNCH',
            },
          });

        const launchSerials =
          await tx.inventory_SerialNumber_Snapshot.findMany({
            where: {
              inventoryId,
              phase:
                'LIVE_AT_LAUNCH',
            },
          });

        await tx.inventoryInvestigationIssue.deleteMany({
          where: { inventoryId },
        });

        await this.createVarianceIssues(
          tx,
          inventoryId,
          launchPhysical,
          launchSerials,
          accepted,
        );

        const allEquipmentIds =
          new Set<string>();

        for (
          const row of
          launchPhysical
        ) {
          allEquipmentIds.add(
            row.equipmentId,
          );
        }

        for (
          const row of
          accepted.physical.values()
        ) {
          allEquipmentIds.add(
            row.equipmentId,
          );
        }

        const equipmentRows =
          await tx.equipment.findMany({
            where: {
              equipmentId: {
                in: [
                  ...allEquipmentIds,
                ],
              },
            },
            select: {
              equipmentId: true,
              hasSerialNumber: true,
            },
          });

        const serializedByEquipment =
          new Map(
            equipmentRows.map(
              (item) => [
                item.equipmentId,
                item.hasSerialNumber,
              ],
            ),
          );

        await this.applyStandardInventoryAdjustments(
          tx,
          inventory,
          finalizerId,
          launchPhysical,
          accepted.physical,
          serializedByEquipment,
        );

        await this.applySerializedInventoryAdjustments(
          tx,
          inventory,
          finalizerId,
          launchSerials,
          accepted.serials,
        );

        const updated =
          await tx.inventory.update({
            where: { inventoryId },
            data: {
              status: 'FINALIZED',
              finalizedAt:
                new Date(),
              adjustmentApproverId:
                finalizerId ||
                null,
              adjustmentReason:
                "Ajustements d'inventaire appliqués par mouvements append-only.",
              finalResultSource:
                'PER_UNIT_ACCEPTED_ATTEMPT',
              thirdCountRequired:
                false,
            },
          });

        this.logger.log(
          `Inventory ${inventoryId} finalized with per-unit accepted attempts.`,
        );

        return updated;
      },
      {
        isolationLevel:
          'Serializable',
        timeout: 60_000,
      },
    );

    const equipmentIdsQuery = await this.prisma.inventoryWorkUnit.findMany({
      where: { inventoryId },
      select: { equipmentId: true }
    });
    const uniqueEquipmentIds = [
      ...new Set(
        equipmentIdsQuery
          .map((unit: { equipmentId: string | null }) => unit.equipmentId)
          .filter(Boolean) as string[]
      )
    ];
    await this.notificationsService.checkAndSendLowStockAlerts(uniqueEquipmentIds);

    return result;
  }

  private buildAcceptedPhysicalTruth(
    workUnits: any[],
  ) {
    const standard =
      new Map<
        string,
        CanonicalStandardValue
      >();

    const serials =
      new Map<
        string,
        CanonicalSerialValue
      >();

    const physical =
      new Map<
        string,
        CanonicalStandardValue
      >();

    for (
      const unit of workUnits
    ) {
      const attempt =
        unit.acceptedAttempt;

      if (!attempt) {
        continue;
      }

      const canonical =
        this.canonicalizeAttempt(
          unit,
          attempt,
        );

      for (
        const [
          key,
          value,
        ] of canonical.standard
      ) {
        const existing =
          standard.get(key);

        standard.set(
          key,
          {
            ...value,
            quantity:
              (
                existing?.quantity ??
                0
              ) +
              value.quantity,
          },
        );

        const physicalExisting =
          physical.get(key);

        physical.set(
          key,
          {
            ...value,
            quantity:
              (
                physicalExisting
                  ?.quantity ??
                0
              ) +
              value.quantity,
          },
        );
      }

      for (
        const [
          code,
          serial,
        ] of canonical.serials
      ) {
        const existing =
          serials.get(code);

        if (
          existing &&
          (
            existing.equipmentId.toLowerCase() !==
              serial.equipmentId.toLowerCase() ||
            (
              existing.shelfId ?? ''
            ).toLowerCase() !==
              (
                serial.shelfId ?? ''
              ).toLowerCase()
          )
        ) {
          throw new BadRequestException(
            `Le numéro de série '${serial.serialCode}' apparaît comme résultat accepté dans plusieurs positions.`,
          );
        }

        serials.set(
          code,
          serial,
        );

        if (
          serial.equipmentId &&
          serial.shelfId
        ) {
          const key =
            `${serial.equipmentId.toLowerCase()}:${serial.shelfId.toLowerCase()}`;

          const current =
            physical.get(key);

          physical.set(
            key,
            {
              equipmentId:
                serial.equipmentId,
              shelfId:
                serial.shelfId,
              quantity:
                (
                  current?.quantity ??
                  0
                ) + 1,
            },
          );
        }
      }
    }

    return {
      standard,
      serials,
      physical,
    };
  }

  private async createVarianceIssues(
    tx: Prisma.TransactionClient,
    inventoryId: string,
    launchPhysical: any[],
    launchSerials: any[],
    accepted: ReturnType<
      InventoryService['buildAcceptedPhysicalTruth']
    >,
  ) {
    const launchMap =
      new Map<
        string,
        {
          equipmentId: string;
          shelfId: string;
          quantity: number;
        }
      >();

    for (
      const row of launchPhysical
    ) {
      launchMap.set(
        `${row.equipmentId.toLowerCase()}:${row.shelfId.toLowerCase()}`,
        {
          equipmentId:
            row.equipmentId,
          shelfId: row.shelfId,
          quantity:
            row.quantity,
        },
      );
    }

    const quantityKeys =
      new Set([
        ...launchMap.keys(),
        ...accepted.physical.keys(),
      ]);

    for (
      const key of quantityKeys
    ) {
      const before =
        launchMap.get(key);

      const after =
        accepted.physical.get(key);

      const expected =
        before?.quantity ?? 0;

      const final =
        after?.quantity ?? 0;

      const delta =
        final - expected;

      if (delta === 0) {
        continue;
      }

      await tx.inventoryInvestigationIssue.create({
        data: {
          inventoryId,
          issueType:
            delta < 0
              ? 'QUANTITY_SHORTAGE'
              : 'QUANTITY_OVERAGE',
          status: 'OPEN',
          equipmentId:
            after?.equipmentId ??
            before?.equipmentId ??
            null,
          expectedShelfId:
            after?.shelfId ??
            before?.shelfId ??
            null,
          expectedQuantity:
            expected,
          finalQuantity:
            final,
          deltaQuantity:
            Math.abs(delta),
          movementExplanation:
            'UNEXPLAINED_VARIANCE',
        },
      });
    }

    const launchSerialMap =
      new Map<string, any>(
        launchSerials.map(
          (row) => [
            row.serialNumberCode
              .trim()
              .toLowerCase(),
            row,
          ],
        ),
      );

    const serialCodes =
      new Set([
        ...launchSerialMap.keys(),
        ...accepted.serials.keys(),
      ]);

    for (
      const code of serialCodes
    ) {
      const before =
        launchSerialMap.get(code);

      const after =
        accepted.serials.get(code);

      if (
        before &&
        !after
      ) {
        await tx.inventoryInvestigationIssue.create({
          data: {
            inventoryId,
            issueType:
              'SERIAL_MISSING',
            status: 'OPEN',
            equipmentId:
              before.equipmentId,
            serialNumberId:
              before.serialNumberId,
            serialNumberCode:
              before.serialNumberCode,
            expectedShelfId:
              before.shelfId,
            expectedQuantity: 1,
            finalQuantity: 0,
            deltaQuantity: 1,
            movementExplanation:
              'UNEXPLAINED_VARIANCE',
          },
        });

        continue;
      }

      if (
        !before &&
        after
      ) {
        await tx.inventoryInvestigationIssue.create({
          data: {
            inventoryId,
            issueType:
              after.serialNumberId
                ? 'SERIAL_UNEXPECTED'
                : 'SERIAL_UNKNOWN',
            status: 'OPEN',
            equipmentId:
              after.equipmentId ||
              null,
            serialNumberId:
              after.serialNumberId,
            serialNumberCode:
              after.serialCode,
            finalObservedShelfId:
              after.shelfId,
            expectedQuantity: 0,
            finalQuantity: 1,
            deltaQuantity: 1,
            movementExplanation:
              'UNEXPLAINED_VARIANCE',
          },
        });

        continue;
      }

      if (
        before &&
        after &&
        (
          before.equipmentId.toLowerCase() !==
            after.equipmentId.toLowerCase() ||
          (
            before.shelfId ?? ''
          ).toLowerCase() !==
            (
              after.shelfId ?? ''
            ).toLowerCase()
        )
      ) {
        await tx.inventoryInvestigationIssue.create({
          data: {
            inventoryId,
            issueType:
              before.equipmentId.toLowerCase() !==
              after.equipmentId.toLowerCase()
                ? 'SERIAL_EQUIPMENT_MISMATCH'
                : 'LOCATION_MISMATCH',
            status: 'OPEN',
            equipmentId:
              after.equipmentId ||
              before.equipmentId,
            serialNumberId:
              after.serialNumberId ??
              before.serialNumberId,
            serialNumberCode:
              after.serialCode,
            expectedShelfId:
              before.shelfId,
            finalObservedShelfId:
              after.shelfId,
            expectedQuantity: 1,
            finalQuantity: 1,
            deltaQuantity: 0,
            movementExplanation:
              'UNEXPLAINED_VARIANCE',
          },
        });
      }
    }
  }

  private async applyStandardInventoryAdjustments(
    tx: Prisma.TransactionClient,
    inventory: any,
    finalizerId: string,
    launchPhysical: any[],
    acceptedPhysical:
      Map<
        string,
        CanonicalStandardValue
      >,
    serializedByEquipment:
      Map<string, boolean>,
  ) {
    const launchMap =
      new Map<
        string,
        {
          equipmentId: string;
          shelfId: string;
          quantity: number;
        }
      >();

    for (
      const row of launchPhysical
    ) {
      if (
        serializedByEquipment.get(
          row.equipmentId,
        )
      ) {
        continue;
      }

      launchMap.set(
        `${row.equipmentId.toLowerCase()}:${row.shelfId.toLowerCase()}`,
        {
          equipmentId:
            row.equipmentId,
          shelfId: row.shelfId,
          quantity:
            row.quantity,
        },
      );
    }

    const acceptedStandard =
      new Map<
        string,
        CanonicalStandardValue
      >();

    for (
      const [
        key,
        value,
      ] of acceptedPhysical
    ) {
      if (
        serializedByEquipment.get(
          value.equipmentId,
        )
      ) {
        continue;
      }

      acceptedStandard.set(
        key,
        value,
      );
    }

    const keys =
      new Set([
        ...launchMap.keys(),
        ...acceptedStandard.keys(),
      ]);

    for (
      const key of keys
    ) {
      const before =
        launchMap.get(key);

      const after =
        acceptedStandard.get(key);

      const beforeQuantity =
        before?.quantity ?? 0;

      const afterQuantity =
        after?.quantity ?? 0;

      const delta =
        afterQuantity -
        beforeQuantity;

      if (delta === 0) {
        continue;
      }

      const equipmentId =
        after?.equipmentId ??
        before!.equipmentId;

      const shelfId =
        after?.shelfId ??
        before!.shelfId;

      const unitOrder =
        this.findUnitOrderForAdjustment(
          inventory,
          equipmentId,
          shelfId,
        );

      await this.appendAdjustmentMovement(
        tx,
        {
          inventoryId:
            inventory.inventoryId,
          finalizerId,
          equipmentId,
          quantity:
            Math.abs(delta),
          movementType:
            delta > 0
              ? 'IN'
              : 'OUT',
          sourceShelfId:
            delta < 0
              ? shelfId
              : null,
          destinationShelfId:
            delta > 0
              ? shelfId
              : null,
          serialNumberId: null,
          equipmentTypeSnapshot:
            'STANDARD',
          reason:
            `Ajustement inventaire - unité #${unitOrder + 1}`,
        },
      );
    }
  }

  private async applySerializedInventoryAdjustments(
    tx: Prisma.TransactionClient,
    inventory: any,
    finalizerId: string,
    launchSerials: any[],
    acceptedSerials:
      Map<
        string,
        CanonicalSerialValue
      >,
  ) {
    const launch =
      new Map<string, any>(
        launchSerials.map(
          (row) => [
            row.serialNumberCode
              .trim()
              .toLowerCase(),
            row,
          ],
        ),
      );

    const codes =
      new Set([
        ...launch.keys(),
        ...acceptedSerials.keys(),
      ]);

    for (
      const code of codes
    ) {
      const before =
        launch.get(code);

      const after =
        acceptedSerials.get(code);

      const serialNumberId =
        after?.serialNumberId ??
        before?.serialNumberId ??
        null;

      // Unknown serials remain investigation issues and are never auto-created.
      if (!serialNumberId) {
        continue;
      }

      const current =
        await tx.serialNumber.findUnique({
          where: {
            serialNumberId,
          },
          select: {
            serialNumberId: true,
            equipmentId: true,
            shelfId: true,
          },
        });

      if (!current) {
        continue;
      }

      const targetShelfId =
        after?.shelfId ??
        null;

      if (
        current.shelfId ===
        targetShelfId
      ) {
        continue;
      }

      const equipmentId =
        after?.equipmentId ??
        before?.equipmentId ??
        current.equipmentId;

      const unitOrder =
        this.findUnitOrderForAdjustment(
          inventory,
          equipmentId,
          targetShelfId ??
            current.shelfId,
        );

      if (
        current.shelfId &&
        targetShelfId
      ) {
        await this.appendAdjustmentMovement(
          tx,
          {
            inventoryId:
              inventory.inventoryId,
            finalizerId,
            equipmentId,
            quantity: 1,
            movementType:
              'TRANSFER',
            sourceShelfId:
              current.shelfId,
            destinationShelfId:
              targetShelfId,
            serialNumberId,
            equipmentTypeSnapshot:
              'SERIALIZED',
            reason:
              `Ajustement inventaire série - unité #${unitOrder + 1}`,
          },
        );

        continue;
      }

      if (
        !current.shelfId &&
        targetShelfId
      ) {
        await this.appendAdjustmentMovement(
          tx,
          {
            inventoryId:
              inventory.inventoryId,
            finalizerId,
            equipmentId,
            quantity: 1,
            movementType: 'IN',
            sourceShelfId: null,
            destinationShelfId:
              targetShelfId,
            serialNumberId,
            equipmentTypeSnapshot:
              'SERIALIZED',
            reason:
              `Ajustement inventaire série - unité #${unitOrder + 1}`,
          },
        );

        continue;
      }

      if (
        current.shelfId &&
        !targetShelfId
      ) {
        await this.appendAdjustmentMovement(
          tx,
          {
            inventoryId:
              inventory.inventoryId,
            finalizerId,
            equipmentId,
            quantity: 1,
            movementType: 'OUT',
            sourceShelfId:
              current.shelfId,
            destinationShelfId:
              null,
            serialNumberId,
            equipmentTypeSnapshot:
              'SERIALIZED',
            reason:
              `Ajustement inventaire série - unité #${unitOrder + 1}`,
          },
        );
      }
    }
  }

  private findUnitOrderForAdjustment(
    inventory: any,
    equipmentId: string,
    shelfId: string | null,
  ) {
    const unit =
      inventory.workUnits.find(
        (item: any) =>
          (
            item.equipmentId &&
            item.equipmentId.toLowerCase() ===
              equipmentId.toLowerCase()
          ) ||
          (
            shelfId &&
            item.shelfId &&
            item.shelfId.toLowerCase() ===
              shelfId.toLowerCase()
          ),
      );

    return unit?.unitOrder ?? 0;
  }

  private async appendAdjustmentMovement(
    tx: Prisma.TransactionClient,
    input: {
      inventoryId: string;
      finalizerId: string;
      equipmentId: string;
      quantity: number;
      movementType:
        | 'IN'
        | 'OUT'
        | 'TRANSFER';
      sourceShelfId:
        string | null;
      destinationShelfId:
        string | null;
      serialNumberId:
        string | null;
      equipmentTypeSnapshot:
        | 'STANDARD'
        | 'SERIALIZED';
      reason: string;
    },
  ) {
    const shelfIds = [
      input.sourceShelfId,
      (input.destinationShelfId || input.sourceShelfId),
    ].filter(
      (
        value,
      ): value is string =>
        Boolean(value),
    );

    await this.acquireResourceLocks(
      tx,
      [input.equipmentId],
      shelfIds,
      input.serialNumberId
        ? [input.serialNumberId]
        : [],
    );

    await this.assertNoOtherActiveInventory(
      tx,
      input.inventoryId,
      [input.equipmentId],
      shelfIds,
    );

    await this.assertAdjustmentResourcesActive(
      tx,
      input.equipmentId,
      shelfIds,
    );

    const header =
      await tx.mouvement.create({
        data: {
          mouvementStatus: input.movementType === "OUT",
          mouvementQuantity:
            input.quantity,
          sourceShelfId:
            input.sourceShelfId,
          destinationShelfId:
            (input.destinationShelfId || input.sourceShelfId),
          equipmentId: null,
          serialNumberId: null,
          createdByUserId:
            input.finalizerId ||
            null,
          inventoryId:
            input.inventoryId,
          origin:
            'INVENTORY_ADJUSTMENT',
          reason:
            input.reason,
        },
        select: {
          mouvementId: true,
        },
      });

    // equipmentShelfs updates removed

    if (
      input.movementType === 'IN'
    ) {
      const equipment =
        await tx.equipment.updateMany({
          where: {
            equipmentId:
              input.equipmentId,
            equipmentStatus:
              true,
            equipmentQuantity: {
              lte:
                SQL_INT_MAX -
                input.quantity,
            },
          },
          data: {
            equipmentQuantity: {
              increment:
                input.quantity,
            },
          },
        });

      if (
        equipment.count !== 1
      ) {
        throw new BadRequestException(
          "Impossible d'augmenter le stock article pendant l'ajustement.",
        );
      }
    }

    if (
      input.movementType === 'OUT'
    ) {
      const equipment =
        await tx.equipment.updateMany({
          where: {
            equipmentId:
              input.equipmentId,
            equipmentStatus:
              true,
            equipmentQuantity: {
              gte:
                input.quantity,
            },
          },
          data: {
            equipmentQuantity: {
              decrement:
                input.quantity,
            },
          },
        });

      if (
        equipment.count !== 1
      ) {
        throw new BadRequestException(
          "La quantité article globale est insuffisante pendant l'ajustement.",
        );
      }
    }

    if (input.serialNumberId) {
      const expectedShelfId =
        input.movementType === 'IN'
          ? null
          : input.sourceShelfId;

      const nextShelfId =
        input.movementType === 'OUT'
          ? null
          : (input.destinationShelfId || input.sourceShelfId);

      const serial =
        await tx.serialNumber.updateMany({
          where: {
            serialNumberId:
              input.serialNumberId,
            equipmentId:
              input.equipmentId,
            shelfId:
              expectedShelfId,
          },
          data: {
            shelfId:
              nextShelfId,
          },
        });

      if (
        serial.count !== 1
      ) {
        throw new BadRequestException(
          "La position du numéro de série a changé. Actualisez avant de finaliser l'inventaire.",
        );
      }
    }

    await tx.mouvementEquipment.create({
      data: {
        mouvementId:
          header.mouvementId,
        rowNum: 1,
        equipmentId:
          input.equipmentId,
        equipmentTypeSnapshot:
          input.equipmentTypeSnapshot,
        serialNumberId:
          input.serialNumberId,
        mouvementQuantity:
          input.quantity,
        mouvementStatus:
          input.movementType === 'OUT',
        sourceShelfId:
          input.sourceShelfId,
        destinationShelfId:
          (input.destinationShelfId || input.sourceShelfId),
      },
    });
  }

  private async assertAdjustmentResourcesActive(
    tx: Prisma.TransactionClient,
    equipmentId: string,
    shelfIds: string[],
  ) {
    const equipment =
      await tx.equipment.findUnique({
        where: { equipmentId },
        select: {
          equipmentId: true,
          equipmentStatus: true,
        },
      });

    if (!equipment) {
      throw new NotFoundException(
        'Article introuvable pendant la finalisation.',
      );
    }

    if (
      equipment.equipmentStatus !==
      true
    ) {
      throw new BadRequestException(
        'Un article INACTIVE ne peut pas recevoir un mouvement d’ajustement.',
      );
    }

    if (!shelfIds.length) {
      return;
    }

    const shelves =
      await tx.shelf.findMany({
        where: {
          shelfId: {
            in: shelfIds,
          },
        },
        select: {
          shelfId: true,
          shelfName: true,
          stock: {
            select: {
              stockName: true,
              status: true,
            },
          },
        },
      });

    if (
      shelves.length !== shelfIds.length
    ) {
      throw new NotFoundException(
        "Un emplacement d'ajustement est introuvable.",
      );
    }

    const inactive =
      shelves.find(
        (shelf) =>
          shelf.stock.status !== true,
      );

    if (inactive) {
      throw new BadRequestException(
        `L'emplacement '${inactive.shelfName ?? inactive.shelfId}' appartient à un stock INACTIVE. Aucun mouvement d'ajustement n'est autorisé.`,
      );
    }
  }

  // --------------------------------------------------------------------------
  // Report + issues
  // --------------------------------------------------------------------------

  async getInventoryReport(
    inventoryId: string,
  ) {
    const comparison =
      await this.getInventoryComparison(
        inventoryId,
      );

    const inventory =
      await this.prisma.inventory.findUnique({
        where: { inventoryId },
        include: {
          Inventory_User: {
            include: {
              User: {
                select: {
                  userId: true,
                  userName: true,
                  userEmail: true,
                },
              },
            },
            orderBy: {
              sequence: 'asc',
            },
          },
          investigationIssues: {
            include: {
              equipment: {
                select: {
                  equipmentId: true,
                  equipmentName: true,
                },
              },
              serialNumber: {
                select: {
                  serialNumberId: true,
                  serialNumberCode: true,
                },
              },
              expectedShelf: {
                select: {
                  shelfId: true,
                  shelfName: true,
                },
              },
              finalObservedShelf: {
                select: {
                  shelfId: true,
                  shelfName: true,
                },
              },
              resolutionShelf: {
                select: {
                  shelfId: true,
                  shelfName: true,
                },
              },
            },
            orderBy: {
              createdAt: 'desc',
            },
          },
          adjustmentMovements: {
            orderBy: {
              createdAt: 'asc',
            },
            include: {
              items: {
                orderBy: {
                  rowNum: 'asc',
                },
                include: {
                  equipment: true,
                  serialNumber: true,
                },
              },
              sourceShelf: true,
              destinationShelf: true,
            },
          },
        },
      });

    if (!inventory) {
      throw new NotFoundException(
        'Inventaire introuvable',
      );
    }

    const [
      launchQuantities,
      finalQuantities,
      launchSerials,
      finalSerials,
    ] = await Promise.all([
      this.prisma.inventory_Equipment_Shelf_Snapshot.findMany({
        where: {
          inventoryId,
          phase:
            'LIVE_AT_LAUNCH',
        },
      }),

      this.prisma.inventory_Equipment_Shelf_Snapshot.findMany({
        where: {
          inventoryId,
          phase: 'FINALIZED',
        },
      }),

      this.prisma.inventory_SerialNumber_Snapshot.findMany({
        where: {
          inventoryId,
          phase:
            'LIVE_AT_LAUNCH',
        },
      }),

      this.prisma.inventory_SerialNumber_Snapshot.findMany({
        where: {
          inventoryId,
          phase: 'FINALIZED',
        },
      }),
    ]);

    return {
      inventory: {
        inventoryId:
          inventory.inventoryId,
        title:
          inventory.title,
        typeInventory:
          inventory.typeInventory,
        status:
          inventory.status,
        createdAt:
          inventory.createdAt,
        launchedAt:
          inventory.launchedAt,
        finalizedAt:
          inventory.finalizedAt,
        policyVersion:
          inventory.policyVersion,
      },

      controllers:
        inventory.Inventory_User.map(
          (participant) => ({
            sequence:
              participant.sequence,
            responsibility:
              participant.responsibility,
            user:
              participant.User,
          }),
        ),

      units:
        comparison.units,

      summary:
        comparison.summary,

      baselineLaunch: {
        quantities:
          launchQuantities,
        serials:
          launchSerials,
      },

      physicalTruth: {
        quantities:
          finalQuantities,
        serials:
          finalSerials,
      },

      investigationIssues:
        inventory.investigationIssues,

      adjustmentMovements:
        inventory.adjustmentMovements,
    };
  }

  async getInventoryIssues(
    inventoryId: string,
  ) {
    return this.prisma.inventoryInvestigationIssue.findMany({
      where: { inventoryId },
      include: {
        equipment: true,
        serialNumber: true,
        expectedShelf: true,
        finalObservedShelf: true,
        resolutionShelf: true,
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
    const data =
      resolveIssueSchema.parse(dto);

    return this.prisma.$transaction(async (tx) => {
      const issue =
        await tx.inventoryInvestigationIssue.findUnique({
          where: { issueId },
        });

      if (!issue) {
        throw new NotFoundException(
          "Problème d'investigation introuvable",
        );
      }

      if (
        issue.inventoryId !== inventoryId
      ) {
        throw new BadRequestException(
          'Le problème ne correspond pas à cet inventaire.',
        );
      }

      if (
        issue.status === 'RESOLVED'
      ) {
        throw new BadRequestException(
          'Ce problème a déjà été résolu.',
        );
      }

      if (data.resolutionShelfId) {
        const shelf =
          await tx.shelf.findUnique({
            where: {
              shelfId:
                data.resolutionShelfId,
            },
            select: {
              shelfId: true,
            },
          });

        if (!shelf) {
          throw new NotFoundException(
            'Emplacement de résolution introuvable.',
          );
        }
      }

      // No direct stock mutation here. Finalization uses adjustment movements.
      return tx.inventoryInvestigationIssue.update({
        where: { issueId },
        data: {
          status: 'RESOLVED',
          resolutionType:
            data.resolutionType,
          resolutionShelfId:
            data.resolutionShelfId ??
            null,
          resolutionNotes:
            data.notes ?? null,
          resolvedByUserId:
            userId,
          resolvedAt:
            new Date(),
        },
        include: {
          equipment: true,
          serialNumber: true,
          expectedShelf: true,
          finalObservedShelf: true,
          resolutionShelf: true,
          resolvedByUser: true,
        },
      });
    });
  }

  // --------------------------------------------------------------------------
  // Delete
  // --------------------------------------------------------------------------

  async deleteInventory(
    inventoryId: string,
  ) {
    const existing =
      await this.prisma.inventory.findFirst({
        where: { inventoryId },
      });

    if (!existing) {
      throw new NotFoundException(
        'Inventaire introuvable',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // Find all related work units
      const units = await tx.inventoryWorkUnit.findMany({ 
        where: { inventoryId: existing.inventoryId }, 
        select: { unitId: true } 
      });
      const unitIds = units.map(u => u.unitId);
      
      if (unitIds.length > 0) {
        // Clear acceptedAttemptId to avoid circular foreign key constraints
        await tx.inventoryWorkUnit.updateMany({
          where: { inventoryId: existing.inventoryId },
          data: { acceptedAttemptId: null }
        });
        
        // Delete attempts
        await tx.inventoryCountAttempt.deleteMany({
          where: { unitId: { in: unitIds } },
        });
        
        // Delete work units
        await tx.inventoryWorkUnit.deleteMany({
          where: { inventoryId: existing.inventoryId },
        });
      }

      await tx.inventory_User.deleteMany({
        where: { inventoryId: existing.inventoryId },
      });

      return tx.inventory.delete({
        where: { inventoryId: existing.inventoryId },
      });
    });
  }

  // --------------------------------------------------------------------------
  // Legacy compatibility
  // --------------------------------------------------------------------------

  async getAdjudicationUnit(
    unitId: string,
  ) {
    const unit =
      await this.prisma.inventoryWorkUnit.findUnique({
        where: { unitId },
        include: {
          inventory: true,
          attempts: {
            include: {
              orders: {
                include: {
                  serialNumber: true,
                  equipment: true,
                  shelf: true,
                },
              },
            },
          },
        },
      });

    if (!unit) {
      throw new NotFoundException(
        'Unité introuvable',
      );
    }

    return unit;
  }

  async manualAdjudicate(
    unitId: string,
    _adjudicatorId: string,
    _data: AdjudicateDTO,
  ) {
    const unit =
      await this.prisma.inventoryWorkUnit.findUnique({
        where: { unitId },
        include: {
          inventory: true,
        },
      });

    if (!unit) {
      throw new NotFoundException(
        'Unité introuvable',
      );
    }

    if (
      (
        unit.inventory.policyVersion ??
        1
      ) >= 2
    ) {
      throw new BadRequestException(
        "L'adjudication manuelle est désactivée. Les écarts C1/C2 déclenchent automatiquement C3 uniquement pour l'unité concernée.",
      );
    }

    return {
      success: true,
      message:
        'Legacy adjudication processed',
    };
  }

  async assignThirdUser(
    inventoryId: string,
    _unitId: string,
    _thirdUserId: string,
    _currentUserId: string,
    _notes?: string,
  ) {
    const inventory =
      await this.prisma.inventory.findUnique({
        where: { inventoryId },
      });

    if (
      inventory &&
      (
        inventory.policyVersion ??
        1
      ) >= 2
    ) {
      throw new BadRequestException(
        "Le troisième contrôleur est préassigné à la création. Sa tâche est créée automatiquement uniquement pour une unité en écart.",
      );
    }

    return {
      success: true,
      message:
        'Legacy third user assigned',
    };
  }

  async assignThirdUserToAll(
    inventoryId: string,
    _thirdUserId: string,
    _currentUserId: string,
    _notes?: string,
  ) {
    const inventory =
      await this.prisma.inventory.findUnique({
        where: { inventoryId },
      });

    if (
      inventory &&
      (
        inventory.policyVersion ??
        1
      ) >= 2
    ) {
      throw new BadRequestException(
        'Le recomptage global C3 est supprimé. C3 est déclenché uniquement pour les unités en écart.',
      );
    }

    return {
      success: true,
      message:
        'Legacy third user assigned',
    };
  }

  async autoCompleteCounts(
    _inventoryId: string,
    _currentUserId: string,
  ) {
    if (
      process.env.NODE_ENV ===
      'production'
    ) {
      throw new ForbiddenException(
        'La complétion automatique de test est désactivée en production.',
      );
    }

    return {
      success: true,
      message:
        'Auto-complete bypass route',
    };
  }

  async notifyPendingControllerForUnit(
    inventoryId: string,
    unitId: string,
    _senderUserId?: string,
  ) {
    const attempt =
      await this.prisma.inventoryCountAttempt.findFirst({
        where: {
          unitId,
          unit: {
            inventoryId,
          },
          status: {
            in: [
              'AVAILABLE',
              'IN_PROGRESS',
            ],
          },
        },
        orderBy: {
          sequence: 'asc',
        },
      });

    if (!attempt) {
      throw new NotFoundException(
        'Aucune tâche en attente pour cette unité.',
      );
    }

    await this.prisma.notification.create({
      data: {
        recipientId:
          attempt.assignedUserId,
        eventType:
          'INVENTORY_TASK_REMINDER',
        payload: JSON.stringify({
          inventoryId,
          unitId,
          taskId:
            attempt.attemptId,
        }),
      },
    });

    return {
      success: true,
      message:
        'Notification envoyée',
    };
  }

  async notifyAllPendingControllers(
    inventoryId: string,
    _senderUserId?: string,
  ) {
    const attempts =
      await this.prisma.inventoryCountAttempt.findMany({
        where: {
          unit: {
            inventoryId,
          },
          status: {
            in: [
              'AVAILABLE',
              'IN_PROGRESS',
            ],
          },
        },
      });

    for (
      const attempt of attempts
    ) {
      await this.prisma.notification.create({
        data: {
          recipientId:
            attempt.assignedUserId,
          eventType:
            'INVENTORY_TASK_REMINDER',
          payload: JSON.stringify({
            inventoryId,
            taskId:
              attempt.attemptId,
          }),
        },
      });
    }

    return {
      success: true,
      count:
        attempts.length,
      message:
        'Notifications envoyées',
    };
  }
}
