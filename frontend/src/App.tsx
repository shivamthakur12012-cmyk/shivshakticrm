import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthLayout } from './layouts/AuthLayout';
import { DashboardLayout } from './layouts/DashboardLayout';
import { useAuthStore, getCachedSubscriptionExpired } from './store/authStore';

// Dynamic Code-Splitted Imports
const Login = lazy(() => import('./pages/auth/Login').then(m => ({ default: m.Login })));
const Register = lazy(() => import('./pages/auth/Register').then(m => ({ default: m.Register })));
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword').then(m => ({ default: m.ForgotPassword })));
const ResetPassword = lazy(() => import('./pages/auth/ResetPassword').then(m => ({ default: m.ResetPassword })));
const Onboarding = lazy(() => import('./pages/auth/Onboarding').then(m => ({ default: m.Onboarding })));

const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const LeadsList = lazy(() => import('./pages/crm/LeadsList').then(m => ({ default: m.LeadsList })));
const LeadDetail = lazy(() => import('./pages/crm/LeadDetail').then(m => ({ default: m.LeadDetail })));
const BulkUpload = lazy(() => import('./pages/crm/BulkUpload').then(m => ({ default: m.BulkUpload })));

const QuotationsList = lazy(() => import('./pages/accounting/QuotationsList').then(m => ({ default: m.QuotationsList })));
const QuotationBuilder = lazy(() => import('./pages/accounting/QuotationBuilder').then(m => ({ default: m.QuotationBuilder })));
const InvoicesList = lazy(() => import('./pages/accounting/InvoicesList').then(m => ({ default: m.InvoicesList })));
const InvoiceForm = lazy(() => import('./pages/accounting/InvoiceForm').then(m => ({ default: m.InvoiceForm })));
const InvoiceDetail = lazy(() => import('./pages/accounting/InvoiceDetail').then(m => ({ default: m.InvoiceDetail })));
const ClientReportsHelpdesk = lazy(() => import('./pages/crm/ClientReportsHelpdesk').then(m => ({ default: m.ClientReportsHelpdesk })));
const PublicIssueReport = lazy(() => import('./pages/public/PublicIssueReport').then(m => ({ default: m.PublicIssueReport })));

const AdminAssignment = lazy(() => import('./pages/admin/AdminAssignment').then(m => ({ default: m.AdminAssignment })));
const IntegrationHub = lazy(() => import('./pages/admin/IntegrationHub').then(m => ({ default: m.IntegrationHub })));
const MobileSyncHub = lazy(() => import('./pages/admin/MobileSyncHub').then(m => ({ default: m.MobileSyncHub })));

// SaaS Paywall, Billing, and Super Admin Management
const SubscriptionPaywall = lazy(() => import('./pages/SubscriptionPaywall').then(m => ({ default: m.SubscriptionPaywall })));
const PricingPage = lazy(() => import('./pages/PricingPage').then(m => ({ default: m.PricingPage })));
const BillingSettings = lazy(() => import('./pages/settings/BillingSettings').then(m => ({ default: m.BillingSettings })));
const AdminOverview = lazy(() => import('./pages/admin/AdminOverview').then(m => ({ default: m.AdminOverview })));
const AdminOrganizations = lazy(() => import('./pages/admin/AdminOrganizations').then(m => ({ default: m.AdminOrganizations })));
const AdminPlans = lazy(() => import('./pages/admin/AdminPlans').then(m => ({ default: m.AdminPlans })));
const AdminSubscriptions = lazy(() => import('./pages/admin/AdminSubscriptions').then(m => ({ default: m.AdminSubscriptions })));
const AdminPayments = lazy(() => import('./pages/admin/AdminPayments').then(m => ({ default: m.AdminPayments })));
const AdminAuditLogs = lazy(() => import('./pages/admin/AdminAuditLogs').then(m => ({ default: m.AdminAuditLogs })));
const SuperAdminIntegrations = lazy(() => import('./pages/admin/SuperAdminIntegrations').then(m => ({ default: m.SuperAdminIntegrations })));

import { RoleRoute } from './components/auth/RoleRoute';

// Sleek fallback component for chunk loading
const PageLoader: React.FC = () => (
  <div className="flex items-center justify-center min-h-[50vh] w-full py-16">
    <div className="flex flex-col items-center space-y-3">
      <div className="relative w-10 h-10">
        <div className="absolute inset-0 rounded-full border-2 border-brand-500/20"></div>
        <div className="absolute inset-0 rounded-full border-2 border-brand-500 border-t-transparent animate-spin"></div>
      </div>
      <p className="text-xs font-medium text-slate-400 dark:text-dark-400">Loading module...</p>
    </div>
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 60 * 1000,
      gcTime: 10 * 60 * 1000,
    }
  }
});

