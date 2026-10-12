import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import {
  Plus, Trash2, ArrowLeft, CheckCircle2,
  Send, Printer, RefreshCw, Eye, Edit3,
  Check
} from 'lucide-react';

interface LineItem {
  itemId?: string;
  name: string;
  description: string;
  quantity: number;
  rate: number;
  discountPercent: number;
  discountAmount: number;
  gstRate: number;
  taxAmount: number;
  subtotal: number;
  total: number;
}

function formatDisplayDate(d: string | Date | undefined): string {
  if (!d) return '';
  const dateObj = new Date(d);
  if (isNaN(dateObj.getTime())) return String(d);
  const day = dateObj.getDate();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
  const month = months[dateObj.getMonth()];
  const year = dateObj.getFullYear();
  return `${day} ${month} ${year}`;
}

function formatINR(val: number): string {
  return val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export const QuotationBuilder: React.FC = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const leadIdParam = searchParams.get('leadId');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { organizations, activeOrganizationId } = useAuthStore();

  const isEdit = !!id && id !== 'new';
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>(isEdit ? 'preview' : 'edit');

  const [leadId, setLeadId] = useState<string>(leadIdParam || '');
  const [customerId, setCustomerId] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [validUntil, setValidUntil] = useState<string>(
    new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );

  // Client / Billed To Fields
  const [clientName, setClientName] = useState<string>('Vani Inflatables');
  const [clientAddress, setClientAddress] = useState<string>('Shop No. 76 Gali No.5 r block part 2 Vikas Nagar, New Delhi, Delhi');
  const [clientGstin, setClientGstin] = useState<string>('07NCHPS2735C');
  const [clientPhone, setClientPhone] = useState<string>('8178596419');
  const [dealNumber, setDealNumber] = useState<string>('423');
  const [placeOfSupply, setPlaceOfSupply] = useState<string>('Delhi (07)');

  // Items State
  const [items, setItems] = useState<LineItem[]>([
    {
      name: 'Web CRM',
      description: '',
      quantity: 2,
      rate: 2331,
      discountPercent: 0,
      discountAmount: 0,
      gstRate: 18,
      taxAmount: 839.16,
      subtotal: 4662,
      total: 5501.16
    }
  ]);

  // Notes & Remarks (Page 2 Texts)
  const defaultRemarks = `1) PCS ERP @5500 / 2 month plan  1onth plan\nInclude -- 2 user web + mobile app\ninclude -- wattsup integration\n\n2) Billing Date 22/09/ 2026 to 22/11/2026`;
  const defaultNotes = `1) You are required to assign one spokesperson from your side with us having good excel knowledge. He will be responsible to carry out all communication with us.`;

  const [proposalRemarks, setProposalRemarks] = useState<string>(defaultRemarks);
  const [notes, setNotes] = useState<string>(defaultNotes);

  // Active Organization Info
  const activeOrg = organizations.find(org => org.id === activeOrganizationId) || organizations[0];

  // Fetch Full Organization details (address, gstin, phone, email, etc.)
  const { data: orgProfile } = useQuery({
    queryKey: ['active-org-profile', activeOrganizationId],
    queryFn: async () => {
      try {
        const res = await api.get('/organizations');
        return res.data?.data;
      } catch {
        return null;
      }
    },
    enabled: !!activeOrganizationId
  });

  const orgName = orgProfile?.name || activeOrg?.name || 'PCS ERP';
  const orgAddress = orgProfile?.address || (activeOrg as any)?.address || '91 Spring, Sec-63, Noida';
  const orgGstin = orgProfile?.gstin || (activeOrg as any)?.gstin || '07AAJCD3003A1ZF';
  const orgEmail = orgProfile?.email || (activeOrg as any)?.email || 'info@e-pcspl.com';
  const orgPhone = orgProfile?.phone || (activeOrg as any)?.phone || '0120-19055745';
  const orgBankName = orgProfile?.bankName || (activeOrg as any)?.bankName || 'ICICI Bank';
  const orgBankAccount = orgProfile?.bankAccount || (activeOrg as any)?.bankAccount || '663005601483';
  const orgBankIfsc = orgProfile?.bankIfsc || (activeOrg as any)?.bankIfsc || 'ICIC0006630';

  // Fetch Existing Quotation if Edit
  const { data: existingQuotation, isLoading: isLoadingQuotation } = useQuery({
    queryKey: ['quotation', id],
    queryFn: async () => {
      if (!isEdit) return null;
      const res = await api.get(`/quotations/${id}`);
      return res.data.data;
    },
    enabled: isEdit
  });

  // Fetch Leads for dropdown
  const { data: leadsData } = useQuery({
    queryKey: ['leads-dropdown'],
    queryFn: async () => {
      const res = await api.get('/leads', { params: { limit: 100 } });
      return res.data.data.leads;
    }
  });

  // Selected lead object for rich presentation
  const selectedLead = (leadsData || []).find((l: any) => l._id === leadId || l.id === leadId) ||
    (existingQuotation?.leadId && typeof existingQuotation.leadId === 'object' ? existingQuotation.leadId : null);

  // Load existing data into state
  useEffect(() => {
    if (existingQuotation) {
      const lId = existingQuotation.leadId?._id || existingQuotation.leadId?.id || existingQuotation.leadId;
      if (lId && typeof lId === 'string') setLeadId(lId);

      const cId = existingQuotation.customerId?._id || existingQuotation.customerId?.id || existingQuotation.customerId;
      if (cId && typeof cId === 'string') setCustomerId(cId);

      if (existingQuotation.date) setDate(new Date(existingQuotation.date).toISOString().split('T')[0]);
      if (existingQuotation.validUntil) setValidUntil(new Date(existingQuotation.validUntil).toISOString().split('T')[0]);
      if (existingQuotation.items && Array.isArray(existingQuotation.items) && existingQuotation.items.length > 0) {
        setItems(existingQuotation.items);
      }
      if (existingQuotation.notes) setProposalRemarks(existingQuotation.notes);
      if (existingQuotation.termsAndConditions) setNotes(existingQuotation.termsAndConditions);

      const party = (existingQuotation.leadId && typeof existingQuotation.leadId === 'object')
        ? existingQuotation.leadId
        : (existingQuotation.customerId && typeof existingQuotation.customerId === 'object')
          ? existingQuotation.customerId
          : null;

      if (party) {
        if (party.company || party.companyName || party.name) setClientName(party.company || party.companyName || party.name);
        if (party.location || party.address || party.billingAddress) setClientAddress(party.location || party.address || party.billingAddress);
        if (party.gstin) setClientGstin(party.gstin);
        if (party.phone) setClientPhone(party.phone);
        if (party.leadId) setDealNumber(party.leadId.replace(/[^0-9]/g, '') || party.leadId);
      }
    } else if (selectedLead) {
      if (selectedLead.company || selectedLead.name) setClientName(selectedLead.company || selectedLead.name);
      if (selectedLead.location || selectedLead.address) setClientAddress(selectedLead.location || selectedLead.address);
      if (selectedLead.gstin) setClientGstin(selectedLead.gstin);
      if (selectedLead.phone) setClientPhone(selectedLead.phone);
      if (selectedLead.leadId) setDealNumber(selectedLead.leadId.replace(/[^0-9]/g, '') || selectedLead.leadId);
    }
  }, [existingQuotation, selectedLead]);

  // Recalculate item line values
  const handleItemChange = (index: number, field: keyof LineItem, value: any) => {
    const updated = [...items];
    const item = { ...updated[index], [field]: value };

    const qty = Number(item.quantity) || 0;
    const rate = Number(item.rate) || 0;
    const discPct = Number(item.discountPercent) || 0;
    const gst = Number(item.gstRate) || 0;

    const rawSubtotal = qty * rate;
    const discountAmount = Math.round((rawSubtotal * (discPct / 100)) * 100) / 100;
    const subtotal = Math.max(0, rawSubtotal - discountAmount);
    const taxAmount = Math.round((subtotal * (gst / 100)) * 100) / 100;
    const total = subtotal + taxAmount;

    item.discountAmount = discountAmount;
    item.subtotal = subtotal;
    item.taxAmount = taxAmount;
    item.total = total;

    updated[index] = item;
    setItems(updated);
  };

  const addItemRow = () => {
    setItems([
      ...items,
      {
        name: '',
        description: '',
        quantity: 1,
        rate: 0,
        discountPercent: 0,
        discountAmount: 0,
        gstRate: 18,
        taxAmount: 0,
        subtotal: 0,
        total: 0
      }
    ]);
  };

  const removeItemRow = (index: number) => {
    if (items.length <= 1) {
      alert('Quotation must contain at least one line item.');
      return;
    }
    setItems(items.filter((_, i) => i !== index));
  };

  // Grand totals & GST Breakdown
  const subtotalSum = items.reduce((sum, it) => sum + (Number(it.quantity) * Number(it.rate)), 0);
  const totalDiscountSum = items.reduce((sum, it) => sum + (Number(it.discountAmount) || 0), 0);
  const taxableValue = subtotalSum - totalDiscountSum;
  const taxTotalSum = items.reduce((sum, it) => sum + (Number(it.taxAmount) || 0), 0);
  const exactSum = taxableValue + taxTotalSum;
  const roundedGrandTotal = Math.round(exactSum);
  const roundOff = Math.round((roundedGrandTotal - exactSum) * 100) / 100;
  const finalTotal = exactSum + roundOff;

  // Inter-state check (Comparing GSTIN state codes, e.g. "07" for Delhi)
  const orgGstinPrefix = (orgGstin || '07').substring(0, 2);
  const clientGstinPrefix = (clientGstin || '07').substring(0, 2);
  const isInterState = orgGstinPrefix !== clientGstinPrefix;

  // Resolved quotation number (Formatted as QTN-2026-000035)
  const resolvedQuotationNo = existingQuotation?.quotationId
    ? (existingQuotation.quotationId.startsWith('QT-')
      ? `QTN-2026-${existingQuotation.quotationId.replace('QT-', '').padStart(6, '0')}`
      : existingQuotation.quotationId)
    : 'QTN-2026-000035';

  // Save / Update Mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        leadId: leadId || undefined,
        customerId: customerId || undefined,
        date: date ? new Date(date).toISOString() : new Date().toISOString(),
        validUntil: validUntil ? new Date(validUntil).toISOString() : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        items,
        notes: proposalRemarks,
        termsAndConditions: notes
      };

      if (isEdit) {
        const res = await api.put(`/quotations/${id}`, payload);
        return res.data;
      } else {
        const res = await api.post('/quotations', payload);
        return res.data;
      }
    },
    onSuccess: (data) => {
      alert(data.message || 'Quotation saved successfully!');
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      queryClient.invalidateQueries({ queryKey: ['quotation', id] });
      if (!isEdit && (data.data?._id || data.data?.id)) {
        navigate(`/accounting/quotations/${data.data._id || data.data.id}`);
      }
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to save quotation.');
    }
  });

  // Status Change Mutation
  const statusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const res = await api.patch(`/quotations/${id}/status`, { status: newStatus });
      return res.data;
    },
    onSuccess: (data) => {
      alert(data.message || 'Status updated!');
      queryClient.invalidateQueries({ queryKey: ['quotation', id] });
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
    }
  });

  // Convert to Invoice Mutation
  const convertMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/quotations/${id}/convert-to-invoice`, {});
      return res.data;
    },
    onSuccess: (data) => {
      alert(data.message || 'Quotation converted to Invoice!');
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      if (data.data?.invoice?._id || data.data?.invoice?.id) {
        navigate(`/accounting/invoices/${data.data.invoice._id || data.data.invoice.id}`);
      }
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Conversion failed.');
    }
  });

  const handlePrint = () => {
    window.print();
  };

  if (isLoadingQuotation) {
    return <div className="py-16 text-center text-xs text-slate-400 font-semibold">Loading quotation details...</div>;
  }

  const currentStatus = existingQuotation?.status || 'draft';
  const isLocked = currentStatus === 'converted';

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* 1. Top Control Header & Actions (Hidden during print) */}
      <div className="no-print bg-white dark:bg-dark-900 border border-slate-300 dark:border-dark-700 p-5 rounded-3xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3 min-w-0">
          <Link
            to="/accounting/quotations"
            className="p-2.5 rounded-xl bg-slate-100 dark:bg-dark-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-dark-700 transition"
            title="Back to Quotations"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center space-x-2">
              <h1 className="text-lg md:text-xl font-extrabold text-slate-950 dark:text-white truncate">
                {isEdit ? `Quotation #${resolvedQuotationNo}` : 'Create Commercial Quotation'}
              </h1>
              <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${currentStatus === 'accepted' ? 'border border-emerald-500 text-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20' :
                  currentStatus === 'converted' ? 'border border-purple-500 text-purple-600 bg-purple-50/50 dark:bg-purple-950/20' :
                    currentStatus === 'sent' ? 'border border-blue-500 text-blue-600 bg-blue-50/50 dark:bg-blue-950/20' :
                      'border border-slate-400 text-slate-600 bg-slate-50 dark:bg-dark-800'
                }`}>
                {currentStatus}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate">
              {isLocked ? 'Converted to Tax Invoice and locked from modifications.' : 'Configure scope of work, tax slabs, payment terms, and generate official PDF.'}
            </p>
          </div>
        </div>

        {/* View Mode Switcher & Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Toggle */}
          <div className="p-1 rounded-xl bg-slate-100 dark:bg-dark-800 flex items-center border border-slate-300 dark:border-dark-700">
            <button
              type="button"
              onClick={() => setViewMode('edit')}
              className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-bold transition ${viewMode === 'edit'
                  ? 'bg-white dark:bg-dark-900 text-blue-700 dark:text-blue-300 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
            >
              <Edit3 className="h-3.5 w-3.5" />
              <span>Edit</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('preview')}
              className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-bold transition ${viewMode === 'preview'
                  ? 'bg-white dark:bg-dark-900 text-blue-700 dark:text-blue-300 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
            >
              <Eye className="h-3.5 w-3.5" />
              <span>Preview</span>
            </button>
          </div>

          {/* Print / Save PDF Button */}
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-bold text-xs shadow-sm transition active:scale-95 cursor-pointer"
            title="Print or Save as PDF"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Print / Save PDF</span>
          </button>

          {/* Save Button */}
          {!isLocked && (
            <button
              type="button"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition disabled:opacity-50 active:scale-95 cursor-pointer"
            >
              {saveMutation.isPending ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              <span>{isEdit ? 'Save Changes' : 'Create Quotation'}</span>
            </button>
          )}

          {/* Workflow Status Transitions */}
          {isEdit && currentStatus === 'draft' && (
            <button
              type="button"
              onClick={() => statusMutation.mutate('sent')}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition active:scale-95 cursor-pointer"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Mark Sent</span>
            </button>
          )}

          {isEdit && (currentStatus === 'sent' || currentStatus === 'draft') && (
            <button
              type="button"
              onClick={() => statusMutation.mutate('accepted')}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition active:scale-95 cursor-pointer"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Mark Accepted</span>
            </button>
          )}

          {isEdit && currentStatus === 'accepted' && (
            <button
              type="button"
              onClick={() => convertMutation.mutate()}
              disabled={convertMutation.isPending}
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-md transition active:scale-95 cursor-pointer"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Convert to Invoice</span>
            </button>
          )}
        </div>
      </div>

      {/* Edit Controls Bar (Lead selector, dates, edit fields) */}
      {viewMode === 'edit' && !isLocked && (
        <div className="no-print bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-800 p-4 rounded-2xl space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-dark-300 mb-1">
                Attach CRM Lead / Customer
              </label>
              <select
                value={leadId}
                onChange={(e) => setLeadId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-dark-700 bg-white dark:bg-dark-800 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">-- Direct / Walk-in Customer --</option>
                {(leadsData || []).map((lead: any) => (
                  <option key={lead._id || lead.id} value={lead._id || lead.id}>
                    {lead.name} {lead.company ? `(${lead.company})` : ''} &bull; {lead.phone}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-dark-300 mb-1">
                Quotation Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-dark-700 bg-white dark:bg-dark-800 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-dark-300 mb-1">
                Valid Until
              </label>
              <input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-dark-700 bg-white dark:bg-dark-800 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* 2. Main Executive Quotation Document Canvas (Exact PDF Typography & Layout) */}
      <div className="printable-document bg-white dark:bg-dark-900 text-slate-900 dark:text-white border border-slate-200 dark:border-dark-700 rounded-3xl p-6 sm:p-12 shadow-sm print:shadow-none print:border-none print:p-0 print:bg-white print:text-black max-w-4xl mx-auto space-y-8 font-sans">

        {/* ================= PAGE 1 ================= */}
        <div className="space-y-6">
          {/* Top Header */}
          <div className="flex items-start justify-between">
            {/* Top Left: Logo / Brand + Title */}
            <div>
              <h1 className="text-2xl font-black text-[#1e3a8a] tracking-tight">
                {orgName}
              </h1>
              <h2 className="text-xl font-black text-slate-900 dark:text-white print:text-black tracking-wider uppercase mt-3">
                QUOTATION
              </h2>
              <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 print:text-emerald-700 mt-1">
                Original for recipient
              </p>
            </div>

            {/* Top Right: Status Badge & Document Metadata */}
            <div className="text-right space-y-1">
              <div>
                <span className={`inline-block px-3 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide border ${currentStatus === 'accepted' ? 'border-emerald-500 text-emerald-600 bg-emerald-50/40 dark:bg-emerald-950/20' :
                    currentStatus === 'converted' ? 'border-purple-500 text-purple-600 bg-purple-50/40 dark:bg-purple-950/20' :
                      currentStatus === 'sent' ? 'border-blue-500 text-blue-600 bg-blue-50/40 dark:bg-blue-950/20' :
                        'border-slate-300 text-slate-600 bg-slate-50 dark:bg-dark-800'
                  }`}>
                  {currentStatus.toUpperCase()}
                </span>
              </div>
              <p className="text-sm font-extrabold text-slate-900 dark:text-white print:text-black pt-1">
                {resolvedQuotationNo}
              </p>
              <div className="text-xs text-slate-600 dark:text-slate-300 print:text-slate-700 space-y-0.5 pt-0.5">
                <p>Date: <span className="text-slate-800 dark:text-slate-200 print:text-black font-semibold">{formatDisplayDate(date)}</span></p>
                <p>Valid until: <span className="text-slate-800 dark:text-slate-200 print:text-black font-semibold">{formatDisplayDate(validUntil)}</span></p>
                <p>Deal: <span className="text-slate-800 dark:text-slate-200 print:text-black font-semibold">#{dealNumber}</span></p>
                <p>Workspace: <span className="text-slate-800 dark:text-slate-200 print:text-black font-semibold">{orgName}</span></p>
              </div>
            </div>
          </div>

          {/* Two-Column Billing Addresses */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 pt-4">
            {/* BILLED FROM */}
            <div className="space-y-1.5 text-xs">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                BILLED FROM
              </p>
              <p className="font-bold text-sm text-slate-900 dark:text-white print:text-black">
                {orgName}
              </p>
              <p className="text-slate-600 dark:text-slate-300 print:text-slate-700">
                {orgAddress}
              </p>
              <div className="space-y-0.5 pt-1 text-slate-600 dark:text-slate-300 print:text-slate-700">
                <div className="grid grid-cols-[60px_1fr] gap-2">
                  <span className="text-slate-400">GSTIN</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white print:text-black">{orgGstin}</span>
                </div>
                <div className="grid grid-cols-[60px_1fr] gap-2">
                  <span className="text-slate-400">Email</span>
                  <span>{orgEmail}</span>
                </div>
                <div className="grid grid-cols-[60px_1fr] gap-2">
                  <span className="text-slate-400">Phone</span>
                  <span>{orgPhone}</span>
                </div>
              </div>
            </div>

            {/* BILLED TO */}
            <div className="space-y-1.5 text-xs">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                BILLED TO
              </p>
              {viewMode === 'edit' && !isLocked ? (
                <div className="space-y-1">
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Client / Company Name"
                    className="w-full font-bold px-2 py-1 rounded border border-slate-300 dark:border-dark-700 bg-transparent text-xs text-slate-900 dark:text-white outline-none"
                  />
                  <input
                    type="text"
                    value={clientAddress}
                    onChange={(e) => setClientAddress(e.target.value)}
                    placeholder="Client Address"
                    className="w-full text-xs text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded border border-slate-200 dark:border-dark-800 bg-transparent outline-none"
                  />
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <input
                      type="text"
                      value={clientGstin}
                      onChange={(e) => setClientGstin(e.target.value)}
                      placeholder="Client GSTIN"
                      className="font-mono text-xs px-2 py-0.5 rounded border border-slate-200 dark:border-dark-800 bg-transparent outline-none"
                    />
                    <input
                      type="text"
                      value={clientPhone}
                      onChange={(e) => setClientPhone(e.target.value)}
                      placeholder="Client Phone"
                      className="text-xs px-2 py-0.5 rounded border border-slate-200 dark:border-dark-800 bg-transparent outline-none"
                    />
                  </div>
                </div>
              ) : (
                <>
                  <p className="font-bold text-sm text-slate-900 dark:text-white print:text-black">
                    {clientName}
                  </p>
                  <p className="text-slate-600 dark:text-slate-300 print:text-slate-700">
                    {clientAddress}
                  </p>
                  <div className="space-y-0.5 pt-1 text-slate-600 dark:text-slate-300 print:text-slate-700">
                    <div className="grid grid-cols-[60px_1fr] gap-2">
                      <span className="text-slate-400">GSTIN</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white print:text-black">{clientGstin}</span>
                    </div>
                    <div className="grid grid-cols-[60px_1fr] gap-2">
                      <span className="text-slate-400">Phone</span>
                      <span>{clientPhone}</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Place of Supply Banner */}
          <div className="bg-slate-100/70 dark:bg-dark-800/60 print:bg-slate-100 rounded-xl px-4 py-2.5 flex items-center justify-between text-xs text-slate-700 dark:text-slate-300 print:text-slate-800">
            <div>
              <span>Place of supply: </span>
              {viewMode === 'edit' && !isLocked ? (
                <input
                  type="text"
                  value={placeOfSupply}
                  onChange={(e) => setPlaceOfSupply(e.target.value)}
                  className="font-bold px-1.5 py-0.5 rounded border border-slate-300 dark:border-dark-700 bg-transparent text-xs text-slate-900 dark:text-white outline-none ml-1 w-32"
                />
              ) : (
                <span className="font-bold text-slate-900 dark:text-white print:text-black">{placeOfSupply}</span>
              )}
            </div>
            <div className="font-semibold text-slate-600 dark:text-slate-400 print:text-slate-700">
              {isInterState ? 'Inter-state supply' : 'Intra-state supply'}
            </div>
          </div>

          {/* Items Table with Dark Header */}
          <div className="space-y-2">
            <div className="flex items-center justify-end no-print">
              {viewMode === 'edit' && !isLocked && (
                <button
                  type="button"
                  onClick={addItemRow}
                  className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900 font-bold text-xs hover:bg-blue-100 dark:hover:bg-blue-900/60 transition cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Item Row</span>
                </button>
              )}
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-dark-800 print:border-slate-300">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#0b1329] text-white print:bg-[#0b1329] print:text-white">
                  <tr>
                    <th className="py-2.5 px-3 text-center w-10 text-[11px] font-bold uppercase tracking-wider">#</th>
                    <th className="py-2.5 px-3 text-left text-[11px] font-bold uppercase tracking-wider">DESCRIPTION</th>
                    <th className="py-2.5 px-3 text-center w-14 text-[11px] font-bold uppercase tracking-wider">QTY</th>
                    <th className="py-2.5 px-3 text-right w-24 text-[11px] font-bold uppercase tracking-wider">RATE (₹)</th>
                    <th className="py-2.5 px-3 text-right w-24 text-[11px] font-bold uppercase tracking-wider">TAXABLE (₹)</th>
                    <th className="py-2.5 px-3 text-center w-16 text-[11px] font-bold uppercase tracking-wider">GST</th>
                    <th className="py-2.5 px-3 text-right w-20 text-[11px] font-bold uppercase tracking-wider">TAX (₹)</th>
                    <th className="py-2.5 px-3 text-right w-28 text-[11px] font-bold uppercase tracking-wider">AMOUNT (₹)</th>
                    {viewMode === 'edit' && !isLocked && <th className="py-2.5 px-2 w-8 no-print"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-dark-800 print:divide-slate-200">
                  {items.map((item, idx) => {
                    const qty = Number(item.quantity) || 0;
                    const rate = Number(item.rate) || 0;
                    const taxable = qty * rate - (Number(item.discountAmount) || 0);
                    const tax = Number(item.taxAmount) || 0;
                    const amount = Number(item.total) || (taxable + tax);

                    return (
                      <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-dark-800/40 print:hover:bg-transparent">
                        <td className="py-3 px-3 text-center text-slate-500 font-medium">{idx + 1}</td>
                        <td className="py-3 px-3">
                          {viewMode === 'edit' && !isLocked ? (
                            <div className="space-y-1">
                              <input
                                type="text"
                                placeholder="Service / item title..."
                                value={item.name}
                                onChange={(e) => handleItemChange(idx, 'name', e.target.value)}
                                className="w-full font-bold px-2 py-1 rounded border border-slate-300 dark:border-dark-700 bg-transparent text-xs text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
                              />
                              <input
                                type="text"
                                placeholder="Description (optional)..."
                                value={item.description || ''}
                                onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                                className="w-full text-[11px] text-slate-500 px-2 py-0.5 rounded border border-slate-200 dark:border-dark-800 bg-transparent outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </div>
                          ) : (
                            <div>
                              <p className="font-bold text-slate-900 dark:text-white print:text-black">{item.name || 'Service Item'}</p>
                              {item.description && (
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 print:text-slate-600 leading-tight mt-0.5">{item.description}</p>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {viewMode === 'edit' && !isLocked ? (
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                              className="w-12 px-1 py-1 rounded border border-slate-300 dark:border-dark-700 bg-transparent text-xs text-center font-bold text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          ) : (
                            <span className="font-medium text-slate-800 dark:text-slate-200 print:text-black">{item.quantity}</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          {viewMode === 'edit' && !isLocked ? (
                            <input
                              type="number"
                              min="0"
                              value={item.rate}
                              onChange={(e) => handleItemChange(idx, 'rate', e.target.value)}
                              className="w-24 px-1 py-1 rounded border border-slate-300 dark:border-dark-700 bg-transparent text-xs text-right font-bold text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          ) : (
                            <span className="font-mono text-slate-800 dark:text-slate-200 print:text-black">
                              {formatINR(Number(item.rate || 0))}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-slate-800 dark:text-slate-200 print:text-black">
                          {formatINR(taxable)}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {viewMode === 'edit' && !isLocked ? (
                            <select
                              value={item.gstRate}
                              onChange={(e) => handleItemChange(idx, 'gstRate', e.target.value)}
                              className="px-1 py-1 rounded border border-slate-300 dark:border-dark-700 bg-transparent text-xs font-bold text-slate-900 dark:text-white outline-none"
                            >
                              <option value="0" className="bg-white dark:bg-dark-900 text-black dark:text-white">0%</option>
                              <option value="18" className="bg-white dark:bg-dark-900 text-black dark:text-white">18%</option>
                            </select>
                          ) : (
                            <span className="text-slate-700 dark:text-slate-300 print:text-black font-semibold">{item.gstRate}%</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-slate-800 dark:text-slate-200 print:text-black">
                          {formatINR(tax)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 dark:text-white print:text-black">
                          {formatINR(amount)}
                        </td>
                        {viewMode === 'edit' && !isLocked && (
                          <td className="py-3 px-2 text-center no-print">
                            <button
                              type="button"
                              onClick={() => removeItemRow(idx)}
                              className="text-slate-400 hover:text-red-600 transition cursor-pointer"
                              title="Delete item"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right-Aligned Financial Breakdown Summary */}
          <div className="flex justify-end pt-2">
            <div className="w-80 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600 dark:text-slate-300 print:text-slate-700">
                <span className="font-medium">Taxable value</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white print:text-black">
                  {formatINR(taxableValue)}
                </span>
              </div>

              {!isInterState ? (
                <>
                  <div className="flex justify-between text-amber-700 dark:text-amber-400 print:text-amber-800 font-medium">
                    <span>CGST (9%)</span>
                    <span className="font-mono font-bold">
                      {formatINR(taxTotalSum / 2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-amber-700 dark:text-amber-400 print:text-amber-800 font-medium">
                    <span>SGST (9%)</span>
                    <span className="font-mono font-bold">
                      {formatINR(taxTotalSum / 2)}
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between text-amber-700 dark:text-amber-400 print:text-amber-800 font-medium">
                  <span>IGST (18%)</span>
                  <span className="font-mono font-bold">
                    {formatINR(taxTotalSum)}
                  </span>
                </div>
              )}

              <div className="flex justify-between text-slate-500 dark:text-slate-400 print:text-slate-600">
                <span>Round off</span>
                <span className="font-mono font-medium">
                  {roundOff >= 0 ? `+${roundOff.toFixed(2)}` : roundOff.toFixed(2)}
                </span>
              </div>

              <div className="border-t border-slate-200 dark:border-dark-700 print:border-slate-300 pt-2 flex justify-between items-baseline">
                <span className="text-base font-extrabold text-slate-900 dark:text-white print:text-black">Total</span>
                <span className="text-xl font-mono font-black text-slate-900 dark:text-white print:text-black">
                  ₹{formatINR(finalTotal)}
                </span>
              </div>
            </div>
          </div>

          {/* Bank Details & Authorised Signatory */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 pt-8 border-t border-slate-100 dark:border-dark-800 print:border-slate-200">
            {/* Bank Details */}
            <div className="space-y-1.5 text-xs">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                BANK DETAILS
              </p>
              <div className="space-y-1 text-slate-600 dark:text-slate-300 print:text-slate-700 pt-0.5">
                <div className="grid grid-cols-[80px_1fr] gap-2">
                  <span className="text-slate-400">Name</span>
                  <span className="font-bold text-slate-900 dark:text-white print:text-black">{orgName}</span>
                </div>
                <div className="grid grid-cols-[80px_1fr] gap-2 font-mono">
                  <span className="text-slate-400 font-sans">A/c No</span>
                  <span className="font-bold text-slate-900 dark:text-white print:text-black">{orgBankAccount}</span>
                </div>
                <div className="grid grid-cols-[80px_1fr] gap-2 font-mono">
                  <span className="text-slate-400 font-sans">IFSC Code</span>
                  <span className="font-bold text-slate-900 dark:text-white print:text-black">{orgBankIfsc}</span>
                </div>
                <div className="grid grid-cols-[80px_1fr] gap-2">
                  <span className="text-slate-400">Bank</span>
                  <span className="font-bold text-slate-900 dark:text-white print:text-black">{orgBankName}</span>
                </div>
              </div>
            </div>

            {/* Authorised Signatory */}
            <div className="flex flex-col justify-between items-end text-right">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 print:text-slate-800">
                For {orgName}
              </p>
              <div className="pt-16">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200 print:text-black">
                  Authorised signatory
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ================= PAGE 2 (NOTES & PROPOSAL REMARKS) ================= */}
        <div className="page-break pt-8 print:pt-6 space-y-6">
          {/* Notes Card Box */}
          <div className="border border-slate-200 dark:border-dark-700 print:border-slate-300 rounded-2xl p-6 sm:p-8 bg-white dark:bg-dark-900/60 print:bg-white space-y-5 text-xs shadow-sm print:shadow-none">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              NOTES
            </p>

            {/* Proposal Remarks */}
            <div className="space-y-2">
              <p className="font-bold text-slate-800 dark:text-slate-200 print:text-black">
                Proposal Remarks :
              </p>
              {viewMode === 'edit' && !isLocked ? (
                <textarea
                  rows={6}
                  value={proposalRemarks}
                  onChange={(e) => setProposalRemarks(e.target.value)}
                  placeholder="Proposal remarks..."
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-dark-700 bg-transparent text-xs text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                />
              ) : (
                <div className="whitespace-pre-line text-slate-700 dark:text-slate-300 print:text-slate-800 leading-relaxed pl-1">
                  {proposalRemarks}
                </div>
              )}
            </div>

            {/* Operational Notes */}
            <div className="space-y-2 pt-2">
              <p className="font-bold text-slate-800 dark:text-slate-200 print:text-black">
                NOTES:
              </p>
              {viewMode === 'edit' && !isLocked ? (
                <textarea
                  rows={4}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Operational notes..."
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-dark-700 bg-transparent text-xs text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                />
              ) : (
                <div className="whitespace-pre-line text-slate-700 dark:text-slate-300 print:text-slate-800 leading-relaxed pl-1">
                  {notes}
                </div>
              )}
            </div>
          </div>

          {/* Computer-generated quotation disclaimer */}
          <div className="text-center text-[11px] text-slate-400 dark:text-slate-500 print:text-slate-500 space-y-1 pt-6">
            <p>This is a computer-generated quotation and is valid without a signature.</p>
            <p>
              Amounts are in Indian Rupees (INR). {!isInterState ? 'CGST + SGST' : 'IGST'} applies as shown above. This quotation is valid until {formatDisplayDate(validUntil)}.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};
