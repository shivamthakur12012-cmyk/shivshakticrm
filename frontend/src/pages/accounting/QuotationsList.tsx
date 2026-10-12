import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { 
  FileText, Plus, Search, Eye
} from 'lucide-react';

export const QuotationsList: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [page, setPage] = useState(1);

  // Fetch quotations
  const { data: quotationsData, isLoading } = useQuery({
    queryKey: ['quotations', statusFilter, search, page],
    queryFn: async () => {
      const res = await api.get('/quotations', {
        params: {
          status: statusFilter || undefined,
          search: search || undefined,
          page,
          limit: 25
        }
      });
      return res.data.data;
    }
  });

  // Quick Convert to Invoice Mutation
  const convertMutation = useMutation({
    mutationFn: async (quoteId: string) => {
      const res = await api.post(`/quotations/${quoteId}/convert-to-invoice`, {});
      return res.data;
    },
    onSuccess: (data) => {
      alert(data.message || 'Quotation converted to Invoice!');
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      if (data.data?.invoice?._id) {
        navigate(`/accounting/invoices/${data.data.invoice._id}`);
      }
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Conversion failed.');
    }
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 dark:bg-dark-800 dark:text-dark-300 text-[10px] font-bold uppercase">Draft</span>;
      case 'sent':
        return <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400 text-[10px] font-bold uppercase">Sent</span>;
      case 'accepted':
        return <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 text-[10px] font-bold uppercase">Accepted</span>;
      case 'rejected':
        return <span className="px-2.5 py-1 rounded-full bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400 text-[10px] font-bold uppercase">Rejected</span>;
      case 'converted':
        return <span className="px-2.5 py-1 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-400 text-[10px] font-bold uppercase">Converted</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold uppercase">{status}</span>;
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 p-6 rounded-3xl shadow-sm">
        <div>
          <h1 className="text-xl font-black text-slate-800 dark:text-white flex items-center space-x-2">
            <span className="p-2 rounded-xl bg-[linear-gradient(45deg,#ef4444_0%,#6366f1_50%,#2563eb_100%)] text-white shadow-md shadow-red-500/20">
              <FileText className="h-5 w-5" />
            </span>
            <span>Quotations & Deal Proposals</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-dark-400 mt-1">
            Build GST-compliant quotations, track client approvals, and convert accepted deals directly into billing invoices.
          </p>
        </div>

        <Link
          to="/accounting/quotations/new"
          className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-[linear-gradient(45deg,#ef4444_0%,#6366f1_50%,#2563eb_100%)] hover:opacity-95 text-white font-bold text-xs transition shadow-md shadow-red-500/20 active:scale-95"
        >
          <Plus className="h-4 w-4" />
          <span>Create New Quotation</span>
        </Link>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex space-x-1 bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 p-1.5 rounded-2xl">
          {[
            { id: '', name: 'All Quotations' },
            { id: 'draft', name: 'Drafts' },
            { id: 'sent', name: 'Sent' },
            { id: 'accepted', name: 'Accepted' },
            { id: 'converted', name: 'Converted' },
            { id: 'rejected', name: 'Rejected' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => { setStatusFilter(tab.id); setPage(1); }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                statusFilter === tab.id
                  ? 'bg-[linear-gradient(45deg,#ef4444_0%,#6366f1_50%,#2563eb_100%)] text-white shadow-md shadow-red-500/20'
                  : 'text-slate-600 dark:text-dark-400 hover:bg-slate-100 dark:hover:bg-dark-800'
              }`}
            >
              {tab.name}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative min-w-[260px]">
          <Search className="h-4 w-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search quotation ID or item..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-dark-800 bg-white dark:bg-dark-900 text-xs text-slate-800 dark:text-white outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-3xl p-6 shadow-sm">
        {isLoading ? (
          <div className="py-12 text-center text-xs text-slate-400">Loading quotations...</div>
        ) : !quotationsData?.quotations || quotationsData.quotations.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <FileText className="h-10 w-10 text-slate-300 dark:text-dark-600 mx-auto" />
            <p className="text-sm font-bold text-slate-800 dark:text-white">No Quotations Found</p>
            <p className="text-xs text-slate-400">Create your first client proposal to get started.</p>
            <Link
              to="/accounting/quotations/new"
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-[linear-gradient(45deg,#ef4444_0%,#6366f1_50%,#2563eb_100%)] hover:opacity-95 text-white text-xs font-bold shadow-md shadow-red-500/20 active:scale-95"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New Quotation</span>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 dark:border-dark-800 rounded-2xl">
            <table className="w-full text-left text-xs text-slate-600 dark:text-dark-300">
              <thead className="bg-slate-50 dark:bg-dark-800 text-slate-700 dark:text-white font-bold text-[10px] uppercase tracking-wider">
                <tr>
                  <th className="p-3">Quotation #</th>
                  <th className="p-3">Client / Lead</th>
                  <th className="p-3">Items</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Valid Until</th>
                  <th className="p-3">Total Amount</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-dark-800">
                {quotationsData.quotations.map((q: any) => (
                  <tr key={q._id} className="hover:bg-slate-50/50 dark:hover:bg-dark-800/30">
                    <td className="p-3 font-mono font-bold text-primary-600">
                      <Link to={`/accounting/quotations/${q._id || q.id}`} className="hover:underline">
                        {q.quotationId || `QT-${(q._id || q.id || 'DRAFT').substring(0, 8).toUpperCase()}`}
                      </Link>
                    </td>
                    <td className="p-3">
                      <p className="font-bold text-slate-800 dark:text-white">
                        {q.leadId?.name || q.customerId?.name || 'Walk-in Client'}
                      </p>
                      <p className="text-[11px] text-slate-400">{q.leadId?.company || q.customerId?.companyName || '—'}</p>
                    </td>
                    <td className="p-3 text-slate-500">
                      {q.items?.length || 0} item(s)
                    </td>
                    <td className="p-3 text-slate-400">
                      {q.date ? new Date(q.date).toLocaleDateString('en-IN') : '—'}
                    </td>
                    <td className="p-3 text-slate-400">
                      {q.validUntil ? new Date(q.validUntil).toLocaleDateString('en-IN') : '—'}
                    </td>
                    <td className="p-3 font-bold text-slate-900 dark:text-white">
                      ₹{(Number(q.totalAmount) || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="p-3">
                      {getStatusBadge(q.status)}
                    </td>
                    <td className="p-3 text-right">
                      <div className="inline-flex items-center space-x-2">
                        {q.status === 'accepted' && !q.invoiceId && (
                          <button
                            onClick={() => convertMutation.mutate(q._id)}
                            disabled={convertMutation.isPending}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] transition"
                          >
                            Convert to Invoice
                          </button>
                        )}
                        {q.invoiceId && (
                          <Link
                            to={`/accounting/invoices/${q.invoiceId._id || q.invoiceId}`}
                            className="px-2 py-1 rounded-lg bg-purple-100 text-purple-700 font-bold text-[10px]"
                          >
                            Invoice #{q.invoiceId.invoiceId || 'INV'}
                          </Link>
                        )}
                        <Link
                          to={`/accounting/quotations/${q._id}`}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-dark-800"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
