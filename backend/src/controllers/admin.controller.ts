import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../config/prisma';
import { saasService } from '../services/saas.service';
import { Plan } from '../models/Plan';
import { Subscription } from '../models/Subscription';
import { Organization } from '../models/Organization';
import { Payment } from '../models/Payment';
import { SaaSAuditLog } from '../models/SaaSAuditLog';
import { WebhookLog } from '../models/WebhookLog';
import { UserOrganizationRole } from '../models/UserOrganizationRole';
import { User } from '../models/User';
import { Role } from '../models/Role';
import { Pipeline } from '../models/Pipeline';
import { tenantSchemaService } from '../services/tenantSchema.service';

export async function getAdminOverview(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = await saasService.getPlatformOverview();
    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function getAdminPlans(_req: Request, res: Response, next: NextFunction) {
  try {
    const plans = await saasService.getAllPlans();
    return res.json({ success: true, data: plans });
  } catch (error) {
    next(error);
  }
}

export async function createAdminPlan(req: Request, res: Response, next: NextFunction) {
  try {
    const plan = await saasService.createPlan(req.body, req.user);
    return res.status(201).json({
      success: true,
      message: `Plan "${plan.name}" created successfully.`,
      data: plan
    });
  } catch (error) {
    next(error);
  }
}

export async function updateAdminPlan(req: Request, res: Response, next: NextFunction) {
  try {
    const plan = await saasService.updatePlan(req.params.id, req.body, req.user);
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Plan not found.' });
    }
    return res.json({
      success: true,
      message: `Plan "${plan.name}" updated successfully.`,
      data: plan
    });
  } catch (error) {
    next(error);
  }
}

export async function toggleAdminPlan(req: Request, res: Response, next: NextFunction) {
  try {
    const plan = await saasService.togglePlanStatus(req.params.id, req.user);
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Plan not found.' });
    }
    return res.json({
      success: true,
      message: `Plan "${plan.name}" status updated to ${plan.isActive ? 'Active' : 'Inactive'}.`,
      data: plan
    });
  } catch (error) {
    next(error);
  }
}

export async function getAdminSubscriptions(req: Request, res: Response, next: NextFunction) {
  try {
    const { status, search } = req.query;
    const query: any = {};
    if (status && status !== 'all') {
      query.status = status;
    }

    let subscriptions = await Subscription.find(query)
      .populate('organizationId', 'name email phone isSuspended')
      .populate('planId')
      .sort({ updatedAt: -1 });

    if (search && typeof search === 'string' && search.trim()) {
      const q = search.toLowerCase();
      subscriptions = subscriptions.filter((s: any) => 
        s.organizationId?.name?.toLowerCase().includes(q) || 
        s.organizationId?.email?.toLowerCase().includes(q) ||
        s.planName?.toLowerCase().includes(q)
      );
    }

    return res.json({ success: true, data: subscriptions });
  } catch (error) {
    next(error);
  }
}

export async function manualAssignAdminSubscription(req: Request, res: Response, next: NextFunction) {
  try {
    const sub = await saasService.manualAssignSubscription({
      ...req.body,
      adminUser: req.user
    });
    return res.json({
      success: true,
      message: 'Subscription successfully assigned to organization.',
      data: sub
    });
  } catch (error) {
    next(error);
  }
}

export async function extendAdminSubscription(req: Request, res: Response, next: NextFunction) {
  try {
    const sub = await saasService.extendSubscription({
      subscriptionId: req.params.id,
      extendDays: req.body.extendDays ? Number(req.body.extendDays) : undefined,
      customEndDate: req.body.customEndDate ? new Date(req.body.customEndDate) : undefined,
      adminUser: req.user,
      reason: req.body.reason
    });
    return res.json({
      success: true,
      message: `Subscription expiry extended to ${sub.endDate.toLocaleDateString()}.`,
      data: sub
    });
  } catch (error) {
    next(error);
  }
}

