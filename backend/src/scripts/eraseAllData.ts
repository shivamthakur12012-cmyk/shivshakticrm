import bcrypt from 'bcryptjs';
import prisma from '../config/prisma';

const DEFAULT_PERMISSIONS = [
  { name: 'platform:admin', module: 'Platform', description: 'Complete platform control (Super Admin)' },
  { name: 'leads:read', module: 'CRM', description: 'View leads' },
  { name: 'leads:write', module: 'CRM', description: 'Create and update leads' },
  { name: 'leads:delete', module: 'CRM', description: 'Delete leads' },
  { name: 'customers:read', module: 'CRM', description: 'View customers' },
  { name: 'customers:write', module: 'CRM', description: 'Create and update customers' },
  { name: 'customers:delete', module: 'CRM', description: 'Delete customers' },
  { name: 'contacts:read', module: 'CRM', description: 'View contacts' },
  { name: 'contacts:write', module: 'CRM', description: 'Create and update contacts' },
  { name: 'contacts:delete', module: 'CRM', description: 'Delete contacts' },
  { name: 'deals:read', module: 'Sales', description: 'View deals and pipelines' },
  { name: 'deals:write', module: 'Sales', description: 'Create and update deals' },
  { name: 'deals:delete', module: 'Sales', description: 'Delete deals' },
  { name: 'service_cases:read', module: 'Sales', description: 'View service cases' },
  { name: 'service_cases:write', module: 'Sales', description: 'Manage service cases' },
  { name: 'accounting:read', module: 'Accounting', description: 'View invoices, expenses, payments' },
  { name: 'accounting:write', module: 'Accounting', description: 'Create invoices, items, and process payments' },
  { name: 'accounting:delete', module: 'Accounting', description: 'Delete or cancel accounting records' },
  { name: 'settings:read', module: 'Settings', description: 'View settings' },
  { name: 'settings:write', module: 'Settings', description: 'Modify organization settings' },
  { name: 'support:read', module: 'Support', description: 'View support tickets' },
  { name: 'support:write', module: 'Support', description: 'Create and update support tickets' },
  { name: 'support:delete', module: 'Support', description: 'Delete support tickets' }
];