const RootRedirect: React.FC = () => {
  const { user, activeOrganizationId, organizations } = useAuthStore();
  const isSuperAdmin = user?.role === 'Super Admin' || (user as any)?.isSuperAdmin || user?.email === 'shivamthakur12012@gmail.com';
  if (isSuperAdmin) {
    return <Navigate to="/super-admin" replace />;
  }

  const activeOrgId = activeOrganizationId || organizations[0]?.id;
  const isExpired = getCachedSubscriptionExpired(activeOrgId);
  if (isExpired === true) {
    return <Navigate to="/subscription" replace />;
  }

  return <Navigate to="/dashboard" replace />;
};

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public Auth Routes */}
            <Route element={<AuthLayout />}>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
            </Route>

            {/* Standalone Fullscreen Onboarding, Paywall & Direct Client Issue Portal */}
            <Route path="/onboarding" element={<RoleRoute disallowSuperAdmin><Onboarding /></RoleRoute>} />
            <Route path="/subscription" element={<RoleRoute disallowSuperAdmin><SubscriptionPaywall /></RoleRoute>} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/report-issue" element={<PublicIssueReport />} />
            <Route path="/support/report" element={<PublicIssueReport />} />

            {/* Protected Main CRM Application */}
            <Route element={<DashboardLayout />}>
              <Route path="/" element={<RootRedirect />} />
              <Route path="/dashboard" element={<RoleRoute disallowSuperAdmin><Dashboard /></RoleRoute>} />

              {/* 1. Lead Management Module */}
              <Route path="/crm/leads" element={<RoleRoute disallowSuperAdmin><LeadsList defaultMode="all" /></RoleRoute>} />
              <Route path="/crm/today-leads" element={<RoleRoute disallowSuperAdmin><LeadsList defaultMode="today" /></RoleRoute>} />
              <Route path="/crm/today-assigned-leads" element={<RoleRoute disallowSuperAdmin><LeadsList defaultMode="today" /></RoleRoute>} />
              <Route path="/crm/open-leads" element={<RoleRoute disallowSuperAdmin><LeadsList defaultMode="open" /></RoleRoute>} />
              <Route path="/crm/followup-leads" element={<RoleRoute disallowSuperAdmin><LeadsList defaultMode="followup" /></RoleRoute>} />
              <Route path="/crm/follow-up-leads" element={<RoleRoute disallowSuperAdmin><LeadsList defaultMode="followup" /></RoleRoute>} />
              <Route path="/crm/converted-leads" element={<RoleRoute disallowSuperAdmin><LeadsList defaultMode="converted" /></RoleRoute>} />
              <Route path="/crm/lost-leads" element={<RoleRoute disallowSuperAdmin><LeadsList defaultMode="lost" /></RoleRoute>} />
              <Route path="/crm/leads/:id" element={<RoleRoute disallowSuperAdmin><LeadDetail /></RoleRoute>} />
              <Route path="/crm/bulk-upload" element={<RoleRoute disallowSuperAdmin minRole="Manager"><BulkUpload /></RoleRoute>} />
              <Route path="/crm/reports" element={<RoleRoute disallowSuperAdmin><ClientReportsHelpdesk /></RoleRoute>} />
              <Route path="/crm/tickets" element={<RoleRoute disallowSuperAdmin><ClientReportsHelpdesk /></RoleRoute>} />

              {/* 2. Communication & Sync Modules */}
              <Route path="/crm/followups" element={<Navigate to="/crm/followup-leads" replace />} />
              <Route path="/crm/follow-up" element={<Navigate to="/crm/followup-leads" replace />} />
              <Route path="/crm/mobile-sync" element={<RoleRoute disallowSuperAdmin><MobileSyncHub /></RoleRoute>} />

              {/* 3. Quotation & Billing Module */}
              <Route path="/accounting/quotations" element={<RoleRoute disallowSuperAdmin><QuotationsList /></RoleRoute>} />
              <Route path="/accounting/quotations/new" element={<RoleRoute disallowSuperAdmin><QuotationBuilder /></RoleRoute>} />
              <Route path="/accounting/quotations/:id" element={<RoleRoute disallowSuperAdmin><QuotationBuilder /></RoleRoute>} />
              <Route path="/accounting/invoices" element={<RoleRoute disallowSuperAdmin><InvoicesList /></RoleRoute>} />
              <Route path="/accounting/invoices/new" element={<RoleRoute disallowSuperAdmin><InvoiceForm /></RoleRoute>} />
              <Route path="/accounting/invoices/:id" element={<RoleRoute disallowSuperAdmin><InvoiceDetail /></RoleRoute>} />

              {/* 4. Admin Assignment & Integrations Panel (Organization Admin ONLY) */}
              <Route path="/admin/assignment" element={<RoleRoute allowOrgAdminOnly><AdminAssignment /></RoleRoute>} />
              <Route path="/admin/integrations" element={<RoleRoute allowOrgAdminOnly><IntegrationHub /></RoleRoute>} />
              <Route path="/admin/mobile-sync" element={<RoleRoute allowOrgAdminOnly><MobileSyncHub /></RoleRoute>} />

              {/* 5. Super Admin SaaS Management (Dedicated to Super Admin only) */}
              <Route path="/super-admin" element={<RoleRoute allowSuperAdminOnly><AdminOverview /></RoleRoute>} />
              <Route path="/super-admin/organizations" element={<RoleRoute allowSuperAdminOnly><AdminOrganizations /></RoleRoute>} />
              <Route path="/super-admin/plans" element={<RoleRoute allowSuperAdminOnly><AdminPlans /></RoleRoute>} />
              <Route path="/super-admin/subscriptions" element={<RoleRoute allowSuperAdminOnly><AdminSubscriptions /></RoleRoute>} />
              <Route path="/super-admin/payments" element={<RoleRoute allowSuperAdminOnly><AdminPayments /></RoleRoute>} />
              <Route path="/super-admin/tickets" element={<RoleRoute allowSuperAdminOnly><ClientReportsHelpdesk /></RoleRoute>} />
              <Route path="/super-admin/audit-logs" element={<RoleRoute allowSuperAdminOnly><AdminAuditLogs /></RoleRoute>} />
              <Route path="/super-admin/integrations" element={<RoleRoute allowSuperAdminOnly><SuperAdminIntegrations /></RoleRoute>} />

              {/* Super Admin Underscore Aliases */}
              <Route path="/super_admin" element={<RoleRoute allowSuperAdminOnly><AdminOverview /></RoleRoute>} />
              <Route path="/super_admin/organizations" element={<RoleRoute allowSuperAdminOnly><AdminOrganizations /></RoleRoute>} />
              <Route path="/super_admin/plans" element={<RoleRoute allowSuperAdminOnly><AdminPlans /></RoleRoute>} />
              <Route path="/super_admin/subscriptions" element={<RoleRoute allowSuperAdminOnly><AdminSubscriptions /></RoleRoute>} />
              <Route path="/super_admin/payments" element={<RoleRoute allowSuperAdminOnly><AdminPayments /></RoleRoute>} />
              <Route path="/super_admin/tickets" element={<RoleRoute allowSuperAdminOnly><ClientReportsHelpdesk /></RoleRoute>} />
              <Route path="/super_admin/audit-logs" element={<RoleRoute allowSuperAdminOnly><AdminAuditLogs /></RoleRoute>} />
              <Route path="/super_admin/integrations" element={<RoleRoute allowSuperAdminOnly><SuperAdminIntegrations /></RoleRoute>} />

              {/* Admin Aliases for Super Admin platform pages */}
              <Route path="/admin/overview" element={<RoleRoute allowSuperAdminOnly><AdminOverview /></RoleRoute>} />
              <Route path="/admin/organizations" element={<RoleRoute allowSuperAdminOnly><AdminOrganizations /></RoleRoute>} />
              <Route path="/admin/plans" element={<RoleRoute allowSuperAdminOnly><AdminPlans /></RoleRoute>} />
              <Route path="/admin/subscriptions" element={<RoleRoute allowSuperAdminOnly><AdminSubscriptions /></RoleRoute>} />
              <Route path="/admin/payments" element={<RoleRoute allowSuperAdminOnly><AdminPayments /></RoleRoute>} />
              <Route path="/admin/tickets" element={<RoleRoute allowSuperAdminOnly><ClientReportsHelpdesk /></RoleRoute>} />
              <Route path="/admin/audit-logs" element={<RoleRoute allowSuperAdminOnly><AdminAuditLogs /></RoleRoute>} />
              <Route path="/admin/platform-integrations" element={<RoleRoute allowSuperAdminOnly><SuperAdminIntegrations /></RoleRoute>} />

              {/* 6. Organization Billing (Organization Admin ONLY) */}
              <Route path="/settings/billing" element={<RoleRoute allowOrgAdminOnly><BillingSettings /></RoleRoute>} />
            </Route>

            {/* Catch-all redirect */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
