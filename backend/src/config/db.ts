import prisma from './prisma';
import logger from '../utils/logger';

let keepAliveInterval: NodeJS.Timeout | null = null;

export function startDBKeepAlive() {
  if (keepAliveInterval) return;

  // Run a lightweight query every 3 minutes (180s) to keep Neon serverless compute 100% warm
  keepAliveInterval = setInterval(async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (err) {
      logger.warn('Neon DB keep-alive heartbeat ping failed:', err);
    }
  }, 3 * 60 * 1000);

  if (keepAliveInterval.unref) {
    keepAliveInterval.unref();
  }
}

export function stopDBKeepAlive() {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
  }
}

export async function connectDB() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    logger.error('DATABASE_URL environment variable is missing.');
    process.exit(1);
  }

  try {
    // Verify connection by running a lightweight query
    await prisma.$queryRaw`SELECT 1`;
    logger.info('Successfully connected to PostgreSQL database via Prisma.');
    
    // Start keep-alive heartbeat to prevent cloud database cold-sleep
    startDBKeepAlive();
  } catch (error) {
    logger.error('Failed to initialize PostgreSQL database connection:', error);
    // In dev mode, log warning so developer can update .env credentials
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }
}

export async function disconnectDB() {
  stopDBKeepAlive();
  await prisma.$disconnect();
}
