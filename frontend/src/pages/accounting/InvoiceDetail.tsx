import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { 
  ArrowLeft, Loader2, AlertCircle, Printer, CreditCard
} from 'lucide-react';

export const InvoiceDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form payment state
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<'cash' | 'bank_transfer' | 'upi' | 'cheque' | 'card'>('upi');
  const [payReference, setPayReference] = useState('');
  const [payDate, setPayDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Fetch Invoice Details
  const { data: invoice, isLoading, isError } = useQuery({
    queryKey: ['invoice', id],
    queryFn: async () => {
      const response = await api.get(`/invoices/${id}`);
      return response.data.data;
    }
  });

  // Record Payment Mutation
  const recordPaymentMutation = useMutation({
    mutationFn: async (payload: any) => {
      const response = await api.post(`/invoices/${id}/payments`, payload);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', id] });
      setShowPaymentModal(false);
      setPayAmount('');
      setPayReference('');
      setErrorMsg(null);
    },
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.message || 'Failed to record payment.');
    }
  });

  // Update Status Mutation (Sent, Void)
  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      const response = await api.put(`/invoices/${id}/status`, { status });
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', id] });
    }
  });

  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payAmount || Number(payAmount) <= 0) {
      setErrorMsg('Please enter a valid payment amount.');
      return;
    }
    if (!payReference.trim()) {
      setErrorMsg('Please enter a transaction reference number.');
      return;
    }

    recordPaymentMutation.mutate({
      amount: Number(payAmount),
      method: payMethod,
      reference: payReference,
      date: payDate
    });
  };

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    );
  }

  if (isError || !invoice) {
    return (
      <div className="p-6 text-center bg-white dark:bg-dark-900 border rounded-2xl">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-2" />
        <h3 className="font-bold text-slate-800 dark:text-white">Invoice not found</h3>
        <p className="text-xs text-slate-500 dark:text-dark-400 mt-1">Verify that you belong to this organization workspace.</p>
        <Link to="/accounting/invoices" className="inline-block mt-4 text-xs font-semibold text-primary-600">Back to Invoices</Link>
      </div>
    );
  }

  const invoiceItems = Array.isArray(invoice.items) ? invoice.items : [];
  const invoicePayments = Array.isArray(invoice.payments) ? invoice.payments : [];
  const totalPaid = invoicePayments.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0) || (Number(invoice.amountPaid) || 0);
  const remainingBalance = invoice.outstandingBalance !== undefined ? invoice.outstandingBalance : Math.max(0, (Number(invoice.totalAmount) || 0) - totalPaid);

  return (
    <div className="space-y-6">
      
      {/* Top action bar - Hidden during printing */}
      <div className="flex justify-between items-center no-print">
        <Link 
          to="/accounting/invoices" 
          className="inline-flex items-center text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-dark-400 dark:hover:text-dark-200 transition"
        >
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          <span>Back to Invoices</span>
        </Link>

        <div className="flex space-x-2">
          {/* Transition Status Options */}
          {invoice.status === 'draft' && (
            <button
              onClick={() => updateStatusMutation.mutate('sent')}
              disabled={updateStatusMutation.isPending}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow transition"
            >
              Issue Invoice (Mark Sent)
            </button>
          )}

          {invoice.status !== 'void' && invoice.status !== 'paid' && invoice.status !== 'draft' && (
            <button
              onClick={() => setShowPaymentModal(true)}
              className="px-3.5 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold text-xs rounded-xl shadow transition flex items-center space-x-1.5"
            >
              <CreditCard className="h-4 w-4" />
              <span>Record Payment</span>
            </button>
          )}

          {invoice.status !== 'void' && (
            <button
              onClick={() => {
                if (confirm('Void / Cancel this invoice? This will reverse client outstanding balance calculations.')) {
                  updateStatusMutation.mutate('void');
                }
              }}
              disabled={updateStatusMutation.isPending}
              className="px-3.5 py-2 border border-red-200 text-red-600 dark:border-red-950 hover:bg-red-50 dark:hover:bg-red-950/20 font-semibold text-xs rounded-xl transition"
            >
              Void Invoice
            </button>
          )}

          <button
            onClick={handlePrint}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-dark-800 text-slate-700 dark:text-dark-200 font-semibold text-xs rounded-xl transition flex items-center space-x-1.5"
          >
            <Printer className="h-4 w-4" />
            <span>Print / PDF</span>
          </button>
        </div>
      </div>

      {/* Main Print Layout frame */}
      <div className="printable-document bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-3xl p-8 shadow-sm space-y-8 print-invoice-card relative overflow-hidden">
        
        {/* Background PCS Watermark */}
        <div className="quotation-watermark pointer-events-none select-none absolute inset-0 z-0 flex items-center justify-center overflow-hidden" aria-hidden="true">
          <img
            src="/logo.svg"
            alt=""
            className="w-[560px] max-w-[85%] object-contain opacity-[0.06] dark:opacity-[0.08] print:opacity-[0.05] transform -rotate-12 select-none"
          />
        </div>

        {/* Invoice Header */}
        <div className="relative z-10 flex justify-between items-start border-b border-slate-100 dark:border-dark-800 pb-6">
          <div className="flex items-center space-x-3">
            <img src="/logo.svg" alt="PCS" className="h-9 w-auto max-w-[120px] object-contain flex-shrink-0" />
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">PCS</h2>
              <p className="text-[10px] text-slate-400 dark:text-dark-500 uppercase font-semibold">Corporate Tax Invoice</p>
            </div>
          </div>
          <div className="text-right">
            <h3 className="text-lg font-mono font-black text-slate-800 dark:text-white">{invoice.invoiceId}</h3>
            <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700 dark:bg-dark-800 dark:text-dark-300">
              Status: {invoice.status}
            </span>
          </div>
        </div>

        {/* Invoice Billing Info Grid */}
        <div className="grid grid-cols-2 gap-6 text-xs leading-relaxed">
          <div className="space-y-1">
            <span className="block text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Billed To:</span>
            <h4 className="font-bold text-slate-850 dark:text-white">{invoice.customerId?.name}</h4>
            {invoice.customerId?.companyName && <p className="text-slate-500">{invoice.customerId.companyName}</p>}
            {invoice.customerId?.billingAddress && <p className="text-slate-400 max-w-xs">{invoice.customerId.billingAddress}</p>}
            {invoice.customerId?.gstin && <p className="text-[10px] font-mono text-slate-450 mt-1">GSTIN: {invoice.customerId.gstin}</p>}
          </div>

          <div className="text-right space-y-1.5">
            <div className="flex justify-end space-x-2">
              <span className="text-slate-400">Issue Date:</span>
              <span className="font-semibold text-slate-850 dark:text-white">{new Date(invoice.date).toLocaleDateString()}</span>
            </div>
            <div className="flex justify-end space-x-2">
              <span className="text-slate-400">Due Date:</span>
              <span className="font-semibold text-slate-850 dark:text-white">{new Date(invoice.dueDate).toLocaleDateString()}</span>
            </div>
            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100 dark:border-dark-800 max-w-xs ml-auto">
              <span className="text-slate-400 font-semibold uppercase text-[10px]">Outstanding:</span>
              <span className="font-bold text-slate-900 dark:text-white">₹{remainingBalance.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Invoice Items Table */}
        <div className="overflow-x-auto bg-transparent">
          <table className="w-full text-left border-collapse text-xs bg-transparent">
            <thead>
              <tr className="bg-transparent text-slate-500 dark:text-dark-400 text-[10px] font-bold uppercase border-b border-slate-200 dark:border-dark-800">
                <th className="py-3 px-4 bg-transparent">Line Description</th>
                <th className="py-3 px-4 text-center bg-transparent">Qty</th>
                <th className="py-3 px-4 text-right bg-transparent">Rate (₹)</th>
                <th className="py-3 px-4 text-center bg-transparent">GST (%)</th>
                <th className="py-3 px-4 text-right bg-transparent">Tax (₹)</th>
                <th className="py-3 px-4 text-right bg-transparent">Total (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150 dark:divide-dark-800/40 bg-transparent">
              {invoiceItems.map((item: any, iIdx: number) => (
                <tr key={item._id || item.id || iIdx} className="bg-transparent text-slate-700 dark:text-dark-300">
                  <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white bg-transparent">{item.name}</td>
                  <td className="py-3.5 px-4 text-center bg-transparent">{item.quantity}</td>
                  <td className="py-3.5 px-4 text-right bg-transparent">₹{item.rate.toLocaleString()}</td>
                  <td className="py-3.5 px-4 text-center bg-transparent">{item.gstRate}%</td>
                  <td className="py-3.5 px-4 text-right bg-transparent">₹{item.taxAmount.toLocaleString()}</td>
                  <td className="py-3.5 px-4 text-right font-bold text-slate-900 dark:text-white bg-transparent">₹{item.total.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Financial Breakdowns */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-6 pt-4 border-t border-slate-100 dark:border-dark-800">
          <p className="text-[10px] text-slate-400 italic max-w-sm">
            {invoice.notes || 'Note: Statutory filings payments are non-refundable after government application processing commences.'}
          </p>

          <div className="w-80 space-y-3 text-xs text-slate-500 font-semibold">
            <div className="flex justify-between">
              <span>Subtotal (Net Value)</span>
              <span className="text-slate-800 dark:text-white">₹{invoice.subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-[11px] font-normal text-slate-450 border-b border-slate-100 dark:border-dark-800 pb-2">
              <span>GST Tax components</span>
              <span>₹{invoice.taxTotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-slate-900 dark:text-white">
              <span>Grand Total</span>
              <span className="text-primary-600 dark:text-primary-400">₹{invoice.totalAmount.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Payments Received History */}
        {invoicePayments.length > 0 && (
          <div className="pt-6 border-t border-slate-150 dark:border-dark-800/80 space-y-3 no-print">
            <h4 className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Payments Log</h4>
            <div className="space-y-2">
              {invoicePayments.map((p: any, pIdx: number) => (
                <div key={p._id || p.id || pIdx} className="p-3 bg-green-50/50 border border-green-100 dark:bg-green-950/20 dark:border-green-900/30 rounded-xl flex items-center justify-between text-xs">
                  <div className="space-y-0.5">
                    <span className="font-bold text-green-800 dark:text-green-400">₹{p.amount.toLocaleString()}</span>
                    <p className="text-[10px] text-slate-450 font-mono">Ref: {p.reference} ({p.method.toUpperCase()})</p>
                  </div>
                  <span className="text-[10px] text-slate-400">{new Date(p.date).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Record Payment modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs animate-fade-in" onClick={() => setShowPaymentModal(false)}></div>
          <div className="relative bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 w-full max-w-sm rounded-3xl p-6 shadow-2xl space-y-6 animate-scale-up">
            <div className="pb-3 border-b border-slate-100 dark:border-dark-800 flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Record Invoice Payment</h3>
              <button onClick={() => setShowPaymentModal(false)} className="text-slate-400">X</button>
            </div>

            {errorMsg && (
              <div className="p-3 bg-red-50 border border-red-200 dark:bg-red-950/20 dark:border-red-900/50 rounded-xl flex items-start space-x-2 text-red-700 dark:text-red-400 text-xs">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form id="record-payment-form" onSubmit={handleRecordPayment} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-dark-300 uppercase tracking-wider mb-1">
                  Payment amount (₹) <span className="text-red-500">*</span>
                </label>
                <input
                  name="amount"
                  type="number"
                  required
                  max={remainingBalance}
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder={`Max: ₹${remainingBalance.toLocaleString()}`}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-dark-800 rounded-lg bg-slate-50 dark:bg-dark-950 text-slate-950 dark:text-white outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-dark-300 uppercase tracking-wider mb-1">
                    Method
                  </label>
                  <select
                    value={payMethod}
                    onChange={(e: any) => setPayMethod(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-dark-800 rounded-lg bg-slate-50 dark:bg-dark-950 text-slate-950 dark:text-white outline-none cursor-pointer"
                  >
                    <option value="upi">UPI / GPay</option>
                    <option value="bank_transfer">Bank NEFT/RTGS</option>
                    <option value="cash">Cash Payment</option>
                    <option value="cheque">Bank Cheque</option>
                    <option value="card">Credit/Debit Card</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-dark-300 uppercase tracking-wider mb-1">
                    Payment Date
                  </label>
                  <input
                    type="date"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-dark-800 rounded-lg bg-slate-50 dark:bg-dark-950 text-slate-700 dark:text-dark-200 outline-none cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-dark-300 uppercase tracking-wider mb-1">
                  Transaction Reference <span className="text-red-500">*</span>
                </label>
                <input
                  value={payReference}
                  onChange={(e) => setPayReference(e.target.value)}
                  required
                  placeholder="E.g. Bank UTIB0001 / UPI Txn ID"
                  className="w-full px-3 py-2 border border-slate-200 dark:border-dark-800 rounded-lg bg-slate-50 dark:bg-dark-950 text-slate-950 dark:text-white outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
            </form>

            <div className="flex justify-end space-x-3 border-t border-slate-100 dark:border-dark-800 pt-4">
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="px-4 py-2 border border-slate-200 dark:border-dark-800 text-slate-700 dark:text-dark-300 font-semibold rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="record-payment-form"
                disabled={recordPaymentMutation.isPending}
                className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition"
              >
                {recordPaymentMutation.isPending ? 'Recording...' : 'Record Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
