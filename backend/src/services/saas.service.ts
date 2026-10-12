import { Plan, IPlan, IPlanLimits, IPlanFeatures } from '../models/Plan';
import { Subscription, ISubscription } from '../models/Subscription';
import { Organization } from '../models/Organization';
import { User } from '../models/User';
import { UserOrganizationRole } from '../models/UserOrganizationRole';
import { Lead } from '../models/Lead';
import { Contact } from '../models/Contact';
import { Campaign } from '../models/Campaign';
import { FollowUp } from '../models/FollowUp';
import { Task } from '../models/Task';
import { Invoice } from '../models/Invoice';
import { Payment } from '../models/Payment';
import { SaaSAuditLog } from '../models/SaaSAuditLog';
import { Ticket } from '../models/Ticket';
import { redisGet, redisSet, redisDel } from '../config/redis';

export class SaaSService {
  /**
   * Calculate subscription end date based on duration & unit
   */
  calculateEndDate(startDate: Date, duration: number, unit: 'days' | 'months' | 'years' | string): Date {
    const end = new Date(startDate.getTime());
    if (unit === 'days') {
      end.setDate(end.getDate() + duration);
    } else if (unit === 'months') {
      end.setMonth(end.getMonth() + duration);
    } else if (unit === 'years') {
      end.setFullYear(end.getFullYear() + duration);
    } else {
      end.setDate(end.getDate() + duration);
    }
    return end;
  }

  /**
   * Fetch all platform pricing plans
   */
  async getPlans(includeInactive: boolean = false): Promise<IPlan[]> {
    const query = includeInactive ? {} : { isActive: true };
    return Plan.find(query).sort({ sortOrder: 1, price: 1 });
  }

  async getAllPlans(): Promise<IPlan[]> {
    return this.getPlans(true);
  }

  async getPublicPlans(): Promise<IPlan[]> {
    return this.getPlans(false);
  }

  async manualAssignSubscription(params: any): Promise<ISubscription> {
    return this.assignSubscription(params);
  }

  /**
   * Create a new Pricing Plan (Admin)
   */
  async createPlan(data: Partial<IPlan>, adminUser: any): Promise<IPlan> {
    const plan = await Plan.create(data);

    // Audit Log
    await SaaSAuditLog.create({
      adminId: adminUser._id || adminUser.id,
      adminEmail: adminUser.email,
      adminName: `${adminUser.firstName || 'Admin'} ${adminUser.lastName || ''}`.trim(),
      action: 'PLAN_CREATED',
      newValue: (plan as any).toObject ? (plan as any).toObject() : plan,
      reason: `Created plan "${plan.name}" (₹${plan.price}/${plan.duration} ${plan.durationUnit})`
    });

    return plan;
  }

  /**
   * Update an existing Pricing Plan (Admin)
   */
  async updatePlan(id: string, data: Partial<IPlan>, adminUser: any): Promise<IPlan | null> {
    const oldPlan = await Plan.findById(id);
    if (!oldPlan) return null;

    const plan = await Plan.findByIdAndUpdate(id, { $set: data }, { new: true });
    if (!plan) return null;

    // Audit Log
    await SaaSAuditLog.create({
      adminId: adminUser._id || adminUser.id,
      adminEmail: adminUser.email,
      adminName: `${adminUser.firstName || 'Admin'} ${adminUser.lastName || ''}`.trim(),
      action: 'PLAN_UPDATED',
      oldValue: (oldPlan as any).toObject ? (oldPlan as any).toObject() : oldPlan,
      newValue: (plan as any).toObject ? (plan as any).toObject() : plan,
      reason: `Updated plan "${plan.name}". Note: Existing subscriptions retain their purchased terms.`
    });

    return plan;
  }

