import 'dotenv/config';
import { PrismaClient } from './src/generated/prisma/client.js';
import { PrismaMssql } from '@prisma/adapter-mssql';

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

async function run() {
  try {
    const statuses = await prisma.stockStatus.findMany();
    console.log('STATUSES_COUNT:', statuses.length);
    console.log('STATUSES:', statuses);

    const stocks = await prisma.stock.findMany({ take: 3 });
    console.log('STOCKS:', stocks);
  } catch (e) {
    console.error('DB ERROR:', e);
  } finally {
    await prisma.$disconnect();
  }
}

run();
