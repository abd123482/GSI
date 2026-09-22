import {
  afterAll,
  describe,
  expect,
  it,
} from 'vitest';

import 'dotenv/config';

import { PrismaClient } from '../generated/prisma/client.js';
import { PrismaMssql } from '@prisma/adapter-mssql';

import { EquipmentMovementService } from './equipmentMovement.service.js';
import { EquipmentService } from '../equipment/equipment.service.js';

const runDatabaseTests =
  process.env.RUN_MOVEMENT_DB_TESTS ===
    '1' &&
  /^test[_-]/i.test(
    process.env.DB_NAME ?? '',
  );

describe.skipIf(
  !runDatabaseTests,
)(
  'Equipment movement integration',
  () => {
    const adapter =
      new PrismaMssql({
        server:
          process.env.DB_HOST!,
        port: Number(
          process.env.DB_PORT ??
            1433,
        ),
        database:
          process.env.DB_NAME!,
        user:
          process.env.DB_USER!,
        password:
          process.env.DB_PASSWORD!,
        options: {
          encrypt: true,
          trustServerCertificate:
            true,
        },
      });

    const prisma =
      new PrismaClient({
        adapter,
      });

    const movementService =
      new EquipmentMovementService(
        prisma as any,
      );

    const equipmentService =
      new EquipmentService(
        prisma as any,
      );

    it(
      'creates one IN movement and keeps stock totals consistent',
      async () => {
        const suffix =
          Date.now();

        const activeStatus =
          await prisma.stockStatus.upsert({
            where: {
              stockStatusName:
                'ACTIVE',
            },
            update: {},
            create: {
              stockStatusName:
                'ACTIVE',
            },
          });

        const stock =
          await prisma.stock.create({
            data: {
              stockName:
                `Test Stock ${suffix}`,
              stockStatusId:
                activeStatus.stockStatusId,
            },
          });

        const shelf =
          await prisma.shelf.create({
            data: {
              shelfName:
                `Test Shelf ${suffix}`,
              shelfQuantity: 0,
              stockId:
                stock.stockId,
            },
          });

        const equipment =
          await equipmentService.createEquipment({
            equipmentName:
              `Test Equipment ${suffix}`,
            hasSerialNumber:
              false,
            minEquipmentQuantity:
              1,
          });

        try {
          const movement =
            await movementService.createMovement({
              movementType:
                'IN',
              destinationShelfId:
                shelf.shelfId,
              items: [
                {
                  equipmentId:
                    equipment.equipmentId,
                  movementQuantity:
                    3,
                },
              ],
            });

          expect(
            movement.mouvementStatus,
          ).toBe('IN');

          expect(
            movement.items,
          ).toHaveLength(1);

          const [
            equipmentAfter,
            shelfAfter,
            allocation,
          ] = await Promise.all([
            prisma.equipment.findUnique({
              where: {
                equipmentId:
                  equipment.equipmentId,
              },
            }),

            prisma.shelf.findUnique({
              where: {
                shelfId:
                  shelf.shelfId,
              },
            }),

            prisma.equipmentShelfs.findUnique({
              where: {
                equipmentId_shelfId: {
                  equipmentId:
                    equipment.equipmentId,
                  shelfId:
                    shelf.shelfId,
                },
              },
            }),
          ]);

          expect(
            equipmentAfter
              ?.equipmentQuantity,
          ).toBe(3);

          expect(
            shelfAfter
              ?.shelfQuantity,
          ).toBe(3);

          expect(
            allocation
              ?.equipmentQuantity,
          ).toBe(3);

          const history =
            await movementService.getMovements({
              page: 1,
              limit: 10,
              equipmentId:
                equipment.equipmentId,
            });

          expect(
            history.movements.some(
              (item) =>
                item.mouvementId ===
                movement.mouvementId,
            ),
          ).toBe(true);
        } finally {
          await prisma.mouvement.deleteMany({
            where: {
              items: {
                some: {
                  equipmentId:
                    equipment.equipmentId,
                },
              },
            },
          });

          await prisma.equipmentShelfs.deleteMany({
            where: {
              equipmentId:
                equipment.equipmentId,
            },
          });

          await prisma.equipment.deleteMany({
            where: {
              equipmentId:
                equipment.equipmentId,
            },
          });

          await prisma.shelf.deleteMany({
            where: {
              shelfId:
                shelf.shelfId,
            },
          });

          await prisma.stock.deleteMany({
            where: {
              stockId:
                stock.stockId,
            },
          });
        }
      },
      35_000,
    );

    afterAll(
      async () => {
        await prisma.$disconnect();
      },
    );
  },
);