  /**
   * Toggle Plan Active status (Admin)
   */
  async togglePlanStatus(id: string, adminUser: any): Promise<IPlan | null> {
    const oldPlan = await Plan.findById(id);
    if (!oldPlan) return null;

    oldPlan.isActive = !oldPlan.isActive;
    if ((oldPlan as any).save) await (oldPlan as any).save();

    await SaaSAuditLog.create({
      adminId: adminUser._id || adminUser.id,
      adminEmail: adminUser.email,
      adminName: `${adminUser.firstName || 'Admin'} ${adminUser.lastName || ''}`.trim(),
      action: oldPlan.isActive ? 'PLAN_ACTIVATED' : 'PLAN_DEACTIVATED',
      newValue: { isActive: oldPlan.isActive },
      reason: `Plan "${oldPlan.name}" is now ${oldPlan.isActive ? 'Active for new purchases' : 'Deactivated'}`
    });

    return oldPlan;
  }

  /**
   * Get organization live resource usage
   */
  async getLiveUsage(organizationId: string): Promise<{
    users: number;
    leads: number;
    contacts: number;
    campaigns: number;
    followUps: number;
    tasks: number;
    invoices: number;
  }> {
    const orgId = String(organizationId);

    const [users, leads, contacts, campaigns, followUps, tasks, invoices] = await Promise.all([
      UserOrganizationRole.countDocuments({ organizationId: orgId }),
      Lead.countDocuments({ organizationId: orgId }),
      Contact.countDocuments({ organizationId: orgId }),
      Campaign.countDocuments({ organizationId: orgId }),
      FollowUp.countDocuments({ organizationId: orgId }),
      Task.countDocuments({ organizationId: orgId }),
      Invoice.countDocuments({ organizationId: orgId })
    ]);

    return { users, leads, contacts, campaigns, followUps, tasks, invoices };
  }

