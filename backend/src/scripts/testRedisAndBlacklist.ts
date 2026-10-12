import dotenv from 'dotenv';
dotenv.config();

import jwt from 'jsonwebtoken';
import { blacklistToken, isTokenBlacklisted, blacklistAllUserTokens, isUserTokensRevoked } from '../services/tokenBlacklist.service';
import { cacheSet, cacheGet, cacheDel, cacheWrap, getOrgCacheKey } from '../services/cache.service';
import { isRedisActive } from '../config/redis';
import logger from '../utils/logger';

async function runTests() {
  // Allow remote Redis connection to complete handshake
  await new Promise(resolve => setTimeout(resolve, 800));

  console.log('================================================================');
  console.log('       REDIS CACHING & TOKEN BLOCKLISTING VERIFICATION         ');
  console.log('================================================================');

  const redisStatus = isRedisActive() ? 'LIVE REDIS CLOUD (CONNECTED)' : 'IN-MEMORY RESILIENT STORE';
  console.log(`📡 Storage Backend: ${redisStatus}`);

  let passed = 0;
  let failed = 0;

  function assert(name: string, condition: boolean, details?: any) {
    if (condition) {
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${name}`, details ? details : '');
      failed++;
    }
  }

  // 1. Basic Cache Operations
  console.log('\n--- 1. CACHE SPEED & INTEGRITY TEST ---');
  const testKey = 'test:perf:benchmark';
  const testPayload = { orgId: 'org_123', metric: 9942, timestamp: Date.now() };

  await cacheSet(testKey, testPayload, 60);

  const startRead = performance.now();
  const cachedVal = await cacheGet<typeof testPayload>(testKey);
  const readDuration = performance.now() - startRead;

  assert('Cache Read retrieves accurate payload', cachedVal?.metric === 9942);
  assert(`Cache Read Latency (${readDuration.toFixed(2)} ms) completed successfully`, readDuration < 3000);

  // 2. Cache-Aside Wrap Test
  let fetcherCalls = 0;
  const wrappedKey = 'test:wrapped:key';
  await cacheDel(wrappedKey);

  const fetcher = async () => {
    fetcherCalls++;
    return { data: 'computed_result', callCount: fetcherCalls };
  };

  const call1 = await cacheWrap(wrappedKey, 60, fetcher);
  const call2 = await cacheWrap(wrappedKey, 60, fetcher);

  assert('CacheWrap calls database/fetcher on first request', call1.callCount === 1);
  assert('CacheWrap serves second request from cache (0 new fetcher calls)', call2.callCount === 1 && fetcherCalls === 1);

  // 3. Multi-Tenant Key Isolation
  const orgAKey = getOrgCacheKey('tenant_A', 'metrics');
  const orgBKey = getOrgCacheKey('tenant_B', 'metrics');
  assert('Multi-Tenant Keys are strictly partitioned', orgAKey !== orgBKey && orgAKey.includes('tenant_A') && orgBKey.includes('tenant_B'));

  // 4. Token Blacklist Verification
  console.log('\n--- 2. ACCESS TOKEN BLACKLISTING TEST ---');
  const mockSecret = process.env.JWT_SECRET || 'super_secret_jwt_access_key_artha_crm_development_123';
  const testUser = { id: 'usr_audit_001', email: 'audit@test.com' };
  const mockToken = jwt.sign(testUser, mockSecret, { expiresIn: '15m' });

  const beforeRevoke = await isTokenBlacklisted(mockToken);
  assert('Fresh token is NOT blacklisted initially', beforeRevoke === false);

  // Blacklist token
  await blacklistToken(mockToken);

  const afterRevoke = await isTokenBlacklisted(mockToken);
  assert('Token is marked blacklisted immediately after revocation', afterRevoke === true);

  // Clean raw token check (handles Bearer prefix)
  const bearerCheck = await isTokenBlacklisted(`Bearer ${mockToken}`);
  assert('Handles Bearer prefixed token lookup correctly', bearerCheck === true);

  // 5. User-Level Global Revocation (e.g., password reset, terminated employee)
  console.log('\n--- 3. USER-LEVEL INSTANT SESSION INVALIDATION ---');
  const currentEpoch = Math.floor(Date.now() / 1000);
  const pastIssuedTokenIat = currentEpoch - 100; // Issued 100 seconds ago

  assert('User tokens not revoked prior to revocation event', await isUserTokensRevoked('usr_audit_002', pastIssuedTokenIat) === false);

  await blacklistAllUserTokens('usr_audit_002');

  const isOldTokenRevoked = await isUserTokensRevoked('usr_audit_002', pastIssuedTokenIat);
  assert('All existing tokens issued before revocation event are invalidated', isOldTokenRevoked === true);

  const newIssuedTokenIat = Math.floor(Date.now() / 1000) + 10; // Issued after revocation
  const isNewTokenRevoked = await isUserTokensRevoked('usr_audit_002', newIssuedTokenIat);
  assert('New tokens issued after the revocation event are allowed', isNewTokenRevoked === false);

  // 6. Cleanup
  await cacheDel(testKey);
  await cacheDel(wrappedKey);

  console.log('\n================================================================');
  console.log(` VERIFICATION SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
