import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { PaginationDTO, CreateInventoryDTO, SubmitTaskDTO, AdjudicateDTO } from './dto/index.js';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retrieves all inventories
   */
  async getInventories(pagination: PaginationDTO) {
    const page = pagination?.page ? Number(pagination.page) : 1;
    const limit = pagination?.limit ? Number(pagination.limit) : 10;
    const skip = (page - 1) * limit;

    const [inventories, totalInventories] = await Promise.all([
      this.prisma.inventory.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          Inventory_User: true,
        }
      }),
      this.prisma.inventory.count(),
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
            inventory: true,
            equipment: true,
            shelf: true,
          }
        },
        orders: true,
      }
    });
    if (!attempt) throw new NotFoundException('Task not found');
    return attempt;
  }

  /**
   * Retrieves an adjudication unit (WorkUnit + Discrepancy + Attempts)
   */
  async getAdjudicationUnit(unitId: string) {
    const unit = await this.prisma.inventoryWorkUnit.findUnique({
      where: { unitId },
      include: {
        inventory: true,
        attempts: {
          include: {
            assignedUser: true,
            orders: true
          }
        }
      }
    });
    if (!unit) throw new NotFoundException('Unit not found');
    return unit;
  }

  /**
   * Creates a new inventory draft
   */
  async createInventory(data: CreateInventoryDTO, creatorId: string) {
    const { title, typeInventory, users, equipmentIds, shelfIds } = data;

    return this.prisma.$transaction(async (tx) => {
      // Create the parent inventory
      const inventory = await tx.inventory.create({
        data: {
          title,
          typeInventory,
          status: 'DRAFT',
        },
      });

      // Add participants with sequence
      if (users && users.length > 0) {
        await tx.inventory_User.createMany({
          data: users.map((u, index: number) => ({
            inventoryId: inventory.inventoryId,
            userId: u.userId,
            sequence: index,
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
    return this.prisma.inventoryCountAttempt.findMany({
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
  }

  /**
   * Atomically saves a draft or submits an attempt.
   */
  async submitCountAttempt(attemptId: string, userId: string, data: SubmitTaskDTO) {
    const { observations, isDraft = false } = data;

    return this.prisma.$transaction(async (tx) => {
      const attempt = await tx.inventoryCountAttempt.findUnique({
        where: { attemptId },
        include: {
          unit: true,
        },
      });

      if (!attempt) throw new NotFoundException('Attempt not found');
      if (attempt.assignedUserId !== userId) throw new ForbiddenException('Not assigned to this attempt');
      if (attempt.status !== 'AVAILABLE' && attempt.status !== 'IN_PROGRESS') {
        throw new BadRequestException('Attempt is no longer submittable');
      }

      // 1. Delete previous draft orders for this attempt
      await tx.order.deleteMany({
        where: { attemptId: attempt.attemptId },
      });

      // 2. Insert new observations as Orders
      if (observations && observations.length > 0) {
        await tx.order.createMany({
          data: observations.map((obs) => ({
            attemptId: attempt.attemptId,
            inventoryId: attempt.unit.inventoryId,
            userId: userId,
            equipmentId: obs.equipmentId || attempt.unit.equipmentId,
            shelfId: obs.shelfId || attempt.unit.shelfId,
            serialNumberId: obs.serialNumberId,
            observedEquipmentId: obs.observedEquipmentId,
            observedShelfId: obs.observedShelfId,
            quantityCalculated: obs.quantityCalculated,
            notes: obs.notes,
            unknownItemEvidence: obs.unknownItemEvidence,
          })),
        });
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

      if (!isDraft) {
        // Trigger reconciliation check since this user is done
        await this.reconcileWorkUnit(attempt.unitId);
      }

      return { success: true, status: newStatus };
    });
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
              Inventory_User: true
            }
          },
          attempts: {
            include: {
              orders: true
            }
          }
        }
      });

      if (!unit) return;

      const countUsers = unit.inventory.Inventory_User.filter(u => u.responsibility === 'COUNT');
      const activeSequence = Math.max(0, ...unit.attempts.map(a => a.sequence));
      const sequenceAttempts = unit.attempts.filter(a => a.sequence === activeSequence);
      
      const expectedCounters = countUsers.filter(u => u.sequence === activeSequence);
      const allSubmitted = expectedCounters.every(ec => 
        sequenceAttempts.some(sa => sa.assignedUserId === ec.userId && sa.status === 'SUBMITTED')
      );

      if (!allSubmitted) {
        return { status: 'WAITING' };
      }

      const totals = sequenceAttempts.map(a => {
        return a.orders.reduce((sum, o) => sum + (o.quantityCalculated || 0), 0);
      });

      const allMatch = totals.every(t => t === totals[0]);

      if (allMatch) {
        await tx.inventoryWorkUnit.update({
          where: { unitId },
          data: { status: 'RESOLVED' }
        });
        return { status: 'RESOLVED' };
      } else {
        await tx.inventoryWorkUnit.update({
          where: { unitId },
          data: {
            discrepancyType: 'QUANTITY_MISMATCH',
            discrepancyState: 'UNRESOLVED',
            discrepancyBeforeData: JSON.stringify(sequenceAttempts.map(a => ({ attemptId: a.attemptId, total: totals })))
          }
        });

        const adjudicators = unit.inventory.Inventory_User.filter(u => u.responsibility === 'ADJUDICATE' && u.sequence > activeSequence);
        if (adjudicators.length > 0) {
          const adjudicator = adjudicators[0];
          await tx.inventoryCountAttempt.create({
            data: {
              unitId: unit.unitId,
              assignedUserId: adjudicator.userId,
              sequence: adjudicator.sequence,
              purpose: 'ADJUDICATION',
              status: 'AVAILABLE'
            }
          });
          
          await tx.inventoryWorkUnit.update({
            where: { unitId },
            data: { status: 'IN_PROGRESS' }
          });
        } else {
          await tx.inventoryWorkUnit.update({
            where: { unitId },
            data: { status: 'BLOCKED' }
          });
        }
        
        return { status: 'DISCREPANCY_CREATED' };
      }
    });
  }

  /**
   * Called by a manager/adjudicator to resolve a discrepancy manually
   */
  async manualAdjudicate(unitId: string, adjudicatorId: string, data: AdjudicateDTO) {
    const { quantity, notes } = data;

    return this.prisma.$transaction(async (tx) => {
      const unit = await tx.inventoryWorkUnit.findUnique({
        where: { unitId }
      });

      if (!unit) throw new NotFoundException('Unit not found');
      if (unit.discrepancyState !== 'UNRESOLVED') throw new BadRequestException('No unresolved discrepancies');

      await tx.inventoryCountAttempt.create({
        data: {
          unitId,
          assignedUserId: adjudicatorId,
          sequence: 999,
          purpose: 'ADJUDICATION_FINAL',
          status: 'SUBMITTED',
          submittedAt: new Date(),
          orders: {
            create: {
              inventoryId: unit.inventoryId,
              userId: adjudicatorId,
              quantityCalculated: quantity,
              notes,
              equipmentId: unit.equipmentId,
              shelfId: unit.shelfId
            }
          }
        }
      });

      await tx.inventoryWorkUnit.update({
        where: { unitId },
        data: {
          discrepancyState: 'RESOLVED',
          discrepancyActorId: adjudicatorId,
          discrepancyAfterData: JSON.stringify({ resolvedQuantity: quantity, notes }),
          status: 'RESOLVED'
        }
      });

      return { success: true };
    });
  }

  // --- MERGED FROM FINALIZATION SERVICE ---

  /**
   * Computes the stock adjustments based on final resolved work units vs LIVE_AT_LAUNCH snapshots
   */
  async previewAdjustments(inventoryId: string, tx: Prisma.TransactionClient | PrismaService = this.prisma) {
    const inventory = await tx.inventory.findUnique({
      where: { inventoryId },
      include: {
        workUnits: {
          where: { status: 'RESOLVED' },
          include: {
            attempts: {
              where: { status: 'SUBMITTED' },
              orderBy: { sequence: 'desc' },
              take: 1,
              include: { orders: true }
            }
          }
        }
      }
    });

    if (!inventory) throw new NotFoundException('Inventory not found');

    const adjustments = [];
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

    for (const unit of inventory.workUnits) {
      if (unit.attempts.length === 0) continue;
      
      const finalAttempt = unit.attempts[0];
      const countedMap = new Map();
      for (const order of finalAttempt.orders) {
        if (!order.equipmentId || !order.shelfId) continue;
        const key = `${order.equipmentId}_${order.shelfId}`;
        countedMap.set(key, (countedMap.get(key) || 0) + (order.quantityCalculated || 0));
      }

      for (const [key, countedQty] of countedMap.entries()) {
        const expectedQty = liveQtyMap.get(key) || 0;
        if (countedQty !== expectedQty) {
          const [equipId, shelfId] = key.split('_');
          adjustments.push({
            equipmentId: equipId,
            shelfId: shelfId,
            expectedQty,
            countedQty,
            delta: countedQty - expectedQty
          });
        }
      }
    }

    return { adjustments };
  }

  /**
   * Finalizes the inventory and commits stock adjustments to the EquipmentShelfs table
   */
  async finalizeInventory(inventoryId: string, finalizerId: string) {
    return this.prisma.$transaction(async (tx) => {
      const inventory = await tx.inventory.findUnique({
        where: { inventoryId },
        include: {
          workUnits: true
        }
      });

      if (!inventory) throw new NotFoundException('Inventory not found');
      if (inventory.status === 'FINALIZED') throw new BadRequestException('Already finalized');

      for (const unit of inventory.workUnits) {
        if (unit.status !== 'RESOLVED' && unit.status !== 'SUBMITTED') {
          throw new BadRequestException(`Unit ${unit.unitId} is not in a final state`);
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
}
