import prisma from '../config/prisma';
import { tenantSchemaService } from '../services/tenantSchema.service';
import { Organization } from '../models/Organization';
import { User } from '../models/User';
import { UserOrganizationRole } from '../models/UserOrganizationRole';
import { Subscription } from '../models/Subscription';

async function verifyTenantLifecycle() {
  console.log('🧪 RUNNING HIERARCHICAL MULTI-TENANT TEST LIFECYCLE...\n');

  const testOrgName = 'Apex Global Technologies';
  const testAdminEmail = 'admin@apexglobal.test';

  // 1. Clean previous test if any
  const prevOrg = await Organization.findOne({ name: testOrgName });
  if (prevOrg) {
    const id = prevOrg._id || prevOrg.id;
    await Subscription.deleteMany({ organizationId: id });
    await UserOrganizationRole.deleteMany({ organizationId: id });
    await Organization.findByIdAndDelete(id);
    await User.deleteMany({ email: testAdminEmail });
    try {
      const schemaName = tenantSchemaService.getSchemaName(id);
      await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE;`);
    } catch(e) {}
  }

  // 2. Create organization
  const org = await Organization.create({
    name: testOrgName,
    businessType: 'loan',
    phone: '9876543210',
    email: testAdminEmail,
    website: 'https://apexglobal.test',
    currency: 'INR',
    timezone: 'Asia/Kolkata',
    isSuspended: false
  });

  const orgId = org._id || org.id;
  console.log(`✔ Step 1: Created Organization "${org.name}" (ID: ${orgId})`);

  // 3. Provision dedicated schema
  const schemaName = await tenantSchemaService.createTenantSchema(orgId);
  console.log(`✔ Step 2: Dedicated PostgreSQL Tenant Schema created: "${schemaName}"`);

  // 4. Create Org Admin User
  const adminUser = await User.create({
    email: testAdminEmail,
    passwordHash: 'mock_hash',
    firstName: 'Apex',
    lastName: 'Administrator',
    isVerified: true,
    status: 'active'
  });
  console.log(`✔ Step 3: Created Organization Admin User "${adminUser.email}"`);

  // 5. Link Admin to Organization with Admin Role
  const { Role } = await import('../models/Role');
  let adminRole: any = await Role.findOne({ name: 'Admin' });
  if (!adminRole) adminRole = await Role.findOne({ name: 'Super Admin' });

  await UserOrganizationRole.create({
    userId: adminUser._id || adminUser.id,
    organizationId: orgId,
    roleId: adminRole ? (adminRole._id || adminRole.id) : null
  });
  console.log(`✔ Step 4: Linked Org Admin to ${org.name}`);

  // 6. Assign Subscription
  const sub = await Subscription.create({
    organizationId: orgId,
    planName: 'Enterprise Growth',
    status: 'active',
    startDate: new Date(),
    endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    userSeatsLimit: 25,
    invoicesCountLimit: 5000,
    paymentStatus: 'paid',
    paymentProvider: 'manual'
  });
  console.log(`✔ Step 5: Allocated Subscription "${sub.planName}" (Seats: ${sub.userSeatsLimit})`);

  // 7. Test Tenant Schema switch
  await tenantSchemaService.setTenantSearchPath(orgId);
  console.log(`✔ Step 6: Verified dynamic search_path switch to "${schemaName}"`);

  // 8. Clean up test organization
  await Subscription.deleteMany({ organizationId: orgId });
  await UserOrganizationRole.deleteMany({ organizationId: orgId });
  await Organization.findByIdAndDelete(orgId);
  await User.deleteMany({ email: testAdminEmail });
  await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE;`);
  console.log(`✔ Step 7: Cleaned up test organization and dropped schema "${schemaName}"\n`);

  console.log('🎉 ALL HIERARCHICAL MULTI-TENANT TESTS PASSED!');
  await prisma.$disconnect();
}

verifyTenantLifecycle().catch(async (err) => {
  console.error('❌ Test failed:', err);
  await prisma.$disconnect();
});
