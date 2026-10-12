import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import {
  Building2, Users, CreditCard, ShieldAlert,
  ArrowUpRight, Clock, CheckCircle2,
  AlertTriangle, TrendingUp, LifeBuoy
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const AdminOverview: React.FC = () => {
  const { data: overview } = useQuery({
    queryKey: ['admin-overview'],
    queryFn: async () => {
      const res = await api.get('/admin/overview');
      return res.data.data;
    }
  });

  const kpis = overview?.kpis || {
    totalOrgs: 0,
    totalUsers: 0,
    activeSubscriptions: 0,
    trialSubscriptions: 0,
    expiredSubscriptions: 0,
    suspendedOrganizations: 0,
    totalRevenue: 0,
    monthlyRecurringRevenue: 0
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Platform Administration</h1>
        </div>

        <div className="flex items-center space-x-2.5">
          <Link
            to="/admin/subscriptions"
            className="px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 font-bold text-xs rounded-xl shadow-sm transition flex items-center space-x-1.5"
          >
            <span>Subscriptions</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
          <Link
            to="/super-admin/tickets"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center space-x-1.5"
          >
            <LifeBuoy className="h-3.5 w-3.5" />
            <span>Support Tickets</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Monthly Recurring Revenue */}
        <div className="p-5 rounded-3xl bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Estimated MRR</span>
              <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
                ₹{kpis.monthlyRecurringRevenue?.toLocaleString() || 0}
              </p>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 flex items-center justify-center">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <span className="text-xs text-emerald-600 font-semibold mt-2 inline-block">Active recurring subscriptions</span>
        </div>

        {/* Total Platform Revenue */}
        <div className="p-5 rounded-3xl bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Revenue</span>
              <p className="text-2xl font-extrabold text-primary-600 dark:text-primary-400 mt-1">
                ₹{kpis.totalRevenue?.toLocaleString() || 0}
              </p>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-primary-50 text-primary-600 dark:bg-primary-950/40 dark:text-primary-400 flex items-center justify-center">
              <CreditCard className="h-5 w-5" />
            </div>
          </div>
          <span className="text-xs text-slate-500 mt-2 inline-block">Processed via UPI Scanner & Admin Verification</span>
        </div>

        {/* Active Organizations */}
        <div className="p-5 rounded-3xl bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Active Tenants</span>
              <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
                {kpis.totalOrgs || 0}
              </p>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 flex items-center justify-center">
              <Building2 className="h-5 w-5" />
            </div>
          </div>
          <span className="text-xs text-blue-600 font-semibold mt-2 inline-block">
            {kpis.activeSubscriptions} Active &bull; {kpis.trialSubscriptions} Trial
          </span>
        </div>

        {/* Total Registered Users */}
        <div className="p-5 rounded-3xl bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total SaaS Users</span>
              <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
                {kpis.totalUsers || 0}
              </p>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400 flex items-center justify-center">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <span className="text-xs text-slate-500 mt-2 inline-block">Across all tenant workspaces</span>
        </div>
      </div>

      {/* Secondary Status Breakdown */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 uppercase">Active Subs</span>
            <h4 className="text-lg font-black text-emerald-900 dark:text-emerald-200">{kpis.activeSubscriptions}</h4>
          </div>
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
        </div>

        <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-900/40 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-indigo-800 dark:text-indigo-300 uppercase">Trial Subs</span>
            <h4 className="text-lg font-black text-indigo-900 dark:text-indigo-200">{kpis.trialSubscriptions}</h4>
          </div>
          <Clock className="h-5 w-5 text-indigo-600" />
        </div>

        <div className="p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300 uppercase">Expired Subs</span>
            <h4 className="text-lg font-black text-amber-900 dark:text-amber-200">{kpis.expiredSubscriptions}</h4>
          </div>
          <AlertTriangle className="h-5 w-5 text-amber-600" />
        </div>

        <div className="p-4 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/40 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-rose-800 dark:text-rose-300 uppercase">Suspended Orgs</span>
            <h4 className="text-lg font-black text-rose-900 dark:text-rose-200">{kpis.suspendedOrganizations}</h4>
          </div>
          <ShieldAlert className="h-5 w-5 text-rose-600" />
        </div>

        <Link
          to="/super-admin/tickets"
          className="p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40 flex items-center justify-between hover:scale-[1.02] transition cursor-pointer"
        >
          <div>
            <span className="text-[10px] font-bold text-blue-800 dark:text-blue-300 uppercase">Support Desk</span>
            <h4 className="text-lg font-black text-blue-900 dark:text-blue-200">{kpis.openTickets ?? 0} Open</h4>
            <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold block">{kpis.totalTickets ?? 0} Total &bull; {kpis.urgentTickets ?? 0} Urgent</span>
          </div>
          <LifeBuoy className="h-5 w-5 text-blue-600 shrink-0" />
        </Link>
      </div>

      {/* Tables: Recent Audit Logs & Payments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Admin Audit Logs */}
        <div className="p-6 bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-3xl shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">Recent SaaS Audit Logs</h3>
              <p className="text-xs text-slate-500 dark:text-dark-400">Admin operations and subscription overrides</p>
            </div>
            <Link to="/admin/audit-logs" className="text-xs font-bold text-primary-600 dark:text-primary-400 hover:underline">
              View All
            </Link>
          </div>

          <div className="space-y-3">
            {!overview?.recentAuditLogs || overview.recentAuditLogs.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No audit logs recorded yet.</p>
            ) : (
              overview.recentAuditLogs.map((log: any) => (
                <div key={log._id} className="p-3 bg-slate-50 dark:bg-dark-800/60 rounded-2xl border border-slate-100 dark:border-dark-700/60 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 dark:text-white">{log.action.replace(/_/g, ' ')}</span>
                    <span className="text-[10px] text-slate-400">{new Date(log.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p className="text-slate-600 dark:text-dark-300 text-[11px]">{log.reason || 'No description provided.'}</p>
                  <div className="text-[10px] text-slate-400">
                    By <span className="font-semibold text-slate-600 dark:text-dark-200">{log.adminName}</span> &bull; {log.organizationName || 'Global'}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Payment Transactions */}
        <div className="p-6 bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-3xl shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">Recent Transactions</h3>
              <p className="text-xs text-slate-500 dark:text-dark-400">Latest UPI QR & billing entries</p>
            </div>
            <Link to="/admin/payments" className="text-xs font-bold text-primary-600 dark:text-primary-400 hover:underline">
              View All
            </Link>
          </div>

          <div className="space-y-3">
            {!overview?.recentPayments || overview.recentPayments.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No payment transactions recorded yet.</p>
            ) : (
              overview.recentPayments.map((pay: any) => (
                <div key={pay._id} className="p-3 bg-slate-50 dark:bg-dark-800/60 rounded-2xl border border-slate-100 dark:border-dark-700/60 text-xs flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-800 dark:text-white block">
                      {pay.organizationId?.name || 'Customer Organization'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">{pay.paymentId || pay.orderId}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-extrabold text-emerald-600 block">₹{pay.amount}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      {pay.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Platform Client Support Tickets Table */}
      <div className="p-6 bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-3xl shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
              <LifeBuoy className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">Recent Client Support Tickets</h3>
              <p className="text-xs text-slate-500 dark:text-dark-400">Incoming tickets and direct client reports across all tenant workspaces</p>
            </div>
          </div>
          <Link to="/super-admin/tickets" className="text-xs font-bold text-primary-600 dark:text-primary-400 hover:underline flex items-center space-x-1">
            <span>Open Helpdesk Portal</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          {!overview?.recentTickets || overview.recentTickets.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">No client tickets reported across any tenant yet.</p>
          ) : (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-dark-800 text-[11px] font-bold text-slate-400 uppercase">
                  <th className="py-2.5 px-3">Ticket ID</th>
                  <th className="py-2.5 px-3">Workspace</th>
                  <th className="py-2.5 px-3">Client</th>
                  <th className="py-2.5 px-3">Issue Title</th>
                  <th className="py-2.5 px-3">Priority</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-dark-800">
                {overview.recentTickets.map((ticket: any) => (
                  <tr key={ticket._id} className="hover:bg-slate-50 dark:hover:bg-dark-800/50 transition">
                    <td className="py-3 px-3 font-mono font-bold text-blue-600 dark:text-blue-400">
                      {ticket.ticketId}
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-semibold text-slate-800 dark:text-white">
                        {ticket.organizationId?.name || 'Workspace'}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <p className="font-semibold text-slate-800 dark:text-white">{ticket.customerId?.name || 'Direct Client'}</p>
                      {ticket.customerId?.email && <p className="text-[10px] text-slate-400">{ticket.customerId.email}</p>}
                    </td>
                    <td className="py-3 px-3 max-w-[200px] truncate text-slate-700 dark:text-slate-300 font-medium">
                      {ticket.title}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${ticket.priority === 'urgent' ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400' :
                        ticket.priority === 'high' ? 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400' :
                          ticket.priority === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400' :
                            'bg-slate-100 text-slate-700 dark:bg-dark-800 dark:text-slate-300'
                        }`}>
                        {ticket.priority}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${ticket.status === 'open' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' :
                        ticket.status === 'in_progress' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400' :
                          'bg-slate-100 text-slate-700 dark:bg-dark-800 dark:text-slate-300'
                        }`}>
                        {ticket.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-400 text-[11px]">
                      {new Date(ticket.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <Link
                        to="/super-admin/tickets"
                        className="px-2.5 py-1 text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950 rounded-lg transition"
                      >
                        Manage
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
