import 'dotenv/config';

import { PrismaMssql } from '@prisma/adapter-mssql';
import { PrismaClient } from '../dist/generated/prisma/client.js';

const DATABASE = 'yacinedb';

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

const prisma = new PrismaClient({
  adapter: new PrismaMssql({
    server: required('DB_HOST'),
    port: Number(process.env.DB_PORT ?? 1433),
    database: DATABASE,
    user: required('DB_USER'),
    password: required('DB_PASSWORD'),
    options: {
      encrypt: true,
      trustServerCertificate: true,
    },
  }),
});

async function main() {
  await prisma.$connect();

  const identity = (
    await prisma.$queryRawUnsafe(`
      SELECT
        @@SERVERNAME AS currentServer,
        DB_NAME() AS currentDatabase
    `)
  )[0];

  if (
    String(identity?.currentDatabase ?? '').toLowerCase() !==
    DATABASE.toLowerCase()
  ) {
    throw new Error(
      `Safety stop: connected to ${identity?.currentDatabase}, expected ${DATABASE}.`,
    );
  }

  const users = await prisma.user.findMany({
    select: {
      userName: true,
      userEmail: true,
      userStatus: true,
      clerkUserId: true,
      role: {
        select: {
          roleName: true,
        },
      },
    },
    orderBy: [
      {
        userStatus: 'asc',
      },
      {
        userEmail: 'asc',
      },
    ],
  });

  console.log('');
  console.log('SOMIPHARM PRODUCTION AUTH USERS');
  console.log('===============================');
  console.log(`Server:   ${identity?.currentServer ?? 'unknown'}`);
  console.log(`Database: ${identity?.currentDatabase ?? 'unknown'}`);
  console.log('');

  if (users.length === 0) {
    console.log('No local users exist yet.');
    console.log('');
    console.log(
      'Start the normal backend/frontend and sign in once with the intended Clerk admin account.',
    );
    console.log(
      'The first authenticated request will create a local PENDING user.',
    );
    return;
  }

  for (const user of users) {
    console.log(
      [
        `Name=${user.userName ?? '-'}`,
        `Email=${user.userEmail ?? '-'}`,
        `Status=${user.userStatus ?? '-'}`,
        `Role=${user.role?.roleName ?? '-'}`,
        `ClerkLinked=${user.clerkUserId ? 'YES' : 'NO'}`,
      ].join(' | '),
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });
