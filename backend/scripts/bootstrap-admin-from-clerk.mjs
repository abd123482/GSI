import 'dotenv/config';

import { createClerkClient } from '@clerk/backend';
import { PrismaMssql } from '@prisma/adapter-mssql';
import { PrismaClient } from '../dist/generated/prisma/client.js';

const DATABASE = 'yacinedb';
const REQUIRED_CONFIRMATION =
  'I CONFIRM CREATE OR LINK THIS CLERK USER AS PRODUCTION ADMIN';

function required(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

const requestedEmail =
  required('BOOTSTRAP_ADMIN_EMAIL')
    .trim()
    .toLowerCase();

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

const clerk = createClerkClient({
  secretKey: required('CLERK_SECRET_KEY'),
});

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

function normalizeUserList(result) {
  if (Array.isArray(result)) {
    return result;
  }

  if (Array.isArray(result?.data)) {
    return result.data;
  }

  return [];
}

function userEmails(user) {
  return (user?.emailAddresses ?? [])
    .map((item) =>
      String(item?.emailAddress ?? '')
        .trim()
        .toLowerCase(),
    )
    .filter(Boolean);
}

function displayName(user, email) {
  const fullName = [
    user?.firstName,
    user?.lastName,
  ]
    .filter(Boolean)
    .join(' ')
    .trim();

  const value =
    fullName ||
    user?.username ||
    email;

  return String(value).slice(0, 50);
}

async function getExactClerkUserByEmail(email) {
  let result;

  try {
    result = await clerk.users.getUserList({
      emailAddress: [email],
      limit: 10,
    });
  } catch (error) {
    throw new Error(
      [
        `Clerk lookup failed for ${email}.`,
        error instanceof Error
          ? error.message
          : String(error),
      ].join('\n'),
    );
  }

  const candidates =
    normalizeUserList(result);

  const exact = candidates.filter(
    (user) =>
      userEmails(user).includes(email),
  );

  if (exact.length === 0) {
    throw new Error(
      [
        `No Clerk user exists with email ${email}.`,
        'Create/sign up that email in Clerk first, then rerun this script.',
      ].join('\n'),
    );
  }

  if (exact.length > 1) {
    throw new Error(
      [
        `Safety stop: more than one Clerk user matched ${email}.`,
        'Resolve the duplicate Clerk identities before bootstrap.',
      ].join('\n'),
    );
  }

  return exact[0];
}

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
    String(
      identity?.currentDatabase ?? '',
    ).toLowerCase() !==
    DATABASE
  ) {
    throw new Error(
      `Safety stop: connected to ${identity?.currentDatabase}, expected ${DATABASE}.`,
    );
  }

  const adminRole =
    await prisma.role.findFirst({
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
      'ADMIN role does not exist in yacinedb.',
    );
  }

  const clerkUser =
    await getExactClerkUserByEmail(
      requestedEmail,
    );

  const clerkUserId =
    String(clerkUser.id);

  const name =
    displayName(
      clerkUser,
      requestedEmail,
    );

  const existingByClerk =
    await prisma.user.findFirst({
      where: {
        clerkUserId,
      },
      include: {
        role: true,
      },
    });

  const existingByEmail =
    await prisma.user.findFirst({
      where: {
        userEmail:
          requestedEmail,
      },
      include: {
        role: true,
      },
    });

  if (
    existingByEmail &&
    existingByEmail.clerkUserId &&
    existingByEmail.clerkUserId !==
      clerkUserId
  ) {
    throw new Error(
      [
        'Safety stop: the SQL user with this email is already linked to a different Clerk user.',
        `Email: ${requestedEmail}`,
      ].join('\n'),
    );
  }

  if (
    existingByClerk &&
    existingByEmail &&
    existingByClerk.userId !==
      existingByEmail.userId
  ) {
    throw new Error(
      'Safety stop: Clerk ID and email point to two different SQL users.',
    );
  }

  const current =
    existingByClerk ??
    existingByEmail;

  let updated;

  if (current) {
    updated =
      await prisma.user.update({
        where: {
          userId: current.userId,
        },
        data: {
          clerkUserId,
          userEmail:
            requestedEmail,
          userName:
            name,
          userStatus:
            'ACTIVE',
          roleId:
            adminRole.roleId,
        },
        include: {
          role: true,
        },
      });
  } else {
    updated =
      await prisma.user.create({
        data: {
          clerkUserId,
          userEmail:
            requestedEmail,
          userName:
            name,
          userStatus:
            'ACTIVE',
          roleId:
            adminRole.roleId,
        },
        include: {
          role: true,
        },
      });
  }

  if (
    updated.clerkUserId !==
      clerkUserId ||
    updated.userEmail
      .toLowerCase() !==
      requestedEmail ||
    updated.userStatus !==
      'ACTIVE' ||
    updated.role?.roleName !==
      'ADMIN'
  ) {
    throw new Error(
      'Post-bootstrap verification failed.',
    );
  }

  console.log('');
  console.log('DIRECT CLERK ADMIN BOOTSTRAP');
  console.log('============================');
  console.log(
    `Server: ${identity?.currentServer}`,
  );
  console.log(
    `Database: ${identity?.currentDatabase}`,
  );
  console.log(
    `Email: ${updated.userEmail}`,
  );
  console.log(
    `Name: ${updated.userName}`,
  );
  console.log(
    `Status: ${updated.userStatus}`,
  );
  console.log(
    `Role: ${updated.role?.roleName}`,
  );
  console.log(
    'Clerk linked: YES',
  );
  console.log('');
  console.log(
    current
      ? 'SUCCESS: existing SQL user linked/updated as ACTIVE ADMIN.'
      : 'SUCCESS: Clerk user created locally as ACTIVE ADMIN.',
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