export async function changeAdminSubscriptionPlan(req: Request, res: Response, next: NextFunction) {
  try {
    const sub = await saasService.changeSubscriptionPlan({
      subscriptionId: req.params.id,
      newPlanId: req.body.newPlanId,
      effective: req.body.effective || 'immediate',
      adminUser: req.user,
      reason: req.body.reason
    });
    return res.json({
      success: true,
      message: 'Subscription plan change executed successfully.',
      data: sub
    });
  } catch (error) {
    next(error);
  }
}

export async function suspendAdminSubscription(req: Request, res: Response, next: NextFunction) {
  try {
    const sub = await saasService.suspendSubscription(req.params.id, req.body.reason, req.user);
    return res.json({
      success: true,
      message: 'Subscription and organization successfully suspended.',
      data: sub
    });
  } catch (error) {
    next(error);
  }
}

export async function activateAdminSubscription(req: Request, res: Response, next: NextFunction) {
  try {
    const sub = await saasService.reactivateSubscription(req.params.id, req.user);
    return res.json({
      success: true,
      message: 'Subscription and organization reactivated successfully.',
      data: sub
    });
  } catch (error) {
    next(error);
  }
}

export async function cancelAdminSubscription(req: Request, res: Response, next: NextFunction) {
  try {
    const sub = await saasService.cancelSubscription(
      req.params.id, 
      req.body.cancelImmediately ?? true, 
      req.user
    );
    return res.json({
      success: true,
      message: 'Subscription cancelled successfully.',
      data: sub
    });
  } catch (error) {
    next(error);
  }
}

export async function createAdminCustomSubscription(req: Request, res: Response, next: NextFunction) {
  try {
    const sub = await saasService.createCustomSubscription({
      ...req.body,
      adminUser: req.user
    });
    return res.status(201).json({
      success: true,
      message: 'Custom customer subscription created and activated successfully.',
      data: sub
    });
  } catch (error) {
    next(error);
  }
}

export async function getAdminOrganizations(_req: Request, res: Response, next: NextFunction) {
  try {
    const orgs = await Organization.find().sort({ createdAt: -1 });
    
    // Attach member count and subscription for each org
    const orgsWithDetails = await Promise.all(
      orgs.map(async (org) => {
        const [userCount, sub] = await Promise.all([
          UserOrganizationRole.countDocuments({ organizationId: org._id }),
          Subscription.findOne({ organizationId: org._id }).populate('planId')
        ]);
        return {
          ...org.toObject(),
          userCount,
          subscription: sub
        };
      })
    );

    return res.json({ success: true, data: orgsWithDetails });
  } catch (error) {
    next(error);
  }
}

