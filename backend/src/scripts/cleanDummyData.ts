import prisma from '../config/prisma';

async function cleanDummyData() {
  console.log('--- CLEANING DUMMY TEST DATA ---');

  // 1. Delete transactional records created during testing
  await prisma.followUp.deleteMany({});
  console.log('✔ Cleared Follow-ups');

  await prisma.callLog.deleteMany({});
  console.log('✔ Cleared Call Logs');

  await prisma.invoicePayment.deleteMany({});
  await prisma.invoiceItem.deleteMany({});
  await prisma.invoice.deleteMany({});
  console.log('✔ Cleared Invoices & Payments');

  await prisma.quotationItem.deleteMany({});
  await prisma.quotation.deleteMany({});
  console.log('✔ Cleared Quotations');

  await prisma.serviceCase.deleteMany({});
  console.log('✔ Cleared Service Cases');

  await prisma.assignmentLog.deleteMany({});
  console.log('✔ Cleared Assignment Logs');

  await prisma.activity.deleteMany({});
  console.log('✔ Cleared Activities');

  await prisma.deal.deleteMany({});
  console.log('✔ Cleared Deals');

  await prisma.contact.deleteMany({});
  console.log('✔ Cleared Contacts');

  await prisma.customer.deleteMany({});
  console.log('✔ Cleared Customers');

  await prisma.lead.deleteMany({});
  console.log('✔ Cleared Leads');

  console.log('\n--- VERIFYING CLEAN STATE ---');
  const [leads, followups, customers, quotations, invoices] = await Promise.all([
    prisma.lead.count(),
    prisma.followUp.count(),
    prisma.customer.count(),
    prisma.quotation.count(),
    prisma.invoice.count()
  ]);

  console.log('Remaining counts:', { leads, followups, customers, quotations, invoices });
  await prisma.$disconnect();
  console.log('Dummy data successfully removed!');
}

cleanDummyData().catch(async (e) => {
  console.error('Error cleaning dummy data:', e);
  await prisma.$disconnect();
  process.exit(1);
});