async function eraseAllData() {
  console.log('==================================================');
  console.log('🚀 STARTING CRM DATABASE PURGE & CLEAN RESET');
  console.log('==================================================\n');

  const adminEmail = 'shivamthakur12012@gmail.com';

  // 1. Delete all transactional & operational CRM records
  console.log('🧹 Purging all transactional data...');

  await prisma.caseChecklistItem.deleteMany();
  console.log('  ✔ Cleared Case Checklist Items');

  await prisma.serviceCase.deleteMany();
  console.log('  ✔ Cleared Service Cases');

  await prisma.ticketMessage.deleteMany();
  console.log('  ✔ Cleared Ticket Messages');

  await prisma.ticket.deleteMany();
  console.log('  ✔ Cleared Support Tickets');

  await prisma.invoicePayment.deleteMany();
  console.log('  ✔ Cleared Invoice Payments');

  await prisma.invoiceItem.deleteMany();
  console.log('  ✔ Cleared Invoice Line Items');

  await prisma.invoice.deleteMany();
  console.log('  ✔ Cleared Invoices');

  await prisma.quotationItem.deleteMany();
  console.log('  ✔ Cleared Quotation Line Items');

  await prisma.quotation.deleteMany();
  console.log('  ✔ Cleared Quotations');

  await prisma.item.deleteMany();
  console.log('  ✔ Cleared Catalog Items');

  await prisma.deal.deleteMany();
  console.log('  ✔ Cleared Deals & Opportunities');

  await prisma.pipelineStage.deleteMany();
  console.log('  ✔ Cleared Pipeline Stages');

  await prisma.pipeline.deleteMany();
  console.log('  ✔ Cleared Pipelines');

  await prisma.task.deleteMany();
  console.log('  ✔ Cleared Tasks');

  await prisma.callLog.deleteMany();
  console.log('  ✔ Cleared Call Logs');

  await prisma.followUp.deleteMany();
  console.log('  ✔ Cleared Follow-ups');

  await prisma.sequenceStep.deleteMany();
  console.log('  ✔ Cleared Sequence Steps');

  await prisma.followUpSequence.deleteMany();
  console.log('  ✔ Cleared Follow-up Sequences');

  await prisma.campaign.deleteMany();
  console.log('  ✔ Cleared Campaigns');

  await prisma.communicationConsent.deleteMany();
  console.log('  ✔ Cleared Communication Consents');

  await prisma.document.deleteMany();
  console.log('  ✔ Cleared Uploaded Documents');

  await prisma.activity.deleteMany();
  console.log('  ✔ Cleared Activity Feeds');

  await prisma.assignmentLog.deleteMany();
  console.log('  ✔ Cleared Lead Assignment Logs');

  await prisma.leadImportLog.deleteMany();
  console.log('  ✔ Cleared Lead Import Logs');

  await prisma.workflow.deleteMany();
  console.log('  ✔ Cleared Workflows');

  await prisma.payment.deleteMany();
  console.log('  ✔ Cleared Payments');

  await prisma.contact.deleteMany();
  console.log('  ✔ Cleared Contacts');

  await prisma.customer.deleteMany();
  console.log('  ✔ Cleared Customers');

  await prisma.lead.deleteMany();
  console.log('  ✔ Cleared Leads');

  await prisma.auditLog.deleteMany();
  console.log('  ✔ Cleared Audit Logs');

  await prisma.saaSAuditLog.deleteMany();
  console.log('  ✔ Cleared SaaS Audit Logs');

  await prisma.webhookLog.deleteMany();
  console.log('  ✔ Cleared Webhook Logs');

  await prisma.session.deleteMany();
  console.log('  ✔ Cleared Sessions');

  console.log('\n🧹 Purging employee user accounts (except Primary Admin)...');

  // 2. Clear user-org role assignments for non-admin users
  const adminUser = await prisma.user.findUnique({
    where: { email: adminEmail }
  });

  const adminUserId = adminUser?.id;

  if (adminUserId) {
    await prisma.userOrganizationRole.deleteMany({
      where: {
        userId: { not: adminUserId }
      }
    });
  } else {
    await prisma.userOrganizationRole.deleteMany();
  }
  console.log('  ✔ Cleared employee organization mappings');

  // 3. Delete all other users
  const deletedUsers = await prisma.user.deleteMany({
    where: {
      email: { not: adminEmail }
    }
  });
  console.log(`  ✔ Removed ${deletedUsers.count} employee user account(s)`);

  // 4. Ensure Primary Organization (PCS)
  let primaryOrg = await prisma.organization.findFirst({
    where: { name: 'PCS' }
  });

  if (!primaryOrg) {
    primaryOrg = await prisma.organization.create({
      data: {
        name: 'PCS',
        businessType: 'general',
        phone: '9999999999',
        email: 'info@pcs.com',
        website: 'https://pcs.com',
        currency: 'INR',
        timezone: 'Asia/Kolkata',
        isSuspended: false
      }
    });
    console.log('  ✔ Created primary organization: PCS');
  } else {
    console.log('  ✔ Retained primary organization: PCS');
  }

  // Remove any non-primary organizations
  await prisma.subscription.deleteMany({
    where: { organizationId: { not: primaryOrg.id } }
  });
  await prisma.organization.deleteMany({
    where: { id: { not: primaryOrg.id } }
  });
  console.log('  ✔ Removed stale secondary organizations');

  // 5. Ensure Permissions and Roles
  console.log('\n🔐 Verifying core system permissions & roles...');
  for (const perm of DEFAULT_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { name: perm.name },
      update: { module: perm.module, description: perm.description },
      create: perm
    });
  }

  const allPermissions = await prisma.permission.findMany();

  const systemRoles = [
    {
      name: 'Admin',
      description: 'Level 1: Complete organization-wide control over CRM, configurations, and all teams',
      isSystem: true
    },
    {
      name: 'Super Admin',
      description: 'Level 1: Super Admin root privileges (System Master)',
      isSystem: true
    },
    {
      name: 'Manager',
      description: 'Level 2: Manage sales departments, unassigned lead queues, team leaders, and reports',
      isSystem: true
    },
    {
      name: 'Team Leader',
      description: 'Level 3: Supervise team of sales executives, allocate leads, and monitor follow-ups',
      isSystem: true
    },
    {
      name: 'Sale Executive',
      description: 'Level 4: Execute inbound client outreach, follow-up calls, and create quotations',
      isSystem: true
    },
    {
      name: 'Employee',
      description: 'Level 4: Standard Sales Execution Role',
      isSystem: true
    }
  ];

  let adminRole: any = null;

  for (const r of systemRoles) {
    let role = await prisma.role.findFirst({
      where: { name: r.name, organizationId: null }
    });

    if (!role) {
      role = await prisma.role.create({
        data: {
          name: r.name,
          description: r.description,
          isSystem: r.isSystem
        }
      });
    }

    if (r.name === 'Admin') {
      adminRole = role;
      // Connect all permissions to Admin
      await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
      for (const p of allPermissions) {
        await prisma.rolePermission.create({
          data: {
            roleId: role.id,
            permissionId: p.id
          }
        });
      }
    }
  }
  console.log('  ✔ System roles & permissions verified');

  // 6. Ensure Primary Admin User is Active and Configured
  const passwordHash = await bcrypt.hash('Shivam@123', 10);
  const adminDoc = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      firstName: 'Shivam',
      lastName: 'Thakur',
      isVerified: true,
      status: 'active'
    },
    create: {
      email: adminEmail,
      passwordHash,
      firstName: 'Shivam',
      lastName: 'Thakur',
      isVerified: true,
      status: 'active'
    }
  });

  // Link Admin to PCS Organization
  if (adminRole) {
    await prisma.userOrganizationRole.upsert({
      where: {
        userId_organizationId: {
          userId: adminDoc.id,
          organizationId: primaryOrg.id
        }
      },
      update: {
        roleId: adminRole.id
      },
      create: {
        userId: adminDoc.id,
        organizationId: primaryOrg.id,
        roleId: adminRole.id
      }
    });
  }
  console.log(`  ✔ Admin account configured: ${adminEmail} (Role: Admin @ ${primaryOrg.name})`);

  // 7. Initialize clean default Sales Pipeline
  await prisma.pipeline.create({
    data: {
      organizationId: primaryOrg.id,
      name: 'General Sales Pipeline',
      isSystem: true,
      stages: {
        create: [
          { name: 'New Lead', probability: 10, order: 0 },
          { name: 'Contacted', probability: 30, order: 1 },
          { name: 'Qualified', probability: 50, order: 2 },
          { name: 'Proposal Sent', probability: 75, order: 3 },
          { name: 'Negotiation', probability: 90, order: 4 },
          { name: 'Closed Won', probability: 100, order: 5 },
          { name: 'Closed Lost', probability: 0, order: 6 }
        ]
      }
    }
  });
  console.log('  ✔ Seeded clean default Sales Pipeline & Stages');

  // 8. Ensure active subscription for PCS
  const existingSub = await prisma.subscription.findUnique({
    where: { organizationId: primaryOrg.id }
  });

  if (!existingSub) {
    const endOfYear = new Date();
    endOfYear.setFullYear(endOfYear.getFullYear() + 2);
    await prisma.subscription.create({
      data: {
        organizationId: primaryOrg.id,
        planName: 'Enterprise',
        status: 'active',
        startDate: new Date(),
        endDate: endOfYear,
        maxUsersAtPurchase: 100,
        userSeatsLimit: 100,
        invoicesCountLimit: 10000,
        paymentStatus: 'complimentary',
        paymentProvider: 'free'
      }
    });
    console.log('  ✔ Configured active Enterprise subscription for PCS');
  }

  // 9. Summary Counts
  console.log('\n==================================================');
  console.log('🎉 WIPE & RESET COMPLETED SUCCESSFULLY');
  console.log('==================================================');

  const finalUsers = await prisma.user.findMany({
    select: { id: true, email: true, firstName: true, lastName: true }
  });
  const leadsCount = await prisma.lead.count();
  const customersCount = await prisma.customer.count();
  const dealsCount = await prisma.deal.count();
  const invoicesCount = await prisma.invoice.count();
  const tasksCount = await prisma.task.count();
  const followupsCount = await prisma.followUp.count();

  console.log('Final Database State:');
  console.log('  Users:', finalUsers);
  console.log('  Leads:', leadsCount);
  console.log('  Customers:', customersCount);
  console.log('  Deals:', dealsCount);
  console.log('  Invoices:', invoicesCount);
  console.log('  Tasks:', tasksCount);
  console.log('  Follow-ups:', followupsCount);

  await prisma.$disconnect();
}

eraseAllData().catch(async (e) => {
  console.error('❌ Error during wipe operation:', e);
  await prisma.$disconnect();
  process.exit(1);
});
