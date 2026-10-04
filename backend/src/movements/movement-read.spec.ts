// @ts-nocheck
import { describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { EquipmentMovementController } from './equipmentMovement.controller.js';
import { EquipmentMovementService } from './equipmentMovement.service.js';
import { Prisma } from '../generated/prisma/client.js';
const movementId = '11111111-1111-4111-8111-111111111111';
const equipmentId = '22222222-2222-4222-8222-222222222222';
const sourceShelfId = '33333333-3333-4333-8333-333333333333';

describe('movement V3 read API', () => {
  it('controller forwards the new document payload to createMovement', async () => {
    const service = {
      createMovement: vi.fn().mockResolvedValue({
        mouvementId: movementId,
      }),
    };

    const controller = new EquipmentMovementController(
      service as unknown as EquipmentMovementService,
    );

    const dto = {
      movementType: 'IN' as const,
      destinationShelfId:
        '44444444-4444-4444-8444-444444444444',
      items: [
        {
          equipmentId,
          movementQuantity: 2,
        },
      ],
    };

    await expect(
      controller.createMovement(
        dto,
        { userId: 'actor' } as any,
      ),
    ).resolves.toEqual({
      mouvementId: movementId,
    });

    expect(service.createMovement).toHaveBeenCalledWith(
      dto,
      'actor',
    );
  });

  it('getMovements paginates headers and filters through canonical child lines', async () => {
    const prisma = {
      mouvement: {
        findMany: vi.fn().mockResolvedValue([
          {
            mouvementId: movementId,
            mouvementStatus: true,
            items: [],
          },
        ]),
        count: vi.fn().mockResolvedValue(1),
      },
    };

    const service = new EquipmentMovementService(prisma as any);

    const result = await service.getMovements({
      page: 2,
      limit: 10,
      movementType: 'OUT',
      equipmentId,
      sourceShelfId,
    });

    expect(prisma.mouvement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.any(Object),
        skip: 10,
        take: 10,
        orderBy: [
          { createdAt: 'desc' },
          { mouvementId: 'desc' },
        ],
      }),
    );

    expect(prisma.mouvement.count).toHaveBeenCalledWith({
      where: expect.any(Object),
    });

    expect(result).toEqual(
      expect.objectContaining({
        totalMovements: 1,
        currentPage: 2,
        limit: 10,
      }),
    );
  });

  it('getMovementById returns one complete movement document', async () => {
    const movement = {
      mouvementId: movementId,
      mouvementStatus: false,
      items: [
        {
          equipmentId,
        },
      ],
    };

    const prisma = {
      mouvement: {
        findUniqueOrThrow: vi.fn().mockResolvedValue(movement),
      },
    };

    const service = new EquipmentMovementService(prisma as any);

    await expect(
      service.getMovementById(movementId),
    ).resolves.toEqual(movement);

    expect(prisma.mouvement.findUniqueOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          mouvementId: movementId,
        },
      }),
    );
  });

  it('getMovementById throws when the movement does not exist', async () => {
    const prisma = {
      mouvement: {
        findUniqueOrThrow: vi.fn().mockRejectedValue(new Prisma.PrismaClientKnownRequestError('Not found', { code: 'P2025', clientVersion: '0' })),
      },
    };

    const service = new EquipmentMovementService(prisma as any);

    await expect(
      service.getMovementById(movementId),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
