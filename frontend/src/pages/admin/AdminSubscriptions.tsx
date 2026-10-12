import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { 
  CreditCard, Search, Plus, 
  Clock, Play, Pause, Settings, RefreshCw, X 
} from 'lucide-react';

export const AdminSubscriptions: React.FC = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Action Modals State
  const [activeModal, setActiveModal] = useState<'extend' | 'change_plan' | 'suspend' | 'manual_assign' | 'custom_sub' | null>(null);
  const [selectedSub, setSelectedSub] = useState<any>(null);

  // Extend Modal State
  const [extendDays, setExtendDays] = useState<number>(30);
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [extendReason, setExtendReason] = useState<string>('Promotional / Support extension');

  // Change Plan Modal State
  const [targetPlanId, setTargetPlanId] = useState<string>('');
  const [changeEffective, setChangeEffective] = useState<'immediate' | 'at_expiry'>('immediate');
  const [changeReason, setChangeReason] = useState<string>('Customer plan upgrade requested');

  // Suspend Modal State
  const [suspendReason, setSuspendReason] = useState<string>('Payment default or policy violation');

  // Manual Assign Modal State
  const [assignOrgId, setAssignOrgId] = useState<string>('');
  const [assignPlanId, setAssignPlanId] = useState<string>('');
  const [assignPaymentStatus, setAssignPaymentStatus] = useState<string>('complimentary');

  // Custom Sub Modal State
  const [customOrgId, setCustomOrgId] = useState<string>('');
  const [customPlanName, setCustomPlanName] = useState<string>('Enterprise Custom');
  const [customPrice, setCustomPrice] = useState<number>(15000);
  const [customDurationDays, setCustomDurationDays] = useState<number>(120);
  const [customMaxUsers, setCustomMaxUsers] = useState<number>(50);

  // 1. Fetch Subscriptions
  const { data: subscriptions } = useQuery({
    queryKey: ['admin-subscriptions', statusFilter],
    queryFn: async () => {
      const res = await api.get(`/admin/subscriptions?status=${statusFilter}`);
      return res.data.data;
    }
  });

  // 2. Fetch Organizations & Plans for selectors
  const { data: organizations } = useQuery({
    queryKey: ['admin-orgs-list'],
    queryFn: async () => {
      const res = await api.get('/admin/organizations');
      return res.data.data;
    }
  });

  const { data: plans } = useQuery({
    queryKey: ['admin-plans-selector'],
    queryFn: async () => {
      const res = await api.get('/admin/plans');
      return res.data.data;
    }
  });

  // Extend Mutation
  const extendMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post(`/admin/subscriptions/${selectedSub._id}/extend`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-subscriptions'] });
      setActiveModal(null);
    }
  });

  // Change Plan Mutation
  const changePlanMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post(`/admin/subscriptions/${selectedSub._id}/change-plan`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-subscriptions'] });
      setActiveModal(null);
    }
  });

  // Suspend Mutation
  const suspendMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post(`/admin/subscriptions/${selectedSub._id}/suspend`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-subscriptions'] });
      setActiveModal(null);
    }
  });

  // Activate Mutation
  const activateMutation = useMutation({
    mutationFn: async (subId: string) => {
      const res = await api.post(`/admin/subscriptions/${subId}/activate`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-subscriptions'] });
    }
  });

  // Manual Assign Mutation
  const manualAssignMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post('/admin/subscriptions/manual', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-subscriptions'] });
      setActiveModal(null);
    }
  });

  // Custom Subscription Mutation
  const customSubMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post('/admin/subscriptions/custom', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-subscriptions'] });
      setActiveModal(null);
    }
  });

  const filteredSubs = (subscriptions || []).filter((sub: any) => {
    const orgName = sub.organizationId?.name || '';
    const planName = sub.planName || '';
    return orgName.toLowerCase().includes(search.toLowerCase()) || 
           planName.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-primary-600 dark:text-primary-400 text-xs font-bold uppercase tracking-wider mb-1">
            <CreditCard className="h-4 w-4" />
            <span>SaaS Tenant Lifecycle</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Tenant Subscriptions</h1>
          <p className="text-xs text-slate-500 dark:text-dark-400 mt-0.5">
            Monitor, extend, upgrade, suspend, and configure custom commercial subscriptions for all organizations.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setActiveModal('manual_assign')}
            className="px-3.5 py-2.5 bg-slate-900 dark:bg-dark-800 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center space-x-1.5"
          >
            <Plus className="h-4 w-4" />
            <span>Assign Plan</span>
          </button>
          <button
            onClick={() => setActiveModal('custom_sub')}
            className="px-3.5 py-2.5 bg-[linear-gradient(45deg,#ef4444_0%,#6366f1_50%,#2563eb_100%)] hover:opacity-95 text-white font-bold text-xs rounded-xl shadow-md shadow-red-500/20 transition flex items-center space-x-1.5 active:scale-95"
          >
            <Settings className="h-4 w-4" />
            <span>Custom Terms</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-dark-900 p-4 rounded-2xl border border-slate-200 dark:border-dark-800">
        <div className="relative flex-1 max-w-md">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by organization or plan name..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 rounded-xl text-xs outline-none"
          />
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-xs font-semibold text-slate-500">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-dark-100 outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="trial">Trial</option>
            <option value="expired">Expired</option>
            <option value="suspended">Suspended</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Subscriptions Table */}
      <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-dark-800 bg-slate-50/50 dark:bg-dark-950/40 text-slate-400 font-semibold uppercase tracking-wider">
                <th className="py-3.5 pl-6">Organization</th>
                <th className="py-3.5">Plan Tier</th>
                <th className="py-3.5">Price</th>
                <th className="py-3.5">Start Date</th>
                <th className="py-3.5">Expiry Date</th>
                <th className="py-3.5">Seats</th>
                <th className="py-3.5">Status</th>
                <th className="py-3.5 pr-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-dark-800">
              {filteredSubs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No subscriptions found matching the filter.
                  </td>
                </tr>
              ) : (
                filteredSubs.map((sub: any) => {
                  const now = new Date();
                  const endDate = new Date(sub.endDate);
                  const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

                  return (
                    <tr key={sub._id} className="hover:bg-slate-50/80 dark:hover:bg-dark-800/40 transition">
                      <td className="py-4 pl-6">
                        <span className="font-bold text-slate-900 dark:text-white block">
                          {sub.organizationId?.name || 'Unlinked Org'}
                        </span>
                        <span className="text-[10px] text-slate-400">{sub.organizationId?.email || 'N/A'}</span>
                      </td>

                      <td className="py-4 font-bold text-primary-600 dark:text-primary-400">
                        {sub.planName}
                      </td>

                      <td className="py-4 font-semibold text-slate-700 dark:text-dark-200">
                        ₹{sub.priceAtPurchase?.toLocaleString() || 0}
                      </td>

                      <td className="py-4 text-slate-500">
                        {new Date(sub.startDate).toLocaleDateString()}
                      </td>

                      <td className="py-4">
                        <span className="font-semibold text-slate-800 dark:text-white block">
                          {endDate.toLocaleDateString()}
                        </span>
                        <span className={`text-[10px] ${daysRemaining < 7 ? 'text-rose-500 font-bold' : 'text-slate-400'}`}>
                          {daysRemaining} days left
                        </span>
                      </td>

                      <td className="py-4 text-slate-600 dark:text-dark-300">
                        {sub.maxUsersAtPurchase === -1 ? 'Unlimited' : `${sub.maxUsersAtPurchase} Seats`}
                      </td>

                      <td className="py-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                          sub.status === 'active' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
                          sub.status === 'trial' ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300' :
                          sub.status === 'suspended' ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300' :
                          'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        }`}>
                          {sub.status}
                        </span>
                      </td>

                      <td className="py-4 pr-6 text-right space-x-1.5">
                        {/* Extend button */}
                        <button
                          onClick={() => {
                            setSelectedSub(sub);
                            setActiveModal('extend');
                          }}
                          className="p-1.5 text-slate-500 hover:text-primary-600 hover:bg-slate-100 dark:hover:bg-dark-800 rounded-lg transition"
                          title="Extend Expiry Date"
                        >
                          <Clock className="h-4 w-4" />
                        </button>

                        {/* Change Plan button */}
                        <button
                          onClick={() => {
                            setSelectedSub(sub);
                            setActiveModal('change_plan');
                          }}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-dark-800 rounded-lg transition"
                          title="Change Plan"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </button>

                        {/* Suspend / Reactivate */}
                        {sub.status === 'suspended' ? (
                          <button
                            onClick={() => activateMutation.mutate(sub._id)}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition"
                            title="Reactivate Subscription"
                          >
                            <Play className="h-4 w-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setSelectedSub(sub);
                              setActiveModal('suspend');
                            }}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-dark-800 rounded-lg transition"
                            title="Suspend Subscription"
                          >
                            <Pause className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* EXTEND MODAL */}
      {activeModal === 'extend' && selectedSub && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-dark-800 pb-3">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">Extend Subscription</h3>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-dark-400">
              Extending expiry for <strong className="text-slate-800 dark:text-white">{selectedSub.organizationId?.name}</strong>. Current expiry: {new Date(selectedSub.endDate).toLocaleDateString()}
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Quick Extensions</label>
                <div className="grid grid-cols-4 gap-2">
                  {[7, 15, 30, 90].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => {
                        setExtendDays(d);
                        setCustomEndDate('');
                      }}
                      className={`py-2 rounded-xl font-bold border transition ${
                        extendDays === d && !customEndDate 
                          ? 'border-primary-600 bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-300' 
                          : 'border-slate-200 dark:border-dark-700'
                      }`}
                    >
                      +{d} Days
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Or Specific Custom Date</label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 rounded-xl p-2.5 text-xs outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Reason / Notes (Recorded in Audit Log)</label>
                <input
                  type="text"
                  value={extendReason}
                  onChange={(e) => setExtendReason(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 rounded-xl p-2.5 text-xs outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-dark-800">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 rounded-xl font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  onClick={() => extendMutation.mutate({
                    extendDays: customEndDate ? undefined : extendDays,
                    customEndDate: customEndDate ? new Date(customEndDate) : undefined,
                    reason: extendReason
                  })}
                  disabled={extendMutation.isPending}
                  className="px-5 py-2 rounded-xl bg-[linear-gradient(45deg,#ef4444_0%,#6366f1_50%,#2563eb_100%)] hover:opacity-95 text-white font-bold shadow-md shadow-red-500/20 active:scale-95"
                >
                  Confirm Extension
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CHANGE PLAN MODAL */}
      {activeModal === 'change_plan' && selectedSub && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-dark-800 pb-3">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">Change Plan Tier</h3>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Select New Plan</label>
                <select
                  value={targetPlanId}
                  onChange={(e) => setTargetPlanId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 rounded-xl p-2.5 text-xs outline-none"
                >
                  <option value="">-- Choose a Plan --</option>
                  {(plans || []).map((p: any) => (
                    <option key={p._id} value={p._id}>
                      {p.name} (₹{p.price} / {p.duration} {p.durationUnit})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">Effective Timing</label>
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => setChangeEffective('immediate')}
                    className={`flex-1 py-2 rounded-xl font-bold border ${
                      changeEffective === 'immediate' ? 'border-primary-600 bg-primary-50 text-primary-700 dark:bg-primary-950' : 'border-slate-200'
                    }`}
                  >
                    Immediately
                  </button>
                  <button
                    type="button"
                    onClick={() => setChangeEffective('at_expiry')}
                    className={`flex-1 py-2 rounded-xl font-bold border ${
                      changeEffective === 'at_expiry' ? 'border-primary-600 bg-primary-50 text-primary-700 dark:bg-primary-950' : 'border-slate-200'
                    }`}
                  >
                    At Expiry
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Reason</label>
                <input
                  type="text"
                  value={changeReason}
                  onChange={(e) => setChangeReason(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 rounded-xl p-2.5 text-xs outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-dark-800">
                <button type="button" onClick={() => setActiveModal(null)} className="px-4 py-2 rounded-xl font-semibold text-slate-600 hover:bg-slate-100">
                  Cancel
                </button>
                <button
                  onClick={() => changePlanMutation.mutate({
                    newPlanId: targetPlanId,
                    effective: changeEffective,
                    reason: changeReason
                  })}
                  disabled={!targetPlanId || changePlanMutation.isPending}
                  className="px-5 py-2 rounded-xl bg-[linear-gradient(45deg,#ef4444_0%,#6366f1_50%,#2563eb_100%)] hover:opacity-95 text-white font-bold disabled:opacity-50 shadow-md shadow-red-500/20 active:scale-95"
                >
                  Apply Change
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUSPEND MODAL */}
      {activeModal === 'suspend' && selectedSub && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-base text-rose-600">Suspend Organization Subscription</h3>
            <p className="text-xs text-slate-500">
              This will lock protected CRM access for <strong className="text-slate-800 dark:text-white">{selectedSub.organizationId?.name}</strong>. Data will remain fully preserved.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Suspension Reason</label>
                <input
                  type="text"
                  value={suspendReason}
                  onChange={(e) => setSuspendReason(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 rounded-xl p-2.5 text-xs outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-dark-800">
                <button type="button" onClick={() => setActiveModal(null)} className="px-4 py-2 rounded-xl font-semibold text-slate-600 hover:bg-slate-100">
                  Cancel
                </button>
                <button
                  onClick={() => suspendMutation.mutate({ reason: suspendReason })}
                  disabled={suspendMutation.isPending}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold"
                >
                  Suspend Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MANUAL ASSIGN MODAL */}
      {activeModal === 'manual_assign' && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-dark-800 pb-3">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">Manually Assign Subscription</h3>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Target Organization</label>
                <select
                  value={assignOrgId}
                  onChange={(e) => setAssignOrgId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 rounded-xl p-2.5 text-xs outline-none"
                >
                  <option value="">-- Select Organization --</option>
                  {(organizations || []).map((o: any) => (
                    <option key={o._id} value={o._id}>{o.name} ({o.email})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">Select Plan</label>
                <select
                  value={assignPlanId}
                  onChange={(e) => setAssignPlanId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 rounded-xl p-2.5 text-xs outline-none"
                >
                  <option value="">-- Select Plan --</option>
                  {(plans || []).map((p: any) => (
                    <option key={p._id} value={p._id}>{p.name} (₹{p.price})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">Payment Status</label>
                <select
                  value={assignPaymentStatus}
                  onChange={(e) => setAssignPaymentStatus(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 rounded-xl p-2.5 text-xs outline-none"
                >
                  <option value="complimentary">Complimentary / Free Support</option>
                  <option value="paid">Paid (Manual Cheque/Bank Transfer)</option>
                  <option value="pending">Payment Pending</option>
                </select>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-dark-800">
                <button type="button" onClick={() => setActiveModal(null)} className="px-4 py-2 rounded-xl font-semibold text-slate-600 hover:bg-slate-100">
                  Cancel
                </button>
                <button
                  onClick={() => manualAssignMutation.mutate({
                    organizationId: assignOrgId,
                    planId: assignPlanId,
                    paymentStatus: assignPaymentStatus
                  })}
                  disabled={!assignOrgId || !assignPlanId || manualAssignMutation.isPending}
                  className="px-5 py-2 rounded-xl bg-[linear-gradient(45deg,#ef4444_0%,#6366f1_50%,#2563eb_100%)] hover:opacity-95 text-white font-bold disabled:opacity-50 shadow-md shadow-red-500/20 active:scale-95"
                >
                  Assign & Activate
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM CUSTOMER TERMS MODAL */}
      {activeModal === 'custom_sub' && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-dark-800 pb-3">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">Custom Customer Subscription</h3>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Target Organization</label>
                <select
                  value={customOrgId}
                  onChange={(e) => setCustomOrgId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 rounded-xl p-2.5 text-xs outline-none"
                >
                  <option value="">-- Select Organization --</option>
                  {(organizations || []).map((o: any) => (
                    <option key={o._id} value={o._id}>{o.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Custom Plan Name</label>
                  <input
                    type="text"
                    value={customPlanName}
                    onChange={(e) => setCustomPlanName(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 rounded-xl p-2.5 text-xs outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Custom Price (₹)</label>
                  <input
                    type="number"
                    value={customPrice}
                    onChange={(e) => setCustomPrice(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 rounded-xl p-2.5 text-xs outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Duration (Days)</label>
                  <input
                    type="number"
                    value={customDurationDays}
                    onChange={(e) => setCustomDurationDays(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 rounded-xl p-2.5 text-xs outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Max Users</label>
                  <input
                    type="number"
                    value={customMaxUsers}
                    onChange={(e) => setCustomMaxUsers(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 rounded-xl p-2.5 text-xs outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-dark-800">
                <button type="button" onClick={() => setActiveModal(null)} className="px-4 py-2 rounded-xl font-semibold text-slate-600 hover:bg-slate-100">
                  Cancel
                </button>
                <button
                  onClick={() => customSubMutation.mutate({
                    organizationId: customOrgId,
                    customPlanName,
                    price: customPrice,
                    durationDays: customDurationDays,
                    maxUsers: customMaxUsers,
                    limits: { leads: 50000, contacts: 50000, campaigns: 500, followUps: 50000, tasks: 20000, invoices: 2000, storageMb: 20480 },
                    features: { email: true, whatsapp: true, instagram: true, phoneCalls: true, analytics: true, reports: true, automation: true, aiCopilot: true },
                    paymentStatus: 'paid'
                  })}
                  disabled={!customOrgId || customSubMutation.isPending}
                  className="px-5 py-2 rounded-xl bg-[linear-gradient(45deg,#ef4444_0%,#6366f1_50%,#2563eb_100%)] hover:opacity-95 text-white font-bold disabled:opacity-50 shadow-md shadow-red-500/20 active:scale-95"
                >
                  Create & Provision
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
