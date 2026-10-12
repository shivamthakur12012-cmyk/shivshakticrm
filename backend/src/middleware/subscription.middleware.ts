import { Request, Response, NextFunction } from 'express';
import { saasService } from '../services/saas.service';
import { Organization } from '../models/Organization';

/**
 * Ensures Organization subscription is active and not suspended or expired
 */
export async function requireActiveSubscription(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as any;
    // Super admin bypass
    const isSuper = (req as any).userRole === 'Super Admin' || user?.role === 'Super Admin' || (process.env.PLATFORM_ADMIN_EMAIL && user?.email === process.env.PLATFORM_ADMIN_EMAIL) || user?.email === 'shivamthakur12012@gmail.com';
    if (isSuper) {
      return next();
    }

    let orgId = req.organizationId || (req.headers['x-organization-id'] as string);
    if (!orgId || orgId === 'undefined' || orgId === 'null' || orgId === 'pcs-org') {
      const firstOrg = await Organization.findOne({ isDeleted: false });
      if (firstOrg) {
        orgId = firstOrg._id || firstOrg.id;
        req.organizationId = orgId;
      }
    }

    if (!orgId) {
      return res.status(400).json({
        success: false,
        message: 'No organization context found for this request.',
        errorCode: 'ORGANIZATION_REQUIRED'
      });
    }

    // Check organization suspension
    const org = await Organization.findById(orgId);
    if (!org || org.isSuspended) {
      return res.status(403).json({
        success: false,
        message: 'Your organization workspace has been suspended. Please contact the administrator.',
        errorCode: 'ORGANIZATION_SUSPENDED'
      });
    }

    // Check subscription status
    const { subscription, isExpired, isGracePeriod } = await saasService.getOrganizationSubscription(orgId);

    if (subscription.status === 'suspended') {
      return res.status(403).json({
        success: false,
        message: 'Your organization subscription is suspended. Please contact the platform administrator.',
        errorCode: 'SUBSCRIPTION_SUSPENDED'
      });
    }

    if (subscription.status === 'cancelled') {
      return res.status(402).json({
        success: false,
        isExpired: true,
        daysRemaining: 0,
        message: 'Your organization subscription has been cancelled. Please choose a subscription plan.',
        errorCode: 'SUBSCRIPTION_CANCELLED'
      });
    }

    if (isExpired && !isGracePeriod) {
      return res.status(402).json({
        success: false,
        isExpired: true,
        daysRemaining: 0,
        endDate: subscription.endDate,
        message: 'Your subscription plan has expired or no active plan is assigned. Please choose a plan to continue.',
        errorCode: 'SUBSCRIPTION_EXPIRED'
      });
    }

    // Attach verified subscription to request
    (req as any).subscription = subscription;
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Middleware factory to check live resource limits against subscription
 */
export function checkUsageLimit(resource: 'users' | 'leads' | 'contacts' | 'campaigns' | 'followUps' | 'tasks' | 'invoices') {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.organizationId;
      if (!orgId) return next();

      const { subscription, usage } = await saasService.getOrganizationSubscription(orgId);
      const limits = subscription.limitsAtPurchase || {};

      let maxLimit = -1;
      let currentCount = 0;

      if (resource === 'users') {
        maxLimit = subscription.maxUsersAtPurchase ?? 10;
        currentCount = usage.users;
      } else {
        maxLimit = (limits as any)[resource] ?? -1;
        currentCount = (usage as any)[resource] ?? 0;
      }

      // If limit is not unlimited (-1 or 99999) and exceeded
      if (maxLimit !== -1 && maxLimit !== 99999 && currentCount >= maxLimit) {
        return res.status(403).json({
          success: false,
          errorCode: resource === 'users' ? 'EMPLOYEE_LIMIT_REACHED' : 'RESOURCE_LIMIT_REACHED',
          message: resource === 'users' 
            ? `Employee limit reached for your current plan (Max: ${maxLimit}). Please upgrade your plan.`
            : `Your current plan limit of ${maxLimit} ${resource} has been reached (${currentCount}/${maxLimit}). Please upgrade your subscription.`,
          data: {
            resource,
            currentCount,
            maxLimit,
            planName: subscription.planName
          }
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Middleware factory to verify feature permission in subscription
 */
export function checkFeature(feature: 'email' | 'whatsapp' | 'instagram' | 'phoneCalls' | 'analytics' | 'reports' | 'automation' | 'aiCopilot') {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.organizationId;
      if (!orgId) return next();

      const { subscription } = await saasService.getOrganizationSubscription(orgId);
      const features = subscription.featuresAtPurchase || {};

      if (!(features as any)[feature]) {
        return res.status(403).json({
          success: false,
          errorCode: 'FEATURE_NOT_INCLUDED',
          message: `The feature "${feature}" is not included in your organization's current plan (${subscription.planName}). Please upgrade your plan to unlock this capability.`,
          data: {
            feature,
            planName: subscription.planName
          }
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Restricts endpoint strictly to Super Admin / Platform Admin
 */
export async function platformAdminOnly(req: Request, res: Response, next: NextFunction) {
  const user = req.user as any;
  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.',
      errorCode: 'UNAUTHORIZED'
    });
  }

  const isPlatformAdmin = 
    (req as any).userRole === 'Super Admin' ||
    user?.role === 'Super Admin' ||
    (process.env.PLATFORM_ADMIN_EMAIL && user?.email === process.env.PLATFORM_ADMIN_EMAIL) ||
    user?.email === 'shivamthakur12012@gmail.com';

  if (isPlatformAdmin) {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: 'Access denied: Platform Administrator privileges required.',
    errorCode: 'FORBIDDEN_PLATFORM_ADMIN'
  });
}
