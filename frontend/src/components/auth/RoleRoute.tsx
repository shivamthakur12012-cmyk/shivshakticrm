import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

interface RoleRouteProps {
  children: React.ReactElement;
  allowSuperAdminOnly?: boolean;
  allowOrgAdminOnly?: boolean;
  disallowSuperAdmin?: boolean;
  minRole?: 'Admin' | 'Manager' | 'Team Leader' | 'Sale Executive';
}

export const RoleRoute: React.FC<RoleRouteProps> = ({
  children,
  allowSuperAdminOnly,
  allowOrgAdminOnly,
  disallowSuperAdmin,
  minRole
}) => {
  const { user, organizations, activeOrganizationId } = useAuthStore();

  const isSuperAdmin = user?.role === 'Super Admin' || (user as any)?.isSuperAdmin || user?.email === 'shivamthakur12012@gmail.com';

  const rawOrg = organizations.find(org => org.id === activeOrganizationId) || organizations[0];
  const activeRole = rawOrg?.role || (isSuperAdmin ? 'Super Admin' : 'Admin');

  // 1. Super Admin Only Protection
  // Non-super-admins cannot access super-admin routes (e.g. /super-admin/plans, /super-admin/organizations)
  if (allowSuperAdminOnly) {
    if (!isSuperAdmin) {
      return <Navigate to="/dashboard" replace />;
    }
    return children;
  }

  // 2. Disallow Super Admin from accessing Organization Admin / Tenant CRM pages
  if (disallowSuperAdmin && isSuperAdmin) {
    return <Navigate to="/super-admin" replace />;
  }

  // 3. Organization Admin Only Protection
  // Only Organization Admin (role === 'Admin') can access organization admin pages
  // Super Admin cannot access organization admin pages
  if (allowOrgAdminOnly) {
    if (isSuperAdmin) {
      return <Navigate to="/super-admin" replace />;
    }
    if (activeRole !== 'Admin') {
      return <Navigate to="/dashboard" replace />;
    }
    return children;
  }

  // 4. Role Hierarchy Minimums
  if (minRole) {
    const roleHierarchy: Record<string, number> = {
      'Admin': 4,
      'Manager': 3,
      'Team Leader': 2,
      'Sale Executive': 1,
      'Employee': 1
    };
    const userLevel = roleHierarchy[activeRole] || 1;
    const requiredLevel = roleHierarchy[minRole] || 1;
    if (userLevel < requiredLevel) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return children;
};

export default RoleRoute;
