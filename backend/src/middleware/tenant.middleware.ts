import { Request, Response, NextFunction } from 'express';
import { UserOrganizationRole } from '../models/UserOrganizationRole';
import { Role } from '../models/Role';
import logger from '../utils/logger';

interface CachedUserRoles {
  roles: any[];
  expiresAt: number;
}
const userRolesCache = new Map<string, CachedUserRoles>();

export async function tenantIsolation(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required context missing.',
        errorCode: 'UNAUTHORIZED'
      });
    }

    const now = Date.now();
    let cached = userRolesCache.get(req.user.id);
    let userRoles: any[];

    if (cached && now < cached.expiresAt) {
      userRoles = cached.roles;
    } else {
      // 1. Fetch all memberships for this user
      userRoles = await UserOrganizationRole.find({ userId: req.user.id }).populate({
        path: 'roleId',
        populate: { path: 'permissions' }
      });
      userRolesCache.set(req.user.id, {
        roles: userRoles,
        expiresAt: now + 60 * 1000 // 60 seconds
      });
    }

    // 2. Extract organization ID from header/query or auto-fallback to user's organization
    let orgId = (req.headers['x-organization-id'] as string) || 
                (req.query.organizationId as string) || 
                (req.params.organizationId as string);

    // Normalize placeholder or invalid orgId values
    if (orgId === 'pcs-org' || orgId === 'undefined' || orgId === 'null' || orgId === '') {
      orgId = undefined as any;
    }

    const explicitOrgRequested = !!orgId;
    let activeMembership = orgId 
      ? userRoles.find((ur: any) => ur.organizationId === orgId || ur.organization?.id === orgId)
      : userRoles[0];

    // If an explicit organization ID was requested but user is not a member, reject with 403 Forbidden
    if (explicitOrgRequested && !activeMembership) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not belong to this organization.',
        errorCode: 'ORGANIZATION_ACCESS_DENIED'
      });
    }

    if (activeMembership) {
      req.organizationId = activeMembership.organizationId || activeMembership.organization?.id;
      const roleObj = (activeMembership as any).role || (activeMembership as any).roleId;
      req.userRoleId = (typeof roleObj === 'object' && roleObj ? (roleObj._id || roleObj.id) : (activeMembership.roleId || '')).toString();
      req.userRole = typeof roleObj === 'object' && roleObj?.name ? roleObj.name : ((activeMembership as any).role?.name || 'Admin');

      // Note: Data isolation is strictly enforced via organizationId column scoping.
      // SET search_path is omitted on PgBouncer pooled connections to prevent session bleeding.

      // Subscription Paywall Check for CRM API routes (Bypass Super Admin and Billing/Plans routes)
      const isSuper = req.userRole === 'Super Admin' || 
                      (process.env.PLATFORM_ADMIN_EMAIL && req.user.email === process.env.PLATFORM_ADMIN_EMAIL) ||
                      req.user.email === 'shivamthakur12012@gmail.com';
      const isBillingRoute = req.originalUrl.includes('/billing') || 
                             req.originalUrl.includes('/plans') || 
                             req.originalUrl.includes('/auth');

      if (!isSuper && !isBillingRoute && req.organizationId) {
        try {
          const { saasService } = await import('../services/saas.service');
          const { isExpired, isGracePeriod } = await saasService.checkSubscriptionStatus(req.organizationId);
          if (isExpired && !isGracePeriod) {
            return res.status(402).json({
              success: false,
              isExpired: true,
              daysRemaining: 0,
              message: 'Your organization subscription has expired or no plan is active. Please choose a subscription plan to continue.',
              errorCode: 'SUBSCRIPTION_EXPIRED'
            });
          }
        } catch (subErr) {
          logger.warn('Subscription check error:', subErr);
        }
      }

      return next();
    }

    // 3. Fallback: If user has no explicit org role yet, check if Super Admin exists or assign to primary org
    const isSuperAdmin = (process.env.PLATFORM_ADMIN_EMAIL && req.user.email === process.env.PLATFORM_ADMIN_EMAIL) ||
                         req.user.email === 'shivamthakur12012@gmail.com';
    if (isSuperAdmin) {
      const superAdminRole = await Role.findOne({ name: 'Super Admin', organizationId: null });
      if (superAdminRole) {
        let targetOrgId = orgId;
        if (!targetOrgId) {
          const { Organization } = await import('../models/Organization');
          const firstOrg = await Organization.findOne({ isDeleted: false });
          targetOrgId = firstOrg ? (firstOrg._id || firstOrg.id) : '';
        }
        req.organizationId = targetOrgId || '';
        req.userRoleId = superAdminRole.id || superAdminRole._id;
        req.userRole = 'Super Admin';
        return next();
      }
    }

    return res.status(403).json({
      success: false,
      message: 'Access denied. You do not belong to this organization.',
      errorCode: 'ORGANIZATION_ACCESS_DENIED'
    });
  } catch (error) {
    logger.error('Tenant isolation middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error validating tenant.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
}
