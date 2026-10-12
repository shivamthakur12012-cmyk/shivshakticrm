import { connectDB } from '../config/db';
import prisma from '../config/prisma';
import { Lead } from '../models/Lead';
import { Customer } from '../models/Customer';
import { Contact } from '../models/Contact';
import { FollowUp } from '../models/FollowUp';
import { Quotation, calculateQuotationTotals } from '../models';
import { Invoice } from '../models/Invoice';
import { Activity } from '../models/Activity';
import { AssignmentLog } from '../models/AssignmentLog';

async function seedRealisticData() {
  try {
    await connectDB();
    console.log('Connected to DB. Starting realistic data seeding...');

    const orgs = await prisma.organization.findMany();
    const users = await prisma.user.findMany({
      include: { userOrgRoles: true }
    });

    if (orgs.length === 0) {
      console.log('No organizations found to seed.');
      return;
    }

    for (const org of orgs) {
      const orgId = org.id;
      const orgUsers = users.filter((u: any) => u.userOrgRoles.some((r: any) => r.organizationId === orgId));
      const defaultUser = orgUsers[0] || users[0];
      const assigneeIds = orgUsers.length > 0 ? orgUsers.map((u: any) => u.id) : [users[0]?.id].filter(Boolean);

      console.log(`Seeding data for Organization: "${org.name}" (ID: ${orgId}) with ${assigneeIds.length} assignees...`);

      const now = new Date();
      const todayStart = new Date(now);
      todayStart.setHours(9, 0, 0, 0);

      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);

      const twoDaysAgo = new Date(now);
      twoDaysAgo.setDate(now.getDate() - 2);

      const fiveDaysAgo = new Date(now);
      fiveDaysAgo.setDate(now.getDate() - 5);

      const tomorrow = new Date(now);
      tomorrow.setDate(now.getDate() + 1);

      const dayAfterTomorrow = new Date(now);
      dayAfterTomorrow.setDate(now.getDate() + 2);

      // Leads across all pipeline stages
      const sampleLeads: any[] = [
        // --- NEW LEADS (Today Assigned) ---
        {
          name: 'Aarav Sharma',
          company: 'Aarav Tech Solutions Pvt Ltd',
          email: 'aarav@aaravtech.in',
          phone: '9820112233',
          source: 'Website',
          serviceInterested: 'Private Limited Incorporation',
          priority: 'urgent',
          status: 'New',
          expectedValue: 35000,
          notes: 'Looking to incorporate tech startup within 7 days. Need digital signature and PAN/TAN expedited.',
          createdAt: todayStart
        },
        {
          name: 'Priya Nair',
          company: 'Kochi Organic Spices',
          email: 'priya@kochispices.com',
          phone: '9847123456',
          source: 'Google Ads',
          serviceInterested: 'FSSAI Food License',
          priority: 'high',
          status: 'New',
          expectedValue: 18000,
          notes: 'Exporting organic condiments to Middle East. Urgent requirement for central FSSAI license.',
          createdAt: todayStart
        },
        {
          name: 'Vikram Mehta',
          company: 'Mehta Logistics & Warehousing',
          email: 'vikram@mehtalogistics.in',
          phone: '9819876543',
          source: 'WhatsApp Inquiry',
          serviceInterested: 'GST Registration & Filing',
          priority: 'medium',
          status: 'New',
          expectedValue: 15000,
          notes: 'New warehouse opened in Bhiwandi. Needs GST registration for additional place of business.',
          createdAt: todayStart
        },
        {
          name: 'Sneha Patel',
          company: 'Aura Skin Care Clinics',
          email: 'sneha@auraclinic.co.in',
          phone: '9723456789',
          source: 'Instagram Ads',
          serviceInterested: 'Trademark Registration',
          priority: 'high',
          status: 'New',
          expectedValue: 12500,
          notes: 'Wants to protect brand name and cosmetics logo across Class 3 and Class 44.',
          createdAt: todayStart
        },

        // --- OPEN PIPELINE LEADS ---
        {
          name: 'Rohan Deshmukh',
          company: 'Deshmukh Agro Engineering',
          email: 'rohan@deshmukhagro.com',
          phone: '9890123456',
          source: 'Referral',
          serviceInterested: 'Business Loan',
          priority: 'urgent',
          status: 'Open',
          expectedValue: 250000,
          notes: 'Machinery expansion loan worth 50 Lakhs. Submitted 3 years ITR and GST returns for review.',
          createdAt: yesterday
        },
        {
          name: 'Ananya Roy',
          company: 'Roy Digital Studios',
          email: 'ananya@roystudios.com',
          phone: '9830987654',
          source: 'Website',
          serviceInterested: 'Startup India Seed Fund Consulting',
          priority: 'high',
          status: 'Open',
          expectedValue: 60000,
          notes: 'Pitch deck ready. Meeting scheduled for grant application and DPR preparation.',
          createdAt: twoDaysAgo
        },
        {
          name: 'Amitabh Verma',
          company: 'Verma Polymers & Packaging',
          email: 'amitabh@vermapolymers.com',
          phone: '9910011223',
          source: 'Direct Call',
          serviceInterested: 'ISO 9001 Certification',
          priority: 'medium',
          status: 'Open',
          expectedValue: 45000,
          notes: 'Factory audit scheduled for next month. Needs documentation & ISO certification.',
          createdAt: fiveDaysAgo
        },
        {
          name: 'Kavita Joshi',
          company: 'Joshi Handicrafts Export House',
          email: 'kavita@joshihandicrafts.com',
          phone: '9414012345',
          source: 'Google Ads',
          serviceInterested: 'Import Export Code (IEC)',
          priority: 'medium',
          status: 'Open',
          expectedValue: 8500,
          notes: 'IEC code issuance needed for handicraft consignments to Germany.',
          createdAt: twoDaysAgo
        },

        // --- FOLLOW-UP LEADS ---
        {
          name: 'Siddharth Rao',
          company: 'Rao Fintech Innovations',
          email: 'siddharth@raofintech.io',
          phone: '9845112244',
          source: 'Website',
          serviceInterested: 'Private Limited Incorporation',
          priority: 'urgent',
          status: 'Follow-up',
          expectedValue: 48000,
          nextFollowUp: todayStart,
          notes: 'Shared customized proposal with MCA filing fees. Client asked for a call today at 3:30 PM to finalize.',
          createdAt: fiveDaysAgo
        },
        {
          name: 'Meera Iyer',
          company: 'Iyer Educational Academy',
          email: 'meera@iyeracademy.edu',
          phone: '9444012399',
          source: 'Referral',
          serviceInterested: 'Trademark Registration',
          priority: 'high',
          status: 'Follow-up',
          expectedValue: 22000,
          nextFollowUp: tomorrow,
          notes: 'Trademark search report completed and sent. Follow-up to receive signed authorization form.',
          createdAt: twoDaysAgo
        },
        {
          name: 'Gaurav Singhal',
          company: 'Singhal Steel Traders',
          email: 'gaurav@singhalsteel.com',
          phone: '9811223344',
          source: 'Direct Call',
          serviceInterested: 'Corporate Tax Audit',
          priority: 'medium',
          status: 'Follow-up',
          expectedValue: 75000,
          nextFollowUp: dayAfterTomorrow,
          notes: 'Sent formal quotation for annual statutory audit and tax compliance. Follow-up after board approval.',
          createdAt: fiveDaysAgo
        },
        {
          name: 'Neha Chawla',
          company: 'GreenLeaf Herbal Foods',
          email: 'neha@greenleaffoods.in',
          phone: '9872123456',
          source: 'Instagram Ads',
          serviceInterested: 'FSSAI Food License',
          priority: 'high',
          status: 'Follow-up',
          expectedValue: 28000,
          nextFollowUp: todayStart,
          notes: 'Follow-up on WhatsApp regarding premises plan and water test report.',
          createdAt: yesterday
        },

        // --- CONVERTED LEADS ---
        {
          name: 'Karan Kapoor',
          company: 'Kapoor Gems & Luxury Retail',
          email: 'karan@kapoorgems.com',
          phone: '9821098765',
          source: 'Referral',
          serviceInterested: 'Private Limited Incorporation',
          priority: 'urgent',
          status: 'Converted',
          expectedValue: 55000,
          convertedAt: yesterday,
          notes: 'Payment confirmed and quotation accepted. Company successfully incorporated (CIN received).',
          createdAt: fiveDaysAgo
        },
        {
          name: 'Pooja Hegde',
          company: 'AeroGlide Drones Pvt Ltd',
          email: 'pooja@aeroglide.in',
          phone: '9740112233',
          source: 'Google Ads',
          serviceInterested: 'Startup India Seed Fund Consulting',
          priority: 'high',
          status: 'Converted',
          convertedAt: todayStart,
          notes: 'Govt grant eligibility approved. Onboarded as retainership client with invoice paid.',
          createdAt: fiveDaysAgo
        },

        // --- LOST LEADS ---
        {
          name: 'Deepak Reddy',
          company: 'Reddy Constructions & Infra',
          email: 'deepak@reddyinfra.co',
          phone: '9849012345',
          source: 'Facebook Ads',
          serviceInterested: 'Business Loan',
          priority: 'low',
          status: 'Lost',
          expectedValue: 120000,
          lostReason: 'Price',
          lostNotes: 'Client opted for local CA offering low-budget manual processing.',
          createdAt: fiveDaysAgo
        },
        {
          name: 'Tarun Bansal',
          company: 'Bansal Textiles Surat',
          email: 'tarun@bansaltextiles.in',
          phone: '9825012399',
          source: 'Google Ads',
          serviceInterested: 'GST Registration & Filing',
          priority: 'medium',
          status: 'Lost',
          lostReason: 'No Response',
          lostNotes: 'Unreachable across 5 call attempts and 3 WhatsApp outreach messages.',
          createdAt: fiveDaysAgo
        }
      ];

      for (let i = 0; i < sampleLeads.length; i++) {
        const item = sampleLeads[i];
        const assignedUserId = assigneeIds[i % assigneeIds.length] || defaultUser?.id;
        const leadCode = `LD-${10100 + i}`;

        let leadDoc: any = await Lead.findOne({ organizationId: orgId, phone: item.phone, isDeleted: false });
        if (!leadDoc) {
          leadDoc = await Lead.create({
            organizationId: orgId,
            leadId: leadCode,
            name: item.name,
            company: item.company,
            email: item.email,
            phone: item.phone,
            whatsApp: item.phone,
            source: item.source,
            serviceInterested: item.serviceInterested,
            priority: item.priority,
            status: item.status,
            assignedTo: assignedUserId,
            expectedValue: item.expectedValue,
            nextFollowUp: item.nextFollowUp || undefined,
            convertedAt: item.convertedAt || undefined,
            convertedBy: item.convertedAt ? assignedUserId : undefined,
            lostReason: item.lostReason || undefined,
            lostNotes: item.lostNotes || undefined,
            notes: item.notes,
            tags: [item.serviceInterested.replace(/\s+/g, '_'), 'Test_Sample'],
            createdAt: item.createdAt,
            updatedAt: item.createdAt
          });
        }

        if (leadDoc) {
          const leadIdStr = (leadDoc._id || leadDoc.id).toString();

          // AssignmentLog for today leads
          if (item.createdAt === todayStart || item.status === 'New') {
            await AssignmentLog.create({
              organizationId: orgId,
              leadId: leadIdStr,
              fromUserId: defaultUser?.id,
              toUserId: assignedUserId,
              reason: 'Auto-distribution: Round Robin rule',
              createdAt: item.createdAt
            });
          }

          // Activity Timeline
          await Activity.create({
            organizationId: orgId,
            leadId: leadIdStr,
            userId: assignedUserId,
            type: item.status === 'Converted' ? 'conversion' : item.status === 'Follow-up' ? 'followup_scheduled' : 'status_change',
            content: `Lead initialized in "${item.status}" stage for ${item.serviceInterested}.`,
            metadata: { status: item.status, priority: item.priority },
            createdAt: item.createdAt
          });

          // FollowUp Entry
          if (item.status === 'Follow-up' || item.nextFollowUp) {
            await FollowUp.create({
              organizationId: orgId,
              leadId: leadIdStr,
              assignedTo: assignedUserId,
              date: item.nextFollowUp || todayStart,
              time: '03:30 PM',
              type: i % 2 === 0 ? 'call' : 'whatsapp',
              channel: i % 2 === 0 ? 'phone' : 'whatsapp',
              notes: `Follow-up to finalize proposal and terms for ${item.serviceInterested}.`,
              status: 'pending',
              createdAt: item.createdAt
            });
          }

          // Converted Account Creation
          if (item.status === 'Converted') {
            let customerDoc: any = await Customer.findOne({ organizationId: orgId, phone: item.phone, isDeleted: false });
            if (!customerDoc) {
              customerDoc = await Customer.create({
                organizationId: orgId,
                customerId: `CS-${10200 + i}`,
                name: item.name,
                companyName: item.company,
                email: item.email,
                phone: item.phone,
                whatsApp: item.phone,
                gstin: `27AAACK${1234 + i}M1Z5`,
                pan: `AAACK${1234 + i}M`,
                outstandingBalance: 0,
                notes: `Converted from lead ${leadCode}.`,
                createdAt: item.createdAt
              });

              await Contact.create({
                organizationId: orgId,
                customerId: customerDoc._id || customerDoc.id,
                firstName: item.name.split(' ')[0],
                lastName: item.name.split(' ')[1] || 'Director',
                email: item.email,
                phone: item.phone,
                role: 'Managing Director',
                isPrimary: true,
                createdAt: item.createdAt
              });
            }

            if (customerDoc) {
              const custIdStr = (customerDoc._id || customerDoc.id).toString();
              const quoteVal = item.expectedValue || 30000;
              const itemsList = [
                {
                  name: item.serviceInterested,
                  description: `Professional consulting & execution for ${item.serviceInterested}`,
                  quantity: 1,
                  rate: quoteVal,
                  gstRate: 18
                }
              ];

              const calculated = calculateQuotationTotals(itemsList as any);

              let quote: any = await Quotation.findOne({ organizationId: orgId, leadId: leadIdStr, isDeleted: false });
              if (!quote) {
                const quoteCount = await Quotation.countDocuments({ organizationId: orgId });
                const quotationCode = `QT-${10001 + quoteCount + i}`;
                quote = await Quotation.create({
                  organizationId: orgId,
                  quotationId: quotationCode,
                  leadId: leadIdStr,
                  customerId: custIdStr,
                  createdBy: assignedUserId,
                  assignedTo: assignedUserId,
                  notes: `Proposal for ${item.serviceInterested}`,
                  status: 'accepted',
                  items: calculated.items,
                  subtotal: calculated.subtotal,
                  totalDiscount: calculated.totalDiscount,
                  taxTotal: calculated.taxTotal,
                  totalAmount: calculated.totalAmount,
                  validUntil: new Date(Date.now() + 30 * 86400000),
                  termsAndConditions: '100% advance on project kickoff.',
                  createdAt: item.createdAt
                });
              }

              let inv: any = await Invoice.findOne({ organizationId: orgId, leadId: leadIdStr, isDeleted: false });
              if (!inv && quote) {
                const invCount = await Invoice.countDocuments({ organizationId: orgId });
                const invoiceCode = `INV-${10001 + invCount + i}`;
                await Invoice.create({
                  organizationId: orgId,
                  invoiceId: invoiceCode,
                  quotationId: quote._id || quote.id,
                  customerId: custIdStr,
                  leadId: leadIdStr,
                  status: 'paid',
                  items: calculated.items,
                  subtotal: calculated.subtotal,
                  taxTotal: calculated.taxTotal,
                  totalAmount: calculated.totalAmount,
                  amountPaid: calculated.totalAmount,
                  outstandingBalance: 0,
                  dueDate: new Date(Date.now() + 15 * 86400000),
                  notes: 'Payment confirmed via Bank Transfer (IMPS/NEFT).',
                  createdAt: item.createdAt
                });
              }

              if (quote) {
                leadDoc.convertedQuotationId = quote._id || quote.id;
                if (leadDoc.save) await leadDoc.save();
              }
            }
          }
        }
      }

      console.log(`Successfully seeded sample leads and records for org ${org.name}.`);
    }

    console.log('--- SEEDING COMPLETED SUCCESSFULLY ---');
    process.exit(0);
  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  }
}

seedRealisticData();
