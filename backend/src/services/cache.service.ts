import { redisGet, redisSet, redisDel } from '../config/redis';
import logger from '../utils/logger';

/**
 * High-performance Cache Service with JSON serialization and multi-tenant key namespacing.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const raw = await redisGet(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (error) {
    logger.warn(`Cache deserialization error for key ${key}:`, error);
    return null;
  }
}

export async function cacheSet<T>(key: string, data: T, ttlSeconds: number = 60): Promise<void> {
  try {
    const serialized = JSON.stringify(data);
    await redisSet(key, serialized, ttlSeconds);
  } catch (error) {
    logger.warn(`Cache set error for key ${key}:`, error);
  }
}

export async function cacheDel(keyOrPattern: string): Promise<void> {
  try {
    await redisDel(keyOrPattern);
  } catch (error) {
    logger.warn(`Cache delete error for pattern ${keyOrPattern}:`, error);
  }
}

/**
 * Transparent Cache Wrapper (Cache-Aside pattern):
 * Fetches from cache if available; otherwise invokes fetcher, caches result, and returns.
 */
export async function cacheWrap<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const cached = await cacheGet<T>(key);
  if (cached !== null && cached !== undefined) {
    return cached;
  }

  const fresh = await fetcher();
  if (fresh !== null && fresh !== undefined) {
    await cacheSet(key, fresh, ttlSeconds);
  }
  return fresh;
}

/**
 * Generates an isolated multi-tenant cache key.
 */
export function getOrgCacheKey(orgId: string | undefined, namespace: string, subKey: string = ''): string {
  const safeOrg = orgId || 'default';
  return `cache:org:${safeOrg}:${namespace}${subKey ? ':' + subKey : ''}`;
}

/**
 * Invalidates all cache entries for an organization within a namespace (or all namespaces).
 */
export async function invalidateOrgCache(orgId?: string, namespace?: string): Promise<void> {
  const safeOrg = orgId || '*';
  const pattern = namespace
    ? `cache:org:${safeOrg}:${namespace}*`
    : `cache:org:${safeOrg}:*`;
  await cacheDel(pattern);
}
