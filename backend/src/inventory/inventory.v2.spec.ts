import { describe, expect, it, vi, beforeEach } from 'vitest';
import { InventoryService } from './inventory.service.js';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

describe('Inventory Workflow V2: Three-Controller Full-Recount Architecture', () => {
  let inventoryService: InventoryService;
  let prismaMock: any;
  let txMock: any;

  const creatorId = 'c0000000-0000-4000-8000-000000000001';
  const c1UserId = '11111111-0000-4000-8000-000000000001';
  const c2UserId = '22222222-0000-4000-8000-000000000002';
  const c3UserId = '33333333-0000-4000-8000-000000000003';
  const invId = 'aaaa0000-0000-4000-8000-000000000001';
  const eqA = 'eea00000-0000-4000-8000-000000000001';
  const eqB = 'eeb00000-0000-4000-8000-000000000002';
  const eqC = 'eec00000-0000-4000-8000-000000000003';
  const shelfX = 'ssx00000-0000-4000-8000-000000000001';
  const shelfY = 'ssy00000-0000-4000-8000-000000000002';

  beforeEach(() => {
    txMock = {
      inventory: {
        create: vi.fn().mockImplementation((args) => Promise.resolve({ inventoryId: invId, ...args.data })),
        findUnique: vi.fn(),
        update: vi.fn().mockImplementation((args) => Promise.resolve({ inventoryId: invId, ...args.data })),
        delete: vi.fn(),
      },
      inventory_User: {
        createMany: vi.fn().mockResolvedValue({ count: 3 }),
        findMany: vi.fn(),
        deleteMany: vi.fn(),
      },
      inventoryWorkUnit: {
        create: vi.fn().mockImplementation((args) => Promise.resolve({ unitId: 'unit-' + (args.data.unitOrder ?? 0), ...args.data })),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        deleteMany: vi.fn(),
        count: vi.fn(),
      },
      inventoryCountAttempt: {
        create: vi.fn().mockImplementation((args) => Promise.resolve({ attemptId: 'att-' + Math.random(), ...args.data })),
        findMany: vi.fn(),
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        deleteMany: vi.fn(),
        count: vi.fn(),
      },
      order: {
        create: vi.fn().mockImplementation((args) => Promise.resolve({ orderId: 'ord-' + Math.random(), ...args.data })),
        deleteMany: vi.fn(),
      },
      inventory_Equipment_Shelf_Snapshot: {
        create: vi.fn(),
        createMany: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
        deleteMany: vi.fn(),
      },
      inventory_SerialNumber_Snapshot: {
        create: vi.fn(),
        createMany: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
        deleteMany: vi.fn(),
      },
      inventoryInvestigationIssue: {
        create: vi.fn().mockImplementation((args) => Promise.resolve({ issueId: 'iss-1', ...args.data })),
        findUnique: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
        update: vi.fn(),
        deleteMany: vi.fn(),
      },
      equipment: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      equipmentShelfs: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      serialNumber: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      mouvement: {
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn(),
      },
      user: {
        findMany: vi.fn().mockResolvedValue([
          { userId: c1UserId, userName: 'Controller 1', role: { roleName: 'CONTROLLER' } },
          { userId: c2UserId, userName: 'Controller 2', role: { roleName: 'CONTROLLER' } },
          { userId: c3UserId, userName: 'Final Controller', role: { roleName: 'CONTROLLER' } },
        ]),
      },
      notification: {
        create: vi.fn().mockResolvedValue({ notificationId: 'notif-1' }),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };

    prismaMock = {
      $transaction: vi.fn(async (cb) => cb(txMock)),
      inventory: txMock.inventory,
      inventoryWorkUnit: txMock.inventoryWorkUnit,
      inventoryCountAttempt: txMock.inventoryCountAttempt,
      inventoryInvestigationIssue: txMock.inventoryInvestigationIssue,
      inventory_Equipment_Shelf_Snapshot: txMock.inventory_Equipment_Shelf_Snapshot,
      inventory_SerialNumber_Snapshot: txMock.inventory_SerialNumber_Snapshot,
      equipment: txMock.equipment,
      shelf: { findUnique: vi.fn() },
      equipmentShelfs: txMock.equipmentShelfs,
      serialNumber: txMock.serialNumber,
    };

    inventoryService = new InventoryService(prismaMock as any);
  });

  // ==========================================================================
  // 1. INVENTORY CREATION & THREE PARTICIPANTS
  // ==========================================================================
  describe('1. Inventory Creation & Three Participants', () => {
    it('creates an inventory draft requiring exactly 3 distinct participants for V2', async () => {
      const res = await inventoryService.createInventory(
        {
          title: 'Inventaire Trimestriel',
          typeInventory: 'ByEquipment',
          policyVersion: 2,
          users: [
            { userId: c1UserId },
            { userId: c2UserId },
            { userId: c3UserId },
          ],
          equipmentIds: [eqA, eqB, eqC],
        },
        creatorId
      );

      expect(res.inventoryId).toBe(invId);
      expect(txMock.inventory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: 'Inventaire Trimestriel',
          typeInventory: 'ByEquipment',
          status: 'DRAFT',
          policyVersion: 2,
          creatorId,
        }),
      });

      // Verify the 3 participants were assigned in explicit sequence
      expect(txMock.inventory_User.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({ userId: c1UserId, sequence: 0, responsibility: 'PRIMARY_COUNTER_1' }),
          expect.objectContaining({ userId: c2UserId, sequence: 1, responsibility: 'PRIMARY_COUNTER_2' }),
          expect.objectContaining({ userId: c3UserId, sequence: 2, responsibility: 'FINAL_CONTROLLER' }),
        ],
      });
    });

    it('rejects creation if fewer than 3 participants are provided for V2', async () => {
      await expect(
        inventoryService.createInventory(
          {
            title: 'Inventaire Invalide',
            typeInventory: 'ByEquipment',
            policyVersion: 2,
            users: [
              { userId: c1UserId },
              { userId: c2UserId },
            ],
            equipmentIds: [eqA],
          },
          creatorId
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects creation if participants are not distinct', async () => {
      await expect(
        inventoryService.createInventory(
          {
            title: 'Inventaire Doublon',
            typeInventory: 'ByEquipment',
            policyVersion: 2,
            users: [
              { userId: c1UserId },
              { userId: c1UserId },
              { userId: c3UserId },
            ],
            equipmentIds: [eqA],
          },
          creatorId
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects creation if ByEquipment has empty equipmentIds', async () => {
      await expect(
        inventoryService.createInventory(
          {
            title: 'Inventaire Sans Article',
            typeInventory: 'ByEquipment',
            policyVersion: 2,
            users: [{ userId: c1UserId }, { userId: c2UserId }, { userId: c3UserId }],
            equipmentIds: [],
          },
          creatorId
        )
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ==========================================================================
  // 2. LAUNCH & STRICT UNIT PIPELINE INITIALIZATION
  // ==========================================================================
  describe('2. Launch & Pipeline Setup', () => {
    it('initializes work units with stable unitOrder and sets C1 U0 AVAILABLE while all others are BLOCKED', async () => {
      txMock.inventory.findUnique.mockResolvedValue({
        inventoryId: invId,
        title: 'Inventaire Test',
        status: 'DRAFT',
        typeInventory: 'ByEquipment',
        policyVersion: 2,
        equipmentScopeIds: JSON.stringify([eqA, eqB, eqC]),
        Inventory_User: [
          { userId: c1UserId, sequence: 0, responsibility: 'PRIMARY_COUNTER_1' },
          { userId: c2UserId, sequence: 1, responsibility: 'PRIMARY_COUNTER_2' },
          { userId: c3UserId, sequence: 2, responsibility: 'FINAL_CONTROLLER' },
        ],
      });

      const launchRes = await inventoryService.launchInventory(invId);
      expect(launchRes.success).toBe(true);
      expect(launchRes.totalUnits).toBe(3);

      // Verify work units were created with unitOrder 0, 1, 2
      expect(txMock.inventoryWorkUnit.create).toHaveBeenCalledTimes(3);

      // Verify attempts:
      // C1: U0 available, U1..2 blocked
      // C2: all blocked
      // C3: NOT created at launch (only created dynamically if mismatch occurs)
      const attemptCalls = txMock.inventoryCountAttempt.create.mock.calls;
      expect(attemptCalls.length).toBe(6); // 2 controllers * 3 units

      const c1Attempts = attemptCalls.filter((c: any) => c[0].data.assignedUserId === c1UserId);
      expect(c1Attempts[0][0].data.status).toBe('AVAILABLE');
      expect(c1Attempts[1][0].data.status).toBe('BLOCKED');
      expect(c1Attempts[2][0].data.status).toBe('BLOCKED');

      const c2Attempts = attemptCalls.filter((c: any) => c[0].data.assignedUserId === c2UserId);
      c2Attempts.forEach((c: any) => expect(c[0].data.status).toBe('BLOCKED'));

      const c3Attempts = attemptCalls.filter((c: any) => c[0].data.assignedUserId === c3UserId);
      expect(c3Attempts.length).toBe(0);

      // Initial notification sent to Controller 1
      expect(txMock.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          recipientId: c1UserId,
          eventType: 'INVENTORY_TASK_AVAILABLE',
        }),
      });
    });
  });

  // ==========================================================================
  // 3. PIPELINE STREAMING & STRICT ADVANCEMENT
  // ==========================================================================
  describe('3. Pipeline Streaming & Strict Advancement', () => {
    it('C1 submitting U0 unlocks C1 U1 AND unlocks C2 U0', async () => {
      const u0Id = 'unit-0';
      const u1Id = 'unit-1';
      const u2Id = 'unit-2';

      txMock.inventoryCountAttempt.findUnique.mockResolvedValue({
        attemptId: 'c1-att-0',
        assignedUserId: c1UserId,
        purpose: 'PRIMARY_1',
        status: 'AVAILABLE',
        unit: {
          unitId: u0Id,
          unitOrder: 0,
          inventoryId: invId,
          inventory: { inventoryId: invId, status: 'IN_PROGRESS', title: 'Inv' },
        },
      });

      txMock.inventoryWorkUnit.findMany.mockResolvedValue([
        { unitId: u0Id, unitOrder: 0 },
        { unitId: u1Id, unitOrder: 1 },
        { unitId: u2Id, unitOrder: 2 },
      ]);

      txMock.inventoryCountAttempt.findFirst
        .mockResolvedValueOnce({
          attemptId: 'c1-att-1',
          assignedUserId: c1UserId,
          purpose: 'PRIMARY_1',
          status: 'BLOCKED',
        })
        .mockResolvedValueOnce({
          attemptId: 'c2-att-0',
          assignedUserId: c2UserId,
          purpose: 'PRIMARY_2',
          status: 'BLOCKED',
        });

      await inventoryService.submitCountAttempt('c1-att-0', c1UserId, {
        isDraft: false,
        observations: [
          { equipmentId: eqA, shelfId: shelfX, quantityCalculated: 10, isExplicitZero: false, isUnexpected: false },
        ],
      });

      // 1. C1 attempt marked SUBMITTED
      expect(txMock.inventoryCountAttempt.update).toHaveBeenCalledWith({
        where: { attemptId: 'c1-att-0' },
        data: expect.objectContaining({ status: 'SUBMITTED' }),
      });

      // 2. C1 U1 unlocked to AVAILABLE
      expect(txMock.inventoryCountAttempt.update).toHaveBeenCalledWith({
        where: { attemptId: 'c1-att-1' },
        data: { status: 'AVAILABLE' },
      });

      // 3. C2 U0 unlocked to AVAILABLE
      expect(txMock.inventoryCountAttempt.update).toHaveBeenCalledWith({
        where: { attemptId: 'c2-att-0' },
        data: { status: 'AVAILABLE' },
      });
    });

    it('rejects C2 jumping to U1 if C2 has not submitted U0', async () => {
      txMock.inventoryCountAttempt.findUnique.mockResolvedValue({
        attemptId: 'c2-att-1',
        assignedUserId: c2UserId,
        purpose: 'PRIMARY_2',
        status: 'AVAILABLE',
        unit: {
          unitId: 'unit-1',
          unitOrder: 1,
          inventoryId: invId,
          inventory: { inventoryId: invId, status: 'IN_PROGRESS' },
        },
      });

      // Prior attempt U0 for C2 is NOT submitted
      txMock.inventoryCountAttempt.findFirst.mockResolvedValue({
        attemptId: 'c2-att-0',
        assignedUserId: c2UserId,
        purpose: 'PRIMARY_2',
        status: 'AVAILABLE', // Not SUBMITTED!
      });

      await expect(
        inventoryService.submitCountAttempt('c2-att-1', c2UserId, { isDraft: false, observations: [] })
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ==========================================================================
  // 4. FULL RECOUNT BEHAVIOR (ANY MISMATCH ANYWHERE TRIGGERS C3 FOR ALL UNITS)
  // ==========================================================================
  describe('4. Primary Comparison & Controller 3 Full Recount', () => {
    it('triggers C3 to recount the ENTIRE inventory if even one unit differs', async () => {
      // Setup 3 units where U0 matches, U1 differs, U2 matches
      txMock.inventoryWorkUnit.findMany.mockResolvedValue([
        {
          unitId: 'unit-0',
          unitOrder: 0,
          attempts: [
            { purpose: 'PRIMARY_1', orders: [{ equipmentId: eqA, shelfId: shelfX, quantityCalculated: 5 }] },
            { purpose: 'PRIMARY_2', orders: [{ equipmentId: eqA, shelfId: shelfX, quantityCalculated: 5 }] },
          ],
        },
        {
          unitId: 'unit-1',
          unitOrder: 1,
          attempts: [
            { purpose: 'PRIMARY_1', orders: [{ equipmentId: eqB, shelfId: shelfX, quantityCalculated: 10 }] },
            { purpose: 'PRIMARY_2', orders: [{ equipmentId: eqB, shelfId: shelfX, quantityCalculated: 8 }] }, // Disagreement!
          ],
        },
        {
          unitId: 'unit-2',
          unitOrder: 2,
          attempts: [
            { purpose: 'PRIMARY_1', orders: [{ equipmentId: eqC, shelfId: shelfX, quantityCalculated: 20 }] },
            { purpose: 'PRIMARY_2', orders: [{ equipmentId: eqC, shelfId: shelfX, quantityCalculated: 20 }] },
          ],
        },
      ]);

      txMock.inventory.findUnique.mockResolvedValue({
        inventoryId: invId,
        title: 'Inventaire Test',
        Inventory_User: [
          { userId: c1UserId, sequence: 0 },
          { userId: c2UserId, sequence: 1 },
          { userId: c3UserId, sequence: 2 },
        ],
      });

      txMock.inventoryCountAttempt.findFirst.mockResolvedValue({
        attemptId: 'c3-att-0',
        unitId: 'unit-0',
        assignedUserId: c3UserId,
        purpose: 'FINAL_RECOUNT',
      });

      await inventoryService.reconcilePrimaryInventory(invId, txMock);

      // Verify inventory updated to THIRD_COUNT_REQUIRED
      expect(txMock.inventory.update).toHaveBeenCalledWith({
        where: { inventoryId: invId },
        data: {
          status: 'THIRD_COUNT_REQUIRED',
          thirdCountRequired: true,
        },
      });

      // Verify Controller 3 is unlocked for unit 0
      expect(txMock.inventoryCountAttempt.update).toHaveBeenCalledWith({
        where: { attemptId: 'c3-att-0' },
        data: {
          status: 'AVAILABLE',
        },
      });

      // Notification sent to Controller 3
      expect(txMock.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          recipientId: c3UserId,
          eventType: 'INVENTORY_THIRD_COUNT_REQUIRED',
        }),
      });
    });

    it('triggers C3 and sends notification when discrepancy occurs in ByShelf (PAR EMPLACEMENT) inventory', async () => {
      const shelf1Id = 'shelf-001';
      const shelf2Id = 'shelf-002';

      // 2 shelf work units: shelf-001 has disagreement in quantity for eqA
      txMock.inventoryWorkUnit.findMany.mockResolvedValue([
        {
          unitId: 'unit-shelf-1',
          unitOrder: 0,
          shelfId: shelf1Id,
          attempts: [
            {
              purpose: 'PRIMARY_1',
              orders: [
                { equipmentId: eqA, shelfId: shelf1Id, quantityCalculated: 15 },
                { equipmentId: eqB, shelfId: shelf1Id, quantityCalculated: 5 },
              ],
            },
            {
              purpose: 'PRIMARY_2',
              orders: [
                { equipmentId: eqA, shelfId: shelf1Id, quantityCalculated: 12 }, // Discrepancy (15 vs 12)!
                { equipmentId: eqB, shelfId: shelf1Id, quantityCalculated: 5 },
              ],
            },
          ],
        },
        {
          unitId: 'unit-shelf-2',
          unitOrder: 1,
          shelfId: shelf2Id,
          attempts: [
            {
              purpose: 'PRIMARY_1',
              orders: [{ equipmentId: eqC, shelfId: shelf2Id, quantityCalculated: 20 }],
            },
            {
              purpose: 'PRIMARY_2',
              orders: [{ equipmentId: eqC, shelfId: shelf2Id, quantityCalculated: 20 }],
            },
          ],
        },
      ]);

      txMock.inventory.findUnique.mockResolvedValue({
        inventoryId: invId,
        title: 'Inventaire Par Emplacement',
        typeInventory: 'ByShelf',
        Inventory_User: [
          { userId: c1UserId, sequence: 0 },
          { userId: c2UserId, sequence: 1 },
          { userId: c3UserId, sequence: 2 },
        ],
      });

      txMock.inventoryCountAttempt.findFirst.mockResolvedValue({
        attemptId: 'c3-att-shelf-1',
        unitId: 'unit-shelf-1',
        assignedUserId: c3UserId,
        purpose: 'FINAL_RECOUNT',
      });

      await inventoryService.reconcilePrimaryInventory(invId, txMock);

      // Verify status changed to THIRD_COUNT_REQUIRED
      expect(txMock.inventory.update).toHaveBeenCalledWith({
        where: { inventoryId: invId },
        data: {
          status: 'THIRD_COUNT_REQUIRED',
          thirdCountRequired: true,
        },
      });

      // Verify C3 attempt is set to AVAILABLE
      expect(txMock.inventoryCountAttempt.update).toHaveBeenCalledWith({
        where: { attemptId: 'c3-att-shelf-1' },
        data: {
          status: 'AVAILABLE',
        },
      });

      // Verify notification is sent to Controller 3
      expect(txMock.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          recipientId: c3UserId,
          eventType: 'INVENTORY_THIRD_COUNT_REQUIRED',
        }),
      });
    });

    it('bypasses Controller 3 completely when C1 and C2 match 100% on all units', async () => {
      txMock.inventoryWorkUnit.findMany.mockResolvedValue([
        {
          unitId: 'unit-0',
          unitOrder: 0,
          attempts: [
            { purpose: 'PRIMARY_1', orders: [{ equipmentId: eqA, shelfId: shelfX, quantityCalculated: 5 }] },
            { purpose: 'PRIMARY_2', orders: [{ equipmentId: eqA, shelfId: shelfX, quantityCalculated: 5 }] },
          ],
        },
        {
          unitId: 'unit-1',
          unitOrder: 1,
          attempts: [
            { purpose: 'PRIMARY_1', orders: [{ equipmentId: eqB, shelfId: shelfX, quantityCalculated: 12 }] },
            { purpose: 'PRIMARY_2', orders: [{ equipmentId: eqB, shelfId: shelfX, quantityCalculated: 12 }] },
          ],
        },
      ]);

      txMock.inventory.findUnique.mockResolvedValue({
        inventoryId: invId,
        title: 'Inventaire Parfait',
        creatorId,
        Inventory_User: [
          { userId: c1UserId, sequence: 0 },
          { userId: c2UserId, sequence: 1 },
          { userId: c3UserId, sequence: 2 },
        ],
      });

      await inventoryService.reconcilePrimaryInventory(invId, txMock);

      // Verified: Accepted provenance is PRIMARY_DOUBLE_COUNT_MATCH
      expect(txMock.inventory.update).toHaveBeenCalledWith({
        where: { inventoryId: invId },
        data: {
          status: 'COMPLETED',
          finalResultSource: 'PRIMARY_DOUBLE_COUNT_MATCH',
          thirdCountRequired: false,
        },
      });

      // C3 was NEVER unlocked and NO notification sent to C3
      expect(txMock.notification.create).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ recipientId: c3UserId }),
        })
      );
      // Ensure any existing FINAL_RECOUNT attempts and notifications are deleted
      expect(txMock.inventoryCountAttempt.deleteMany).toHaveBeenCalledWith({
        where: {
          unitId: { in: ['unit-0', 'unit-1'] },
          purpose: 'FINAL_RECOUNT',
        },
      });
      expect(txMock.notification.deleteMany).toHaveBeenCalledWith({
        where: {
          recipientId: c3UserId,
          payload: { contains: invId },
        },
      });
    });

    it('Controller 3 recount is the authoritative final truth (THIRD_FULL_RECOUNT_FINAL)', async () => {
      txMock.inventory.findUnique.mockResolvedValue({
        inventoryId: invId,
        title: 'Inventaire Recount',
        creatorId,
      });

      await inventoryService.finalizeFromThirdController(invId, txMock);

      expect(txMock.inventory.update).toHaveBeenCalledWith({
        where: { inventoryId: invId },
        data: {
          status: 'COMPLETED',
          finalResultSource: 'THIRD_FULL_RECOUNT_FINAL',
        },
      });
    });
  });

  // ==========================================================================
  // 5. SERIALIZED COUNTING RULES
  // ==========================================================================
  describe('5. Serialized Counting Rules', () => {
    it('resolves unique serial number code and prevents duplicate scan within the same attempt', async () => {
      txMock.inventoryCountAttempt.findUnique.mockResolvedValue({
        attemptId: 'att-sn',
        assignedUserId: c1UserId,
        purpose: 'PRIMARY_1',
        status: 'AVAILABLE',
        unit: {
          unitId: 'unit-0',
          unitOrder: 0,
          inventoryId: invId,
          equipmentId: eqA,
          inventory: { inventoryId: invId, status: 'IN_PROGRESS' },
        },
      });

      txMock.inventoryWorkUnit.findMany.mockResolvedValue([{ unitId: 'unit-0', unitOrder: 0 }]);
      txMock.inventoryCountAttempt.findFirst.mockResolvedValue(null);

      txMock.serialNumber.findMany.mockResolvedValue([
        { serialNumberId: 'sn-001', serialNumberCode: 'SN-001', equipmentId: eqA, shelfId: shelfX },
      ]);

      // Submitting the same serial code twice in the same attempt should fail
      await expect(
        inventoryService.submitCountAttempt('att-sn', c1UserId, {
          isDraft: false,
          observations: [
            { scannedSerialCode: 'SN-001', shelfId: shelfX, quantityCalculated: 1, isExplicitZero: false, isUnexpected: false },
            { scannedSerialCode: 'SN-001', shelfId: shelfX, quantityCalculated: 1, isExplicitZero: false, isUnexpected: false },
          ],
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('serialized comparison detects mismatch when serial locations differ even if quantity is identical', async () => {
      txMock.inventoryWorkUnit.findMany.mockResolvedValue([
        {
          unitId: 'unit-0',
          unitOrder: 0,
          attempts: [
            {
              purpose: 'PRIMARY_1',
              orders: [
                { equipmentId: eqA, shelfId: shelfX, scannedSerialCode: 'SN-001', quantityCalculated: 1 },
              ],
            },
            {
              purpose: 'PRIMARY_2',
              orders: [
                { equipmentId: eqA, shelfId: shelfY, scannedSerialCode: 'SN-001', quantityCalculated: 1 }, // Found on Shelf Y instead of X!
              ],
            },
          ],
        },
      ]);

      txMock.inventory.findUnique.mockResolvedValue({
        inventoryId: invId,
        Inventory_User: [
          { userId: c1UserId, sequence: 0 },
          { userId: c2UserId, sequence: 1 },
          { userId: c3UserId, sequence: 2 },
        ],
      });

      await inventoryService.reconcilePrimaryInventory(invId, txMock);

      // Disagreement because locations differ
      expect(txMock.inventory.update).toHaveBeenCalledWith({
        where: { inventoryId: invId },
        data: expect.objectContaining({ status: 'THIRD_COUNT_REQUIRED' }),
      });
    });
  });

  // ==========================================================================
  // 6. MISSING STOCK INVESTIGATION & ADMIN RESOLUTION
  // ==========================================================================
  describe('6. Missing Stock Investigation & Resolution', () => {
    it('resolves issue with outcome FOUND_IN_ANOTHER_LOCATION and updates shelf location', async () => {
      txMock.inventoryInvestigationIssue.findUnique.mockResolvedValue({
        issueId: 'iss-1',
        inventoryId: invId,
        status: 'OPEN',
        serialNumberId: 'sn-001',
        expectedShelfId: shelfX,
      });

      await inventoryService.resolveInvestigationIssue(invId, 'iss-1', creatorId, {
        resolutionType: 'FOUND_IN_ANOTHER_LOCATION',
        resolutionShelfId: shelfY,
        notes: 'Retrouvé au fond du rayon Y',
      });

      // Serial shelf updated to resolution shelf
      expect(txMock.serialNumber.update).toHaveBeenCalledWith({
        where: { serialNumberId: 'sn-001' },
        data: { shelfId: shelfY, serialNumberStatus: 'AVAILABLE' },
      });

      // Issue marked RESOLVED
      expect(txMock.inventoryInvestigationIssue.update).toHaveBeenCalledWith({
        where: { issueId: 'iss-1' },
        data: expect.objectContaining({
          status: 'RESOLVED',
          resolutionType: 'FOUND_IN_ANOTHER_LOCATION',
          resolutionShelfId: shelfY,
          resolvedByUserId: creatorId,
        }),
      });
    });

    it('resolves issue with outcome LOST and updates stock safely', async () => {
      txMock.inventoryInvestigationIssue.findUnique.mockResolvedValue({
        issueId: 'iss-2',
        inventoryId: invId,
        status: 'OPEN',
        serialNumberId: 'sn-002',
        expectedShelfId: shelfX,
      });

      await inventoryService.resolveInvestigationIssue(invId, 'iss-2', creatorId, {
        resolutionType: 'LOST',
        notes: 'Perte confirmée suite à recherche approfondie',
      });

      // Serial status marked LOST and removed from shelf
      expect(txMock.serialNumber.update).toHaveBeenCalledWith({
        where: { serialNumberId: 'sn-002' },
        data: { serialNumberStatus: 'LOST', shelfId: null },
      });

      expect(txMock.inventoryInvestigationIssue.update).toHaveBeenCalledWith({
        where: { issueId: 'iss-2' },
        data: expect.objectContaining({
          status: 'RESOLVED',
          resolutionType: 'LOST',
          resolvedByUserId: creatorId,
        }),
      });
    });

    it('enforces idempotency: cannot resolve an already resolved issue twice', async () => {
      txMock.inventoryInvestigationIssue.findUnique.mockResolvedValue({
        issueId: 'iss-3',
        inventoryId: invId,
        status: 'RESOLVED', // Already resolved!
      });

      await expect(
        inventoryService.resolveInvestigationIssue(invId, 'iss-3', creatorId, {
          resolutionType: 'LOST',
        })
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ==========================================================================
  // 7. SECURITY & BYPASS PREVENTION
  // ==========================================================================
  describe('7. Security & Bypass Prevention', () => {
    it('forbids a counter from accessing a task assigned to another user', async () => {
      prismaMock.inventoryCountAttempt.findUnique.mockResolvedValue({
        attemptId: 'c2-task',
        assignedUserId: c2UserId,
        unit: { inventory: { title: 'Inv', typeInventory: 'ByEquipment', Inventory_User: [] } },
        orders: [],
      });

      await expect(
        inventoryService.getTask('c2-task', c1UserId)
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects legacy per-unit adjudication endpoint for V2 inventories', async () => {
      prismaMock.inventoryWorkUnit.findUnique.mockResolvedValue({
        unitId: 'unit-1',
        inventory: { policyVersion: 2 },
      });

      await expect(
        inventoryService.manualAdjudicate('unit-1', creatorId, { quantity: 5 } as any)
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects legacy assign-third-user endpoint for V2 inventories', async () => {
      prismaMock.inventory.findUnique.mockResolvedValue({
        inventoryId: invId,
        policyVersion: 2,
      });

      await expect(
        inventoryService.assignThirdUser(invId, 'unit-1', c3UserId, creatorId)
      ).rejects.toThrow(BadRequestException);
    });
  });
});