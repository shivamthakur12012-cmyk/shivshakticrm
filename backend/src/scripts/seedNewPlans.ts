import prisma from '../config/prisma';

const THREE_PLANS = [
  {
    name: '1 Month Plan',
    slug: 'plan-1-month',
    description: '1 Month full CRM access for up to 10 employees. Add extra seats anytime at ₹600/employee.',
    price: 5000,
    currency: 'INR',
    duration: 1,
    durationUnit: 'months',
    maxUsers: 10,
    features: {
      whatsapp: true,
      email: true,
      phoneCalls: true,
      simSync: true,
      aiCopilot: true,
      quotations: true,
      invoices: true,
      customPipelines: true
    },
    limits: {
      maxUsers: 10,
      additionalUserPrice: 600,
      leads: 50000,
      invoices: 10000,
      campaigns: 100
    },
    trialEnabled: false,
    trialDurationDays: 0,
    isDefault: true,
    isActive: true,
    sortOrder: 1
  },
  {
    name: '3 Months Plan',
    slug: 'plan-3-months',
    description: '3 Months full CRM access for up to 10 employees. Add extra seats anytime at ₹600/employee.',
    price: 15000,
    currency: 'INR',
    duration: 3,
    durationUnit: 'months',
    maxUsers: 10,
    features: {
      whatsapp: true,
      email: true,
      phoneCalls: true,
      simSync: true,
      aiCopilot: true,
      quotations: true,
      invoices: true,
      customPipelines: true,
      prioritySupport: true
    },
    limits: {
      maxUsers: 10,
      additionalUserPrice: 600,
      leads: 100000,
      invoices: 25000,
      campaigns: 250
    },
    trialEnabled: false,
    trialDurationDays: 0,
    isDefault: false,
    isActive: true,
    sortOrder: 2
  },
  {
    name: '6 Months Plan',
    slug: 'plan-6-months',
    description: '6 Months full CRM access for up to 10 employees. Add extra seats anytime at ₹600/employee.',
    price: 30000,
    currency: 'INR',
    duration: 6,
    durationUnit: 'months',
    maxUsers: 10,
    features: {
      whatsapp: true,
      email: true,
      phoneCalls: true,
      simSync: true,
      aiCopilot: true,
      quotations: true,
      invoices: true,
      customPipelines: true,
      prioritySupport: true,
      dedicatedAccountManager: true
    },
    limits: {
      maxUsers: 10,
      additionalUserPrice: 600,
      leads: 250000,
      invoices: 50000,
      campaigns: 500
    },
    trialEnabled: false,
    trialDurationDays: 0,
    isDefault: false,
    isActive: true,
    sortOrder: 3
  }
];

async function seedPlans() {
  console.log('🔄 Seeding updated 3 SaaS Pricing Plans...');

  // 1. Delete all old plans
  // Unlink subscriptions from old plan IDs first to prevent FK constraint issues
  await prisma.subscription.updateMany({
    data: { planId: null }
  });
  await prisma.payment.updateMany({
    data: { planId: null }
  });

  await prisma.plan.deleteMany();
  console.log('✔ Removed old plans & free trial entries');

  // 2. Insert new 3 plans
  for (const p of THREE_PLANS) {
    const created = await prisma.plan.create({
      data: p
    });
    console.log(`✔ Created Plan: ${created.name} | ₹${created.price} / ${created.duration} ${created.durationUnit} (Max ${created.maxUsers} Users, ₹600/extra)`);
  }

  // 3. Link PCS subscription to the default plan
  const defaultPlan = await prisma.plan.findFirst({ where: { isDefault: true } });
  if (defaultPlan) {
    await prisma.subscription.updateMany({
      data: {
        planId: defaultPlan.id,
        planName: defaultPlan.name,
        userSeatsLimit: 10
      }
    });
    console.log(`✔ Linked active subscriptions to default plan: ${defaultPlan.name}`);
  }

  console.log('\n🎉 ALL 3 PLANS SEEDED SUCCESSFULLY!');
  await prisma.$disconnect();
}

seedPlans().catch(async (e) => {
  console.error('❌ Failed to seed plans:', e);
  await prisma.$disconnect();
  process.exit(1);
});