  /**
   * Fast check for subscription expiration without heavy resource counts, cached in Redis
   */
  async checkSubscriptionStatus(organizationId: string): Promise<{ isExpired: boolean; isGracePeriod: boolean }> {
    const orgId = String(organizationId);

    try {
      const cached = await redisGet(`sub_status:${orgId}`);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {}

    const sub = await Subscription.findOne({ organizationId: orgId });
    if (!sub) {
      return { isExpired: true, isGracePeriod: false };
    }

    const now = new Date();
    const isPastEndDate = now >= sub.endDate;
    const isSuspended = sub.status === 'suspended';
    const isCancelled = sub.status === 'cancelled';
    const isExpiredStatus = sub.status === 'expired' || sub.status === 'payment_required' || isCancelled || isSuspended || isPastEndDate || (sub.planName && sub.planName.includes('Subscription Required'));
    
    const result = { isExpired: !!isExpiredStatus, isGracePeriod: false };

    try {
      await redisSet(`sub_status:${orgId}`, JSON.stringify(result), 30);
    } catch {}

    return result;
  }

  /**
   * Get or initialize organization subscription with live usage metrics
   */
  async getOrganizationSubscription(organizationId: string): Promise<{
    subscription: ISubscription;
    usage: any;
    daysRemaining: number;
    isExpired: boolean;
    isGracePeriod: boolean;
  }> {
    const orgId = String(organizationId);

    let sub = await Subscription.findOne({ organizationId: orgId }).populate('planId');

    // Auto-initialize expired/payment-required subscription placeholder if none exists
    if (!sub) {
      const now = new Date();
      sub = await Subscription.create({
        organizationId: orgId,
        planName: 'None (Subscription Required)',
        status: 'expired',
        startDate: now,
        endDate: now, // immediately expired
        priceAtPurchase: 0,
        currencyAtPurchase: 'INR',
        durationAtPurchase: 0,
        durationUnitAtPurchase: 'days',
        maxUsersAtPurchase: 10,
        limitsAtPurchase: {},
        featuresAtPurchase: {},
        paymentStatus: 'pending',
        paymentProvider: 'none'
      });
    }

    if (!sub) {
      throw new Error('Failed to load or create subscription');
    }

    // Check expiry & scheduled plan change
    const now = new Date();
    const isPastEndDate = now >= sub.endDate;
    const isSuspended = sub.status === 'suspended';
    const isCancelled = sub.status === 'cancelled';
    const isExpiredStatus = sub.status === 'expired' || sub.status === 'payment_required' || isCancelled || isSuspended || isPastEndDate || sub.planName.includes('Subscription Required');
    const isGracePeriod = false;

    if (isExpiredStatus && sub.status === 'active') {
      sub.status = 'expired';
      if ((sub as any).save) await (sub as any).save();
    }

    // Check if scheduled plan change reached effective date
    const scheduledChange = sub.scheduledPlanChange as any;
    if (scheduledChange && scheduledChange.effectiveDate && now >= new Date(scheduledChange.effectiveDate)) {
      const targetPlan = await Plan.findById(scheduledChange.planId);
      if (targetPlan) {
        sub.planId = targetPlan._id as any;
        sub.planName = targetPlan.name;
        sub.priceAtPurchase = targetPlan.price;
        sub.currencyAtPurchase = targetPlan.currency;
        sub.durationAtPurchase = targetPlan.duration;
        sub.durationUnitAtPurchase = targetPlan.durationUnit;
        sub.maxUsersAtPurchase = targetPlan.maxUsers;
        sub.limitsAtPurchase = targetPlan.limits;
        sub.featuresAtPurchase = targetPlan.features;
        sub.startDate = now;
        sub.endDate = this.calculateEndDate(now, targetPlan.duration, targetPlan.durationUnit);
        sub.status = 'active';
        sub.scheduledPlanChange = null as any;
        if ((sub as any).save) await (sub as any).save();
      }
    }

    const diffMs = sub.endDate.getTime() - now.getTime();
    const daysRemaining = (isSuspended || isCancelled || isExpiredStatus) ? 0 : Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

    const usage = await this.getLiveUsage(orgId);

    return {
      subscription: sub,
      usage,
      daysRemaining,
      isExpired: isExpiredStatus,
      isGracePeriod
    };
  }

  /**
   * Activate or Renew Subscription upon verified payment (Supports base seats + optional extra seats at ₹500/seat)
   */
  async activateOrRenewSubscription(params: {
    organizationId: string;
    planId: string;
    extraSeats?: number;
    paymentId?: string;
    orderId?: string;
    provider?: 'upi_qr' | 'manual' | string;
    paymentMethod?: string;
    autoRenew?: boolean;
    adminUser?: any;
  }): Promise<{ subscription: ISubscription; payment?: any }> {
    const orgId = String(params.organizationId);
    const plan = await Plan.findById(params.planId);
    if (!plan) {
      throw new Error('Selected plan does not exist.');
    }

    const extraSeats = Math.max(0, Number(params.extraSeats) || 0);
    const extraSeatsCost = extraSeats * 500;
    const totalPrice = plan.price + extraSeatsCost;
    const totalSeats = (plan.maxUsers || 10) + extraSeats;

    const currentSub = await Subscription.findOne({ organizationId: orgId });
    const now = new Date();
    let startDate = now;
    let endDate = this.calculateEndDate(startDate, plan.duration, plan.durationUnit);

    // If currently active and renewing before expiry, stack duration on top of current endDate
    if (currentSub && currentSub.status === 'active' && currentSub.endDate > now && currentSub.planName === plan.name) {
      startDate = currentSub.startDate;
      endDate = this.calculateEndDate(currentSub.endDate, plan.duration, plan.durationUnit);
    }

    const updatedSub = await Subscription.findOneAndUpdate(
      { organizationId: orgId },
      {
        $set: {
          planId: plan._id,
          planName: plan.name,
          status: 'active',
          startDate,
          endDate,
          priceAtPurchase: totalPrice,
          currencyAtPurchase: plan.currency,
          durationAtPurchase: plan.duration,
          durationUnitAtPurchase: plan.durationUnit,
          maxUsersAtPurchase: totalSeats,
          userSeatsLimit: totalSeats,
          limitsAtPurchase: plan.limits,
          featuresAtPurchase: plan.features,
          autoRenew: params.autoRenew ?? false,
          paymentStatus: 'paid',
          paymentProvider: params.provider || 'upi_qr',
          providerPaymentId: params.paymentId,
          providerOrderId: params.orderId,
          canceledAt: null,
          suspendedAt: null,
          suspensionReason: null
        }
      },
      { new: true, upsert: true }
    );

    // Create Payment Record
    let paymentDoc: any;
    if (totalPrice > 0 && params.paymentId) {
      paymentDoc = await Payment.create({
        organizationId: orgId,
        subscriptionId: updatedSub._id,
        planId: plan._id,
        provider: params.provider || 'upi_qr',
        paymentId: params.paymentId,
        orderId: params.orderId,
        amount: totalPrice,
        currency: plan.currency,
        status: 'captured',
        paymentMethod: params.paymentMethod,
        notes: extraSeats > 0 ? `Plan: ${plan.name} + ${extraSeats} Extra Employee Seats` : `Plan: ${plan.name}`,
        paidAt: now
      });
    }

    // SaaSAuditLog
    const admin = params.adminUser;
    const org = await Organization.findById(orgId);
    await SaaSAuditLog.create({
      adminId: admin ? (admin._id || admin.id) : paramsAdmin(admin),
      adminEmail: admin ? admin.email : 'system@arthaventure.com',
      adminName: admin ? `${admin.firstName} ${admin.lastName}` : 'Automated System',
      organizationId: orgId,
      organizationName: org?.name,
      action: 'SUBSCRIPTION_ACTIVATED',
      newValue: { planName: plan.name, price: totalPrice, extraSeats, totalSeats, duration: plan.duration, endDate },
      reason: params.paymentId ? `Payment verified (${params.paymentId})` : 'Manual admin activation'
    });

    try {
      await redisDel(`sub_status:${orgId}`);
    } catch {}

    return { subscription: updatedSub, payment: paymentDoc };
  }

  /**
   * Add Extra Employee Seats to an Existing Subscription (Top-up at ₹500/seat)
   */
  async addExtraSeatsToSubscription(params: {
    organizationId: string;
    extraSeats: number;
    paymentId?: string;
    orderId?: string;
    provider?: 'upi_qr' | 'manual';
    paymentMethod?: string;
    adminUser?: any;
  }): Promise<{ subscription: ISubscription; payment?: any; addedSeats: number; newTotalSeats: number }> {
    const orgId = String(params.organizationId);
    const extraSeats = Math.max(1, Number(params.extraSeats) || 1);
    const totalCost = extraSeats * 500;
    const now = new Date();

    const { subscription } = await this.getOrganizationSubscription(orgId);
    const currentSeats = subscription.maxUsersAtPurchase ?? 10;
    const newTotalSeats = currentSeats + extraSeats;

    const updatedSub = await Subscription.findOneAndUpdate(
      { organizationId: orgId },
      {
        $set: {
          maxUsersAtPurchase: newTotalSeats,
          userSeatsLimit: newTotalSeats
        }
      },
      { new: true }
    );

    let paymentDoc: any;
    if (params.paymentId) {
      paymentDoc = await Payment.create({
        organizationId: orgId,
        subscriptionId: updatedSub?._id || subscription._id,
        planId: updatedSub?.planId || subscription.planId,
        provider: params.provider || 'upi_qr',
        paymentId: params.paymentId,
        orderId: params.orderId,
        amount: totalCost,
        currency: 'INR',
        status: 'captured',
        paymentMethod: params.paymentMethod || 'online',
        notes: `Purchased +${extraSeats} extra employee seat(s) at ₹500/seat`,
        paidAt: now
      });
    }

    const admin = params.adminUser;
    const org = await Organization.findById(orgId);
    await SaaSAuditLog.create({
      adminId: admin ? (admin._id || admin.id) : paramsAdmin(admin),
      adminEmail: admin ? admin.email : 'system@arthaventure.com',
      adminName: admin ? `${admin.firstName} ${admin.lastName}` : 'System',
      organizationId: orgId,
      organizationName: org?.name,
      action: 'SEATS_EXPANDED',
      newValue: { previousSeats: currentSeats, addedSeats: extraSeats, newTotalSeats, totalCost },
      reason: `Purchased +${extraSeats} extra employee seats at ₹500/seat (Txn: ${params.paymentId || 'Manual'})`
    });

    return {
      subscription: updatedSub || subscription,
      payment: paymentDoc,
      addedSeats: extraSeats,
      newTotalSeats
    };
  }

  /**
   * Manually Assign / Change Subscription (Admin)
   */
  async assignSubscription(params: {
    organizationId: string;
    planId: string;
    startDate?: Date;
    duration?: number;
    durationUnit?: 'days' | 'months' | 'years';
    price?: number;
    paymentStatus?: 'paid' | 'pending' | 'free' | 'complimentary';
    autoRenew?: boolean;
    adminUser: any;
    reason?: string;
  }): Promise<ISubscription> {
    const orgId = String(params.organizationId);
    const plan = await Plan.findById(params.planId);
    if (!plan) throw new Error('Plan not found.');

    const startDate = params.startDate ? new Date(params.startDate) : new Date();
    const duration = params.duration || plan.duration;
    const unit = params.durationUnit || plan.durationUnit;
    const endDate = this.calculateEndDate(startDate, duration, unit);
    const price = params.price !== undefined ? params.price : plan.price;

    const sub = await Subscription.findOneAndUpdate(
      { organizationId: orgId },
      {
        $set: {
          planId: plan._id,
          planName: plan.name,
          status: 'active',
          startDate,
          endDate,
          priceAtPurchase: price,
          currencyAtPurchase: plan.currency,
          durationAtPurchase: duration,
          durationUnitAtPurchase: unit,
          maxUsersAtPurchase: plan.maxUsers,
          limitsAtPurchase: plan.limits,
          featuresAtPurchase: plan.features,
          autoRenew: params.autoRenew ?? false,
          paymentStatus: params.paymentStatus || 'complimentary',
          paymentProvider: 'manual',
          notes: params.reason
        }
      },
      { new: true, upsert: true }
    );

    const org = await Organization.findById(orgId);
    await SaaSAuditLog.create({
      adminId: params.adminUser._id || params.adminUser.id,
      adminEmail: params.adminUser.email,
      adminName: `${params.adminUser.firstName} ${params.adminUser.lastName}`,
      organizationId: orgId,
      organizationName: org?.name,
      action: 'SUBSCRIPTION_CREATED',
      newValue: (sub as any).toObject ? (sub as any).toObject() : sub,
      reason: params.reason || `Admin manually assigned "${plan.name}" plan for ${duration} ${unit}`
    });

    return sub;
  }

  /**
   * Extend Subscription Expiry Date (Admin)
   */
  async extendSubscription(params: {
    subscriptionId: string;
    extendDays?: number;
    customEndDate?: Date;
    adminUser: any;
    reason?: string;
  }): Promise<ISubscription> {
    const sub = await Subscription.findById(params.subscriptionId);
    if (!sub) throw new Error('Subscription not found.');

    const oldEndDate = new Date(sub.endDate);
    let newEndDate = new Date(sub.endDate);

    if (params.customEndDate) {
      newEndDate = new Date(params.customEndDate);
    } else if (params.extendDays) {
      newEndDate.setDate(newEndDate.getDate() + params.extendDays);
    } else {
      newEndDate.setDate(newEndDate.getDate() + 30);
    }

    sub.endDate = newEndDate;
    if (sub.status === 'expired' && newEndDate > new Date()) {
      sub.status = 'active';
    }
    if ((sub as any).save) await (sub as any).save();

    const org = await Organization.findById(sub.organizationId);
    await SaaSAuditLog.create({
      adminId: params.adminUser._id || params.adminUser.id,
      adminEmail: params.adminUser.email,
      adminName: `${params.adminUser.firstName} ${params.adminUser.lastName}`,
      organizationId: sub.organizationId,
      organizationName: org?.name,
      action: 'SUBSCRIPTION_EXTENDED',
      oldValue: { endDate: oldEndDate },
      newValue: { endDate: newEndDate },
      reason: params.reason || `Extended subscription by ${params.extendDays || 'custom'} days to ${newEndDate.toDateString()}`
    });

    return sub;
  }

  /**
   * Change Subscription Plan (Immediate vs At Expiry) (Admin)
   */
  async changeSubscriptionPlan(params: {
    subscriptionId: string;
    newPlanId: string;
    effective: 'immediate' | 'at_expiry';
    adminUser: any;
    reason?: string;
  }): Promise<ISubscription> {
    const sub = await Subscription.findById(params.subscriptionId);
    if (!sub) throw new Error('Subscription not found.');

    const newPlan = await Plan.findById(params.newPlanId);
    if (!newPlan) throw new Error('Target plan not found.');

    const org = await Organization.findById(sub.organizationId);

    if (params.effective === 'immediate') {
      const now = new Date();
      sub.planId = newPlan._id as any;
      sub.planName = newPlan.name;
      sub.priceAtPurchase = newPlan.price;
      sub.currencyAtPurchase = newPlan.currency;
      sub.durationAtPurchase = newPlan.duration;
      sub.durationUnitAtPurchase = newPlan.durationUnit;
      sub.maxUsersAtPurchase = newPlan.maxUsers;
      sub.limitsAtPurchase = newPlan.limits;
      sub.featuresAtPurchase = newPlan.features;
      sub.startDate = now;
      sub.endDate = this.calculateEndDate(now, newPlan.duration, newPlan.durationUnit);
      sub.status = 'active';
      sub.scheduledPlanChange = null as any;
      if ((sub as any).save) await (sub as any).save();

      await SaaSAuditLog.create({
        adminId: params.adminUser._id || params.adminUser.id,
        adminEmail: params.adminUser.email,
        adminName: `${params.adminUser.firstName} ${params.adminUser.lastName}`,
        organizationId: sub.organizationId,
        organizationName: org?.name,
        action: 'PLAN_CHANGED',
        newValue: { planName: newPlan.name, effective: 'immediate' },
        reason: params.reason || `Admin changed plan immediately to "${newPlan.name}"`
      });
    } else {
      sub.scheduledPlanChange = {
        planId: newPlan._id as any,
        effectiveDate: sub.endDate.toISOString()
      } as any;
      if ((sub as any).save) await (sub as any).save();

      await SaaSAuditLog.create({
        adminId: params.adminUser._id || params.adminUser.id,
        adminEmail: params.adminUser.email,
        adminName: `${params.adminUser.firstName} ${params.adminUser.lastName}`,
        organizationId: sub.organizationId,
        organizationName: org?.name,
        action: 'PLAN_CHANGED',
        newValue: { planName: newPlan.name, effective: 'at_expiry', effectiveDate: sub.endDate },
        reason: params.reason || `Scheduled plan change to "${newPlan.name}" at expiry on ${sub.endDate.toDateString()}`
      });
    }

    return sub;
  }

  /**
   * Suspend Subscription & Organization (Admin)
   */
  async suspendSubscription(subscriptionId: string, reason: string, adminUser: any): Promise<ISubscription> {
    const sub = await Subscription.findById(subscriptionId);
    if (!sub) throw new Error('Subscription not found.');

    sub.status = 'suspended';
    sub.suspendedAt = new Date();
    sub.suspensionReason = reason;
    if ((sub as any).save) await (sub as any).save();

    await Organization.findByIdAndUpdate(sub.organizationId, {
      isSuspended: true,
      suspendedAt: new Date()
    });

    const org = await Organization.findById(sub.organizationId);
    await SaaSAuditLog.create({
      adminId: paramsAdmin(adminUser),
      adminEmail: adminUser.email,
      adminName: `${adminUser.firstName} ${adminUser.lastName}`,
      organizationId: sub.organizationId,
      organizationName: org?.name,
      action: 'SUBSCRIPTION_SUSPENDED',
      reason: reason || 'Suspended by platform administrator'
    });

    return sub;
  }

  /**
   * Reactivate Subscription & Organization (Admin)
   */
  async reactivateSubscription(subscriptionId: string, adminUser: any): Promise<ISubscription> {
    const sub = await Subscription.findById(subscriptionId);
    if (!sub) throw new Error('Subscription not found.');

    sub.status = 'active';
    sub.suspendedAt = null as any;
    sub.suspensionReason = null as any;
    if ((sub as any).save) await (sub as any).save();

    await Organization.findByIdAndUpdate(sub.organizationId, {
      isSuspended: false,
      suspendedAt: null
    });

    const org = await Organization.findById(sub.organizationId);
    await SaaSAuditLog.create({
      adminId: paramsAdmin(adminUser),
      adminEmail: adminUser.email,
      adminName: `${adminUser.firstName} ${adminUser.lastName}`,
      organizationId: sub.organizationId,
      organizationName: org?.name,
      action: 'SUBSCRIPTION_ACTIVATED',
      reason: 'Reactivated by platform administrator'
    });

    return sub;
  }

  /**
   * Cancel Subscription (Immediate vs At Expiry) (Admin)
   */
  async cancelSubscription(subscriptionId: string, cancelImmediately: boolean, adminUser: any): Promise<ISubscription> {
    const sub = await Subscription.findById(subscriptionId);
    if (!sub) throw new Error('Subscription not found.');

    if (cancelImmediately) {
      sub.status = 'cancelled';
      sub.canceledAt = new Date();
      sub.autoRenew = false;
    } else {
      sub.cancelAtExpiry = true;
      sub.autoRenew = false;
    }
    if ((sub as any).save) await (sub as any).save();

    const org = await Organization.findById(sub.organizationId);
    await SaaSAuditLog.create({
      adminId: paramsAdmin(adminUser),
      adminEmail: adminUser.email,
      adminName: `${adminUser.firstName} ${adminUser.lastName}`,
      organizationId: sub.organizationId,
      organizationName: org?.name,
      action: 'SUBSCRIPTION_CANCELLED',
      reason: cancelImmediately ? 'Cancelled immediately' : 'Scheduled cancellation at expiry'
    });

    return sub;
  }

  /**
   * Create Custom Customer Subscription (Admin)
   */
  async createCustomSubscription(params: {
    organizationId: string;
    customPlanName: string;
    price: number;
    durationDays: number;
    maxUsers: number;
    limits: IPlanLimits;
    features: IPlanFeatures;
    paymentStatus: 'paid' | 'pending' | 'free' | 'complimentary';
    adminUser: any;
    notes?: string;
  }): Promise<ISubscription> {
    const orgId = String(params.organizationId);
    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + params.durationDays * 24 * 60 * 60 * 1000);

    const sub = await Subscription.findOneAndUpdate(
      { organizationId: orgId },
      {
        $set: {
          planId: undefined,
          planName: params.customPlanName,
          status: 'active',
          startDate,
          endDate,
          priceAtPurchase: params.price,
          currencyAtPurchase: 'INR',
          durationAtPurchase: params.durationDays,
          durationUnitAtPurchase: 'days',
          maxUsersAtPurchase: params.maxUsers,
          limitsAtPurchase: params.limits,
          featuresAtPurchase: params.features,
          paymentStatus: params.paymentStatus,
          paymentProvider: 'manual',
          notes: params.notes
        }
      },
      { new: true, upsert: true }
    );

    const org = await Organization.findById(orgId);
    await SaaSAuditLog.create({
      adminId: paramsAdmin(params.adminUser),
      adminEmail: params.adminUser.email,
      adminName: `${params.adminUser.firstName} ${params.adminUser.lastName}`,
      organizationId: orgId,
      organizationName: org?.name,
      action: 'CUSTOM_SUBSCRIPTION_ASSIGNED',
      newValue: (sub as any).toObject ? (sub as any).toObject() : sub,
      reason: `Custom terms: ₹${params.price} for ${params.durationDays} days (${params.maxUsers} users)`
    });

    return sub;
  }

