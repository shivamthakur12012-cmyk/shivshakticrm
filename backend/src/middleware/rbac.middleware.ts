import { Request, Response, NextFunction } from 'express';
import { Role } from '../models/Role';
import logger from '../utils/logger';

interface CachedRole {
  name: string;
  permissions: string[];
  expiresAt: number;
}
const roleCache = new Map<string, CachedRole>();

export function authorize(requiredPermissions: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user || !req.userRoleId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication context missing.',
          errorCode: 'UNAUTHORIZED'
        });
      }

      const now = Date.now();
      let cached = roleCache.get(req.userRoleId);

      if (!cached || now > cached.expiresAt) {
        // Fetch role and populated permissions
        const role = await Role.findById(req.userRoleId).populate('permissions');
        if (!role) {
          return res.status(403).json({
            success: false,
            message: 'Access denied. User role not found.',
            errorCode: 'ROLE_NOT_FOUND'
          });
        }
        const permissionNames = (role.permissions as any[]).map(p => (typeof p === 'object' && p ? p.name : p));
        cached = {
          name: role.name,
          permissions: permissionNames,
          expiresAt: now + 60 * 1000 // 60 seconds
        };
        roleCache.set(req.userRoleId, cached);
      }

      req.userRole = cached.name;
      const permissionNames = cached.permissions;

      // Super Admins with platform:admin permission can bypass all standard checks
      if (permissionNames.includes('platform:admin') || cached.name === 'Super Admin') {
        return next();
      }

      // Verify that the user has all of the required permissions for the route
      const hasAllPermissions = requiredPermissions.every(perm => permissionNames.includes(perm));

      if (!hasAllPermissions) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Insufficient permissions.',
          errorCode: 'INSUFFICIENT_PERMISSIONS'
        });
      }

      next();
    } catch (error) {
      logger.error('RBAC authorization middleware error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal authorization validation failure.',
        errorCode: 'INTERNAL_ERROR'
      });
    }
  };
}
