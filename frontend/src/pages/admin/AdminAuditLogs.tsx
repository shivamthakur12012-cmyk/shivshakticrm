import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { ShieldCheck, Search } from 'lucide-react';

export const AdminAuditLogs: React.FC = () => {
  const [search, setSearch] = useState('');

  const { data: logs } = useQuery({
    queryKey: ['admin-audit-logs-page'],
    queryFn: async () => {
      const res = await api.get('/admin/audit-logs');
      return res.data.data;
    }
  });

  const filteredLogs = (logs || []).filter((log: any) => {
    return (
      log.action.toLowerCase().includes(search.toLowerCase()) ||
      (log.adminName && log.adminName.toLowerCase().includes(search.toLowerCase())) ||
      (log.organizationName && log.organizationName.toLowerCase().includes(search.toLowerCase())) ||
      (log.reason && log.reason.toLowerCase().includes(search.toLowerCase()))
    );
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div>
        <div className="flex items-center space-x-2 text-primary-600 dark:text-primary-400 text-xs font-bold uppercase tracking-wider mb-1">
          <ShieldCheck className="h-4 w-4" />
          <span>Security & Compliance</span>
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">SaaS Platform Audit Trail</h1>
        <p className="text-xs text-slate-500 dark:text-dark-400 mt-0.5">
          Immutable log of all plan adjustments, price changes, subscription extensions, suspensions, and manual overrides.
        </p>
      </div>

      {/* Search Bar */}
      <div className="bg-white dark:bg-dark-900 p-4 rounded-2xl border border-slate-200 dark:border-dark-800">
        <div className="relative max-w-md">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search audit logs by action, admin, or organization..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 rounded-xl text-xs outline-none"
          />
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-dark-800 bg-slate-50/50 dark:bg-dark-950/40 text-slate-400 font-semibold uppercase tracking-wider">
                <th className="py-3.5 pl-6">Timestamp</th>
                <th className="py-3.5">Administrator</th>
                <th className="py-3.5">Action Executed</th>
                <th className="py-3.5">Target Organization</th>
                <th className="py-3.5 pr-6">Reason / Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-dark-800">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    No audit logs matching your search.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log: any) => (
                  <tr key={log._id} className="hover:bg-slate-50/80 dark:hover:bg-dark-800/40 transition">
                    <td className="py-4 pl-6 text-slate-500 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>

                    <td className="py-4">
                      <span className="font-bold text-slate-900 dark:text-white block">{log.adminName}</span>
                      <span className="text-[10px] text-slate-400">{log.adminEmail}</span>
                    </td>

                    <td className="py-4">
                      <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-primary-50 text-primary-700 dark:bg-primary-950/40 dark:text-primary-300">
                        {log.action.replace(/_/g, ' ')}
                      </span>
                    </td>

                    <td className="py-4 font-semibold text-slate-700 dark:text-dark-200">
                      {log.organizationName || 'Platform Global'}
                    </td>

                    <td className="py-4 pr-6 text-slate-600 dark:text-dark-300">
                      {log.reason || 'No additional notes'}
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
