import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { connectDB } from './config/db';
import { Permission } from './models/Permission';
import { Role } from './models/Role';
import { User } from './models/User';
import { UserOrganizationRole } from './models/UserOrganizationRole';
import { Organization } from './models/Organization';
import { Lead } from './models/Lead';
import { Customer } from './models/Customer';
import { FollowUp } from './models/FollowUp';
import { Task } from './models/Task';
import { Contact } from './models/Contact';
import { Pipeline } from './models/Pipeline';
import { Deal } from './models/Deal';
import { ServiceCase } from './models/ServiceCase';
import { Invoice } from './models/Invoice';
import { Ticket } from './models/Ticket';
import { Workflow } from './models/Workflow';
import { CallLog } from './models/CallLog';
import { Campaign } from './models/Campaign';
import { CommunicationConsent } from './models/CommunicationConsent';
import { Plan } from './models/Plan';
import { Subscription } from './models/Subscription';
import { Payment } from './models/Payment';
import { SaaSAuditLog } from './models/SaaSAuditLog';
import { SequenceService } from './services/sequence.service';
import logger from './utils/logger';

const DEFAULT_PERMISSIONS = [
  // Platform permissions
  { name: 'platform:admin', module: 'Platform', description: 'Complete platform control (Super Admin)' },

  // CRM Permissions
  { name: 'leads:read', module: 'CRM', description: 'View leads' },
  { name: 'leads:write', module: 'CRM', description: 'Create and update leads' },
  { name: 'leads:delete', module: 'CRM', description: 'Delete leads' },
  { name: 'customers:read', module: 'CRM', description: 'View customers' },
  { name: 'customers:write', module: 'CRM', description: 'Create and update customers' },
  { name: 'customers:delete', module: 'CRM', description: 'Delete customers' },
  { name: 'contacts:read', module: 'CRM', description: 'View contacts' },
  { name: 'contacts:write', module: 'CRM', description: 'Create and update contacts' },
  { name: 'contacts:delete', module: 'CRM', description: 'Delete contacts' },

  // Sales Pipeline
  { name: 'deals:read', module: 'Sales', description: 'View deals and pipelines' },
  { name: 'deals:write', module: 'Sales', description: 'Create and update deals' },
  { name: 'deals:delete', module: 'Sales', description: 'Delete deals' },
  { name: 'service_cases:read', module: 'Sales', description: 'View service cases' },
  { name: 'service_cases:write', module: 'Sales', description: 'Manage service cases' },

  // Accounting Permissions
  { name: 'accounting:read', module: 'Accounting', description: 'View invoices, expenses, payments' },
  { name: 'accounting:write', module: 'Accounting', description: 'Create invoices, items, and process payments' },
  { name: 'accounting:delete', module: 'Accounting', description: 'Delete or cancel accounting records' },

  // Settings
  { name: 'settings:read', module: 'Settings', description: 'View settings' },
  { name: 'settings:write', module: 'Settings', description: 'Modify organization settings' },

  // Support Helpdesk Permissions
  { name: 'support:read', module: 'Support', description: 'View support tickets' },
  { name: 'support:write', module: 'Support', description: 'Create and update support tickets' },
  { name: 'support:delete', module: 'Support', description: 'Delete support tickets' }
];

