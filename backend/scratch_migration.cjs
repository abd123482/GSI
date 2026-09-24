const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

async function main() {
  const prisma = new PrismaClient();
  try {
    const sql = fs.readFileSync('prisma/migrations/20260924_add_shelf_status/migration.sql', 'utf8');
    console.log('Executing SQL migration directly...');
    
    // We split on GO or just execute the whole block if possible.
    // However, Prisma $executeRawUnsafe might not like multiple statements with GO, but this is a T-SQL BEGIN TRY block so it's one statement.
    await prisma.$executeRawUnsafe(sql);
    console.log('Success!');
  } catch (e) {
    console.error('Error applying migration:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
