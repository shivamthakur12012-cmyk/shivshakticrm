import prisma from '../config/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Organization } from '../models/Organization';
import { User } from '../models/User';
import { Role } from '../models/Role';
import { UserOrganizationRole } from '../models/UserOrganizationRole';
import { Subscription } from '../models/Subscription';
import { Lead } from '../models/Lead';

const BASE_URL = 'http://localhost:5000/api';

interface TestResult {
  name: string;
  category: string;
  status: 'PASS' | 'FAIL';
  severity?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  details: any;
}

const auditResults: TestResult[] = [];

function logResult(name: string, category: string, passed: boolean, details: any, severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' = 'HIGH') {
  const status = passed ? 'PASS' : 'FAIL';
  auditResults.push({ name, category, status, severity: passed ? undefined : severity, details });
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} [${status}] [${category}] ${name}`);
  if (!passed) {
    console.log(`   └─ Details:`, JSON.stringify(details, null, 2));
  }
}

async function api(path: string, options: RequestInit = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  const text = await res.text();
  let body: any;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, ok: res.ok, headers: res.headers, body };
}

async function runComprehensiveAudit() {
  console.log('\n================================================================');
  console.log('       CRM PRODUCTION LAUNCH AUDIT — AUTOMATED TEST SUITE        ');
  console.log('================================================================\n');

  let testTenantBetaId: string = '';
  let testLeadBetaId: string = '';
  let alphaExecUserId: string = '';

  try {
    // -------------------------------------------------------------
    // SETUP: Ensure Clean Test Tenants & Test Users
    // -------------------------------------------------------------
    console.log('📦 PREPARING ISOLATED AUDIT TEST FIXTURES...');

    // 1. Get or Ensure Tenant Alpha (PCS)
    let tenantAlpha = await Organization.findOne({ name: 'PCS' });
    if (!tenantAlpha) {
      tenantAlpha = await Organization.create({
        name: 'PCS',
        phone: '9999999999',
        email: 'info@pcs.test'
      });
    }
    const tenantAlphaId = ((tenantAlpha as any)._id || (tenantAlpha as any).id).toString();

    // 2. Ensure Active Subscription for Tenant Alpha
    await Subscription.deleteMany({ organizationId: tenantAlphaId });
    await Subscription.create({
      organizationId: tenantAlphaId,
      planName: 'Enterprise Growth',
      status: 'active',
      startDate: new Date(),
      endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      paymentStatus: 'paid'
    });

    // 3. Create Tenant Beta (Target for Cross-Tenant Penetration)
    const testTenantBetaName = 'Beta Shield Security Ltd';
    let tenantBeta = await Organization.findOne({ name: testTenantBetaName });
    if (!tenantBeta) {
      tenantBeta = await Organization.create({
        name: testTenantBetaName,
        phone: '8888888888',
        email: 'contact@betashield.test'
      });
    }
    testTenantBetaId = ((tenantBeta as any)._id || (tenantBeta as any).id).toString();

    // Ensure Active Subscription for Tenant Beta
    await Subscription.deleteMany({ organizationId: testTenantBetaId });
    await Subscription.create({
      organizationId: testTenantBetaId,
      planName: 'Professional',
      status: 'active',
      startDate: new Date(),
      endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      paymentStatus: 'paid'
    });

    // 4. Create Roles if not existing
    let adminRole = await Role.findOne({ name: 'Admin', organizationId: null });
    let execRole = await Role.findOne({ name: 'Sale Executive', organizationId: null });

    // 5. Create Test Users:
    // User A1: Super Admin / Tenant Alpha Owner (Shivam)
    const superAdminPasswordHash = await bcrypt.hash('Shivam@123', 10);
    let superAdminUser = await User.findOne({ email: 'shivamthakur12012@gmail.com' });
    if (!superAdminUser) {
      superAdminUser = await User.create({
        email: 'shivamthakur12012@gmail.com',
        passwordHash: superAdminPasswordHash,
        firstName: 'Shivam',
        lastName: 'Thakur',
        isVerified: true,
        status: 'active'
      });
    }

    // User A2: Standard Sale Executive in Tenant Alpha
    const execPasswordHash = await bcrypt.hash('Exec@123', 10);
    const alphaExecEmail = 'exec_audit@pcs.test';
    let alphaExecUser = await User.findOne({ email: alphaExecEmail });
    if (!alphaExecUser) {
      alphaExecUser = await User.create({
        email: alphaExecEmail,
        passwordHash: execPasswordHash,
        firstName: 'Executive',
        lastName: 'User',
        isVerified: true,
        status: 'active'
      });
    }
    alphaExecUserId = ((alphaExecUser as any)._id || (alphaExecUser as any).id).toString();

    // Link User A2 to Tenant Alpha with Sale Executive Role
    await UserOrganizationRole.deleteMany({ userId: alphaExecUserId });
    await UserOrganizationRole.create({
      userId: alphaExecUserId,
      organizationId: tenantAlphaId,
      roleId: execRole?._id || execRole?.id
    });

    // User B1: Tenant Beta Admin
    const betaAdminPasswordHash = await bcrypt.hash('BetaAdmin@123', 10);
    const betaAdminEmail = 'admin@betashield.test';
    let betaAdminUser = await User.findOne({ email: betaAdminEmail });
    if (!betaAdminUser) {
      betaAdminUser = await User.create({
        email: betaAdminEmail,
        passwordHash: betaAdminPasswordHash,
        firstName: 'Beta',
        lastName: 'Admin',
        isVerified: true,
        status: 'active'
      });
    }
    const betaAdminUserId = ((betaAdminUser as any)._id || (betaAdminUser as any).id).toString();

    // Link User B1 to Tenant Beta
    await UserOrganizationRole.deleteMany({ userId: betaAdminUserId });
    await UserOrganizationRole.create({
      userId: betaAdminUserId,
      organizationId: testTenantBetaId,
      roleId: adminRole?._id || adminRole?.id
    });

    // 6. Create Sensitive CRM Record in Tenant Beta
    await Lead.deleteMany({ email: 'secret_beta@target.test' });
    const betaLead = await Lead.create({
      organizationId: testTenantBetaId,
      leadId: `LD_BETA_${Date.now()}`,
      name: 'Confidential Enterprise Deal (Beta)',
      email: 'secret_beta@target.test',
      phone: '9876543210',
      source: 'Direct Partner',
      expectedValue: 500000,
      notes: 'TOP SECRET PROPRIETARY DATA OF TENANT BETA'
    });
    testLeadBetaId = (betaLead._id || betaLead.id).toString();

    console.log('✔ Test Fixtures Initialized:');
    console.log(`   Tenant Alpha ID: ${tenantAlphaId}`);
    console.log(`   Tenant Beta ID:  ${testTenantBetaId}`);
    console.log(`   Beta Secret Lead ID: ${testLeadBetaId}\n`);

    // -------------------------------------------------------------
    // LOG IN TEST SESSIONS
    // -------------------------------------------------------------
    const superAdminLoginRes = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'shivamthakur12012@gmail.com', password: 'Shivam@123' })
    });
    const superAdminToken = superAdminLoginRes.body?.data?.token;

    const alphaExecLoginRes = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: alphaExecEmail, password: 'Exec@123' })
    });
    const alphaExecToken = alphaExecLoginRes.body?.data?.token;

    const betaAdminLoginRes = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: betaAdminEmail, password: 'BetaAdmin@123' })
    });
    const betaAdminToken = betaAdminLoginRes.body?.data?.token;

    // -------------------------------------------------------------
    // PHASE 1: CROSS-TENANT ISOLATION TESTS
    // -------------------------------------------------------------
    console.log('--- PHASE 1: CROSS-TENANT DATA ISOLATION AUDIT ---');

    // 1.1 Tenant A Executive queries /api/leads with Tenant B header
    const crossTenantHeaderRes = await api('/leads', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${alphaExecToken}`,
        'x-organization-id': testTenantBetaId
      }
    });

    // Check if data leaked or if silent fallback occurred
    if (crossTenantHeaderRes.status === 403) {
      logResult('Rejects Cross-Tenant Header with 403 Forbidden', 'P0_MULTI_TENANT', true, { status: 403 });
    } else if (crossTenantHeaderRes.status === 200) {
      const records = crossTenantHeaderRes.body?.data || [];
      const hasBetaLead = Array.isArray(records) && records.some((r: any) => r.id === testLeadBetaId || r._id === testLeadBetaId);
      if (hasBetaLead) {
        logResult('CRITICAL LEAK: Tenant A read Tenant B leads via header manipulation!', 'P0_MULTI_TENANT', false, { recordsCount: records.length }, 'CRITICAL');
      } else {
        logResult('SILENT FALLBACK: Server ignored unauthorized x-organization-id and returned user default org instead of 403', 'P0_MULTI_TENANT', false, {
          expectedStatus: 403,
          actualStatus: 200,
          rootCause: 'tenant.middleware.ts lines 55-58 silently defaults to userRoles[0]'
        }, 'HIGH');
      }
    } else {
      logResult('Cross-tenant query handled', 'P0_MULTI_TENANT', false, { status: crossTenantHeaderRes.status }, 'HIGH');
    }

    // 1.2 IDOR Test: Tenant A Executive reads Tenant B specific lead by ID
    const idorReadRes = await api(`/leads/${testLeadBetaId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${alphaExecToken}`,
        'x-organization-id': tenantAlphaId
      }
    });
    logResult('Prevent IDOR Lead Read (Cross-Tenant Specific Record Access)', 'P0_MULTI_TENANT', idorReadRes.status === 404 || idorReadRes.status === 403, {
      status: idorReadRes.status,
      body: idorReadRes.body
    }, 'CRITICAL');

    // 1.3 IDOR Test: Tenant A Executive updates Tenant B specific lead by ID
    const idorUpdateRes = await api(`/leads/${testLeadBetaId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${alphaExecToken}`,
        'x-organization-id': tenantAlphaId
      },
      body: JSON.stringify({ notes: 'TAMPERED BY TENANT A' })
    });
    logResult('Prevent IDOR Lead Update (Cross-Tenant Record Mutation)', 'P0_MULTI_TENANT', idorUpdateRes.status === 404 || idorUpdateRes.status === 403, {
      status: idorUpdateRes.status,
      body: idorUpdateRes.body
    }, 'CRITICAL');

    // 1.4 IDOR Test: Tenant A Executive deletes Tenant B specific lead by ID
    const idorDeleteRes = await api(`/leads/${testLeadBetaId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${alphaExecToken}`,
        'x-organization-id': tenantAlphaId
      }
    });
    logResult('Prevent IDOR Lead Deletion (Cross-Tenant Record Deletion)', 'P0_MULTI_TENANT', idorDeleteRes.status === 404 || idorDeleteRes.status === 403, {
      status: idorDeleteRes.status,
      body: idorDeleteRes.body
    }, 'CRITICAL');

    // 1.5 Super Admin Email Bypass Test: Does shivamthakur12012@gmail.com bypass Tenant B's boundary?
    const superAdminCrossOrgRes = await api('/leads', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${superAdminToken}`,
        'x-organization-id': testTenantBetaId
      }
    });
    const superAdminRecords = superAdminCrossOrgRes.body?.data || [];
    const superAdminSawBetaData = Array.isArray(superAdminRecords) && superAdminRecords.some((r: any) => r.id === testLeadBetaId || r._id === testLeadBetaId);
    logResult('Hardcoded Super Admin Backdoor accesses arbitrary tenant without membership', 'P0_MULTI_TENANT', !superAdminSawBetaData, {
      sawBetaRecords: superAdminSawBetaData,
      explanation: 'Hardcoded email shivamthakur12012@gmail.com allows switching to any tenant context without membership.'
    }, 'CRITICAL');

    // -------------------------------------------------------------
    // PHASE 2: JWT & EXPRESS BACKEND SECURITY
    // -------------------------------------------------------------
    console.log('\n--- PHASE 2: JWT & EXPRESS SECURITY AUDIT ---');

    // 2.1 Unauthenticated Request
    const unauthRes = await api('/leads');
    logResult('Rejects Unauthenticated Request with 401', 'P0_AUTH', unauthRes.status === 401, { status: unauthRes.status }, 'CRITICAL');

    // 2.2 Malformed JWT
    const malformedRes = await api('/leads', {
      headers: { 'Authorization': 'Bearer MALFORMED_TOKEN_VALUE' }
    });
    logResult('Rejects Malformed JWT with 401', 'P0_AUTH', malformedRes.status === 401, { status: malformedRes.status }, 'CRITICAL');

    // 2.3 Algorithm: "none" unsigned token
    const hB64 = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const pB64 = Buffer.from(JSON.stringify({ id: alphaExecUserId, email: alphaExecEmail })).toString('base64url');
    const noneToken = `${hB64}.${pB64}.`;
    const noneRes = await api('/leads', {
      headers: { 'Authorization': `Bearer ${noneToken}` }
    });
    logResult('Rejects Algorithm "none" Token with 401', 'P0_AUTH', noneRes.status === 401, { status: noneRes.status }, 'CRITICAL');

    // 2.4 Role Escalation: Sale Executive accessing Platform Admin Overview
    const execAdminRes = await api('/admin/overview', {
      headers: { 'Authorization': `Bearer ${alphaExecToken}` }
    });
    logResult('Sale Executive Blocked from /api/admin/overview with 403', 'P0_RBAC', execAdminRes.status === 403, { status: execAdminRes.status }, 'HIGH');

    // 2.5 Role Escalation: Sale Executive accessing Platform Organizations
    const execOrgsRes = await api('/admin/organizations', {
      headers: { 'Authorization': `Bearer ${alphaExecToken}` }
    });
    logResult('Sale Executive Blocked from /api/admin/organizations with 403', 'P0_RBAC', execOrgsRes.status === 403, { status: execOrgsRes.status }, 'HIGH');

    // 2.6 Information Disclosure: 403 error response discloses admin's private email
    const errorBodyString = JSON.stringify(execAdminRes.body);
    const leakedEmail = errorBodyString.includes('shivamthakur12012@gmail.com');
    logResult('Information Disclosure: 403 Forbidden reveals hardcoded admin email', 'P1_SECURITY', !leakedEmail, {
      responseMessage: execAdminRes.body?.message,
      rootCause: 'subscription.middleware.ts:173 explicitly includes the personal email in the error message'
    }, 'MEDIUM');

    // 2.7 Webhook Security: Unauthenticated failed-queue endpoint
    const webhookQueueRes = await api('/webhooks/failed-queue');
    logResult('Public Access to /api/webhooks/failed-queue must be BLOCKED', 'P0_SECURITY', webhookQueueRes.status === 401 || webhookQueueRes.status === 403, {
      status: webhookQueueRes.status,
      dataReturned: Array.isArray(webhookQueueRes.body?.data) ? `${webhookQueueRes.body.data.length} records exposed` : 'N/A'
    }, 'CRITICAL');

    // 2.8 Webhook Spoofing: Unauthenticated lead push without HMAC / signature
    const webhookPushRes = await api('/webhooks/justdial', {
      method: 'POST',
      headers: { 'x-organization-id': testTenantBetaId },
      body: JSON.stringify({
        lead_id: `AUDIT_SPOOF_${Date.now()}`,
        mobile: '9888877777',
        name: 'Spoofed Lead Injected By Attacker',
        service: 'Personal Loan'
      })
    });
    logResult('Webhook Lead Injection Without Authentication / HMAC Signature must be BLOCKED', 'P0_SECURITY', webhookPushRes.status === 401 || webhookPushRes.status === 403, {
      actualStatus: webhookPushRes.status,
      body: webhookPushRes.body,
      rootCause: 'webhook.routes.ts line 13 accepts any public POST request and inserts lead'
    }, 'CRITICAL');

    // -------------------------------------------------------------
    // PHASE 9: CONCURRENCY & DATA CONSISTENCY
    // -------------------------------------------------------------
    console.log('\n--- PHASE 9: CONCURRENT WRITES & IDEMPOTENCY ---');

    const concurrentPhone = `98${Math.floor(10000000 + Math.random() * 90000000)}`;
    const concurrentPayload = {
      name: 'Concurrent Race Condition Lead',
      phone: concurrentPhone,
      email: `concurrent_${Date.now()}@test.com`,
      source: 'Website Form'
    };

    const [postRes1, postRes2] = await Promise.all([
      api('/leads', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${betaAdminToken}`, 'x-organization-id': testTenantBetaId },
        body: JSON.stringify(concurrentPayload)
      }),
      api('/leads', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${betaAdminToken}`, 'x-organization-id': testTenantBetaId },
        body: JSON.stringify(concurrentPayload)
      })
    ]);

    const bothSucceeded = postRes1.status === 201 && postRes2.status === 201;
    logResult('Duplicate Lead Write Prevention (Double-Click Race Condition)', 'P0_CONSISTENCY', !bothSucceeded, {
      req1Status: postRes1.status,
      req2Status: postRes2.status,
      id1: postRes1.body?.data?.id || postRes1.body?.data?._id,
      id2: postRes2.body?.data?.id || postRes2.body?.data?._id,
      outcome: bothSucceeded ? 'Two duplicate leads created with same phone/email' : 'Handled idempotently or unique constraint enforced'
    }, 'HIGH');

    // -------------------------------------------------------------
    // PHASE 6 & 7: LATENCY & PERFORMANCE BENCHMARKING
    // -------------------------------------------------------------
    console.log('\n--- PHASE 6 & 7: LATENCY & PERFORMANCE BENCHMARKING ---');

    const latencySamples: number[] = [];
    for (let i = 0; i < 25; i++) {
      const start = performance.now();
      await api('/leads?page=1&limit=25', {
        headers: { 'Authorization': `Bearer ${betaAdminToken}`, 'x-organization-id': testTenantBetaId }
      });
      const end = performance.now();
      latencySamples.push(end - start);
    }

    latencySamples.sort((a, b) => a - b);
    const p50 = latencySamples[Math.floor(latencySamples.length * 0.50)];
    const p95 = latencySamples[Math.floor(latencySamples.length * 0.95)];
    const avg = latencySamples.reduce((a, b) => a + b, 0) / latencySamples.length;

    console.log(`⏱️ Latency Distribution (GET /api/leads, N=25):`);
    console.log(`   Avg: ${avg.toFixed(1)} ms | p50: ${p50.toFixed(1)} ms | p95: ${p95.toFixed(1)} ms | Min: ${latencySamples[0].toFixed(1)} ms | Max: ${latencySamples[latencySamples.length - 1].toFixed(1)} ms`);

    logResult('API p95 Latency Meets Launch Target (< 300 ms)', 'P1_PERFORMANCE', p95 < 300, {
      p50: `${p50.toFixed(1)} ms`,
      p95: `${p95.toFixed(1)} ms`,
      avg: `${avg.toFixed(1)} ms`
    }, 'MEDIUM');

  } catch (err) {
    console.error('Audit execution error:', err);
  } finally {
    // -------------------------------------------------------------
    // CLEANUP: Clean Test Data
    // -------------------------------------------------------------
    console.log('\n🧹 CLEANING UP AUDIT FIXTURES...');
    try {
      if (testTenantBetaId) {
        await Lead.deleteMany({ organizationId: testTenantBetaId });
        await Subscription.deleteMany({ organizationId: testTenantBetaId });
        await UserOrganizationRole.deleteMany({ organizationId: testTenantBetaId });
        await Organization.findByIdAndDelete(testTenantBetaId);
        await User.deleteMany({ email: 'admin@betashield.test' });
      }
      if (alphaExecUserId) {
        await UserOrganizationRole.deleteMany({ userId: alphaExecUserId });
        await User.deleteMany({ email: 'exec_audit@pcs.test' });
      }
    } catch (cleanErr) {
      console.warn('Cleanup warning:', cleanErr);
    }

    await prisma.$disconnect();

    // -------------------------------------------------------------
    // SUMMARY REPORT
    // -------------------------------------------------------------
    const passedCount = auditResults.filter(r => r.status === 'PASS').length;
    const failedCount = auditResults.filter(r => r.status === 'FAIL').length;
    const criticalFailures = auditResults.filter(r => r.status === 'FAIL' && r.severity === 'CRITICAL');

    console.log('\n================================================================');
    console.log(` AUDIT EXECUTION COMPLETE: ${passedCount} PASSED | ${failedCount} FAILED (${criticalFailures.length} CRITICAL)`);
    console.log('================================================================\n');

    if (failedCount > 0) {
      console.log('🚨 AUDIT FINDINGS REQUIRING IMMEDIATE ATTENTION:');
      auditResults.filter(r => r.status === 'FAIL').forEach((f, idx) => {
        console.log(`\n${idx + 1}. [${f.severity}] ${f.name} (${f.category})`);
        console.log(`   ${JSON.stringify(f.details, null, 2)}`);
      });
    }
  }
}

runComprehensiveAudit().catch(console.error);
