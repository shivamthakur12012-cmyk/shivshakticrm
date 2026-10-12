import prisma from '../config/prisma';

async function check() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, firstName: true, lastName: true, userOrgRoles: { include: { role: true, organization: true } } }
  });
  const orgs = await prisma.organization.findMany();
  const leads = await prisma.lead.count();
  const customers = await prisma.customer.count();
  const deals = await prisma.deal.count();
  const invoices = await prisma.invoice.count();
  const quotations = await prisma.quotation.count();
  const tasks = await prisma.task.count();
  const followups = await prisma.followUp.count();
  const tickets = await prisma.ticket.count();
  const serviceCases = await prisma.serviceCase.count();
  const items = await prisma.item.count();
  const callLogs = await prisma.callLog.count();

  console.log('--- DATABASE STATUS ---');
  console.log('Organizations:', orgs.map(o => ({ id: o.id, name: o.name })));
  console.log('Users/Employees:', users.map(u => ({
    id: u.id,
    email: u.email,
    name: `${u.firstName} ${u.lastName}`,
    roles: u.userOrgRoles.map(r => `${r.role?.name} @ ${r.organization?.name}`)
  })));
  console.log('Counts:', {
    leads,
    customers,
    deals,
    invoices,
    quotations,
    tasks,
    followups,
    tickets,
    serviceCases,
    items,
    callLogs
  });
  await prisma.$disconnect();
}

check().catch(console.error);