export async function createAdminOrganization(req: Request, res: Response, next: NextFunction) {
  try {
    const {
      name,
      businessType = 'general',
      phone,
      email,
      website,
      adminFirstName,
      adminLastName,
      adminEmail,
      adminPassword,
      planId
    } = req.body;

    if (!name || !adminFirstName || !adminLastName || !adminEmail || !adminPassword) {
      return res.status(400).json({
        success: false,
        message: 'Organization name, admin first name, last name, admin email, and admin password are required.',
        errorCode: 'MISSING_FIELDS'
      });
    }

    const cleanEmail = adminEmail.trim().toLowerCase();
    const cleanOrgEmail = (email || cleanEmail).trim().toLowerCase();

    // 1. Create Organization in Central Database
    const org = await Organization.create({
      name: name.trim(),
      businessType,
      phone: phone || '9999999999',
      email: cleanOrgEmail,
      website: website || '',
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      isSuspended: false
    });

    const orgId = org._id ? org._id.toString() : (org as any).id;

    // 2. Provision dedicated PostgreSQL Tenant Schema
    try {
      await tenantSchemaService.createTenantSchema(orgId);
    } catch (schemaErr) {
      // Continue if schema provision fallback
    }

    // 3. Find or Create the Organization Admin User
    let adminUser: any = await User.findOne({ email: cleanEmail });
    if (!adminUser) {
      const passwordHash = await bcrypt.hash(adminPassword, 10);
      adminUser = await User.create({
        email: cleanEmail,
        passwordHash,
        firstName: adminFirstName.trim(),
        lastName: adminLastName.trim(),
        isVerified: true,
        status: 'active'
      });
    }

    // 4. Map User as Organization Admin
    let adminRole: any = await Role.findOne({ name: 'Admin', organizationId: null });
    if (!adminRole) {
      adminRole = await Role.findOne({ name: 'Super Admin', organizationId: null });
    }

    await UserOrganizationRole.create({
      userId: adminUser._id || adminUser.id,
      organizationId: orgId,
      roleId: adminRole ? (adminRole._id || adminRole.id) : null
    });

    // 5. Seed default General Sales Pipeline for the new organization
    await Pipeline.create({
      organizationId: orgId,
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

    // 6. Assign Subscription
    let selectedPlan: any = null;
    if (planId) {
      selectedPlan = await Plan.findById(planId);
    }
    if (!selectedPlan) {
      selectedPlan = (await Plan.findOne({ isDefault: true })) || (await Plan.findOne());
    }

    const startDate = new Date();
    const durationDays = selectedPlan?.duration || 30;
    const endDate = new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000);

    const subscription = await Subscription.create({
      organizationId: orgId,
      planId: selectedPlan ? (selectedPlan._id || selectedPlan.id) : null,
      planName: selectedPlan?.name || 'Starter',
      status: 'active',
      startDate,
      endDate,
      userSeatsLimit: selectedPlan?.maxUsers || 10,
      invoicesCountLimit: 1000,
      paymentStatus: 'complimentary',
      paymentProvider: 'manual'
    });

    // 7. Audit Log
    const reqUser = req.user as any;
    await SaaSAuditLog.create({
      adminId: reqUser?.id || reqUser?._id,
      adminEmail: reqUser?.email || 'admin@arthaventure.com',
      adminName: `${reqUser?.firstName || 'Admin'} ${reqUser?.lastName || ''}`.trim(),
      organizationId: orgId,
      organizationName: org.name,
      action: 'ORGANIZATION_CREATED',
      newValue: {
        organization: org,
        adminUser: { id: adminUser._id, email: cleanEmail },
        subscription
      },
      reason: `Super Admin provisioned organization "${org.name}" with plan "${selectedPlan?.name || 'Starter'}"`
    });

    return res.status(201).json({
      success: true,
      message: `Organization "${org.name}" provisioned successfully with dedicated tenant workspace.`,
      data: {
        organization: org,
        adminEmail: cleanEmail,
        subscription
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteAdminOrganization(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const org = await Organization.findById(id);
    if (!org) {
      return res.status(404).json({ success: false, message: 'Organization not found.' });
    }

    // Protect PCS / Primary Org
    if (org.name === 'PCS') {
      return res.status(400).json({
        success: false,
        message: 'The default platform root organization cannot be deleted.',
        errorCode: 'ROOT_ORG_PROTECTED'
      });
    }

    // 1. Drop schema if exists
    try {
      const schemaName = tenantSchemaService.getSchemaName(id);
      await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE;`);
    } catch (e) {}

    // 2. Remove subscriptions and payments
    await Subscription.deleteMany({ organizationId: id });
    await Payment.deleteMany({ organizationId: id });
    await UserOrganizationRole.deleteMany({ organizationId: id });

    // 3. Remove Organization record
    await Organization.findByIdAndDelete(id);

    // 4. Audit Log
    const reqUser = req.user as any;
    await SaaSAuditLog.create({
      adminId: reqUser?.id || reqUser?._id,
      adminEmail: reqUser?.email || 'admin@arthaventure.com',
      adminName: `${reqUser?.firstName || 'Admin'} ${reqUser?.lastName || ''}`.trim(),
      organizationId: id,
      organizationName: org.name,
      action: 'ORGANIZATION_DELETED',
      reason: req.body.reason || 'Super Admin deleted organization and tenant workspace'
    });

    return res.json({
      success: true,
      message: `Organization "${org.name}" and all associated tenant workspace data have been deleted.`
    });
  } catch (error) {
    next(error);
  }
}

export async function toggleAdminOrganizationSuspension(req: Request, res: Response, next: NextFunction) {
  try {
    const org = await Organization.findById(req.params.id);
    if (!org) return res.status(404).json({ success: false, message: 'Organization not found' });

    org.isSuspended = !org.isSuspended;
    org.suspendedAt = org.isSuspended ? new Date() : null;
    await org.save();

    // Also update subscription status accordingly
    if (org.isSuspended) {
      await Subscription.findOneAndUpdate(
        { organizationId: org._id },
        { status: 'suspended', suspendedAt: new Date(), suspensionReason: req.body.reason || 'Admin suspended organization' }
      );
    } else {
      await Subscription.findOneAndUpdate(
        { organizationId: org._id },
        { status: 'active', suspendedAt: null, suspensionReason: null }
      );
    }

    const user = req.user as any;
    await SaaSAuditLog.create({
      adminId: user?.id || user?._id,
      adminEmail: user?.email || 'admin@arthaventure.com',
      adminName: `${user?.firstName || 'Admin'} ${user?.lastName || ''}`.trim(),
      organizationId: org._id,
      organizationName: org.name,
      action: org.isSuspended ? 'ORGANIZATION_SUSPENDED' : 'ORGANIZATION_ACTIVATED',
      reason: req.body.reason || 'Toggled by administrator'
    });

    return res.json({
      success: true,
      message: `Organization "${org.name}" is now ${org.isSuspended ? 'Suspended' : 'Active'}.`,
      data: org
    });
  } catch (error) {
    next(error);
  }
}

export async function getAdminPayments(_req: Request, res: Response, next: NextFunction) {
  try {
    const payments = await Payment.find()
      .populate('organizationId', 'name email phone')
      .populate('planId', 'name')
      .sort({ createdAt: -1 });

    return res.json({ success: true, data: payments });
  } catch (error) {
    next(error);
  }
}

export async function verifyAndActivateAdminPayment(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const payment = await Payment.findById(id);
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment record not found.' });
    }

    const orgId = payment.organizationId ? String((payment.organizationId as any)._id || (payment.organizationId as any).id || payment.organizationId) : null;
    if (!orgId) {
      return res.status(400).json({ success: false, message: 'Payment has no associated organization.' });
    }

    const adminUser = req.user as any;
    let activatedSub: any = null;

    // Check if it's a plan subscription or seat add-on
    if (payment.planId) {
      const planId = String((payment.planId as any)._id || (payment.planId as any).id || payment.planId);
      
      let extraSeats = 0;
      const match = payment.notes?.match(/\+(\d+)\s+Extra\s+Seats/i);
      if (match) {
        extraSeats = parseInt(match[1], 10) || 0;
      }

      const result = await saasService.activateOrRenewSubscription({
        organizationId: orgId,
        planId,
        extraSeats,
        paymentId: payment.paymentId || `PAY-${payment._id}`,
        provider: 'upi_qr',
        paymentMethod: 'upi_qr',
        adminUser
      });
      activatedSub = result.subscription;
    } else if (payment.notes && /seat\s+add-on/i.test(payment.notes)) {
      let extraSeats = 1;
      const match = payment.notes.match(/\+(\d+)\s+Extra\s+Seat/i);
      if (match) {
        extraSeats = parseInt(match[1], 10) || 1;
      }

      const result = await saasService.addExtraSeatsToSubscription({
        organizationId: orgId,
        extraSeats,
        paymentId: payment.paymentId || `SEAT-${payment._id}`,
        provider: 'upi_qr',
        paymentMethod: 'upi_qr',
        adminUser
      });
      activatedSub = result.subscription;
    } else {
      const sub = await Subscription.findOne({ organizationId: orgId });
      if (sub) {
        sub.status = 'active';
        sub.paymentStatus = 'paid';
        if (sub.save) await sub.save();
        activatedSub = sub;
      }
    }

    // Mark payment status as 'captured' (verified)
    payment.status = 'captured';
    payment.paidAt = new Date();
    if (payment.save) await payment.save();

    const org = await Organization.findById(orgId);
    await SaaSAuditLog.create({
      adminId: adminUser?.id || adminUser?._id,
      adminEmail: adminUser?.email || 'admin@arthaventure.com',
      adminName: `${adminUser?.firstName || 'Super'} ${adminUser?.lastName || 'Admin'}`.trim(),
      organizationId: orgId,
      organizationName: org?.name,
      action: 'PAYMENT_VERIFIED_AND_SUBSCRIPTION_ACTIVATED',
      newValue: {
        paymentId: payment._id,
        amount: payment.amount,
        status: 'captured',
        utr: payment.paymentId,
        subscriptionId: activatedSub?._id
      },
      reason: `Super Admin verified UPI payment (UTR: ${payment.paymentId}) for ₹${payment.amount} and activated subscription.`
    });

    return res.json({
      success: true,
      message: `Payment verified! Subscription for "${org?.name || 'Organization'}" is now active.`,
      data: {
        payment,
        subscription: activatedSub
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function rejectAdminPayment(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { reason = 'Invalid or unverified transaction reference' } = req.body;

    const payment = await Payment.findById(id);
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment record not found.' });
    }

    payment.status = 'failed';
    payment.notes = `${payment.notes || ''} [Rejected by Super Admin: ${reason}]`;
    if (payment.save) await payment.save();

    const orgId = payment.organizationId ? String((payment.organizationId as any)._id || (payment.organizationId as any).id || payment.organizationId) : null;
    if (orgId) {
      await Subscription.findOneAndUpdate(
        { organizationId: orgId },
        { $set: { paymentStatus: 'failed', notes: `Payment rejected by Super Admin: ${reason}` } }
      );
    }

    const adminUser = req.user as any;
    const org = orgId ? await Organization.findById(orgId) : null;
    await SaaSAuditLog.create({
      adminId: adminUser?.id || adminUser?._id,
      adminEmail: adminUser?.email || 'admin@arthaventure.com',
      adminName: `${adminUser?.firstName || 'Super'} ${adminUser?.lastName || 'Admin'}`.trim(),
      organizationId: orgId || undefined,
      organizationName: org?.name,
      action: 'PAYMENT_REJECTED',
      newValue: {
        paymentId: payment._id,
        amount: payment.amount,
        status: 'failed',
        reason
      },
      reason: `Super Admin rejected UPI payment (UTR: ${payment.paymentId}): ${reason}`
    });

    return res.json({
      success: true,
      message: 'Payment rejected successfully.',
      data: payment
    });
  } catch (error) {
    next(error);
  }
}

export async function getAdminAuditLogs(_req: Request, res: Response, next: NextFunction) {
  try {
    const logs = await SaaSAuditLog.find().sort({ createdAt: -1 }).limit(100);
    return res.json({ success: true, data: logs });
  } catch (error) {
    next(error);
  }
}

export async function getAdminIntegrations(_req: Request, res: Response, next: NextFunction) {
  try {
    let totalJustDialWebhooks = 0;
    let totalIndiaMARTWebhooks = 0;
    let failedWebhooks = 0;
    let recentLogs: any[] = [];

    try {
      totalJustDialWebhooks = await WebhookLog.countDocuments({ provider: 'justdial' });
      totalIndiaMARTWebhooks = await WebhookLog.countDocuments({ provider: 'indiamart' });
      failedWebhooks = await WebhookLog.countDocuments({ status: 'failed' });
      recentLogs = await WebhookLog.find().sort({ createdAt: -1 }).limit(15).exec();
    } catch (_err) {
      // Graceful fallback if empty
    }

    const appUrl = process.env.APP_URL || 'http://localhost:5000';

    const integrations = {
      gateways: [
        {
          id: 'upi_qr',
          name: 'Direct UPI Payment Scanner',
          category: 'Billing & Subscriptions',
          provider: 'upi_qr',
          status: 'connected',
          mode: 'live',
          keyPreview: 'Direct UPI Scanner & Super Admin Verification Active',
          description: 'Direct scanner QR code payment collection with transaction reference validation and Super Admin subscription authorization.'
        },
        {
          id: 'mailercloud',
          name: 'Transactional Email (MailerCloud / SMTP)',
          category: 'Communications',
          provider: 'MailerCloud & SMTP',
          status: process.env.SMTP_HOST ? 'connected' : 'unconfigured',
          mode: 'live',
          keyPreview: process.env.SMTP_USER || 'support@arthovista.com',
          senderAddress: process.env.SMTP_FROM || 'support@arthovista.com',
          host: process.env.SMTP_HOST || 'smtp-prod.mailrcld.com',
          port: Number(process.env.SMTP_PORT) || 587,
          description: 'High-deliverability SMTP relay for system invite emails, password resets, payment invoices, and ticket updates.'
        },
        {
          id: 'ai-engine',
          name: 'AI Intelligence Engine',
          category: 'Artificial Intelligence',
          provider: process.env.AI_PROVIDER || 'gemini',
          status: 'connected',
          mode: 'production',
          model: 'Google Gemini 1.5 Flash / Pro',
          description: 'Automated lead classification, conversational analysis, sentiment scoring, and quotation recommendation algorithms.'
        },
        {
          id: 'whatsapp-telephony',
          name: 'WhatsApp Business & VoIP Gateway',
          category: 'Omnichannel CRM',
          provider: process.env.WHATSAPP_PROVIDER || 'mock',
          status: 'connected',
          mode: process.env.WHATSAPP_PROVIDER === 'mock' ? 'sandbox' : 'live',
          description: 'Official WhatsApp Cloud API webhook receiver, automated notifications, click-to-call clickstream, and mobile sync.'
        },
        {
          id: 'storage',
          name: 'Cloud Object Storage',
          category: 'Infrastructure',
          provider: process.env.STORAGE_PROVIDER || 'local',
          status: 'connected',
          mode: process.env.STORAGE_PROVIDER === 'local' ? 'local_disk' : 's3',
          bucket: process.env.S3_BUCKET || 'artha-crm-documents',
          region: process.env.S3_REGION || 'ap-south-1',
          description: 'Secure cloud storage bucket for client GST invoices, quotations, documents, and KYC uploads.'
        }
      ],
      webhookMetrics: {
        totalJustDialEvents: totalJustDialWebhooks,
        totalIndiaMARTEvents: totalIndiaMARTWebhooks,
        totalEvents: (totalJustDialWebhooks || 0) + (totalIndiaMARTWebhooks || 0),
        failedCount: failedWebhooks,
        serverTime: new Date()
      },
      webhookEndpoints: [

        {
          id: 'ep-jd',
          name: 'JustDial Ingestion Webhook Receiver',
          endpoint: `${appUrl}/api/webhooks/justdial`,
          method: 'POST',
          events: 'lead.inquiry.created',
          status: 'active'
        },
        {
          id: 'ep-im',
          name: 'IndiaMART Push API Listener',
          endpoint: `${appUrl}/api/webhooks/indiamart`,
          method: 'POST',
          events: 'query.pushed',
          status: 'active'
        }
      ],
      recentLogs
    };

    return res.json({ success: true, data: integrations });
  } catch (error) {
    next(error);
  }
}

