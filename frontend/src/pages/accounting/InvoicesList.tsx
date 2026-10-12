import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { 
  Plus, Search, Loader2, FileText, IndianRupee, ChevronRight
} from 'lucide-react';

export const InvoicesList: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  // Fetch Invoices
  const { data: invoices, isLoading, isError } = useQuery({
    queryKey: ['invoices', statusFilter],
    queryFn: async () => {
      const response = await api.get('/invoices', {
        params: { status: statusFilter || undefined }
      });
      return response.data.data;
    }
  });

  // Calculate Metrics from invoiced lists
  const calculateFinancialMetrics = () => {
    if (!invoices || !Array.isArray(invoices) || invoices.length === 0) return { totalInvoiced: 0, totalPaid: 0, outstanding: 0 };
    return invoices.reduce(
      (acc: any, inv: any) => {
        if (inv.status !== 'void') {
          acc.totalInvoiced += (Number(inv.totalAmount) || 0);
          const paidAmt = Array.isArray(inv.payments)
            ? inv.payments.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0)
            : (Number(inv.amountPaid) || 0);
          acc.totalPaid += paidAmt;
        }
        return acc;
      },
      { totalInvoiced: 0, totalPaid: 0 }
    );
  };

  const metrics = calculateFinancialMetrics();
  const outstanding = metrics.totalInvoiced - metrics.totalPaid;

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400';
      case 'sent':
        return 'bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400';
      case 'partial':
        return 'bg-orange-50 text-orange-700 dark:bg-orange-950/20 dark:text-orange-400';
      case 'void':
        return 'bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400';
      default: // draft
        return 'bg-slate-50 text-slate-700 dark:bg-dark-800 dark:text-dark-400';
    }
  };

  const getPaymentDetails = (inv: any) => {
    const totalPaid = Array.isArray(inv.payments)
      ? inv.payments.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0)
      : (Number(inv.amountPaid) || 0);
    return {
      paid: totalPaid,
      balance: inv.outstandingBalance !== undefined ? inv.outstandingBalance : Math.max(0, (Number(inv.totalAmount) || 0) - totalPaid)
    };
  };

  const filteredInvoices = invoices?.filter((inv: any) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      inv.invoiceId.toLowerCase().includes(term) ||
      inv.customerId?.name.toLowerCase().includes(term) ||
      inv.customerId?.companyName?.toLowerCase().includes(term)
    );
  }) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Invoicing Ledger</h1>
          <p className="text-xs text-slate-500 dark:text-dark-400">Generate tax invoices, track payment receipts, and reconcile client accounts balances.</p>
        </div>
        <Link
          to="/accounting/invoices/new"
          className="bg-[linear-gradient(45deg,#ef4444_0%,#6366f1_50%,#2563eb_100%)] hover:opacity-95 text-white font-bold py-2.5 px-4 rounded-xl text-xs shadow-md shadow-red-500/20 transition flex items-center space-x-2 active:scale-95"
        >
          <Plus className="h-4 w-4" />
          <span>New Invoice</span>
        </Link>
      </div>

      {/* Metrics overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-3xl p-5 shadow-sm">
          <span className="block text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Total Sales Invoiced</span>
          <div className="flex items-center text-xl font-bold text-slate-900 dark:text-white mt-1">
            <IndianRupee className="h-4.5 w-4.5 text-slate-500 mr-0.5" />
            <span>{metrics.totalInvoiced.toLocaleString()}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-3xl p-5 shadow-sm">
          <span className="block text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Collected Revenue</span>
          <div className="flex items-center text-xl font-bold text-green-600 dark:text-green-400 mt-1">
            <IndianRupee className="h-4.5 w-4.5 mr-0.5" />
            <span>{metrics.totalPaid.toLocaleString()}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-3xl p-5 shadow-sm">
          <span className="block text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Outstanding Receivables</span>
          <div className="flex items-center text-xl font-bold text-orange-655 dark:text-orange-400 mt-1">
            <IndianRupee className="h-4.5 w-4.5 mr-0.5" />
            <span>{outstanding.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Tabs / Filters */}
      <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row justify-between gap-4">
        {/* Status Pills */}
        <div className="flex flex-wrap gap-1">
          {[
            { id: '', name: 'All Invoices' },
            { id: 'draft', name: 'Drafts' },
            { id: 'sent', name: 'Sent' },
            { id: 'partial', name: 'Partials' },
            { id: 'paid', name: 'Paid' },
            { id: 'void', name: 'Void' }
          ].map(pill => (
            <button
              key={pill.id}
              onClick={() => setStatusFilter(pill.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition ${
                statusFilter === pill.id 
                  ? 'bg-[linear-gradient(45deg,#ef4444_0%,#6366f1_50%,#2563eb_100%)] text-white shadow-md shadow-red-500/20' 
                  : 'text-slate-500 hover:bg-slate-100 dark:text-dark-400 dark:hover:bg-dark-800'
              }`}
            >
              {pill.name}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative max-w-xs">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
            <Search className="h-4 w-4" />
          </span>
          <input
            type="text"
            placeholder="Search invoice ID or client..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-dark-800 rounded-xl bg-slate-50 dark:bg-dark-950 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
      </div>

      {/* Table grid */}
      <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-dark-950 text-slate-400 dark:text-dark-500 text-[10px] font-semibold uppercase tracking-wider border-b border-slate-100 dark:border-dark-800/80">
                <th className="py-4 px-6">Invoice ID</th>
                <th className="py-4 px-4">Client / Account</th>
                <th className="py-4 px-4">Billing Date</th>
                <th className="py-4 px-4">Due Date</th>
                <th className="py-4 px-4">Invoice Total (₹)</th>
                <th className="py-4 px-4">Paid (₹)</th>
                <th className="py-4 px-4">Balance (₹)</th>
                <th className="py-4 px-4">Status</th>
                <th className="py-4 px-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-dark-800/50">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary-500 mb-2" />
                    <span>Loading billing ledger...</span>
                  </td>
                </tr>
              ) : isError || filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-slate-400">
                    <FileText className="h-8 w-8 mx-auto text-slate-300 dark:text-dark-700 mb-2" />
                    <p className="font-semibold text-slate-500 dark:text-dark-400">No invoices found</p>
                    <p className="text-[11px] text-slate-400 mt-0.5 font-light">Create a new invoice to start client billing.</p>
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv: any) => {
                  const pay = getPaymentDetails(inv);
                  return (
                    <tr key={inv._id} className="hover:bg-slate-50/50 dark:hover:bg-dark-900/30 transition-colors">
                      <td className="py-4 px-6 font-mono font-bold text-slate-650 dark:text-dark-400">
                        {inv.invoiceId}
                      </td>
                      <td className="py-4 px-4">
                        <div className="font-bold text-slate-900 dark:text-white">{inv.customerId?.name}</div>
                        <div className="text-[10px] text-slate-400 dark:text-dark-500 mt-0.5">{inv.customerId?.companyName || 'Individual'}</div>
                      </td>
                      <td className="py-4 px-4 text-slate-600 dark:text-dark-300">
                        {new Date(inv.date).toLocaleDateString()}
                      </td>
                      <td className="py-4 px-4 text-slate-600 dark:text-dark-300">
                        {new Date(inv.dueDate).toLocaleDateString()}
                      </td>
                      <td className="py-4 px-4 font-bold text-slate-900 dark:text-white">
                        ₹{inv.totalAmount.toLocaleString()}
                      </td>
                      <td className="py-4 px-4 text-green-600 font-semibold">
                        ₹{pay.paid.toLocaleString()}
                      </td>
                      <td className="py-4 px-4 text-orange-655 font-semibold">
                        ₹{pay.balance.toLocaleString()}
                      </td>
                      <td className="py-4 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${getStatusBadgeColor(inv.status)}`}>
                          {inv.status}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <Link 
                          to={`/accounting/invoices/${inv._id}`}
                          className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 font-semibold inline-flex items-center"
                        >
                          <span>Manage</span>
                          <ChevronRight className="h-3.5 w-3.5 ml-1" />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
