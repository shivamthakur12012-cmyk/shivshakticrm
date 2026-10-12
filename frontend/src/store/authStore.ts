import { create } from 'zustand';

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isVerified: boolean;
  status: 'active' | 'inactive';
  role?: string;
  isSuperAdmin?: boolean;
}

export interface UserOrganization {
  id: string;
  name: string;
  businessType: 'general' | 'loan' | 'registration' | 'certification' | 'custom';
  logoUrl?: string;
  role: string;
  permissions: string[];
  bankName?: string;
  bankAccount?: string;
  bankIfsc?: string;
  bankUpi?: string;
}

interface AuthState {
  token: string | null;
  user: UserProfile | null;
  organizations: UserOrganization[];
  activeOrganizationId: string | null;
  isAuthenticated: boolean;
  setToken: (token: string | null) => void;
  setUser: (user: UserProfile | null) => void;
  setOrganizations: (orgs: UserOrganization[]) => void;
  setActiveOrganizationId: (orgId: string | null) => void;
  login: (token: string, user: UserProfile, organizations: UserOrganization[]) => void;
  logout: () => void;
}

export function getCachedSubscriptionExpired(orgId: string | null | undefined): boolean | null {
  if (!orgId) return null;
  const val = localStorage.getItem(`artha_sub_expired_${orgId}`);
  if (val === 'true') return true;
  if (val === 'false') return false;
  return null;
}

export function setCachedSubscriptionExpired(orgId: string | null | undefined, isExpired: boolean): void {
  if (!orgId) return;
  localStorage.setItem(`artha_sub_expired_${orgId}`, isExpired ? 'true' : 'false');
}

export const useAuthStore = create<AuthState>((set) => {
  // Load initial state from localStorage if available
  const savedUser = localStorage.getItem('artha_user');
  const savedOrgs = localStorage.getItem('artha_organizations');
  const savedActiveOrgId = localStorage.getItem('artha_active_org_id');
  const savedToken = localStorage.getItem('artha_token'); // For convenience in dev, or cookies in prod

  let parsedOrgs: UserOrganization[] = [];
  try {
    if (savedOrgs) {
      parsedOrgs = JSON.parse(savedOrgs).map((o: UserOrganization) => ({ ...o, name: o.name || 'PCS' }));
    }
  } catch {}

  let initialActiveOrgId = savedActiveOrgId;
  if ((!initialActiveOrgId || initialActiveOrgId === 'pcs-org' || initialActiveOrgId === 'undefined' || initialActiveOrgId === 'null') && parsedOrgs.length > 0 && parsedOrgs[0]?.id) {
    initialActiveOrgId = parsedOrgs[0].id;
    localStorage.setItem('artha_active_org_id', initialActiveOrgId);
  }

  return {
    token: savedToken || null,
    user: savedUser ? JSON.parse(savedUser) : null,
    organizations: parsedOrgs,
    activeOrganizationId: initialActiveOrgId || null,
    isAuthenticated: !!savedToken,

    setToken: (token) => {
      if (token) {
        localStorage.setItem('artha_token', token);
      } else {
        localStorage.removeItem('artha_token');
      }
      set({ token, isAuthenticated: !!token });
    },

    setUser: (user) => {
      if (user) {
        localStorage.setItem('artha_user', JSON.stringify(user));
      } else {
        localStorage.removeItem('artha_user');
      }
      set({ user });
    },

    setOrganizations: (organizations) => {
      localStorage.setItem('artha_organizations', JSON.stringify(organizations));
      const currentActive = localStorage.getItem('artha_active_org_id');
      const validActive = (currentActive && organizations.some(o => o.id === currentActive))
        ? currentActive
        : (organizations.length > 0 ? organizations[0].id : null);

      if (validActive) {
        localStorage.setItem('artha_active_org_id', validActive);
      }
      set({ organizations, activeOrganizationId: validActive });
    },

    setActiveOrganizationId: (activeOrganizationId) => {
      if (activeOrganizationId && activeOrganizationId !== 'pcs-org' && activeOrganizationId !== 'undefined' && activeOrganizationId !== 'null') {
        localStorage.setItem('artha_active_org_id', activeOrganizationId);
      } else {
        localStorage.removeItem('artha_active_org_id');
      }
      set({ activeOrganizationId });
    },

    login: (token, user, organizations) => {
      localStorage.setItem('artha_token', token);
      localStorage.setItem('artha_user', JSON.stringify(user));
      localStorage.setItem('artha_organizations', JSON.stringify(organizations));
      
      const activeOrgId = organizations.length > 0 ? organizations[0].id : null;
      if (activeOrgId) {
        localStorage.setItem('artha_active_org_id', activeOrgId);
      }

      set({
        token,
        user,
        organizations,
        activeOrganizationId: activeOrgId,
        isAuthenticated: true
      });
    },

    logout: () => {
      localStorage.removeItem('artha_token');
      localStorage.removeItem('artha_user');
      localStorage.removeItem('artha_organizations');
      localStorage.removeItem('artha_active_org_id');
      // Clear all cached subscription status flags
      try {
        const toRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('artha_sub_expired_')) {
            toRemove.push(key);
          }
        }
        toRemove.forEach(k => localStorage.removeItem(k));
      } catch {}
      set({
        token: null,
        user: null,
        organizations: [],
        activeOrganizationId: null,
        isAuthenticated: false
      });
    }
  };
});