  /**
   * Platform Overview & SaaS KPIs (Admin)
   */
  async getPlatformOverview(): Promise<any> {
    const [
      totalOrgs,
      totalUsers,
      activeSubsCount,
      trialSubsCount,
      expiredSubsCount,
      suspendedSubsCount,
      totalRevenueResult,
      recentAuditLogs,
      recentPayments,
      totalTickets,
      openTickets,
      urgentTickets,
      recentTickets
    ] = await Promise.all([
      Organization.countDocuments(),
      User.countDocuments(),
      Subscription.countDocuments({ status: 'active' }),
      Subscription.countDocuments({ status: 'trial' }),
      Subscription.countDocuments({ status: 'expired' }),
      Subscription.countDocuments({ status: 'suspended' }),
      Payment.aggregate([
        { $match: { status: 'captured' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      SaaSAuditLog.find().sort({ createdAt: -1 }).limit(8),
      Payment.find().populate('organizationId', 'name').sort({ createdAt: -1 }).limit(6),
      Ticket.countDocuments({ isDeleted: false }),
      Ticket.countDocuments({ isDeleted: false, status: { $in: ['open', 'in_progress'] } }),
      Ticket.countDocuments({ isDeleted: false, priority: { $in: ['high', 'urgent'] }, status: { $in: ['open', 'in_progress'] } }),
      Ticket.find({ isDeleted: false })
        .populate('customerId', 'name companyName email')
        .populate('organizationId', 'name')
        .sort({ createdAt: -1 })
        .limit(6)
    ]);

    const totalRevenue = totalRevenueResult[0]?.total || 0;
    
    // Estimate MRR from active subscriptions
    const activeSubs = await Subscription.find({ status: 'active' });
    let mrr = 0;
    for (const sub of activeSubs) {
      if (sub.priceAtPurchase && sub.durationAtPurchase) {
        const duration = Number(sub.durationAtPurchase) || 30;
        const days = sub.durationUnitAtPurchase === 'years' 
          ? duration * 365 
          : sub.durationUnitAtPurchase === 'months' 
          ? duration * 30 
          : duration;
        mrr += Math.round((Number(sub.priceAtPurchase) / (days || 30)) * 30);
      }
    }

    return {
      kpis: {
        totalOrgs,
        totalUsers,
        activeSubscriptions: activeSubsCount,
        trialSubscriptions: trialSubsCount,
        expiredSubscriptions: expiredSubsCount,
        suspendedOrganizations: suspendedSubsCount,
        totalRevenue,
        monthlyRecurringRevenue: mrr,
        totalTickets,
        openTickets,
        urgentTickets
      },
      recentAuditLogs,
      recentPayments,
      recentTickets
    };
  }
}

function paramsAdmin(adminUser: any) {
  return adminUser?._id || adminUser?.id || '';
}

export const saasService = new SaaSService();
