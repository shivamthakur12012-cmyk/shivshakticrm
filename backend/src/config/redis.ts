import Redis, { RedisOptions } from 'ioredis';
import logger from '../utils/logger';

let redisClient: Redis | null = null;
let isConnected = false;
let hasLoggedWarning = false;

// Fallback in-memory store for environments where Redis is not running or temporarily down
interface InMemoryEntry {
  value: string;
  expiresAt: number;
}
const memoryStore = new Map<string, InMemoryEntry>();

// Periodic memory store cleanup
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of memoryStore.entries()) {
    if (entry.expiresAt > 0 && entry.expiresAt <= now) {
      memoryStore.delete(key);
    }
  }
}, 60 * 1000).unref();

export function initRedis(): Redis | null {
  let redisUrl = process.env.REDIS_URL;
  if (!redisUrl && process.env.REDIS_HOST) {
    const host = process.env.REDIS_HOST.replace(/"/g, '');
    const port = process.env.REDIS_PORT || '6379';
    const user = (process.env.REDIS_USER || 'default').replace(/"/g, '');
    const password = (process.env.REDIS_PASSWORD || '').replace(/"/g, '');
    redisUrl = password ? `redis://${user}:${password}@${host}:${port}` : `redis://${host}:${port}`;
  }
  if (!redisUrl) {
    redisUrl = 'redis://localhost:6379';
  }
  redisUrl = redisUrl.replace(/"/g, '');

  try {
    const options: RedisOptions = {
      maxRetriesPerRequest: 1,
      retryStrategy(times) {
        if (times > 3) {
          if (!hasLoggedWarning) {
            logger.warn(`Redis connection unavailable at ${redisUrl}. Using resilient in-memory cache/blacklist fallback.`);
            hasLoggedWarning = true;
          }
          return null; // Stop reconnecting continuously if Redis is down
        }
        return Math.min(times * 200, 2000);
      },
      lazyConnect: false,
      enableOfflineQueue: false
    };

    redisClient = new Redis(redisUrl, options);

    redisClient.on('connect', () => {
      isConnected = true;
      hasLoggedWarning = false;
      logger.info(`Redis connected successfully to ${redisUrl.replace(/\/\/[^@]*@/, '//***@')}`);
    });

    redisClient.on('ready', () => {
      isConnected = true;
    });

    redisClient.on('error', (err: any) => {
      isConnected = false;
      if (!hasLoggedWarning) {
        logger.warn(`Redis connection error: ${err.message}. Operating with in-memory fallback.`);
        hasLoggedWarning = true;
      }
    });

    redisClient.on('close', () => {
      isConnected = false;
    });

    return redisClient;
  } catch (err: any) {
    logger.warn(`Failed to initialize Redis client: ${err.message}. Using in-memory fallback.`);
    return null;
  }
}

export function isRedisActive(): boolean {
  return isConnected && redisClient !== null && (redisClient.status === 'ready' || redisClient.status === 'connect');
}

export function getRedisClient(): Redis | null {
  return redisClient;
}

// Unified Cache Operations with automatic Redis <-> Memory Fallback
export async function redisGet(key: string): Promise<string | null> {
  if (isRedisActive() && redisClient) {
    try {
      return await redisClient.get(key);
    } catch {
      // Fallback on transient error
    }
  }
  const entry = memoryStore.get(key);
  if (!entry) return null;
  if (entry.expiresAt > 0 && entry.expiresAt <= Date.now()) {
    memoryStore.delete(key);
    return null;
  }
  return entry.value;
}

export async function redisSet(key: string, value: string, ttlSeconds?: number): Promise<void> {
  if (isRedisActive() && redisClient) {
    try {
      if (ttlSeconds && ttlSeconds > 0) {
        await redisClient.set(key, value, 'EX', ttlSeconds);
      } else {
        await redisClient.set(key, value);
      }
      return;
    } catch {
      // Fallback on transient error
    }
  }

  const expiresAt = ttlSeconds && ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : 0;
  memoryStore.set(key, { value, expiresAt });
}

export async function redisDel(keyOrPattern: string): Promise<void> {
  if (isRedisActive() && redisClient) {
    try {
      if (keyOrPattern.includes('*')) {
        const keys = await redisClient.keys(keyOrPattern);
        if (keys.length > 0) {
          await redisClient.del(...keys);
        }
      } else {
        await redisClient.del(keyOrPattern);
      }
      return;
    } catch {
      // Fallback
    }
  }

  if (keyOrPattern.includes('*')) {
    const regex = new RegExp('^' + keyOrPattern.replace(/\*/g, '.*') + '$');
    for (const k of memoryStore.keys()) {
      if (regex.test(k)) {
        memoryStore.delete(k);
      }
    }
  } else {
    memoryStore.delete(keyOrPattern);
  }
}

export async function redisExists(key: string): Promise<boolean> {
  if (isRedisActive() && redisClient) {
    try {
      const count = await redisClient.exists(key);
      return count > 0;
    } catch {
      // Fallback
    }
  }
  const entry = memoryStore.get(key);
  if (!entry) return false;
  if (entry.expiresAt > 0 && entry.expiresAt <= Date.now()) {
    memoryStore.delete(key);
    return false;
  }
  return true;
}

// Auto-initialize on module load
initRedis();
