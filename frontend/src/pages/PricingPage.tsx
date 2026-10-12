import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { CheckCircle2, Sparkles, ArrowRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export const PricingPage: React.FC = () => {
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  // Dynamically load plans from backend API
  const { data: plans } = useQuery({
    queryKey: ['public-plans'],
    queryFn: async () => {
      const res = await api.get('/plans');
      return res.data.data;
    }
  });

  // Dynamic Extra Seats selection per plan
  const [planSeatsMap, setPlanSeatsMap] = useState<Record<string, number>>({});

  const updatePlanExtraSeats = (planId: string, delta: number) => {
    setPlanSeatsMap(prev => {
      const current = prev[planId] || 0;
      const next = Math.max(0, current + delta);
      return { ...prev, [planId]: next };
    });
  };

  const handleSelectPlan = (_plan: any, _extraSeats: number = 0) => {
    if (!isAuthenticated) {
      navigate('/register');
    } else {
      navigate('/settings/billing');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-dark-950 py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center space-y-3 max-w-3xl mx-auto">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 bg-[linear-gradient(45deg,rgba(239,68,68,0.18),rgba(99,102,241,0.15),rgba(37,99,235,0.18))] text-slate-800 dark:text-white border border-blue-500/30 rounded-full text-xs font-bold uppercase tracking-wider">
            <Sparkles className="h-3.5 w-3.5 text-red-500" />
            <span>Transparent, Admin-Configured Pricing</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight">
            Plans that Scale with Your Sales Engine
          </h1>
          <p className="text-sm sm:text-base text-slate-500 dark:text-dark-400">
            Multi-channel outreach across WhatsApp, Email, Instagram, and Phone Calls with AI Call Briefs and automated sequences.
          </p>
        </div>

        {/* Dynamic Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {!plans || plans.length === 0 ? (
            <div className="col-span-full py-16 text-center text-slate-400">
              Loading pricing plans...
            </div>
          ) : (
            plans.map((p: any, idx: number) => {
              const isPopular = idx === 1 || p.slug.includes('3m') || p.slug.includes('growth');
              const planId = p._id || p.id;
              const extraSeats = planSeatsMap[planId] || 0;
              const totalSeats = (p.maxUsers || 10) + extraSeats;
              const extraCost = extraSeats * 500;
              const totalPlanPrice = p.price + extraCost;

              return (
                <div
                  key={planId}
                  className={`rounded-3xl p-7 flex flex-col justify-between transition-all duration-300 relative ${
                    isPopular 
                      ? 'bg-gradient-to-b from-slate-900 to-indigo-950 text-white shadow-2xl ring-2 ring-blue-500 scale-[1.03] z-10' 
                      : 'bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 shadow-sm text-slate-900 dark:text-white hover:shadow-md'
                  }`}
                >
                  {isPopular && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[linear-gradient(45deg,#ef4444_0%,#6366f1_50%,#2563eb_100%)] text-white font-extrabold text-[9px] uppercase tracking-wider px-4 py-1 rounded-full shadow-md">
                      Most Popular Value
                    </span>
                  )}

                  <div className="space-y-6">
                    <div>
                      <h3 className="text-xl font-black">{p.name}</h3>
                      <p className={`text-xs mt-1.5 min-h-[32px] ${isPopular ? 'text-indigo-200' : 'text-slate-500 dark:text-dark-400'}`}>
                        {p.description || `Full CRM access for up to 10 employees for ${p.duration} ${p.durationUnit}.`}
                      </p>
                    </div>

                    <div className="flex items-baseline flex-wrap gap-1">
                      <span className="text-3xl sm:text-4xl font-black">₹{totalPlanPrice.toLocaleString()}</span>
                      <span className={`text-xs ml-2 font-semibold ${isPopular ? 'text-indigo-200' : 'text-slate-400'}`}>
                        / {p.duration} {p.durationUnit === 'months' ? (p.duration === 1 ? 'Month' : 'Months') : p.durationUnit}
                      </span>
                      {extraSeats > 0 && (
                        <span className="ml-1 text-[10px] font-black text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-700">
                          +₹{extraCost.toLocaleString()} ({extraSeats} extra)
                        </span>
                      )}
                    </div>

                    {/* Features list */}
                    <div className="space-y-3 text-xs pt-4 border-t border-slate-100 dark:border-dark-800/80">
                      {/* Team size customize widget */}
                      <div className={`p-3.5 rounded-2xl space-y-2 ${isPopular ? 'bg-blue-500/20 text-blue-200 border border-blue-400/30' : 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/50'}`}>
                        <div className="flex items-center justify-between font-bold">
                          <span>Team: <strong className="text-white dark:text-white font-black">{totalSeats} Employees</strong></span>
                          <span className="text-[10px] opacity-80">10 base + {extraSeats} extra</span>
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[11px] opacity-90">Add extra seats:</span>
                          <div className={`flex items-center space-x-1.5 rounded-xl p-1 shadow-xs border ${isPopular ? 'bg-slate-900 border-indigo-800' : 'bg-white dark:bg-dark-900 border-slate-200 dark:border-dark-700'}`}>
                            <button
                              type="button"
                              disabled={extraSeats <= 0}
                              onClick={() => updatePlanExtraSeats(planId, -1)}
                              className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-dark-800 hover:bg-slate-200 dark:hover:bg-dark-700 disabled:opacity-30 text-slate-800 dark:text-white font-black text-xs flex items-center justify-center transition active:scale-95 cursor-pointer disabled:cursor-not-allowed"
                              title="Decrease extra employee seats"
                            >
                              -
                            </button>
                            <span className="w-8 text-center font-black text-xs text-blue-500 dark:text-blue-400">
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
                          <div className="text-[10px] font-bold text-emerald-400 flex items-center justify-between pt-1 border-t border-blue-500/20">
                            <span>Extra seats charge:</span>
                            <span>+{extraSeats} &times; ₹500 = +₹{extraCost.toLocaleString()}</span>
                          </div>
                        ) : (
                          <p className={`text-[10px] pt-0.5 border-t ${isPopular ? 'border-blue-500/20 text-indigo-200' : 'border-blue-100 dark:border-blue-900/40 text-slate-500 dark:text-dark-400'}`}>
                            Add extra seats anytime at ₹500 / employee
                          </p>
                        )}
                      </div>

                      <div className="flex items-center space-x-2">
                        <CheckCircle2 className={`h-4 w-4 ${isPopular ? 'text-emerald-400' : 'text-emerald-600'}`} />
                        <span>Full CRM, Leads & Deals Pipeline</span>
                      </div>

                      <div className="flex items-center space-x-2">
                        <CheckCircle2 className={`h-4 w-4 ${isPopular ? 'text-emerald-400' : 'text-emerald-600'}`} />
                        <span>Quotations & Invoices Engine</span>
                      </div>

                      <div className="flex items-center space-x-2">
                        <CheckCircle2 className={`h-4 w-4 ${isPopular ? 'text-emerald-400' : 'text-emerald-600'}`} />
                        <span>Multi-Channel Outreach Planner</span>
                      </div>

                      <div className="flex items-center space-x-2">
                        <CheckCircle2 className={`h-4 w-4 ${isPopular ? 'text-emerald-400' : 'text-emerald-600'}`} />
                        <span>Role Permissions & SIM Sync</span>
                      </div>

                      <div className="flex items-center space-x-2 font-semibold text-amber-400">
                        <Sparkles className="h-4 w-4 text-amber-400" />
                        <span>AI Call Briefs & Analytics</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6">
                    <button
                      onClick={() => handleSelectPlan(p, extraSeats)}
                      className={`w-full py-3.5 px-4 rounded-2xl font-bold text-xs uppercase tracking-wider transition shadow-md flex items-center justify-center space-x-2 ${
                        isPopular 
                          ? 'bg-[linear-gradient(45deg,#ef4444_0%,#6366f1_50%,#2563eb_100%)] hover:opacity-95 text-white shadow-red-500/25 active:scale-95' 
                          : 'bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100'
                      }`}
                    >
                      <span>Choose {p.name} ({totalSeats} Seats • ₹{totalPlanPrice.toLocaleString()})</span>
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Extra Employees Add-On Note */}
        <div className="max-w-2xl mx-auto p-5 rounded-3xl bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 text-center space-y-1.5 shadow-sm">
          <h4 className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            Scale Your Organization Team Size
          </h4>
          <p className="text-xs text-slate-600 dark:text-dark-300">
            All 3 plans include up to 10 employees. Need more team members? Any organization can expand their seats at <strong className="text-slate-900 dark:text-white">₹600 / employee / month</strong>.
          </p>
        </div>

        {/* Back Link */}
        <div className="text-center pt-2">
          <Link to="/dashboard" className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline">
            &larr; Back to Application Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
};
