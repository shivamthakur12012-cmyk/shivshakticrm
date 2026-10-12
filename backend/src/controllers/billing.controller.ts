import { Request, Response, NextFunction } from 'express';
import { saasService } from '../services/saas.service';
import { Payment } from '../models/Payment';
import { Plan } from '../models/Plan';
import { Subscription } from '../models/Subscription';
import { Organization } from '../models/Organization';
import { SaaSAuditLog } from '../models/SaaSAuditLog';

/**
 * Public endpoint to fetch all dynamic active plans for pricing page
 */
export async function getPublicPlans(_req: Request, res: Response, next: NextFunction) {
  try {
    const plans = await saasService.getPublicPlans();
    return res.json({ success: true, data: plans });
  } catch (error) {
    next(error);
  }
}

/**
 * Get organization billing details, live usage counters, features, and payment history
 */
export async function getSubscriptionDetails(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = req.organizationId;
    if (!orgId) {
      return res.status(400).json({ success: false, message: 'Organization context required.' });
    }

    const { subscription, usage, daysRemaining, isExpired, isGracePeriod } = 
      await saasService.getOrganizationSubscription(orgId);

    // Fetch payments for this organization
    const payments = await Payment.find({ organizationId: orgId })
      .populate('planId', 'name')
      .sort({ createdAt: -1 })
      .limit(10);

    return res.json({
      success: true,
      data: {
        subscription,
        usage,
        daysRemaining,
        isExpired,
        isGracePeriod,
        payments,
        activeSeatsCount: usage.users
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Submit payment request with UPI Scanner Transaction ID / UTR and Company Name
 * Stored for Super Admin verification
 */
export async function submitPaymentRequest(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = req.organizationId;
    if (!orgId) {
      return res.status(400).json({ success: false, message: 'Organization context required.' });
    }

    const { planId, extraSeats = 0, companyName, transactionId, notes } = req.body;

    if (!companyName || !companyName.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Company name is required.'
      });
    }

    if (!transactionId || !transactionId.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Payment Transaction Number / UTR is required.'
      });
    }

    const plan = await Plan.findById(planId);
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Selected plan does not exist.' });
    }

    const numExtraSeats = Math.max(0, parseInt(extraSeats, 10) || 0);
    const extraSeatsCost = numExtraSeats * 500;
    const totalAmount = plan.price + extraSeatsCost;
    const totalSeats = (plan.maxUsers || 10) + numExtraSeats;
    const cleanTxnId = transactionId.trim();

    // Check duplicate transaction ID already captured
    const existingPayment = await Payment.findOne({ 
      paymentId: cleanTxnId, 
      status: { $in: ['captured', 'successful'] } 
    });
    if (existingPayment) {
      return res.status(400).json({
        success: false,
        message: 'This payment transaction reference has already been credited.',
        errorCode: 'DUPLICATE_PAYMENT'
      });
    }

    // Update organization name if client re-entered or refined it
    const trimmedCompany = companyName.trim();
    await Organization.findByIdAndUpdate(orgId, {
      $set: { name: trimmedCompany }
    });

    // If completely free plan (₹0), activate immediately
    if (totalAmount === 0) {
      const { subscription } = await saasService.activateOrRenewSubscription({
        organizationId: orgId,
        planId: plan._id.toString(),
        extraSeats: numExtraSeats,
        provider: 'free',
        adminUser: req.user
      });

      return res.json({
        success: true,
        isFreePlan: true,
        message: `Plan "${plan.name}" activated successfully.`,
        data: { subscription }
      });
    }

    // Create Payment Record with status 'pending_verification'
    const paymentNotes = `Company: ${trimmedCompany} | Plan: ${plan.name} (${plan.duration} ${plan.durationUnit}) + ${numExtraSeats} Extra Seats | UTR: ${cleanTxnId}${notes ? ' | Note: ' + notes.trim() : ''}`;

    const payment = await Payment.create({
      organizationId: orgId,
      planId: plan._id,
      provider: 'upi_qr',
      paymentMethod: 'upi_qr',
      paymentId: cleanTxnId,
      amount: totalAmount,
      currency: plan.currency || 'INR',
      status: 'pending_verification',
      notes: paymentNotes,
      paidAt: new Date()
    });

    // Update Subscription status to indicate verification is in-progress
    await Subscription.findOneAndUpdate(
      { organizationId: orgId },
      {
        $set: {
          planId: plan._id,
          planName: plan.name,
          paymentStatus: 'pending_verification',
          providerPaymentId: cleanTxnId,
          priceAtPurchase: totalAmount,
          maxUsersAtPurchase: totalSeats,
          userSeatsLimit: totalSeats,
          notes: `Pending Super Admin verification for plan "${plan.name}" (UTR: ${cleanTxnId})`
        }
      },
      { upsert: true }
    );

    // Audit Log for Super Admin
    const user = req.user as any;
    await SaaSAuditLog.create({
      adminId: user?.id || user?._id || 'client-request',
      adminEmail: user?.email || 'client@arthaventure.com',
      adminName: `${user?.firstName || 'Client'} ${user?.lastName || ''}`.trim(),
      organizationId: orgId,
      organizationName: trimmedCompany,
      action: 'PAYMENT_SUBMITTED_FOR_VERIFICATION',
      newValue: {
        planName: plan.name,
        totalAmount,
        extraSeats: numExtraSeats,
        totalSeats,
        transactionId: cleanTxnId,
        paymentId: payment._id || payment.id
      },
      reason: `Client submitted UPI payment (UTR: ${cleanTxnId}) for plan "${plan.name}"`
    });

    return res.json({
      success: true,
      message: 'Payment submitted successfully! Your payment is awaiting Super Admin verification.',
      data: {
        payment,
        totalAmount,
        planName: plan.name,
        totalSeats,
        transactionId: cleanTxnId
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Submit payment request for extra employee seat add-ons
 */
export async function submitSeatAddonPaymentRequest(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = req.organizationId;
    if (!orgId) {
      return res.status(400).json({ success: false, message: 'Organization context required.' });
    }

    const { extraSeats = 1, companyName, transactionId, notes } = req.body;

    if (!transactionId || !transactionId.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Payment Transaction Number / UTR is required.'
      });
    }

    const numSeats = Math.max(1, parseInt(extraSeats, 10) || 1);
    const amount = numSeats * 500;
    const cleanTxnId = transactionId.trim();

    const { subscription } = await saasService.getOrganizationSubscription(orgId);
    if (!subscription) {
      return res.status(400).json({ success: false, message: 'Active subscription required to add seats.' });
    }

    const org = await Organization.findById(orgId);
    const trimmedCompany = (companyName || org?.name || 'Customer').trim();

    const paymentNotes = `Seat Add-on: +${numSeats} Extra Seats for "${trimmedCompany}" (₹${amount}) | UTR: ${cleanTxnId}${notes ? ' | Note: ' + notes.trim() : ''}`;

    const payment = await Payment.create({
      organizationId: orgId,
      subscriptionId: subscription._id,
      planId: subscription.planId,
      provider: 'upi_qr',
      paymentMethod: 'upi_qr',
      paymentId: cleanTxnId,
      amount,
      currency: 'INR',
      status: 'pending_verification',
      notes: paymentNotes,
      paidAt: new Date()
    });

    const user = req.user as any;
    await SaaSAuditLog.create({
      adminId: user?.id || user?._id || 'client-request',
      adminEmail: user?.email || 'client@arthaventure.com',
      adminName: `${user?.firstName || 'Client'} ${user?.lastName || ''}`.trim(),
      organizationId: orgId,
      organizationName: trimmedCompany,
      action: 'SEAT_ADDON_SUBMITTED_FOR_VERIFICATION',
      newValue: {
        extraSeats: numSeats,
        amount,
        transactionId: cleanTxnId,
        paymentId: payment._id || payment.id
      },
      reason: `Client submitted seat add-on payment (UTR: ${cleanTxnId}) for +${numSeats} seats`
    });

    return res.json({
      success: true,
      message: 'Extra seats payment submitted! Waiting for Super Admin verification.',
      data: {
        payment,
        extraSeats: numSeats,
        amount,
        transactionId: cleanTxnId
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Backward compatibility helpers
 */
export async function createCheckoutOrder(req: Request, res: Response, next: NextFunction) {
  return submitPaymentRequest(req, res, next);
}

export async function verifyPayment(req: Request, res: Response, next: NextFunction) {
  return submitPaymentRequest(req, res, next);
}

export async function createSeatAddonOrder(req: Request, res: Response, next: NextFunction) {
  return submitSeatAddonPaymentRequest(req, res, next);
}

export async function verifySeatAddonPayment(req: Request, res: Response, next: NextFunction) {
  return submitSeatAddonPaymentRequest(req, res, next);
}

export async function subscribeToPlan(req: Request, res: Response, next: NextFunction) {
  return submitPaymentRequest(req, res, next);
}
