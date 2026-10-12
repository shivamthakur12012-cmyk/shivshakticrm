import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import {
  Plus, Search, Users, AlertCircle, Send, X,
  ArrowRightLeft, Tag, Trash2, Eye,
  CheckCircle2, UserCheck, UserX,
  Calendar, Layers, Clock, FileText, Receipt,
  XCircle, ShieldAlert, Sparkles, Flame
} from 'lucide-react';
import { ScheduleFollowUpModal } from '../../components/crm/ScheduleFollowUpModal';

interface LeadsListProps {
  defaultMode?: 'all' | 'today' | 'open' | 'followup' | 'converted' | 'lost';
}

export const LeadsList: React.FC<LeadsListProps> = ({ defaultMode }) => {
  const queryClient = useQueryClient();
  const location = useLocation();
  const { user, organizations, activeOrganizationId } = useAuthStore();
  const activeOrg = organizations.find(org => org.id === activeOrganizationId) || organizations[0];
  const activeRole = activeOrg?.role || 'Sale Executive';
  const isAdmin = ['Admin', 'Super Admin'].includes(activeRole);
  const isManager = isAdmin || activeRole === 'Manager';
  const isTeamLeader = isManager || activeRole === 'Team Leader';
  const isPrivileged = isTeamLeader;

  // Detect mode from prop or URL path
  const currentMode = defaultMode || (
    location.pathname.includes('today') ? 'today' :
      location.pathname.includes('open-leads') ? 'open' :
        (location.pathname.includes('followup') || location.pathname.includes('follow-up')) ? 'followup' :
          location.pathname.includes('converted-leads') ? 'converted' :
            location.pathname.includes('lost-leads') ? 'lost' : 'all'
  );

  const [subStage, setSubStage] = useState<string>(() => {
    const isFollowup = location.pathname.includes('followup') || location.pathname.includes('follow-up') || defaultMode === 'followup';
    return isFollowup ? 'today' : 'all';
  });
  const activeSubStage = (currentMode === 'followup' && (subStage === 'all' || !['today', 'tomorrow', 'upcoming'].includes(subStage)))
    ? 'today'
    : subStage;
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');

  // 300ms debounce to prevent API flooding on keystrokes
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);
  const [employeeFilter, setEmployeeFilter] = useState('');
  const unassignedOnly = activeSubStage === 'unassigned';
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [bulkAssignModal, setBulkAssignModal] = useState(false);
  const [followUpModalLead, setFollowUpModalLead] = useState<any>(null);
  const [targetRepId, setTargetRepId] = useState('');

  // Quick-Add Lead form state
  const [newName, setNewName] = useState('');
  const [newCompany, setNewCompany] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newSource, setNewSource] = useState('Website');
  const [newService, setNewService] = useState('');
  const [newAssignedTo, setNewAssignedTo] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState<any>(null);

  // Update page and reset sub-stage when mode changes
  useEffect(() => {
    setPage(1);
    setSelectedLeads([]);
    setSubStage(currentMode === 'followup' ? 'today' : 'all');
  }, [location.pathname, defaultMode, currentMode]);

  // Listen for custom event or ?new=true to open add lead modal
  useEffect(() => {
    const handleOpenModal = () => {
      resetNewLeadForm();
      setShowAddModal(true);
    };
    window.addEventListener('open-new-lead-modal', handleOpenModal);

    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get('new') === 'true') {
      resetNewLeadForm();
      setShowAddModal(true);
    }

    return () => {
      window.removeEventListener('open-new-lead-modal', handleOpenModal);
    };
  }, [location.search]);

  // Pre-flight duplicate check on phone/email entry
  const checkDuplicate = async (phoneVal: string, emailVal: string) => {
    if (!phoneVal || phoneVal.length < 7) {
      setDuplicateWarning(null);
      return;
    }
    try {
      const res = await api.post('/leads/check-duplicate', { phone: phoneVal, email: emailVal });
      if (res.data.isDuplicate) {
        setDuplicateWarning(res.data.existingLead);
      } else {
        setDuplicateWarning(null);
      }
    } catch (err) {
      // Ignore
    }
  };

  // 1. Fetch Employees (Master data cached on client)
  const { data: employeesData } = useQuery({
    queryKey: ['employees-master-list'],
    queryFn: async () => {
      const res = await api.get('/assignment/config');
      return res.data.data?.reps || [];
    },
    staleTime: 5 * 60 * 1000 // 5 minutes client cache
  });

  // 2. Fetch Leads List (Paginated, filtered, debounced)
  const { data: leadsResponse, isLoading } = useQuery({
    queryKey: ['leads', currentMode, activeSubStage, sourceFilter, employeeFilter, unassignedOnly, debouncedSearch, page, limit],
    queryFn: async () => {
      const res = await api.get('/leads', {
        params: {
          status: currentMode,
          subStage: activeSubStage !== 'all' ? activeSubStage : undefined,
          source: sourceFilter || undefined,
          assignedTo: employeeFilter || undefined,
          unassignedOnly: unassignedOnly ? 'true' : undefined,
          search: debouncedSearch || undefined,
          page,
          limit
        }
      });
      return res.data.data;
    },
    placeholderData: keepPreviousData
  });

  const leads = leadsResponse?.leads || [];
  const counts = leadsResponse?.counts || { all: 0, today: 0, open: 0, followup: 0, converted: 0, lost: 0, unassigned: 0 };
  const subCounts = leadsResponse?.subCounts || {};
  const pagination = leadsResponse?.pagination || { total: 0, page: 1, limit: 25, pages: 1 };

  // Create Lead Mutation
  const createLeadMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post('/leads', payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      setShowAddModal(false);
      resetNewLeadForm();
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to create lead.');
    }
  });

  // Bulk Reassign Mutation
  const bulkAssignMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/leads/assign', {
        leadIds: selectedLeads,
        assignedTo: targetRepId,
        reason: 'Bulk reassignment from leads workspace'
      });
      return res.data;
    },
    onSuccess: (data) => {
      alert(data.message || 'Leads reassigned successfully.');
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      setBulkAssignModal(false);
      setSelectedLeads([]);
    }
  });

  // Bulk Action Mutation (Tags, Delete, Status)
  const bulkActionMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post('/leads/bulk', { ...payload, leadIds: selectedLeads });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      setSelectedLeads([]);
    }
  });


  const resetNewLeadForm = () => {
    setNewName('');
    setNewCompany('');
    setNewPhone('');
    setNewEmail('');
    setNewSource('Website');
    setNewService('');
    setNewAssignedTo('');
    setNewNotes('');
    setDuplicateWarning(null);
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedLeads(leads.map((l: any) => l._id));
    } else {
      setSelectedLeads([]);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedLeads(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'New':
        return (
          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900 font-black text-[10px] uppercase shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
            <span className="truncate">1. New Lead</span>
          </span>
        );
      case 'Open':
      case 'Contacted':
        return (
          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900 font-black text-[10px] uppercase shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
            <span className="truncate">2. In Progress</span>
          </span>
        );
      case 'Qualified':
        return (
          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-xl bg-teal-50 text-teal-700 border border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-900 font-black text-[10px] uppercase shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-500 shrink-0" />
            <span className="truncate">3. Qualified</span>
          </span>
        );
      case 'Proposal Sent':
        return (
          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900 font-black text-[10px] uppercase shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
            <span className="truncate">4. Proposal Sent</span>
          </span>
        );
      case 'Negotiation':
        return (
          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-xl bg-orange-50 text-orange-700 border border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-900 font-black text-[10px] uppercase shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0" />
            <span className="truncate">5. Negotiation</span>
          </span>
        );
      case 'Follow-up':
      case 'Follow-Up':
      case 'Followup':
        return (
          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900 font-black text-[10px] uppercase shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
            <span className="truncate">6. In Follow-up</span>
          </span>
        );
      case 'Converted':
        return (
          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-xl bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-900 font-black text-[10px] uppercase shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" />
            <span className="truncate">7. Converted</span>
          </span>
        );
      case 'Lost':
        return (
          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900 font-black text-[10px] uppercase shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
            <span className="truncate">8. Lost</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-xl bg-slate-50 text-slate-700 border border-slate-200 dark:bg-dark-800 dark:text-slate-300 dark:border-dark-700 font-black text-[10px] uppercase shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
            <span className="truncate">{status}</span>
          </span>
        );
    }
  };


  const getSubPipelineItems = () => {
    if (currentMode === 'today') {
      return [
        { id: 'all', label: 'All New Leads->', count: subCounts?.today?.all ?? counts.today ?? 0, icon: Sparkles },
        { id: 'assigned', label: 'Assigned Leads', count: subCounts?.today?.assigned ?? 0, icon: UserCheck },
        { id: 'unassigned', label: 'Unassigned Leads', count: subCounts?.today?.unassigned ?? 0, icon: UserX },
      ];
    }
    if (currentMode === 'followup') {
      return [
        { id: 'today', label: 'Today', count: subCounts?.followup?.today ?? 0, icon: Flame },
        { id: 'tomorrow', label: 'Tomorrow', count: subCounts?.followup?.tomorrow ?? 0, icon: Calendar },
        { id: 'upcoming', label: 'Upcoming', count: subCounts?.followup?.upcoming ?? 0, icon: Clock },
      ];
    }
    if (currentMode === 'open') {
      return [
        { id: 'all', label: 'All Open->', count: subCounts?.open?.all ?? counts.open ?? 0, icon: Layers },
        { id: 'in_progress', label: 'In Progress', count: subCounts?.open?.in_progress ?? 0, icon: Clock },
        { id: 'qualified', label: 'Qualified', count: subCounts?.open?.qualified ?? 0, icon: CheckCircle2 },
        { id: 'proposal_sent', label: 'Proposal Sent', count: subCounts?.open?.proposal_sent ?? 0, icon: Send },
        { id: 'negotiation', label: 'Negotiation', count: subCounts?.open?.negotiation ?? 0, icon: ArrowRightLeft },
      ];
    }
    if (currentMode === 'converted') {
      return [
        { id: 'all', label: 'All Converted->', count: subCounts?.converted?.all ?? counts.converted ?? 0, icon: CheckCircle2 },
        { id: 'quotation', label: 'With Quotation', count: subCounts?.converted?.quotation ?? 0, icon: FileText },
        { id: 'invoice', label: 'With Invoice', count: subCounts?.converted?.invoice ?? 0, icon: Receipt },
      ];
    }
    if (currentMode === 'lost') {
      return [
        { id: 'all', label: 'All Lost->', count: subCounts?.lost?.all ?? counts.lost ?? 0, icon: XCircle },
        { id: 'pricing', label: 'Price Sensitivity', count: subCounts?.lost?.pricing ?? 0, icon: Tag },
        { id: 'no_requirement', label: 'No Requirement', count: subCounts?.lost?.no_requirement ?? 0, icon: AlertCircle },
        { id: 'competitor', label: 'Competitor', count: subCounts?.lost?.competitor ?? 0, icon: ShieldAlert },
      ];
    }
    return [
      { id: 'all', label: 'All Leads', count: subCounts?.all?.all ?? counts.all ?? 0, icon: Users },
      { id: 'assigned', label: 'Assigned', count: subCounts?.all?.assigned ?? 0, icon: UserCheck },
      { id: 'unassigned', label: 'Unassigned', count: subCounts?.all?.unassigned ?? counts.unassigned ?? 0, icon: UserX },
      { id: 'high_priority', label: 'High Priority', count: subCounts?.all?.high_priority ?? 0, icon: AlertCircle },
    ];
  };
  const subPipelineItems = getSubPipelineItems();

  const getActiveTheme = (_mode: string) => {
    return {
      bg: 'bg-[linear-gradient(45deg,#ef4444_0%,#6366f1_50%,#2563eb_100%)]',
      hoverBg: 'hover:brightness-110',
      ring: 'ring-blue-500/25',
      shadow: 'shadow-blue-500/25',
      text: 'text-blue-600 dark:text-blue-400',
      badge: 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400'
    };
  };
  const activeTheme = getActiveTheme(currentMode);

  return (
    <div className="max-w-7xl mx-auto space-y-6">

      {/* 2. Primary Pipeline Bar */}
      <div className="flex flex-wrap items-center justify-center gap-3 border-b border-slate-200 dark:border-dark-800 pb-3">
        <div className="flex space-x-1.5 bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 p-1.5 rounded-2xl shadow-sm overflow-x-auto">
          <Link
            to="/crm/leads"
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${currentMode === 'all' && !unassignedOnly
              ? 'bg-[linear-gradient(45deg,#ef4444_0%,#6366f1_50%,#2563eb_100%)] text-white shadow-md font-black'
              : 'text-slate-600 dark:text-dark-400 hover:bg-slate-100 dark:hover:bg-dark-800'
              }`}
          >
            <span>{isPrivileged ? 'All Leads' : 'My Leads'}</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${currentMode === 'all' && !unassignedOnly
              ? 'bg-white/20 text-white'
              : 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400'
              }`}>
              {counts.all}
            </span>
          </Link>

          <Link
            to="/crm/today-leads"
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${currentMode === 'today'
              ? 'bg-[linear-gradient(45deg,#ef4444_0%,#6366f1_50%,#2563eb_100%)] text-white shadow-md font-black'
              : 'text-slate-600 dark:text-dark-400 hover:bg-slate-100 dark:hover:bg-dark-800'
              }`}
          >
            <span>New Leads</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${currentMode === 'today'
              ? 'bg-white/20 text-white'
              : 'bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-400'
              }`}>
              {counts.today ?? 0}
            </span>
          </Link>

          <Link
            to="/crm/open-leads"
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${currentMode === 'open'
              ? 'bg-[linear-gradient(45deg,#ef4444_0%,#6366f1_50%,#2563eb_100%)] text-white shadow-md font-black'
              : 'text-slate-600 dark:text-dark-400 hover:bg-slate-100 dark:hover:bg-dark-800'
              }`}
          >
            <span>Open Leads</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${currentMode === 'open'
              ? 'bg-white/20 text-white'
              : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
              }`}>
              {counts.open}
            </span>
          </Link>

          <Link
            to="/crm/followup-leads"
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${currentMode === 'followup'
              ? 'bg-[linear-gradient(45deg,#ef4444_0%,#6366f1_50%,#2563eb_100%)] text-white shadow-md font-black'
              : 'text-slate-600 dark:text-dark-400 hover:bg-slate-100 dark:hover:bg-dark-800'
              }`}
          >
            <span>Follow-Up</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${currentMode === 'followup'
              ? 'bg-white/20 text-white'
              : 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-400'
              }`}>
              {counts.followup ?? 0}
            </span>
          </Link>

          <Link
            to="/crm/converted-leads"
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${currentMode === 'converted'
              ? 'bg-[linear-gradient(45deg,#ef4444_0%,#6366f1_50%,#2563eb_100%)] text-white shadow-md font-black'
              : 'text-slate-600 dark:text-dark-400 hover:bg-slate-100 dark:hover:bg-dark-800'
              }`}
          >
            <span>Converted</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${currentMode === 'converted'
              ? 'bg-white/20 text-white'
              : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
              }`}>
              {counts.converted}
            </span>
          </Link>

          <Link
            to="/crm/lost-leads"
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${currentMode === 'lost'
              ? 'bg-[linear-gradient(45deg,#ef4444_0%,#6366f1_50%,#2563eb_100%)] text-white shadow-md font-black'
              : 'text-slate-600 dark:text-dark-400 hover:bg-slate-100 dark:hover:bg-dark-800'
              }`}
          >
            <span>Lost Leads</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${currentMode === 'lost'
              ? 'bg-white/20 text-white'
              : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
              }`}>
              {counts.lost}
            </span>
          </Link>
        </div>
      </div>

      {/* 2.5 Secondary Contextual Sub-Pipeline */}
      <div className="flex items-center justify-center space-x-2 overflow-x-auto pb-1 pt-0.5 scrollbar-thin">
        <div className="flex items-center space-x-1.5 p-1 rounded-2xl bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 shadow-sm">
          {subPipelineItems.map((item) => {
            const isActive = activeSubStage === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => { setSubStage(item.id); setPage(1); }}
                className={`group flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all duration-150 ${isActive
                  ? `${activeTheme.bg} text-white shadow-md ${activeTheme.shadow} ring-2 ${activeTheme.ring}`
                  : 'text-slate-600 dark:text-dark-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-dark-800'
                  }`}
              >
                <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-white' : 'text-slate-400 dark:text-dark-400 group-hover:text-slate-600 dark:group-hover:text-slate-300'}`} />
                <span>{item.label}</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black transition-colors ${isActive
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-100 dark:bg-dark-800 text-slate-600 dark:text-dark-400 group-hover:bg-slate-200 dark:group-hover:bg-dark-700'
                  }`}>
                  {item.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Filter Bar & Search */}
      <div className={`bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 p-4 rounded-3xl shadow-sm grid grid-cols-1 ${isPrivileged ? 'md:grid-cols-5' : 'md:grid-cols-4'} gap-3 items-center`}>
        {/* Search */}
        <div className="relative md:col-span-2">
          <Search className="h-4 w-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, company, phone (e.g. 9876543210), email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-dark-700 bg-slate-50 dark:bg-dark-800 text-xs text-slate-800 dark:text-white outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>

        {/* Source Filter */}
        <div>
          <select
            value={sourceFilter}
            onChange={(e) => { setSourceFilter(e.target.value); setPage(1); }}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-dark-700 bg-slate-50 dark:bg-dark-800 text-xs font-semibold text-slate-700 dark:text-dark-200 outline-none cursor-pointer"
          >
            <option value="">All Sources</option>
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

        {/* Assigned Rep Filter (Privileged Roles: Admin, Manager, Team Leader) */}
        {isPrivileged && (
          <div>
            <select
              value={employeeFilter}
              onChange={(e) => { setEmployeeFilter(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-dark-700 bg-slate-50 dark:bg-dark-800 text-xs font-semibold text-slate-700 dark:text-dark-200 outline-none cursor-pointer"
            >
              <option value="">All Team Members</option>
              {(employeesData || []).filter((r: any) => r && (r.user || r.firstName)).map((r: any) => {
                const u = r.user || r;
                return (
                  <option key={u._id || u.id} value={u._id || u.id}>
                    {u.firstName} {u.lastName} ({r.role || 'Sale Executive'})
                  </option>
                );
              })}
            </select>
          </div>
        )}

        {/* Page Size Selector */}
        <div className="flex items-center justify-end space-x-2">
          <span className="text-[11px] text-slate-400 font-bold uppercase">Rows:</span>
          <select
            value={limit}
            onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
            className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-dark-700 bg-slate-50 dark:bg-dark-800 text-xs font-bold outline-none"
          >
            <option value={25}>25 / page</option>
            <option value={50}>50 / page</option>
          </select>
        </div>
      </div>

      {/* 4. Multi-Select Bulk Actions Floating Banner (Admins & Managers only) */}
      {isManager && selectedLeads.length > 0 && (
        <div className="p-4 rounded-2xl bg-slate-900 text-white flex items-center justify-between shadow-xl animate-fade-in">
          <div className="flex items-center space-x-3 text-xs font-bold">
            <span className="w-6 h-6 rounded-full bg-primary-600 flex items-center justify-center text-xs">
              {selectedLeads.length}
            </span>
            <span>Leads Selected</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setBulkAssignModal(true)}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-xs font-bold transition"
            >
              <ArrowRightLeft className="h-3.5 w-3.5" />
              <span>Assign To...</span>
            </button>

            <button
              onClick={() => {
                const tag = prompt('Enter tag to add (e.g. "High Intent", "VIP"):');
                if (tag) bulkActionMutation.mutate({ action: 'add_tag', tag });
              }}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold transition"
            >
              <Tag className="h-3.5 w-3.5" />
              <span>Add Tag</span>
            </button>

            <button
              onClick={() => {
                if (confirm(`Delete ${selectedLeads.length} selected lead(s)?`)) {
                  bulkActionMutation.mutate({ action: 'delete' });
                }
              }}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-red-600/80 hover:bg-red-600 text-xs font-bold transition"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Delete</span>
            </button>

            <button
              onClick={() => setSelectedLeads([])}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* 5. Main Leads Table (with Skeleton Loaders) */}
      <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-3xl p-6 shadow-sm">
        {isLoading ? (
          /* SKELETON LOADER ROWS */
          <div className="space-y-3">
            {[...Array(6)].map((_, idx) => (
              <div key={idx} className="h-12 bg-slate-100 dark:bg-dark-800/60 rounded-xl animate-pulse flex items-center justify-between px-4">
                <div className="h-4 w-32 bg-slate-200 dark:bg-dark-700 rounded"></div>
                <div className="h-4 w-24 bg-slate-200 dark:bg-dark-700 rounded"></div>
                <div className="h-4 w-28 bg-slate-200 dark:bg-dark-700 rounded"></div>
                <div className="h-4 w-20 bg-slate-200 dark:bg-dark-700 rounded"></div>
              </div>
            ))}
          </div>
        ) : leads.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <Users className="h-12 w-12 text-slate-300 dark:text-dark-600 mx-auto" />
            <p className="text-base font-bold text-slate-800 dark:text-white">No Leads Found</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              No lead records match your active tab or filter criteria. Add a new lead or import a CSV batch.
            </p>
            <button
              onClick={() => { resetNewLeadForm(); setShowAddModal(true); }}
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-[linear-gradient(45deg,#ef4444_0%,#6366f1_50%,#2563eb_100%)] hover:opacity-95 text-white font-bold text-xs shadow-md shadow-red-500/20 active:scale-95 transition cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Add First Lead</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 dark:border-dark-800 rounded-2xl">
            <table className="w-full text-left text-xs text-slate-600 dark:text-dark-300">
              <thead className="bg-slate-50 dark:bg-dark-800 text-slate-700 dark:text-white font-bold text-[10px] uppercase tracking-wider">
                <tr>
                  <th className="p-3 w-8">
                    <input
                      type="checkbox"
                      onChange={handleSelectAll}
                      checked={selectedLeads.length === leads.length && leads.length > 0}
                      className="rounded text-primary-600 outline-none"
                    />
                  </th>
                  <th className="p-3">Lead ID</th>
                  <th className="p-3">Lead Details</th>
                  <th className="p-3">Contact</th>
                  <th className="p-3">Source</th>
                  <th className="p-3">Assigned To</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Next Follow-Up</th>
                  <th className="p-3 text-right">{isAdmin ? 'Actions' : 'Quick Follow-Up'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-dark-800">
                {leads.map((lead: any) => (
                  <tr key={lead._id} className="hover:bg-slate-50/60 dark:hover:bg-dark-800/30 transition">
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={selectedLeads.includes(lead._id)}
                        onChange={() => handleToggleSelect(lead._id)}
                        className="rounded text-primary-600 outline-none"
                      />
                    </td>
                    <td className="p-3 font-mono font-bold text-primary-600">
                      <Link to={`/crm/leads/${lead._id}`} className="hover:underline">
                        {lead.leadId}
                      </Link>
                    </td>
                    <td className="p-3">
                      <Link to={`/crm/leads/${lead._id}`} className="font-bold text-slate-800 dark:text-white hover:text-primary-600 block">
                        {lead.name}
                      </Link>
                      <span className="text-[11px] text-slate-400">{lead.company || '—'}</span>
                    </td>
                    <td className="p-3 space-y-0.5">
                      <p className="font-semibold text-slate-700 dark:text-dark-200">{lead.phone}</p>
                      {lead.email && <p className="text-[10px] text-slate-400 truncate max-w-[140px]">{lead.email}</p>}
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-dark-800 font-bold text-[10px]">
                        {lead.source}
                      </span>
                    </td>
                    <td className="p-3">
                      {lead.assignedTo ? (
                        <span className="text-slate-800 dark:text-dark-200 font-medium">
                          {lead.assignedTo.firstName} {lead.assignedTo.lastName}
                        </span>
                      ) : (
                        <span className="text-amber-500 font-bold text-[10px] uppercase">Unassigned</span>
                      )}
                    </td>
                    <td className="p-3">
                      {getStatusBadge(lead.status)}
                    </td>
                    <td className="p-3">
                      {lead.nextFollowUp ? (
                        <button
                          type="button"
                          onClick={() => setFollowUpModalLead(lead)}
                          title="Click to view or reschedule follow-up"
                          className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-bold transition group cursor-pointer shadow-xs"
                        >
                          <Calendar className="w-3.5 h-3.5 text-blue-600 group-hover:scale-110 transition-transform" />
                          <span>
                            {new Date(lead.nextFollowUp).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short'
                            })}
                          </span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setFollowUpModalLead(lead)}
                          title="Schedule next follow-up"
                          className="inline-flex items-center space-x-1.5 text-[11px] font-bold text-white bg-[linear-gradient(45deg,#ef4444_0%,#6366f1_50%,#2563eb_100%)] hover:opacity-95 px-2.5 py-1 rounded-xl shadow-xs transition cursor-pointer"
                        >
                          <Clock className="w-3 h-3 text-white" />
                          <span>+ Schedule</span>
                        </button>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <div className="inline-flex items-center justify-end">
                        <Link
                          to={`/crm/leads/${lead._id}`}
                          title="View & Edit Lead Details"
                          className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-dark-800 text-blue-700 dark:text-blue-300 hover:text-white hover:bg-[linear-gradient(45deg,#ef4444_0%,#6366f1_50%,#2563eb_100%)] border border-blue-200 dark:border-blue-900/60 font-bold text-xs transition shadow-xs"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>View Details</span>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-dark-800 text-xs">
            <p className="text-slate-400">
              Showing page {pagination.page} of {pagination.pages} ({pagination.total} total leads)
            </p>
            <div className="flex items-center space-x-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-dark-700 text-slate-600 dark:text-dark-300 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={page >= pagination.pages}
                onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-dark-700 text-slate-600 dark:text-dark-300 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 6. Quick-Add Lead Modal (with Duplicate Detection) */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-dark-800 pb-3">
              <h3 className="text-base font-black text-slate-800 dark:text-white">Quick-Add Single Lead</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Duplicate Warning Prompt */}
            {duplicateWarning && (
              <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-xs space-y-2">
                <div className="flex items-center space-x-2 text-amber-800 dark:text-amber-300 font-bold">
                  <AlertCircle className="h-4 w-4" />
                  <span>Existing Lead Match Detected!</span>
                </div>
                <p className="text-amber-700 dark:text-amber-400 text-[11px]">
                  A lead with this phone number already exists: <strong>#{duplicateWarning.leadId} - {duplicateWarning.name}</strong> (Assigned to: {duplicateWarning.assignedTo ? `${duplicateWarning.assignedTo.firstName} ${duplicateWarning.assignedTo.lastName}` : 'Unassigned'}).
                </p>
                <div className="flex space-x-2 pt-1">
                  <Link
                    to={`/crm/leads/${duplicateWarning._id}`}
                    className="px-3 py-1 rounded-lg bg-amber-600 text-white font-bold text-[10px]"
                  >
                    Open Existing Lead
                  </Link>
                  <button
                    onClick={() => {
                      createLeadMutation.mutate({
                        name: newName,
                        company: newCompany,
                        phone: newPhone,
                        email: newEmail,
                        source: newSource,
                        serviceInterested: newService,
                        assignedTo: isManager ? (newAssignedTo || undefined) : (user?.id || (user as any)?._id),
                        notes: newNotes,
                        force: true
                      });
                    }}
                    className="px-3 py-1 rounded-lg bg-slate-200 text-slate-800 dark:bg-dark-800 dark:text-dark-200 font-bold text-[10px]"
                  >
                    Create Anyway
                  </button>
                </div>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                createLeadMutation.mutate({
                  name: newName,
                  company: newCompany,
                  phone: newPhone,
                  email: newEmail,
                  source: newSource,
                  serviceInterested: newService,
                  assignedTo: isManager ? (newAssignedTo || undefined) : (user?.id || (user as any)?._id),
                  notes: newNotes
                });
              }}
              className="space-y-3 text-xs"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-white mb-1">Lead Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="Full name..."
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-dark-700 bg-slate-50 dark:bg-dark-800 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-white mb-1">Company / Organization</label>
                  <input
                    type="text"
                    placeholder="Company name..."
                    value={newCompany}
                    onChange={(e) => setNewCompany(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-dark-700 bg-slate-50 dark:bg-dark-800 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-white mb-1">Phone Number (10 digits) *</label>
                  <input
                    type="tel"
                    required
                    placeholder="9876543210"
                    value={newPhone}
                    onChange={(e) => {
                      setNewPhone(e.target.value);
                      checkDuplicate(e.target.value, newEmail);
                    }}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-dark-700 bg-slate-50 dark:bg-dark-800 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-white mb-1">Email Address</label>
                  <input
                    type="email"
                    placeholder="lead@company.com"
                    value={newEmail}
                    onChange={(e) => {
                      setNewEmail(e.target.value);
                      checkDuplicate(newPhone, e.target.value);
                    }}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-dark-700 bg-slate-50 dark:bg-dark-800 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-white mb-1">Source</label>
                  <select
                    value={newSource}
                    onChange={(e) => setNewSource(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-dark-700 bg-slate-50 dark:bg-dark-800 outline-none"
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
                <div>
                  <label className="block font-bold text-slate-700 dark:text-white mb-1">
                    {isPrivileged ? 'Assign To (Optional)' : 'Assigned Agent'}
                  </label>
                  {isPrivileged ? (
                    <select
                      value={newAssignedTo}
                      onChange={(e) => setNewAssignedTo(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-dark-700 bg-slate-50 dark:bg-dark-800 outline-none text-xs font-semibold"
                    >
                      <option value="">-- Leave Unassigned (New) --</option>
                      {(employeesData || []).filter((r: any) => r && (r.user || r.firstName)).map((r: any) => {
                        const u = r.user || r;
                        return (
                          <option key={u._id || u.id} value={u._id || u.id}>
                            {u.firstName} {u.lastName} ({r.role || 'Sale Executive'})
                          </option>
                        );
                      })}
                    </select>
                  ) : (
                    <div className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-dark-700 bg-slate-100 dark:bg-dark-800 text-slate-700 dark:text-dark-300 font-semibold text-xs">
                      You ({user?.firstName} {user?.lastName})
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-white mb-1">Service / Requirement</label>
                <input
                  type="text"
                  placeholder="e.g. Loan inquiry, GST registration..."
                  value={newService}
                  onChange={(e) => setNewService(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-dark-700 bg-slate-50 dark:bg-dark-800 outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-white mb-1">Initial Notes</label>
                <textarea
                  rows={2}
                  placeholder="Additional context from client..."
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-dark-700 bg-slate-50 dark:bg-dark-800 outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-dark-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-dark-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLeadMutation.isPending}
                  className="px-5 py-2 rounded-xl bg-[linear-gradient(45deg,#ef4444_0%,#6366f1_50%,#2563eb_100%)] hover:opacity-95 text-white font-bold transition disabled:opacity-50 shadow-md shadow-red-500/20"
                >
                  {createLeadMutation.isPending ? 'Saving...' : 'Create Lead'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Bulk Reassign Modal */}
      {bulkAssignModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-black text-slate-800 dark:text-white">
              Bulk Reassign ({selectedLeads.length} Leads)
            </h3>
            <p className="text-xs text-slate-400">Select target sales representative to reallocate selected leads:</p>

            <select
              value={targetRepId}
              onChange={(e) => setTargetRepId(e.target.value)}
              className="w-full p-3 rounded-xl border border-slate-200 dark:border-dark-700 bg-slate-50 dark:bg-dark-800 text-xs font-bold outline-none"
            >
              <option value="">-- Choose Team Member --</option>
              {(employeesData || []).filter((r: any) => r && (r.user || r.firstName)).map((r: any) => {
                const u = r.user || r;
                return (
                  <option key={u._id || u.id} value={u._id || u.id}>
                    {u.firstName} {u.lastName} ({r.role || 'Sale Executive'} • {r.workload?.openLeads || 0} active)
                  </option>
                );
              })}
            </select>

            <div className="flex justify-end space-x-2 pt-3">
              <button
                onClick={() => setBulkAssignModal(false)}
                className="px-4 py-2 rounded-xl text-slate-600 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                disabled={!targetRepId || bulkAssignMutation.isPending}
                onClick={() => bulkAssignMutation.mutate()}
                className="px-5 py-2 rounded-xl bg-[linear-gradient(45deg,#ef4444_0%,#6366f1_50%,#2563eb_100%)] hover:opacity-95 text-white font-bold text-xs disabled:opacity-50 shadow-md shadow-red-500/20"
              >
                {bulkAssignMutation.isPending ? 'Assigning...' : 'Confirm Assignment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Schedule Follow-Up Modal */}
      {followUpModalLead && (
        <ScheduleFollowUpModal
          isOpen={!!followUpModalLead}
          lead={followUpModalLead}
          onClose={() => setFollowUpModalLead(null)}
        />
      )}

    </div>
  );
};
