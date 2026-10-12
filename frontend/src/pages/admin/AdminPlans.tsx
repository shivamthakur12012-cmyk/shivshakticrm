import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { 
  Plus, Edit2, Layers, X 
} from 'lucide-react';

export const AdminPlans: React.FC = () => {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any>(null);

  // Form State
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState<number>(999);
  const [currency, setCurrency] = useState('INR');
  const [duration, setDuration] = useState<number>(30);
  const [durationUnit, setDurationUnit] = useState<'days' | 'months' | 'years'>('days');
  const [maxUsers, setMaxUsers] = useState<number>(5);

  // Limits
  const [leadsLimit, setLeadsLimit] = useState<number>(5000);
  const [contactsLimit, setContactsLimit] = useState<number>(5000);
  const [campaignsLimit, setCampaignsLimit] = useState<number>(50);
  const [followUpsLimit, setFollowUpsLimit] = useState<number>(5000);
  const [tasksLimit, setTasksLimit] = useState<number>(2500);
  const [invoicesLimit, setInvoicesLimit] = useState<number>(200);

  // Features
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [waEnabled, setWaEnabled] = useState(true);
  const [igEnabled, setIgEnabled] = useState(false);
  const [phoneEnabled, setPhoneEnabled] = useState(true);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(true);
  const [reportsEnabled, setReportsEnabled] = useState(true);
  const [automationEnabled, setAutomationEnabled] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(false);

  // Trial
  const [trialEnabled, setTrialEnabled] = useState(false);
  const [trialDays, setTrialDays] = useState(14);
  const [isActive, setIsActive] = useState(true);

  // 1. Fetch Plans
  const { data: plans } = useQuery({
    queryKey: ['admin-plans'],
    queryFn: async () => {
      const res = await api.get('/admin/plans');
      return res.data.data;
    }
  });

  // Create or Update Plan Mutation
  const savePlanMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (editingPlan) {
        const res = await api.put(`/admin/plans/${editingPlan._id}`, payload);
        return res.data.data;
      } else {
        const res = await api.post('/admin/plans', payload);
        return res.data.data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-plans'] });
      setModalOpen(false);
      resetForm();
    }
  });

  // Toggle Active Mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.patch(`/admin/plans/${id}/toggle`);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-plans'] });
    }
  });

  const resetForm = () => {
    setEditingPlan(null);
    setName('');
    setSlug('');
    setDescription('');
    setPrice(999);
    setCurrency('INR');
    setDuration(30);
    setDurationUnit('days');
    setMaxUsers(5);
    setLeadsLimit(5000);
    setContactsLimit(5000);
    setCampaignsLimit(50);
    setFollowUpsLimit(5000);
    setTasksLimit(2500);
    setInvoicesLimit(200);
    setEmailEnabled(true);
    setWaEnabled(true);
    setIgEnabled(false);
    setPhoneEnabled(true);
    setAnalyticsEnabled(true);
    setReportsEnabled(true);
    setAutomationEnabled(false);
    setAiEnabled(false);
    setTrialEnabled(false);
    setTrialDays(14);
    setIsActive(true);
  };

  const handleEditClick = (plan: any) => {
    setEditingPlan(plan);
    setName(plan.name);
    setSlug(plan.slug);
    setDescription(plan.description || '');
    setPrice(plan.price);
    setCurrency(plan.currency || 'INR');
    setDuration(plan.duration);
    setDurationUnit(plan.durationUnit || 'days');
    setMaxUsers(plan.maxUsers);
    
    setLeadsLimit(plan.limits?.leads ?? 5000);
    setContactsLimit(plan.limits?.contacts ?? 5000);
    setCampaignsLimit(plan.limits?.campaigns ?? 50);
    setFollowUpsLimit(plan.limits?.followUps ?? 5000);
    setTasksLimit(plan.limits?.tasks ?? 2500);
    setInvoicesLimit(plan.limits?.invoices ?? 200);

    setEmailEnabled(plan.features?.email ?? true);
    setWaEnabled(plan.features?.whatsapp ?? true);
    setIgEnabled(plan.features?.instagram ?? false);
    setPhoneEnabled(plan.features?.phoneCalls ?? true);
    setAnalyticsEnabled(plan.features?.analytics ?? true);
    setReportsEnabled(plan.features?.reports ?? true);
    setAutomationEnabled(plan.features?.automation ?? false);
    setAiEnabled(plan.features?.aiCopilot ?? false);

    setTrialEnabled(plan.trialEnabled ?? false);
    setTrialDays(plan.trialDurationDays ?? 14);
    setIsActive(plan.isActive ?? true);
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name,
      slug: slug || name.toLowerCase().replace(/\s+/g, '-'),
      description,
      price: Number(price),
      currency,
      duration: Number(duration),
      durationUnit,
      maxUsers: Number(maxUsers),
      limits: {
        leads: Number(leadsLimit),
        contacts: Number(contactsLimit),
        campaigns: Number(campaignsLimit),
        followUps: Number(followUpsLimit),
        tasks: Number(tasksLimit),
        invoices: Number(invoicesLimit),
        storageMb: 5120
      },
      features: {
        email: emailEnabled,
        whatsapp: waEnabled,
        instagram: igEnabled,
        phoneCalls: phoneEnabled,
        analytics: analyticsEnabled,
        reports: reportsEnabled,
        automation: automationEnabled,
        aiCopilot: aiEnabled
      },
      trialEnabled,
      trialDurationDays: trialEnabled ? Number(trialDays) : 0,
      isActive
    };

    savePlanMutation.mutate(payload);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-primary-600 dark:text-primary-400 text-xs font-bold uppercase tracking-wider mb-1">
            <Layers className="h-4 w-4" />
            <span>SaaS Plan Configuration</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Dynamic Pricing Plans</h1>
          <p className="text-xs text-slate-500 dark:text-dark-400 mt-0.5">
            Configure subscription tiers, flexible durations, user limits, resource quotas, and feature flags.
          </p>
        </div>

        <button
          onClick={() => {
            resetForm();
            setModalOpen(true);
          }}
          className="px-4 py-2.5 bg-[linear-gradient(45deg,#ef4444_0%,#6366f1_50%,#2563eb_100%)] hover:opacity-95 text-white font-bold text-xs rounded-xl shadow-md shadow-red-500/20 transition flex items-center space-x-2 self-start sm:self-auto active:scale-95"
        >
          <Plus className="h-4 w-4" />
          <span>Create New Plan</span>
        </button>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {!plans || plans.length === 0 ? (
          <div className="col-span-full py-12 text-center text-xs text-slate-400">
            No dynamic plans configured. Click "Create New Plan" to start.
          </div>
        ) : (
          plans.map((p: any) => (
            <div
              key={p._id}
              className={`p-6 rounded-3xl bg-white dark:bg-dark-900 border transition shadow-sm space-y-5 flex flex-col justify-between ${
                p.isActive ? 'border-slate-200 dark:border-dark-800' : 'border-dashed border-slate-300 dark:border-dark-700 opacity-75'
              }`}
            >
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="text-base font-black text-slate-900 dark:text-white">{p.name}</h3>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        p.isActive ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-200 text-slate-700 dark:bg-dark-800 dark:text-dark-400'
                      }`}>
                        {p.isActive ? 'Active' : 'Deactivated'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-dark-400 mt-1 line-clamp-2">
                      {p.description || 'No description'}
                    </p>
                  </div>
                  <button
                    onClick={() => handleEditClick(p)}
                    className="p-2 text-slate-400 hover:text-primary-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-dark-800 rounded-xl transition"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                </div>

                {/* Price & Duration */}
                <div className="p-3.5 bg-slate-50 dark:bg-dark-950/60 rounded-2xl flex items-baseline justify-between">
                  <div>
                    <span className="text-2xl font-black text-slate-900 dark:text-white">₹{p.price.toLocaleString()}</span>
                    <span className="text-[11px] text-slate-400 font-semibold ml-1.5">/ {p.duration} {p.durationUnit}</span>
                  </div>
                  <span className="text-xs font-bold text-primary-600 dark:text-primary-400">
                    {p.maxUsers === -1 ? 'Unlimited Seats' : `${p.maxUsers} Users`}
                  </span>
                </div>

                {/* Resource Limits List */}
                <div className="space-y-1.5 text-xs text-slate-600 dark:text-dark-300 border-t border-slate-100 dark:border-dark-800 pt-3">
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-medium">Max Leads:</span>
                    <span className="font-bold">{p.limits?.leads?.toLocaleString() || '1,000'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-medium">Max Campaigns:</span>
                    <span className="font-bold">{p.limits?.campaigns || '20'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-medium">Monthly Invoices:</span>
                    <span className="font-bold">{p.limits?.invoices || '50'}</span>
                  </div>
                </div>

                {/* Enabled Feature Badges */}
                <div className="border-t border-slate-100 dark:border-dark-800 pt-3 space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Features</span>
                  <div className="flex flex-wrap gap-1.5">
                    {p.features?.whatsapp && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                        WhatsApp
                      </span>
                    )}
                    {p.features?.email && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
                        Email
                      </span>
                    )}
                    {p.features?.instagram && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-950/30 dark:text-fuchsia-300">
                        Instagram
                      </span>
                    )}
                    {p.features?.phoneCalls && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                        Voice Calls
                      </span>
                    )}
                    {p.features?.aiCopilot && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-300">
                        AI Copilot
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Toggle Active Button */}
              <div className="pt-2">
                <button
                  onClick={() => toggleActiveMutation.mutate(p._id)}
                  disabled={toggleActiveMutation.isPending}
                  className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 ${
                    p.isActive 
                      ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-dark-800 dark:text-dark-300' 
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  {p.isActive ? <span>Deactivate for New Signups</span> : <span>Activate Plan</span>}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* CREATE / EDIT PLAN MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-5 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-dark-800 pb-3">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                {editingPlan ? `Edit Plan: ${editingPlan.name}` : 'Create New Subscription Plan'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              {/* Basic Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-dark-300 mb-1">Plan Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Growth Pro"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 dark:bg-dark-800 dark:border-dark-700 dark:text-dark-100 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-dark-300 mb-1">Slug (Unique URL identifier)</label>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="e.g. growth-pro"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 dark:bg-dark-800 dark:border-dark-700 dark:text-dark-100 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-dark-300 mb-1">Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Full outreach suite for growing agencies and teams."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 dark:bg-dark-800 dark:border-dark-700 dark:text-dark-100 outline-none"
                />
              </div>

              {/* Pricing & Duration */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-dark-950/60 border border-slate-100 dark:border-dark-800">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-dark-300 mb-1">Price (₹)</label>
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    min={0}
                    className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs text-slate-800 dark:bg-dark-800 dark:border-dark-700 dark:text-dark-100 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-dark-300 mb-1">Duration</label>
                  <input
                    type="number"
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    min={1}
                    className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs text-slate-800 dark:bg-dark-800 dark:border-dark-700 dark:text-dark-100 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-dark-300 mb-1">Duration Unit</label>
                  <select
                    value={durationUnit}
                    onChange={(e) => setDurationUnit(e.target.value as any)}
                    className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs text-slate-800 dark:bg-dark-800 dark:border-dark-700 dark:text-dark-100 outline-none"
                  >
                    <option value="days">Days</option>
                    <option value="months">Months</option>
                    <option value="years">Years</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-dark-300 mb-1">Max Users</label>
                  <input
                    type="number"
                    value={maxUsers}
                    onChange={(e) => setMaxUsers(Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs text-slate-800 dark:bg-dark-800 dark:border-dark-700 dark:text-dark-100 outline-none"
                    required
                  />
                </div>
              </div>

              {/* Resource Limits */}
              <div className="space-y-2">
                <span className="font-bold text-slate-900 dark:text-white block">CRM Resource Limits</span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Max Leads</label>
                    <input
                      type="number"
                      value={leadsLimit}
                      onChange={(e) => setLeadsLimit(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs text-slate-800 dark:bg-dark-800 dark:border-dark-700 dark:text-dark-100 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Max Contacts</label>
                    <input
                      type="number"
                      value={contactsLimit}
                      onChange={(e) => setContactsLimit(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs text-slate-800 dark:bg-dark-800 dark:border-dark-700 dark:text-dark-100 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Max Campaigns</label>
                    <input
                      type="number"
                      value={campaignsLimit}
                      onChange={(e) => setCampaignsLimit(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs text-slate-800 dark:bg-dark-800 dark:border-dark-700 dark:text-dark-100 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Max Follow-ups</label>
                    <input
                      type="number"
                      value={followUpsLimit}
                      onChange={(e) => setFollowUpsLimit(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs text-slate-800 dark:bg-dark-800 dark:border-dark-700 dark:text-dark-100 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Max Tasks</label>
                    <input
                      type="number"
                      value={tasksLimit}
                      onChange={(e) => setTasksLimit(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs text-slate-800 dark:bg-dark-800 dark:border-dark-700 dark:text-dark-100 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Monthly Invoices</label>
                    <input
                      type="number"
                      value={invoicesLimit}
                      onChange={(e) => setInvoicesLimit(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs text-slate-800 dark:bg-dark-800 dark:border-dark-700 dark:text-dark-100 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Feature Checkboxes */}
              <div className="space-y-2 border-t border-slate-100 dark:border-dark-800 pt-3">
                <span className="font-bold text-slate-900 dark:text-white block">Feature Flags</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input type="checkbox" checked={emailEnabled} onChange={(e) => setEmailEnabled(e.target.checked)} className="rounded text-primary-600" />
                    <span>Email Outreach</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input type="checkbox" checked={waEnabled} onChange={(e) => setWaEnabled(e.target.checked)} className="rounded text-primary-600" />
                    <span>WhatsApp</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input type="checkbox" checked={igEnabled} onChange={(e) => setIgEnabled(e.target.checked)} className="rounded text-primary-600" />
                    <span>Instagram DM</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input type="checkbox" checked={phoneEnabled} onChange={(e) => setPhoneEnabled(e.target.checked)} className="rounded text-primary-600" />
                    <span>Voice Calls</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input type="checkbox" checked={analyticsEnabled} onChange={(e) => setAnalyticsEnabled(e.target.checked)} className="rounded text-primary-600" />
                    <span>Analytics</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input type="checkbox" checked={reportsEnabled} onChange={(e) => setReportsEnabled(e.target.checked)} className="rounded text-primary-600" />
                    <span>Reports & Logs</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input type="checkbox" checked={automationEnabled} onChange={(e) => setAutomationEnabled(e.target.checked)} className="rounded text-primary-600" />
                    <span>Automations</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input type="checkbox" checked={aiEnabled} onChange={(e) => setAiEnabled(e.target.checked)} className="rounded text-primary-600" />
                    <span>AI Copilot</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t border-slate-100 dark:border-dark-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl font-semibold text-slate-600 hover:bg-slate-100 dark:text-dark-300 dark:hover:bg-dark-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savePlanMutation.isPending}
                  className="px-5 py-2 rounded-xl bg-[linear-gradient(45deg,#ef4444_0%,#6366f1_50%,#2563eb_100%)] hover:opacity-95 text-white font-bold shadow-md shadow-red-500/20 transition disabled:opacity-50 active:scale-95"
                >
                  {savePlanMutation.isPending ? 'Saving...' : editingPlan ? 'Update Plan' : 'Create Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
