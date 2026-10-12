import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import {
  LifeBuoy, PlusCircle, Search, AlertCircle, CheckCircle2,
  Clock, Send, ChevronRight, User, X, RefreshCw, Copy, Check
} from 'lucide-react';

interface TicketMessage {
  senderId: string;
  senderName: string;
  senderType: 'user' | 'customer';
  content: string;
  date: string;
}

interface Ticket {
  _id: string;
  id?: string;
  ticketId: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: 'technical' | 'billing' | 'service' | 'other';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  customerId: {
    _id: string;
    name: string;
    companyName?: string;
    email?: string;
    phone?: string;
  } | null;
  assignedTo?: {
    _id: string;
    firstName: string;
    lastName: string;
  } | null;
  organizationId?: {
    _id?: string;
    id?: string;
    name: string;
    logoUrl?: string;
  } | null;
  messages: TicketMessage[];
  createdAt: string;
  updatedAt: string;
}

export const ClientReportsHelpdesk: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'all' | 'open' | 'in_progress' | 'resolved' | 'closed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  // New Issue Form State
  const [formData, setFormData] = useState({
    clientName: '',
    clientPhone: '',
    clientEmail: '',
    companyName: '',
    customerId: '',
    category: 'technical' as 'technical' | 'billing' | 'service' | 'other',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    title: '',
    description: ''
  });

  // Fetch Tickets List
  const { data: tickets = [], isLoading, refetch } = useQuery<Ticket[]>({
    queryKey: ['tickets-list'],
    queryFn: async () => {
      const res = await api.get('/tickets');
      return res.data.data || [];
    },
    refetchInterval: 30000, // Real-time poll every 30s
    staleTime: 10000,
    refetchOnWindowFocus: true
  });

  // Fetch Customers for easy selection
  const { data: customers = [] } = useQuery({
    queryKey: ['selector-customers-tickets'],
    queryFn: async () => {
      const res = await api.get('/customers', { params: { limit: 100 } });
      return res.data.data?.customers || [];
    }
  });

  // Create Ticket Mutation
  const createTicketMutation = useMutation({
    mutationFn: async (payload: any) => {
      const cleanPayload = { ...payload };
      if (!cleanPayload.customerId) {
        delete cleanPayload.customerId;
      }
      const res = await api.post('/tickets', cleanPayload);
      return res.data.data;
    },
    onSuccess: (newTicket) => {
      queryClient.invalidateQueries({ queryKey: ['tickets-list'] });
      setShowReportModal(false);
      setFormData({
        clientName: '',
        clientPhone: '',
        clientEmail: '',
        companyName: '',
        customerId: '',
        category: 'technical',
        priority: 'medium',
        title: '',
        description: ''
      });
      setSelectedTicket(newTicket);
      alert('Support ticket created successfully!');
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to create support ticket. Please check required fields.');
    }
  });

  // Send Reply Mutation
  const sendReplyMutation = useMutation({
    mutationFn: async ({ ticketId, content }: { ticketId: string; content: string }) => {
      const res = await api.post(`/tickets/${ticketId}/messages`, { content });
      return res.data.data;
    },
    onSuccess: (updatedTicket) => {
      queryClient.invalidateQueries({ queryKey: ['tickets-list'] });
      setSelectedTicket(updatedTicket);
      setReplyContent('');
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to send reply. Please try again.');
    }
  });

  // Update Status / Priority Mutation
  const updateTicketMutation = useMutation({
    mutationFn: async ({ ticketId, status, priority }: { ticketId: string; status?: string; priority?: string }) => {
      const res = await api.put(`/tickets/${ticketId}`, { status, priority });
      return res.data.data;
    },
    onSuccess: (updatedTicket) => {
      queryClient.invalidateQueries({ queryKey: ['tickets-list'] });
      setSelectedTicket(updatedTicket);
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to update ticket. Please try again.');
    }
  });

  // Copy Public Reporting Portal Link
  const handleCopyPublicLink = () => {
    const publicUrl = `${window.location.origin}/report-issue`;
    navigator.clipboard.writeText(publicUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // Filter Tickets
  const filteredTickets = tickets.filter(ticket => {
    if (activeTab !== 'all' && ticket.status !== activeTab) return false;
    if (selectedCategory !== 'all' && ticket.category !== selectedCategory) return false;
    if (selectedPriority !== 'all' && ticket.priority !== selectedPriority) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchTitle = ticket.title.toLowerCase().includes(q);
      const matchId = ticket.ticketId.toLowerCase().includes(q);
      const matchClient = ticket.customerId?.name?.toLowerCase().includes(q) || false;
      const matchDesc = ticket.description.toLowerCase().includes(q);
      if (!matchTitle && !matchId && !matchClient && !matchDesc) return false;
    }
    return true;
  });

  // Stats calculation
  const totalCount = tickets.length;
  const openCount = tickets.filter(t => t.status === 'open').length;
  const inProgressCount = tickets.filter(t => t.status === 'in_progress').length;
  const urgentCount = tickets.filter(t => t.priority === 'urgent' && t.status !== 'closed' && t.status !== 'resolved').length;
  const resolvedCount = tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length;

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900">🚨 Urgent</span>;
      case 'high':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900">High</span>;
      case 'medium':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-900">Medium</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-slate-100 dark:bg-dark-800 text-slate-700 dark:text-slate-400 border border-slate-200 dark:border-dark-700">Low</span>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">Open</span>;
      case 'in_progress':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">In Progress</span>;
      case 'resolved':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">Resolved</span>;
      case 'closed':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20">Closed</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 p-6 rounded-3xl shadow-sm">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-gradient-to-tr from-orange-500 via-amber-500 to-blue-600 text-white rounded-2xl shadow-md">
            <LifeBuoy className="h-7 w-7" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl font-black text-slate-900 dark:text-white">Client Issue Reports & Helpdesk</h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-400 border border-orange-300 dark:border-orange-800">
                Direct Portal
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-dark-400 mt-1">
              Track, resolve, and reply to client-reported bugs, billing issues, service requests, and telephony concerns in real-time.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3 flex-wrap gap-2">
          {/* Public Link Share Button */}
          <button
            onClick={handleCopyPublicLink}
            className="inline-flex items-center space-x-2 px-3.5 py-2.5 rounded-xl bg-white dark:bg-dark-800 hover:bg-blue-50 dark:hover:bg-dark-700 text-blue-700 dark:text-blue-300 text-xs font-bold transition border border-blue-200 dark:border-blue-800 shadow-xs cursor-pointer active:scale-95"
            title="Copy Public Client Report Link to share on WhatsApp or Email"
          >
            {copiedLink ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4 text-blue-600" />}
            <span>{copiedLink ? 'Link Copied!' : 'Client Report Link'}</span>
          </button>

          {/* New Issue Button */}
          <button
            onClick={() => setShowReportModal(true)}
            className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-[linear-gradient(45deg,#ef4444_0%,#6366f1_50%,#2563eb_100%)] hover:brightness-110 text-white text-xs font-black transition shadow-md active:scale-95 cursor-pointer"
          >
            <PlusCircle className="h-4 w-4" />
            <span>Report Client Issue</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 p-4 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-dark-400">Total Reported</span>
            <LifeBuoy className="h-4 w-4 text-blue-600" />
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-2">{totalCount}</p>
        </div>

        <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 p-4 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-orange-600">Pending / Open</span>
            <Clock className="h-4 w-4 text-orange-600" />
          </div>
          <p className="text-2xl font-black text-orange-600 mt-2">{openCount}</p>
        </div>

        <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 p-4 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-red-600">Urgent Attention</span>
            <AlertCircle className="h-4 w-4 text-red-600" />
          </div>
          <p className="text-2xl font-black text-red-600 mt-2">{urgentCount}</p>
        </div>

        <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 p-4 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-600">Resolved / Closed</span>
            <CheckCircle2 className="h-4 w-4 text-blue-600" />
          </div>
          <p className="text-2xl font-black text-blue-600 mt-2">{resolvedCount}</p>
        </div>
      </div>

      {/* Main Ticket Desk & Filters */}
      <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-3xl p-6 shadow-sm space-y-6">
        {/* Filter Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Status Tabs */}
          <div className="flex items-center space-x-1.5 p-1 bg-slate-100 dark:bg-dark-800 rounded-2xl overflow-x-auto">
            {(['all', 'open', 'in_progress', 'resolved', 'closed'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  activeTab === tab
                    ? 'bg-[linear-gradient(45deg,#ef4444_0%,#6366f1_50%,#2563eb_100%)] text-white shadow-md font-black'
                    : 'text-slate-600 dark:text-dark-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {tab === 'all' && `All Issues (${totalCount})`}
                {tab === 'open' && `Open (${openCount})`}
                {tab === 'in_progress' && `In Progress (${inProgressCount})`}
                {tab === 'resolved' && `Resolved`}
                {tab === 'closed' && `Closed`}
              </button>
            ))}
          </div>

          {/* Search & Category / Priority Selectors */}
          <div className="flex items-center space-x-3 flex-wrap gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search ticket, client, ID..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-dark-800 rounded-xl outline-none focus:border-blue-500 w-52"
              />
            </div>

            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-dark-800 rounded-xl outline-none cursor-pointer"
            >
              <option value="all">All Categories</option>
              <option value="technical">Technical</option>
              <option value="billing">Billing & Payments</option>
              <option value="service">Service & Case</option>
              <option value="other">General Inquiry</option>
            </select>

            <select
              value={selectedPriority}
              onChange={e => setSelectedPriority(e.target.value)}
              className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-dark-800 rounded-xl outline-none cursor-pointer"
            >
              <option value="all">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            <button
              onClick={() => refetch()}
              className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-dark-800 transition"
              title="Refresh tickets"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Tickets Table / List */}
        {isLoading ? (
          <div className="py-16 text-center text-xs text-slate-400">Loading client issue reports...</div>
        ) : filteredTickets.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
            <p className="text-base font-bold text-slate-800 dark:text-white">No Issues Reported in this View</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              All client tickets are currently clear. You can report a new issue or share the direct client link.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-dark-800 border border-slate-200 dark:border-dark-800 rounded-2xl overflow-hidden">
            {filteredTickets.map(ticket => (
              <div
                key={ticket._id}
                onClick={() => setSelectedTicket(ticket)}
                className={`p-4 hover:bg-slate-50 dark:hover:bg-dark-800/60 transition cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  selectedTicket?._id === ticket._id ? 'bg-blue-50/60 dark:bg-blue-950/30' : ''
                }`}
              >
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex items-center space-x-2 flex-wrap gap-1">
                    <span className="text-[11px] font-mono font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md">
                      {ticket.ticketId}
                    </span>
                    {ticket.organizationId && typeof ticket.organizationId === 'object' && ticket.organizationId.name && (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 dark:bg-purple-950/70 dark:text-purple-300 border border-purple-200/50 dark:border-purple-800/40">
                        🏢 {ticket.organizationId.name}
                      </span>
                    )}
                    {getPriorityBadge(ticket.priority)}
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-dark-800 text-slate-600 dark:text-dark-300 uppercase">
                      {ticket.category}
                    </span>
                    <span className="text-xs text-slate-400">&bull;</span>
                    <span className="text-xs text-slate-500 dark:text-dark-400">
                      {new Date(ticket.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                    {ticket.title}
                  </h3>

                  <p className="text-xs text-slate-500 dark:text-dark-400 line-clamp-1">
                    {ticket.description}
                  </p>
                </div>

                <div className="flex items-center space-x-4 shrink-0">
                  <div className="text-right">
                    <p className="text-xs font-bold text-slate-800 dark:text-white flex items-center justify-end space-x-1">
                      <User className="h-3.5 w-3.5 text-slate-400" />
                      <span>{ticket.customerId?.name || 'Client User'}</span>
                    </p>
                    {ticket.customerId?.phone && (
                      <p className="text-[10px] text-slate-400">{ticket.customerId.phone}</p>
                    )}
                  </div>

                  <div>
                    {getStatusBadge(ticket.status)}
                  </div>

                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ticket Detail Drawer / Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 dark:border-dark-800 flex items-start justify-between bg-slate-50/50 dark:bg-dark-950/40">
              <div className="space-y-1.5">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-mono font-black text-blue-600 bg-blue-100 dark:bg-blue-950/80 px-2.5 py-0.5 rounded-lg">
                    {selectedTicket.ticketId}
                  </span>
                  {selectedTicket.organizationId && typeof selectedTicket.organizationId === 'object' && selectedTicket.organizationId.name && (
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">
                      🏢 Workspace: {selectedTicket.organizationId.name}
                    </span>
                  )}
                  {getPriorityBadge(selectedTicket.priority)}
                  {getStatusBadge(selectedTicket.status)}
                </div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white">
                  {selectedTicket.title}
                </h2>
                <div className="flex items-center space-x-4 text-xs text-slate-500 dark:text-dark-400">
                  <span>Client: <strong>{selectedTicket.customerId?.name || 'Direct Client'}</strong></span>
                  {selectedTicket.customerId?.phone && <span>Phone: {selectedTicket.customerId.phone}</span>}
                  {selectedTicket.customerId?.email && <span>Email: {selectedTicket.customerId.email}</span>}
                </div>
              </div>

              <button
                onClick={() => setSelectedTicket(null)}
                className="p-1.5 rounded-xl hover:bg-slate-200 dark:hover:bg-dark-800 transition"
              >
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>

            {/* Status & Priority Action Bar */}
            <div className="px-6 py-3 bg-slate-100/70 dark:bg-dark-800/40 border-b border-slate-200 dark:border-dark-800 flex items-center justify-between text-xs">
              <div className="flex items-center space-x-3">
                <span className="font-bold text-slate-700 dark:text-white">Update Status:</span>
                <select
                  value={selectedTicket.status}
                  disabled={updateTicketMutation.isPending}
                  onChange={e => updateTicketMutation.mutate({ ticketId: selectedTicket._id || selectedTicket.id, status: e.target.value })}
                  className="px-2.5 py-1 bg-white dark:bg-dark-900 border border-slate-300 dark:border-dark-700 rounded-lg outline-none font-bold text-blue-600 cursor-pointer disabled:opacity-50"
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>

                <span className="font-bold text-slate-700 dark:text-white ml-2">Priority:</span>
                <select
                  value={selectedTicket.priority}
                  disabled={updateTicketMutation.isPending}
                  onChange={e => updateTicketMutation.mutate({ ticketId: selectedTicket._id || selectedTicket.id, priority: e.target.value })}
                  className="px-2.5 py-1 bg-white dark:bg-dark-900 border border-slate-300 dark:border-dark-700 rounded-lg outline-none font-bold text-slate-800 dark:text-white cursor-pointer disabled:opacity-50"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              <span className="text-slate-400">
                Created: {new Date(selectedTicket.createdAt).toLocaleDateString()}
              </span>
            </div>

            {/* Conversation Thread */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/30 dark:bg-dark-950/20">
              {/* Initial Issue Description */}
              <div className="p-4 rounded-2xl bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 shadow-sm space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-bold text-slate-700 dark:text-white">Initial Issue Description</span>
                  <span>{new Date(selectedTicket.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <p className="text-xs text-slate-700 dark:text-dark-200 whitespace-pre-wrap leading-relaxed">
                  {selectedTicket.description}
                </p>
              </div>

              {/* Message Replies */}
              {selectedTicket.messages?.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col ${msg.senderType === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div className="flex items-center space-x-1.5 text-[10px] text-slate-400 mb-1 px-1">
                    <span className="font-bold text-slate-600 dark:text-dark-300">{msg.senderName}</span>
                    <span>({msg.senderType === 'user' ? 'Support Rep' : 'Client'})</span>
                    <span>&bull;</span>
                    <span>{new Date(msg.date || (msg as any).createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div
                    className={`p-3.5 rounded-2xl max-w-xl text-xs whitespace-pre-wrap leading-relaxed ${
                      msg.senderType === 'user'
                        ? 'bg-blue-600 text-white rounded-tr-none'
                        : 'bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 text-slate-800 dark:text-dark-200 rounded-tl-none shadow-sm'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
            </div>

            {/* Reply Input Bar */}
            <div className="p-4 border-t border-slate-200 dark:border-dark-800 bg-white dark:bg-dark-900 flex items-center space-x-3">
              <input
                type="text"
                placeholder="Type reply to client..."
                value={replyContent}
                onChange={e => setReplyContent(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && replyContent.trim() && !sendReplyMutation.isPending) {
                    sendReplyMutation.mutate({ ticketId: selectedTicket._id || selectedTicket.id, content: replyContent });
                  }
                }}
                className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-dark-800 rounded-xl text-xs outline-none focus:border-blue-500"
              />
              <button
                disabled={!replyContent.trim() || sendReplyMutation.isPending}
                onClick={() => sendReplyMutation.mutate({ ticketId: selectedTicket._id || selectedTicket.id, content: replyContent })}
                className="inline-flex items-center space-x-1.5 px-4 py-2.5 bg-[linear-gradient(45deg,#ef4444_0%,#6366f1_50%,#2563eb_100%)] hover:brightness-110 disabled:opacity-50 text-white text-xs font-black rounded-xl transition cursor-pointer shadow-md active:scale-95"
              >
                <Send className="h-4 w-4" />
                <span>{sendReplyMutation.isPending ? 'Sending...' : 'Reply'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Issue Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-dark-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-blue-100 dark:bg-blue-950/80 rounded-xl text-blue-600">
                  <LifeBuoy className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900 dark:text-white">Report New Client Issue</h2>
                  <p className="text-xs text-slate-500">Create an internal support ticket for this client</p>
                </div>
              </div>

              <button
                onClick={() => setShowReportModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-dark-800 transition"
              >
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                createTicketMutation.mutate(formData);
              }}
              className="space-y-4 text-xs"
            >
              {/* Select Existing Customer OR Type Client Info */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-white mb-1">
                  Select Customer Account (Optional)
                </label>
                <select
                  value={formData.customerId}
                  onChange={e => {
                    const cId = e.target.value;
                    const matched = customers.find((c: any) => c._id === cId);
                    setFormData(prev => ({
                      ...prev,
                      customerId: cId,
                      clientName: matched ? matched.name : prev.clientName,
                      clientPhone: matched ? matched.phone || '' : prev.clientPhone,
                      clientEmail: matched ? matched.email || '' : prev.clientEmail,
                      companyName: matched ? matched.companyName || '' : prev.companyName
                    }));
                  }}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-dark-800 rounded-xl outline-none"
                >
                  <option value="">Choose existing customer (or enter manual info below)</option>
                  {customers.map((c: any) => (
                    <option key={c._id} value={c._id}>
                      {c.name} {c.companyName ? `(${c.companyName})` : ''} - {c.phone}
                    </option>
                  ))}
                </select>
              </div>

              {!formData.customerId && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-white mb-1">Client Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Ramesh Sharma"
                      value={formData.clientName}
                      onChange={e => setFormData({ ...formData, clientName: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-dark-800 rounded-xl outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-white mb-1">Client Phone</label>
                    <input
                      type="tel"
                      placeholder="e.g. 9876543210"
                      value={formData.clientPhone}
                      onChange={e => setFormData({ ...formData, clientPhone: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-dark-800 rounded-xl outline-none"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-white mb-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-dark-800 rounded-xl outline-none font-bold cursor-pointer"
                  >
                    <option value="technical">Technical Bug / App</option>
                    <option value="billing">Billing / Invoice Issue</option>
                    <option value="service">Service Delay / Execution</option>
                    <option value="other">General Inquiry</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-white mb-1">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={e => setFormData({ ...formData, priority: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-dark-800 rounded-xl outline-none font-bold cursor-pointer"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">🚨 Urgent</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-white mb-1">
                  Issue Title / Subject <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Payment deducted but invoice still showing unpaid"
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-dark-800 rounded-xl outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-white mb-1">
                  Detailed Issue Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Provide full details of the issue, error messages, or steps to reproduce..."
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-dark-800 rounded-xl outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  className="px-4 py-2.5 text-slate-600 dark:text-dark-300 font-bold hover:bg-slate-100 dark:hover:bg-dark-800 rounded-xl transition text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createTicketMutation.isPending}
                  className="px-5 py-2.5 bg-[linear-gradient(45deg,#ef4444_0%,#6366f1_50%,#2563eb_100%)] hover:brightness-110 text-white font-black rounded-xl transition shadow-md text-xs active:scale-95 cursor-pointer"
                >
                  {createTicketMutation.isPending ? 'Submitting...' : 'Create Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
