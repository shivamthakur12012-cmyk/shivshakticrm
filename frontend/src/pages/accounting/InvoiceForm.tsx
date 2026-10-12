import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../../services/api';
import { 
  Plus, Trash2, ArrowLeft, Loader2, AlertCircle, Calculator
} from 'lucide-react';

interface FormLineItem {
  itemId: string;
  name: string;
  quantity: number;
  rate: number;
  gstRate: number;
}

export const InvoiceForm: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [customerId, setCustomerId] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30); // default due date in 30 days
    return d.toISOString().split('T')[0];
  });
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<FormLineItem[]>([
    { itemId: '', name: '', quantity: 1, rate: 0, gstRate: 18 }
  ]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch Customers for customer selector
  const { data: customers, isLoading: customersLoading } = useQuery({
    queryKey: ['selector-customers'],
    queryFn: async () => {
      const response = await api.get('/customers', { params: { limit: 100 } });
      return response.data.data.customers;
    }
  });

  // Create Invoice Mutation
  const createInvoiceMutation = useMutation({
    mutationFn: async (payload: any) => {
      const response = await api.post('/invoices', payload);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      navigate('/accounting/invoices');
    },
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.message || 'Failed to create invoice.');
    }
  });

  const handleLineFieldChange = (idx: number, field: keyof FormLineItem, val: any) => {
    setLineItems(prev => {
      const copy = [...prev];
      copy[idx] = {
        ...copy[idx],
        [field]: val
      };
      return copy;
    });
  };

  const addLineItemRow = () => {
    setLineItems(prev => [...prev, { itemId: '', name: '', quantity: 1, rate: 0, gstRate: 18 }]);
  };

  const removeLineItemRow = (idx: number) => {
    if (lineItems.length === 1) return;
    setLineItems(prev => prev.filter((_, i) => i !== idx));
  };

  // Live calculations
  const calculateTotals = () => {
    let subtotal = 0;
    let taxTotal = 0;

    lineItems.forEach(item => {
      const lineSub = item.quantity * item.rate;
      const lineTax = lineSub * (item.gstRate / 100);
      subtotal += lineSub;
      taxTotal += lineTax;
    });

    return {
      subtotal,
      taxTotal,
      cgst: taxTotal / 2, // CGST component
      sgst: taxTotal / 2, // SGST component
      totalAmount: subtotal + taxTotal
    };
  };

  const totals = calculateTotals();

  const handleSubmitInvoice = (e: React.FormEvent, status: 'draft' | 'sent') => {
    e.preventDefault();
    setErrorMsg(null);

    // Validate selections
    if (!customerId) {
      setErrorMsg('Please select a customer.');
      return;
    }

    const invalidLines = lineItems.some(line => !line.itemId || line.quantity < 1 || line.rate <= 0);
    if (invalidLines) {
      setErrorMsg('Please ensure all row items are selected, with a valid rate and quantity.');
      return;
    }

    const payload = {
      customerId,
      date,
      dueDate,
      items: lineItems,
      notes,
      status
    };

    createInvoiceMutation.mutate(payload);
  };

  if (customersLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Navigation */}
      <div className="flex justify-between items-center">
        <Link 
          to="/accounting/invoices" 
          className="inline-flex items-center text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-dark-400 dark:hover:text-dark-200 transition"
        >
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          <span>Back to Invoices</span>
        </Link>
      </div>

      <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-3xl p-6 shadow-sm space-y-6">
        <div className="pb-4 border-b border-slate-100 dark:border-dark-800/80">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Generate Tax Invoice</h2>
          <p className="text-xs text-slate-400 dark:text-dark-500 mt-0.5">Generate a billing invoice. Item values are loaded dynamically from the catalog.</p>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 dark:bg-red-950/20 dark:border-red-900/50 rounded-xl flex items-start space-x-2 text-red-700 dark:text-red-400 text-xs">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form className="space-y-6 text-xs">
          {/* Customer / Dates selection */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-dark-300 uppercase tracking-wider mb-1">
                Select Customer <span className="text-red-500">*</span>
              </label>
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 dark:border-dark-800 rounded-lg bg-slate-50 dark:bg-dark-950 text-slate-950 dark:text-white outline-none cursor-pointer"
              >
                <option value="">Choose client account</option>
                {customers?.map((c: any) => (
                  <option key={c._id} value={c._id}>{c.name} ({c.companyName || 'Individual'})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-dark-300 uppercase tracking-wider mb-1">
                Invoice Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 dark:border-dark-800 rounded-lg bg-slate-50 dark:bg-dark-950 text-slate-700 dark:text-dark-200 outline-none cursor-pointer"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-dark-300 uppercase tracking-wider mb-1">
                Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 dark:border-dark-800 rounded-lg bg-slate-50 dark:bg-dark-950 text-slate-700 dark:text-dark-200 outline-none cursor-pointer"
              />
            </div>
          </div>

          {/* Line Items rows */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white border-b border-slate-100 dark:border-dark-800 pb-2">Line Items</h3>
            
            {lineItems.map((line, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-3 items-end bg-slate-50/50 dark:bg-dark-950/20 p-3 rounded-2xl border border-slate-100 dark:border-dark-800/40">
                {/* Item Catalog Select */}
                <div className="col-span-5">
                  <label className="block font-semibold text-slate-500 uppercase text-[9px] mb-1">Item / Service Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Legal Advisory, GST Filing"
                    value={line.name}
                    onChange={(e) => handleLineFieldChange(idx, 'name', e.target.value)}
                    className="w-full px-2 py-1.5 border border-slate-200 dark:border-dark-800 rounded-lg bg-white dark:bg-dark-900 text-slate-900 dark:text-white outline-none"
                  />
                </div>

                {/* Rate */}
                <div className="col-span-2">
                  <label className="block font-semibold text-slate-500 uppercase text-[9px] mb-1">Rate (₹)</label>
                  <input
                    type="number"
                    value={line.rate}
                    onChange={(e) => handleLineFieldChange(idx, 'rate', Number(e.target.value))}
                    className="w-full px-2 py-1.5 border border-slate-200 dark:border-dark-800 rounded-lg bg-white dark:bg-dark-900 text-slate-900 dark:text-white outline-none"
                  />
                </div>

                {/* Quantity */}
                <div className="col-span-1.5">
                  <label className="block font-semibold text-slate-500 uppercase text-[9px] mb-1">Qty</label>
                  <input
                    type="number"
                    min={1}
                    value={line.quantity}
                    onChange={(e) => handleLineFieldChange(idx, 'quantity', Number(e.target.value))}
                    className="w-full px-2 py-1.5 border border-slate-200 dark:border-dark-800 rounded-lg bg-white dark:bg-dark-900 text-slate-900 dark:text-white outline-none text-center"
                  />
                </div>

                {/* Tax rate select */}
                <div className="col-span-1.5">
                  <label className="block font-semibold text-slate-500 uppercase text-[9px] mb-1">GST (%)</label>
                  <select
                    value={line.gstRate}
                    onChange={(e) => handleLineFieldChange(idx, 'gstRate', Number(e.target.value))}
                    className="w-full px-2 py-1.5 border border-slate-200 dark:border-dark-800 rounded-lg bg-white dark:bg-dark-900 text-slate-900 dark:text-white outline-none cursor-pointer"
                  >
                    <option value={0}>0%</option>
                    <option value={5}>5%</option>
                    <option value={12}>12%</option>
                    <option value={18}>18%</option>
                    <option value={28}>28%</option>
                  </select>
                </div>

                {/* Total */}
                <div className="col-span-1.5 font-bold text-slate-800 dark:text-dark-200 pb-2 pl-2">
                  ₹{((line.quantity * line.rate) * (1 + line.gstRate / 100)).toFixed(2)}
                </div>

                {/* Remove button */}
                <div className="col-span-0.5 pb-1">
                  <button
                    type="button"
                    onClick={() => removeLineItemRow(idx)}
                    className="text-slate-400 hover:text-red-500 p-1"
                    title="Remove item line"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={addLineItemRow}
              className="px-3.5 py-1.5 border border-dashed border-slate-200 dark:border-dark-800 hover:border-primary-500 text-slate-650 dark:text-dark-300 font-semibold rounded-xl flex items-center space-x-1.5 text-xs shadow-2xs"
            >
              <Plus className="h-4 w-4" />
              <span>Add Line Item</span>
            </button>
          </div>

          {/* Notes and Taxation Calculation Summary grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100 dark:border-dark-800/80">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-dark-300 uppercase tracking-wider mb-1">
                Invoice Terms & Notes
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Include banking details for bank transfers or statutory terms..."
                className="w-full px-3 py-2 border border-slate-200 dark:border-dark-800 rounded-xl bg-slate-50 dark:bg-dark-950 text-slate-950 dark:text-white outline-none resize-none"
              ></textarea>
            </div>

            {/* Calculations Summary details */}
            <div className="bg-slate-50 dark:bg-dark-950/40 border border-slate-200 dark:border-dark-850 rounded-2xl p-4 space-y-3 font-semibold text-slate-500 text-xs">
              <div className="flex justify-between">
                <span>Subtotal (Net Value)</span>
                <span className="text-slate-800 dark:text-white">₹{totals.subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-[11px] font-normal text-slate-400">
                <span>Central GST (CGST - 9%)</span>
                <span>₹{totals.cgst.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-[11px] font-normal text-slate-400 border-b border-slate-200/50 pb-2">
                <span>State GST (SGST - 9%)</span>
                <span>₹{totals.sgst.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-slate-800 dark:text-white pt-1">
                <span>Grand Total (Gross Value)</span>
                <span className="text-primary-600 dark:text-primary-400">₹{totals.totalAmount.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Action triggers */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100 dark:border-dark-800">
            <button
              type="button"
              onClick={(e) => handleSubmitInvoice(e, 'draft')}
              disabled={createInvoiceMutation.isPending}
              className="px-4 py-2 border border-slate-200 dark:border-dark-800 text-slate-700 dark:text-dark-300 font-semibold rounded-lg hover:bg-slate-50"
            >
              Save as Draft
            </button>
            <button
              type="button"
              onClick={(e) => handleSubmitInvoice(e, 'sent')}
              disabled={createInvoiceMutation.isPending}
              className="bg-[linear-gradient(45deg,#ef4444_0%,#6366f1_50%,#2563eb_100%)] hover:opacity-95 text-white font-bold py-2.5 px-5 rounded-xl shadow-md shadow-red-500/20 active:scale-95 transition flex items-center space-x-1.5 cursor-pointer"
            >
              <Calculator className="h-4 w-4" />
              <span>Issue Invoice (Sent)</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
