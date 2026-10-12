import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../services/api';
import {
  LifeBuoy, CheckCircle2, AlertCircle, Send, ArrowRight,
  ShieldCheck, Phone, Mail, User, Building
} from 'lucide-react';

export const PublicIssueReport: React.FC = () => {
  const [submittedTicket, setSubmittedTicket] = useState<{ ticketId: string; createdAt: string } | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    companyName: '',
    category: 'technical',
    priority: 'medium',
    title: '',
    description: ''
  });

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const reportMutation = useMutation({
    mutationFn: async (payload: typeof formData) => {
      const res = await api.post('/tickets/public-report', payload);
      return res.data.data;
    },
    onSuccess: (data) => {
      setSubmittedTicket(data);
      setErrorMsg(null);
    },
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.message || 'Failed to submit issue report. Please check your connection.');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.phone.trim() || !formData.title.trim() || !formData.description.trim()) {
      setErrorMsg('Please fill in your Name, Phone, Issue Subject, and Description.');
      return;
    }
    reportMutation.mutate(formData);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-dark-950 flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8">
      {/* Brand Header */}
      <div className="text-center mb-8 space-y-2">
        <div className="inline-flex items-center justify-center p-3.5 bg-[linear-gradient(45deg,#ef4444_0%,#6366f1_50%,#2563eb_100%)] text-white rounded-3xl shadow-lg shadow-red-500/25 mb-2">
          <LifeBuoy className="h-8 w-8" />
        </div>
        <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
          Client Support & Issue Desk
        </h1>
        <p className="text-xs text-slate-500 dark:text-dark-400 max-w-md mx-auto">
          Direct client ticketing portal. Report any issue, service delay, or billing inquiry directly to our priority support team.
        </p>
      </div>

      {/* Main Form Container */}
      <div className="max-w-xl w-full bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-3xl p-6 sm:p-8 shadow-xl">
        {submittedTicket ? (
          <div className="text-center py-8 space-y-5">
            <div className="inline-flex p-4 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-12 w-12" />
            </div>

            <div className="space-y-1">
              <h2 className="text-xl font-black text-slate-900 dark:text-white">Issue Reported Successfully!</h2>
              <p className="text-xs text-slate-500 dark:text-dark-400">
                Your support request has been logged into our priority queue.
              </p>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-dark-800/60 border border-slate-200 dark:border-dark-700 rounded-2xl space-y-1 max-w-sm mx-auto">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Your Ticket ID</span>
              <p className="text-2xl font-mono font-black text-blue-600 dark:text-blue-400">
                {submittedTicket.ticketId}
              </p>
              <p className="text-[11px] text-slate-500">
                Logged at: {new Date(submittedTicket.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>

            <div className="text-xs text-slate-600 dark:text-dark-300 space-y-1 bg-blue-50 dark:bg-blue-950/40 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/60">
              <p className="font-bold text-blue-700 dark:text-blue-300">What happens next?</p>
              <p>Our dedicated support executive will review your ticket and reach out via <strong>WhatsApp / Phone / Email</strong> shortly.</p>
            </div>

            <button
              onClick={() => {
                setSubmittedTicket(null);
                setFormData({
                  name: '',
                  phone: '',
                  email: '',
                  companyName: '',
                  category: 'technical',
                  priority: 'medium',
                  title: '',
                  description: ''
                });
              }}
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-dark-800 dark:hover:bg-dark-700 text-slate-800 dark:text-white text-xs font-bold transition"
            >
              <span>Submit Another Report</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMsg && (
              <div className="p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-xl text-xs text-red-600 dark:text-red-400 font-semibold flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Client Info Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-white mb-1">
                  Your Full Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rahul Sharma"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-dark-800 rounded-xl text-xs outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-white mb-1">
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 9876543210"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-dark-800 rounded-xl text-xs outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-white mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="email"
                    placeholder="e.g. client@example.com"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-dark-800 rounded-xl text-xs outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-white mb-1">
                  Company / Business Name
                </label>
                <div className="relative">
                  <Building className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="e.g. Apex Enterprises"
                    value={formData.companyName}
                    onChange={e => setFormData({ ...formData, companyName: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-dark-800 rounded-xl text-xs outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Category & Urgency */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-white mb-1">
                  Issue Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.category}
                  onChange={e => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-dark-800 rounded-xl text-xs outline-none font-bold cursor-pointer"
                >
                  <option value="technical">🛠️ Technical Bug / App Issue</option>
                  <option value="billing">💳 Payment / Invoice Inquiry</option>
                  <option value="service">⏱️ Service Execution / Delay</option>
                  <option value="other">💬 General Inquiry / Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-white mb-1">
                  Urgency Level
                </label>
                <select
                  value={formData.priority}
                  onChange={e => setFormData({ ...formData, priority: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-dark-800 rounded-xl text-xs outline-none font-bold cursor-pointer"
                >
                  <option value="low">Low (General Query)</option>
                  <option value="medium">Medium (Standard Issue)</option>
                  <option value="high">High (Affecting Business)</option>
                  <option value="urgent">🚨 Urgent (Critical Blocker)</option>
                </select>
              </div>
            </div>

            {/* Subject */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-white mb-1">
                Issue Subject / Brief Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Cannot download tax filing document"
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-dark-800 rounded-xl text-xs outline-none focus:border-blue-500"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-white mb-1">
                Detailed Description <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                rows={4}
                placeholder="Please describe what happened, any error messages, or what assistance is required..."
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-dark-800 rounded-xl text-xs outline-none focus:border-blue-500"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={reportMutation.isPending}
              className="w-full py-3.5 bg-[linear-gradient(45deg,#ef4444_0%,#6366f1_50%,#2563eb_100%)] hover:opacity-95 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition shadow-lg shadow-red-500/25 flex items-center justify-center space-x-2 cursor-pointer mt-2 active:scale-95"
            >
              <Send className="h-4 w-4" />
              <span>{reportMutation.isPending ? 'Submitting Issue Ticket...' : 'Submit Issue Report'}</span>
            </button>
          </form>
        )}
      </div>

      {/* Secure footer badge */}
      <div className="mt-8 flex items-center space-x-2 text-[11px] text-slate-400">
        <ShieldCheck className="h-4 w-4 text-emerald-500" />
        <span>Secured SSL Direct Helpdesk Dispatch</span>
      </div>
    </div>
  );
};