async function seed() {
  try {
    await connectDB();
    logger.info('Connected to PostgreSQL for seeding');

    // 1. Seed Permissions
    const permissionDocs = [];
    for (const p of DEFAULT_PERMISSIONS) {
      let doc = await Permission.findOne({ name: p.name });
      if (!doc) {
        doc = await Permission.create(p);
        logger.info(`Permission created: ${p.name}`);
      }
      permissionDocs.push(doc);
    }

    const permissionMap = permissionDocs.reduce((acc, doc) => {
      if (doc) {
        acc[doc.name] = (doc as any)._id || (doc as any).id;
      }
      return acc;
    }, {} as Record<string, string>);

    // Helper to get permission IDs by names
    const getIds = (names: string[]) => names.map(n => permissionMap[n]).filter(Boolean);

    // 2. Seed System Roles (4-Level Hierarchy: 1. Admin, 2. Manager, 3. Team Leader, 4. Sale Executive)
    const rolesConfig = [
      {
        name: 'Admin',
        description: 'Level 1: Complete system & organization-wide control over CRM, configurations, and all teams',
        isSystem: true,
        permissions: getIds([
          'platform:admin',
          'leads:read', 'leads:write', 'leads:delete',
          'customers:read', 'customers:write', 'customers:delete',
          'contacts:read', 'contacts:write', 'contacts:delete',
          'deals:read', 'deals:write', 'deals:delete',
          'service_cases:read', 'service_cases:write',
          'accounting:read', 'accounting:write', 'accounting:delete',
          'settings:read', 'settings:write',
          'support:read', 'support:write', 'support:delete'
        ])
      },
      {
        name: 'Super Admin',
        description: 'Level 1: Super Admin root privileges (System Master)',
        isSystem: true,
        permissions: getIds([
          'platform:admin',
          'leads:read', 'leads:write', 'leads:delete',
          'customers:read', 'customers:write', 'customers:delete',
          'contacts:read', 'contacts:write', 'contacts:delete',
          'deals:read', 'deals:write', 'deals:delete',
          'service_cases:read', 'service_cases:write',
          'accounting:read', 'accounting:write', 'accounting:delete',
          'settings:read', 'settings:write',
          'support:read', 'support:write', 'support:delete'
        ])
      },
      {
        name: 'Manager',
        description: 'Level 2: Manage sales departments, unassigned lead queues, team leaders, billing, and reports',
        isSystem: true,
        permissions: getIds([
          'leads:read', 'leads:write', 'leads:delete',
          'customers:read', 'customers:write', 'customers:delete',
          'contacts:read', 'contacts:write', 'contacts:delete',
          'deals:read', 'deals:write', 'deals:delete',
          'service_cases:read', 'service_cases:write',
          'accounting:read', 'accounting:write', 'accounting:delete',
          'settings:read',
          'support:read', 'support:write', 'support:delete'
        ])
      },
      {
        name: 'Team Leader',
        description: 'Level 3: Supervise team of sales executives, allocate leads, monitor follow-up velocity, and review quotes',
        isSystem: true,
        permissions: getIds([
          'leads:read', 'leads:write',
          'customers:read', 'customers:write',
          'contacts:read', 'contacts:write',
          'deals:read', 'deals:write',
          'service_cases:read', 'service_cases:write',
          'accounting:read', 'accounting:write',
          'settings:read',
          'support:read', 'support:write'
        ])
      },
      {
        name: 'Sale Executive',
        description: 'Level 4: Execute inbound client outreach, follow-up calls, SIM sync, and create quotations',
        isSystem: true,
        permissions: getIds([
          'leads:read', 'leads:write',
          'customers:read', 'customers:write',
          'contacts:read', 'contacts:write',
          'deals:read', 'deals:write',
          'service_cases:read', 'service_cases:write',
          'accounting:read', 'accounting:write',
          'support:read', 'support:write'
        ])
      },
      {
        name: 'Employee',
        description: 'Level 4: Standard Sales Execution Role (Alias)',
        isSystem: true,
        permissions: getIds([
          'leads:read', 'leads:write',
          'customers:read', 'customers:write',
          'contacts:read', 'contacts:write',
          'deals:read', 'deals:write',
          'service_cases:read', 'service_cases:write',
          'accounting:read', 'accounting:write',
          'support:read', 'support:write'
        ])
      }
    ];

    const rolesMap: Record<string, any> = {};
    for (const r of rolesConfig) {
      let roleDoc = await Role.findOne({ name: r.name, organizationId: null });
      if (roleDoc) {
        roleDoc.permissions = r.permissions;
        if ((roleDoc as any).save) await (roleDoc as any).save();
        logger.info(`Role updated: ${r.name}`);
      } else {
        roleDoc = await Role.create({
          name: r.name,
          description: r.description,
          isSystem: r.isSystem,
          permissions: r.permissions
        });
        logger.info(`Role created: ${r.name}`);
      }
      rolesMap[r.name] = roleDoc;
    }

    // 3. Seed Primary Single Organization: PCS
    const primaryOrgName = 'PCS';
    let primaryOrg: any = await Organization.findOne({
      $or: [{ name: primaryOrgName }, { name: 'Artho Vista CRM' }, { name: 'Platform Admin Organization' }]
    });

    if (!primaryOrg) {
      primaryOrg = await Organization.create({
        name: primaryOrgName,
        businessType: 'general',
        phone: '9999999999',
        email: 'info@pcs.com',
        website: 'https://pcs.com',
        currency: 'INR',
        timezone: 'Asia/Kolkata',
        isSuspended: false
      });
      logger.info(`Primary organization created: ${primaryOrgName}`);
    } else if (primaryOrg.name !== primaryOrgName) {
      primaryOrg.name = primaryOrgName;
      primaryOrg.email = 'info@pcs.com';
      primaryOrg.website = 'https://pcs.com';
      await primaryOrg.save();
      logger.info(`Updated organization name to: ${primaryOrgName}`);
    }

    // 4. Seed 4-Tier Hierarchy Users: Admin, Manager, Team Leader, Sale Executive
    // 4.1 Tier 1: Admin User
    const superAdminEmail = 'shivamthakur12012@gmail.com';
    let superAdmin: any = await User.findOne({ email: superAdminEmail });
    const superAdminPasswordHash = await bcrypt.hash('Shivam@123', 10);

    if (!superAdmin) {
      superAdmin = await User.create({
        email: superAdminEmail,
        passwordHash: superAdminPasswordHash,
        firstName: 'Shivam',
        lastName: 'Thakur',
        isVerified: true,
        status: 'active'
      });
      logger.info(`Admin user created: ${superAdminEmail}`);
    } else {
      superAdmin.passwordHash = superAdminPasswordHash;
      superAdmin.status = 'active';
      await superAdmin.save();
      logger.info(`Admin password updated for: ${superAdminEmail}`);
    }

    // 4.2 Tier 2: Manager User
    const managerEmail = 'manager@pcs.com';
    let manager: any = await User.findOne({ email: managerEmail });
    const managerPasswordHash = await bcrypt.hash('Manager@123', 10);

    if (!manager) {
      manager = await User.create({
        email: managerEmail,
        passwordHash: managerPasswordHash,
        firstName: 'Rahul',
        lastName: 'Verma',
        isVerified: true,
        status: 'active'
      });
      logger.info(`Manager user created: ${managerEmail}`);
    } else {
      manager.passwordHash = managerPasswordHash;
      manager.status = 'active';
      await manager.save();
      logger.info(`Manager password updated for: ${managerEmail}`);
    }

    // 4.3 Tier 3: Team Leader User
    const teamLeadEmail = 'teamlead@pcs.com';
    let teamLead: any = await User.findOne({ email: teamLeadEmail });
    const teamLeadPasswordHash = await bcrypt.hash('Teamlead@123', 10);

    if (!teamLead) {
      teamLead = await User.create({
        email: teamLeadEmail,
        passwordHash: teamLeadPasswordHash,
        firstName: 'Priya',
        lastName: 'Patel',
        isVerified: true,
        status: 'active'
      });
      logger.info(`Team Leader user created: ${teamLeadEmail}`);
    } else {
      teamLead.passwordHash = teamLeadPasswordHash;
      teamLead.status = 'active';
      await teamLead.save();
      logger.info(`Team Leader password updated for: ${teamLeadEmail}`);
    }

    // 4.4 Tier 4: Sale Executive User
    const executiveEmail = 'executive@pcs.com';
    let executive: any = await User.findOne({ email: executiveEmail });
    const executivePasswordHash = await bcrypt.hash('Executive@123', 10);

    if (!executive) {
      executive = await User.create({
        email: executiveEmail,
        passwordHash: executivePasswordHash,
        firstName: 'Pooja',
        lastName: 'Sharma',
        isVerified: true,
        status: 'active'
      });
      logger.info(`Sale Executive user created: ${executiveEmail}`);
    } else {
      executive.passwordHash = executivePasswordHash;
      executive.status = 'active';
      await executive.save();
      logger.info(`Sale Executive password updated for: ${executiveEmail}`);
    }

    // 5. Link 4 Users to PCS Organization
    const userRoleMappings = [
      { user: superAdmin, roleName: 'Admin' },
      { user: manager, roleName: 'Manager' },
      { user: teamLead, roleName: 'Team Leader' },
      { user: executive, roleName: 'Sale Executive' }
    ];

    for (const mapping of userRoleMappings) {
      let existingMapping: any = await UserOrganizationRole.findOne({
        userId: mapping.user._id,
        organizationId: primaryOrg._id
      });

      if (!existingMapping) {
        await UserOrganizationRole.create({
          userId: mapping.user._id,
          organizationId: primaryOrg._id,
          roleId: (rolesMap[mapping.roleName] || rolesMap['Admin'])._id
        });
        logger.info(`Linked ${mapping.user.email} as ${mapping.roleName}.`);
      } else {
        existingMapping.roleId = (rolesMap[mapping.roleName] || rolesMap['Admin'])._id;
        if (existingMapping.save) await existingMapping.save();
        logger.info(`Updated ${mapping.user.email} role to ${mapping.roleName}.`);
      }
    }

    const platformOrg = primaryOrg;

    // 6. Seed CRM Leads (20+ records)
    const leadsCount = await Lead.countDocuments({ organizationId: platformOrg._id });
    if (leadsCount === 0) {
      const services = ['Business Loan', 'GST Registration', 'Company Registration', 'Trademark', 'ISO Certification'];
      const sources = ['Website', 'WhatsApp', 'Instagram', 'Facebook', 'LinkedIn', 'Google Ads', 'Referral'];
      const statuses = ['New', 'Contacted', 'Qualified', 'Follow-up', 'Proposal Sent', 'Negotiation'];
      
      const leadsToCreate = Array.from({ length: 25 }).map((_, i) => ({
        organizationId: platformOrg._id,
        leadId: `LD-${10001 + i}`,
        name: `Lead Customer ${i + 1}`,
        company: `Company ${String.fromCharCode(65 + (i % 26))} Pvt Ltd`,
        email: `lead${i + 1}@example.com`,
        phone: `98765000${String(i).padStart(2, '0')}`,
        whatsApp: `98765000${String(i).padStart(2, '0')}`,
        source: sources[i % sources.length],
        serviceInterested: services[i % services.length],
        priority: i % 4 === 0 ? 'urgent' : i % 3 === 0 ? 'high' : 'medium',
        status: statuses[i % statuses.length],
        assignedTo: superAdmin._id,
        expectedValue: 25000 + (i * 5000),
        notes: `Inquiry received for business setup and taxation support. Customer is interested in ${services[i % services.length]} options.`,
        tags: [services[i % services.length].replace(' ', '_'), 'Development_Seed']
      }));

      await Lead.create(leadsToCreate);
      logger.info('Seeded 25 realistic Lead records.');
    }

    // 7. Seed CRM Customers (10+ records)
    const customersCount = await Customer.countDocuments({ organizationId: platformOrg._id });
    if (customersCount === 0) {
      const customersToCreate = Array.from({ length: 12 }).map((_, i) => ({
        organizationId: platformOrg._id,
        customerId: `CS-${10001 + i}`,
        name: `Active Client ${i + 1}`,
        companyName: `Corporate ${String.fromCharCode(75 + (i % 15))} LLC`,
        email: `client${i + 1}@corporate.com`,
        phone: `99988000${String(i).padStart(2, '0')}`,
        whatsApp: `99988000${String(i).padStart(2, '0')}`,
        gstin: `27ABCDE${1234 + i}F1Z${i % 9}`,
        pan: `ABCDE${1234 + i}F`,
        outstandingBalance: i % 3 === 0 ? 15000 + (i * 2000) : 0,
        notes: 'Long term service client with active support retainer.'
      }));

      const createdCustomers = await Customer.create(customersToCreate);
      logger.info('Seeded 12 active Customer records.');

      // Create primary contacts
      const contactsToCreate = (createdCustomers as any[]).map((cust: any, i: number) => ({
        organizationId: platformOrg._id,
        customerId: cust._id,
        firstName: cust.name.split(' ')[0],
        lastName: cust.name.split(' ')[1] || 'Representative',
        email: cust.email,
        phone: cust.phone,
        role: i % 2 === 0 ? 'Director' : 'Finance Head',
        isPrimary: true
      }));
      await Contact.create(contactsToCreate);
    }

    // 8. Seed Follow-ups (10+ records)
    const followupsCount = await FollowUp.countDocuments({ organizationId: platformOrg._id });
    if (followupsCount === 0) {
      const today = new Date();
      const tomorrow = new Date();
      tomorrow.setDate(today.getDate() + 1);
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);

        const activeLeads = await Lead.find({ organizationId: platformOrg._id }).limit(10);
        
        const followupsToCreate = activeLeads.map((lead, i) => ({
          organizationId: platformOrg._id,
          leadId: lead._id,
          assignedTo: superAdmin._id,
          date: i % 3 === 0 ? yesterday : i % 2 === 0 ? today : tomorrow,
          time: `${9 + (i % 4)}:00 AM`,
          type: i % 3 === 0 ? 'meeting' : i % 2 === 0 ? 'call' : 'whatsapp',
          notes: `Follow up to finalize quotes for ${lead.serviceInterested}.`,
          status: i % 3 === 0 ? 'completed' : 'pending',
          outcome: i % 3 === 0 ? 'Client requested proposal sent.' : undefined
        }));

        await FollowUp.create(followupsToCreate);
        logger.info('Seeded 10 Follow-up scheduling entries.');
      }

      // 9. Seed Tasks (10+ records)
      const tasksCount = await Task.countDocuments({ organizationId: platformOrg._id });
      if (tasksCount === 0) {
        const activeLeads = await Lead.find({ organizationId: platformOrg._id }).limit(10);

        const tasksToCreate = activeLeads.map((lead, i) => ({
          organizationId: platformOrg._id,
          title: `Collect documents for ${lead.serviceInterested}`,
          description: `Need Aadhaar, PAN, and address details to file ${lead.serviceInterested}.`,
          assignedTo: superAdmin._id,
          leadId: lead._id,
          dueDate: new Date(Date.now() + (i * 24 * 60 * 60 * 1000)), // Daily offset
          priority: i % 3 === 0 ? 'high' : 'medium',
          status: i % 4 === 0 ? 'completed' : 'pending'
        }));

        await Task.create(tasksToCreate);
        logger.info('Seeded 10 Tasks operations checklists.');
      }

      // 10. Seed Custom Pipelines
      const pipelinesCount = await Pipeline.countDocuments({ organizationId: platformOrg._id });
      let seedPipelines = [];
      if (pipelinesCount === 0) {
        const p1 = await Pipeline.create({
          organizationId: platformOrg._id,
          name: 'General Sales Pipeline',
          isSystem: true,
          stages: [
            { name: 'New Lead', probability: 10, order: 0 },
            { name: 'Contacted', probability: 30, order: 1 },
            { name: 'Qualified', probability: 50, order: 2 },
            { name: 'Proposal Sent', probability: 75, order: 3 },
            { name: 'Negotiation', probability: 90, order: 4 },
            { name: 'Closed Won', probability: 100, order: 5 },
            { name: 'Closed Lost', probability: 0, order: 6 }
          ]
        });

        const p2 = await Pipeline.create({
          organizationId: platformOrg._id,
          name: 'Business Loan Pipeline',
          stages: [
            { name: 'Eligibility Assessment', probability: 20, order: 0 },
            { name: 'Documents Requested', probability: 40, order: 1 },
            { name: 'Bank Processing', probability: 70, order: 2 },
            { name: 'Sanctioned', probability: 90, order: 3 },
            { name: 'Disbursed', probability: 100, order: 4 },
            { name: 'Closed Lost', probability: 0, order: 5 }
          ]
        });

        seedPipelines = [p1, p2];
        logger.info('Seeded default Sales and Business Loan pipelines.');
      } else {
        seedPipelines = await Pipeline.find({ organizationId: platformOrg._id });
      }

      // 11. Seed Deals (10+ records)
      const dealsCount = await Deal.countDocuments({ organizationId: platformOrg._id });
      if (seedPipelines.length === 0 || !seedPipelines[0]?.stages?.length) {
        seedPipelines = await Pipeline.find({ organizationId: platformOrg._id });
      }
      if (dealsCount === 0 && seedPipelines.length > 0 && seedPipelines[0]?.stages?.length > 0) {
        const activeCustomers = await Customer.find({ organizationId: platformOrg._id });
        const defaultPipeline = seedPipelines[0]; // General Sales
        
        const dealsToCreate = Array.from({ length: 12 }).map((_, i) => {
          const cust = activeCustomers[i % activeCustomers.length];
          const stages = defaultPipeline.stages || [];
          const stage = stages[i % stages.length];
          return {
            organizationId: platformOrg._id,
            dealId: `DL-${10001 + i}`,
            title: `Opportunity for ${cust.name} - ${i + 1}`,
            customerId: cust._id,
            ownerId: superAdmin._id,
            pipelineId: defaultPipeline._id,
            stageId: stage._id,
            amount: 50000 + (i * 20000),
            probability: stage.probability,
            expectedCloseDate: new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)), // 30 days out
            status: stage.name.includes('Won') ? 'won' : stage.name.includes('Lost') ? 'lost' : 'open',
            notes: 'Quotation sent and initial terms discussed.'
          };
        });

        await Deal.create(dealsToCreate);
        logger.info('Seeded 12 Opportunity Deal records.');
      }

      // 12. Seed Service Cases (6+ records)
      const casesCount = await ServiceCase.countDocuments({ organizationId: platformOrg._id });
      if (casesCount === 0) {
        const activeCustomers = await Customer.find({ organizationId: platformOrg._id });
        const serviceTypes = ['business_loan', 'gst_registration', 'company_registration', 'trademark', 'msme_udyam'];
        const serviceNames = ['Business Loan Consultancy', 'GST Registration filing', 'Company Setup', 'Trademark Search', 'MSME Registration'];

        const casesToCreate = Array.from({ length: 6 }).map((_, i) => {
          const cust = activeCustomers[i % activeCustomers.length];
          const serviceId = serviceTypes[i % serviceTypes.length];
          
          // Generate checklist based on service template
          const checklistTemplates: Record<string, string[]> = {
            business_loan: ['PAN Card', 'Aadhaar Card', '6 Months Bank Statements', '2 Years ITR'],
            gst_registration: ['PAN Card of Applicant', 'Aadhaar Card of Applicant', 'Business Address Proof'],
            company_registration: ['Director PAN Cards', 'Director Aadhaar/Identity Proofs', 'Office Utility Bill'],
            trademark: ['Brand Logo image', 'Signed TM-48 Authorisation Letter'],
            msme_udyam: ['Aadhaar Card of Director', 'PAN Card of Entity']
          };

          const chkNames = checklistTemplates[serviceId] || ['PAN Card', 'Address Proof'];
          const checklist = chkNames.map((name, idx) => ({
            name,
            isRequired: true,
            status: idx === 0 ? 'pending' : 'pending'
          }));

          return {
            organizationId: platformOrg._id,
            caseId: `SC-${10001 + i}`,
            customerId: cust._id,
            serviceId,
            serviceName: serviceNames[i % serviceNames.length],
            assignedTo: superAdmin._id,
            stage: i % 2 === 0 ? 'docs_requested' : 'verification',
            checklist
          };
        });

        await ServiceCase.create(casesToCreate);
        logger.info('Seeded 6 Service Case records.');
      }

      // 13. Sample Service definitions for Invoices
      const sampleServices = [
        { name: 'Private Limited Company Registration', rate: 12500, gstRate: 18 },
        { name: 'GST Registration Support', rate: 2500, gstRate: 18 },
        { name: 'MSME Udyam Registration filing', rate: 1500, gstRate: 0 },
        { name: 'Corporate ITR filing retainer', rate: 15000, gstRate: 18 },
        { name: 'Statutory business audit service', rate: 1500, gstRate: 18 }
      ];

      // 14. Seed Invoices (10+ records)
      const invoicesCount = await Invoice.countDocuments({ organizationId: platformOrg._id });
      if (invoicesCount === 0) {
        const activeCustomers = await Customer.find({ organizationId: platformOrg._id });
        
        const invoicesToCreate = Array.from({ length: 12 }).map((_, i) => {
          const cust = activeCustomers[i % activeCustomers.length];
          const item1 = sampleServices[i % sampleServices.length];
          const item2 = sampleServices[(i + 1) % sampleServices.length];
          
          // Row items calculation
          const qty1 = 1;
          const sub1 = qty1 * item1.rate;
          const tax1 = sub1 * (item1.gstRate / 100);
          
          const qty2 = i % 2 === 0 ? 2 : 1;
          const sub2 = qty2 * item2.rate;
          const tax2 = sub2 * (item2.gstRate / 100);

          const subtotal = sub1 + sub2;
          const taxTotal = tax1 + tax2;
          const totalAmount = subtotal + taxTotal;

          const statuses: ('draft' | 'sent' | 'paid' | 'partial')[] = ['draft', 'sent', 'paid', 'partial'];
          const status = statuses[i % statuses.length];

          const invoiceDate = new Date();
          invoiceDate.setDate(invoiceDate.getDate() - (i * 3));
          const dueDate = new Date(invoiceDate);
          dueDate.setDate(dueDate.getDate() + 30);

          // Payments logs setup
          const payments = [];
          let outstandingBalanceAdd = 0;

          if (status === 'paid') {
            payments.push({
              amount: totalAmount,
              reference: `TXN-REF-PAID-${i}`,
              date: new Date(),
              method: 'upi' as const
            });
          } else if (status === 'partial') {
            const payAmt = Math.round(totalAmount / 3);
            payments.push({
              amount: payAmt,
              reference: `TXN-REF-PART-${i}`,
              date: new Date(),
              method: 'bank_transfer' as const
            });
            outstandingBalanceAdd = totalAmount - payAmt;
          } else if (status === 'sent') {
            outstandingBalanceAdd = totalAmount;
          }

          return {
            invoiceData: {
              organizationId: platformOrg._id,
              invoiceId: `INV-${10001 + i}`,
              customerId: cust._id,
              date: invoiceDate,
              dueDate,
              items: [
                {
                  name: item1.name,
                  quantity: qty1,
                  rate: item1.rate,
                  gstRate: item1.gstRate,
                  taxAmount: tax1,
                  subtotal: sub1,
                  total: sub1 + tax1
                },
                {
                  name: item2.name,
                  quantity: qty2,
                  rate: item2.rate,
                  gstRate: item2.gstRate,
                  taxAmount: tax2,
                  subtotal: sub2,
                  total: sub2 + tax2
                }
              ],
              subtotal,
              taxTotal,
              totalAmount,
              status,
              payments,
              notes: 'Thank you for choosing ArthaVenture corporate services.'
            },
            customerId: cust._id,
            outstandingBalanceAdd
          };
        });

        // Insert invoices and increment outstanding balance
        for (const data of invoicesToCreate) {
          await Invoice.create(data.invoiceData);
          if (data.outstandingBalanceAdd > 0) {
            await Customer.findByIdAndUpdate(data.customerId, {
              $inc: { outstandingBalance: data.outstandingBalanceAdd }
            });
          }
        }

        logger.info('Seeded 12 tax Invoice records with ledger synchronizations.');
      }

      // 15. Seed Support Tickets (10+ records)
      const ticketsCount = await Ticket.countDocuments({ organizationId: platformOrg._id });
      if (ticketsCount === 0) {
        const activeCustomers = await Customer.find({ organizationId: platformOrg._id });
        
        const ticketsToCreate = Array.from({ length: 10 }).map((_, i) => {
          const cust = activeCustomers[i % activeCustomers.length];
          const categories: ('billing' | 'service' | 'technical' | 'other')[] = ['technical', 'billing', 'service', 'other'];
          const category = categories[i % categories.length];
          const priorities: ('low' | 'medium' | 'high' | 'urgent')[] = ['medium', 'high', 'urgent', 'low'];
          const priority = priorities[i % priorities.length];
          const statuses: ('open' | 'in_progress' | 'resolved' | 'closed')[] = ['open', 'in_progress', 'resolved', 'closed'];
          const status = statuses[i % statuses.length];

          const messages: any[] = [
            {
              senderId: superAdmin._id,
              senderName: cust.name,
              senderType: 'customer' as const,
              content: `Hello, we need assistance with ticket query #${i + 1}. We are encountering problems with our statutory application processing.`,
              date: new Date(Date.now() - 3600000 * 24 * 2)
            }
          ];

          if (status !== 'open') {
            messages.push({
              senderId: superAdmin._id,
              senderName: 'Rahul Sharma (Support Rep)',
              senderType: 'user' as const,
              content: `Thank you for contacting support. I have looked at your request and mapped it to our compliance team. We will update you shortly.`,
              date: new Date(Date.now() - 3600000 * 24)
            });
          }

          if (status === 'resolved' || status === 'closed') {
            messages.push({
              senderId: superAdmin._id,
              senderName: cust.name,
              senderType: 'customer' as const,
              content: `Perfect, the issue has been successfully resolved on our end. You can mark this ticket as closed. Thank you!`,
              date: new Date(Date.now() - 3600000 * 12)
            });
          }

          return {
            organizationId: platformOrg._id,
            ticketId: `TKT-${10001 + i}`,
            customerId: cust._id,
            title: `Support query regarding ${category.toUpperCase()} #${i + 1}`,
            description: `Assistance requested regarding operational activities on category ${category}.`,
            priority,
            status,
            category,
            assignedTo: superAdmin._id,
            messages
          };
        });

        await Ticket.create(ticketsToCreate);
        logger.info('Seeded 10 support Ticket message logs.');
      }

      // 16. Seed Workflows & Automations (2 records)
      const workflowsCount = await Workflow.countDocuments({ organizationId: platformOrg._id });
      if (workflowsCount === 0) {
        await Workflow.create([
          {
            organizationId: platformOrg._id,
            name: 'Welcome tasks auto-assigner',
            triggerEvent: 'lead_created',
            conditions: [],
            actions: [
              {
                actionType: 'create_task',
                metadata: {
                  title: 'Call new lead and introduce services catalog',
                  dueDateOffsetDays: 2
                }
              }
            ],
            isActive: true
          },
          {
            organizationId: platformOrg._id,
            name: 'High-value opportunities alert dispatcher',
            triggerEvent: 'deal_stage_changed',
            conditions: [
              {
                field: 'amount',
                operator: 'greater_than',
                value: '50000'
              }
            ],
            isActive: true,
            actions: [
              {
                actionType: 'create_task',
                metadata: {
                  title: 'Manager Review: high value opportunity moved',
                  dueDateOffsetDays: 1
                }
              },
              {
                actionType: 'send_email',
                metadata: {
                  subject: 'Alert: High value deal stage updated',
                  body: 'A deal valued above ₹50,000 has moved stages. Please review details.'
                }
              }
            ]
          }
        ]);
        logger.info('Seeded 2 default active automation Workflow rules.');
      }

      // 17. Seed Default Multi-Channel Sequences (Hot, Warm, Cold)
      await SequenceService.seedDefaultSequences(platformOrg._id.toString(), superAdmin._id.toString());
      logger.info('Seeded Hot, Warm, and Cold automated multi-channel sequences.');

      // 18. Seed Realistic Call Logs & History (15+ records)
      const existingCalls = await CallLog.countDocuments({ organizationId: platformOrg._id });
      if (existingCalls === 0) {
        const seededLeads = await Lead.find({ organizationId: platformOrg._id }).limit(15);
        const outcomes: any[] = [
          'Interested', 'Connected', 'Call Back Later', 'No Answer', 
          'Interested', 'Connected', 'Busy', 'Converted', 'Follow-up Required'
        ];

        const callsToSeed = seededLeads.map((lead, idx) => {
          const outcome = outcomes[idx % outcomes.length];
          const duration = outcome === 'No Answer' || outcome === 'Busy' ? 0 : 45 + ((idx * 37) % 300);
          return {
            organizationId: platformOrg._id,
            leadId: lead._id,
            employeeId: superAdmin._id,
            phoneNumber: lead.phone || '9876543210',
            direction: 'outbound',
            provider: 'manual',
            startTime: new Date(Date.now() - (idx * 3600000 * 4)),
            endTime: new Date(Date.now() - (idx * 3600000 * 4) + duration * 1000),
            duration,
            status: 'completed',
            outcome,
            notes: outcome === 'Interested' 
              ? `Client confirmed high interest in ${lead.serviceInterested || 'advisory services'}. Requested formal proposal and document list.`
              : outcome === 'Converted'
              ? `Client accepted pricing terms. Onboarding kickoff scheduled.`
              : `Discussed requirement for ${lead.serviceInterested || 'business consultation'}. Outcome recorded as ${outcome}.`,
            recordingUrl: duration > 60 ? 'https://example.com/recordings/sample_call_rec.mp3' : undefined
          };
        });

        await CallLog.create(callsToSeed);
        logger.info(`Seeded ${callsToSeed.length} phone call logs with realistic outcomes and durations.`);
      }

      // 19. Seed Multi-Channel Outreach Campaigns
      const existingCampaigns = await Campaign.countDocuments({ organizationId: platformOrg._id });
      if (existingCampaigns === 0) {
        await Campaign.create([
          {
            organizationId: platformOrg._id,
            name: 'Q3 Business Loan Priority Blitz',
            channel: 'phone',
            type: 'bulk_call_tasks',
            status: 'running',
            scheduledAt: new Date(),
            targetCriteria: {
              leadTemperature: ['hot', 'very_hot'],
              status: ['New', 'Contacted']
            },
            content: {
              callObjective: 'Verify loan amount requirements and schedule valuation consultation.',
              talkingPoints: [
                'Introduce subsidized loan schemes',
                'Verify GST turnover numbers',
                'Offer fast-track 48h documentation'
              ]
            },
            stats: {
              totalTargeted: 45,
              sentOrCreated: 45,
              delivered: 45,
              opened: 0,
              clicked: 0,
              connected: 32,
              interested: 18,
              converted: 6,
              failedOrBounced: 0
            },
            createdBy: superAdmin._id
          },
          {
            organizationId: platformOrg._id,
            name: 'MailerCloud GST Compliance Broadcast',
            channel: 'email',
            type: 'broadcast',
            status: 'completed',
            scheduledAt: new Date(Date.now() - 86400000 * 2),
            targetCriteria: {
              leadTemperature: ['warm', 'cold']
            },
            content: {
              subject: 'Simplify Your Annual GST Filings with ArthaVenture',
              body: '<p>Dear Client,</p><p>Ensure seamless GST compliance with automated reconciliations and zero penalty guarantees.</p>'
            },
            stats: {
              totalTargeted: 120,
              sentOrCreated: 120,
              delivered: 118,
              opened: 64,
              clicked: 28,
              connected: 0,
              interested: 14,
              converted: 5,
              failedOrBounced: 2
            },
            createdBy: superAdmin._id
          }
        ]);
        logger.info('Seeded multi-channel outreach campaigns.');
      }

      // 20. Seed Communication Consents
      const seededLeads = await Lead.find({ organizationId: platformOrg._id }).limit(20);
      for (const lead of seededLeads) {
        await CommunicationConsent.findOneAndUpdate(
          { organizationId: platformOrg._id, entityType: 'lead', entityId: lead._id },
          {
            $setOnInsert: {
              whatsAppAllowed: true,
              emailAllowed: true,
              instagramAllowed: true,
              phoneAllowed: true,
              marketingAllowed: true,
              doNotContact: false
            }
          },
          { upsert: true }
        );
      }
      logger.info('Seeded granular multi-channel communication consents.');

      // 19. Seed Dynamic SaaS Plans (1 Month @ 5000, 3 Months @ 15000, 6 Months @ 30000, Max 10 Employees)
      const starterPlan = await Plan.findOneAndUpdate(
        { slug: 'starter-1m' },
        {
          name: 'Starter (1 Month)',
          slug: 'starter-1m',
          description: '1 Month plan with up to 10 employee seats, full CRM, leads, quotations, and invoicing.',
          price: 5000,
          currency: 'INR',
          duration: 1,
          durationUnit: 'months',
          maxUsers: 10,
          limits: {
            leads: 5000,
            contacts: 5000,
            campaigns: 50,
            followUps: 5000,
            tasks: 2500,
            invoices: 200,
            storageMb: 5120
          },
          features: {
            email: true,
            whatsapp: true,
            instagram: true,
            phoneCalls: true,
            analytics: true,
            reports: true,
            automation: true,
            aiCopilot: true
          },
          trialEnabled: false,
          trialDurationDays: 0,
          autoRenewSupported: true,
          isDefault: true,
          isActive: true,
          sortOrder: 1
        },
        { upsert: true, new: true }
      );

      await Plan.findOneAndUpdate(
        { slug: 'growth-3m' },
        {
          name: 'Growth (3 Months)',
          slug: 'growth-3m',
          description: '3 Months plan with up to 10 employee seats, multi-channel outreach, and AI follow-up velocity.',
          price: 15000,
          currency: 'INR',
          duration: 3,
          durationUnit: 'months',
          maxUsers: 10,
          limits: {
            leads: 15000,
            contacts: 15000,
            campaigns: 150,
            followUps: 15000,
            tasks: 7500,
            invoices: 600,
            storageMb: 15360
          },
          features: {
            email: true,
            whatsapp: true,
            instagram: true,
            phoneCalls: true,
            analytics: true,
            reports: true,
            automation: true,
            aiCopilot: true
          },
          trialEnabled: false,
          trialDurationDays: 0,
          autoRenewSupported: true,
          isDefault: false,
          isActive: true,
          sortOrder: 2
        },
        { upsert: true, new: true }
      );

      await Plan.findOneAndUpdate(
        { slug: 'enterprise-6m' },
        {
          name: 'Enterprise (6 Months)',
          slug: 'enterprise-6m',
          description: '6 Months power pack with up to 10 employee seats, full automation, and priority SLA governance.',
          price: 30000,
          currency: 'INR',
          duration: 6,
          durationUnit: 'months',
          maxUsers: 10,
          limits: {
            leads: 50000,
            contacts: 50000,
            campaigns: 500,
            followUps: 50000,
            tasks: 25000,
            invoices: 2000,
            storageMb: 51200
          },
          features: {
            email: true,
            whatsapp: true,
            instagram: true,
            phoneCalls: true,
            analytics: true,
            reports: true,
            automation: true,
            aiCopilot: true
          },
          trialEnabled: false,
          trialDurationDays: 0,
          autoRenewSupported: true,
          isDefault: false,
          isActive: true,
          sortOrder: 3
        },
        { upsert: true, new: true }
      );

      await Plan.deleteOne({ slug: 'free-trial' });

      logger.info('Seeded dynamic Starter (1M), Growth (3M), and Enterprise (6M) plans.');

      // 20. Seed Organization Subscription (Linked to Starter 1M Plan)
      const subStartDate = new Date();
      const subEndDate = new Date();
      subEndDate.setDate(subEndDate.getDate() + 30); // 30 days active

      const activeSub = await Subscription.findOneAndUpdate(
        { organizationId: platformOrg._id },
        {
          planId: starterPlan._id,
          planName: starterPlan.name,
          status: 'active',
          startDate: subStartDate,
          endDate: subEndDate,
          priceAtPurchase: starterPlan.price,
          currencyAtPurchase: starterPlan.currency,
          durationAtPurchase: starterPlan.duration,
          durationUnitAtPurchase: starterPlan.durationUnit,
          maxUsersAtPurchase: starterPlan.maxUsers,
          limitsAtPurchase: starterPlan.limits,
          featuresAtPurchase: starterPlan.features,
          autoRenew: true,
          paymentStatus: 'paid',
          paymentProvider: 'upi_qr',
          providerPaymentId: 'pay_upi_seed_001',
          providerOrderId: 'order_upi_seed_001'
        },
        { upsert: true, new: true }
      );

      logger.info('Seeded Organization Subscription linked to Starter (1 Month) Plan.');

      // 21. Seed Payment records
      await Payment.findOneAndUpdate(
        { organizationId: platformOrg._id, paymentId: 'pay_upi_seed_001' },
        {
          organizationId: platformOrg._id,
          subscriptionId: activeSub._id,
          planId: starterPlan._id,
          provider: 'upi_qr',
          paymentId: 'pay_upi_seed_001',
          orderId: 'order_upi_seed_001',
          amount: 5000,
          currency: 'INR',
          status: 'captured',
          paymentMethod: 'upi_qr',
          paidAt: subStartDate
        },
        { upsert: true }
      );

      // 22. Seed SaaS Audit Logs
      await SaaSAuditLog.create({
        adminId: superAdmin._id,
        adminEmail: superAdmin.email,
        adminName: `${superAdmin.firstName} ${superAdmin.lastName}`,
        organizationId: platformOrg._id,
        organizationName: platformOrg.name,
        action: 'SUBSCRIPTION_ACTIVATED',
        newValue: { planName: 'Professional', price: 2499, durationDays: 90 },
        reason: 'Initial platform onboarding and subscription provisioning.'
      });

      logger.info('Seeded sample Payments and SaaS Audit Logs.');

    logger.info('Database seeding completed successfully.');
    process.exit(0);
  } catch (error) {
    logger.error('Error seeding database:', error);
    process.exit(1);
  }
}

seed();
