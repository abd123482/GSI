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

async function main() {
  const users = await prisma.user.findMany({ include: { role: true } });
  console.log(users);
}

main().catch(console.error).finally(() => prisma.$disconnect());
