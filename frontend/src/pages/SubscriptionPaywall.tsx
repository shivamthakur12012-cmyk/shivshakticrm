import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { useAuthStore, setCachedSubscriptionExpired } from '../store/authStore';
import { Link, useNavigate } from 'react-router-dom';
import {
  Clock, Sparkles, CheckCircle2, ArrowRight,
  Users, Building2, AlertTriangle, RefreshCw, X,
  QrCode, ExternalLink, Check, ShieldCheck, LogOut
} from 'lucide-react';

interface PlanItem {
  _id: string;
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  currency: string;
  duration: number;
  durationUnit: string;
  maxUsers: number;
  features: Record<string, boolean>;
  limits: Record<string, any>;
  isDefault?: boolean;
}

export const SubscriptionPaywall: React.FC = () => {
  const { organizations, activeOrganizationId, logout, user } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const isSuperAdmin = user?.email === 'shivamthakur12012@gmail.com' || user?.role === 'Super Admin' || (user as any)?.isSuperAdmin;

  useEffect(() => {
    if (isSuperAdmin) {
      navigate('/super-admin', { replace: true });
    }
  }, [isSuperAdmin, navigate]);

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {}
    logout();
    navigate('/login');
  };

  const [selectedPlanForCheckout, setSelectedPlanForCheckout] = useState<PlanItem | null>(null);
  const [extraSeats, setExtraSeats] = useState<number>(0);
  const [companyName, setCompanyName] = useState<string>('');
  const [transactionId, setTransactionId] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successSubmitted, setSuccessSubmitted] = useState<boolean>(false);

  const rawOrg = organizations.find(o => o.id === activeOrganizationId) || organizations[0];
  const orgName = rawOrg?.name || 'Your Organization';

  // 1. Fetch live subscription status
  const { data: subData, refetch: refetchSub } = useQuery({
    queryKey: ['billing-subscription', activeOrganizationId],
    queryFn: async () => {
      const res = await api.get('/billing/subscription');
      return res.data.data;
    },
    refetchInterval: 10000 // 10 seconds polling to auto-unlock on verification
  });

  // 2. Fetch public plans (3 Plans: 1 Month @ 5000, 3 Months @ 15000, 6 Months @ 30000)
  const { data: plans, isLoading: isPlansLoading } = useQuery<PlanItem[]>({
    queryKey: ['public-plans'],
    queryFn: async () => {
      const res = await api.get('/plans');
      return res.data.data;
    }
  });

  const subscription = subData?.subscription;
  const isSuspended = subscription?.status === 'suspended' || subData?.organization?.isSuspended;
  const isCancelled = subscription?.status === 'cancelled';
  const isPendingVerification = subscription?.paymentStatus === 'pending_verification';
  const isExpired = isSuspended || isCancelled || (subData?.isExpired ?? (!subscription || subscription.status === 'expired'));
  const endDateStr = isSuspended ? null : subscription?.endDate;

  // Initialize company name from current organization
  useEffect(() => {
    if (orgName && !companyName) {
      setCompanyName(orgName);
    }
  }, [orgName, companyName]);

  // Sync cached subscription status immediately so route guards work with 0ms delay
  useEffect(() => {
    if (activeOrganizationId) {
      setCachedSubscriptionExpired(activeOrganizationId, isExpired);
    }
  }, [activeOrganizationId, isExpired]);

  // 3. Live countdown timer calculations
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number; isNegative: boolean }>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isNegative: false
  });

  useEffect(() => {
    if (!endDateStr || isSuspended) {
      setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isNegative: true });
      return;
    }

    const updateTimer = () => {
      const target = new Date(endDateStr).getTime();
      const now = new Date().getTime();
      const difference = target - now;

      if (difference <= 0) {
        const elapsed = Math.abs(difference);
        const days = Math.floor(elapsed / (1000 * 60 * 60 * 24));
        const hours = Math.floor((elapsed % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((elapsed % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((elapsed % (1000 * 60)) / 1000);
        setTimeLeft({ days, hours, minutes, seconds, isNegative: true });
      } else {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);
        setTimeLeft({ days, hours, minutes, seconds, isNegative: false });
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [endDateStr, isSuspended]);

  // 4. Submit Offline UPI Scanner Payment Mutation
  const submitPaymentMutation = useMutation({
    mutationFn: async ({
      planId,
      extraSeats,
      companyName,
      transactionId,
      notes
    }: {
      planId: string;
      extraSeats: number;
      companyName: string;
      transactionId: string;
      notes?: string;
    }) => {
      setErrorMessage(null);
      const res = await api.post('/billing/submit-payment', {
        planId,
        extraSeats,
        companyName: companyName.trim(),
        transactionId: transactionId.trim(),
        notes: notes?.trim()
      });
      return res.data;
    },
    onSuccess: () => {
      setSuccessSubmitted(true);
      queryClient.invalidateQueries({ queryKey: ['billing-subscription'] });
      refetchSub();
    },
    onError: (err: any) => {
      setErrorMessage(err.response?.data?.message || 'Failed to submit transaction reference. Please try again.');
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

  const handleOpenCheckout = (plan: PlanItem, initialExtraSeats: number = 0) => {
    setSelectedPlanForCheckout(plan);
    setExtraSeats(initialExtraSeats);
    setCompanyName(orgName || '');
    setTransactionId('');
    setNotes('');
    setErrorMessage(null);
    setSuccessSubmitted(false);
  };

  const handleSubmitPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlanForCheckout) return;
    if (!companyName.trim()) {
      setErrorMessage('Please enter your Company Name.');
      return;
    }
    if (!transactionId.trim()) {
      setErrorMessage('Please enter the UPI Transaction Reference / UTR Number.');
      return;
    }
    submitPaymentMutation.mutate({
      planId: selectedPlanForCheckout._id || selectedPlanForCheckout.id,
      extraSeats,
      companyName,
      transactionId,
      notes
    });
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white selection:bg-blue-500 selection:text-white flex flex-col justify-between relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none -z-0"></div>
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none -z-0"></div>

      {/* Top Navigation */}
      <header className="relative z-10 border-b border-slate-800 bg-slate-950/60 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <img src="/logo.svg" alt="PCS Logo" className="h-8 w-auto object-contain brightness-125" />
          <span className="text-xs font-black uppercase tracking-wider bg-[linear-gradient(45deg,#ef4444_0%,#6366f1_50%,#2563eb_100%)] text-white px-2.5 py-0.5 rounded-md shadow-sm">
            B2B SaaS Portal
          </span>
        </div>

        <div className="flex items-center space-x-3 sm:space-x-4">
          <div className="flex items-center space-x-2 text-xs text-slate-300">
            <Building2 className="h-4 w-4 text-blue-400" />
            <span className="font-bold">{orgName}</span>
          </div>

          {!isExpired && (
            <Link
              to="/dashboard"
              className="px-3.5 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold hover:bg-emerald-500/30 transition flex items-center space-x-1.5"
            >
              <span>Go to CRM Dashboard</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}

          <button
            type="button"
            onClick={handleLogout}
            className="px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer shadow-sm"
            title="Log out of account"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-12 max-w-7xl mx-auto w-full space-y-10">

        {/* Verification in Progress Alert Banner */}
        {isPendingVerification && (
          <div className="w-full max-w-4xl p-5 rounded-3xl bg-amber-950/70 border-2 border-amber-500/80 shadow-2xl space-y-3 animate-fade-in">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                  <Clock className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-base font-black text-amber-200">
                    Payment Reference Submitted — Under Verification
                  </h3>
                  <p className="text-xs text-amber-300/80">
                    Your UPI transaction ref <strong className="text-white font-mono">{subscription?.providerPaymentId || 'Pending'}</strong> is in the Super Admin verification queue.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => refetchSub()}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center space-x-1.5 transition cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Check Verification Status</span>
              </button>
            </div>
            <p className="text-[11px] text-amber-200/70 border-t border-amber-800/60 pt-2.5">
              Super Admin is validating your transaction number. Once confirmed, your subscription according to your chosen plan will activate automatically without any delay.
            </p>
          </div>
        )}

        {/* Hero Section & Live Countdown Timer */}
        <div className="text-center space-y-4 max-w-3xl">
          <h4 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
            {isSuspended
              ? 'Organization Workspace Suspended'
              : isPendingVerification
                ? 'Payment Under Verification'
                : isExpired
                  ? 'Your Subscription Has Expired'
                  : 'Manage Your Enterprise Subscription'}
          </h4>

          <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto leading-relaxed">
            {isSuspended
              ? `Your organization account has been suspended by the platform administrator. Please contact support or renew below.`
              : isPendingVerification
                ? `We have received your payment request. Your workspace will automatically unlock upon Super Admin approval.`
                : isExpired
                  ? `Access to leads, dialer sync, and client records is currently locked. Select a plan below, scan the UPI QR code, and submit your transaction number to activate.`
                  : `Your organization workspace is fully active. You can upgrade tiers or scale your team seats anytime.`}
          </p>

          {/* Countdown Clock Display Card */}
          <div className="pt-2 max-w-md mx-auto">
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 shadow-xl space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase tracking-wider">
                <span className="flex items-center space-x-1">
                  <Clock className="h-3.5 w-3.5 text-blue-400" />
                  <span>{isPendingVerification ? 'Status: Verification Pending' : isExpired ? 'Status: Expired' : 'Active Time Remaining'}</span>
                </span>
                <span className={isExpired ? 'text-rose-400' : 'text-emerald-400'}>
                  {isExpired ? 'Locked' : `${timeLeft.days} Days Left`}
                </span>
              </div>

              {!isSuspended && (
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="py-2 px-1 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-lg sm:text-xl font-black text-white block leading-tight">{timeLeft.days}</span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Days</span>
                  </div>
                  <div className="py-2 px-1 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-lg sm:text-xl font-black text-white block leading-tight">{String(timeLeft.hours).padStart(2, '0')}</span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Hours</span>
                  </div>
                  <div className="py-2 px-1 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-lg sm:text-xl font-black text-white block leading-tight">{String(timeLeft.minutes).padStart(2, '0')}</span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Minutes</span>
                  </div>
                  <div className="py-2 px-1 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-lg sm:text-xl font-black text-emerald-400 block leading-tight">{String(timeLeft.seconds).padStart(2, '0')}</span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Seconds</span>
                  </div>
                </div>
              )}

              {!isSuspended && (timeLeft.isNegative ? (
                <p className="text-[11px] text-rose-400 font-semibold mt-2.5 flex items-center justify-center space-x-1">
                  <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                  <span>Access is currently locked. Choose a plan immediately below.</span>
                </p>
              ) : (
                <p className="text-[11px] text-emerald-400 font-semibold mt-2.5 flex items-center justify-center space-x-1">
                  <CheckCircle2 className="h-3 w-3 flex-shrink-0" />
                  <span>Your workspace is active. You can renew or extend your tier anytime below.</span>
                </p>
              ))}
            </div>
          </div>
        </div>

        {/* Dynamic 3 Pricing Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto w-full">
          {isPlansLoading ? (
            <div className="col-span-full py-16 text-center text-slate-500 flex flex-col items-center justify-center space-y-2">
              <RefreshCw className="h-6 w-6 animate-spin text-blue-400" />
              <p className="text-xs">Loading subscription tiers...</p>
            </div>
          ) : (
            (plans || []).slice(0, 3).map((plan, idx) => {
              const isPopular = idx === 1 || plan.slug.includes('growth') || plan.slug.includes('3m');
              const planId = plan._id || plan.id;
              const extraSeats = planSeatsMap[planId] || 0;
              const totalSeats = (plan.maxUsers || 10) + extraSeats;
              const extraCost = extraSeats * 500;
              const totalPlanPrice = plan.price + extraCost;

              return (
                <div
                  key={planId}
                  className={`rounded-3xl p-6 sm:p-7 flex flex-col justify-between transition-all duration-300 relative ${isPopular
                    ? 'bg-gradient-to-b from-slate-800/90 to-blue-950/90 border-2 border-emerald-500 shadow-2xl shadow-emerald-500/20 scale-[1.03] z-10'
                    : 'bg-slate-950/70 border border-slate-800 hover:border-slate-700 shadow-lg'
                    }`}
                >
                  {isPopular && (
                    <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-[linear-gradient(45deg,#ef4444_0%,#6366f1_50%,#2563eb_100%)] text-white font-black text-[10px] uppercase tracking-wider px-4 py-1 rounded-full shadow-md">
                      Most Popular Value
                    </span>
                  )}

                  <div className="space-y-6">
                    <div>
                      <h3 className="text-xl font-black text-white">{plan.name}</h3>
                      <p className="text-xs text-slate-400 mt-1 min-h-[36px]">
                        {plan.description || `Full CRM access with up to 10 employee seats for ${plan.duration} ${plan.durationUnit}.`}
                      </p>
                    </div>

                    <div className="flex items-baseline space-x-1 pb-4 border-b border-slate-800 flex-wrap gap-1">
                      <span className="text-3xl sm:text-4xl font-black text-white">₹{totalPlanPrice.toLocaleString()}</span>
                      <span className="text-xs text-slate-400 font-semibold">
                        / {plan.duration} {plan.durationUnit === 'months' ? (plan.duration === 1 ? 'Month' : 'Months') : plan.durationUnit}
                      </span>
                      {extraSeats > 0 && (
                        <span className="ml-1 text-[10px] font-black text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-700">
                          +₹{extraCost.toLocaleString()} ({extraSeats} extra)
                        </span>
                      )}
                    </div>

                    {/* Features & Seat Quotas */}
                    <div className="space-y-3 text-xs text-slate-300">
                      {/* Dynamic Employee Seats Adjuster Box */}
                      <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2 font-black text-blue-300">
                            <Users className="h-4 w-4 text-blue-400 flex-shrink-0" />
                            <span>Team Size: <strong className="text-white">{totalSeats} Employees</strong></span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-bold">10 included</span>
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[11px] text-slate-300 font-medium">Add extra seats:</span>
                          <div className="flex items-center space-x-1.5 bg-slate-900 border border-slate-700 rounded-xl p-1 shadow-xs">
                            <button
                              type="button"
                              disabled={extraSeats <= 0}
                              onClick={() => updatePlanExtraSeats(planId, -1)}
                              className="w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white font-black text-xs flex items-center justify-center transition active:scale-95 cursor-pointer disabled:cursor-not-allowed"
                              title="Decrease extra employee seats"
                            >
                              -
                            </button>
                            <span className="w-8 text-center font-black text-xs text-blue-400">
                              +{extraSeats}
                            </span>
                            <button
                              type="button"
                              onClick={() => updatePlanExtraSeats(planId, 1)}
                              className="w-6 h-6 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-black text-xs flex items-center justify-center transition active:scale-95 shadow-xs cursor-pointer"
                              title="Add extra employee (+₹500/seat)"
                            >
                              +
                            </button>
                          </div>
                        </div>

                        {extraSeats > 0 ? (
                          <div className="text-[10px] text-emerald-400 font-bold flex items-center justify-between pt-1 border-t border-blue-500/20">
                            <span>Extra seats charge:</span>
                            <span>+{extraSeats} &times; ₹500 = +₹{extraCost.toLocaleString()}</span>
                          </div>
                        ) : (
                          <p className="text-[10px] text-slate-400 pt-0.5 border-t border-blue-500/10">
                            Add extra team members anytime at <strong className="text-amber-300">₹500 / employee</strong>.
                          </p>
                        )}
                      </div>

                      <div className="flex items-center space-x-2.5">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                        <span>Full CRM, Leads & Deals Pipeline</span>
                      </div>

                      <div className="flex items-center space-x-2.5">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                        <span>Quotations & Invoicing Engine</span>
                      </div>

                      <div className="flex items-center space-x-2.5">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                        <span>Multi-Channel Follow-Up Planner</span>
                      </div>

                      <div className="flex items-center space-x-2.5">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                        <span>Role-Based Permissions & SIM Sync</span>
                      </div>

                      <div className="flex items-center space-x-2.5 font-semibold text-amber-300">
                        <Sparkles className="h-4 w-4 text-amber-400 flex-shrink-0" />
                        <span>AI Call Briefs & Telephony Analytics</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-8">
                    <button
                      onClick={() => handleOpenCheckout(plan, extraSeats)}
                      className={`w-full py-3.5 px-4 rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center space-x-2 shadow-lg ${isPopular
                        ? 'bg-[linear-gradient(45deg,#ef4444_0%,#6366f1_50%,#2563eb_100%)] hover:opacity-95 text-white shadow-red-500/25'
                        : 'bg-white hover:bg-slate-100 text-slate-900 shadow-white/10'
                        } active:scale-95 cursor-pointer`}
                    >
                      <QrCode className="h-4 w-4" />
                      <span>{!isExpired ? `Renew / Upgrade (${totalSeats} Seats • ₹${totalPlanPrice.toLocaleString()})` : `Pay & Activate (${totalSeats} Seats • ₹${totalPlanPrice.toLocaleString()})`}</span>
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Extra Employees Add-On & Admin Privileges Notice */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto w-full">
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1">
            <p className="text-xs font-bold text-amber-300 flex items-center space-x-1.5">
              <span>👥 Additional Employee Seats Add-On</span>
            </p>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              All plans include up to 10 employees by default. Need to scale your sales team? Add extra employee seats during checkout or anytime for <strong className="text-white">₹500 per employee</strong>.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1">
            <p className="text-xs font-bold text-blue-300 flex items-center space-x-1.5">
              <span>🛡️ Direct Super Admin Verification</span>
            </p>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Payments are verified directly by the Super Admin upon UTR submission, guaranteeing fast activation and dedicated account management.
            </p>
          </div>
        </div>
      </main>

      {/* UPI QR SCANNER & TRANSACTION UTR SUBMISSION MODAL */}
      {selectedPlanForCheckout && (() => {
        const totalSeats = (selectedPlanForCheckout.maxUsers || 10) + extraSeats;
        const extraCost = extraSeats * 500;
        const totalAmount = selectedPlanForCheckout.price + extraCost;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in overflow-y-auto">
            <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl space-y-5 my-8">

              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-2xl bg-[linear-gradient(45deg,#ef4444_0%,#6366f1_50%,#2563eb_100%)] text-white shadow-md">
                    <QrCode className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-white">
                      Subscribe to {selectedPlanForCheckout.name}
                    </h3>
                    <p className="text-xs text-slate-400">
                      Step 1: Set Seats &bull; Step 2: Enter Company &bull; Step 3: Scan QR & Submit UTR
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedPlanForCheckout(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-white transition cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {successSubmitted ? (
                /* Success Confirmation State */
                <div className="py-8 text-center space-y-4 animate-fade-in">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border-2 border-emerald-500/40">
                    <Check className="w-8 h-8" />
                  </div>
                  <div className="space-y-1.5">
                    <h4 className="text-xl font-black text-white">Payment Reference Submitted!</h4>
                    <p className="text-xs text-slate-300 max-w-md mx-auto">
                      Your payment reference has been submitted to the Super Admin. Once verified, your subscription for <strong>{companyName}</strong> will activate automatically with <strong>{totalSeats} seats</strong>.
                    </p>
                  </div>

                  <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 max-w-sm mx-auto text-left space-y-1.5 text-xs font-semibold">
                    <div className="flex justify-between text-slate-400">
                      <span>Company Name:</span>
                      <span className="text-white font-bold">{companyName}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Transaction UTR:</span>
                      <span className="text-emerald-400 font-mono font-bold">{transactionId}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Total Amount:</span>
                      <span className="text-white font-bold">₹{totalAmount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Total Capacity:</span>
                      <span className="text-white font-bold">{totalSeats} Employees</span>
                    </div>
                  </div>

                  <div className="pt-3">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPlanForCheckout(null);
                        refetchSub();
                      }}
                      className="px-6 py-2.5 rounded-xl bg-[linear-gradient(45deg,#ef4444_0%,#6366f1_50%,#2563eb_100%)] text-white text-xs font-bold shadow-md cursor-pointer"
                    >
                      Done / Close
                    </button>
                  </div>
                </div>
              ) : (
                /* Payment Form */
                <form onSubmit={handleSubmitPayment} className="space-y-4">
                  {errorMessage && (
                    <div className="p-3 rounded-2xl bg-rose-950/80 border border-rose-800 text-rose-300 text-xs font-medium flex items-center space-x-2">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  {/* 1. Employee Seats Capacity Selector */}
                  <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-white flex items-center space-x-1.5">
                          <Users className="h-4 w-4 text-blue-400" />
                          <span>Adjust Employee Seats Capacity</span>
                        </span>
                        <span className="text-[11px] text-slate-400">
                          10 included in plan &bull; +₹500 / extra employee
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 bg-slate-900 border border-slate-700/80 rounded-xl p-1">
                        <button
                          type="button"
                          disabled={extraSeats <= 0}
                          onClick={() => setExtraSeats(prev => Math.max(0, prev - 1))}
                          className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-white font-black text-sm flex items-center justify-center transition active:scale-95 cursor-pointer"
                        >
                          -
                        </button>
                        <span className="w-10 text-center font-black text-xs text-blue-400">
                          +{extraSeats}
                        </span>
                        <button
                          type="button"
                          onClick={() => setExtraSeats(prev => prev + 1)}
                          className="w-7 h-7 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-black text-sm flex items-center justify-center transition active:scale-95 shadow-md shadow-blue-600/30 cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 2. Mandatory Company Name Input */}
                  <div>
                    <label className="block text-xs font-bold text-slate-200 mb-1">
                      Organization / Company Name <span className="text-orange-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Enter company name (e.g. Acme Corp)..."
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                    />
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Enter company name again to attach payment and generate statutory license for your organization.
                    </p>
                  </div>

                  {/* 3. Payment Scanner QR Display */}
                  {companyName.trim().length > 0 && (
                    <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 animate-fade-in text-center">
                      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                        <span className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
                          <QrCode className="w-4 h-4 text-emerald-400" />
                          <span>Scan QR via Any UPI App</span>
                        </span>
                        <span className="text-sm font-black text-emerald-400">
                          ₹{totalAmount.toLocaleString()} INR
                        </span>
                      </div>

                      {/* QR Scanner Image */}
                      <div className="bg-white p-2.5 rounded-2xl max-w-[210px] mx-auto shadow-md border border-slate-700">
                        <img
                          src="/payment-qr.png"
                          onError={(e) => {
                            (e.target as any).src = "https://lh3.googleusercontent.com/d/1R-Zzmk5XWgsFfQh_k76xUeZzt9lPi2QJ";
                          }}
                          alt="Official UPI Payment QR Scanner"
                          className="w-full h-auto object-contain rounded-xl"
                        />
                      </div>

                      <div className="text-[11px] text-slate-400 space-y-1">
                        <p className="font-semibold text-slate-300">
                          Scan using PhonePe, Google Pay, Paytm, BHIM or Mobile Banking
                        </p>
                        <a
                          href="https://drive.google.com/file/d/1R-Zzmk5XWgsFfQh_k76xUeZzt9lPi2QJ/view?usp=sharing"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center space-x-1 text-blue-400 hover:text-blue-300 text-[10px] font-bold hover:underline"
                        >
                          <span>Open High-Resolution QR in Google Drive</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  )}

                  {/* 4. Scanner Input Box: Transaction Reference / UTR Number */}
                  {companyName.trim().length > 0 && (
                    <div className="space-y-1 animate-fade-in">
                      <label className="block text-xs font-bold text-slate-200">
                        Transaction Number / UPI UTR / Reference ID <span className="text-orange-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. 429381748291 or UPI Ref Number..."
                        value={transactionId}
                        onChange={(e) => setTransactionId(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white font-mono text-xs font-bold outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
                      />
                      <p className="text-[10px] text-slate-400">
                        You can copy the 12-digit UTR from your payment receipt in PhonePe, GPay, or Paytm.
                      </p>
                    </div>
                  )}

                  {/* Optional Notes */}
                  {companyName.trim().length > 0 && (
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 mb-0.5">
                        Additional Note (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Paid from HDFC account ending in 4102"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="w-full p-2 rounded-xl border border-slate-800 bg-slate-950 text-slate-300 text-xs outline-none"
                      />
                    </div>
                  )}

                  {/* Summary Details */}
                  <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                    <span>Selected: <strong className="text-white">{selectedPlanForCheckout.name}</strong> ({selectedPlanForCheckout.duration} {selectedPlanForCheckout.durationUnit})</span>
                    <span>Capacity: <strong className="text-emerald-400">{totalSeats} Employees</strong></span>
                    <span>Total: <strong className="text-white">₹{totalAmount.toLocaleString()}</strong></span>
                  </div>

                  {/* Modal Action Buttons */}
                  <div className="space-y-2 pt-2">
                    <button
                      type="submit"
                      disabled={!companyName.trim() || !transactionId.trim() || submitPaymentMutation.isPending}
                      className="w-full py-3.5 px-6 rounded-2xl bg-[linear-gradient(45deg,#ef4444_0%,#6366f1_50%,#2563eb_100%)] hover:opacity-95 text-white font-black text-xs uppercase tracking-wider shadow-xl shadow-red-500/20 flex items-center justify-center space-x-2 transition transform active:scale-98 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {submitPaymentMutation.isPending ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          <span>Submitting Reference to Super Admin...</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="h-4 w-4" />
                          <span>Submit Payment for Super Admin Verification</span>
                        </>
                      )}
                    </button>

                    <div className="text-center pt-1">
                      <button
                        type="button"
                        onClick={() => setSelectedPlanForCheckout(null)}
                        className="text-xs font-bold text-slate-400 hover:text-white transition cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>

                </form>
              )}

            </div>
          </div>
        );
      })()}

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-800 bg-slate-950/80 px-6 py-4 text-center text-xs text-slate-400">
        <p>PCS Multi-Tenant CRM Platform &bull; Direct UPI Scanner &bull; 24/7 Super Admin Support</p>
      </footer>
    </div>
  );
};
