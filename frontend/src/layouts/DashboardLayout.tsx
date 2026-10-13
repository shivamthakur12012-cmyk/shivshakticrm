import React, { useState, useEffect } from 'react';
import { Navigate, Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore, getCachedSubscriptionExpired, setCachedSubscriptionExpired } from '../store/authStore';
import { api } from '../services/api';
import {
  LayoutDashboard, Users, LogOut, Menu, X,
  Building2, Sun, Moon, Award, Smartphone,
  ShieldCheck, PlusCircle, ChevronLeft, ChevronRight,
  CreditCard, Layers, FileText, Zap, UserPlus, Upload,
  LifeBuoy, Cpu
} from 'lucide-react';

export const DashboardLayout: React.FC = () => {
  const { isAuthenticated, user, organizations, activeOrganizationId, logout, setOrganizations, setActiveOrganizationId, setUser } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('artha_sidebar_collapsed') === 'true';
  });
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('artha_theme') as 'light' | 'dark') || 'light';
  });

  const isSuperAdmin = user?.role === 'Super Admin' || (user as any)?.isSuperAdmin || user?.email === 'shivamthakur12012@gmail.com';

  // Active organization details
  const rawOrg = organizations.find(org => org.id === activeOrganizationId) || organizations[0];
  const activeOrg = rawOrg ? { ...rawOrg, name: rawOrg.name || 'PCS' } : { id: 'pcs-org', name: 'PCS', role: 'Admin', businessType: 'general' as const, permissions: [] };
  const activeRole = activeOrg?.role || (isSuperAdmin ? 'Super Admin' : 'Admin');

  // Auto-sync active organization ID if needed
  useEffect(() => {
    if (activeOrg?.id && activeOrg.id !== 'pcs-org' && activeOrganizationId !== activeOrg.id) {
      setActiveOrganizationId(activeOrg.id);
    }
  }, [activeOrg?.id, activeOrganizationId, setActiveOrganizationId]);

  // Auto-sync session profile & organizations from server using React Query (deduplicated & cached)
  const { data: meData } = useQuery({
    queryKey: ['auth-me'],
    queryFn: async () => {
      const res = await api.get('/auth/me');
      return res.data?.data;
    },
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (meData) {
      if (meData.user) setUser(meData.user);
      if (meData.organizations && meData.organizations.length > 0) {
        setOrganizations(meData.organizations);
      }
    }
  }, [meData, setOrganizations, setUser]);

  // Synchronous subscription check: immediately known from cache, eliminating any 3-4s dashboard delay
  const cachedExpired = getCachedSubscriptionExpired(activeOrganizationId);

  // Live Subscription Status Query (polls every 5 minutes)
  const { data: subData, isLoading: isSubLoading } = useQuery({
    queryKey: ['billing-subscription', activeOrganizationId],
    queryFn: async () => {
      try {
        const res = await api.get('/billing/subscription');
        return res.data.data;
      } catch {
        return null;
      }
    },
    enabled: !!activeOrganizationId && isAuthenticated,
    refetchInterval: 5 * 60 * 1000,
    staleTime: 3 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  // Calculate live or cached expired status
  const subscription = subData?.subscription;
  const isSuspended = subscription?.status === 'suspended';
  const isCancelled = subscription?.status === 'cancelled';
  const isLiveExpired = subData ? (subData?.isExpired || isSuspended || isCancelled || false) : null;

  // Determine effective expiration: prefer live data once returned, otherwise use synchronous cache
  const isExpired = isLiveExpired !== null ? isLiveExpired : (cachedExpired === true);

  // Keep localStorage cache in sync whenever live query resolves
  useEffect(() => {
    if (activeOrganizationId && isLiveExpired !== null) {
      setCachedSubscriptionExpired(activeOrganizationId, isLiveExpired);
    }
  }, [activeOrganizationId, isLiveExpired]);

  // Verify dark mode class addition
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('artha_theme', theme);
  }, [theme]);

  // --- ALL HOOKS ARE CALLED UNCONDITIONALLY ABOVE THIS LINE ---

  // If not authenticated, redirect to Login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // If authenticated but has no organizations, redirect to onboarding wizard (except Super Admin)
  if (!isSuperAdmin && organizations.length === 0) {
    return <Navigate to="/onboarding" replace />;
  }

  // Zero-delay instantaneous paywall redirect (0ms delay when removing /subscription from URL)
  if (!isSuperAdmin && isExpired && location.pathname !== '/subscription') {
    return <Navigate to="/subscription" replace />;
  }

  // If subscription status is completely unknown (first ever load, no cache) and query is in flight:
  // Render a clean verifying splash to avoid leaking/flashing protected dashboard
  if (!isSuperAdmin && cachedExpired === null && isSubLoading && !subData) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-900">
        <div className="flex flex-col items-center space-y-3">
          <div className="relative w-10 h-10">
            <div className="absolute inset-0 rounded-full border-2 border-blue-500/20"></div>
            <div className="absolute inset-0 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></div>
          </div>
          <p className="text-xs font-semibold text-slate-400">Verifying workspace subscription...</p>
        </div>
      </div>
    );
  }

  // --- ROLE-BASED ACCESS CONTROL (RBAC) STRICT PROTECTION ---
  const isSuperAdminRoute = location.pathname.startsWith('/super-admin') || 
                            location.pathname.startsWith('/super_admin') ||
                            ['/admin/overview', '/admin/organizations', '/admin/plans', '/admin/subscriptions', '/admin/payments', '/admin/audit-logs', '/admin/platform-integrations'].includes(location.pathname);

  // 1. Non-Super-Admins CANNOT access Super Admin routes
  if (!isSuperAdmin && isSuperAdminRoute) {
    return <Navigate to="/dashboard" replace />;
  }

  // 2. Super Admin CANNOT access Organisation Admin and Tenant CRM pages
  const isOrgAdminRoute = ['/admin/assignment', '/admin/integrations', '/admin/mobile-sync', '/settings/billing'].includes(location.pathname);
  if (isSuperAdmin && (isOrgAdminRoute || location.pathname === '/dashboard' || location.pathname.startsWith('/crm') || location.pathname.startsWith('/accounting'))) {
    return <Navigate to="/super-admin" replace />;
  }

  // 3. Lower Tier Roles (Manager, Team Leader, Sale Executive) CANNOT access Organisation Admin pages
  if (isOrgAdminRoute && activeRole !== 'Admin') {
    return <Navigate to="/dashboard" replace />;
  }

  const toggleSidebar = () => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('artha_sidebar_collapsed', String(next));
      return next;
    });
  };

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isSuperAdminView = isSuperAdmin;

  // Nav configuration
  const navigationItems = [
    {
      name: null,
      items: [
        {
          name: isSuperAdminView ? 'Platform Overview' : 'Dashboard',
          path: isSuperAdminView ? '/super-admin' : '/dashboard',
          icon: isSuperAdminView ? Layers : LayoutDashboard,
          role: 'all',
          badge: isSuperAdminView ? 'Root' : null
        }
      ]
    },
    ...(isSuperAdminView ? [
      {
        name: 'Super Admin Command',
        items: [
          { name: 'Tenant Workspaces', path: '/super-admin/organizations', icon: Building2, role: 'superadmin', badge: null },
          { name: 'SaaS Plans (Pricing)', path: '/super-admin/plans', icon: Zap, role: 'superadmin', badge: null },
          { name: 'Tenant Subscriptions', path: '/super-admin/subscriptions', icon: ShieldCheck, role: 'superadmin', badge: null },
          { name: 'Payments Ledger', path: '/super-admin/payments', icon: CreditCard, role: 'superadmin', badge: null },
          { name: 'Support Tickets', path: '/super-admin/tickets', icon: LifeBuoy, role: 'superadmin', badge: 'Live' },
          { name: 'Platform Audits', path: '/super-admin/audit-logs', icon: FileText, role: 'superadmin', badge: null },
          { name: 'Integration Hub', path: '/super-admin/integrations', icon: Cpu, role: 'superadmin', badge: null }
        ]
      }
    ] : [
      {
        name: null,
        items: [
          { name: 'Leads Management', path: '/crm/leads', icon: Users, role: 'all', badge: null },
          { name: 'Integration Hub', path: '/admin/integrations', role: 'admin', icon: ShieldCheck, badge: null }
        ]
      },
      {
        name: null,
        items: [
          { name: 'Mobile SIM Sync', path: '/crm/mobile-sync', icon: Smartphone, role: 'all', badge: 'Live' }
        ]
      },
      {
        name: null,
        items: [
          { name: 'Quotations', path: '/accounting/quotations', icon: Award, role: 'all', badge: null },
          { name: 'Invoices & Billing', path: '/accounting/invoices', icon: Building2, role: 'all', badge: null },
          { name: 'Support Tickets', path: '/crm/reports', icon: LifeBuoy, role: 'all', badge: 'Live' },
        ]
      }
    ]),
    {
      name: null,
      items: [
        ...(!isSuperAdminView ? [{ name: 'Register Employee', path: '/admin/assignment', icon: UserPlus, role: 'admin', badge: null }] : []),
        ...(!isSuperAdminView ? [{ name: 'Plan & Billing', path: '/settings/billing', role: 'admin', icon: CreditCard, badge: null }] : [])
      ]
    }
  ];

  // Helper to filter nav items based on 4-level hierarchy
  const hasAccess = (requiredRole?: string) => {
    if (!requiredRole || requiredRole === 'all') return true;
    if (requiredRole === 'superadmin') return isSuperAdmin;
    if (requiredRole === 'admin') return !isSuperAdmin && activeRole === 'Admin';
    if (requiredRole === 'manager') return !isSuperAdmin && ['Admin', 'Manager'].includes(activeRole);
    if (requiredRole === 'teamlead') return !isSuperAdmin && ['Admin', 'Manager', 'Team Leader'].includes(activeRole);
    return false;
  };

  const renderNavSection = (section: any, sIdx: number, isCollapsed = false) => {
    const visibleSubItems = section.items.filter((sub: any) => hasAccess(sub.role));
    if (visibleSubItems.length === 0) return null;

    return (
      <div key={sIdx} className="space-y-1">
        {!isCollapsed && section.name ? (
          <div className="px-3 pt-3 pb-1.5 flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              {section.name}
            </span>
          </div>
        ) : sIdx > 0 ? (
          <div className="pt-2 pb-1">
            <div className={`border-t border-slate-200 dark:border-dark-800 ${isCollapsed ? 'mx-1' : 'mx-2'}`}></div>
          </div>
        ) : null}
        <div className="space-y-0.5">
          {visibleSubItems.map((sub: any, idx: number) => {
            const Icon = sub.icon;
            const isLeadSubRoute = sub.path === '/crm/leads' && (
              location.pathname.startsWith('/crm/leads') ||
              location.pathname.startsWith('/crm/today') ||
              location.pathname.startsWith('/crm/open-leads') ||
              location.pathname.startsWith('/crm/followup-leads') ||
              location.pathname.startsWith('/crm/converted-leads') ||
              location.pathname.startsWith('/crm/lost-leads')
            );
            const isActive = location.pathname === sub.path || isLeadSubRoute || (sub.path !== '/dashboard' && sub.path !== '/crm/leads' && location.pathname.startsWith(sub.path));
            return (
              <Link
                key={idx}
                to={sub.path}
                onClick={() => setMobileOpen(false)}
                title={isCollapsed ? sub.name : undefined}
                className={`group flex items-center rounded-xl text-xs font-bold transition-all ${isCollapsed
                  ? 'justify-center p-2.5 my-1 relative'
                  : 'justify-between px-3 py-2'
                  } ${isActive
                    ? 'bg-[linear-gradient(45deg,rgba(249,115,22,0.18)_0%,rgba(16,185,129,0.15)_50%,rgba(37,99,235,0.18)_100%)] text-slate-900 dark:text-white font-black border-l-4 border-emerald-500 shadow-sm ring-1 ring-emerald-500/25'
                    : 'text-slate-700 hover:text-slate-950 hover:bg-emerald-50/40 dark:text-slate-200 dark:hover:text-white dark:hover:bg-dark-800'
                  }`}
              >
                <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'space-x-2.5 min-w-0'}`}>
                  <div className={`p-1 rounded-lg transition-colors ${isActive
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-slate-500 group-hover:text-emerald-600 dark:text-slate-400 dark:group-hover:text-emerald-400'
                    }`}>
                    <Icon className="h-4 w-4 flex-shrink-0" />
                  </div>
                  {!isCollapsed && <span className="truncate">{sub.name}</span>}
                </div>

                {/* Badges */}
                {!isCollapsed && sub.badge && (
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${sub.badge === 'Live'
                    ? 'bg-[linear-gradient(45deg,rgba(249,115,22,0.2)_0%,rgba(16,185,129,0.2)_50%,rgba(37,99,235,0.2)_100%)] text-emerald-800 dark:text-emerald-300 border border-emerald-400/40'
                    : 'bg-blue-100 text-blue-800 border border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800'
                    }`}>
                    {sub.badge}
                  </span>
                )}

                {isCollapsed && sub.badge && (
                  <span className={`absolute top-1 right-1 w-2 h-2 rounded-full ${sub.badge === 'Live' ? 'bg-emerald-500 ring-2 ring-white dark:ring-dark-900' : 'bg-blue-500'
                    }`} />
                )}
              </Link>
            );
          })}
        </div>
      </div>
    );
  };

  // Greeting time calculation
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="h-screen flex overflow-hidden bg-slate-50/70 dark:bg-dark-950 font-sans antialiased">
      {/* 1. Desktop Sidebar */}
      <aside className="hidden md:flex md:flex-shrink-0">
        <div
          className={`flex flex-col border-r border-slate-300 dark:border-dark-800 bg-white dark:bg-dark-900 shadow-[1px_0_4px_rgba(0,0,0,0.02)] transition-all duration-300 ease-in-out relative ${sidebarCollapsed ? 'w-20' : 'w-64'
            }`}
        >
          {/* Logo Brand Header */}
          <div className={`flex items-center h-16 border-b border-slate-200 dark:border-dark-800 ${sidebarCollapsed ? 'justify-center px-2' : 'justify-between px-4'}`}>
            <Link to="/dashboard" className="flex items-center space-x-2.5 group min-w-0" title={sidebarCollapsed ? 'PCS CRM' : undefined}>
              {sidebarCollapsed ? (
                <img src="/logo.svg" alt="PCS Logo" className="h-8 w-auto max-w-[50px] object-contain transition group-hover:scale-105 dark:brightness-110" />
              ) : (
                <div className="flex items-center space-x-2 min-w-0">
                  <img src="/logo.svg" alt="PCS Logo" className="h-9 w-auto max-w-[120px] object-contain transition group-hover:scale-105 dark:brightness-110" />
                  <span className="text-[10px] font-black bg-[linear-gradient(45deg,#ef4444_0%,#6366f1_50%,#2563eb_100%)] text-white px-2 py-0.5 rounded-md shadow-sm uppercase tracking-wider">
                    CRM
                  </span>
                </div>
              )}
            </Link>

            {/* Expand / Shrink Arrow Toggle Button */}
            {!sidebarCollapsed && (
              <button
                onClick={toggleSidebar}
                className="p-1.5 rounded-lg text-slate-500 hover:text-orange-600 dark:text-slate-400 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-dark-800 transition border border-slate-200 dark:border-dark-700 shadow-sm"
                title="Shrink sidebar"
                aria-label="Shrink sidebar"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Floating Expand Arrow when Collapsed */}
          {sidebarCollapsed && (
            <div className="pt-2 px-2 flex justify-center">
              <button
                onClick={toggleSidebar}
                className="w-full py-1.5 rounded-lg bg-slate-100 dark:bg-dark-800 text-slate-600 dark:text-slate-300 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-dark-700 transition flex items-center justify-center border border-slate-200 dark:border-dark-700 shadow-sm"
                title="Expand sidebar"
                aria-label="Expand sidebar"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}

          <div className={`flex-1 flex flex-col overflow-y-auto py-3 space-y-3 ${sidebarCollapsed ? 'px-2' : 'px-3.5'}`}>
            {/* Active Workspace / Org Card */}
            {!sidebarCollapsed ? (
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-dark-800/80 border border-slate-200 dark:border-dark-700 flex items-center space-x-2.5 hover:bg-orange-50/50 transition cursor-default">
                <div className="w-7 h-7 rounded-lg bg-orange-500/15 text-orange-600 dark:text-orange-400 flex items-center justify-center flex-shrink-0 font-bold">
                  <Building2 className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-black text-slate-950 dark:text-slate-100 truncate">
                      PCS
                    </p>
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></span>
                  </div>
                  <p className="text-[10px] text-blue-700 dark:text-blue-300 font-bold truncate">
                    Single Organization
                  </p>
                </div>
              </div>
            ) : (
              <div
                className="p-2 rounded-xl bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 flex items-center justify-center cursor-default"
                title="PCS (Single Organization)"
              >
                <Building2 className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              </div>
            )}

            {/* Nav Groups */}
            <nav className="flex-1 space-y-2">
              {navigationItems.map((section, idx) => renderNavSection(section, idx, sidebarCollapsed))}
            </nav>
          </div>

          {/* User Profile Footer */}
          <div className={`border-t border-slate-200 dark:border-dark-800 bg-slate-50/90 dark:bg-dark-950/80 ${sidebarCollapsed ? 'p-2' : 'p-3'}`}>
            {!sidebarCollapsed ? (
              <div className="flex items-center justify-between p-1.5 rounded-xl hover:bg-white dark:hover:bg-dark-800 transition border border-transparent hover:border-slate-200 dark:border-dark-700 shadow-none hover:shadow-sm">
                <div className="flex items-center space-x-2.5 overflow-hidden">
                  <div className="relative flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-[linear-gradient(45deg,#ef4444_0%,#6366f1_50%,#2563eb_100%)] text-white flex items-center justify-center font-black text-xs shadow-sm">
                      {(user?.firstName || 'U').charAt(0)}{(user?.lastName || '').charAt(0)}
                    </div>
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-dark-900"></span>
                  </div>
                  <div className="overflow-hidden min-w-0">
                    <p className="text-xs font-black text-slate-950 dark:text-dark-100 truncate">
                      {user?.firstName} {user?.lastName}
                    </p>
                    <span className="inline-block text-[9px] font-extrabold text-blue-700 dark:text-blue-400 uppercase tracking-wider truncate">
                      {activeRole === 'Admin' || activeRole === 'Super Admin' ? '1. Admin' :
                        activeRole === 'Manager' ? '2. Manager' :
                          activeRole === 'Team Leader' ? '3. Team Leader' : '4. Sale Executive'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                  title="Sign Out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center space-y-2 py-1">
                <div
                  className="relative flex-shrink-0"
                  title={`${user?.firstName} ${user?.lastName} (${activeRole})`}
                >
                  <div className="w-8 h-8 rounded-full bg-[linear-gradient(45deg,#ef4444_0%,#6366f1_50%,#2563eb_100%)] text-white flex items-center justify-center font-black text-xs shadow-sm">
                    {(user?.firstName || 'U').charAt(0)}{(user?.lastName || '').charAt(0)}
                  </div>
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-dark-900"></span>
                </div>
                <button
                  onClick={handleLogout}
                  className="text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                  title="Sign Out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* 2. Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity" onClick={() => setMobileOpen(false)}></div>
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white dark:bg-dark-900 border-r border-slate-200 dark:border-dark-800 shadow-2xl">
            <div className="flex items-center justify-between h-16 px-5 border-b border-slate-100 dark:border-dark-800">
              <div className="flex items-center space-x-2.5">
                <img src="/logo.svg" alt="PCS Logo" className="h-8 w-auto max-w-[110px] object-contain dark:brightness-110 flex-shrink-0" />
                <span className="text-[10px] font-black bg-[linear-gradient(45deg,#ef4444_0%,#6366f1_50%,#2563eb_100%)] text-white px-2 py-0.5 rounded-md shadow-sm uppercase tracking-wider">
                  CRM
                </span>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-dark-800 focus:outline-none transition"
                aria-label="Close navigation menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 flex flex-col overflow-y-auto px-4 py-4 space-y-3">
              <nav className="flex-1 space-y-2">
                {navigationItems.map((section, idx) => renderNavSection(section, idx))}
              </nav>
            </div>

            <div className="border-t border-slate-100 dark:border-dark-800 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-full bg-[linear-gradient(45deg,#ef4444_0%,#6366f1_50%,#2563eb_100%)] text-white flex items-center justify-center font-bold text-xs">
                    {(user?.firstName || 'U').charAt(0)}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800 dark:text-dark-200">{user?.firstName}</p>
                    <p className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold">{activeRole}</p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition"
                  title="Sign Out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Main Workspace Area */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top Header Bar */}
        <header className="h-14 sm:h-16 flex items-center justify-between bg-white/95 backdrop-blur-md dark:bg-dark-900/95 border-b border-slate-200 dark:border-dark-800 px-3 sm:px-6 z-10 sticky top-0 shadow-xs relative">
          {/* 45° Red & Blue gradient hairline */}
          <div className="h-[2px] w-full bg-[linear-gradient(45deg,#ef4444_0%,#6366f1_50%,#2563eb_100%)] absolute top-0 left-0"></div>

          {/* Left: Mobile Menu & Logo on mobile, Greeting on desktop */}
          <div className="flex items-center space-x-2 sm:space-x-4 min-w-0">
            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setMobileOpen(true)}
              className="md:hidden p-1.5 rounded-xl text-slate-700 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-dark-800 focus:outline-none transition"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Mobile Brand Logo */}
            <Link to="/dashboard" className="md:hidden flex items-center space-x-1.5 flex-shrink-0" title="PCS CRM">
              <img src="/logo.svg" alt="PCS Logo" className="h-7 w-auto max-w-[70px] object-contain dark:brightness-110" />
              <span className="text-[9px] font-black bg-[linear-gradient(45deg,#ef4444_0%,#6366f1_50%,#2563eb_100%)] text-white px-1.5 py-0.5 rounded shadow-xs uppercase tracking-wider">
                CRM
              </span>
            </Link>

            {/* Desktop Greeting */}
            <div className="hidden md:block">
              <h1 className="text-lg lg:text-xl font-extrabold text-slate-950 dark:text-white tracking-tight leading-tight truncate">
                {getGreeting()}, {user?.firstName || 'Shivam'}! 🙏
              </h1>
            </div>

            {/* Badges (desktop / tablet) */}
            <div className="hidden lg:flex items-center space-x-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <div className="flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700">
                <Building2 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                <span className="text-slate-300 dark:text-dark-600">&bull;</span>
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></span>
                <span className="text-[10px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                  Live Sync
                </span>
              </div>

              {/* Live Subscription Status Pill / Super Admin Badge */}
              {!isSuperAdmin ? (
                <Link
                  to="/settings/billing"
                  className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-[linear-gradient(45deg,rgba(249,115,22,0.15)_0%,rgba(16,185,129,0.12)_50%,rgba(37,99,235,0.15)_100%)] border border-emerald-500/30 text-slate-800 dark:text-slate-200 hover:opacity-95 transition shadow-xs"
                  title="Manage Subscription Plan"
                >
                  <Zap className="h-3 w-3 text-orange-600 dark:text-orange-400" />
                  <span className="text-[10px] font-black uppercase tracking-wider">
                    {subData?.subscription?.planName || 'Plan Active'}
                  </span>
                  <span className="text-emerald-500">&bull;</span>
                  <span className="text-[10px] font-bold">
                    {subData?.daysRemaining ?? 30}d left
                  </span>
                </Link>
              ) : (
                <Link
                  to="/super-admin"
                  className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-[linear-gradient(45deg,rgba(249,115,22,0.15)_0%,rgba(16,185,129,0.12)_50%,rgba(37,99,235,0.15)_100%)] border border-blue-500/30 text-slate-800 dark:text-slate-200 hover:opacity-95 transition shadow-xs"
                  title="Super Admin Master Control"
                >
                  <ShieldCheck className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  <span className="text-[10px] font-black uppercase tracking-wider">
                    Super Admin Root
                  </span>
                </Link>
              )}
            </div>
          </div>

          {/* Right Header: Search, Actions, Theme Toggle, Profile */}
          <div className="flex items-center space-x-2 sm:space-x-3 flex-shrink-0">
            {/* Quick Add Lead Button */}
            <button
              onClick={() => {
                if (location.pathname === '/crm/leads') {
                  window.dispatchEvent(new CustomEvent('open-new-lead-modal'));
                } else {
                  navigate('/crm/leads?new=true');
                }
              }}
              className="inline-flex items-center space-x-1 sm:space-x-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-[linear-gradient(45deg,#ef4444_0%,#6366f1_50%,#2563eb_100%)] hover:brightness-110 text-white font-black text-xs shadow-md transition active:scale-95 cursor-pointer"
              title="Add New Lead"
            >
              <PlusCircle className="h-3.5 w-3.5 flex-shrink-0" />
              <span>Add Lead</span>
            </button>

            {/* Bulk Upload Leads Button - Hidden on small mobile to prevent header blowout */}
            <Link
              to="/crm/bulk-upload"
              className="hidden sm:inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-[linear-gradient(45deg,#2563eb_0%,#6366f1_50%,#ef4444_100%)] hover:brightness-110 text-white font-black text-xs shadow-md transition active:scale-95"
              title="Bulk Upload Leads via CSV/Excel"
            >
              <Upload className="h-3.5 w-3.5 flex-shrink-0" />
              <span>Bulk Upload</span>
            </Link>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white p-1.5 sm:p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-dark-800 transition"
              title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
              aria-label="Toggle theme"
            >
              {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4 text-amber-400" />}
            </button>
          </div>
        </header>

        {/* Dynamic Page Scroll Content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-slate-50/60 dark:bg-dark-950 p-3.5 sm:p-5 md:p-7">
          <Outlet />
        </main>
      </div>
    </div>
  );
};