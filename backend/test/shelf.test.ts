import { describe, it, expect } from 'vitest';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaMssql } from '@prisma/adapter-mssql';
import 'dotenv/config';

describe('Shelf delete test', () => {
  const adapter = new PrismaMssql({
    server: process.env.DB_HOST!,
    port: Number(process.env.DB_PORT ?? 1433),
    database: process.env.DB_NAME!,
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    options: {
      encrypt: true,
      trustServerCertificate: true,
    },
  });

  const prisma = new PrismaClient({ adapter });

  it('should query existing shelves and test delete logic', async () => {
    const shelves = await prisma.shelf.findMany({ take: 5 });
    console.log('Found shelves in DB:', shelves);
    expect(Array.isArray(shelves)).toBe(true);

    if (shelves.length > 0) {
      const firstShelf = shelves[0];
      console.log('Testing relations on first shelf:', firstShelf.shelfId);

      // Check serial numbers
      const snCount = await prisma.serialNumber.count({
        where: { shelfId: firstShelf.shelfId },
      });
      console.log('snCount:', snCount);

      // Check canonical movement lines referencing the shelf.
      const movementLines = await prisma.mouvementEquipment.count({
        where: {
          OR: [
            { sourceShelfId: firstShelf.shelfId },
            { destinationShelfId: firstShelf.shelfId },
          ],
        },
      });
      console.log('movementLines:', movementLines);

      // Check mouvements
      const mvtCount = await prisma.mouvement.count({
        where: {
          OR: [
            { sourceShelfId: firstShelf.shelfId },
            { destinationShelfId: firstShelf.shelfId },
          ],
        },
      });
      console.log('mvtCount:', mvtCount);
    }
  });
});
