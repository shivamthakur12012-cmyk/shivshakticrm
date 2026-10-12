import prisma from '../config/prisma';
import logger from '../utils/logger';

async function main() {
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Organization" 
      ADD COLUMN IF NOT EXISTS "bankName" TEXT,
      ADD COLUMN IF NOT EXISTS "bankAccount" TEXT,
      ADD COLUMN IF NOT EXISTS "bankIfsc" TEXT,
      ADD COLUMN IF NOT EXISTS "bankUpi" TEXT;
    `);
    console.log('✔ Successfully added bank columns to Organization table in PostgreSQL!');
    process.exit(0);
  } catch (error) {
    console.error('Error applying migration:', error);
    process.exit(1);
  }
}

main();
