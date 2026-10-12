import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { 
  CreditCard, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  Search, 
  ShieldCheck, 
  AlertCircle, 
  Copy, 
  Check, 
  RefreshCw,
  Building2,
  Users
} from 'lucide-react';

export const AdminPayments: React.FC = () => {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending_verification' | 'captured' | 'failed'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedUtr, setCopiedUtr] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Rejection modal state
  const [rejectModal, setRejectModal] = useState<{
    isOpen: boolean;
    paymentId: string;
    companyName: string;
  }>({
    isOpen: false,
    paymentId: '',
    companyName: ''
  });
  const [rejectReason, setRejectReason] = useState('');

  const { data: payments, isLoading, refetch } = useQuery({
    queryKey: ['admin-payments-page'],
    queryFn: async () => {
      const res = await api.get('/admin/payments');
      return res.data.data;
    },
    refetchInterval: 10000 // Poll every 10 seconds for real-time incoming payments
  });

  // Verify and Activate Subscription Mutation
  const verifyMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post(`/admin/payments/${id}/verify`);
      return res.data;
    },
    onSuccess: (data) => {
      setActionSuccess(data.message || 'Payment verified and organization subscription successfully activated!');
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ['admin-payments-page'] });
      queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
      queryClient.invalidateQueries({ queryKey: ['admin-subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['admin-organizations'] });
      setTimeout(() => setActionSuccess(null), 6000);
    },
    onError: (err: any) => {
      setActionError(err.response?.data?.message || 'Failed to verify payment and activate subscription.');
      setTimeout(() => setActionError(null), 6000);
    }
  });

  // Reject Payment Mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const res = await api.post(`/admin/payments/${id}/reject`, { reason });
      return res.data;
    },
    onSuccess: () => {
      setActionSuccess('Payment marked as rejected.');
      setActionError(null);
      setRejectModal({ isOpen: false, paymentId: '', companyName: '' });
      setRejectReason('');
      queryClient.invalidateQueries({ queryKey: ['admin-payments-page'] });
      setTimeout(() => setActionSuccess(null), 5000);
    },
    onError: (err: any) => {
      setActionError(err.response?.data?.message || 'Failed to reject payment.');
      setTimeout(() => setActionError(null), 5000);
    }
  });

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedUtr(text);
    setTimeout(() => setCopiedUtr(null), 2000);
  };

  const handleConfirmReject = () => {
    if (!rejectModal.paymentId) return;
    rejectMutation.mutate({
      id: rejectModal.paymentId,
      reason: rejectReason.trim() || 'Payment reference could not be verified'
    });
  };

  const allPayments = payments || [];
  const pendingPayments = allPayments.filter((p: any) => p.status === 'pending_verification');
  const capturedPayments = allPayments.filter((p: any) => p.status === 'captured' || p.status === 'successful');
  const rejectedPayments = allPayments.filter((p: any) => p.status === 'failed' || p.status === 'rejected');

  const totalCollected = capturedPayments.reduce((acc: number, p: any) => acc + (p.amount || 0), 0);

  const filteredPayments = allPayments.filter((p: any) => {
    // Status filter
    if (statusFilter === 'pending_verification' && p.status !== 'pending_verification') return false;
    if (statusFilter === 'captured' && p.status !== 'captured' && p.status !== 'successful') return false;
    if (statusFilter === 'failed' && p.status !== 'failed' && p.status !== 'rejected') return false;

    // Search term filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const orgName = (p.organizationId?.name || '').toLowerCase();
      const utr = (p.paymentId || p.orderId || '').toLowerCase();
      const planName = (p.planId?.name || '').toLowerCase();
      const notes = (p.notes || '').toLowerCase();
      return orgName.includes(term) || utr.includes(term) || planName.includes(term) || notes.includes(term);
    }

    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-primary-600 dark:text-primary-400 text-xs font-bold uppercase tracking-wider mb-1">
            <CreditCard className="h-4 w-4 text-emerald-500" />
            <span>SaaS Billing & Verification Hub</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">Subscription & Payment Requests</h1>
          <p className="text-xs text-slate-500 dark:text-dark-400 mt-0.5">
            Verify UPI scanner transaction references submitted by tenant organizations to activate subscriptions and seat expansions.
          </p>
        </div>

        {/* Top Summary Cards */}
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-amber-500 text-white">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase block">Pending Verification</span>
              <span className="text-lg font-black text-amber-700 dark:text-amber-300">{pendingPayments.length}</span>
            </div>
          </div>

          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-emerald-500 text-white">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase block">Total Verified</span>
              <span className="text-lg font-black text-emerald-700 dark:text-emerald-300">₹{totalCollected.toLocaleString()}</span>
            </div>
          </div>

          <button
            onClick={() => refetch()}
            className="p-3 bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-2xl text-slate-600 dark:text-dark-300 hover:bg-slate-50 dark:hover:bg-dark-800 transition"
            title="Refresh payments list"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Action Alerts */}
      {actionSuccess && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center space-x-3 text-emerald-700 dark:text-emerald-300 text-xs font-bold animate-in fade-in">
          <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {actionError && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center space-x-3 text-rose-700 dark:text-rose-300 text-xs font-bold animate-in fade-in">
          <AlertCircle className="h-5 w-5 text-rose-500 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Urgent Pending Banner */}
      {pendingPayments.length > 0 && (
        <div className="p-4 rounded-2xl [background:linear-gradient(45deg,#ef4444,#6366f1,#2563eb)] text-white shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white/20 backdrop-blur-md rounded-xl">
              <Clock className="h-5 w-5 text-white animate-pulse" />
            </div>
            <div>
              <div className="font-extrabold text-sm">
                {pendingPayments.length} Client {pendingPayments.length === 1 ? 'Payment Needs' : 'Payments Need'} Verification!
              </div>
              <div className="text-xs text-white/90">
                Organizations are waiting for you to verify their UPI scanner UTR transaction number and activate their subscription.
              </div>
            </div>
          </div>
          <button
            onClick={() => setStatusFilter('pending_verification')}
            className="px-4 py-2 bg-white text-slate-900 rounded-xl font-black text-xs hover:bg-white/90 shadow transition shrink-0"
          >
            Review Pending Now ({pendingPayments.length})
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-dark-900 p-4 border border-slate-200 dark:border-dark-800 rounded-2xl shadow-sm">
        <div className="flex items-center space-x-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              statusFilter === 'all'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'text-slate-600 dark:text-dark-400 hover:bg-slate-100 dark:hover:bg-dark-800'
            }`}
          >
            All Transactions ({allPayments.length})
          </button>
          <button
            onClick={() => setStatusFilter('pending_verification')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 whitespace-nowrap ${
              statusFilter === 'pending_verification'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'text-amber-600 dark:text-amber-400 hover:bg-amber-500/10'
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            <span>Pending ({pendingPayments.length})</span>
          </button>
          <button
            onClick={() => setStatusFilter('captured')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              statusFilter === 'captured'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10'
            }`}
          >
            Verified ({capturedPayments.length})
          </button>
          <button
            onClick={() => setStatusFilter('failed')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              statusFilter === 'failed'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-rose-600 dark:text-rose-400 hover:bg-rose-500/10'
            }`}
          >
            Rejected ({rejectedPayments.length})
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search company, UTR, plan..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-dark-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-dark-800 bg-slate-50/70 dark:bg-dark-950/60 text-slate-500 dark:text-dark-400 font-bold uppercase tracking-wider">
                <th className="py-4 pl-6">Company / Organization</th>
                <th className="py-4">Plan & Capacity</th>
                <th className="py-4">Transaction UTR / Ref</th>
                <th className="py-4">Amount</th>
                <th className="py-4">Submitted At</th>
                <th className="py-4">Status</th>
                <th className="py-4 pr-6 text-right">Super Admin Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-dark-800">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary-500" />
                    Loading payment records...
                  </td>
                </tr>
              ) : filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No payment requests match your selected filter.
                  </td>
                </tr>
              ) : (
                filteredPayments.map((p: any) => {
                  const isPending = p.status === 'pending_verification';
                  const isVerified = p.status === 'captured' || p.status === 'successful';
                  const isRejected = p.status === 'failed' || p.status === 'rejected';

                  // Parse extra seats if present in notes
                  const notesMatch = p.notes?.match(/\+(\d+)\s+Extra\s+Seats?/i);
                  const extraSeats = notesMatch ? notesMatch[1] : null;

                  return (
                    <tr 
                      key={p._id} 
                      className={`transition ${
                        isPending 
                          ? 'bg-amber-500/5 hover:bg-amber-500/10 dark:bg-amber-500/10 dark:hover:bg-amber-500/15' 
                          : 'hover:bg-slate-50/80 dark:hover:bg-dark-800/40'
                      }`}
                    >
                      {/* Organization / Company */}
                      <td className="py-4 pl-6">
                        <div className="flex items-center space-x-2.5">
                          <div className="h-8 w-8 rounded-xl bg-slate-100 dark:bg-dark-800 flex items-center justify-center font-black text-slate-700 dark:text-white shrink-0">
                            <Building2 className="h-4 w-4 text-primary-500" />
                          </div>
                          <div>
                            <span className="font-extrabold text-slate-900 dark:text-white block text-sm">
                              {p.organizationId?.name || 'Customer Organization'}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {p.organizationId?.email || 'N/A'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Plan & Capacity */}
                      <td className="py-4">
                        <div className="font-bold text-slate-900 dark:text-white flex items-center space-x-1.5">
                          <span className="text-primary-600 dark:text-primary-400">
                            {p.planId?.name || 'Subscription Add-on'}
                          </span>
                        </div>
                        {extraSeats ? (
                          <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center space-x-1 mt-0.5">
                            <Users className="h-3 w-3" />
                            <span>+{extraSeats} Extra Seats</span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400">Base Plan Allocation</span>
                        )}
                      </td>

                      {/* Transaction UTR */}
                      <td className="py-4">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-bold text-xs bg-slate-100 dark:bg-dark-800 text-slate-800 dark:text-slate-200 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-dark-700">
                            {p.paymentId || p.orderId || 'N/A'}
                          </span>
                          {p.paymentId && (
                            <button
                              onClick={() => handleCopy(p.paymentId)}
                              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white transition"
                              title="Copy UTR Reference"
                            >
                              {copiedUtr === p.paymentId ? (
                                <Check className="h-3.5 w-3.5 text-emerald-500" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          Method: UPI Scanner (QR)
                        </span>
                      </td>

                      {/* Amount */}
                      <td className="py-4">
                        <span className="font-black text-slate-900 dark:text-white text-sm">
                          ₹{p.amount?.toLocaleString() || 0}
                        </span>
                        <span className="text-[10px] text-slate-400 block">INR</span>
                      </td>

                      {/* Date */}
                      <td className="py-4 text-slate-500 text-[11px]">
                        <div>{new Date(p.createdAt || p.paidAt).toLocaleDateString()}</div>
                        <div className="text-[10px] text-slate-400">{new Date(p.createdAt || p.paidAt).toLocaleTimeString()}</div>
                      </td>

                      {/* Status */}
                      <td className="py-4">
                        {isPending && (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 animate-pulse">
                            <Clock className="h-3 w-3" />
                            <span>Awaiting Verification</span>
                          </span>
                        )}
                        {isVerified && (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>Verified & Active</span>
                          </span>
                        )}
                        {isRejected && (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                            <XCircle className="h-3 w-3" />
                            <span>Rejected</span>
                          </span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-4 pr-6 text-right">
                        {isPending ? (
                          <div className="flex items-center justify-end space-x-2">
                            {/* Verify Button with 45-degree angle mix gradient */}
                            <button
                              disabled={verifyMutation.isPending}
                              onClick={() => verifyMutation.mutate(p._id)}
                              className="px-3.5 py-2 rounded-xl text-white font-black text-xs shadow-md transition hover:brightness-110 active:scale-95 flex items-center space-x-1.5 [background:linear-gradient(45deg,#ef4444,#6366f1,#2563eb)]"
                              title="Verify payment and activate subscription"
                            >
                              {verifyMutation.isPending && verifyMutation.variables === p._id ? (
                                <>
                                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                  <span>Activating...</span>
                                </>
                              ) : (
                                <>
                                  <ShieldCheck className="h-3.5 w-3.5" />
                                  <span>Verify & Activate</span>
                                </>
                              )}
                            </button>

                            {/* Reject Button */}
                            <button
                              onClick={() => setRejectModal({
                                isOpen: true,
                                paymentId: p._id,
                                companyName: p.organizationId?.name || 'Organization'
                              })}
                              className="px-3 py-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 font-bold text-xs transition"
                              title="Reject invalid payment"
                            >
                              Reject
                            </button>
                          </div>
                        ) : isVerified ? (
                          <div className="flex items-center justify-end space-x-1 text-emerald-600 dark:text-emerald-400 font-bold text-[11px]">
                            <ShieldCheck className="h-4 w-4" />
                            <span>Subscription Provisioned</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px] italic">No further action</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* REJECT CONFIRMATION MODAL */}
      {rejectModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-dark-900 rounded-3xl p-6 max-w-md w-full border border-slate-200 dark:border-dark-800 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-rose-600 dark:text-rose-400">
              <div className="p-2.5 rounded-2xl bg-rose-500/10">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Reject Payment Request</h3>
                <p className="text-xs text-slate-400">{rejectModal.companyName}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-dark-300">
              Are you sure you want to mark this transaction reference as invalid/unverified? The organization subscription will not be activated.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-dark-200 mb-1">
                Reason for Rejection (Optional):
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. UTR not matching in bank statement, amount mismatch..."
                rows={3}
                className="w-full p-3 bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-dark-700 rounded-2xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setRejectModal({ isOpen: false, paymentId: '', companyName: '' })}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-dark-700 text-slate-600 dark:text-dark-300 font-bold text-xs hover:bg-slate-50 dark:hover:bg-dark-800 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={rejectMutation.isPending}
                onClick={handleConfirmReject}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition disabled:opacity-50"
              >
                {rejectMutation.isPending ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
