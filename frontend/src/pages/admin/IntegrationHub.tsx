import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import {
  Radio, PhoneCall, MessageSquare, Mail, RefreshCw,
  CheckCircle2, Copy, Check, Play, ShieldCheck, ArrowUpRight
} from 'lucide-react';

export const IntegrationHub: React.FC = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isSuperAdmin = user?.email === 'shivamthakur12012@gmail.com';
  const [activeChannel, setActiveChannel] = useState<'justdial' | 'indiamart' | 'dialer' | 'whatsapp' | 'email' | 'failed_queue'>('justdial');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<any>(null);

  // Reconciliation data
  const { data: reconData } = useQuery({
    queryKey: ['webhook-reconciliation'],
    queryFn: async () => {
      const res = await api.get('/webhooks/reconciliation');
      return res.data.data;
    }
  });

  // Failed queue
  const { data: failedLogs, isLoading: isLoadingFailed } = useQuery({
    queryKey: ['webhook-failed-queue'],
    queryFn: async () => {
      const res = await api.get('/webhooks/failed-queue');
      return res.data.data;
    }
  });

  // Copy helper
  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Test JustDial Webhook Mutation
  const testJustDialMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        lead_id: `JD_TEST_${Date.now()}`,
        name: 'Arun Verma',
        mobile: '9876543210',
        email: 'arun.verma@example.com',
        service: 'GST Registration & Filing',
        city: 'Delhi'
      };
      const res = await api.post('/webhooks/justdial', payload);
      return res.data;
    },
    onSuccess: (data) => {
      setTestResult({ provider: 'JustDial', data });
      queryClient.invalidateQueries({ queryKey: ['webhook-reconciliation'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    }
  });

  // Test IndiaMART Push API Mutation
  const testIndiaMartMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        QUERY_ID: `IM_TEST_${Date.now()}`,
        SENDER_NAME: 'Sunita Mehra',
        SENDER_MOBILE: '9812345678',
        SENDER_EMAIL: 'sunita.mehra@company.in',
        GLUSR_USR_COMPANYNAME: 'Mehra Exports',
        SUBJECT: 'Commercial Machinery Loan',
        QUERY_MESSAGE: 'Looking for 50 Lakhs machinery financing with quick disbursement.',
        SENDER_CITY: 'Mumbai'
      };
      const res = await api.post('/webhooks/indiamart', payload);
      return res.data;
    },
    onSuccess: (data) => {
      setTestResult({ provider: 'IndiaMART', data });
      queryClient.invalidateQueries({ queryKey: ['webhook-reconciliation'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    }
  });

  // Retry Failed Webhook Mutation
  const retryMutation = useMutation({
    mutationFn: async (logId: string) => {
      const res = await api.post(`/webhooks/failed-queue/${logId}/retry`);
      return res.data;
    },
    onSuccess: () => {
      alert('Payload flagged as resolved.');
      queryClient.invalidateQueries({ queryKey: ['webhook-failed-queue'] });
      queryClient.invalidateQueries({ queryKey: ['webhook-reconciliation'] });
    }
  });

  const webhookBaseUrl = `${window.location.protocol}//${window.location.hostname}:5000/api/webhooks`;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Super Admin context banner */}
      {isSuperAdmin && (
        <div className="p-4 rounded-2xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fadeIn shadow-xs">
          <div className="flex items-center space-x-2.5 text-xs text-blue-950 dark:text-blue-200">
            <ShieldCheck className="h-4 w-4 text-orange-500 flex-shrink-0" />
            <span>
              <strong>Super Admin Notice:</strong> You are currently viewing the <strong>Tenant Organization Lead Webhook Hub</strong> (PCS CRM). To configure global SaaS billing & UPI scanner, email servers, and platform webhooks, switch to the Platform Integration Hub.
            </span>
          </div>
          <Link
            to="/super-admin/integrations"
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-xs whitespace-nowrap transition flex items-center space-x-1.5 shadow-sm ring-1 ring-blue-400/40 flex-shrink-0"
          >
            <span>Platform Integration Hub</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 p-6 rounded-3xl shadow-sm">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-orange-500 via-amber-500 to-blue-600 text-white flex items-center justify-center font-black shadow-md">
            <Radio className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-800 dark:text-white flex items-center space-x-2">
              <span>Integrations & Telephony Hub</span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-dark-400 mt-0.5">
              Live automated lead ingest from JustDial, IndiaMART, and Telephony bridges.
            </p>
          </div>
        </div>

        {/* Quick Health Pills */}
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300 border border-orange-200 dark:border-orange-800 text-xs font-bold shadow-xs">
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
            <span>JustDial: Active</span>
          </div>
          <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-bold shadow-xs">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
            <span>IndiaMART: Active</span>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2 bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 p-1.5 rounded-2xl shadow-sm">
        {[
          { id: 'justdial', name: 'JustDial Webhook' },
          { id: 'indiamart', name: 'IndiaMART Push API' },
          { id: 'dialer', name: 'Click-to-Call / VoIP' },
          { id: 'whatsapp', name: 'WhatsApp Web & API' },
          { id: 'email', name: 'Email / SMTP' },
          { id: 'failed_queue', name: `Failed Queue (${reconData?.failedQueueCount || 0})` }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveChannel(tab.id as any); setTestResult(null); }}
            className={`py-2.5 px-3 text-center rounded-xl text-xs font-bold transition ${activeChannel === tab.id
              ? 'bg-[linear-gradient(45deg,#ef4444_0%,#6366f1_50%,#2563eb_100%)] text-white shadow-md font-black'
              : 'text-slate-600 dark:text-dark-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-dark-800'
              }`}
          >
            {tab.name}
          </button>
        ))}
      </div>

      {/* 1. JUSTDIAL CONNECTOR */}
      {activeChannel === 'justdial' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-3xl p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-dark-800 pb-4">
              <div>
                <h2 className="text-base font-black text-slate-800 dark:text-white flex items-center space-x-2">
                  <span>JustDial Lead Webhook Listener</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">Idempotent</span>
                </h2>
                <p className="text-xs text-slate-400">Incoming inquiries are automatically parsed, deduplicated by phone/Lead ID, and tagged Source = JustDial.</p>
              </div>

              <button
                onClick={() => testJustDialMutation.mutate()}
                disabled={testJustDialMutation.isPending}
                className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-[linear-gradient(45deg,#ef4444_0%,#6366f1_50%,#2563eb_100%)] hover:brightness-110 text-white font-black text-xs transition shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {testJustDialMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                <span>Simulate Webhook Push</span>
              </button>
            </div>

            {/* Webhook URL Box */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-white">Your Public Webhook URL (Paste into JustDial Partner Portal):</label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  readOnly
                  value={`${webhookBaseUrl}/justdial`}
                  className="flex-1 font-mono text-xs p-3 rounded-xl border border-slate-200 dark:border-dark-700 bg-slate-50 dark:bg-dark-800 text-slate-800 dark:text-white outline-none"
                />
                <button
                  onClick={() => handleCopy(`${webhookBaseUrl}/justdial`, 'jd_url')}
                  className="px-4 py-3 rounded-xl bg-white dark:bg-dark-800 hover:bg-blue-50 dark:hover:bg-dark-700 border border-blue-200 dark:border-blue-800 text-xs font-bold text-blue-700 dark:text-blue-300 transition shadow-xs cursor-pointer"
                >
                  {copiedKey === 'jd_url' ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Test Execution Output */}
            {testResult && testResult.provider === 'JustDial' && (
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 text-xs space-y-1">
                <p className="font-bold text-emerald-800 dark:text-emerald-300">✓ Test Lead Received Successfully!</p>
                <p className="text-emerald-700 dark:text-emerald-400">
                  Lead #{testResult.data.leadId} created and allocated to active sales rep via Round Robin rule.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. INDIAMART CONNECTOR */}
      {activeChannel === 'indiamart' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-3xl p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-dark-800 pb-4">
              <div>
                <h2 className="text-base font-black text-slate-800 dark:text-white flex items-center space-x-2">
                  <span>IndiaMART Lead Push API Receiver</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">Idempotent</span>
                </h2>
                <p className="text-xs text-slate-400">Maps QUERY_ID, SENDER_MOBILE, SENDER_NAME, and inquiry specifications directly into CRM lead schema.</p>
              </div>

              <button
                onClick={() => testIndiaMartMutation.mutate()}
                disabled={testIndiaMartMutation.isPending}
                className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-[linear-gradient(45deg,#ef4444_0%,#6366f1_50%,#2563eb_100%)] hover:brightness-110 text-white font-black text-xs transition shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {testIndiaMartMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                <span>Simulate Push API Query</span>
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-white">IndiaMART Push API Endpoint:</label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  readOnly
                  value={`${webhookBaseUrl}/indiamart`}
                  className="flex-1 font-mono text-xs p-3 rounded-xl border border-slate-200 dark:border-dark-700 bg-slate-50 dark:bg-dark-800 text-slate-800 dark:text-white outline-none"
                />
                <button
                  onClick={() => handleCopy(`${webhookBaseUrl}/indiamart`, 'im_url')}
                  className="px-4 py-3 rounded-xl bg-white dark:bg-dark-800 hover:bg-blue-50 dark:hover:bg-dark-700 border border-blue-200 dark:border-blue-800 text-xs font-bold text-blue-700 dark:text-blue-300 transition shadow-xs cursor-pointer"
                >
                  {copiedKey === 'im_url' ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {testResult && testResult.provider === 'IndiaMART' && (
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 text-xs space-y-1">
                <p className="font-bold text-emerald-800 dark:text-emerald-300">✓ IndiaMART B2B Lead Landed Successfully!</p>
                <p className="text-emerald-700 dark:text-emerald-400">
                  Lead #{testResult.data.leadId} created with product specifications and allocated to sales rep.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. CLICK-TO-CALL / VOIP */}
      {activeChannel === 'dialer' && (
        <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-3xl p-6 shadow-sm space-y-6">
          <div>
            <h2 className="text-base font-black text-slate-800 dark:text-white flex items-center space-x-2">
              <PhoneCall className="h-5 w-5 text-primary-600" />
              <span>Telephony & Click-to-Call Configuration</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Configures desktop tel: softphone dispatch, VoIP PBX webhook callback, and call recording sync.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-dark-800/40 border border-slate-200 dark:border-dark-700 space-y-2">
              <p className="text-xs font-bold text-slate-800 dark:text-white">Desktop Default Dialer (tel: protocol)</p>
              <p className="text-xs text-slate-400 leading-relaxed">
                Clicking "Call" instantly launches your system dialer (Your Phone, Skype, FaceTime, MicroSIP). If softphone is unavailable, an automatic manual call log fallback prompts notes entry.
              </p>
              <span className="inline-block px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">Enabled by Default</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-dark-800/40 border border-slate-200 dark:border-dark-700 space-y-2">
              <p className="text-xs font-bold text-slate-800 dark:text-white">Cloud VoIP API (Exotel / Knowlarity / Twilio)</p>
              <p className="text-xs text-slate-400 leading-relaxed">
                Webhook URL for automatic call duration and MP3 call recording synchronization:
              </p>
              <code className="text-[11px] font-mono text-primary-600 block bg-white dark:bg-dark-900 p-2 rounded-lg border border-slate-200 dark:border-dark-700 truncate">
                {webhookBaseUrl}/dialer/call-event
              </code>
            </div>
          </div>
        </div>
      )}

      {/* 4. WHATSAPP & EMAIL */}
      {(activeChannel === 'whatsapp' || activeChannel === 'email') && (
        <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-3xl p-6 shadow-sm space-y-4">
          <h2 className="text-base font-black text-slate-800 dark:text-white flex items-center space-x-2">
            {activeChannel === 'whatsapp' ? <MessageSquare className="h-5 w-5 text-emerald-500" /> : <Mail className="h-5 w-5 text-blue-500" />}
            <span>{activeChannel === 'whatsapp' ? 'WhatsApp Integration ' : 'Email SMTP & MailerCloud'}</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-dark-400">
            {activeChannel === 'whatsapp'
              ? 'Supports standard wa.me direct deep-links and WhatsApp Business Cloud API with template tracking and timeline logging.'
              : 'Configured with SMTP / MailerCloud transactional relay for instantaneous quotation PDFs and follow-up templates.'}
          </p>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-dark-800/40 border border-slate-200 dark:border-dark-700 space-y-2 text-xs">
            <p className="font-bold text-slate-700 dark:text-white">Active Features:</p>
            <p className="text-slate-500 dark:text-dark-400">• Automated Activity Timeline Logging • Saved Templates Selector • Delivery Status Tracking</p>
          </div>
        </div>
      )}

      {/* 5. FAILED WEBHOOK QUEUE */}
      {activeChannel === 'failed_queue' && (
        <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-dark-800 pb-4">
            <div>
              <h2 className="text-sm font-black text-slate-800 dark:text-white">Failed / Malformed Webhook Payloads</h2>
              <p className="text-xs text-slate-400">Review and resolve malformed payloads without losing leads.</p>
            </div>
          </div>

          {isLoadingFailed ? (
            <div className="py-8 text-center text-xs text-slate-400">Loading failed queue...</div>
          ) : !failedLogs || failedLogs.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
              <p className="text-sm font-bold text-slate-800 dark:text-white">No Failed Webhooks</p>
              <p className="text-xs text-slate-400">All incoming lead events processed cleanly without failures.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {failedLogs.map((log: any) => (
                <div key={log._id} className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-red-800 dark:text-red-300 uppercase">{log.provider} — {log.eventType}</p>
                      <p className="text-[11px] text-red-600 dark:text-red-400">Reason: {log.error || 'Payload format error'}</p>
                    </div>
                    <button
                      onClick={() => retryMutation.mutate(log._id)}
                      className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-xs transition"
                    >
                      Mark Resolved
                    </button>
                  </div>
                  <pre className="p-3 rounded-xl bg-white dark:bg-dark-900 text-[11px] font-mono text-slate-700 dark:text-dark-200 overflow-x-auto border border-red-100 dark:border-red-900/40">
                    {JSON.stringify(log.payload, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
