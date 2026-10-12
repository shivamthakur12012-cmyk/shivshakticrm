import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { redisSet, redisExists, redisGet } from '../config/redis';
import logger from '../utils/logger';

// Hashes a token with SHA-256 to ensure consistent key size (64 chars) and prevent plaintext exposure in Redis
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
}

/**
 * Blacklists an individual access token until its natural expiration.
 */
export async function blacklistToken(token: string, fallbackTtlSeconds: number = 900): Promise<void> {
  if (!token) return;

  try {
    const cleanToken = token.startsWith('Bearer ') ? token.slice(7).trim() : token.trim();
    const tokenHash = hashToken(cleanToken);
    const key = `bl:token:${tokenHash}`;

    // Determine remaining TTL
    let ttlSeconds = fallbackTtlSeconds;
    try {
      const decoded: any = jwt.decode(cleanToken);
      if (decoded && decoded.exp) {
        const remaining = decoded.exp - Math.floor(Date.now() / 1000);
        ttlSeconds = remaining > 0 ? remaining : 1;
      }
    } catch {
      // Use fallback TTL
    }

    // Add grace buffer of 10 seconds to cover clock skew
    await redisSet(key, '1', ttlSeconds + 10);
    logger.debug(`Token blacklisted successfully (TTL: ${ttlSeconds}s)`);
  } catch (error) {
    logger.error('Failed to blacklist token:', error);
  }
}

/**
 * Checks if a specific token has been blacklisted.
 */
export async function isTokenBlacklisted(token: string): Promise<boolean> {
  if (!token) return false;

  try {
    const cleanToken = token.startsWith('Bearer ') ? token.slice(7).trim() : token.trim();
    const tokenHash = hashToken(cleanToken);
    const key = `bl:token:${tokenHash}`;
    return await redisExists(key);
  } catch (error) {
    logger.error('Error checking token blacklist:', error);
    return false; // Fail open for resilience if check errors out
  }
}

/**
 * Instantly revokes all active tokens for a specific user (e.g., on password reset, termination).
 */
export async function blacklistAllUserTokens(userId: string): Promise<void> {
  if (!userId) return;

  try {
    const key = `bl:user:${userId}`;
    const currentEpoch = Math.floor(Date.now() / 1000);
    // Keep revocation flag active for 24 hours (surpasses any 15-minute access token lifespan)
    await redisSet(key, currentEpoch.toString(), 24 * 60 * 60);
    logger.info(`All tokens revoked for user ${userId} at epoch ${currentEpoch}`);
  } catch (error) {
    logger.error(`Failed to revoke user tokens for ${userId}:`, error);
  }
}

/**
 * Checks if a user's tokens were globally revoked after the current token was issued.
 */
export async function isUserTokensRevoked(userId: string, tokenIssuedAtSeconds?: number): Promise<boolean> {
  if (!userId) return false;

  try {
    const key = `bl:user:${userId}`;
    const revokedEpochStr = await redisGet(key);
    if (!revokedEpochStr) return false;

    const revokedEpoch = parseInt(revokedEpochStr, 10);
    if (isNaN(revokedEpoch)) return false;

    // If token has no iat or was issued before the revocation timestamp, it is revoked
    if (!tokenIssuedAtSeconds || tokenIssuedAtSeconds < revokedEpoch) {
      return true;
    }
    return false;
  } catch (error) {
    logger.error(`Error checking user token revocation for ${userId}:`, error);
    return false;
  }
}
