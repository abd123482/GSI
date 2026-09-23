import 'dotenv/config';

import { PrismaMssql } from '@prisma/adapter-mssql';
import { PrismaClient } from '../dist/generated/prisma/client.js';

const DATABASE = 'yacinedb';
const REQUIRED_CONFIRMATION =
  'I CONFIRM BOOTSTRAP THIS EXISTING CLERK USER AS PRODUCTION ADMIN';

function required(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

const email =
  required('BOOTSTRAP_ADMIN_EMAIL').trim();

const confirmation =
  required('BOOTSTRAP_ADMIN_CONFIRMATION');

if (confirmation !== REQUIRED_CONFIRMATION) {
  throw new Error(
    [
      'Safety confirmation does not match.',
      `Required: ${REQUIRED_CONFIRMATION}`,
    ].join('\n'),
  );
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

  const adminRole = await prisma.role.findFirst({
    where: {
      roleName: 'ADMIN',
    },
    select: {
      roleId: true,
      roleName: true,
    },
  });

  if (!adminRole) {
    throw new Error(
      'ADMIN role does not exist. Do not bootstrap until the production rebuild/reference seed is verified.',
    );
  }

  const matches = await prisma.user.findMany({
    where: {
      userEmail: email,
    },
    select: {
      userId: true,
      clerkUserId: true,
      userName: true,
      userEmail: true,
      userStatus: true,
      roleId: true,
      role: {
        select: {
          roleName: true,
        },
      },
    },
  });

  if (matches.length === 0) {
    throw new Error(
      [
        `No local SQL user exists for ${email}.`,
        '',
        'Start the normal backend/frontend and sign in once with that Clerk account first.',
        'A PENDING local user must exist before bootstrap.',
      ].join('\n'),
    );
  }

  if (matches.length > 1) {
    throw new Error(
      `Safety stop: more than one local user has email ${email}. Resolve duplicates manually before bootstrap.`,
    );
  }

  const target = matches[0];

  if (!target.clerkUserId) {
    throw new Error(
      'Safety stop: the target local user is not linked to a Clerk user.',
    );
  }

  console.log('');
  console.log('SOMIPHARM PRODUCTION ADMIN BOOTSTRAP');
  console.log('====================================');
  console.log(`Database:       ${identity?.currentDatabase}`);
  console.log(`User name:      ${target.userName ?? '-'}`);
  console.log(`User email:     ${target.userEmail ?? '-'}`);
  console.log(`Current status: ${target.userStatus ?? '-'}`);
  console.log(`Current role:   ${target.role?.roleName ?? '-'}`);
  console.log('Clerk linked:   YES');
  console.log('');

  if (
    target.userStatus === 'ACTIVE' &&
    target.role?.roleName === 'ADMIN'
  ) {
    console.log('NO-OP: this Clerk-linked user is already an ACTIVE ADMIN.');
    return;
  }

  const updated = await prisma.$transaction(async (tx) => {
    return tx.user.update({
      where: {
        userId: target.userId,
      },
      data: {
        roleId: adminRole.roleId,
        userStatus: 'ACTIVE',
      },
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
    });
  });

  if (
    updated.userStatus !== 'ACTIVE' ||
    updated.role?.roleName !== 'ADMIN' ||
    !updated.clerkUserId
  ) {
    throw new Error(
      'Post-update verification failed.',
    );
  }

  console.log('SUCCESS: existing Clerk-linked user promoted to ACTIVE ADMIN.');
  console.log(`Email:  ${updated.userEmail}`);
  console.log(`Status: ${updated.userStatus}`);
  console.log(`Role:   ${updated.role.roleName}`);
  console.log('');
  console.log(
    'Sign out and sign in again in the frontend before continuing the production smoke test.',
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });
