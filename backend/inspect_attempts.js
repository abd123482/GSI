import { PrismaMssql } from '@prisma/adapter-mssql';
import { PrismaClient } from './src/generated/prisma/client.js';
import 'dotenv/config';

async function main() {
  const adapter = new PrismaMssql({
    server: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 1433),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    options: { encrypt: true, trustServerCertificate: true },
  });
  const prisma = new PrismaClient({ adapter });
  await prisma.$connect();

  const inv = await prisma.inventory.findUnique({
    where: { inventoryId: '76c6efed-dea2-438d-9592-0b96462bb910' },
    include: {
      workUnits: {
        include: {
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
      },
    },
  });

  console.log('STATUS:', inv.status, '3RD_REQUIRED:', inv.thirdCountRequired, 'SOURCE:', inv.finalResultSource);
  for (const u of inv.workUnits) {
    console.log('\nUnit:', u.unitId);
    for (const a of u.attempts) {
      console.log('  Attempt:', a.purpose, 'Status:', a.status, 'Orders:', a.orders.length);
      for (const o of a.orders) {
        console.log('    -> Eq:', o.equipment?.equipmentName || o.equipmentId, 'Qty:', o.countedQuantity, 'SN:', o.serialNumber?.serialNumberCode || o.scannedSerialCode || '-');
      }
    }
  }

  await prisma.$disconnect();
}

main().catch(console.error);
