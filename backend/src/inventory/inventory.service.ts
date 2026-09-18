import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { PaginationDTO, CreateInventoryDTO, SubmitTaskDTO, AdjudicateDTO, AssignThirdUserDTO } from './dto/index.js';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retrieves all inventories
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
          Inventory_User: true,
        }
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
   * Retrieves a specific inventory by ID
   */
  async getInventoryById(inventoryId: string) {
    const inventory = await this.prisma.inventory.findUnique({
      where: { inventoryId },
      include: {
        Inventory_User: true,
      }
    });
    if (!inventory) throw new NotFoundException('Inventory not found');
    return inventory;
  }

  /**
   * Retrieves a specific count task (attempt)
   */
  async getTask(attemptId: string) {
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
                },
              },
            },
          },
        },
        orders: {
          include: {
            serialNumber: true,
            equipment: true,
            shelf: true,
          },
        },
      },
    });
    if (!attempt) throw new NotFoundException('Task not found');

    let equipment = null;
    if (attempt.unit.equipmentId) {
      equipment = await this.prisma.equipment.findUnique({
        where: { equipmentId: attempt.unit.equipmentId },
        include: {
          equipmentShelfs: {
            include: {
              shelf: true,
            },
          },
          serialNumbers: {
            include: {
              shelf: true,
            },
          },
        },
      });
    }

    let shelf = null;
    if (attempt.unit.shelfId) {
      shelf = await this.prisma.shelf.findUnique({
        where: { shelfId: attempt.unit.shelfId },
        include: {
          equipmentShelfs: {
            include: {
              equipment: true,
            },
          },
        },
      });
    }

    const inventory = attempt.unit.inventory;
    const isByEquipment = inventory.typeInventory === 'ByEquipment';
    const isByShelf = inventory.typeInventory === 'ByShelf';

    const scopeDetails: {
      type: string;
      equipments: Array<{
        equipmentId: string;
        equipmentName: string;
        hasSerialNumber: boolean;
        totalQuantity: number;
        shelves: Array<{
          shelfId: string;
          shelfName: string;
          quantity: number;
        }>;
        serialNumbers: Array<{
          serialNumberId: string;
          serialNumberCode: string;
          serialNumberStatus: string;
          shelfId: string | null;
          shelfName: string | null;
        }>;
      }>;
      shelves: Array<{
        shelfId: string;
        shelfName: string;
        equipments: Array<{
          equipmentId: string;
          equipmentName: string;
          hasSerialNumber: boolean;
          quantity: number;
        }>;
        serialNumbers: Array<{
          serialNumberId: string;
          serialNumberCode: string;
          serialNumberStatus: string;
          equipmentId: string | null;
          equipmentName: string | null;
        }>;
      }>;
    } = {
      type: inventory.typeInventory || 'ByEquipment',
      equipments: [],
      shelves: [],
    };

    if (isByEquipment) {
      let equipmentIds: string[] = [];
      if (inventory.equipmentScopeIds) {
        try {
          equipmentIds = JSON.parse(inventory.equipmentScopeIds);
        } catch {
          equipmentIds = [];
        }
      }
      if (equipmentIds.length === 0 && attempt.unit.equipmentId) {
        equipmentIds = [attempt.unit.equipmentId];
      }

      if (equipmentIds.length > 0) {
        const equipments = await this.prisma.equipment.findMany({
          where: { equipmentId: { in: equipmentIds } },
          include: {
            equipmentShelfs: {
              include: {
                shelf: true,
              },
            },
            serialNumbers: {
              include: {
                shelf: true,
              },
            },
          },
        });

        scopeDetails.equipments = equipments.map((eq) => ({
          equipmentId: eq.equipmentId,
          equipmentName: eq.equipmentName,
          hasSerialNumber: eq.hasSerialNumber,
          totalQuantity: eq.equipmentQuantity,
          shelves: eq.equipmentShelfs.map((es) => ({
            shelfId: es.shelfId ?? '',
            shelfName: es.shelf?.shelfName ?? 'Étagère non définie',
            quantity: es.equipmentQuantity ?? 0,
          })),
          serialNumbers: eq.serialNumbers.map((sn) => ({
            serialNumberId: sn.serialNumberId,
            serialNumberCode: sn.serialNumberCode ?? '',
            serialNumberStatus: sn.serialNumberStatus ?? '',
            shelfId: sn.shelfId,
            shelfName: sn.shelf?.shelfName ?? null,
          })),
        }));
      }
    } else if (isByShelf) {
      let shelfIds: string[] = [];
      if (inventory.shelfScopeIds) {
        try {
          shelfIds = JSON.parse(inventory.shelfScopeIds);
        } catch {
          shelfIds = [];
        }
      }
      if (shelfIds.length === 0 && attempt.unit.shelfId) {
        shelfIds = [attempt.unit.shelfId];
      }

      if (shelfIds.length > 0) {
        const shelves = await this.prisma.shelf.findMany({
          where: { shelfId: { in: shelfIds } },
          include: {
            equipmentShelfs: {
              include: {
                equipment: {
                  include: {
                    equipmentShelfs: {
                      include: {
                        shelf: true,
                      },
                    },
                  },
                },
              },
            },
            serialNumbers: {
              include: {
                equipment: true,
              },
            },
          },
        });

        scopeDetails.shelves = shelves.map((sh) => ({
          shelfId: sh.shelfId,
          shelfName: sh.shelfName ?? 'Étagère sans nom',
          equipments: sh.equipmentShelfs.map((es) => ({
            equipmentId: es.equipmentId ?? '',
            equipmentName: es.equipment?.equipmentName ?? 'Équipement inconnu',
            hasSerialNumber: es.equipment?.hasSerialNumber ?? false,
            quantity: es.equipmentQuantity ?? 0,
            allShelves: (es.equipment?.equipmentShelfs || []).map((otherEs) => ({
              shelfId: otherEs.shelfId ?? '',
              shelfName: otherEs.shelf?.shelfName ?? 'Étagère non définie',
              quantity: otherEs.equipmentQuantity ?? 0,
            })),
          })),
          serialNumbers: sh.serialNumbers.map((sn) => ({
            serialNumberId: sn.serialNumberId,
            serialNumberCode: sn.serialNumberCode ?? '',
            serialNumberStatus: sn.serialNumberStatus ?? '',
            equipmentId: sn.equipmentId,
            equipmentName: sn.equipment?.equipmentName ?? null,
          })),
        }));
      }
    }

    return {
      ...attempt,
      unit: {
        ...attempt.unit,
        equipment,
        shelf,
      },
      scopeDetails,
    };
  }

  /**
   * Retrieves an adjudication unit (WorkUnit + Discrepancy + Attempts)
   */
  async getAdjudicationUnit(unitId: string) {
    const unit = await this.prisma.inventoryWorkUnit.findUnique({
      where: { unitId },
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
            },
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
            orders: {
              include: {
                shelf: true,
                equipment: true,
                serialNumber: true,
              },
            },
          },
        },
      },
    });
    if (!unit) throw new NotFoundException('Unit not found');

    let equipment = null;
    if (unit.equipmentId) {
      equipment = await this.prisma.equipment.findUnique({
        where: { equipmentId: unit.equipmentId },
        include: {
          equipmentShelfs: {
            include: {
              shelf: true,
            },
          },
          serialNumbers: {
            include: {
              shelf: true,
            },
          },
        },
      });
    }

    let shelf = null;
    if (unit.shelfId) {
      shelf = await this.prisma.shelf.findUnique({
        where: { shelfId: unit.shelfId },
        include: {
          equipmentShelfs: {
            include: {
              equipment: true,
            },
          },
          serialNumbers: {
            include: {
              equipment: true,
            },
          },
        },
      });
    }

    // Format equipment nicely with shelves and serialNumbers
    const formattedEquipment = equipment
      ? {
          ...equipment,
          shelves:
            equipment.equipmentShelfs?.map((es) => ({
              shelfId: es.shelfId ?? '',
              shelfName: es.shelf?.shelfName ?? 'Étagère non définie',
              quantity: es.equipmentQuantity ?? 0,
            })) || [],
          serialNumbers:
            equipment.serialNumbers?.map((sn) => ({
              serialNumberId: sn.serialNumberId,
              serialNumberCode: sn.serialNumberCode ?? '',
              serialNumberStatus: sn.serialNumberStatus ?? '',
              shelfId: sn.shelfId,
              shelfName: sn.shelf?.shelfName ?? null,
            })) || [],
        }
      : null;

    return {
      ...unit,
      equipment: formattedEquipment,
      shelf,
    };
  }

  /**
   * Creates a new inventory draft
   */
  async createInventory(data: CreateInventoryDTO, creatorId: string) {
    const { title, typeInventory, users, equipmentIds, shelfIds } = data;

    if (!users || users.length < 2) {
      throw new BadRequestException('Un inventaire doit comporter au moins 2 participants distincts.');
    }
    const distinctUserIds = new Set(users.map((u) => u.userId));
    if (distinctUserIds.size < 2) {
      throw new BadRequestException('Les participants doivent être au moins 2 utilisateurs distincts.');
    }

    return this.prisma.$transaction(async (tx) => {
      // Create the parent inventory
      const inventory = await tx.inventory.create({
        data: {
          title,
          typeInventory,
          status: 'DRAFT',
        },
      });

      // Add participants with sequence based on role
      if (users && users.length > 0) {
        await tx.inventory_User.createMany({
          data: users.map((u) => ({
            inventoryId: inventory.inventoryId,
            userId: u.userId,
            sequence: u.responsibility === 'ADJUDICATE' ? 1 : 0,
            responsibility: u.responsibility || 'COUNT',
          })),
        });
      }

      // Add scope as JSON
      if (typeInventory === 'ByEquipment' && equipmentIds) {
        await tx.inventory.update({
          where: { inventoryId: inventory.inventoryId },
          data: { equipmentScopeIds: JSON.stringify(equipmentIds) }
        });
      } else if (typeInventory === 'ByShelf' && shelfIds) {
        await tx.inventory.update({
          where: { inventoryId: inventory.inventoryId },
          data: { shelfScopeIds: JSON.stringify(shelfIds) }
        });
      }

      return inventory;
    });
  }

  /**
   * Launches the inventory workflow
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

      if (!inventory) throw new NotFoundException('Inventory not found');
      if (inventory.status !== 'DRAFT') throw new BadRequestException('Inventory is not in DRAFT status');

      const distinctUsers = new Set(inventory.Inventory_User.map((u) => u.userId));
      if (distinctUsers.size < 2) {
        throw new BadRequestException('Un inventaire doit comporter au moins 2 participants distincts pour être lancé.');
      }

      const firstUsers = inventory.Inventory_User.filter(u => u.sequence === 0 && u.responsibility === 'COUNT');
      if (firstUsers.length === 0) throw new BadRequestException('No users assigned to sequence 0');

      // Update status
      await tx.inventory.update({
        where: { inventoryId },
        data: { status: 'IN_PROGRESS' },
      });

      const equipmentIds = inventory.equipmentScopeIds ? JSON.parse(inventory.equipmentScopeIds) : [];
      const shelfIds = inventory.shelfScopeIds ? JSON.parse(inventory.shelfScopeIds) : [];

      if (inventory.typeInventory === 'ByEquipment' && equipmentIds.length > 0) {
        for (const eqId of equipmentIds) {
          const unit = await tx.inventoryWorkUnit.create({
            data: {
              inventoryId,
              equipmentId: eqId,
              status: 'DRAFT',
            },
          });

          const currentStock = await tx.equipmentShelfs.findMany({
            where: { equipmentId: eqId },
          });

          if (currentStock.length > 0) {
            await tx.inventory_Equipment_Shelf_Snapshot.createMany({
              data: currentStock.map(s => ({
                inventoryId,
                equipmentId: s.equipmentId!,
                shelfId: s.shelfId!,
                phase: 'LIVE_AT_LAUNCH',
                quantity: s.equipmentQuantity || 0,
              })),
            });
          }

          if (firstUsers.length > 0) {
            await tx.inventoryCountAttempt.createMany({
              data: firstUsers.map(u => ({
                unitId: unit.unitId,
                assignedUserId: u.userId,
                sequence: 0,
                purpose: 'INITIAL',
                status: 'AVAILABLE',
              })),
            });
          }
        }
      } else if (inventory.typeInventory === 'ByShelf' && shelfIds.length > 0) {
        for (const shId of shelfIds) {
          const unit = await tx.inventoryWorkUnit.create({
            data: {
              inventoryId,
              shelfId: shId,
              status: 'DRAFT',
            },
          });

          const currentStock = await tx.equipmentShelfs.findMany({
            where: { shelfId: shId },
          });

          if (currentStock.length > 0) {
            await tx.inventory_Equipment_Shelf_Snapshot.createMany({
              data: currentStock.map(s => ({
                inventoryId,
                equipmentId: s.equipmentId!,
                shelfId: s.shelfId!,
                phase: 'LIVE_AT_LAUNCH',
                quantity: s.equipmentQuantity || 0,
              })),
            });
          }

          if (firstUsers.length > 0) {
            await tx.inventoryCountAttempt.createMany({
              data: firstUsers.map(u => ({
                unitId: unit.unitId,
                assignedUserId: u.userId,
                sequence: 0,
                purpose: 'INITIAL',
                status: 'AVAILABLE',
              })),
            });
          }
        }
      }

      return { success: true };
    });
  }

  // --- MERGED FROM COUNT SERVICE ---

  /**
   * Retrieves pending tasks (attempts) for a given user
   */
  async getMyTasks(userId: string) {
    const attempts = await this.prisma.inventoryCountAttempt.findMany({
      where: {
        assignedUserId: userId,
        status: {
          in: ['AVAILABLE', 'IN_PROGRESS'],
        },
        unit: {
          inventory: {
            status: 'IN_PROGRESS',
          },
        },
      },
      include: {
        unit: {
          include: {
            inventory: true,
          },
        },
      },
    });

    return Promise.all(
      attempts.map(async (attempt) => {
        let equipment = null;
        let shelf = null;

        if (attempt.unit.equipmentId) {
          equipment = await this.prisma.equipment.findUnique({
            where: { equipmentId: attempt.unit.equipmentId },
            include: {
              equipmentShelfs: {
                include: {
                  shelf: true,
                },
              },
            },
          });
        }

        if (attempt.unit.shelfId) {
          shelf = await this.prisma.shelf.findUnique({
            where: { shelfId: attempt.unit.shelfId },
            include: {
              equipmentShelfs: {
                include: {
                  equipment: true,
                },
              },
            },
          });
        }

        return {
          ...attempt,
          unit: {
            ...attempt.unit,
            equipment,
            shelf,
          },
        };
      }),
    );
  }

  /**
   * Atomically saves a draft or submits an attempt.
   */
  async submitCountAttempt(attemptId: string, userId: string, data: SubmitTaskDTO) {
    const { observations, isDraft = false } = data;

    const isValidUuid = (val: any): boolean => {
      if (!val || typeof val !== 'string') return false;
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val.trim());
    };

    const toUuid = (val: any): string | null => {
      return isValidUuid(val) ? val.trim() : null;
    };

    const result = await this.prisma.$transaction(async (tx) => {
      const attempt = await tx.inventoryCountAttempt.findUnique({
        where: { attemptId },
        include: {
          assignedUser: true,
          unit: {
            include: {
              attempts: true,
              inventory: {
                include: {
                  Inventory_User: {
                    include: {
                      User: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!attempt) throw new NotFoundException('Attempt not found');
      if (attempt.assignedUserId !== userId) throw new ForbiddenException('Not assigned to this attempt');
      if (attempt.status !== 'AVAILABLE' && attempt.status !== 'IN_PROGRESS') {
        throw new BadRequestException('Attempt is no longer submittable');
      }

      // Invariant: at least 2 distinct participants required before adding observations
      const participants = attempt.unit.inventory.Inventory_User;
      const distinctUsers = new Set(participants.map((p) => p.userId));
      if (distinctUsers.size < 2) {
        throw new BadRequestException(
          "Impossible d'enregistrer une observation : cet inventaire doit obligatoirement comporter au moins 2 personnes distinctes assignées.",
        );
      }

      // 1. Delete previous draft orders for this attempt
      await tx.order.deleteMany({
        where: { attemptId: attempt.attemptId },
      });

      // 2. Insert new observations as Orders
      if (observations && observations.length > 0) {
        const chunkSize = 100;
        for (let i = 0; i < observations.length; i += chunkSize) {
          const chunk = observations.slice(i, i + chunkSize);
          await tx.order.createMany({
            data: chunk.map((obs) => ({
              attemptId: attempt.attemptId,
              inventoryId: attempt.unit.inventoryId,
              userId: userId,
              equipmentId: toUuid(obs.equipmentId) || attempt.unit.equipmentId,
              shelfId: toUuid(obs.shelfId) || attempt.unit.shelfId,
              serialNumberId: toUuid(obs.serialNumberId),
              observedEquipmentId: toUuid(obs.observedEquipmentId),
              observedShelfId: toUuid(obs.observedShelfId),
              quantityCalculated: Number(obs.quantityCalculated) || 0,
              notes: obs.notes ? String(obs.notes).slice(0, 1000) : null,
              unknownItemEvidence: obs.unknownItemEvidence ? String(obs.unknownItemEvidence) : null,
            })),
          });
        }
      }

      // 3. Update status
      const newStatus = isDraft ? 'IN_PROGRESS' : 'SUBMITTED';
      await tx.inventoryCountAttempt.update({
        where: { attemptId },
        data: { 
          status: newStatus,
          submittedAt: isDraft ? null : new Date(),
        },
      });

      // 4. If submitting (not draft): notify the second user and unlock their attempt
      if (!isDraft) {
        const submittingUserName =
          attempt.assignedUser?.userName ||
          attempt.assignedUser?.userEmail ||
          'Le 1er compteur';

        let targetItemName = attempt.unit.inventory.title || 'Inventaire';
        if (attempt.unit.equipmentId) {
          const eq = await tx.equipment.findUnique({
            where: { equipmentId: attempt.unit.equipmentId },
            select: { equipmentName: true },
          });
          if (eq?.equipmentName) targetItemName = eq.equipmentName;
        } else if (attempt.unit.shelfId) {
          const sh = await tx.shelf.findUnique({
            where: { shelfId: attempt.unit.shelfId },
            select: { shelfName: true },
          });
          if (sh?.shelfName) targetItemName = sh.shelfName;
        }

        const otherCounters = attempt.unit.inventory.Inventory_User.filter(
          (iu) => iu.userId !== userId && (iu.responsibility === 'COUNT' || !iu.responsibility)
        );

        for (const counter of otherCounters) {
          let otherAttempt = attempt.unit.attempts.find(
            (a) => a.assignedUserId === counter.userId
          );

          if (otherAttempt) {
            if (otherAttempt.status !== 'SUBMITTED') {
              await tx.inventoryCountAttempt.update({
                where: { attemptId: otherAttempt.attemptId },
                data: { status: 'AVAILABLE' },
              });
            }
          } else {
            otherAttempt = await tx.inventoryCountAttempt.create({
              data: {
                unitId: attempt.unitId,
                assignedUserId: counter.userId,
                sequence: 0,
                purpose: 'INITIAL',
                status: 'AVAILABLE',
              },
            });
          }

          // Create notification in database for the second user
          await tx.notification.create({
            data: {
              recipientId: counter.userId,
              eventType: 'INVENTORY_TASK_NOTIFICATION',
              payload: JSON.stringify({
                title: 'Tâche d’inventaire prête',
                message: `${submittingUserName} a terminé l'inventaire de "${targetItemName}". C'est à votre tour d'effectuer votre comptage !`,
                unitId: attempt.unitId,
                inventoryId: attempt.unit.inventoryId,
                inventoryTitle: attempt.unit.inventory.title || 'Inventaire',
                equipmentName: targetItemName,
                taskId: otherAttempt.attemptId,
                submittedBy: submittingUserName,
                createdAt: new Date().toISOString(),
              }),
            },
          });
        }
      }

      return {
        unitId: attempt.unitId,
        newStatus,
      };
    });

    // 4. Trigger reconciliation AFTER transaction commits to prevent MSSQL deadlock
    if (!isDraft) {
      try {
        await this.reconcileWorkUnit(result.unitId);
      } catch (err: any) {
        this.logger.error(`Reconciliation failed for unit ${result.unitId}: ${err?.message || err}`);
      }
    }

    return { success: true, status: result.newStatus };
  }

  // --- MERGED FROM RECONCILIATION SERVICE ---

  /**
   * Compares submissions for a given WorkUnit to determine next steps.
   */
  async reconcileWorkUnit(unitId: string) {
    return this.prisma.$transaction(async (tx) => {
      const unit = await tx.inventoryWorkUnit.findUnique({
        where: { unitId },
        include: {
          inventory: {
            include: {
              Inventory_User: true,
            },
          },
          attempts: {
            include: {
              orders: true,
            },
          },
        },
      });

      if (!unit) return;

      const activeSequence = Math.max(0, ...unit.attempts.map((a) => a.sequence));
      const sequenceAttempts = unit.attempts.filter((a) => a.sequence === activeSequence);

      if (activeSequence === 0) {
        // Initial Sequence: Counter 1 & Counter 2
        const countUsers = unit.inventory.Inventory_User.filter(
          (u) => u.responsibility === 'COUNT' && u.sequence === 0,
        );
        const expectedCounters = countUsers.length > 0 ? countUsers : unit.inventory.Inventory_User.filter((u) => u.sequence === 0);

        const allSubmitted =
          expectedCounters.length >= 2 &&
          expectedCounters.every((ec) =>
            sequenceAttempts.some(
              (sa) => sa.assignedUserId === ec.userId && sa.status === 'SUBMITTED',
            ),
          );

        if (!allSubmitted) {
          return { status: 'WAITING' };
        }

        const totals = sequenceAttempts.map((a) => {
          return a.orders.reduce((sum, o) => sum + (o.quantityCalculated || 0), 0);
        });

        const allMatch = totals.length >= 2 && totals.every((t) => t === totals[0]);

        if (allMatch) {
          await tx.inventoryWorkUnit.update({
            where: { unitId },
            data: { status: 'RESOLVED', discrepancyState: 'RESOLVED' },
          });
          return { status: 'RESOLVED' };
        } else {
          await tx.inventoryWorkUnit.update({
            where: { unitId },
            data: {
              discrepancyType: 'QUANTITY_MISMATCH',
              discrepancyState: 'UNRESOLVED',
              discrepancyBeforeData: JSON.stringify(
                sequenceAttempts.map((a) => ({
                  attemptId: a.attemptId,
                  userId: a.assignedUserId,
                  total: a.orders.reduce((sum, o) => sum + (o.quantityCalculated || 0), 0),
                })),
              ),
              status: 'BLOCKED',
            },
          });

          // Check if an adjudicator (3rd user) was already pre-assigned
          const adjudicators = unit.inventory.Inventory_User.filter(
            (u) => u.responsibility === 'ADJUDICATE' && u.sequence > activeSequence,
          );
          if (adjudicators.length > 0) {
            const adjudicator = adjudicators[0];
            const createdAttempt = await tx.inventoryCountAttempt.create({
              data: {
                unitId: unit.unitId,
                assignedUserId: adjudicator.userId,
                sequence: adjudicator.sequence,
                purpose: 'ADJUDICATION',
                status: 'AVAILABLE',
              },
            });

            await tx.inventoryWorkUnit.update({
              where: { unitId },
              data: { status: 'IN_PROGRESS' },
            });

            await tx.notification.create({
              data: {
                recipientId: adjudicator.userId,
                eventType: 'INVENTORY_ADJUDICATION_REQUIRED',
                payload: JSON.stringify({
                  title: "Arbitrage d'inventaire requis",
                  taskId: createdAttempt.attemptId,
                  inventoryId: unit.inventoryId,
                  unitId: unit.unitId,
                  message: "Une divergence est survenue entre les deux compteurs. Votre comptage d'arbitrage est requis.",
                  createdAt: new Date().toISOString(),
                }),
              },
            });
          }


          return { status: 'DISCREPANCY_CREATED' };
        }
      } else {
        // Active sequence > 0: 3rd User / Adjudication
        const adjudicationAttempt = sequenceAttempts.find(
          (a) => a.purpose === 'ADJUDICATION' || a.purpose === 'ADJUDICATION_FINAL' || a.sequence > 0,
        );

        if (!adjudicationAttempt || adjudicationAttempt.status !== 'SUBMITTED') {
          return { status: 'WAITING_FOR_THIRD_USER' };
        }

        const thirdUserTotal = adjudicationAttempt.orders.reduce(
          (sum, o) => sum + (o.quantityCalculated || 0),
          0,
        );

        await tx.inventoryWorkUnit.update({
          where: { unitId },
          data: {
            status: 'RESOLVED',
            discrepancyState: 'RESOLVED',
            discrepancyActorId: adjudicationAttempt.assignedUserId,
            discrepancyAfterData: JSON.stringify({
              resolvedQuantity: thirdUserTotal,
              source: 'THIRD_USER_ADJUDICATION',
              adjudicatedAt: new Date().toISOString(),
            }),
          },
        });

        return { status: 'RESOLVED' };
      }
    });
  }

  /**
   * Called by a manager/adjudicator to resolve a discrepancy manually
   */
  async manualAdjudicate(unitId: string, adjudicatorId: string, data: AdjudicateDTO) {
    const { quantity, notes, shelfId, serialNumberIds, observations } = data;

    return this.prisma.$transaction(async (tx) => {
      const unit = await tx.inventoryWorkUnit.findUnique({
        where: { unitId },
        include: {
          attempts: true,
          inventory: {
            include: {
              Inventory_User: true,
            },
          },
        },
      });

      if (!unit) throw new NotFoundException('Unit not found');
      if (unit.discrepancyState !== 'UNRESOLVED' && unit.status === 'RESOLVED') {
        throw new BadRequestException('Cette unité a déjà été résolue.');
      }

      // Enforce: adjudicator cannot be one of the initial 2 conflicting counters
      const initialCounters = unit.attempts
        .filter((a) => a.sequence === 0)
        .map((a) => a.assignedUserId);

      if (initialCounters.includes(adjudicatorId)) {
        throw new BadRequestException(
          "L'arbitrage ne peut pas être effectué par l'un des deux compteurs initiaux. Un 3ème utilisateur distinct doit être désigné.",
        );
      }

      // Determine shelfId if missing
      let targetShelfId = shelfId || unit.shelfId;
      if (!targetShelfId && unit.equipmentId) {
        const priorOrder = await tx.order.findFirst({
          where: { attempt: { unitId }, shelfId: { not: null } },
          select: { shelfId: true },
        });
        if (priorOrder?.shelfId) {
          targetShelfId = priorOrder.shelfId;
        } else {
          const eqShelf = await tx.equipmentShelfs.findFirst({
            where: { equipmentId: unit.equipmentId },
            select: { shelfId: true },
          });
          targetShelfId = eqShelf?.shelfId ?? null;
        }
      }

      // Ensure adjudicator is in Inventory_User
      const existingUser = unit.inventory.Inventory_User.find((iu) => iu.userId === adjudicatorId);
      if (!existingUser) {
        await tx.inventory_User.create({
          data: {
            inventoryId: unit.inventoryId,
            userId: adjudicatorId,
            sequence: 1,
            responsibility: 'ADJUDICATE',
          },
        });
      }

      // Check if there is an existing available attempt for this adjudicator on this unit
      const existingAdjudicatorAttempt = unit.attempts.find(
        (a) => a.assignedUserId === adjudicatorId && (a.purpose === 'ADJUDICATION' || a.sequence > 0),
      );

      let finalAttemptId = existingAdjudicatorAttempt?.attemptId;

      if (!finalAttemptId) {
        const createdAttempt = await tx.inventoryCountAttempt.create({
          data: {
            unitId,
            assignedUserId: adjudicatorId,
            sequence: 999,
            purpose: 'ADJUDICATION_FINAL',
            status: 'SUBMITTED',
            submittedAt: new Date(),
          },
        });
        finalAttemptId = createdAttempt.attemptId;
      } else {
        await tx.inventoryCountAttempt.update({
          where: { attemptId: finalAttemptId },
          data: {
            status: 'SUBMITTED',
            submittedAt: new Date(),
            purpose: 'ADJUDICATION_FINAL',
          },
        });
        // Delete any draft orders on this attempt if any
        await tx.order.deleteMany({
          where: { attemptId: finalAttemptId },
        });
      }

      // Create orders for final adjudication
      if (observations && observations.length > 0) {
        for (const obs of observations) {
          await tx.order.create({
            data: {
              attemptId: finalAttemptId,
              inventoryId: unit.inventoryId,
              userId: adjudicatorId,
              equipmentId: unit.equipmentId,
              shelfId: obs.shelfId || targetShelfId,
              serialNumberId: obs.serialNumberId,
              quantityCalculated: obs.quantityCalculated ?? 1,
              notes: obs.notes || notes,
            },
          });
        }
      } else if (serialNumberIds && serialNumberIds.length > 0) {
        for (const snId of serialNumberIds) {
          await tx.order.create({
            data: {
              attemptId: finalAttemptId,
              inventoryId: unit.inventoryId,
              userId: adjudicatorId,
              equipmentId: unit.equipmentId,
              shelfId: targetShelfId,
              serialNumberId: snId,
              quantityCalculated: 1,
              notes,
            },
          });
        }
      } else {
        await tx.order.create({
          data: {
            attemptId: finalAttemptId,
            inventoryId: unit.inventoryId,
            userId: adjudicatorId,
            equipmentId: unit.equipmentId,
            shelfId: targetShelfId,
            quantityCalculated: quantity,
            notes,
          },
        });
      }

      const finalQuantity =
        observations && observations.length > 0
          ? observations.reduce((s, o) => s + (o.quantityCalculated ?? 1), 0)
          : serialNumberIds && serialNumberIds.length > 0
            ? serialNumberIds.length
            : quantity;

      await tx.inventoryWorkUnit.update({
        where: { unitId },
        data: {
          discrepancyState: 'RESOLVED',
          discrepancyActorId: adjudicatorId,
          discrepancyAfterData: JSON.stringify({
            resolvedQuantity: finalQuantity,
            notes,
            serialNumbersCount: serialNumberIds?.length || observations?.length || 0,
            adjudicatedAt: new Date().toISOString(),
          }),
          status: 'RESOLVED',
        },
      });

      return {
        success: true,
        unitId,
        status: 'RESOLVED',
        resolvedQuantity: finalQuantity,
      };
    });
  }

  /**
   * Assigns a 3rd user (third controller / adjudicator) to an inventory work unit with a discrepancy.
   */
  async assignThirdUser(
    inventoryId: string,
    unitId: string,
    thirdUserId: string,
    assignerId: string,
    notes?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const inventory = await tx.inventory.findUnique({
        where: { inventoryId },
        include: {
          Inventory_User: true,
        },
      });
      if (!inventory) throw new NotFoundException('Inventaire introuvable');
      if (inventory.status === 'FINALIZED') {
        throw new BadRequestException('Cet inventaire est déjà clôturé.');
      }

      const unit = await tx.inventoryWorkUnit.findFirst({
        where: { unitId, inventoryId },
        include: {
          attempts: {
            include: {
              assignedUser: true,
            },
          },
        },
      });
      if (!unit) throw new NotFoundException('Unité de travail introuvable');

      // Verify that thirdUserId is NOT one of the initial counters who counted this unit
      const initialCounters = unit.attempts
        .filter((a) => a.sequence === 0)
        .map((a) => a.assignedUserId);

      if (initialCounters.includes(thirdUserId)) {
        throw new BadRequestException(
          'Le 3ème utilisateur désigné doit être différent des 2 compteurs initiaux de cette unité.',
        );
      }

      // Ensure 3rd user is registered in Inventory_User with responsibility 'ADJUDICATE'
      const existingParticipant = inventory.Inventory_User.find((iu) => iu.userId === thirdUserId);
      if (!existingParticipant) {
        await tx.inventory_User.create({
          data: {
            inventoryId,
            userId: thirdUserId,
            sequence: 1,
            responsibility: 'ADJUDICATE',
          },
        });
      } else if (existingParticipant.responsibility !== 'ADJUDICATE') {
        await tx.inventory_User.update({
          where: {
            inventoryId_userId: {
              inventoryId,
              userId: thirdUserId,
            },
          },
          data: {
            responsibility: 'ADJUDICATE',
            sequence: 1,
          },
        });
      }

      // Check if an adjudication attempt already exists for this 3rd user on this unit
      let attemptId: string;
      const existingAttempt = unit.attempts.find(
        (a) => a.assignedUserId === thirdUserId && (a.purpose === 'ADJUDICATION' || a.sequence > 0),
      );

      if (!existingAttempt) {
        const createdAttempt = await tx.inventoryCountAttempt.create({
          data: {
            unitId: unit.unitId,
            assignedUserId: thirdUserId,
            sequence: 1,
            purpose: 'ADJUDICATION',
            status: 'AVAILABLE',
          },
        });
        attemptId = createdAttempt.attemptId;
      } else {
        attemptId = existingAttempt.attemptId;
        if (existingAttempt.status !== 'SUBMITTED') {
          await tx.inventoryCountAttempt.update({
            where: { attemptId: existingAttempt.attemptId },
            data: { status: 'AVAILABLE' },
          });
        }
      }

      // Set unit status to IN_PROGRESS
      await tx.inventoryWorkUnit.update({
        where: { unitId },
        data: {
          status: 'IN_PROGRESS',
          discrepancyActorId: thirdUserId,
          discrepancyReason: notes || '3ème contrôleur désigné pour départager le comptage',
        },
      });

      // Find equipment or shelf name for notification
      let targetName = inventory.title || 'Inventaire';
      if (unit.equipmentId) {
        const eq = await tx.equipment.findUnique({
          where: { equipmentId: unit.equipmentId },
          select: { equipmentName: true },
        });
        if (eq?.equipmentName) targetName = eq.equipmentName;
      }

      // Send notification to the 3rd user
      await tx.notification.create({
        data: {
          recipientId: thirdUserId,
          eventType: 'INVENTORY_ADJUDICATION_ASSIGNED',
          payload: JSON.stringify({
            title: "Arbitrage d'inventaire assigné",
            taskId: attemptId,
            unitId,
            inventoryId,
            targetName,
            assignerId,
            message: `Vous avez été désigné comme 3ème contrôleur pour départager une divergence sur "${targetName}".`,
            createdAt: new Date().toISOString(),
          }),
        },
      });


      return {
        success: true,
        unitId,
        thirdUserId,
        attemptId,
      };
    });
  }

  /**
   * Assigns a 3rd user to all units in the inventory that have unresolved discrepancies.
   */
  async assignThirdUserToAll(
    inventoryId: string,
    thirdUserId: string,
    assignerId: string,
    notes?: string,
  ) {
    const inventory = await this.prisma.inventory.findUnique({
      where: { inventoryId },
      include: {
        workUnits: {
          include: {
            attempts: true,
          },
        },
      },
    });
    if (!inventory) throw new NotFoundException('Inventaire introuvable');

    const disputedUnits = inventory.workUnits.filter(
      (u) =>
        u.status === 'BLOCKED' ||
        u.discrepancyState === 'UNRESOLVED' ||
        (u.discrepancyType !== null && u.status !== 'RESOLVED'),
    );

    if (disputedUnits.length === 0) {
      throw new BadRequestException("Aucune unité avec divergence en attente d'arbitrage.");
    }

    const results = [];
    for (const unit of disputedUnits) {
      const res = await this.assignThirdUser(inventoryId, unit.unitId, thirdUserId, assignerId, notes);
      results.push(res);
    }

    return {
      success: true,
      count: results.length,
      units: results,
    };
  }


  // --- MERGED FROM FINALIZATION SERVICE ---

  /**
   * Computes the stock adjustments based on final resolved work units vs LIVE_AT_LAUNCH snapshots,
   * along with any pending discrepancies requiring arbitration.
   */
  async previewAdjustments(inventoryId: string, tx: Prisma.TransactionClient | PrismaService = this.prisma) {
    const inventory = await tx.inventory.findUnique({
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
                orders: {
                  include: {
                    shelf: true,
                    equipment: true,
                  },
                },
              },
              orderBy: { sequence: 'desc' },
            },
          },
        },
      },
    });

    if (!inventory) throw new NotFoundException('Inventory not found');

    const snapshots = await tx.inventory_Equipment_Shelf_Snapshot.findMany({
      where: { inventoryId },
    });

    const liveQtyMap = new Map<string, number>();
    for (const snap of snapshots) {
      if (snap.phase === 'LIVE_AT_LAUNCH') {
        const key = `${snap.equipmentId}_${snap.shelfId}`;
        liveQtyMap.set(key, snap.quantity);
      }
    }

    const adjustments: any[] = [];
    const discrepancyUnits: any[] = [];

    const eqCache = new Map<string, any>();
    const shCache = new Map<string, any>();

    const getEquipment = async (id: string | null) => {
      if (!id) return null;
      if (!eqCache.has(id)) {
        const eq = await tx.equipment.findUnique({ where: { equipmentId: id } });
        eqCache.set(id, eq);
      }
      return eqCache.get(id);
    };

    const getShelf = async (id: string | null) => {
      if (!id) return null;
      if (!shCache.has(id)) {
        const sh = await tx.shelf.findUnique({ where: { shelfId: id } });
        shCache.set(id, sh);
      }
      return shCache.get(id);
    };

    for (const unit of inventory.workUnits) {
      const eq = await getEquipment(unit.equipmentId);
      const sh = await getShelf(unit.shelfId);

      const isDiscrepancy =
        unit.status === 'BLOCKED' ||
        unit.discrepancyState === 'UNRESOLVED' ||
        (unit.discrepancyType !== null && unit.status !== 'RESOLVED');

      if (isDiscrepancy) {
        const initialAttempts = unit.attempts.filter(
          (a) => a.sequence === 0 && a.status === 'SUBMITTED',
        );
        const adjudicationAttempt = unit.attempts.find(
          (a) => a.sequence > 0 || a.purpose === 'ADJUDICATION' || a.purpose === 'ADJUDICATION_FINAL',
        );

        let thirdUser: any = null;
        if (adjudicationAttempt) {
          const submittedQty = adjudicationAttempt.status === 'SUBMITTED'
            ? adjudicationAttempt.orders.reduce((sum, o) => sum + (o.quantityCalculated || 0), 0)
            : null;

          thirdUser = {
            userId: adjudicationAttempt.assignedUserId,
            userName: adjudicationAttempt.assignedUser?.userName || adjudicationAttempt.assignedUser?.userEmail || '3ème contrôleur',
            userEmail: adjudicationAttempt.assignedUser?.userEmail,
            attemptId: adjudicationAttempt.attemptId,
            status: adjudicationAttempt.status,
            submittedQuantity: submittedQty,
          };
        }

        const initialCounterIds = unit.attempts
          .filter((a) => a.sequence === 0)
          .map((a) => a.assignedUserId);

        const needsThirdUser = !thirdUser;

        discrepancyUnits.push({
          unitId: unit.unitId,
          equipmentId: unit.equipmentId,
          equipmentName: eq?.equipmentName || 'Équipement',
          shelfId: unit.shelfId,
          shelfName: sh?.shelfName || 'Toutes étagères',
          status: unit.status,
          discrepancyType: unit.discrepancyType || 'QUANTITY_MISMATCH',
          counts: initialAttempts.map((a) => ({
            userId: a.assignedUserId,
            userName: a.assignedUser?.userName || a.assignedUser?.userEmail || 'Compteur',
            quantity: a.orders.reduce((sum, o) => sum + (o.quantityCalculated || 0), 0),
          })),
          initialCounterIds,
          thirdUser,
          needsThirdUser,
        });
      }

      if (unit.status === 'RESOLVED') {
        const finalAttempt = unit.attempts.find((a) => a.status === 'SUBMITTED');
        if (!finalAttempt) continue;

        const countedMap = new Map<string, number>();
        for (const order of finalAttempt.orders) {
          const eqId = order.equipmentId || unit.equipmentId;
          const shId = order.shelfId || unit.shelfId;
          if (!eqId) continue;

          const resolvedShId = shId || snapshots.find((s) => s.equipmentId === eqId)?.shelfId || '';
          const key = `${eqId}_${resolvedShId}`;
          countedMap.set(key, (countedMap.get(key) || 0) + (order.quantityCalculated || 0));
        }

        for (const [key, countedQty] of countedMap.entries()) {
          const [equipId, shelfId] = key.split('_');
          const expectedQty = liveQtyMap.get(key) ?? (liveQtyMap.get(`${equipId}_${shelfId}`) || 0);
          const eqObj = await getEquipment(equipId);
          const shObj = await getShelf(shelfId);

          if (countedQty !== expectedQty) {
            adjustments.push({
              equipmentId: equipId,
              equipmentName: eqObj?.equipmentName || 'Équipement',
              shelfId: shelfId,
              shelfName: shObj?.shelfName || 'Étagère',
              expectedQty,
              countedQty,
              delta: countedQty - expectedQty,
            });
          }
        }
      }
    }

    const isReadyToFinalize =
      inventory.workUnits.length > 0 &&
      inventory.workUnits.every((u) => u.status === 'RESOLVED') &&
      discrepancyUnits.length === 0;

    const hasUnassignedThirdUser = discrepancyUnits.some((d) => d.needsThirdUser);
    const hasPendingThirdUserCount = discrepancyUnits.some(
      (d) => d.thirdUser && d.thirdUser.status !== 'SUBMITTED' && d.status !== 'RESOLVED',
    );

    let blockingReason: string | null = null;
    if (inventory.status === 'FINALIZED') {
      blockingReason = 'Cet inventaire a déjà été clôturé.';
    } else if (inventory.workUnits.length === 0) {
      blockingReason = "Aucune unité d'inventaire trouvée.";
    } else if (hasUnassignedThirdUser) {
      const count = discrepancyUnits.filter((d) => d.needsThirdUser).length;
      blockingReason = `${count} divergence(s) constatée(s) : Vous devez obligatoirement désigner un 3ème utilisateur pour effectuer le comptage d'arbitrage.`;
    } else if (hasPendingThirdUserCount) {
      blockingReason = "En attente du comptage de départage par le 3ème utilisateur désigné.";
    } else if (discrepancyUnits.length > 0) {
      blockingReason = `${discrepancyUnits.length} divergence(s) de comptage doivent être arbitrées avant la clôture.`;
    } else if (!isReadyToFinalize) {
      blockingReason = "Tous les comptages n'ont pas encore été complétés.";
    }


    return {
      inventory: {
        inventoryId: inventory.inventoryId,
        title: inventory.title,
        status: inventory.status,
        typeInventory: inventory.typeInventory,
      },
      adjustments,
      discrepancyUnits,
      stats: {
        totalUnits: inventory.workUnits.length,
        resolvedUnits: inventory.workUnits.filter((u) => u.status === 'RESOLVED').length,
        pendingUnits: inventory.workUnits.filter((u) => u.status !== 'RESOLVED').length,
        discrepancyCount: discrepancyUnits.length,
      },
      isReadyToFinalize,
      blockingReason,
    };
  }

  /**
   * Finalizes the inventory and commits stock adjustments to the EquipmentShelfs table
   */
  async finalizeInventory(inventoryId: string, finalizerId: string) {
    return this.prisma.$transaction(async (tx) => {
      const inventory = await tx.inventory.findUnique({
        where: { inventoryId },
        include: {
          workUnits: true,
        },
      });

      if (!inventory) throw new NotFoundException('Inventory not found');
      if (inventory.status === 'FINALIZED') throw new BadRequestException('Already finalized');

      for (const unit of inventory.workUnits) {
        if (unit.status !== 'RESOLVED' && unit.status !== 'SUBMITTED') {
          throw new BadRequestException(
            `Impossible de clôturer : l'unité d'inventaire "${unit.unitId}" présente une divergence non résolue (statut: ${unit.status}). Veuillez d'abord arbitrer le conflit.`
          );
        }
      }

      const { adjustments } = await this.previewAdjustments(inventoryId, tx);

      for (const adj of adjustments) {
        const record = await tx.equipmentShelfs.findFirst({
          where: { equipmentId: adj.equipmentId, shelfId: adj.shelfId }
        });

        if (record) {
          await tx.equipmentShelfs.update({
            where: { equipmentShelfId: record.equipmentShelfId },
            data: { equipmentQuantity: adj.countedQty }
          });
        } else {
          await tx.equipmentShelfs.create({
            data: {
              equipmentId: adj.equipmentId,
              shelfId: adj.shelfId,
              equipmentQuantity: adj.countedQty
            }
          });
        }
      }

      const inventoryUpdateData: Prisma.InventoryUpdateInput = {
        status: 'FINALIZED',
        finalizedAt: new Date()
      };

      if (adjustments.length > 0) {
        inventoryUpdateData.adjustmentApproverId = finalizerId;
        inventoryUpdateData.adjustmentBatchData = JSON.stringify(adjustments);
        inventoryUpdateData.adjustmentReason = 'Finalized inventory adjustments';
      }

      await tx.inventory.update({
        where: { inventoryId },
        data: inventoryUpdateData
      });
      
      return { success: true, adjustmentsApplied: adjustments.length };
    });
  }

  /**
   * Safely deletes an inventory and cascades to all child records in MSSQL
   */
  async deleteInventory(inventoryId: string) {
    const existing = await this.prisma.inventory.findUnique({
      where: { inventoryId },
      include: {
        workUnits: {
          include: {
            attempts: true,
          },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException(`Inventory with ID ${inventoryId} not found`);
    }

    const unitIds = existing.workUnits.map((u) => u.unitId);
    const attemptIds = existing.workUnits.flatMap((u) => u.attempts.map((a) => a.attemptId));

    return await this.prisma.$transaction(async (tx) => {
      // 1. Delete associated orders (orders linked to this inventory or its count attempts)
      await tx.order.deleteMany({
        where: {
          OR: [
            { inventoryId },
            ...(attemptIds.length > 0 ? [{ attemptId: { in: attemptIds } }] : []),
          ],
        },
      });

      // 2. Delete count attempts
      if (unitIds.length > 0) {
        await tx.inventoryCountAttempt.deleteMany({
          where: {
            unitId: { in: unitIds },
          },
        });
      }

      // 3. Delete work units
      if (unitIds.length > 0) {
        await tx.inventoryWorkUnit.deleteMany({
          where: {
            inventoryId,
          },
        });
      }

      // 4. Delete snapshots
      await tx.inventory_Equipment_Shelf_Snapshot.deleteMany({
        where: {
          OR: [
            { inventoryId },
            { sourceInventoryId: inventoryId },
          ],
        },
      });

      // 5. Delete user assignments
      await tx.inventory_User.deleteMany({
        where: {
          inventoryId,
        },
      });

      // 6. Unlink any sub-inventories that reference this inventory as parent
      await tx.inventory.updateMany({
        where: {
          parentInventoryId: inventoryId,
        },
        data: {
          parentInventoryId: null,
        },
      });

      // 7. Delete the inventory itself
      const deleted = await tx.inventory.delete({
        where: {
          inventoryId,
        },
      });

      this.logger.log(`Inventory ${inventoryId} and all associated records deleted successfully`);
      return { success: true, message: 'Inventaire supprimé avec succès', inventoryId: deleted.inventoryId };
    });
  }
}

