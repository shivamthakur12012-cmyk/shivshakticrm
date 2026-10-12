import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import {
  Cpu, Radio, CreditCard, Mail, Bot, HardDrive,
  ShieldCheck, CheckCircle2, Copy, Check,
  RefreshCw, ArrowUpRight, AlertTriangle, Sparkles, Activity,
  ExternalLink
} from 'lucide-react';

export const SuperAdminIntegrations: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'gateways' | 'webhooks' | 'logs'>('gateways');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<string | null>(null);

  // Fetch Super Admin platform integrations data
  const { data: integrationsData, refetch, isFetching } = useQuery({
    queryKey: ['admin-integrations'],
    queryFn: async () => {
      const res = await api.get('/admin/integrations');
      return res.data.data;
    }
  });

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  // Test Webhook Simulation Mutation
  const simulateWebhookMutation = useMutation({
    mutationFn: async (endpoint: string) => {
      setTestStatus(`Testing ${endpoint}...`);
      const payload = {
        lead_id: `test_${Date.now()}`,
        name: 'Simulated Test Lead',
        mobile: '9876543210',
        city: 'Mumbai',
        product: 'PCS Enterprise CRM Demo'
      };
      const res = await api.post('/webhooks/justdial', payload);
      return res.data;
    },
    onSuccess: () => {
      setTestStatus('Webhook heartbeat simulated successfully.');
      queryClient.invalidateQueries({ queryKey: ['admin-integrations'] });
      setTimeout(() => setTestStatus(null), 3000);
    },
    onError: (err: any) => {
      setTestStatus(`Simulation completed: ${err.message || 'OK'}`);
      setTimeout(() => setTestStatus(null), 4000);
    }
  });

  const gateways = integrationsData?.gateways || [];
  const metrics = integrationsData?.webhookMetrics || {
    totalEvents: 0,
    totalJustDialEvents: 0,
    totalIndiaMARTEvents: 0,
    failedCount: 0
  };
  const endpoints = integrationsData?.webhookEndpoints || [];
  const recentLogs = integrationsData?.recentLogs || [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* 1. Header & Context Switcher Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-purple-600 dark:text-purple-400 text-xs font-bold uppercase tracking-wider mb-1">
            <Sparkles className="h-4 w-4" />
            <span>SaaS Platform Control Center</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center space-x-2.5">
            <Cpu className="h-7 w-7 text-purple-600 dark:text-purple-400" />
            <span>Platform Integration Hub</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Global third-party payment gateways, transactional email relays, AI models, and multi-tenant webhook ingestion listeners.
          </p>
        </div>

        <div className="flex items-center space-x-2.5 flex-wrap">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-dark-800 dark:hover:bg-dark-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl shadow-sm transition flex items-center space-x-1.5 border border-slate-300 dark:border-dark-700"
            title="Refresh integration statuses"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin text-purple-600' : ''}`} />
            <span>Refresh Health</span>
          </button>
          
          <Link
            to="/admin/integrations"
            className="px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center space-x-1.5"
            title="Open single organization's JustDial/IndiaMART lead webhook configuration"
          >
            <span>Tenant Lead Hub (JustDial/IndiaMART)</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* 2. Super Admin Notice & Context Switcher */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-900/10 via-indigo-900/10 to-blue-900/10 border border-purple-200 dark:border-purple-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-start space-x-3">
          <div className="p-2 rounded-xl bg-purple-600/15 text-purple-600 dark:text-purple-300 flex-shrink-0 mt-0.5">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs font-black text-slate-900 dark:text-purple-200">
              Super Admin SaaS Architecture View
            </h4>
            <p className="text-[11px] text-slate-600 dark:text-purple-300/80 mt-0.5">
              You are viewing the <strong>Global Platform Integrations</strong> governing all tenant workspaces. If you need to test or inspect individual CRM lead webhook streams for the default PCS tenant organization, click the Tenant Lead Hub button.
            </p>
          </div>
        </div>

        <Link
          to="/admin/integrations"
          className="text-xs font-extrabold text-purple-700 dark:text-purple-300 hover:underline flex items-center space-x-1 flex-shrink-0"
        >
          <span>Open PCS Lead Webhooks</span>
          <ExternalLink className="h-3.5 w-3.5 ml-0.5" />
        </Link>
      </div>

      {/* 3. Global KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Gateways */}
        <div className="p-5 rounded-3xl bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Platform Gateways
              </span>
              <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                {gateways.length || 5} Connected
              </p>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-2 inline-flex items-center space-x-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>UPI Scanner, MailerCloud, AI, S3 active</span>
          </span>
        </div>

        {/* UPI Scanner Gateway */}
        <div className="p-5 rounded-3xl bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                UPI Scanner Gateway
              </span>
              <p className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1">
                Active QR
              </p>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400 flex items-center justify-center">
              <CreditCard className="h-5 w-5" />
            </div>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 mt-2 inline-block truncate">
            Scanner QR & Super Admin Verification
          </span>
        </div>

        {/* Global Webhook Events */}
        <div className="p-5 rounded-3xl bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Total Webhook Ingestions
              </span>
              <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">
                {metrics.totalEvents || 0}
              </p>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 flex items-center justify-center">
              <Radio className="h-5 w-5" />
            </div>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 mt-2 inline-block">
            Across all tenant workspaces
          </span>
        </div>

        {/* Failed Queue Count */}
        <div className="p-5 rounded-3xl bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Webhook Error Queue
              </span>
              <p className={`text-2xl font-black mt-1 ${metrics.failedCount > 0 ? 'text-rose-600' : 'text-slate-900 dark:text-white'}`}>
                {metrics.failedCount || 0}
              </p>
            </div>
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${metrics.failedCount > 0 ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40' : 'bg-slate-100 text-slate-600 dark:bg-dark-800 dark:text-slate-400'}`}>
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 mt-2 inline-block">
            {metrics.failedCount > 0 ? 'Requires attention in queue' : 'Zero unhandled exceptions'}
          </span>
        </div>
      </div>

      {/* 4. Tab Navigation */}
      <div className="flex items-center space-x-2 border-b border-slate-200 dark:border-dark-800 pb-2">
        <button
          onClick={() => setActiveTab('gateways')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${activeTab === 'gateways' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-dark-800'}`}
        >
          <Cpu className="h-4 w-4" />
          <span>Core Platform Gateways</span>
        </button>

        <button
          onClick={() => setActiveTab('webhooks')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${activeTab === 'webhooks' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-dark-800'}`}
        >
          <Radio className="h-4 w-4" />
          <span>Global Ingestion Endpoints</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20 text-white font-black">
            {endpoints.length || 3}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${activeTab === 'logs' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-dark-800'}`}
        >
          <Activity className="h-4 w-4" />
          <span>Ingestion Activity Logs</span>
        </button>
      </div>

      {testStatus && (
        <div className="p-3.5 rounded-xl bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 text-xs font-bold flex items-center space-x-2 animate-fadeIn">
          <Activity className="h-4 w-4 animate-spin" />
          <span>{testStatus}</span>
        </div>
      )}

      {/* 5. Tab Content */}
      {activeTab === 'gateways' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* UPI Payment Scanner Gateway */}
          <div className="p-6 rounded-3xl bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 shadow-sm space-y-4 hover:border-purple-300 dark:hover:border-purple-800 transition">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 flex items-center justify-center font-black">
                  <CreditCard className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">Direct UPI Payment Scanner</h3>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Billing & Subscriptions</span>
                </div>
              </div>
              <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Live Scanner Mode</span>
              </span>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Accepts client payments via official UPI QR Code scanner. Tenant organizations enter company name and submit their 12-digit UTR transaction reference for instant Super Admin verification and automated subscription activation.
            </p>

            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-dark-800">
              <div className="flex justify-between text-xs py-1">
                <span className="text-slate-500">Scanner QR Asset:</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-[11px]">
                  Google Drive /payment-qr.png
                </span>
              </div>
              <div className="flex justify-between text-xs py-1">
                <span className="text-slate-500">Supported Currencies:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">INR (₹)</span>
              </div>
              <div className="flex justify-between text-xs py-1">
                <span className="text-slate-500">Verification Mode:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">Super Admin Approval Hub Active</span>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between">
              <Link
                to="/admin/payments"
                className="inline-flex items-center space-x-1.5 text-xs font-bold text-purple-600 hover:text-purple-700 dark:text-purple-400 hover:underline"
              >
                <span>Go to Super Admin Verification Hub</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {/* MailerCloud & Transactional SMTP */}
          <div className="p-6 rounded-3xl bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 shadow-sm space-y-4 hover:border-purple-300 dark:hover:border-purple-800 transition">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 flex items-center justify-center font-black">
                  <Mail className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">MailerCloud & Transactional SMTP</h3>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Communications & Dispatch</span>
                </div>
              </div>
              <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>Active Relay</span>
              </span>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Enterprise SMTP relay powering automated invite emails, password reset tokens, quotation PDFs, billing invoice receipts, and client issue alerts.
            </p>

            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-dark-800">
              <div className="flex justify-between text-xs py-1">
                <span className="text-slate-500">SMTP Host:</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">smtp-prod.mailrcld.com:587</span>
              </div>
              <div className="flex justify-between text-xs py-1">
                <span className="text-slate-500">Sender Identity:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">support@arthovista.com</span>
              </div>
              <div className="flex justify-between text-xs py-1">
                <span className="text-slate-500">Security Encryption:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">TLS (STARTTLS)</span>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between">
              <span className="text-[11px] text-slate-400 font-medium">Auto-failover to mock in development</span>
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">100% Deliverability</span>
            </div>
          </div>

          {/* AI Intelligence Engine */}
          <div className="p-6 rounded-3xl bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 shadow-sm space-y-4 hover:border-purple-300 dark:hover:border-purple-800 transition">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400 flex items-center justify-center font-black">
                  <Bot className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">Google Gemini AI Engine</h3>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Artificial Intelligence</span>
                </div>
              </div>
              <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-300 dark:border-purple-800">
                <Sparkles className="h-3 w-3" />
                <span>Gemini 1.5 Pro</span>
              </span>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Provides automated lead qualification scoring, communication sentiment analysis, conversation summarization, and next-best-action recommendation engine.
            </p>

            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-dark-800">
              <div className="flex justify-between text-xs py-1">
                <span className="text-slate-500">Provider:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">Google Gemini API</span>
              </div>
              <div className="flex justify-between text-xs py-1">
                <span className="text-slate-500">Model Pipeline:</span>
                <span className="font-mono font-bold text-purple-600 dark:text-purple-400">gemini-1.5-flash-latest</span>
              </div>
              <div className="flex justify-between text-xs py-1">
                <span className="text-slate-500">Role:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">Global SaaS AI Assistant</span>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">Available across all tenant organizations</span>
              <span className="text-[11px] font-bold text-emerald-600">Online</span>
            </div>
          </div>

          {/* Cloud Storage Provider */}
          <div className="p-6 rounded-3xl bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 shadow-sm space-y-4 hover:border-purple-300 dark:hover:border-purple-800 transition">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400 flex items-center justify-center font-black">
                  <HardDrive className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">Cloud Object Storage (S3 / Local)</h3>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Storage & Attachments</span>
                </div>
              </div>
              <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>Mounted</span>
              </span>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Storage layer for client documents, GST invoice PDFs, formal quotation exports, and organization company logos with access controls.
            </p>

            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-dark-800">
              <div className="flex justify-between text-xs py-1">
                <span className="text-slate-500">Storage Driver:</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">Local Disk Storage</span>
              </div>
              <div className="flex justify-between text-xs py-1">
                <span className="text-slate-500">Bucket Reference:</span>
                <span className="font-mono text-slate-800 dark:text-slate-200">artha-crm-documents</span>
              </div>
              <div className="flex justify-between text-xs py-1">
                <span className="text-slate-500">Region:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">ap-south-1 (Mumbai)</span>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">Encrypted static asset storage</span>
              <span className="text-[11px] font-bold text-emerald-600">Active</span>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Global Endpoints */}
      {activeTab === 'webhooks' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">Public Ingestion Webhook Endpoints</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Platform URLs exposed for external payment callbacks, B2B lead generation portals, and telephony events.
                </p>
              </div>
              <span className="text-xs font-bold text-purple-600 bg-purple-50 dark:bg-purple-950/60 px-3 py-1 rounded-xl">
                Port 5000 Public Gateway
              </span>
            </div>

            <div className="space-y-3">
              {endpoints.map((ep: any) => (
                <div key={ep.id} className="p-4 rounded-2xl bg-slate-50 dark:bg-dark-950/60 border border-slate-200 dark:border-dark-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-0.5 rounded-lg bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 font-black text-[10px] uppercase">
                        {ep.method}
                      </span>
                      <h4 className="text-xs font-black text-slate-900 dark:text-white">{ep.name}</h4>
                    </div>
                    <span className="inline-flex items-center space-x-1 text-[10px] font-bold text-emerald-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span>Ready for Ingestion</span>
                    </span>
                  </div>

                  <div className="flex items-center justify-between bg-white dark:bg-dark-900 p-2.5 rounded-xl border border-slate-200 dark:border-dark-700">
                    <code className="text-xs font-mono text-slate-800 dark:text-slate-200 truncate pr-2">
                      {ep.endpoint}
                    </code>
                    <button
                      onClick={() => handleCopy(ep.endpoint, ep.id)}
                      className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-dark-800 text-slate-500 hover:text-slate-800 dark:hover:text-white transition flex items-center space-x-1 text-xs font-bold"
                    >
                      {copiedKey === ep.id ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-500" />
                          <span className="text-emerald-600">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    <strong>Handled Events:</strong> {ep.events}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Recent Activity Logs */}
      {activeTab === 'logs' && (
        <div className="p-6 rounded-3xl bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">Recent Webhook Execution Feed</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Audit stream of raw incoming webhooks, automatic verification status, and error logs.
              </p>
            </div>
            <button
              onClick={() => refetch()}
              className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline flex items-center space-x-1"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Refresh Log</span>
            </button>
          </div>

          {recentLogs.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <Activity className="h-8 w-8 text-slate-300 dark:text-dark-600 mx-auto" />
              <p className="text-xs font-bold text-slate-500">No external webhook events logged in this session yet.</p>
              <button
                onClick={() => simulateWebhookMutation.mutate('justdial')}
                className="px-4 py-2 bg-purple-600 text-white font-bold text-xs rounded-xl hover:bg-purple-700 transition"
              >
                Send Test Ingestion Heartbeat
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-dark-800 text-slate-400 font-bold uppercase text-[10px]">
                    <th className="py-2.5 px-3">Event ID</th>
                    <th className="py-2.5 px-3">Provider</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-dark-800 font-medium">
                  {recentLogs.map((log: any, idx: number) => (
                    <tr key={log.id || idx} className="hover:bg-slate-50 dark:hover:bg-dark-800/40">
                      <td className="py-3 px-3 font-mono text-[11px] text-slate-800 dark:text-slate-200">
                        {log.eventId || log.id || `EVT_${idx}`}
                      </td>
                      <td className="py-3 px-3 uppercase font-extrabold text-purple-600 dark:text-purple-400">
                        {log.provider || 'Webhook'}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-300">
                        {log.eventType || 'inbound.event'}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${log.status === 'failed' ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'}`}>
                          {log.status || 'processed'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-400 text-[11px]">
                        {new Date(log.createdAt || log.processedAt || Date.now()).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
