import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../services/api';
import {
  ArrowLeft, Edit3, Phone, MessageSquare,
  Mail, Sparkles, AlertCircle, CheckCircle2,
  Clock, Save, X, Loader2, Smartphone,
  PhoneIncoming, PhoneOutgoing, PhoneMissed,
  History, RefreshCw, PlusCircle,
  CalendarClock, Shield,
  ArrowRight, Layers, StickyNote, Activity as ActivityIcon
} from 'lucide-react';
import { LeadStatusDropdown } from '../../components/crm/LeadStatusDropdown';
import { ScheduleFollowUpModal } from '../../components/crm/ScheduleFollowUpModal';
import { QuickNoteModal } from '../../components/crm/QuickNoteModal';
import { LogCallModal } from '../../components/crm/LogCallModal';

export const LeadDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  // Edit Modal, Follow-Up Modal, Quick Note & Log Call Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showCallModal, setShowCallModal] = useState(false);
  const [timelineFilter, setTimelineFilter] = useState<'all' | 'call' | 'stage' | 'followup' | 'note' | 'system'>('all');

  const [editForm, setEditForm] = useState({
    name: '',
    company: '',
    phone: '',
    email: '',
    whatsApp: '',
    alternatePhone: '',
    source: 'Website',
    serviceInterested: '',
    priority: 'medium',
    status: 'New',
    expectedValue: 0,
    assignedTo: '',
    notes: ''
  });

  // Fetch Employees for Assignment Dropdown
  const { data: repsData } = useQuery({
    queryKey: ['employees-master-list'],
    queryFn: async () => {
      const res = await api.get('/assignment/config');
      return res.data.data?.reps || [];
    },
    staleTime: 5 * 60 * 1000
  });

  // 1. Fetch Lead Details (Auto-polls every 3s so SIM calls from sales reps appear in real-time)
  const { data: leadData, isLoading, isError, refetch } = useQuery({
    queryKey: ['lead-detail', id],
    queryFn: async () => {
      const res = await api.get(`/leads/${id}`);
      return res.data.data;
    },
    refetchInterval: 15000, // Real-time auto-update every 15s
    staleTime: 5000,
    refetchOnWindowFocus: true
  });

  const lead = leadData?.lead;
  const activities = leadData?.activities || [];

  // Update Lead Mutation
  const updateLeadMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.put(`/leads/${id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      setShowEditModal(false);
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to update lead details.');
    }
  });

  // Log Touchpoint Mutation (WhatsApp / Email)
  const logTouchpointMutation = useMutation({
    mutationFn: async (payload: { channel: string; details?: string }) => {
      const res = await api.post(`/leads/${id}/log-touchpoint`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-detail', id] });
    }
  });

  const handleOpenEditModal = () => {
    if (!lead) return;
    const assignedId = (typeof lead.assignedTo === 'object' && lead.assignedTo)
      ? ((lead.assignedTo as any)._id || (lead.assignedTo as any).id)
      : lead.assignedTo;

    setEditForm({
      name: lead.name || '',
      company: lead.company || '',
      phone: lead.phone || '',
      email: lead.email || '',
      whatsApp: lead.whatsApp || lead.phone || '',
      alternatePhone: lead.alternatePhone || '',
      source: lead.source || 'Website',
      serviceInterested: lead.serviceInterested || '',
      priority: (lead.priority || 'medium').toLowerCase(),
      status: lead.status || 'New',
      expectedValue: Number(lead.expectedValue) || 0,
      assignedTo: assignedId ? assignedId.toString() : '',
      notes: lead.notes || ''
    });
    setShowEditModal(true);
  };


  const getPriorityBadge = (priority: string) => {
    const p = (priority || 'medium').toLowerCase();
    switch (p) {
      case 'urgent':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 uppercase tracking-wide">
            <span>🔥 Urgent</span>
          </span>
        );
      case 'high':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 uppercase tracking-wide">
            <span>⚡ High</span>
          </span>
        );
      case 'medium':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 uppercase tracking-wide">
            <span>Medium</span>
          </span>
        );
      case 'low':
      default:
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-500/10 text-slate-500 dark:text-slate-400 border border-slate-500/20 uppercase tracking-wide">
            <span>Low</span>
          </span>
        );
    }
  };

  // Timeline Helpers
  const getActivityCategory = (act: any): 'call' | 'stage' | 'followup' | 'note' | 'system' => {
    if (!act) return 'system';
    const type = (act.type || '').toLowerCase();
    const content = (typeof act.content === 'string' ? act.content : '').toLowerCase();
    const meta = act.metadata || {};

    // 1. Stage transitions
    if (type === 'status_change' || type === 'stage_change' || content.includes('workflow stage') || content.includes('status updated')) {
      return 'stage';
    }

    // 2. Notes
    if (
      type === 'note' ||
      type === 'manual_note' ||
      meta.source === 'quick_note' ||
      meta.tag ||
      (type === 'followup' && (meta.channel === 'note' || content.includes('(note)'))) ||
      content.startsWith('[note') ||
      content.startsWith('[general note') ||
      content.startsWith('[call summary') ||
      content.startsWith('[requirement') ||
      content.startsWith('[pricing') ||
      content.startsWith('[follow-up note') ||
      content.includes('team note') ||
      content.includes('manual note')
    ) {
      return 'note';
    }

    // 3. Follow-ups (scheduled tasks must not be treated as calls)
    if (
      content.startsWith('scheduled a follow') ||
      content.includes('scheduled a follow-up') ||
      (type === 'followup' && !content.includes('sim call'))
    ) {
      return 'followup';
    }

    // 4. Calls
    if (
      type === 'call' ||
      meta.callType ||
      meta.source === 'android_sim_sync' ||
      meta.source === 'web_click_to_call' ||
      content.includes('sim call') ||
      content.includes('connected with') ||
      content.includes('outgoing call placed') ||
      content.includes('call logged') ||
      (meta.channel === 'phone' && (meta.duration !== undefined || meta.callType))
    ) {
      return 'call';
    }

    if (type === 'followup') {
      return 'followup';
    }

    return 'system';
  };

  const formatDuration = (seconds: number) => {
    if (!seconds || seconds <= 0 || isNaN(seconds)) return '0s';
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins >= 60) {
      const hrs = Math.floor(mins / 60);
      const remMins = mins % 60;
      return remMins > 0 ? `${hrs}h ${remMins}m ${secs}s` : (secs > 0 ? `${hrs}h ${secs}s` : `${hrs}h`);
    }
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  };

  const formatRelativeTime = (dateStr?: string | Date) => {
    if (!dateStr) return 'Recent';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return 'Recent';
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffSecs = Math.floor(diffMs / 1000);
      const diffMins = Math.floor(diffSecs / 60);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffSecs < 60) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays === 1) {
        return `Yesterday, ${date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
      }
      return date.toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Recent';
    }
  };

  const parseActivityDetails = (act: any) => {
    if (!act) return { category: 'system' as const, cleanContent: '', stageTransition: null };
    const category = getActivityCategory(act);
    let rawContent = typeof act.content === 'string' ? act.content : (act.content ? String(act.content) : '');

    // Convert raw ISO timestamps in content to clean formatted dates
    let cleanContent = rawContent.replace(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?)/g, (match: string) => {
      try {
        const d = new Date(match);
        return isNaN(d.getTime()) ? match : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      } catch {
        return match;
      }
    });

    // Clean SIM Call prefixes
    if (cleanContent.startsWith('📇 SIM Call') || cleanContent.startsWith('📱 SIM Call')) {
      cleanContent = cleanContent.replace(/^[📇📱]\s*SIM Call\s*\([^)]+\):\s*/i, '');
    }

    // Clean legacy follow-up note wrapper if needed
    if (category === 'note' && cleanContent.startsWith('Scheduled a follow-up (note)')) {
      const notesMatch = cleanContent.match(/Notes:\s*(.*)$/i);
      if (notesMatch && notesMatch[1]) {
        cleanContent = notesMatch[1];
      }
    }

    // Extract stage transition
    const stageRegex = /from\s+["']?([^"']+)["']?\s+to\s+["']?([^"']+)["']?/i;
    const stageMatch = rawContent.match(stageRegex);

    return {
      category,
      cleanContent,
      stageTransition: stageMatch ? { from: stageMatch[1], to: stageMatch[2] } : null
    };
  };

  const activitiesList = Array.isArray(activities) ? activities : [];
  const callCount = activitiesList.filter((a: any) => getActivityCategory(a) === 'call').length;
  const stageCount = activitiesList.filter((a: any) => getActivityCategory(a) === 'stage').length;
  const followupCount = activitiesList.filter((a: any) => getActivityCategory(a) === 'followup').length;
  const noteCount = activitiesList.filter((a: any) => getActivityCategory(a) === 'note').length;
  const systemCount = activitiesList.filter((a: any) => getActivityCategory(a) === 'system').length;

  const filteredActivities = activitiesList.filter((a: any) => {
    if (!a) return false;
    if (timelineFilter === 'all') return true;
    return getActivityCategory(a) === timelineFilter;
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[450px] space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        <p className="text-xs font-medium text-slate-400">Loading lead details...</p>
      </div>
    );
  }

  if (isError || !lead) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-800 dark:text-white">Lead Not Found</h2>
        <p className="text-xs text-slate-400">The lead you are trying to view does not exist or has been removed.</p>
        <Link
          to="/crm/leads"
          className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-primary-600 text-white text-xs font-bold hover:bg-primary-700 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Leads List</span>
        </Link>
      </div>
    );
  }

  // Assigned Employee Object resolution
  const assignedUser = typeof lead.assignedTo === 'object' && lead.assignedTo ? lead.assignedTo : null;
  const assignedName = assignedUser ? `${assignedUser.firstName || ''} ${assignedUser.lastName || ''}`.trim() : null;
  const cleanPhone = (lead.phone || '').replace(/[^0-9]/g, '');

  const handleInitiateCall = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!lead?.phone) return;
    
    // 1. Open dialer on device
    window.location.href = `tel:${cleanPhone}`;
    
    // 2. Open Log Call modal for post-call details
    setShowCallModal(true);
    
    // 3. Pre-log call event on server immediately so timeline updates right away
    api.post(`/leads/${id}/log-call`, {
      phoneNumber: cleanPhone,
      callType: 'OUTGOING',
      duration: 0,
      outcome: 'Connected'
    }).then(() => {
      queryClient.invalidateQueries({ queryKey: ['lead-detail', id] });
    }).catch((err) => {
      console.warn('Auto call log notification:', err);
    });
  };

  const handleInitiateWhatsApp = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!cleanPhone) return;
    window.open(`https://wa.me/${cleanPhone}`, '_blank');
    logTouchpointMutation.mutate({ channel: 'whatsapp' });
  };

  const handleInitiateEmail = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!lead?.email) return;
    window.location.href = `mailto:${lead.email}`;
    logTouchpointMutation.mutate({ channel: 'email' });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 animate-fade-in">
      {/* Main Profile Hero Card */}
      <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 p-5 sm:p-6 rounded-3xl shadow-sm space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="w-13 h-13 rounded-2xl bg-[linear-gradient(45deg,#ef4444_0%,#6366f1_50%,#2563eb_100%)] text-white flex items-center justify-center font-black text-xl shadow-md shrink-0">
              {(lead.name || 'L').charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <Link
                  to="/crm/leads"
                  title="Back to Leads"
                  className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-dark-800 dark:hover:bg-dark-700 text-slate-700 dark:text-slate-200 hover:text-orange-600 dark:hover:text-orange-400 transition inline-flex items-center justify-center border border-slate-200 dark:border-dark-700 shadow-xs group"
                >
                  <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
                </Link>
                <span className="font-mono text-xs font-black text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40 px-2.5 py-0.5 rounded-md border border-orange-500/20">
                  {lead.leadId || 'LD'}
                </span>
                <h1 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white">
                  {lead.name}
                </h1>
                <LeadStatusDropdown
                  currentStatus={lead.status}
                  disabled={updateLeadMutation.isPending}
                  onStatusChange={(newStatus) => {
                    if (newStatus !== lead.status) {
                      updateLeadMutation.mutate({ status: newStatus });
                    }
                  }}
                  onScheduleFollowUp={() => setShowFollowUpModal(true)}
                />
                {getPriorityBadge(lead.priority)}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-2">
                <span className="flex items-center space-x-1">
                  <Shield className="w-3 h-3 text-orange-500 inline" />
                  <span>Assigned: <strong className="text-blue-700 dark:text-blue-400">{assignedName || 'Unassigned'}</strong></span>
                </span>
                {lead.serviceInterested && (
                  <>
                    <span>•</span>
                    <span>Service: <strong className="text-slate-700 dark:text-slate-200">{lead.serviceInterested}</strong></span>
                  </>
                )}
                {Number(lead.expectedValue) > 0 && (
                  <>
                    <span>•</span>
                    <span>Value: <strong className="text-emerald-600 dark:text-emerald-400">₹{Number(lead.expectedValue).toLocaleString('en-IN')}</strong></span>
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Quick Communication & Lead Actions */}
          <div className="flex flex-wrap items-center gap-2 pt-2 lg:pt-0">
            {lead.phone && (
              <button
                type="button"
                onClick={handleInitiateCall}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition shadow-sm hover:shadow-md cursor-pointer"
                title="Call via Phone & Log Activity"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Call {lead.phone}</span>
              </button>
            )}

            {(lead.whatsApp || lead.phone) && (
              <button
                type="button"
                onClick={handleInitiateWhatsApp}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold text-xs transition shadow-sm hover:shadow-md cursor-pointer"
                title="Open WhatsApp Chat & Log Touchpoint"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>WhatsApp</span>
              </button>
            )}

            {lead.email && (
              <button
                type="button"
                onClick={handleInitiateEmail}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition shadow-sm hover:shadow-md cursor-pointer"
                title="Send Email & Log Touchpoint"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Email</span>
              </button>
            )}

            {/* Schedule Follow-Up: 45deg Red & Blue Gradient */}
            <button
              type="button"
              onClick={() => setShowFollowUpModal(true)}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-[linear-gradient(45deg,#ef4444_0%,#6366f1_50%,#2563eb_100%)] hover:opacity-95 text-white font-black text-xs transition shadow-sm hover:shadow-md cursor-pointer active:scale-95"
              title="Schedule Follow-Up"
            >
              <CalendarClock className="w-3.5 h-3.5" />
              <span>Schedule Follow-Up</span>
            </button>

            {/* Create Quotation: Reverse 45deg Red & Blue Gradient */}
            <Link
              to={`/accounting/quotations/new?leadId=${lead._id}`}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-[linear-gradient(45deg,#2563eb_0%,#6366f1_50%,#ef4444_100%)] hover:opacity-95 text-white font-black text-xs transition shadow-sm hover:shadow-md active:scale-95"
              title="Create Quotation"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Create Quotation</span>
            </Link>

            {/* Edit Details: Clean White / Blue Outline Button */}
            <button
              type="button"
              onClick={handleOpenEditModal}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-dark-800 hover:bg-blue-50 dark:hover:bg-dark-700 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-bold text-xs transition shadow-xs hover:shadow cursor-pointer active:scale-95"
              title="Edit Details"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Details</span>
            </button>

            {/* Quick Note: Subtle Orange / Amber Badge Button */}
            <button
              type="button"
              onClick={() => setShowNoteModal(true)}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-orange-50 dark:bg-orange-950/40 hover:bg-orange-100 dark:hover:bg-orange-900/60 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800 font-bold text-xs transition shadow-xs hover:shadow cursor-pointer active:scale-95"
              title="Quick Note & Activity Log"
            >
              <StickyNote className="w-3.5 h-3.5 text-orange-500" />
              <span>Quick Note</span>
            </button>
          </div>
        </div>

        {/* Pipeline Stage Progression Stepper Bar */}
        <div className="pt-4 border-t border-slate-100 dark:border-dark-800">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-red-600 flex items-center space-x-1.5">
              <span>Pipeline Stage</span>
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
            {[
              { key: 'New', label: '1. New Lead' },
              { key: 'Open', label: '2. In Progress' },
              { key: 'Qualified', label: '3. Qualified' },
              { key: 'Proposal Sent', label: '4. Proposal Sent' },
              { key: 'Negotiation', label: '5. Negotiation' },
              { key: 'Converted', label: '6. Converted' },
            ].map((stage, sIdx) => {
              const currentStatus = lead.status || 'New';
              const isCurrent = currentStatus === stage.key || (stage.key === 'Open' && currentStatus === 'Contacted');
              const stageOrder = ['New', 'Open', 'Qualified', 'Proposal Sent', 'Negotiation', 'Converted'];
              const currentIdx = stageOrder.indexOf(currentStatus === 'Contacted' ? 'Open' : currentStatus);
              const isPast = currentIdx > sIdx && currentIdx !== -1 && currentStatus !== 'Lost';

              return (
                <button
                  key={stage.key}
                  disabled={updateLeadMutation.isPending}
                  onClick={() => {
                    if (lead.status !== stage.key) {
                      updateLeadMutation.mutate({ status: stage.key });
                    }
                  }}
                  className={`px-3 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center space-x-1.5 cursor-pointer border ${isCurrent
                    ? 'bg-[linear-gradient(45deg,#ef4444_0%,#6366f1_50%,#2563eb_100%)] text-white border-transparent shadow-md shadow-red-500/20 ring-2 ring-red-500/30'
                    : isPast
                      ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50 hover:bg-emerald-100'
                      : 'bg-slate-50 dark:bg-dark-800 text-slate-600 dark:text-dark-300 border-slate-200 dark:border-dark-700 hover:bg-slate-100 dark:hover:bg-dark-700'
                    }`}
                >
                  {isPast && <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />}
                  {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse shrink-0" />}
                  <span className="truncate">{stage.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Workspace (Activity Feed & SIM Timeline Stream) */}
      <div className="space-y-4">

        {/* Enhanced SIM Call History & Lead Activity Stream */}
        <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-3xl p-5 sm:p-6 shadow-sm space-y-5">
          {/* Timeline Header with Live Indicator & Filter Tabs */}
          <div className="space-y-4 border-b border-slate-100 dark:border-dark-800 pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 shadow-xs">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                      SIM Call History & Timeline
                    </h2>
                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span>Live SIM Sync</span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2 self-start sm:self-auto">
                <button
                  onClick={() => refetch()}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-dark-800 hover:bg-slate-200 dark:hover:bg-dark-700 text-slate-600 dark:text-slate-300 text-xs font-bold transition cursor-pointer"
                  title="Refresh Timeline"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {/* Categorized Filter Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {[
                { key: 'all', label: 'All Events', count: activities.length },
                { key: 'call', label: '📱 SIM Calls', count: callCount },
                { key: 'stage', label: '🔄 Stage Changes', count: stageCount },
                { key: 'followup', label: '⏰ Follow-Ups', count: followupCount },
                { key: 'note', label: '📝 Notes', count: noteCount },
                { key: 'system', label: '⚙️ System', count: systemCount }
              ].map((tab) => {
                const isActive = timelineFilter === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setTimelineFilter(tab.key as any)}
                    className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${isActive
                      ? 'bg-[linear-gradient(45deg,#ef4444_0%,#6366f1_50%,#2563eb_100%)] text-white shadow-md shadow-red-500/20'
                      : 'bg-slate-100 dark:bg-dark-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-dark-700'
                      }`}
                  >
                    <span>{tab.label}</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${isActive
                      ? 'bg-white/20 text-white dark:bg-black/20 dark:text-slate-900'
                      : 'bg-slate-200 dark:bg-dark-700 text-slate-700 dark:text-slate-300'
                      }`}>
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Timeline Stream */}
          {filteredActivities.length === 0 ? (
            <div className="py-14 text-center space-y-2.5">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-dark-800 flex items-center justify-center text-slate-400 mx-auto">
                <History className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                {timelineFilter === 'all' ? 'No Activities Logged Yet' : `No ${timelineFilter.toUpperCase()} activities found`}
              </p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {timelineFilter === 'call'
                  ? 'When a sales rep calls this lead on their companion SIM phone, the call details will sync here automatically.'
                  : 'Actions, calls, notes, and pipeline transitions will be recorded here.'}
              </p>
            </div>
          ) : (
            <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:left-3 sm:before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200 dark:before:bg-dark-800">
              {filteredActivities.map((act: any, idx: number) => {
                if (!act) return null;
                const meta = act.metadata || {};
                const parsed = parseActivityDetails(act);
                const isCall = parsed.category === 'call';
                const actContentStr = typeof act.content === 'string' ? act.content : '';
                const callType = (meta.callType || (actContentStr.includes('INCOMING') ? 'INCOMING' : actContentStr.includes('MISSED') ? 'MISSED' : 'OUTGOING')).toUpperCase();
                const duration = Number(meta.duration || (actContentStr.match(/(\d+)s\s+connected/i)?.[1] || 0));

                let authorName = 'System';
                if (act.userId) {
                  if (typeof act.userId === 'object') {
                    const fn = act.userId.firstName || '';
                    const ln = act.userId.lastName || '';
                    authorName = `${fn} ${ln}`.trim() || act.userId.name || act.userId.email || 'Team Member';
                  } else if (typeof act.userId === 'string') {
                    authorName = 'Team Member';
                  }
                }
                const authorInitial = (authorName || 'S').charAt(0).toUpperCase();

                // Safe date title
                let safeDateTitle = 'Recent';
                if (act.createdAt) {
                  try {
                    const d = new Date(act.createdAt);
                    if (!isNaN(d.getTime())) {
                      safeDateTitle = d.toLocaleString('en-IN');
                    }
                  } catch {
                    safeDateTitle = 'Recent';
                  }
                }

                // Distinctive Node Configuration
                let nodeIcon = <ActivityIcon className="w-3.5 h-3.5" />;
                let nodeBg = 'bg-slate-100 dark:bg-dark-800 text-slate-600 dark:text-slate-300 ring-slate-200 dark:ring-dark-700';
                let tagLabel = 'Activity';
                let tagClass = 'bg-slate-100 text-slate-700 dark:bg-dark-800 dark:text-slate-300';

                if (isCall) {
                  if (callType === 'INCOMING') {
                    nodeIcon = <PhoneIncoming className="w-3.5 h-3.5" />;
                    nodeBg = 'bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 ring-sky-200 dark:ring-sky-900';
                    tagLabel = 'Incoming SIM Call';
                    tagClass = 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 border-sky-200 dark:border-sky-900';
                  } else if (callType === 'MISSED' || callType === 'REJECTED') {
                    nodeIcon = <PhoneMissed className="w-3.5 h-3.5" />;
                    nodeBg = 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 ring-rose-200 dark:ring-rose-900';
                    tagLabel = 'Missed SIM Call';
                    tagClass = 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-900';
                  } else {
                    nodeIcon = <PhoneOutgoing className="w-3.5 h-3.5" />;
                    nodeBg = 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 ring-emerald-200 dark:ring-emerald-900';
                    tagLabel = 'Outgoing SIM Call';
                    tagClass = 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900';
                  }
                } else if (parsed.category === 'stage') {
                  nodeIcon = <Layers className="w-3.5 h-3.5" />;
                  nodeBg = 'bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 ring-purple-200 dark:ring-purple-900';
                  tagLabel = 'Stage Dispatched';
                  tagClass = 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200 dark:border-purple-900';
                } else if (parsed.category === 'followup') {
                  nodeIcon = <CalendarClock className="w-3.5 h-3.5" />;
                  nodeBg = 'bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 ring-purple-200 dark:ring-purple-900';
                  tagLabel = 'Follow-Up Scheduled';
                  tagClass = 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200 dark:border-purple-900';
                } else if (parsed.category === 'note') {
                  nodeIcon = <StickyNote className="w-3.5 h-3.5" />;
                  nodeBg = 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 ring-amber-200 dark:ring-amber-900';
                  tagLabel = meta.tag ? `${meta.tag.toUpperCase()} NOTE` : 'NOTE LOGGED';
                  tagClass = 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-900';
                } else {
                  nodeIcon = <Sparkles className="w-3.5 h-3.5" />;
                  nodeBg = 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 ring-blue-200 dark:ring-blue-900';
                  tagLabel = 'System Event';
                  tagClass = 'bg-slate-100 text-slate-700 dark:bg-dark-800 dark:text-slate-300 border-slate-200 dark:border-dark-700';
                }

                return (
                  <div key={act._id || act.id || `act-${idx}`} className="relative group">
                    {/* Timeline Node Dot */}
                    <div
                      className={`absolute -left-6 sm:-left-8 top-1.5 w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center ring-4 ring-white dark:ring-dark-900 shadow-xs transition-transform group-hover:scale-110 ${nodeBg}`}
                    >
                      {nodeIcon}
                    </div>

                    {/* Event Card */}
                    <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-dark-800/60 border border-slate-200/80 dark:border-dark-700/80 hover:border-slate-300 dark:hover:border-dark-600 transition-all duration-150 shadow-xs space-y-2.5">
                      {/* Card Header */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-0.5 rounded-lg border text-[11px] font-black uppercase tracking-wider ${tagClass}`}>
                            {tagLabel}
                          </span>

                          {authorName && (
                            <span className="flex items-center space-x-1 text-xs font-bold text-slate-700 dark:text-slate-200">
                              <span className="w-4 h-4 rounded-full bg-slate-200 dark:bg-dark-700 text-[9px] font-black text-slate-700 dark:text-slate-300 flex items-center justify-center">
                                {authorInitial}
                              </span>
                              <span>{authorName}</span>
                            </span>
                          )}
                        </div>

                        <div className="flex items-center space-x-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                          <Clock className="w-3 h-3" />
                          <span title={safeDateTitle}>
                            {formatRelativeTime(act.createdAt)}
                          </span>
                        </div>
                      </div>

                      {/* Card Content (Specialized Render per Category) */}
                      {isCall ? (
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-relaxed">
                            {parsed.cleanContent || `SIM call logged with ${lead.name || 'client'}.`}
                          </p>

                          <div className="flex flex-wrap items-center gap-2 pt-0.5">
                            {duration > 0 ? (
                              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-lg bg-emerald-100/80 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold border border-emerald-300/40">
                                <Clock className="w-3 h-3" />
                                <span>Duration: {formatDuration(duration)}</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-dark-700 text-slate-500 dark:text-slate-400 text-[10px] font-medium border border-slate-200 dark:border-dark-600">
                                <Clock className="w-3 h-3" />
                                <span>{callType === 'MISSED' || callType === 'REJECTED' ? 'Missed Call (0s)' : '0s (No Answer)'}</span>
                              </span>
                            )}

                            {meta.simSlot && (
                              <span className="px-2 py-0.5 rounded-lg bg-slate-200 dark:bg-dark-700 text-slate-700 dark:text-slate-300 text-[10px] font-mono font-bold">
                                SIM {meta.simSlot}
                              </span>
                            )}

                            {meta.source === 'android_sim_sync' ? (
                              <span className="px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                                ✓ Android Companion Synced
                              </span>
                            ) : meta.source === 'web_click_to_call' ? (
                              <span className="px-2 py-0.5 rounded-lg bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 text-[10px] font-bold">
                                ✓ Web Call Logged
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-dark-700 text-slate-600 dark:text-slate-300 text-[10px] font-bold">
                                ✓ Call Recorded
                              </span>
                            )}
                          </div>
                        </div>
                      ) : parsed.stageTransition ? (
                        <div className="space-y-2">
                          <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-xs">
                            <span className="font-bold text-slate-600 dark:text-slate-300">
                              {parsed.stageTransition.from}
                            </span>
                            <ArrowRight className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
                            <span className="font-black text-purple-700 dark:text-purple-300">
                              {parsed.stageTransition.to}
                            </span>
                          </div>

                          <p className="text-xs text-slate-600 dark:text-slate-400">
                            {parsed.cleanContent}
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                          {parsed.cleanContent}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Edit Lead Details Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-6 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-dark-800 pb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-primary-500/10 text-primary-600 dark:text-primary-400 flex items-center justify-center font-bold">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-800 dark:text-white">
                    Edit Lead Details
                  </h3>
                  <p className="text-xs text-slate-400">
                    Lead #{lead?.leadId} &bull; Update contact info, assignment, pipeline stage & requirements
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-dark-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateLeadMutation.mutate(editForm);
              }}
              className="space-y-4 text-xs"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Full Name */}
                <div>
                  <label className="block font-bold text-slate-700 dark:text-dark-200 mb-1">
                    Contact Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-dark-700 bg-slate-50 dark:bg-dark-800 outline-none text-slate-800 dark:text-white focus:ring-1 focus:ring-primary-500"
                  />
                </div>

                {/* Company */}
                <div>
                  <label className="block font-bold text-slate-700 dark:text-dark-200 mb-1">
                    Company / Organization
                  </label>
                  <input
                    type="text"
                    value={editForm.company}
                    onChange={(e) => setEditForm({ ...editForm, company: e.target.value })}
                    placeholder="e.g. Acme Corp"
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-dark-700 bg-slate-50 dark:bg-dark-800 outline-none text-slate-800 dark:text-white focus:ring-1 focus:ring-primary-500"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block font-bold text-slate-700 dark:text-dark-200 mb-1">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-dark-700 bg-slate-50 dark:bg-dark-800 outline-none text-slate-800 dark:text-white focus:ring-1 focus:ring-primary-500"
                  />
                </div>

                {/* WhatsApp */}
                <div>
                  <label className="block font-bold text-slate-700 dark:text-dark-200 mb-1">
                    WhatsApp Number
                  </label>
                  <input
                    type="tel"
                    value={editForm.whatsApp}
                    onChange={(e) => setEditForm({ ...editForm, whatsApp: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-dark-700 bg-slate-50 dark:bg-dark-800 outline-none text-slate-800 dark:text-white focus:ring-1 focus:ring-primary-500"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block font-bold text-slate-700 dark:text-dark-200 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-dark-700 bg-slate-50 dark:bg-dark-800 outline-none text-slate-800 dark:text-white focus:ring-1 focus:ring-primary-500"
                  />
                </div>

                {/* Alternate Phone */}
                <div>
                  <label className="block font-bold text-slate-700 dark:text-dark-200 mb-1">
                    Alternate Phone
                  </label>
                  <input
                    type="tel"
                    value={editForm.alternatePhone}
                    onChange={(e) => setEditForm({ ...editForm, alternatePhone: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-dark-700 bg-slate-50 dark:bg-dark-800 outline-none text-slate-800 dark:text-white focus:ring-1 focus:ring-primary-500"
                  />
                </div>

                {/* Source */}
                <div>
                  <label className="block font-bold text-slate-700 dark:text-dark-200 mb-1">
                    Lead Source
                  </label>
                  <select
                    value={editForm.source}
                    onChange={(e) => setEditForm({ ...editForm, source: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-dark-700 bg-slate-50 dark:bg-dark-800 outline-none text-slate-800 dark:text-white focus:ring-1 focus:ring-primary-500"
                  >
                    <option value="Website">Website</option>
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="JustDial">JustDial</option>
                    <option value="IndiaMART">IndiaMART</option>
                    <option value="Referral">Referral</option>
                    <option value="Walk-in">Walk-in</option>
                    <option value="Phone">Phone</option>
                    <option value="Email">Email</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                {/* Status */}
                <div>
                  <label className="block font-bold text-slate-700 dark:text-dark-200 mb-1">
                    Pipeline Status
                  </label>
                  <LeadStatusDropdown
                    currentStatus={editForm.status}
                    size="md"
                    className="w-full justify-between"
                    onStatusChange={(newStatus) => setEditForm({ ...editForm, status: newStatus })}
                  />
                </div>

                {/* Priority */}
                <div>
                  <label className="block font-bold text-slate-700 dark:text-dark-200 mb-1">
                    Priority Level
                  </label>
                  <select
                    value={editForm.priority}
                    onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-dark-700 bg-slate-50 dark:bg-dark-800 outline-none text-slate-800 dark:text-white focus:ring-1 focus:ring-primary-500"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                {/* Service Interested */}
                <div>
                  <label className="block font-bold text-slate-700 dark:text-dark-200 mb-1">
                    Service / Product Interested
                  </label>
                  <input
                    type="text"
                    value={editForm.serviceInterested}
                    onChange={(e) => setEditForm({ ...editForm, serviceInterested: e.target.value })}
                    placeholder="e.g. Web Development, CRM Consulting"
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-dark-700 bg-slate-50 dark:bg-dark-800 outline-none text-slate-800 dark:text-white focus:ring-1 focus:ring-primary-500"
                  />
                </div>

                {/* Expected Deal Value */}
                <div>
                  <label className="block font-bold text-slate-700 dark:text-dark-200 mb-1">
                    Expected Deal Value (₹)
                  </label>
                  <input
                    type="number"
                    value={editForm.expectedValue}
                    onChange={(e) => setEditForm({ ...editForm, expectedValue: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-dark-700 bg-slate-50 dark:bg-dark-800 outline-none text-slate-800 dark:text-white focus:ring-1 focus:ring-primary-500"
                  />
                </div>

                {/* Assigned Sales Executive */}
                <div>
                  <label className="block font-bold text-slate-700 dark:text-dark-200 mb-1">
                    Assigned Employee
                  </label>
                  <select
                    value={editForm.assignedTo}
                    onChange={(e) => setEditForm({ ...editForm, assignedTo: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-dark-700 bg-slate-50 dark:bg-dark-800 outline-none text-slate-800 dark:text-white focus:ring-1 focus:ring-primary-500"
                  >
                    <option value="">-- Unassigned (General Pool) --</option>
                    {(repsData || []).map((rep: any) => (
                      <option key={rep.user._id || rep.user.id} value={rep.user._id || rep.user.id}>
                        {rep.user.firstName} {rep.user.lastName} ({rep.user.email})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Notes */}
                <div className="md:col-span-2">
                  <label className="block font-bold text-slate-700 dark:text-dark-200 mb-1">
                    Lead Notes & Remarks
                  </label>
                  <textarea
                    rows={3}
                    value={editForm.notes}
                    onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                    placeholder="Enter customer requirements, discussion notes, or specific remarks..."
                    className="w-full p-3 rounded-xl border border-slate-200 dark:border-dark-700 bg-slate-50 dark:bg-dark-800 outline-none text-slate-800 dark:text-white focus:ring-1 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100 dark:border-dark-800">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-dark-700 font-bold text-slate-600 dark:text-dark-300 hover:bg-slate-50 dark:hover:bg-dark-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateLeadMutation.isPending}
                  className="inline-flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-[linear-gradient(45deg,#ef4444_0%,#6366f1_50%,#2563eb_100%)] hover:opacity-95 text-white font-bold transition shadow-md shadow-red-500/20 disabled:opacity-50 cursor-pointer"
                >
                  {updateLeadMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Schedule Follow-Up Modal */}
      {showFollowUpModal && lead && (
        <ScheduleFollowUpModal
          isOpen={showFollowUpModal}
          lead={lead}
          onClose={() => setShowFollowUpModal(false)}
        />
      )}

      {/* Quick Note & Activity Modal */}
      {showNoteModal && lead && (
        <QuickNoteModal
          isOpen={showNoteModal}
          lead={lead}
          onClose={() => setShowNoteModal(false)}
          onSuccess={() => refetch()}
        />
      )}

      {/* Log Call Result Modal */}
      {showCallModal && lead && (
        <LogCallModal
          isOpen={showCallModal}
          lead={lead}
          onClose={() => setShowCallModal(false)}
          onSuccess={() => refetch()}
        />
      )}
    </div>
  );
};
