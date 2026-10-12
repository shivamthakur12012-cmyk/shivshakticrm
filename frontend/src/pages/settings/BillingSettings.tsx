import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import {
  CheckCircle2,
  Sparkles, CheckCircle, X, ShieldCheck, AlertCircle, Copy, Check,
  Users, UserPlus, Clock, Building2, QrCode
} from 'lucide-react';

export const BillingSettings: React.FC = () => {
  const queryClient = useQueryClient();
  const { organizations, activeOrganizationId } = useAuthStore();

  const currentOrg = organizations.find((o: any) => (o.id || o._id) === activeOrganizationId) || organizations[0];
  const defaultOrgName = currentOrg?.name || '';

  // Plan Subscription Modal State
  const [checkoutPlan, setCheckoutPlan] = useState<any | null>(null);
  const [planExtraSeats, setPlanExtraSeats] = useState<number>(0);
  const [companyName, setCompanyName] = useState<string>('');
  const [userPaymentId, setUserPaymentId] = useState<string>('');
  const [paymentNotes, setPaymentNotes] = useState<string>('');
  const [isPlanSubmitted, setIsPlanSubmitted] = useState<boolean>(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentSuccessMsg, setPaymentSuccessMsg] = useState<string | null>(null);
  const [copiedAmount, setCopiedAmount] = useState<boolean>(false);

  // Seat Add-on Modal State
  const [addonSeats, setAddonSeats] = useState<number>(1);
  const [showSeatModal, setShowSeatModal] = useState<boolean>(false);
  const [seatCompanyName, setSeatCompanyName] = useState<string>('');
  const [userSeatPaymentId, setUserSeatPaymentId] = useState<string>('');
  const [isSeatSubmitted, setIsSeatSubmitted] = useState<boolean>(false);

  // 1. Fetch Subscription & Live Usage
  const { data: billingData } = useQuery({
    queryKey: ['org-billing-subscription'],
    queryFn: async () => {
      const res = await api.get('/billing/subscription');
      return res.data.data;
    },
    refetchInterval: 10000 // Poll every 10 seconds for real-time unlock when Super Admin verifies
  });

  // 2. Fetch Available Plans
  const { data: plans } = useQuery({
    queryKey: ['available-plans'],
    queryFn: async () => {
      const res = await api.get('/plans');
      return res.data.data;
    }
  });

  useEffect(() => {
    if (defaultOrgName) {
      if (!companyName) setCompanyName(defaultOrgName);
      if (!seatCompanyName) setSeatCompanyName(defaultOrgName);
    }
  }, [defaultOrgName]);

  // Submit Plan Subscription Payment Request Mutation
  const submitPlanPaymentMutation = useMutation({
    mutationFn: async (payload: {
      planId: string;
      extraSeats: number;
      companyName: string;
      transactionId: string;
      notes?: string;
    }) => {
      const res = await api.post('/billing/submit-payment', payload);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['org-billing-subscription'] });
      setIsPlanSubmitted(true);
      setPaymentError(null);
      if (data.isFreePlan) {
        setPaymentSuccessMsg(data.message || 'Free plan activated successfully!');
        setCheckoutPlan(null);
      }
    },
    onError: (err: any) => {
      setPaymentError(err.response?.data?.message || 'Failed to submit payment reference. Please check your transaction number.');
    }
  });

  // Submit Seat Add-On Payment Request Mutation
  const submitSeatPaymentMutation = useMutation({
    mutationFn: async (payload: {
      extraSeats: number;
      companyName: string;
      transactionId: string;
      notes?: string;
    }) => {
      const res = await api.post('/billing/submit-seat-payment', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-billing-subscription'] });
      queryClient.invalidateQueries({ queryKey: ['team-employees-list'] });
      setIsSeatSubmitted(true);
      setPaymentError(null);
    },
    onError: (err: any) => {
      setPaymentError(err.response?.data?.message || 'Failed to submit seat add-on request.');
    }
  });

  // Per-plan dynamic extra employee seat counters on cards
  const [planSeatsMap, setPlanSeatsMap] = useState<Record<string, number>>({});

  const updatePlanExtraSeats = (planId: string, delta: number) => {
    setPlanSeatsMap(prev => {
      const current = prev[planId] || 0;
      const next = Math.max(0, current + delta);
      return { ...prev, [planId]: next };
    });
  };

  const handleOpenPlanCheckout = (plan: any, initialExtraSeats: number = 0) => {
    setCheckoutPlan(plan);
    setPlanExtraSeats(initialExtraSeats);
    setCompanyName(defaultOrgName);
    setUserPaymentId('');
    setPaymentNotes('');
    setIsPlanSubmitted(false);
    setPaymentError(null);
  };

  const handleOpenSeatCheckout = () => {
    setShowSeatModal(true);
    setSeatCompanyName(defaultOrgName);
    setUserSeatPaymentId('');
    setIsSeatSubmitted(false);
    setPaymentError(null);
  };

  const handleCopyAmount = (amount: number) => {
    navigator.clipboard.writeText(amount.toString());
    setCopiedAmount(true);
    setTimeout(() => setCopiedAmount(false), 2000);
  };

  const handlePlanPaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) {
      setPaymentError('Please enter your company name.');
      return;
    }
    if (!userPaymentId.trim()) {
      setPaymentError('Please enter your payment Transaction Number / UTR Reference ID.');
      return;
    }

    submitPlanPaymentMutation.mutate({
      planId: checkoutPlan._id || checkoutPlan.id,
      extraSeats: planExtraSeats,
      companyName: companyName.trim(),
      transactionId: userPaymentId.trim(),
      notes: paymentNotes.trim()
    });
  };

  const handleSeatPaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!seatCompanyName.trim()) {
      setPaymentError('Please enter your company name.');
      return;
    }
    if (!userSeatPaymentId.trim()) {
      setPaymentError('Please enter your payment Transaction Number / UTR Reference ID.');
      return;
    }

    submitSeatPaymentMutation.mutate({
      extraSeats: addonSeats,
      companyName: seatCompanyName.trim(),
      transactionId: userSeatPaymentId.trim()
    });
  };

  const subscription = billingData?.subscription;
  const usage = billingData?.usage || { users: 1, leads: 0, campaigns: 0, invoices: 0 };
  const daysRemaining = billingData?.daysRemaining ?? 30;
  const limits = subscription?.limitsAtPurchase || {};
  const features = subscription?.featuresAtPurchase || {};
  const payments = billingData?.payments || [];

  const maxUsers = subscription?.maxUsersAtPurchase === -1 ? 'Unlimited' : (subscription?.maxUsersAtPurchase || 10);
  const maxLeads = limits.leads === -1 ? 'Unlimited' : (limits.leads || 1000);
  const maxCampaigns = limits.campaigns === -1 ? 'Unlimited' : (limits.campaigns || 20);

  const usersPct = typeof maxUsers === 'number' ? Math.min(100, Math.round((usage.users / maxUsers) * 100)) : 10;
  const leadsPct = typeof maxLeads === 'number' ? Math.min(100, Math.round((usage.leads / maxLeads) * 100)) : 5;
  const campaignsPct = typeof maxCampaigns === 'number' ? Math.min(100, Math.round((usage.campaigns / maxCampaigns) * 100)) : 10;

  const isPendingVerification = subscription?.paymentStatus === 'pending_verification';

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white">Workspace Billing</h3>

      {paymentSuccessMsg && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center space-x-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          <span>{paymentSuccessMsg}</span>
        </div>
      )}

      {/* Pending Super Admin Verification Banner */}
      {isPendingVerification && (
        <div className="p-5 rounded-3xl [background:linear-gradient(45deg,#ef4444,#6366f1,#2563eb)] text-white shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl">
              <Clock className="h-6 w-6 text-white animate-pulse" />
            </div>
            <div>
              <div className="font-black text-sm sm:text-base">
                Payment Verification In Progress
              </div>
              <p className="text-xs text-white/90 mt-0.5">
                Your payment reference has been submitted. The Super Admin is verifying your transaction number to activate your subscription.
              </p>
              {subscription?.providerPaymentId && (
                <div className="mt-1 font-mono text-[11px] bg-black/20 px-2.5 py-0.5 rounded-lg inline-block">
                  Reference UTR: {subscription.providerPaymentId}
                </div>
              )}
            </div>
          </div>
          <span className="px-3.5 py-1.5 bg-white text-slate-900 font-extrabold text-xs rounded-xl shadow shrink-0">
            Awaiting Super Admin Approval
          </span>
        </div>
      )}

      {/* Current Active Plan Overview Card */}
      {subscription && (
        <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-3xl p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-dark-800 pb-5">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Current Plan Tier</span>
              <div className="flex items-center space-x-2 mt-1">
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">
                  {subscription.planName || 'Starter Subscription'}
                </h2>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${subscription.status === 'active'
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                  }`}>
                  {subscription.status}
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="text-right">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Billing Cycle</span>
                <span className="text-xs font-bold text-slate-700 dark:text-dark-200">
                  {daysRemaining > 0 ? `${daysRemaining} Days Remaining` : 'Expired'}
                </span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-dark-800 rounded-2xl border border-slate-100 dark:border-dark-700">
                <Clock className="h-5 w-5 text-primary-500" />
              </div>
            </div>
          </div>

          {/* Usage Meters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Team Seats */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-slate-500">Team Seats</span>
                <span className="font-bold text-slate-900 dark:text-white">{usage.users} / {maxUsers}</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-dark-800 h-2.5 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${usersPct > 85 ? 'bg-rose-500' : '[background:linear-gradient(45deg,#ef4444,#6366f1,#2563eb)]'}`}
                  style={{ width: `${usersPct}%` }}
                />
              </div>
              <span className="text-[10px] text-slate-400">{usersPct}% allocated</span>
            </div>

            {/* Leads Quota */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-slate-500">Leads Capacity</span>
                <span className="font-bold text-slate-900 dark:text-white">{usage.leads} / {maxLeads.toLocaleString()}</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-dark-800 h-2.5 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${leadsPct > 85 ? 'bg-rose-500' : 'bg-blue-600'}`} style={{ width: `${leadsPct}%` }}></div>
              </div>
              <span className="text-[10px] text-slate-400">{leadsPct}% utilized</span>
            </div>

            {/* Campaigns Quota */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-slate-500">Outreach Campaigns</span>
                <span className="font-bold text-slate-900 dark:text-white">{usage.campaigns} / {maxCampaigns}</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-dark-800 h-2.5 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${campaignsPct > 85 ? 'bg-rose-500' : 'bg-purple-600'}`} style={{ width: `${campaignsPct}%` }}></div>
              </div>
              <span className="text-[10px] text-slate-400">{campaignsPct}% active</span>
            </div>
          </div>

          {/* Add-on: Purchase Extra Employee Seats Card */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-50/80 via-indigo-50/60 to-blue-50/80 dark:from-blue-950/30 dark:via-indigo-950/20 dark:to-blue-950/30 border border-blue-200/80 dark:border-blue-900/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                  Add Extra Employee Seats
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-black uppercase tracking-wider">
                  ₹500 / Seat
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-dark-300">
                Need more team members? Increase your team quota at ₹500 per additional employee.
              </p>
            </div>

            <div className="flex items-center space-x-3 w-full md:w-auto">
              <div className="flex items-center space-x-2 bg-white dark:bg-dark-800 border border-slate-200 dark:border-dark-700 rounded-xl p-1 shadow-sm">
                <button
                  type="button"
                  onClick={() => setAddonSeats(prev => Math.max(1, prev - 1))}
                  className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-dark-700 hover:bg-slate-200 dark:hover:bg-dark-600 text-slate-800 dark:text-white font-black text-sm flex items-center justify-center transition active:scale-95 cursor-pointer"
                >
                  -
                </button>
                <span className="w-8 text-center font-black text-xs text-blue-600 dark:text-blue-400">
                  +{addonSeats}
                </span>
                <button
                  type="button"
                  onClick={() => setAddonSeats(prev => prev + 1)}
                  className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-dark-700 hover:bg-slate-200 dark:hover:bg-dark-600 text-slate-800 dark:text-white font-black text-sm flex items-center justify-center transition active:scale-95 cursor-pointer"
                >
                  +
                </button>
              </div>

              <button
                type="button"
                onClick={handleOpenSeatCheckout}
                className="flex-1 md:flex-initial px-4 py-2.5 rounded-xl [background:linear-gradient(45deg,#ef4444,#6366f1,#2563eb)] hover:brightness-110 text-white font-bold text-xs shadow-md transition flex items-center justify-center space-x-1.5 active:scale-95 cursor-pointer"
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span>
                  Buy +{addonSeats} Seat{addonSeats > 1 ? 's' : ''} (₹{(addonSeats * 500).toLocaleString()})
                </span>
              </button>
            </div>
          </div>

          {/* Enabled Features in Current Subscription */}
          <div className="border-t border-slate-100 dark:border-dark-800 pt-4 space-y-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Included Features</span>
            <div className="flex flex-wrap gap-2">
              {features.whatsapp && (
                <span className="px-3 py-1 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 flex items-center space-x-1">
                  <CheckCircle className="h-3.5 w-3.5" />
                  <span>WhatsApp Business</span>
                </span>
              )}
              {features.email && (
                <span className="px-3 py-1 rounded-xl text-xs font-bold bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 flex items-center space-x-1">
                  <CheckCircle className="h-3.5 w-3.5" />
                  <span>MailerCloud Email</span>
                </span>
              )}
              {features.phoneCalls && (
                <span className="px-3 py-1 rounded-xl text-xs font-bold bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 flex items-center space-x-1">
                  <CheckCircle className="h-3.5 w-3.5" />
                  <span>Voice Calls & Telephony</span>
                </span>
              )}
              {features.aiCopilot && (
                <span className="px-3 py-1 rounded-xl text-xs font-bold bg-purple-50 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300 flex items-center space-x-1">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>AI Call Brief & Copilot</span>
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Available Plans for Upgrade or Renewal */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Upgrade or Renew Your Subscription</h2>
          <p className="text-xs text-slate-500 dark:text-dark-400">
            Select a plan to expand your team limits. Pay via UPI scanner and submit your transaction reference for Super Admin verification.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {(plans || []).map((p: any) => {
            const isCurrent = subscription?.planName === p.name;
            const planId = p._id || p.id;
            const extraSeats = planSeatsMap[planId] || 0;
            const totalSeats = (p.maxUsers || 10) + extraSeats;
            const extraCost = extraSeats * 500;
            const totalPlanPrice = p.price + extraCost;

            return (
              <div
                key={planId}
                className={`p-6 rounded-3xl bg-white dark:bg-dark-900 border transition shadow-sm flex flex-col justify-between space-y-5 ${isCurrent
                  ? 'border-blue-500 ring-2 ring-blue-500/20'
                  : 'border-slate-200 dark:border-dark-800 hover:border-slate-300'
                  }`}
              >
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="font-extrabold text-base text-slate-900 dark:text-white">{p.name}</h3>
                      {isCurrent && (
                        <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 uppercase">
                          Current Plan
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex items-baseline flex-wrap gap-1">
                      <span className="text-2xl font-black text-slate-900 dark:text-white">
                        ₹{totalPlanPrice.toLocaleString()}
                      </span>
                      <span className="text-xs text-slate-400 font-semibold">
                        / {p.duration} {p.durationUnit}
                      </span>
                      {extraSeats > 0 && (
                        <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                          +₹{extraCost.toLocaleString()} ({extraSeats} extra)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Dynamic Team Seats Selector on Card */}
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-dark-800/60 border border-slate-200 dark:border-dark-700/80 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-1.5">
                        <Users className="h-3.5 w-3.5 text-blue-500" />
                        <span className="font-extrabold text-slate-800 dark:text-white">
                          Team Size: <span className="text-blue-600 dark:text-blue-400">{totalSeats} Employees</span>
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400">
                        10 included
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-600 dark:text-dark-300 font-medium">
                        Add extra seats:
                      </span>
                      <div className="flex items-center space-x-1.5 bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-xl p-1 shadow-xs">
                        <button
                          type="button"
                          disabled={extraSeats <= 0}
                          onClick={() => updatePlanExtraSeats(planId, -1)}
                          className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-dark-800 hover:bg-slate-200 dark:hover:bg-dark-700 disabled:opacity-30 text-slate-700 dark:text-white font-black text-xs flex items-center justify-center transition active:scale-95 cursor-pointer disabled:cursor-not-allowed"
                          title="Decrease extra employees"
                        >
                          -
                        </button>
                        <span className="w-8 text-center font-black text-xs text-blue-600 dark:text-blue-400">
                          +{extraSeats}
                        </span>
                        <button
                          type="button"
                          onClick={() => updatePlanExtraSeats(planId, 1)}
                          className="w-6 h-6 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-black text-xs flex items-center justify-center transition active:scale-95 shadow-xs cursor-pointer"
                          title="Add extra employee (+₹500/seat)"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {extraSeats > 0 ? (
                      <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-dark-700/60">
                        <span>Extra seats charge:</span>
                        <span>+{extraSeats} &times; ₹500 = +₹{extraCost.toLocaleString()}</span>
                      </div>
                    ) : (
                      <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-dark-700/60">
                        <span>Need more than 10 seats?</span>
                        <span className="text-blue-600 dark:text-blue-400 font-bold cursor-pointer" onClick={() => updatePlanExtraSeats(planId, 1)}>
                          + Add seat (₹500)
                        </span>
                      </div>
                    )}
                  </div>

                  <ul className="space-y-2 text-xs text-slate-600 dark:text-dark-300 border-t border-slate-100 dark:border-dark-800 pt-3">
                    <li className="flex items-center space-x-2 font-bold text-blue-600 dark:text-blue-400">
                      <CheckCircle2 className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                      <span>{totalSeats} Employees Total ({10} base + {extraSeats} extra)</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                      <span>Full CRM Leads & Pipeline</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                      <span>Quotations & Invoicing</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                      <span>SIM Sync & Follow-Ups</span>
                    </li>
                    {p.features?.aiCopilot && (
                      <li className="flex items-center space-x-2 font-bold text-purple-600 dark:text-purple-400">
                        <Sparkles className="h-3.5 w-3.5 text-purple-500 flex-shrink-0" />
                        <span>AI Call Brief & Copilot</span>
                      </li>
                    )}
                  </ul>
                </div>

                <div>
                  <button
                    onClick={() => handleOpenPlanCheckout(p, extraSeats)}
                    className="w-full py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider text-white shadow-md transition hover:brightness-110 active:scale-95 [background:linear-gradient(45deg,#ef4444,#6366f1,#2563eb)] cursor-pointer flex items-center justify-center space-x-1.5"
                  >
                    <span>{isCurrent ? 'Renew' : 'Upgrade to'} {p.name}</span>
                    <span>&bull;</span>
                    <span>{totalSeats} Seats</span>
                    <span>(₹{totalPlanPrice.toLocaleString()})</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* PLAN PAYMENT & SUPER ADMIN VERIFICATION MODAL */}
      {checkoutPlan && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-dark-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl [background:linear-gradient(45deg,#ef4444,#6366f1,#2563eb)] text-white shadow-sm">
                  <QrCode className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                    Subscribe to {checkoutPlan.name}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Adjust Seats &bull; Enter Company &bull; Scan QR & Enter UTR
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCheckoutPlan(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {isPlanSubmitted ? (
              /* Success State */
              <div className="py-6 text-center space-y-4">
                <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto border-2 border-emerald-500/40">
                  <Check className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-lg font-black text-slate-900 dark:text-white">
                    Payment Submitted for Verification!
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-dark-300 max-w-sm mx-auto">
                    Your transaction reference (UTR: <strong className="font-mono text-emerald-600 dark:text-emerald-400">{userPaymentId}</strong>) has been submitted to the Super Admin.
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Your subscription for <strong>{companyName}</strong> will activate automatically as soon as verified.
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setCheckoutPlan(null)}
                    className="px-6 py-2.5 rounded-xl [background:linear-gradient(45deg,#ef4444,#6366f1,#2563eb)] text-white text-xs font-bold shadow-md hover:brightness-110 transition"
                  >
                    Done / Close
                  </button>
                </div>
              </div>
            ) : (
              /* Payment Form */
              <form onSubmit={handlePlanPaymentSubmit} className="space-y-4">
                {paymentError && (
                  <div className="p-3 bg-rose-50 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 rounded-xl text-xs flex items-center space-x-2 border border-rose-200 dark:border-rose-900">
                    <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
                    <span>{paymentError}</span>
                  </div>
                )}

                {/* Step 1: Adjust number of employees */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-dark-800 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center space-x-1.5">
                      <Users className="h-4 w-4 text-blue-500" />
                      <span>Adjust Extra Employee Seats</span>
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-dark-400 block mt-0.5">
                      Base 10 included &bull; +₹500 / extra employee
                    </span>
                  </div>

                  <div className="flex items-center space-x-2 bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-xl p-1 shadow-sm">
                    <button
                      type="button"
                      disabled={planExtraSeats <= 0}
                      onClick={() => setPlanExtraSeats(prev => Math.max(0, prev - 1))}
                      className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-dark-800 hover:bg-slate-200 dark:hover:bg-dark-700 disabled:opacity-30 text-slate-800 dark:text-white font-black text-sm flex items-center justify-center transition"
                    >
                      -
                    </button>
                    <span className="w-8 text-center font-black text-xs text-blue-600 dark:text-blue-400">
                      +{planExtraSeats}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPlanExtraSeats(prev => prev + 1)}
                      className="w-7 h-7 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-black text-sm flex items-center justify-center transition shadow-sm"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Total Payable Summary */}
                {(() => {
                  const totalPayable = checkoutPlan.price + (planExtraSeats * 500);
                  const totalSeats = 10 + planExtraSeats;

                  return (
                    <div className="flex justify-between items-center bg-slate-100 dark:bg-dark-950 p-3.5 rounded-2xl border border-slate-200 dark:border-dark-800">
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                          Total Payable Amount ({totalSeats} Seats)
                        </span>
                        <span className="text-xl font-black text-slate-900 dark:text-white">
                          ₹{totalPayable.toLocaleString()} INR
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyAmount(totalPayable)}
                        className="px-3 py-1.5 rounded-lg bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700 text-slate-700 dark:text-dark-200 font-bold text-xs flex items-center space-x-1 hover:bg-slate-50 transition"
                      >
                        {copiedAmount ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                        <span>{copiedAmount ? 'Copied' : 'Copy Amount'}</span>
                      </button>
                    </div>
                  );
                })()}

                {/* Step 3: Payment Scanner visible after entering Company Name */}
                {companyName.trim().length > 0 && (
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-dark-800 space-y-3 text-center animate-in fade-in">
                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-dark-800 pb-2">
                      <span className="text-xs font-bold text-slate-700 dark:text-dark-200 flex items-center space-x-1.5">
                        <QrCode className="h-4 w-4 text-emerald-500" />
                        <span>Scan UPI QR Code</span>
                      </span>
                      <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                        ₹{(checkoutPlan.price + (planExtraSeats * 500)).toLocaleString()} INR
                      </span>
                    </div>

                    <div className="bg-white p-2.5 rounded-2xl max-w-[200px] mx-auto shadow-md border border-slate-200">
                      <img
                        src="/payment-qr.png"
                        onError={(e) => {
                          (e.target as any).src = "https://lh3.googleusercontent.com/d/1R-Zzmk5XWgsFfQh_k76xUeZzt9lPi2QJ";
                        }}
                        alt="Official Payment Scanner"
                        className="w-full h-auto object-contain rounded-xl"
                      />
                    </div>
                  </div>
                )}

                {/* Step 4: Scanner Input Box for Transaction Number */}
                {companyName.trim().length > 0 && (
                  <div className="space-y-1 animate-in fade-in">
                    <label className="block text-xs font-bold text-slate-700 dark:text-dark-200">
                      Transaction Number / UPI UTR / Reference ID <span className="text-orange-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 429381748291 or UTR from payment receipt..."
                      value={userPaymentId}
                      onChange={(e) => setUserPaymentId(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-dark-700 rounded-xl font-mono text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                    <p className="text-[10px] text-slate-400">
                      Enter the 12-digit UTR or transaction ID from your UPI payment receipt.
                    </p>
                  </div>
                )}

                {/* Optional Notes */}
                {companyName.trim().length > 0 && (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">
                      Additional Note (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Paid via HDFC account..."
                      value={paymentNotes}
                      onChange={(e) => setPaymentNotes(e.target.value)}
                      className="w-full p-2 bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-dark-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none"
                    />
                  </div>
                )}

                <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100 dark:border-dark-800">
                  <button
                    type="button"
                    onClick={() => setCheckoutPlan(null)}
                    className="px-4 py-2 rounded-xl font-semibold text-slate-600 hover:bg-slate-100 dark:text-dark-300 dark:hover:bg-dark-800 text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitPlanPaymentMutation.isPending || !companyName.trim() || !userPaymentId.trim()}
                    className="px-5 py-2.5 rounded-xl [background:linear-gradient(45deg,#ef4444,#6366f1,#2563eb)] hover:brightness-110 text-white font-bold text-xs shadow-md transition disabled:opacity-50 flex items-center space-x-1.5"
                  >
                    {submitPlanPaymentMutation.isPending ? (
                      <span>Submitting...</span>
                    ) : (
                      <>
                        <ShieldCheck className="h-4 w-4" />
                        <span>Submit Payment for Verification</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* SEAT ADD-ON PAYMENT & VERIFICATION MODAL */}
      {showSeatModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-dark-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl [background:linear-gradient(45deg,#ef4444,#6366f1,#2563eb)] text-white shadow-sm">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                    Add +{addonSeats} Extra Employee Seats
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Total Payable: ₹{(addonSeats * 500).toLocaleString()} (₹500 / seat)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSeatModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {isSeatSubmitted ? (
              <div className="py-6 text-center space-y-4">
                <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto border-2 border-emerald-500/40">
                  <Check className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-lg font-black text-slate-900 dark:text-white">
                    Seat Request Submitted!
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-dark-300 max-w-sm mx-auto">
                    Your request for +{addonSeats} extra seats (UTR: <strong className="font-mono text-emerald-600 dark:text-emerald-400">{userSeatPaymentId}</strong>) has been submitted for Super Admin verification.
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Your team limit will be expanded immediately upon Super Admin approval.
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setShowSeatModal(false)}
                    className="px-6 py-2.5 rounded-xl [background:linear-gradient(45deg,#ef4444,#6366f1,#2563eb)] text-white text-xs font-bold shadow-md hover:brightness-110 transition"
                  >
                    Done / Close
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSeatPaymentSubmit} className="space-y-4">
                {paymentError && (
                  <div className="p-3 bg-rose-50 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 rounded-xl text-xs flex items-center space-x-2 border border-rose-200 dark:border-rose-900">
                    <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
                    <span>{paymentError}</span>
                  </div>
                )}

                {/* Company Name Input */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-dark-200 mb-1">
                    Enter Company Name <span className="text-orange-500">*</span>
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      placeholder="Enter company name..."
                      value={seatCompanyName}
                      onChange={(e) => setSeatCompanyName(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-dark-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                {/* Scanner QR visible after entering Company Name */}
                {seatCompanyName.trim().length > 0 && (
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-dark-800 space-y-3 text-center animate-in fade-in">
                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-dark-800 pb-2">
                      <span className="text-xs font-bold text-slate-700 dark:text-dark-200 flex items-center space-x-1.5">
                        <QrCode className="h-4 w-4 text-emerald-500" />
                        <span>Scan UPI QR Code</span>
                      </span>
                      <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                        ₹{(addonSeats * 500).toLocaleString()} INR
                      </span>
                    </div>

                    <div className="bg-white p-2.5 rounded-2xl max-w-[190px] mx-auto shadow-md border border-slate-200">
                      <img
                        src="/payment-qr.png"
                        onError={(e) => {
                          (e.target as any).src = "https://lh3.googleusercontent.com/d/1R-Zzmk5XWgsFfQh_k76xUeZzt9lPi2QJ";
                        }}
                        alt="Official Payment Scanner"
                        className="w-full h-auto object-contain rounded-xl"
                      />
                    </div>

                    <p className="text-[11px] text-slate-500 dark:text-dark-400">
                      Scan using Google Pay, PhonePe, Paytm or BHIM UPI
                    </p>
                  </div>
                )}

                {/* Transaction UTR Input Box */}
                {seatCompanyName.trim().length > 0 && (
                  <div className="space-y-1 animate-in fade-in">
                    <label className="block text-xs font-bold text-slate-700 dark:text-dark-200">
                      Transaction Number / UPI UTR / Reference ID <span className="text-orange-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 429381748291..."
                      value={userSeatPaymentId}
                      onChange={(e) => setUserSeatPaymentId(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-dark-700 rounded-xl font-mono text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                )}

                <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100 dark:border-dark-800">
                  <button
                    type="button"
                    onClick={() => setShowSeatModal(false)}
                    className="px-4 py-2 rounded-xl font-semibold text-slate-600 hover:bg-slate-100 dark:text-dark-300 dark:hover:bg-dark-800 text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitSeatPaymentMutation.isPending || !seatCompanyName.trim() || !userSeatPaymentId.trim()}
                    className="px-5 py-2.5 rounded-xl [background:linear-gradient(45deg,#ef4444,#6366f1,#2563eb)] hover:brightness-110 text-white font-bold text-xs shadow-md transition disabled:opacity-50 flex items-center space-x-1.5"
                  >
                    {submitSeatPaymentMutation.isPending ? (
                      <span>Submitting...</span>
                    ) : (
                      <>
                        <ShieldCheck className="h-4 w-4" />
                        <span>Submit for Verification</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Payment History Table */}
      <div className="p-6 bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-3xl shadow-sm space-y-4">
        <div>
          <h3 className="font-bold text-base text-slate-900 dark:text-white">Workspace Payment History</h3>
          <p className="text-xs text-slate-500 dark:text-dark-400">Official billing receipts and transaction IDs</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-dark-800 text-slate-400 font-semibold uppercase tracking-wider">
                <th className="pb-3 pl-2">Transaction ID / UTR</th>
                <th className="pb-3">Plan / Item</th>
                <th className="pb-3">Amount</th>
                <th className="pb-3">Date</th>
                <th className="pb-3 pr-2 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-dark-800">
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-400">
                    No payment history recorded yet.
                  </td>
                </tr>
              ) : (
                payments.map((p: any) => (
                  <tr key={p._id} className="hover:bg-slate-50 dark:hover:bg-dark-800/40 transition">
                    <td className="py-3 pl-2 font-mono text-[11px] text-slate-700 dark:text-dark-200">
                      {p.paymentId || p.orderId}
                    </td>
                    <td className="py-3 font-semibold text-primary-600 dark:text-primary-400">
                      {p.planId?.name || 'Subscription Add-On'}
                    </td>
                    <td className="py-3 font-bold text-slate-900 dark:text-white">
                      ₹{p.amount?.toLocaleString() || 0}
                    </td>
                    <td className="py-3 text-slate-500">
                      {p.paidAt ? new Date(p.paidAt).toLocaleDateString() : new Date(p.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 pr-2 text-right">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${p.status === 'captured' || p.status === 'successful'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : p.status === 'pending_verification'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                        }`}>
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
