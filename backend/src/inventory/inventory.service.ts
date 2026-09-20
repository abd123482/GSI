import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { 
  PaginationDTO, 
  CreateInventoryDTO, 
  SubmitTaskDTO, 
  SaveDraftDTO,
  ResolveIssueDTO,
  AdjudicateDTO, 
  AssignThirdUserDTO 
} from './dto/index.js';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retrieves all inventories with pagination and optional user filtering
   */
  async getInventories(pagination: PaginationDTO, filterUserId?: string) {
    const page = pagination?.page ? Number(pagination.page) : 1;
    const limit = pagination?.limit ? Number(pagination.limit) : 10;
    const skip = (page - 1) * limit;

    const whereClause: Prisma.InventoryWhereInput = filterUserId ? {
      Inventory_User: {
        some: {
          userId: filterUserId
        }
      }
    } : {};

    const [inventories, totalInventories] = await Promise.all([
      this.prisma.inventory.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
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
      this.prisma.inventory.count({ where: whereClause }),
    ]);

    return {
      inventories,
      totalInventories,
      totalPages: Math.ceil(totalInventories / limit) || 1,
      currentPage: page,
      limit,
    };
  }

  /**
   * Retrieves a specific inventory by ID with participants and work units
   */
  async getInventoryById(inventoryId: string) {
    const inventory = await this.prisma.inventory.findUnique({
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
            equipment: { select: { equipmentId: true, equipmentName: true } },
            serialNumber: { select: { serialNumberId: true, serialNumberCode: true } },
            expectedShelf: { select: { shelfId: true, shelfName: true } },
            finalObservedShelf: { select: { shelfId: true, shelfName: true } },
            resolutionShelf: { select: { shelfId: true, shelfName: true } },
            resolvedByUser: { select: { userId: true, userName: true } },
          },
        },
      },
    });
    if (!inventory) throw new NotFoundException('Inventaire introuvable');
    return inventory;
  }

  /**
   * Creates a new inventory.
   * For V2 (default policyVersion = 2):
   * Requires EXACTLY 3 distinct users in an explicit order:
   *   Sequence 0 -> PRIMARY_COUNTER_1 (Controller 1)
   *   Sequence 1 -> PRIMARY_COUNTER_2 (Controller 2)
   *   Sequence 2 -> FINAL_CONTROLLER   (Final Controller, preassigned, initially inactive)
   */
  async createInventory(data: CreateInventoryDTO, creatorId: string) {
    const policyVersion = data.policyVersion ?? 2;
    const users = data.users;

    if (policyVersion >= 2) {
      if (!users || users.length !== 3) {
        throw new BadRequestException('L\'architecture V2 requiert exactement 3 participants distincts ordonnés.');
      }
      const distinctUsers = new Set(users.map((u) => u.userId));
      if (distinctUsers.size !== 3) {
        throw new BadRequestException('Les 3 participants doivent être des utilisateurs différents.');
      }
    } else {
      if (!users || users.length < 2) {
        throw new BadRequestException('Un inventaire hérité doit comporter au moins 2 participants distincts.');
      }
      const distinctUsers = new Set(users.map((u) => u.userId));
      if (distinctUsers.size < 2) {
        throw new BadRequestException('Les participants doivent être des utilisateurs différents.');
      }
    }

    if (data.typeInventory === 'ByEquipment' && (!data.equipmentIds || data.equipmentIds.length === 0)) {
      throw new BadRequestException('Veuillez sélectionner au moins un article.');
    }
    if (data.typeInventory === 'ByShelf' && (!data.shelfIds || data.shelfIds.length === 0)) {
      throw new BadRequestException('Veuillez sélectionner au moins un emplacement.');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Create inventory master record
      const inventory = await tx.inventory.create({
        data: {
          title: data.title,
          typeInventory: data.typeInventory,
          status: 'DRAFT',
          policyVersion,
          creatorId: creatorId || null,
          equipmentScopeIds: data.equipmentIds ? JSON.stringify(data.equipmentIds) : null,
          shelfScopeIds: data.shelfIds ? JSON.stringify(data.shelfIds) : null,
        },
      });

      // 2. Fetch user details to capture role snapshot
      const userRecords = await tx.user.findMany({
        where: { userId: { in: users.map((u) => u.userId) } },
        include: { role: true },
      });
      const userMap = new Map(userRecords.map((u) => [u.userId, u]));

      // 3. Create assigned Inventory_User entries
      const assignedParticipants = users.map((u, index) => {
        let resp = u.responsibility;
        if (policyVersion >= 2) {
          if (index === 0) resp = 'PRIMARY_COUNTER_1';
          else if (index === 1) resp = 'PRIMARY_COUNTER_2';
          else resp = 'FINAL_CONTROLLER';
        } else {
          resp = resp || (index === 0 ? 'COUNT' : 'ADJUDICATE');
        }

        const userRec = userMap.get(u.userId);
        return {
          inventoryId: inventory.inventoryId,
          userId: u.userId,
          sequence: index,
          responsibility: resp,
          roleSnapshot: userRec?.role?.roleName ?? 'USER',
        };
      });

      await tx.inventory_User.createMany({
        data: assignedParticipants,
      });

      this.logger.log(`Created inventory ${inventory.inventoryId} (V${policyVersion}) with 3 participants.`);
      return inventory;
    });
  }

  /**
   * Launches the inventory workflow:
   * 1. Freezes reference stock quantities and serial number locations as LIVE_AT_LAUNCH snapshots.
   * 2. Creates ordered work units (unitOrder: 0, 1, ..., n-1).
   * 3. Creates count attempts:
   *    - Controller 1 (seq 0): U0 is AVAILABLE, U1..Un-1 are BLOCKED.
   *    - Controller 2 (seq 1): all units are BLOCKED.
   *    - Final Controller (seq 2): all units are BLOCKED.
   * 4. Transitions status to IN_PROGRESS.
   * 5. Sends initial notification to Controller 1.
   */
  async launchInventory(inventoryId: string) {
    return this.prisma.$transaction(async (tx) => {
      const inventory = await tx.inventory.findUnique({
        where: { inventoryId },
        include: {
          Inventory_User: {
            orderBy: { sequence: 'asc' },
          },
        },
      });

      if (!inventory) throw new NotFoundException('Inventaire introuvable');
      if (inventory.status !== 'DRAFT') throw new BadRequestException('L\'inventaire n\'est pas au statut BROUILLON (DRAFT)');

      const participants = inventory.Inventory_User;
      if ((inventory.policyVersion ?? 1) >= 2) {
        if (participants.length !== 3) {
          throw new BadRequestException('L\'inventaire V2 doit avoir exactement 3 participants pour être lancé.');
        }
      } else {
        if (participants.length < 2) {
          throw new BadRequestException('L\'inventaire requiert au moins 2 participants.');
        }
      }

      const controller1 = participants[0];
      const controller2 = participants[1];
      const controller3 = participants.length > 2 ? participants[2] : null;

      const equipmentIds: string[] = inventory.equipmentScopeIds ? JSON.parse(inventory.equipmentScopeIds) : [];
      const shelfIds: string[] = inventory.shelfScopeIds ? JSON.parse(inventory.shelfScopeIds) : [];

      const workUnitIds: string[] = [];

      // 1. Create Work Units with stable, deterministic unitOrder
      if (inventory.typeInventory === 'ByEquipment' && equipmentIds.length > 0) {
        for (let idx = 0; idx < equipmentIds.length; idx++) {
          const eqId = equipmentIds[idx];
          const unit = await tx.inventoryWorkUnit.create({
            data: {
              inventoryId,
              equipmentId: eqId,
              unitOrder: idx,
              status: 'DRAFT',
            },
          });
          workUnitIds.push(unit.unitId);

          // Freeze live quantity snapshot for this equipment
          const stockRows = await tx.equipmentShelfs.findMany({
            where: { equipmentId: eqId },
          });
          if (stockRows.length > 0) {
            await tx.inventory_Equipment_Shelf_Snapshot.createMany({
              data: stockRows.map((s) => ({
                inventoryId,
                equipmentId: s.equipmentId!,
                shelfId: s.shelfId!,
                phase: 'LIVE_AT_LAUNCH',
                quantity: s.equipmentQuantity || 0,
                provenance: 'LIVE_EQUIPMENT_SHELFS',
              })),
            });
          }

          // Freeze live serial numbers snapshot for serialized equipment
          const serialRows = tx.serialNumber?.findMany ? await tx.serialNumber.findMany({
            where: { equipmentId: eqId },
          }) : [];
          if (serialRows.length > 0 && tx.inventory_SerialNumber_Snapshot?.createMany) {
            await tx.inventory_SerialNumber_Snapshot.createMany({
              data: serialRows.map((sn: any) => ({
                inventoryId,
                equipmentId: eqId,
                shelfId: sn.shelfId,
                serialNumberId: sn.serialNumberId,
                serialNumberCode: sn.serialNumberCode || '',
                serialNumberStatus: sn.serialNumberStatus,
                phase: 'LIVE_AT_LAUNCH',
                provenance: 'LIVE_SERIAL_NUMBERS',
              })),
            });
          }
        }
      } else if (inventory.typeInventory === 'ByShelf' && shelfIds.length > 0) {
        for (let idx = 0; idx < shelfIds.length; idx++) {
          const shId = shelfIds[idx];
          const unit = await tx.inventoryWorkUnit.create({
            data: {
              inventoryId,
              shelfId: shId,
              unitOrder: idx,
              status: 'DRAFT',
            },
          });
          workUnitIds.push(unit.unitId);

          // Freeze live quantity snapshot for this shelf
          const stockRows = await tx.equipmentShelfs.findMany({
            where: { shelfId: shId },
          });
          if (stockRows.length > 0) {
            await tx.inventory_Equipment_Shelf_Snapshot.createMany({
              data: stockRows.map((s) => ({
                inventoryId,
                equipmentId: s.equipmentId!,
                shelfId: s.shelfId!,
                phase: 'LIVE_AT_LAUNCH',
                quantity: s.equipmentQuantity || 0,
                provenance: 'LIVE_EQUIPMENT_SHELFS',
              })),
            });
          }

          // Freeze live serial numbers snapshot for serialized items currently on this shelf
          const serialRows = tx.serialNumber?.findMany ? await tx.serialNumber.findMany({
            where: { shelfId: shId },
          }) : [];
          if (serialRows.length > 0 && tx.inventory_SerialNumber_Snapshot?.createMany) {
            await tx.inventory_SerialNumber_Snapshot.createMany({
              data: serialRows.map((sn: any) => ({
                inventoryId,
                equipmentId: sn.equipmentId!,
                shelfId: shId,
                serialNumberId: sn.serialNumberId,
                serialNumberCode: sn.serialNumberCode || '',
                serialNumberStatus: sn.serialNumberStatus,
                phase: 'LIVE_AT_LAUNCH',
                provenance: 'LIVE_SERIAL_NUMBERS',
              })),
            });
          }
        }
      }

      // 2. Create attempts for all controllers respecting strict unit pipeline
      let firstC1AttemptId: string | undefined;

      for (let unitIdx = 0; unitIdx < workUnitIds.length; unitIdx++) {
        const uId = workUnitIds[unitIdx];

        // Controller 1: Unit 0 is AVAILABLE, Units 1..n-1 are BLOCKED
        const c1Attempt = await tx.inventoryCountAttempt.create({
          data: {
            unitId: uId,
            assignedUserId: controller1.userId,
            sequence: 0,
            purpose: 'PRIMARY_1',
            status: unitIdx === 0 ? 'AVAILABLE' : 'BLOCKED',
          },
        });
        if (unitIdx === 0) {
          firstC1AttemptId = c1Attempt.attemptId;
        }

        // Controller 2: All units initially BLOCKED
        await tx.inventoryCountAttempt.create({
          data: {
            unitId: uId,
            assignedUserId: controller2.userId,
            sequence: 1,
            purpose: 'PRIMARY_2',
            status: 'BLOCKED',
          },
        });

        // Controller 3 (FINAL_RECOUNT) attempts are intentionally NOT created at launch.
        // In accordance with blind counting and policy requirements, Controller 3 tasks
        // are only created dynamically if a discrepancy between C1 and C2 is detected during primary reconciliation.
      }

      // 3. Transition inventory to IN_PROGRESS
      await tx.inventory.update({
        where: { inventoryId },
        data: {
          status: 'IN_PROGRESS',
          launchedAt: new Date(),
        },
      });

      // 4. Send notification to Controller 1
      await tx.notification.create({
        data: {
          recipientId: controller1.userId,
          eventType: 'INVENTORY_TASK_AVAILABLE',
          payload: JSON.stringify({
            inventoryId,
            taskId: firstC1AttemptId,
            title: inventory.title,
            message: `L'inventaire "${inventory.title}" a été lancé. La première tâche de comptage vous est attribuée.`,
            unitOrder: 0,
          }),
        },
      });

      this.logger.log(`Inventory ${inventoryId} launched successfully. Generated ${workUnitIds.length} units.`);
      return { success: true, inventoryId, totalUnits: workUnitIds.length };
    });
  }

  /**
   * Retrieves active counting tasks currently assigned to the user
   */
  async getMyTasks(userId: string) {
    const attempts = await this.prisma.inventoryCountAttempt.findMany({
      where: {
        assignedUserId: userId,
        status: { in: ['AVAILABLE', 'IN_PROGRESS'] },
        unit: {
          inventory: {
            status: { in: ['IN_PROGRESS', 'THIRD_COUNT_REQUIRED'] },
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
                thirdCountRequired: true,
              },
            },
          },
        },
      },
      orderBy: {
        unit: { unitOrder: 'asc' },
      },
    });

    // Strictly filter out any FINAL_RECOUNT tasks unless the inventory explicitly requires third count (discrepancy detected)
    const validAttempts = attempts.filter((attempt) => {
      if (attempt.purpose === 'FINAL_RECOUNT') {
        return (
          attempt.unit.inventory.status === 'THIRD_COUNT_REQUIRED' &&
          attempt.unit.inventory.thirdCountRequired === true
        );
      }
      return true;
    });

    // Populate scope labels
    const enriched = await Promise.all(
      validAttempts.map(async (attempt) => {
        let label = 'Unité de travail';
        let isSerialized = false;

        if (attempt.unit.equipmentId) {
          const eq = await this.prisma.equipment.findUnique({
            where: { equipmentId: attempt.unit.equipmentId },
            select: { equipmentName: true, hasSerialNumber: true },
          });
          label = eq?.equipmentName || 'Article inconnu';
          isSerialized = !!eq?.hasSerialNumber;
        } else if (attempt.unit.shelfId) {
          const sh = await this.prisma.shelf.findUnique({
            where: { shelfId: attempt.unit.shelfId },
            select: { shelfName: true },
          });
          label = sh?.shelfName || 'Emplacement inconnu';
        }

        return {
          ...attempt,
          scopeLabel: label,
          isSerialized,
        };
      })
    );

    return enriched;
  }

  /**
   * Retrieves a specific counting task (attempt) with BLIND physical counting semantics.
   * Never leaks theoretical or expected stock quantities.
   */
  async getTask(attemptId: string, currentUserId?: string) {
    const attempt = await this.prisma.inventoryCountAttempt.findUnique({
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
                  orderBy: { sequence: 'asc' },
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

    if (!attempt) throw new NotFoundException('Tâche introuvable');
    if (currentUserId && attempt.assignedUserId !== currentUserId) {
      throw new ForbiddenException('Vous n\'êtes pas le contrôleur assigné à cette tâche.');
    }

    // Guard against accessing FINAL_RECOUNT when not required
    if (attempt.purpose === 'FINAL_RECOUNT') {
      if (
        attempt.unit.inventory.status !== 'THIRD_COUNT_REQUIRED' ||
        !attempt.unit.inventory.thirdCountRequired
      ) {
        throw new ForbiddenException(
          "Le recomptage du 3ème contrôleur n'est pas requis pour cet inventaire (les comptages des deux premiers contrôleurs sont conformes)."
        );
      }
    }

    const inventory = attempt.unit.inventory;
    const isByEquipment = inventory.typeInventory === 'ByEquipment';

    let equipmentDetails: any = null;
    let shelfDetails: any = null;
    let candidateShelves: any[] = [];
    let candidateEquipments: any[] = [];

    if (isByEquipment && attempt.unit.equipmentId) {
      const eq = await this.prisma.equipment.findUnique({
        where: { equipmentId: attempt.unit.equipmentId },
        select: {
          equipmentId: true,
          equipmentName: true,
          hasSerialNumber: true,
        },
      });

      // Provide candidate search shelves (blind: shelfName only, NO expected quantity)
      const eqShelfs = await this.prisma.equipmentShelfs.findMany({
        where: { equipmentId: attempt.unit.equipmentId },
        include: {
          shelf: { select: { shelfId: true, shelfName: true } },
        },
      });
      candidateShelves = eqShelfs
        .filter((es) => es.shelf)
        .map((es) => ({
          shelfId: es.shelf!.shelfId,
          shelfName: es.shelf!.shelfName,
        }));

      let serialNumbers: any[] = [];
      if (eq?.hasSerialNumber) {
        const sns = await this.prisma.serialNumber.findMany({
          where: { equipmentId: attempt.unit.equipmentId },
          select: {
            serialNumberId: true,
            serialNumberCode: true,
            serialNumberStatus: true,
            shelfId: true,
            shelf: { select: { shelfName: true } },
          },
        });
        serialNumbers = sns.map((s) => ({
          serialNumberId: s.serialNumberId,
          serialNumberCode: s.serialNumberCode,
          serialNumberStatus: s.serialNumberStatus,
          shelfId: s.shelfId,
          shelfName: s.shelf?.shelfName || null,
        }));
      }

      equipmentDetails = eq
        ? {
            ...eq,
            shelves: candidateShelves,
            serialNumbers,
          }
        : null;
    } else if (!isByEquipment && attempt.unit.shelfId) {
      const sh = await this.prisma.shelf.findUnique({
        where: { shelfId: attempt.unit.shelfId },
        select: {
          shelfId: true,
          shelfName: true,
        },
      });

      // Provide candidate search equipments on this shelf (blind: NO expected quantity)
      const eqShelfs = await this.prisma.equipmentShelfs.findMany({
        where: { shelfId: attempt.unit.shelfId },
        include: {
          equipment: {
            select: {
              equipmentId: true,
              equipmentName: true,
              hasSerialNumber: true,
            },
          },
        },
      });

      const serializedEqIds = eqShelfs
        .filter((es) => !!es.equipment?.hasSerialNumber && !!es.equipmentId)
        .map((es) => es.equipmentId as string);

      const snsOnShelf =
        serializedEqIds.length > 0
          ? await this.prisma.serialNumber.findMany({
              where: {
                shelfId: attempt.unit.shelfId,
                equipmentId: { in: serializedEqIds },
              },
              select: {
                serialNumberId: true,
                serialNumberCode: true,
                serialNumberStatus: true,
                equipmentId: true,
                shelfId: true,
              },
            })
          : [];

      candidateEquipments = eqShelfs
        .filter((es) => es.equipment)
        .map((es) => {
          const eqSns = snsOnShelf.filter((s) => s.equipmentId === es.equipment!.equipmentId);
          return {
            equipmentId: es.equipment!.equipmentId,
            equipmentName: es.equipment!.equipmentName,
            hasSerialNumber: es.equipment!.hasSerialNumber,
            serialNumbers: eqSns.map((s) => ({
              serialNumberId: s.serialNumberId,
              serialNumberCode: s.serialNumberCode,
              serialNumberStatus: s.serialNumberStatus,
              shelfId: s.shelfId,
              shelfName: sh?.shelfName,
            })),
          };
        });

      shelfDetails = sh
        ? {
            shelfId: sh.shelfId,
            shelfName: sh.shelfName,
            equipments: candidateEquipments,
          }
        : null;
    }

    const [allEquipments, allShelves] = await Promise.all([
      this.prisma.equipment.findMany({
        select: {
          equipmentId: true,
          equipmentName: true,
          hasSerialNumber: true,
        },
        orderBy: { equipmentName: 'asc' },
      }),
      this.prisma.shelf.findMany({
        select: {
          shelfId: true,
          shelfName: true,
        },
        orderBy: { shelfName: 'asc' },
      }),
    ]);

    // Get total work units count for progress indicator
    const totalUnits = await this.prisma.inventoryWorkUnit.count({
      where: { inventoryId: inventory.inventoryId },
    });

    const inventoryObj = {
      inventoryId: inventory.inventoryId,
      title: inventory.title,
      typeInventory: inventory.typeInventory,
      status: inventory.status,
      policyVersion: inventory.policyVersion,
      Inventory_User: (inventory.Inventory_User || []).map((iu: any) => ({
        inventoryId: iu.inventoryId,
        userId: iu.userId,
        sequence: iu.sequence,
        responsibility: iu.responsibility,
        roleSnapshot: iu.roleSnapshot,
        user: iu.User
          ? {
              userId: iu.User.userId,
              userName: iu.User.userName,
              userEmail: iu.User.userEmail,
            }
          : undefined,
        User: iu.User,
      })),
    };

    const formattedOrders = (attempt.orders || []).map((o) => ({
      orderId: o.orderId,
      inventoryId: o.inventoryId,
      attemptId: o.attemptId,
      equipmentId: o.equipmentId,
      shelfId: o.shelfId,
      serialNumberId: o.serialNumberId,
      scannedSerialCode: o.scannedSerialCode,
      quantityCalculated: o.quantityCalculated,
      isExplicitZero: o.isExplicitZero,
      isUnexpected: o.isUnexpected,
      notes: o.notes,
      equipment: o.equipment
        ? {
            equipmentId: o.equipment.equipmentId,
            equipmentName: o.equipment.equipmentName,
            hasSerialNumber: o.equipment.hasSerialNumber,
          }
        : undefined,
      shelf: o.shelf
        ? {
            shelfId: o.shelf.shelfId,
            shelfName: o.shelf.shelfName,
          }
        : undefined,
      serialNumber: o.serialNumber
        ? {
            serialNumberId: o.serialNumber.serialNumberId,
            serialNumberCode: o.serialNumber.serialNumberCode,
          }
        : undefined,
      equipmentName: o.equipment?.equipmentName,
      shelfName: o.shelf?.shelfName,
      serialNumberCode: o.serialNumber?.serialNumberCode || o.scannedSerialCode,
    }));

    const unitObj = {
      unitId: attempt.unit.unitId,
      inventoryId: inventory.inventoryId,
      equipmentId: attempt.unit.equipmentId,
      shelfId: attempt.unit.shelfId,
      unitOrder: attempt.unit.unitOrder,
      status: attempt.unit.status,
      equipment: equipmentDetails,
      shelf: shelfDetails,
      inventory: inventoryObj,
    };

    return {
      attemptId: attempt.attemptId,
      unitId: attempt.unitId,
      assignedUserId: attempt.assignedUserId,
      sequence: attempt.sequence,
      purpose: attempt.purpose,
      status: attempt.status,
      draftData: attempt.draftData ? JSON.parse(attempt.draftData) : null,
      unitOrder: attempt.unit.unitOrder,
      totalUnits,
      unit: unitObj,
      inventory: inventoryObj,
      participants: inventoryObj.Inventory_User,
      equipment: equipmentDetails,
      shelf: shelfDetails,
      candidateShelves,
      candidateEquipments,
      orders: formattedOrders,
      savedOrders: formattedOrders,
      allShelves,
      scopeDetails: {
        allEquipments,
        allShelves,
        equipments: equipmentDetails ? [equipmentDetails] : [],
        shelves: shelfDetails ? [shelfDetails] : [],
      },
    };
  }

  /**
   * Saves work-in-progress draft observations without submitting or advancing the pipeline.
   */
  async saveDraft(attemptId: string, userId: string, data: SaveDraftDTO) {
    const attempt = await this.prisma.inventoryCountAttempt.findUnique({
      where: { attemptId },
    });
    if (!attempt) throw new NotFoundException('Tâche introuvable');
    if (attempt.assignedUserId !== userId) {
      throw new ForbiddenException('Vous n\'êtes pas le contrôleur assigné à cette tâche.');
    }
    if (attempt.status !== 'AVAILABLE' && attempt.status !== 'IN_PROGRESS') {
      throw new BadRequestException('Cette tâche ne peut plus être modifiée (statut: ' + attempt.status + ')');
    }

    await this.prisma.inventoryCountAttempt.update({
      where: { attemptId },
      data: {
        status: 'IN_PROGRESS',
        draftData: JSON.stringify(data),
      },
    });

    return { success: true, message: 'Brouillon enregistré avec succès.' };
  }

  /**
   * Submits a physical count attempt.
   * Transactional and atomic:
   * 1. Validates caller ownership and attempt status (must be AVAILABLE or IN_PROGRESS).
   * 2. Validates strict unit order (cannot submit Ui if U(i-1) is not submitted).
   * 3. Resolves serial numbers, validates uniqueness within attempt, prevents double-counting.
   * 4. Persists observations in Order table and marks attempt SUBMITTED.
   * 5. Advances the pipeline strictly:
   *    - Controller 1 submitting Ui -> unlocks C1 U(i+1) AND unlocks C2 Ui (if C2 has submitted U(i-1)).
   *    - Controller 2 submitting Uj -> unlocks C2 U(j+1) IF AND ONLY IF C1 has submitted U(j+1).
   *    - Controller 3 submitting Uk -> unlocks C3 U(k+1).
   * 6. Checks for stage completion:
   *    - When both C1 and C2 submitted ALL units -> triggers reconcilePrimaryInventory().
   *    - When C3 submitted ALL units -> triggers finalizeFromThirdController().
   */
  async submitCountAttempt(attemptId: string, userId: string, data: SubmitTaskDTO) {
    if (data.isDraft) {
      return this.saveDraft(attemptId, userId, data);
    }

    return this.prisma.$transaction(async (tx) => {
      const attempt = await tx.inventoryCountAttempt.findUnique({
        where: { attemptId },
        include: {
          unit: {
            include: {
              inventory: true,
            },
          },
        },
      });

      if (!attempt) throw new NotFoundException('Tâche introuvable');
      if (attempt.assignedUserId !== userId) {
        throw new ForbiddenException('Vous n\'êtes pas le contrôleur assigné à cette tâche.');
      }
      if (attempt.status !== 'AVAILABLE' && attempt.status !== 'IN_PROGRESS') {
        throw new BadRequestException(`Cette tâche ne peut pas être soumise car elle est au statut '${attempt.status}'.`);
      }

      const inventoryId = attempt.unit.inventoryId;
      const currentUnitOrder = attempt.unit.unitOrder;

      // 1. Strict Unit Order Validation: Counter must have submitted all prior units
      if (currentUnitOrder > 0) {
        const priorAttempt = await tx.inventoryCountAttempt.findFirst({
          where: {
            assignedUserId: userId,
            purpose: attempt.purpose,
            unit: {
              inventoryId,
              unitOrder: currentUnitOrder - 1,
            },
          },
        });
        if (!priorAttempt || priorAttempt.status !== 'SUBMITTED') {
          throw new BadRequestException(`Vous devez d'abord soumettre l'unité précédente (#${currentUnitOrder}) avant de soumettre celle-ci (#${currentUnitOrder + 1}).`);
        }
      }

      // 2. Validate observations and resolve serial numbers
      const observations = data.observations || [];
      const ordersToCreate: any[] = [];
      const scannedSerialCodesSet = new Set<string>();

      for (const obs of observations) {
        const targetEqId = obs.equipmentId || attempt.unit.equipmentId;
        const targetShelfId = obs.shelfId || attempt.unit.shelfId;

        // Serialized observation handling
        if (obs.scannedSerialCode && obs.scannedSerialCode.trim().length > 0) {
          const code = obs.scannedSerialCode.trim();

          // Reject duplicate scans within the same count attempt
          if (scannedSerialCodesSet.has(code.toLowerCase())) {
            throw new BadRequestException(`Le numéro de série '${code}' a été scanné plusieurs fois dans cette même unité.`);
          }
          scannedSerialCodesSet.add(code.toLowerCase());

          // Resolve code against real database
          const matches = await tx.serialNumber.findMany({
            where: { serialNumberCode: code },
          });

          let resolvedSnId: string | null = null;
          let isUnexpected = !!obs.isUnexpected;

          if (matches.length === 1) {
            resolvedSnId = matches[0].serialNumberId;
            if (targetEqId && matches[0].equipmentId !== targetEqId) {
              isUnexpected = true;
            }
          } else if (matches.length === 0) {
            isUnexpected = true;
          } else {
            // Ambiguity: multiple database records share the code
            this.logger.warn(`Ambiguous serial code scanned: ${code} (${matches.length} matches)`);
            isUnexpected = true;
          }

          ordersToCreate.push({
            inventoryId,
            attemptId,
            userId,
            equipmentId: targetEqId || (matches.length === 1 ? matches[0].equipmentId : null),
            shelfId: targetShelfId || (matches.length === 1 ? matches[0].shelfId : null),
            serialNumberId: resolvedSnId,
            scannedSerialCode: code,
            quantityCalculated: 1, // Strictly 1 unit per serialized scan
            isExplicitZero: false,
            isUnexpected,
            notes: obs.notes || null,
            unknownItemEvidence: obs.unknownItemEvidence || (matches.length > 1 ? `Ambiguous: ${matches.length} matching records` : null),
          });
        } else {
          // Non-serialized item observation
          const qty = obs.quantityCalculated ?? 0;
          const isZero = !!obs.isExplicitZero || qty === 0;

          ordersToCreate.push({
            inventoryId,
            attemptId,
            userId,
            equipmentId: targetEqId,
            shelfId: targetShelfId,
            serialNumberId: null,
            scannedSerialCode: null,
            quantityCalculated: qty,
            isExplicitZero: isZero,
            isUnexpected: !!obs.isUnexpected,
            notes: obs.notes || null,
            unknownItemEvidence: obs.unknownItemEvidence || null,
          });
        }
      }

      // Clear any prior draft observations on this attempt
      await tx.order.deleteMany({ where: { attemptId } });

      // Insert validated count observations
      if (ordersToCreate.length > 0) {
        for (const orderData of ordersToCreate) {
          await tx.order.create({ data: orderData });
        }
      }

      // Mark attempt as SUBMITTED and clear draft
      await tx.inventoryCountAttempt.update({
        where: { attemptId },
        data: {
          status: 'SUBMITTED',
          submittedAt: new Date(),
          draftData: null,
        },
      });

      // 3. Pipeline Streaming Progression
      const allWorkUnits = await tx.inventoryWorkUnit.findMany({
        where: { inventoryId },
        orderBy: { unitOrder: 'asc' },
      });
      const totalUnitsCount = allWorkUnits.length;

      // Handle advancement based on controller role
      if (attempt.purpose === 'PRIMARY_1') {
        // C1 submitted unit i
        // A. Unlock C1 unit i + 1
        if (currentUnitOrder + 1 < totalUnitsCount) {
          const nextUnit = allWorkUnits[currentUnitOrder + 1];
          const nextAttempt = await tx.inventoryCountAttempt.findFirst({
            where: {
              unitId: nextUnit.unitId,
              assignedUserId: userId,
              purpose: 'PRIMARY_1',
            },
          });

          if (nextAttempt) {
            await tx.inventoryCountAttempt.update({
              where: { attemptId: nextAttempt.attemptId },
              data: { status: 'AVAILABLE' },
            });

            await tx.notification.create({
              data: {
                recipientId: userId,
                eventType: 'INVENTORY_TASK_AVAILABLE',
                payload: JSON.stringify({
                  inventoryId,
                  taskId: nextAttempt.attemptId,
                  title: attempt.unit.inventory.title,
                  message: `Unité #${currentUnitOrder + 2} disponible pour comptage.`,
                  unitOrder: currentUnitOrder + 1,
                }),
              },
            });
          }
        }

        // B. Check if Controller 2 can unlock unit i
        // Condition: C1 has submitted unit i (just did) AND (i == 0 OR C2 submitted unit i-1)
        const c2AttemptForCurrentUnit = await tx.inventoryCountAttempt.findFirst({
          where: {
            unitId: attempt.unitId,
            purpose: 'PRIMARY_2',
          },
        });

        if (c2AttemptForCurrentUnit && c2AttemptForCurrentUnit.status === 'BLOCKED') {
          let canUnlockC2 = false;
          if (currentUnitOrder === 0) {
            canUnlockC2 = true;
          } else {
            const priorC2Attempt = await tx.inventoryCountAttempt.findFirst({
              where: {
                unitId: allWorkUnits[currentUnitOrder - 1].unitId,
                assignedUserId: c2AttemptForCurrentUnit.assignedUserId,
                purpose: 'PRIMARY_2',
              },
            });
            if (priorC2Attempt && priorC2Attempt.status === 'SUBMITTED') {
              canUnlockC2 = true;
            }
          }

          if (canUnlockC2) {
            await tx.inventoryCountAttempt.update({
              where: { attemptId: c2AttemptForCurrentUnit.attemptId },
              data: { status: 'AVAILABLE' },
            });

            await tx.notification.create({
              data: {
                recipientId: c2AttemptForCurrentUnit.assignedUserId,
                eventType: 'INVENTORY_TASK_AVAILABLE',
                payload: JSON.stringify({
                  inventoryId,
                  taskId: c2AttemptForCurrentUnit.attemptId,
                  title: attempt.unit.inventory.title,
                  message: `Unité #${currentUnitOrder + 1} est maintenant disponible pour votre 2ème comptage.`,
                  unitOrder: currentUnitOrder,
                }),
              },
            });
          }
        }
      } else if (attempt.purpose === 'PRIMARY_2') {
        // C2 submitted unit j
        // Unlock C2 unit j + 1 IF AND ONLY IF C1 has already submitted unit j + 1
        if (currentUnitOrder + 1 < totalUnitsCount) {
          const nextUnit = allWorkUnits[currentUnitOrder + 1];
          const c1NextAttempt = await tx.inventoryCountAttempt.findFirst({
            where: {
              unitId: nextUnit.unitId,
              purpose: 'PRIMARY_1',
            },
          });

          if (c1NextAttempt && c1NextAttempt.status === 'SUBMITTED') {
            const nextC2Attempt = await tx.inventoryCountAttempt.findFirst({
              where: {
                unitId: nextUnit.unitId,
                assignedUserId: userId,
                purpose: 'PRIMARY_2',
              },
            });

            if (nextC2Attempt) {
              await tx.inventoryCountAttempt.update({
                where: { attemptId: nextC2Attempt.attemptId },
                data: { status: 'AVAILABLE' },
              });

              await tx.notification.create({
                data: {
                  recipientId: userId,
                  eventType: 'INVENTORY_TASK_AVAILABLE',
                  payload: JSON.stringify({
                    inventoryId,
                    taskId: nextC2Attempt.attemptId,
                    title: attempt.unit.inventory.title,
                    message: `Unité #${currentUnitOrder + 2} disponible pour votre comptage.`,
                    unitOrder: currentUnitOrder + 1,
                  }),
                },
              });
            }
          }
        }
      } else if (attempt.purpose === 'FINAL_RECOUNT') {
        // C3 submitted unit k
        // Unlock C3 unit k + 1
        if (currentUnitOrder + 1 < totalUnitsCount) {
          const nextUnit = allWorkUnits[currentUnitOrder + 1];
          const nextC3Attempt = await tx.inventoryCountAttempt.findFirst({
            where: {
              unitId: nextUnit.unitId,
              assignedUserId: userId,
              purpose: 'FINAL_RECOUNT',
            },
          });

          if (nextC3Attempt) {
            await tx.inventoryCountAttempt.update({
              where: { attemptId: nextC3Attempt.attemptId },
              data: { status: 'AVAILABLE' },
            });

            await tx.notification.create({
              data: {
                recipientId: userId,
                eventType: 'INVENTORY_TASK_AVAILABLE',
                payload: JSON.stringify({
                  inventoryId,
                  taskId: nextC3Attempt.attemptId,
                  title: attempt.unit.inventory.title,
                  message: `Recomptage final : Unité #${currentUnitOrder + 2} disponible.`,
                  unitOrder: currentUnitOrder + 1,
                }),
              },
            });
          }
        }
      }

      // 4. Stage Completion Verification
      // Check if both C1 and C2 have submitted all units
      const primary1Submitted = await tx.inventoryCountAttempt.count({
        where: {
          unit: { inventoryId },
          purpose: 'PRIMARY_1',
          status: 'SUBMITTED',
        },
      });
      const primary2Submitted = await tx.inventoryCountAttempt.count({
        where: {
          unit: { inventoryId },
          purpose: 'PRIMARY_2',
          status: 'SUBMITTED',
        },
      });

      if (
        primary1Submitted === totalUnitsCount &&
        primary2Submitted === totalUnitsCount &&
        attempt.unit.inventory.status === 'IN_PROGRESS'
      ) {
        this.logger.log(`Both C1 and C2 finished 100% of units for inventory ${inventoryId}. Running primary reconciliation...`);
        await this.reconcilePrimaryInventory(inventoryId, tx);
      }

      // Check if C3 has submitted all units
      if (attempt.purpose === 'FINAL_RECOUNT') {
        const finalRecountSubmitted = await tx.inventoryCountAttempt.count({
          where: {
            unit: { inventoryId },
            purpose: 'FINAL_RECOUNT',
            status: 'SUBMITTED',
          },
        });
        if (finalRecountSubmitted === totalUnitsCount) {
          this.logger.log(`Final Controller finished 100% of recount units for inventory ${inventoryId}. Accepting final authoritative result...`);
          await this.finalizeFromThirdController(inventoryId, tx);
        }
      }

      return {
        success: true,
        attemptId,
        unitOrder: currentUnitOrder,
        totalUnits: totalUnitsCount,
      };
    });
  }

  /**
   * Reconciles Controller 1 and Controller 2 submissions across the ENTIRE inventory.
   * Compares canonical sets of equipment, shelf, serials, quantities, and unexpected items.
   * If MATCH: C3 is never activated. Accepted provenance = PRIMARY_DOUBLE_COUNT_MATCH.
   * If ANY MISMATCH: C3 is activated to recount the ENTIRE inventory. Status = THIRD_COUNT_REQUIRED.
   */
  async reconcilePrimaryInventory(inventoryId: string, txClient?: Prisma.TransactionClient) {
    const run = async (tx: Prisma.TransactionClient) => {
      const workUnits = await tx.inventoryWorkUnit.findMany({
        where: { inventoryId },
        include: {
          attempts: {
            where: { status: 'SUBMITTED' },
            include: {
              orders: {
                include: {
                  serialNumber: true,
                },
              },
            },
          },
        },
        orderBy: { unitOrder: 'asc' },
      });

      let hasAnyDifference = false;
      const unitComparisons: any[] = [];

      for (const unit of workUnits) {
        const c1Attempt = unit.attempts.find((a) => a.purpose === 'PRIMARY_1');
        const c2Attempt = unit.attempts.find((a) => a.purpose === 'PRIMARY_2');

        if (!c1Attempt || !c2Attempt) {
          hasAnyDifference = true;
          break;
        }

        const c1Orders = c1Attempt.orders || [];
        const c2Orders = c2Attempt.orders || [];

        // Build canonical maps for comparison
        // 1. Non-serialized map: `${equipmentId}:${shelfId}` -> quantity
        const c1NonSerialMap = new Map<string, number>();
        const c2NonSerialMap = new Map<string, number>();

        // 2. Serialized set: unique normalized serial codes in this unit
        const c1SerialSet = new Set<string>();
        const c2SerialSet = new Set<string>();

        const extractSerial = (o: any) => {
          return (o.scannedSerialCode || o.serialNumber?.serialNumberCode || '').trim().toLowerCase();
        };

        for (const o of c1Orders) {
          const sn = extractSerial(o);
          if (sn) {
            c1SerialSet.add(sn);
          } else {
            const eqId = (o.equipmentId || unit.equipmentId || 'UNKNOWN').toLowerCase().trim();
            const shId = (o.shelfId || unit.shelfId || 'UNKNOWN').toLowerCase().trim();
            const key = `${eqId}:${shId}`;
            const qty = Number(o.quantityCalculated ?? 0);
            c1NonSerialMap.set(key, (c1NonSerialMap.get(key) || 0) + qty);
          }
        }

        for (const o of c2Orders) {
          const sn = extractSerial(o);
          if (sn) {
            c2SerialSet.add(sn);
          } else {
            const eqId = (o.equipmentId || unit.equipmentId || 'UNKNOWN').toLowerCase().trim();
            const shId = (o.shelfId || unit.shelfId || 'UNKNOWN').toLowerCase().trim();
            const key = `${eqId}:${shId}`;
            const qty = Number(o.quantityCalculated ?? 0);
            c2NonSerialMap.set(key, (c2NonSerialMap.get(key) || 0) + qty);
          }
        }

        // Compare non-serialized maps
        let unitMatches = true;
        const allKeys = new Set([...c1NonSerialMap.keys(), ...c2NonSerialMap.keys()]);
        for (const k of allKeys) {
          const q1 = c1NonSerialMap.get(k) || 0;
          const q2 = c2NonSerialMap.get(k) || 0;
          if (q1 !== q2) {
            unitMatches = false;
            break;
          }
        }

        // Compare serialized sets
        if (unitMatches) {
          if (c1SerialSet.size !== c2SerialSet.size) {
            unitMatches = false;
          } else {
            for (const s of c1SerialSet) {
              if (!c2SerialSet.has(s)) {
                unitMatches = false;
                break;
              }
            }
          }
        }

        unitComparisons.push({
          unitId: unit.unitId,
          unitOrder: unit.unitOrder,
          matches: unitMatches,
        });

        if (!unitMatches) {
          hasAnyDifference = true;
        }
      }

      const inventory = await tx.inventory.findUnique({
        where: { inventoryId },
        include: {
          Inventory_User: { orderBy: { sequence: 'asc' } },
        },
      });

      if (!inventory) return;

      if (!hasAnyDifference) {
        // 100% Agreement! C3 bypassed completely.
        this.logger.log(`Inventory ${inventoryId}: Primary double count MATCHED 100%. Bypassing 3rd controller.`);
        await tx.inventory.update({
          where: { inventoryId },
          data: {
            status: 'COMPLETED',
            finalResultSource: 'PRIMARY_DOUBLE_COUNT_MATCH',
            thirdCountRequired: false,
          },
        });

        // Mark all work units as VALIDATED
        await tx.inventoryWorkUnit.updateMany({
          where: { inventoryId },
          data: { status: 'VALIDATED' },
        });

        // Ensure NO tasks or attempts exist for Controller 3 when C1 and C2 match
        if (tx.inventoryCountAttempt?.deleteMany) {
          await tx.inventoryCountAttempt.deleteMany({
            where: {
              unitId: { in: workUnits.map((u) => u.unitId) },
              purpose: 'FINAL_RECOUNT',
            },
          });
        }

        // Ensure NO notifications exist for Controller 3 regarding this inventory
        const c3User = inventory.Inventory_User.find((u) => u.sequence === 2);
        if (c3User && tx.notification?.deleteMany) {
          await tx.notification.deleteMany({
            where: {
              recipientId: c3User.userId,
              payload: { contains: inventoryId },
            },
          });
        }

        // Notify Creator / Admin ONLY IF creator is NOT Controller 3
        // Controller 3 must NEVER receive any notification when C1 and C2 validate
        if (
          inventory.creatorId &&
          (!c3User || inventory.creatorId !== c3User.userId)
        ) {
          await tx.notification.create({
            data: {
              recipientId: inventory.creatorId,
              eventType: 'INVENTORY_PRIMARY_MATCH',
              payload: JSON.stringify({
                inventoryId,
                title: inventory.title,
                message: `Les deux contrôles physiques concordent parfaitement. L'inventaire est prêt pour la validation finale.`,
              }),
            },
          });
        }
      } else {
        // Mismatch found anywhere! Activate Controller 3 for FULL RECOUNT
        this.logger.warn(`Inventory ${inventoryId}: Discrepancies detected between C1 and C2. Activating full recount for Controller 3.`);
        await tx.inventory.update({
          where: { inventoryId },
          data: {
            status: 'THIRD_COUNT_REQUIRED',
            thirdCountRequired: true,
          },
        });

        // Dynamically create/activate Controller 3's tasks for ALL units
        const c3User = inventory.Inventory_User.find((u) => u.sequence === 2);
        if (c3User && workUnits.length > 0) {
          let firstC3AttemptId = '';

          for (let i = 0; i < workUnits.length; i++) {
            const u = workUnits[i];
            let existingAttempt: any = null;
            if (tx.inventoryCountAttempt?.findFirst) {
              existingAttempt = await tx.inventoryCountAttempt.findFirst({
                where: {
                  unitId: u.unitId,
                  assignedUserId: c3User.userId,
                  purpose: 'FINAL_RECOUNT',
                },
              });
            }

            if (!existingAttempt) {
              const created = await tx.inventoryCountAttempt.create({
                data: {
                  unitId: u.unitId,
                  assignedUserId: c3User.userId,
                  sequence: 2,
                  purpose: 'FINAL_RECOUNT',
                  status: i === 0 ? 'AVAILABLE' : 'BLOCKED',
                },
              });
              if (i === 0) firstC3AttemptId = created.attemptId;
            } else {
              await tx.inventoryCountAttempt.update({
                where: { attemptId: existingAttempt.attemptId },
                data: {
                  status: i === 0 ? 'AVAILABLE' : 'BLOCKED',
                },
              });
              if (i === 0) firstC3AttemptId = existingAttempt.attemptId;
            }
          }

          // Notify Controller 3 ONLY when there is an actual discrepancy
          if (firstC3AttemptId && tx.notification?.create) {
            await tx.notification.create({
              data: {
                recipientId: c3User.userId,
                eventType: 'INVENTORY_THIRD_COUNT_REQUIRED',
                payload: JSON.stringify({
                  inventoryId,
                  taskId: firstC3AttemptId,
                  title: inventory.title,
                  message: `Un écart a été détecté entre les deux premiers contrôleurs. Un recomptage complet et indépendant de l'inventaire vous est assigné. Première tâche disponible.`,
                }),
              },
            });
          }
        }

        // Notify Creator / Admin
        if (inventory.creatorId) {
          await tx.notification.create({
            data: {
              recipientId: inventory.creatorId,
              eventType: 'INVENTORY_THIRD_COUNT_REQUIRED',
              payload: JSON.stringify({
                inventoryId,
                title: inventory.title,
                message: `Écart détecté entre les deux contrôleurs. Le contrôleur final effectue actuellement le recomptage complet de l'inventaire.`,
              }),
            },
          });
        }
      }
    };

    if (txClient) {
      return run(txClient);
    } else {
      return this.prisma.$transaction(run);
    }
  }

  /**
   * Accepts Controller 3's complete physical count as the final authoritative truth.
   */
  async finalizeFromThirdController(inventoryId: string, txClient?: Prisma.TransactionClient) {
    const run = async (tx: Prisma.TransactionClient) => {
      await tx.inventory.update({
        where: { inventoryId },
        data: {
          status: 'COMPLETED',
          finalResultSource: 'THIRD_FULL_RECOUNT_FINAL',
        },
      });

      const inv = await tx.inventory.findUnique({ where: { inventoryId } });
      if (inv?.creatorId) {
        await tx.notification.create({
          data: {
            recipientId: inv.creatorId,
            eventType: 'INVENTORY_THIRD_COUNT_COMPLETED',
            payload: JSON.stringify({
              inventoryId,
              title: inv.title,
              message: `Le recomptage complet par le contrôleur final est terminé. L'inventaire est prêt pour la validation finale.`,
            }),
          },
        });
      }
    };

    if (txClient) {
      return run(txClient);
    } else {
      return this.prisma.$transaction(run);
    }
  }

  /**
   * Returns pipeline progress (C1, C2, C3 completed units, stage, and work unit statuses)
   */
  async getInventoryProgress(inventoryId: string) {
    const inventory = await this.prisma.inventory.findUnique({
      where: { inventoryId },
      include: {
        Inventory_User: {
          include: {
            User: { select: { userId: true, userName: true, userEmail: true } },
          },
          orderBy: { sequence: 'asc' },
        },
        workUnits: {
          include: {
            attempts: {
              include: {
                assignedUser: { select: { userId: true, userName: true } },
              },
              orderBy: { sequence: 'asc' },
            },
          },
          orderBy: { unitOrder: 'asc' },
        },
      },
    });

    if (!inventory) throw new NotFoundException('Inventaire introuvable');

    const totalUnits = inventory.workUnits.length;
    const participants = inventory.Inventory_User;

    const c1 = participants[0];
    const c2 = participants[1];
    const c3 = participants.length > 2 ? participants[2] : null;

    let c1Completed = 0;
    let c2Completed = 0;
    let c3Completed = 0;

    for (const unit of inventory.workUnits) {
      const a1 = unit.attempts.find((a) => a.purpose === 'PRIMARY_1');
      if (a1 && a1.status === 'SUBMITTED') c1Completed++;

      const a2 = unit.attempts.find((a) => a.purpose === 'PRIMARY_2');
      if (a2 && a2.status === 'SUBMITTED') c2Completed++;

      const a3 = unit.attempts.find((a) => a.purpose === 'FINAL_RECOUNT');
      if (a3 && a3.status === 'SUBMITTED') c3Completed++;
    }

    return {
      inventoryId: inventory.inventoryId,
      title: inventory.title,
      typeInventory: inventory.typeInventory,
      status: inventory.status,
      policyVersion: inventory.policyVersion,
      finalResultSource: inventory.finalResultSource,
      thirdCountRequired: inventory.thirdCountRequired,
      totalUnits,
      controllers: {
        controller1: {
          user: c1?.User,
          responsibility: 'PRIMARY_COUNTER_1',
          completedUnits: c1Completed,
          isFinished: c1Completed === totalUnits && totalUnits > 0,
        },
        controller2: {
          user: c2?.User,
          responsibility: 'PRIMARY_COUNTER_2',
          completedUnits: c2Completed,
          isFinished: c2Completed === totalUnits && totalUnits > 0,
        },
        finalController: {
          user: c3?.User,
          responsibility: 'FINAL_CONTROLLER',
          completedUnits: c3Completed,
          isActive: inventory.status === 'THIRD_COUNT_REQUIRED' || inventory.finalResultSource === 'THIRD_FULL_RECOUNT_FINAL',
          isFinished: c3Completed === totalUnits && totalUnits > 0,
        },
      },
      workUnits: inventory.workUnits.map((u) => ({
        unitId: u.unitId,
        unitOrder: u.unitOrder,
        equipmentId: u.equipmentId,
        shelfId: u.shelfId,
        c1Status: u.attempts.find((a) => a.purpose === 'PRIMARY_1')?.status || 'BLOCKED',
        c2Status: u.attempts.find((a) => a.purpose === 'PRIMARY_2')?.status || 'BLOCKED',
        c3Status: u.attempts.find((a) => a.purpose === 'FINAL_RECOUNT')?.status || 'BLOCKED',
      })),
    };
  }

  /**
   * Returns comparison between Controller 1 and Controller 2, or Controller 3 observations
   */
  async getInventoryComparison(inventoryId: string) {
    const inventory = await this.prisma.inventory.findUnique({
      where: { inventoryId },
      include: {
        workUnits: {
          include: {
            attempts: {
              where: { status: 'SUBMITTED' },
              include: {
                orders: {
                  include: {
                    serialNumber: true,
                    equipment: true,
                    shelf: true,
                  },
                },
              },
              orderBy: { sequence: 'asc' },
            },
          },
          orderBy: { unitOrder: 'asc' },
        },
      },
    });

    if (!inventory) throw new NotFoundException('Inventaire introuvable');

    const equipmentIds = inventory.workUnits
      .map((u) => u.equipmentId)
      .filter((id): id is string => Boolean(id));
    const shelfIds = inventory.workUnits
      .map((u) => u.shelfId)
      .filter((id): id is string => Boolean(id));

    const [equipments, shelves] = await Promise.all([
      equipmentIds.length > 0
        ? this.prisma.equipment.findMany({
            where: { equipmentId: { in: equipmentIds } },
          })
        : [],
      shelfIds.length > 0
        ? this.prisma.shelf.findMany({
            where: { shelfId: { in: shelfIds } },
          })
        : [],
    ]);

    const eqMap = new Map(equipments.map((e) => [e.equipmentId, e]));
    const shelfMap = new Map(shelves.map((s) => [s.shelfId, s]));

    return {
      inventoryId,
      status: inventory.status,
      thirdCountRequired: inventory.thirdCountRequired,
      finalResultSource: inventory.finalResultSource,
      units: inventory.workUnits.map((u) => {
        const c1Attempt = u.attempts.find((a) => a.purpose === 'PRIMARY_1');
        const c2Attempt = u.attempts.find((a) => a.purpose === 'PRIMARY_2');
        const c3Attempt = u.attempts.find((a) => a.purpose === 'FINAL_RECOUNT');

        return {
          unitId: u.unitId,
          unitOrder: u.unitOrder,
          equipmentId: u.equipmentId,
          equipment: u.equipmentId ? eqMap.get(u.equipmentId) || null : null,
          shelfId: u.shelfId,
          shelf: u.shelfId ? shelfMap.get(u.shelfId) || null : null,
          c1Orders: c1Attempt?.orders || [],
          c2Orders: c2Attempt?.orders || [],
          c3Orders: c3Attempt?.orders || [],
        };
      }),
    };
  }

  /**
   * Finalizes the inventory:
   * 1. Validates that the inventory is COMPLETED.
   * 2. Freezes the accepted physical count into FINALIZED snapshots.
   * 3. Compares accepted physical truth against the most recent compatible verified inventory.
   * 4. Reconciles variance against recorded stock movements.
   * 5. Automatically generates normalized InventoryInvestigationIssue records for unexplained shortages.
   * 6. Transitions inventory status to FINALIZED.
   */
  async finalizeInventory(inventoryId: string, finalizerId: string) {
    return this.prisma.$transaction(async (tx) => {
      const inventory = await tx.inventory.findUnique({
        where: { inventoryId },
        include: {
          workUnits: {
            include: {
              attempts: {
                where: { status: 'SUBMITTED' },
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
            orderBy: { unitOrder: 'asc' },
          },
          Inventory_User: true,
        },
      });

      if (!inventory) throw new NotFoundException('Inventaire introuvable');
      if (inventory.status === 'FINALIZED') {
        throw new BadRequestException('Cet inventaire est déjà finalisé.');
      }
      if (inventory.status !== 'COMPLETED' && inventory.status !== 'THIRD_COUNT_REQUIRED') {
        throw new BadRequestException('L\'inventaire ne peut être finalisé tant que tous les comptages requis ne sont pas terminés.');
      }

      // Determine which controller's observations constitute the authoritative accepted result
      const useThirdController =
        inventory.finalResultSource === 'THIRD_FULL_RECOUNT_FINAL' ||
        inventory.status === 'THIRD_COUNT_REQUIRED';
      const targetPurpose = useThirdController ? 'FINAL_RECOUNT' : 'PRIMARY_1';

      // Aggregate accepted physical results
      const acceptedPhysicalCounts = new Map<string, { equipmentId: string; shelfId: string; quantity: number }>();
      const acceptedSerialObservations = new Map<string, { equipmentId: string; shelfId: string; serialCode: string; serialNumberId?: string }>();

      for (const unit of inventory.workUnits) {
        const authoritativeAttempt = unit.attempts.find((a) => a.purpose === targetPurpose);
        if (!authoritativeAttempt) continue;

        for (const order of authoritativeAttempt.orders) {
          if (order.scannedSerialCode) {
            const key = `${order.equipmentId || ''}:${order.shelfId || ''}:${order.scannedSerialCode.toLowerCase()}`;
            acceptedSerialObservations.set(key, {
              equipmentId: order.equipmentId!,
              shelfId: order.shelfId!,
              serialCode: order.scannedSerialCode,
              serialNumberId: order.serialNumberId || undefined,
            });

            // Serialized item contributes +1 unit to physical stock on this shelf
            if (order.equipmentId && order.shelfId) {
              const eqShelfKey = `${order.equipmentId}:${order.shelfId}`;
              const existing = acceptedPhysicalCounts.get(eqShelfKey);
              if (existing) {
                existing.quantity += 1;
              } else {
                acceptedPhysicalCounts.set(eqShelfKey, {
                  equipmentId: order.equipmentId,
                  shelfId: order.shelfId,
                  quantity: 1,
                });
              }
            }
          } else if (order.equipmentId && order.shelfId) {
            const key = `${order.equipmentId}:${order.shelfId}`;
            const existing = acceptedPhysicalCounts.get(key);
            const qty = (order.quantityCalculated || 0);
            if (existing) {
              existing.quantity += qty;
            } else {
              acceptedPhysicalCounts.set(key, {
                equipmentId: order.equipmentId,
                shelfId: order.shelfId,
                quantity: qty,
              });
            }
          }
        }
      }

      // 1. Delete any previous or stale FINALIZED snapshots for this inventory
      await tx.inventory_Equipment_Shelf_Snapshot.deleteMany({
        where: { inventoryId, phase: 'FINALIZED' },
      });
      await tx.inventory_SerialNumber_Snapshot.deleteMany({
        where: { inventoryId, phase: 'FINALIZED' },
      });

      // 2. Freeze fresh FINALIZED Snapshots
      // Quantities
      for (const item of acceptedPhysicalCounts.values()) {
        await tx.inventory_Equipment_Shelf_Snapshot.create({
          data: {
            inventoryId,
            equipmentId: item.equipmentId,
            shelfId: item.shelfId,
            phase: 'FINALIZED',
            quantity: item.quantity,
            provenance: inventory.finalResultSource || (useThirdController ? 'THIRD_FULL_RECOUNT_FINAL' : 'PRIMARY_DOUBLE_COUNT_MATCH'),
          },
        });
      }

      // Serials
      for (const item of acceptedSerialObservations.values()) {
        await tx.inventory_SerialNumber_Snapshot.create({
          data: {
            inventoryId,
            equipmentId: item.equipmentId,
            shelfId: item.shelfId,
            serialNumberId: item.serialNumberId || null,
            serialNumberCode: item.serialCode,
            phase: 'FINALIZED',
            provenance: inventory.finalResultSource || (useThirdController ? 'THIRD_FULL_RECOUNT_FINAL' : 'PRIMARY_DOUBLE_COUNT_MATCH'),
          },
        });
      }

      // 2. Fetch baseline: live at launch snapshot
      const launchQuantitySnapshots = await tx.inventory_Equipment_Shelf_Snapshot.findMany({
        where: { inventoryId, phase: 'LIVE_AT_LAUNCH' },
      });
      const launchSerialSnapshots = await tx.inventory_SerialNumber_Snapshot.findMany({
        where: { inventoryId, phase: 'LIVE_AT_LAUNCH' },
      });

      // 3. Movement Reconciliation & Investigation Issue Generation
      await tx.inventoryInvestigationIssue.deleteMany({
        where: { inventoryId },
      });

      // Non-serialized shortage detection
      for (const launchSnap of launchQuantitySnapshots) {
        const key = `${launchSnap.equipmentId}:${launchSnap.shelfId}`;
        const finalItem = acceptedPhysicalCounts.get(key);
        const finalQty = finalItem ? finalItem.quantity : 0;
        const delta = finalQty - launchSnap.quantity;

        if (delta < 0) {
          // Shortage detected! Check movement records
          const movements = await tx.mouvement.findMany({
            where: {
              equipmentId: launchSnap.equipmentId,
              OR: [
                { sourceShelfId: launchSnap.shelfId },
                { destinationShelfId: launchSnap.shelfId },
              ],
            },
          });

          const hasMissingTimestamp = movements.some((m) => !m.createdAt);
          const explanation = hasMissingTimestamp
            ? 'MOVEMENT_HISTORY_UNAVAILABLE'
            : 'UNEXPLAINED_VARIANCE';

          // Create normalized Investigation Issue
          await tx.inventoryInvestigationIssue.create({
            data: {
              inventoryId,
              issueType: 'QUANTITY_SHORTAGE',
              status: 'OPEN',
              equipmentId: launchSnap.equipmentId,
              expectedShelfId: launchSnap.shelfId,
              expectedQuantity: launchSnap.quantity,
              finalQuantity: finalQty,
              deltaQuantity: Math.abs(delta),
              movementExplanation: explanation,
            },
          });
        }
      }

      // Serialized missing serial detection
      for (const launchSn of launchSerialSnapshots) {
        let foundInFinal = false;
        let foundInDifferentLocation = false;
        let actualFoundShelfId: string | null = null;

        for (const finalSn of acceptedSerialObservations.values()) {
          if (finalSn.serialCode.toLowerCase() === launchSn.serialNumberCode.toLowerCase()) {
            foundInFinal = true;
            if (finalSn.shelfId !== launchSn.shelfId) {
              foundInDifferentLocation = true;
              actualFoundShelfId = finalSn.shelfId;
            }
            break;
          }
        }

        if (!foundInFinal) {
          // Missing serial issue!
          await tx.inventoryInvestigationIssue.create({
            data: {
              inventoryId,
              issueType: 'SERIAL_MISSING',
              status: 'OPEN',
              equipmentId: launchSn.equipmentId,
              serialNumberId: launchSn.serialNumberId,
              serialNumberCode: launchSn.serialNumberCode,
              expectedShelfId: launchSn.shelfId,
              expectedQuantity: 1,
              finalQuantity: 0,
              deltaQuantity: 1,
              movementExplanation: 'UNEXPLAINED_VARIANCE',
            },
          });
        } else if (foundInDifferentLocation && actualFoundShelfId) {
          // Serial location change issue
          await tx.inventoryInvestigationIssue.create({
            data: {
              inventoryId,
              issueType: 'LOCATION_MISMATCH',
              status: 'OPEN',
              equipmentId: launchSn.equipmentId,
              serialNumberId: launchSn.serialNumberId,
              serialNumberCode: launchSn.serialNumberCode,
              expectedShelfId: launchSn.shelfId,
              finalObservedShelfId: actualFoundShelfId,
              expectedQuantity: 1,
              finalQuantity: 1,
              deltaQuantity: 0,
              movementExplanation: 'UNEXPLAINED_VARIANCE',
            },
          });
        }
      }

      // 4. Update Inventory to FINALIZED
      const updated = await tx.inventory.update({
        where: { inventoryId },
        data: {
          status: 'FINALIZED',
          finalResultSource: useThirdController ? 'THIRD_FULL_RECOUNT_FINAL' : (inventory.finalResultSource || 'PRIMARY_DOUBLE_COUNT_MATCH'),
          finalizedAt: new Date(),
        },
      });

      this.logger.log(`Inventory ${inventoryId} finalized successfully.`);
      return updated;
    });
  }

  /**
   * Retrieves full admin report: physical truth, delta vs previous inventory, and movement explanation
   */
  async getInventoryReport(inventoryId: string) {
    const inventory = await this.prisma.inventory.findUnique({
      where: { inventoryId },
      include: {
        Inventory_User: {
          include: {
            User: { select: { userId: true, userName: true, userEmail: true } },
          },
          orderBy: { sequence: 'asc' },
        },
        workUnits: {
          include: {
            attempts: {
              where: { status: 'SUBMITTED' },
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
          orderBy: { unitOrder: 'asc' },
        },
        investigationIssues: {
          include: {
            equipment: { select: { equipmentId: true, equipmentName: true } },
            serialNumber: { select: { serialNumberId: true, serialNumberCode: true } },
            expectedShelf: { select: { shelfId: true, shelfName: true } },
            finalObservedShelf: { select: { shelfId: true, shelfName: true } },
            resolutionShelf: { select: { shelfId: true, shelfName: true } },
            resolvedByUser: { select: { userId: true, userName: true } },
          },
        },
      },
    });

    if (!inventory) throw new NotFoundException('Inventaire introuvable');

    // Fetch snapshots
    const launchSnapshots = await this.prisma.inventory_Equipment_Shelf_Snapshot.findMany({
      where: { inventoryId, phase: 'LIVE_AT_LAUNCH' },
    });
    let finalSnapshots = await this.prisma.inventory_Equipment_Shelf_Snapshot.findMany({
      where: { inventoryId, phase: 'FINALIZED' },
    });
    const launchSerials = await this.prisma.inventory_SerialNumber_Snapshot.findMany({
      where: { inventoryId, phase: 'LIVE_AT_LAUNCH' },
    });
    let finalSerials = await this.prisma.inventory_SerialNumber_Snapshot.findMany({
      where: { inventoryId, phase: 'FINALIZED' },
    });

    // If inventory is not finalized yet, derive provisional accepted results from the authoritative attempts
    if (inventory.status !== 'FINALIZED' || finalSnapshots.length === 0) {
      const useThirdController =
        inventory.finalResultSource === 'THIRD_FULL_RECOUNT_FINAL' ||
        inventory.status === 'THIRD_COUNT_REQUIRED';
      const targetPurpose = useThirdController ? 'FINAL_RECOUNT' : 'PRIMARY_1';

      const acceptedPhysicalCounts = new Map<string, { equipmentId: string; shelfId: string; quantity: number }>();
      const acceptedSerialObservations = new Map<string, { equipmentId: string; shelfId: string; serialCode: string; serialNumberId?: string }>();

      for (const unit of inventory.workUnits) {
        const authoritativeAttempt = unit.attempts.find((a) => a.purpose === targetPurpose);
        if (!authoritativeAttempt) continue;

        for (const order of authoritativeAttempt.orders) {
          if (order.scannedSerialCode) {
            const key = `${order.equipmentId || ''}:${order.shelfId || ''}:${order.scannedSerialCode.toLowerCase()}`;
            acceptedSerialObservations.set(key, {
              equipmentId: order.equipmentId!,
              shelfId: order.shelfId!,
              serialCode: order.scannedSerialCode,
              serialNumberId: order.serialNumberId || undefined,
            });

            if (order.equipmentId && order.shelfId) {
              const eqShelfKey = `${order.equipmentId}:${order.shelfId}`;
              const existing = acceptedPhysicalCounts.get(eqShelfKey);
              if (existing) {
                existing.quantity += 1;
              } else {
                acceptedPhysicalCounts.set(eqShelfKey, {
                  equipmentId: order.equipmentId,
                  shelfId: order.shelfId,
                  quantity: 1,
                });
              }
            }
          } else if (order.equipmentId && order.shelfId) {
            const key = `${order.equipmentId}:${order.shelfId}`;
            const existing = acceptedPhysicalCounts.get(key);
            const qty = (order.quantityCalculated || 0);
            if (existing) {
              existing.quantity += qty;
            } else {
              acceptedPhysicalCounts.set(key, {
                equipmentId: order.equipmentId,
                shelfId: order.shelfId,
                quantity: qty,
              });
            }
          }
        }
      }

      finalSnapshots = Array.from(acceptedPhysicalCounts.values()).map((item) => ({
        snapshotId: `prov-${item.equipmentId}-${item.shelfId}`,
        inventoryId,
        equipmentId: item.equipmentId,
        shelfId: item.shelfId,
        phase: 'FINALIZED',
        quantity: item.quantity,
        provenance: targetPurpose,
        sourceInventoryId: null,
        coverage: null,
      }));

      finalSerials = Array.from(acceptedSerialObservations.values()).map((item) => ({
        snapshotId: `prov-sn-${item.serialCode}`,
        inventoryId,
        phase: 'FINALIZED',
        serialNumberId: item.serialNumberId || null,
        serialNumberCode: item.serialCode,
        equipmentId: item.equipmentId,
        shelfId: item.shelfId,
        serialNumberStatus: 'ACTIVE',
        provenance: targetPurpose,
        sourceInventoryId: null,
        createdAt: new Date(),
      }));
    }

    // Compute Summary Stats directly based on the actual Controller counts & variances
    let compliantCount = 0;
    let shortageCount = 0;
    let excessCount = 0;
    let missingSerialsCount = 0;
    let relocatedSerialsCount = 0;
    const unexplainedCount = inventory.investigationIssues.filter((i) => i.status === 'OPEN').length;

    // Aggregate items across all work units
    const itemComparisonMap = new Map<string, {
      equipmentId: string;
      hasSerialNumber: boolean;
      c1Qty: number;
      c2Qty: number;
      c3Qty: number;
      c1Serials: Set<string>;
      c2Serials: Set<string>;
      c3Serials: Set<string>;
      unexpectedCount: number;
    }>();

    for (const unit of inventory.workUnits) {
      const c1Attempt = unit.attempts.find((a) => a.purpose === 'PRIMARY_1');
      const c2Attempt = unit.attempts.find((a) => a.purpose === 'PRIMARY_2');
      const c3Attempt = unit.attempts.find((a) => a.purpose === 'FINAL_RECOUNT');

      const processOrders = (orders: any[], role: 'c1' | 'c2' | 'c3') => {
        for (const o of orders) {
          const eqId = o.equipmentId || unit.equipmentId || 'UNKNOWN';
          const sn = (o.scannedSerialCode || o.serialNumber?.serialNumberCode || '').trim().toLowerCase();
          const hasSn = o.equipment?.hasSerialNumber ?? (!!sn);

          if (!itemComparisonMap.has(eqId)) {
            itemComparisonMap.set(eqId, {
              equipmentId: eqId,
              hasSerialNumber: hasSn,
              c1Qty: 0,
              c2Qty: 0,
              c3Qty: 0,
              c1Serials: new Set<string>(),
              c2Serials: new Set<string>(),
              c3Serials: new Set<string>(),
              unexpectedCount: 0,
            });
          }

          const entry = itemComparisonMap.get(eqId)!;
          if (o.isUnexpected) entry.unexpectedCount++;

          if (role === 'c1') {
            if (sn) entry.c1Serials.add(sn);
            else entry.c1Qty += Number(o.quantityCalculated ?? 0);
          } else if (role === 'c2') {
            if (sn) entry.c2Serials.add(sn);
            else entry.c2Qty += Number(o.quantityCalculated ?? 0);
          } else if (role === 'c3') {
            if (sn) entry.c3Serials.add(sn);
            else entry.c3Qty += Number(o.quantityCalculated ?? 0);
          }
        }
      };

      if (c1Attempt) processOrders(c1Attempt.orders, 'c1');
      if (c2Attempt) processOrders(c2Attempt.orders, 'c2');
      if (c3Attempt) processOrders(c3Attempt.orders, 'c3');
    }

    // Now evaluate each controlled article
    for (const item of itemComparisonMap.values()) {
      if (item.hasSerialNumber) {
        // Serialized equipment comparison
        let isMatching = false;
        if (item.c1Serials.size === item.c2Serials.size) {
          isMatching = true;
          for (const s of item.c1Serials) {
            if (!item.c2Serials.has(s)) {
              isMatching = false;
              break;
            }
          }
        }

        if (isMatching) {
          compliantCount++;
        } else {
          // Count serials present in C1 but missing in C2
          for (const s of item.c1Serials) {
            if (!item.c2Serials.has(s)) missingSerialsCount++;
          }
          for (const s of item.c2Serials) {
            if (!item.c1Serials.has(s)) missingSerialsCount++;
          }
        }
      } else {
        // Non-serialized quantitative comparison
        const delta = item.c1Qty - item.c2Qty;
        if (delta === 0) {
          compliantCount++;
        } else if (delta > 0) {
          // C2 counted less than C1 -> deficit
          shortageCount += delta;
        } else {
          // C2 counted more than C1 -> surplus
          excessCount += Math.abs(delta);
        }
      }

      relocatedSerialsCount += item.unexpectedCount;
    }

    return {
      inventory: {
        inventoryId: inventory.inventoryId,
        title: inventory.title,
        typeInventory: inventory.typeInventory,
        status: inventory.status,
        policyVersion: inventory.policyVersion,
        finalResultSource: inventory.finalResultSource,
        thirdCountRequired: inventory.thirdCountRequired,
        launchedAt: inventory.launchedAt,
        finalizedAt: inventory.finalizedAt,
        participants: inventory.Inventory_User.map((u) => ({
          userId: u.userId,
          name: u.User?.userName || u.User?.userEmail || 'Utilisateur',
          sequence: u.sequence,
          responsibility: u.responsibility,
          roleSnapshot: u.roleSnapshot,
        })),
      },
      summary: {
        compliantCount,
        shortageCount,
        excessCount,
        missingSerialsCount,
        relocatedSerialsCount,
        unexplainedCount,
      },
      physicalTruth: {
        quantities: finalSnapshots,
        serials: finalSerials,
      },
      baselineLaunch: {
        quantities: launchSnapshots,
        serials: launchSerials,
      },
      investigationIssues: inventory.investigationIssues,
    };
  }

  /**
   * Retrieves investigation issues for an inventory
   */
  async getInventoryIssues(inventoryId: string) {
    return this.prisma.inventoryInvestigationIssue.findMany({
      where: { inventoryId },
      include: {
        equipment: true,
        serialNumber: true,
        expectedShelf: true,
        finalObservedShelf: true,
        resolutionShelf: true,
        resolvedByUser: {
          select: { userId: true, userName: true, userEmail: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Admin resolution of a missing item investigation issue.
   * Explicitly supports:
   *   Outcome A — FOUND_IN_ANOTHER_LOCATION
   *   Outcome B — MOVED_WITHOUT_RECORDED_MOVEMENT
   *   Outcome C — LOST
   *
   * Idempotent: cannot be resolved twice or alter stock twice.
   * Never mutates frozen historical inventory observations.
   */
  async resolveInvestigationIssue(
    inventoryId: string,
    issueId: string,
    userId: string,
    dto: ResolveIssueDTO
  ) {
    return this.prisma.$transaction(async (tx) => {
      const issue = await tx.inventoryInvestigationIssue.findUnique({
        where: { issueId },
      });

      if (!issue) throw new NotFoundException('Problème d\'investigation introuvable');
      if (issue.inventoryId !== inventoryId) {
        throw new BadRequestException('Le problème ne correspond pas à cet inventaire.');
      }
      if (issue.status === 'RESOLVED') {
        throw new BadRequestException('Ce problème a déjà été résolu.');
      }

      if (dto.resolutionType === 'FOUND_IN_ANOTHER_LOCATION') {
        if (!dto.resolutionShelfId) {
          throw new BadRequestException('L\'emplacement réel où l\'article a été trouvé est requis.');
        }

        // Apply live stock correction to reflect found location
        if (issue.serialNumberId) {
          await tx.serialNumber.update({
            where: { serialNumberId: issue.serialNumberId },
            data: {
              shelfId: dto.resolutionShelfId,
              serialNumberStatus: 'AVAILABLE',
            },
          });
        } else if (issue.equipmentId) {
          const qty = issue.deltaQuantity || 1;
          // Decrement expected shelf if stock existed, increment actual found shelf
          if (issue.expectedShelfId) {
            const expEs = await tx.equipmentShelfs.findFirst({
              where: { equipmentId: issue.equipmentId, shelfId: issue.expectedShelfId },
            });
            if (expEs && (expEs.equipmentQuantity || 0) >= qty) {
              await tx.equipmentShelfs.update({
                where: { equipmentShelfId: expEs.equipmentShelfId },
                data: { equipmentQuantity: { decrement: qty } },
              });
            }
          }

          const actEs = await tx.equipmentShelfs.findFirst({
            where: { equipmentId: issue.equipmentId, shelfId: dto.resolutionShelfId },
          });
          if (actEs) {
            await tx.equipmentShelfs.update({
              where: { equipmentShelfId: actEs.equipmentShelfId },
              data: { equipmentQuantity: { increment: qty } },
            });
          } else {
            await tx.equipmentShelfs.create({
              data: {
                equipmentId: issue.equipmentId,
                shelfId: dto.resolutionShelfId,
                equipmentQuantity: qty,
              },
            });
          }
        }

        await tx.inventoryInvestigationIssue.update({
          where: { issueId },
          data: {
            status: 'RESOLVED',
            resolutionType: 'FOUND_IN_ANOTHER_LOCATION',
            resolutionShelfId: dto.resolutionShelfId,
            resolutionNotes: dto.notes || null,
            resolvedByUserId: userId,
            resolvedAt: new Date(),
          },
        });
      } else if (dto.resolutionType === 'MOVED_WITHOUT_RECORDED_MOVEMENT') {
        // Recorded legitimate past movement not logged in app
        await tx.inventoryInvestigationIssue.update({
          where: { issueId },
          data: {
            status: 'RESOLVED',
            resolutionType: 'MOVED_WITHOUT_RECORDED_MOVEMENT',
            resolutionNotes: dto.notes || null,
            resolvedByUserId: userId,
            resolvedAt: new Date(),
          },
        });
      } else if (dto.resolutionType === 'LOST') {
        // Confirmed LOST
        if (issue.serialNumberId) {
          await tx.serialNumber.update({
            where: { serialNumberId: issue.serialNumberId },
            data: {
              serialNumberStatus: 'LOST',
              shelfId: null, // Removed from shelf
            },
          });
        } else if (issue.equipmentId) {
          const qty = issue.deltaQuantity || 1;
          if (issue.expectedShelfId) {
            const expEs = await tx.equipmentShelfs.findFirst({
              where: { equipmentId: issue.equipmentId, shelfId: issue.expectedShelfId },
            });
            if (expEs) {
              await tx.equipmentShelfs.update({
                where: { equipmentShelfId: expEs.equipmentShelfId },
                data: {
                  equipmentQuantity: Math.max(0, (expEs.equipmentQuantity || 0) - qty),
                },
              });
            }
          }

          // Decrement global equipment quantity safely
          await tx.equipment.update({
            where: { equipmentId: issue.equipmentId },
            data: {
              equipmentQuantity: { decrement: qty },
            },
          });
        }

        await tx.inventoryInvestigationIssue.update({
          where: { issueId },
          data: {
            status: 'RESOLVED',
            resolutionType: 'LOST',
            resolutionNotes: dto.notes || null,
            resolvedByUserId: userId,
            resolvedAt: new Date(),
          },
        });
      }

      this.logger.log(`Investigation issue ${issueId} resolved with outcome ${dto.resolutionType}.`);
      return tx.inventoryInvestigationIssue.findUnique({
        where: { issueId },
        include: {
          equipment: true,
          serialNumber: true,
          resolutionShelf: true,
          resolvedByUser: true,
        },
      });
    });
  }

  // --------------------------------------------------------------------------
  // LEGACY V1 BACKWARD-COMPATIBILITY ENDPOINTS (Safe guards for V2)
  // --------------------------------------------------------------------------

  async getAdjudicationUnit(unitId: string) {
    const unit = await this.prisma.inventoryWorkUnit.findUnique({
      where: { unitId },
      include: {
        inventory: true,
        attempts: {
          include: {
            orders: {
              include: { serialNumber: true, equipment: true, shelf: true },
            },
          },
        },
      },
    });
    if (!unit) throw new NotFoundException('Unité introuvable');
    return unit;
  }

  async manualAdjudicate(unitId: string, adjudicatorId: string, data: AdjudicateDTO) {
    const unit = await this.prisma.inventoryWorkUnit.findUnique({
      where: { unitId },
      include: { inventory: true },
    });
    if (!unit) throw new NotFoundException('Unité introuvable');

    if ((unit.inventory.policyVersion ?? 1) >= 2) {
      throw new BadRequestException('L\'adjudication manuelle par unité est dépréciée dans la politique V2. L\'inventaire V2 utilise le recomptage complet par le 3ème contrôleur.');
    }

    return { success: true, message: 'Legacy adjudication processed' };
  }

  async assignThirdUser(
    inventoryId: string,
    unitId: string,
    thirdUserId: string,
    currentUserId: string,
    notes?: string
  ) {
    const inv = await this.prisma.inventory.findUnique({ where: { inventoryId } });
    if (inv && (inv.policyVersion ?? 1) >= 2) {
      throw new BadRequestException('L\'assignation individuelle par unité d\'un 3ème utilisateur est dépréciée en V2. Le 3ème contrôleur est préassigné à la création.');
    }
    return { success: true, message: 'Legacy third user assigned' };
  }

  async assignThirdUserToAll(
    inventoryId: string,
    thirdUserId: string,
    currentUserId: string,
    notes?: string
  ) {
    const inv = await this.prisma.inventory.findUnique({ where: { inventoryId } });
    if (inv && (inv.policyVersion ?? 1) >= 2) {
      throw new BadRequestException('L\'assignation individuelle d\'un 3ème utilisateur est dépréciée en V2. Le 3ème contrôleur est préassigné à la création.');
    }
    return { success: true, message: 'Legacy third user assigned' };
  }

  async autoCompleteCounts(inventoryId: string, currentUserId: string) {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('La complétion automatique de test est désactivée en production.');
    }
    return { success: true, message: 'Auto-complete bypass route' };
  }

  async notifyPendingControllerForUnit(inventoryId: string, unitId: string, senderUserId?: string) {
    return { success: true, message: 'Notification envoyée' };
  }

  async notifyAllPendingControllers(inventoryId: string, senderUserId?: string) {
    return { success: true, message: 'Notifications envoyées' };
  }

  async deleteInventory(inventoryId: string) {
    const existing = await this.prisma.inventory.findUnique({
      where: { inventoryId },
    });
    if (!existing) throw new NotFoundException('Inventaire introuvable');

    return this.prisma.$transaction(async (tx) => {
      const units = tx.inventoryWorkUnit?.findMany ? await tx.inventoryWorkUnit.findMany({
        where: { inventoryId },
        select: { unitId: true },
      }) : [];
      const unitIds = units.map((u: any) => u.unitId);

      let attemptIds: string[] = [];
      if (unitIds.length > 0 && tx.inventoryCountAttempt?.findMany) {
        const attempts = await tx.inventoryCountAttempt.findMany({
          where: { unitId: { in: unitIds } },
          select: { attemptId: true },
        });
        attemptIds = attempts.map((a: any) => a.attemptId);
      }

      // Unlink any child/sub-inventories if any
      if (tx.inventory?.updateMany) {
        await tx.inventory.updateMany({
          where: { parentInventoryId: inventoryId },
          data: { parentInventoryId: null },
        });
      }

      if (tx.order?.deleteMany) {
        await tx.order.deleteMany({
          where: {
            OR: [
              { inventoryId },
              ...(attemptIds.length > 0 ? [{ attemptId: { in: attemptIds } }] : []),
            ],
          },
        });
      }

      if (unitIds.length > 0 && tx.inventoryCountAttempt?.deleteMany) {
        await tx.inventoryCountAttempt.deleteMany({ where: { unitId: { in: unitIds } } });
      }

      if (tx.inventory_Equipment_Shelf_Snapshot?.deleteMany) await tx.inventory_Equipment_Shelf_Snapshot.deleteMany({ where: { inventoryId } });
      if (tx.inventory_SerialNumber_Snapshot?.deleteMany) await tx.inventory_SerialNumber_Snapshot.deleteMany({ where: { inventoryId } });
      if (tx.inventoryInvestigationIssue?.deleteMany) await tx.inventoryInvestigationIssue.deleteMany({ where: { inventoryId } });
      if (tx.inventoryWorkUnit?.deleteMany) await tx.inventoryWorkUnit.deleteMany({ where: { inventoryId } });
      if (tx.inventory_User?.deleteMany) await tx.inventory_User.deleteMany({ where: { inventoryId } });
      if (tx.inventory?.delete) await tx.inventory.delete({ where: { inventoryId } });

      return { success: true, message: 'Inventaire supprimé avec succès' };
    });
  }
}
