import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { 
  Building2, Search, Plus, Trash2, X, AlertTriangle 
} from 'lucide-react';

export const AdminOrganizations: React.FC = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  // Form State
  const [name, setName] = useState('');
  const [businessType, setBusinessType] = useState('general');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [adminFirstName, setAdminFirstName] = useState('');
  const [adminLastName, setAdminLastName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [planId, setPlanId] = useState('');

  // Fetch all organizations with user counts & subscriptions
  const { data: organizations, isLoading: isLoadingOrgs } = useQuery({
    queryKey: ['admin-organizations-page'],
    queryFn: async () => {
      const res = await api.get('/admin/organizations');
      return res.data.data;
    }
  });

  // Fetch plans for selector
  const { data: plans } = useQuery({
    queryKey: ['admin-plans-list'],
    queryFn: async () => {
      const res = await api.get('/admin/plans');
      return res.data.data || [];
    }
  });

  // Create Organization Mutation
  const createOrgMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post('/admin/organizations', payload);
      return res.data;
    },
    onSuccess: (data) => {
      alert(data.message || 'Tenant organization provisioned successfully!');
      queryClient.invalidateQueries({ queryKey: ['admin-organizations-page'] });
      queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
      setShowCreateModal(false);
      resetForm();
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to provision organization.');
    }
  });

  // Delete Organization Mutation
  const deleteOrgMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/admin/organizations/${id}`);
      return res.data;
    },
    onSuccess: (data) => {
      alert(data.message || 'Tenant organization deleted.');
      queryClient.invalidateQueries({ queryKey: ['admin-organizations-page'] });
      queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
      setDeleteTarget(null);
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to delete organization.');
    }
  });

  // Toggle Suspension Mutation
  const toggleSuspensionMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const res = await api.patch(`/admin/organizations/${id}/toggle-suspension`, { reason });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-organizations-page'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to update suspension status.');
    }
  });

  const resetForm = () => {
    setName('');
    setBusinessType('general');
    setPhone('');
    setEmail('');
    setWebsite('');
    setAdminFirstName('');
    setAdminLastName('');
    setAdminEmail('');
    setAdminPassword('');
    setPlanId('');
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !adminFirstName || !adminLastName || !adminEmail || !adminPassword) {
      alert('Please fill out all required organization and admin fields.');
      return;
    }
    createOrgMutation.mutate({
      name,
      businessType,
      phone,
      email,
      website,
      adminFirstName,
      adminLastName,
      adminEmail,
      adminPassword,
      planId: planId || undefined
    });
  };

  const filteredOrgs = (organizations || []).filter((org: any) => {
    return (
      org.name?.toLowerCase().includes(search.toLowerCase()) || 
      (org.email && org.email.toLowerCase().includes(search.toLowerCase()))
    );
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-primary-600 dark:text-primary-400 text-xs font-bold uppercase tracking-wider mb-1">
            <Building2 className="h-4 w-4" />
            <span>Tenant Governance</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Tenant Organizations</h1>
          <p className="text-xs text-slate-500 dark:text-dark-400 mt-0.5">
            Provision new isolated CRM tenants, assign Organization Admins, configure SaaS subscriptions, and manage workspace status.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center space-x-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition"
        >
          <Plus className="h-4 w-4" />
          <span>Provision New Tenant</span>
        </button>
      </div>

      {/* Search and Metric Filter */}
      <div className="bg-white dark:bg-dark-900 p-4 rounded-2xl border border-slate-200 dark:border-dark-800 flex items-center justify-between gap-4">
        <div className="relative max-w-md w-full">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search organizations by name or email..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 rounded-xl text-xs outline-none"
          />
        </div>
        <div className="text-xs font-bold text-slate-500 dark:text-dark-400">
          Total Organizations: <span className="text-blue-600 dark:text-blue-400 font-extrabold">{organizations?.length || 0}</span>
        </div>
      </div>

      {/* Organizations Table */}
      <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-dark-800 bg-slate-50/50 dark:bg-dark-950/40 text-slate-400 font-semibold uppercase tracking-wider">
                <th className="py-3.5 pl-6">Workspace Name</th>
                <th className="py-3.5">Contact Email</th>
                <th className="py-3.5">Team Size</th>
                <th className="py-3.5">Active Plan</th>
                <th className="py-3.5">Registered On</th>
                <th className="py-3.5">Status</th>
                <th className="py-3.5 pr-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-dark-800">
              {isLoadingOrgs ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Loading organizations...
                  </td>
                </tr>
              ) : filteredOrgs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No organizations found.
                  </td>
                </tr>
              ) : (
                filteredOrgs.map((org: any) => {
                  const isRootOrg = org.name === 'PCS';
                  const orgId = org._id || org.id;

                  return (
                    <tr key={orgId} className="hover:bg-slate-50/80 dark:hover:bg-dark-800/40 transition">
                      <td className="py-4 pl-6">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-slate-900 dark:text-white block">{org.name}</span>
                          {isRootOrg && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300">
                              Root Platform
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 capitalize">{org.businessType || 'General'} Workspace</span>
                      </td>

                      <td className="py-4 text-slate-600 dark:text-dark-300">
                        {org.email || 'No email provided'}
                      </td>

                      <td className="py-4 font-bold text-slate-800 dark:text-white">
                        {org.userCount || 1} Members
                      </td>

                      <td className="py-4 font-bold text-blue-600 dark:text-blue-400">
                        {org.subscription?.planName || 'Starter'}
                      </td>

                      <td className="py-4 text-slate-500">
                        {new Date(org.createdAt).toLocaleDateString()}
                      </td>

                      <td className="py-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                          org.isSuspended 
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300' 
                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        }`}>
                          {org.isSuspended ? 'Suspended' : 'Active'}
                        </span>
                      </td>

                      <td className="py-4 pr-6 text-right">
                        <div className="inline-flex items-center space-x-2">
                          <button
                            onClick={() => toggleSuspensionMutation.mutate({ 
                              id: orgId, 
                              reason: org.isSuspended ? 'Reactivated by Super Admin' : 'Suspended by Super Admin' 
                            })}
                            disabled={toggleSuspensionMutation.isPending || isRootOrg}
                            className={`px-3 py-1.5 rounded-xl font-bold text-[11px] transition ${
                              isRootOrg
                                ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 dark:bg-dark-800 dark:text-dark-500'
                                : org.isSuspended
                                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                  : 'bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                            }`}
                          >
                            {org.isSuspended ? 'Reactivate' : 'Suspend'}
                          </button>

                          {!isRootOrg && (
                            <button
                              onClick={() => setDeleteTarget(org)}
                              title="Delete Tenant Workspace"
                              className="p-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:hover:bg-rose-950/60 dark:text-rose-400 transition"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* PROVISION NEW TENANT MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-dark-800 pb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
                  <Building2 className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Provision New Tenant Workspace</h3>
                  <p className="text-xs text-slate-500 dark:text-dark-400">Create an isolated organization, dedicated schema, and Organization Admin.</p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Organization Details</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-dark-300 mb-1">Company / Organization Name *</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Apex Wealth Solutions"
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-dark-300 mb-1">Business Domain Type</label>
                    <select
                      value={businessType}
                      onChange={(e) => setBusinessType(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="general">General CRM & Sales</option>
                      <option value="loan">Business Loan & Finance</option>
                      <option value="registration">Company & Tax Registration</option>
                      <option value="certification">ISO & Compliance Certification</option>
                      <option value="custom">Custom Service Operations</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-dark-300 mb-1">Contact Phone</label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="e.g. +91 98765 43210"
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-dark-300 mb-1">Official Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. info@apexwealth.com"
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-dark-800">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Organization Admin Account</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-dark-300 mb-1">Admin First Name *</label>
                    <input
                      type="text"
                      required
                      value={adminFirstName}
                      onChange={(e) => setAdminFirstName(e.target.value)}
                      placeholder="e.g. Rajesh"
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-dark-300 mb-1">Admin Last Name *</label>
                    <input
                      type="text"
                      required
                      value={adminLastName}
                      onChange={(e) => setAdminLastName(e.target.value)}
                      placeholder="e.g. Sharma"
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-dark-300 mb-1">Admin Login Email *</label>
                    <input
                      type="email"
                      required
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      placeholder="e.g. rajesh@apexwealth.com"
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-dark-300 mb-1">Initial Password *</label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      placeholder="Min 6 characters"
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-dark-800">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">SaaS Plan & Subscription</h4>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-dark-300 mb-1">Assign Initial SaaS Plan</label>
                  <select
                    value={planId}
                    onChange={(e) => setPlanId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  >
                    <option value="">Default Starter / Trial Plan</option>
                    {(plans || []).map((p: any) => (
                      <option key={p._id || p.id} value={p._id || p.id}>
                        {p.name} (₹{p.price} / {p.duration} {p.durationUnit}) - {p.maxUsers} Users Limit
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-dark-700 text-xs font-bold text-slate-600 dark:text-dark-300 hover:bg-slate-50 dark:hover:bg-dark-800 transition"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={createOrgMutation.isPending}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md transition disabled:opacity-50"
                >
                  {createOrgMutation.isPending ? 'Provisioning Tenant Workspace...' : 'Provision Organization'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="h-6 w-6" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Delete Tenant Organization?</h3>
            </div>
            
            <p className="text-xs text-slate-600 dark:text-dark-300 leading-relaxed">
              Are you sure you want to permanently delete <strong className="text-slate-900 dark:text-white">"{deleteTarget.name}"</strong>? 
              This will drop all CRM leads, contacts, deals, invoices, and employee logins associated with this organization.
            </p>

            <div className="pt-4 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-dark-700 text-xs font-bold text-slate-600 dark:text-dark-300 hover:bg-slate-50 dark:hover:bg-dark-800 transition"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => deleteOrgMutation.mutate(deleteTarget._id || deleteTarget.id)}
                disabled={deleteOrgMutation.isPending}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md transition disabled:opacity-50"
              >
                {deleteOrgMutation.isPending ? 'Deleting Tenant...' : 'Yes, Delete Tenant'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
