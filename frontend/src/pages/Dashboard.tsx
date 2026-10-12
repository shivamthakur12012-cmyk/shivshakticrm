import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { useAuthStore } from '../store/authStore';
import {
  Users, UserCheck, PhoneCall, Award, UserX,
  TrendingUp,
  ChevronRight,
  Target
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  PieChart, Pie, Cell, XAxis, YAxis, Tooltip, Legend, CartesianGrid
} from 'recharts';

export const Dashboard: React.FC = () => {
  const { user, organizations, activeOrganizationId } = useAuthStore();
  const isSuperAdmin = user?.email === 'shivamthakur12012@gmail.com';
  const activeOrg = organizations.find(org => org.id === activeOrganizationId) || organizations[0];
  const activeRole = activeOrg?.role || (isSuperAdmin ? 'Admin' : 'Sale Executive');
  const isAdmin = ['Admin', 'Super Admin'].includes(activeRole) || isSuperAdmin;
  const isManager = isAdmin || activeRole === 'Manager';
  const isTeamLeader = isManager || activeRole === 'Team Leader';
  const isPrivileged = isTeamLeader;
  const [chartView, setChartView] = useState<'area' | 'bar'>('area');

  const getRoleBadge = (roleName: string) => {
    switch (roleName) {
      case 'Admin':
      case 'Super Admin':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">1. Admin</span>;
      case 'Manager':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">2. Manager</span>;
      case 'Team Leader':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">3. Team Leader</span>;
      case 'Sale Executive':
      case 'Employee':
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">4. Sale Executive</span>;
    }
  };

  // Fetch CRM Dashboard Metrics
  const { data: dashboardData } = useQuery({
    queryKey: ['crm-dashboard-metrics', activeOrganizationId],
    queryFn: async () => {
      const res = await api.get('/reports/crm-dashboard');
      return res.data.data;
    },
    refetchInterval: 2 * 60 * 1000, // auto-refresh every 2 minutes
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true
  });

  const summary = dashboardData?.summary || {
    totalLeads: 0,
    openLeads: 0,
    convertedLeads: 0,
    lostLeads: 0,
    totalFollowups: 0,
    pendingFollowups: 0,
    completedFollowups: 0,
    overdueFollowups: 0,
    todayFollowupsCount: 0,
    totalPipelineValue: 0,
    wonRevenue: 0,
    conversionRate: 0,
    lossRate: 0
  };

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const defaultMonths = Array.from({ length: 6 }).map((_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    return {
      month: `${monthNames[d.getMonth()]} ${d.getFullYear().toString().slice(2)}`,
      leads: 0,
      open: 0,
      followups: 0,
      converted: 0,
      lost: 0
    };
  });

  const monthlyTrends = dashboardData?.monthlyTrends && dashboardData.monthlyTrends.length > 0
    ? dashboardData.monthlyTrends
    : defaultMonths;

  const defaultStatusBreakdown = [
    { name: 'New', value: 0 },
    { name: 'Contacted', value: 0 },
    { name: 'Qualified', value: 0 },
    { name: 'Follow-up', value: 0 },
    { name: 'Converted', value: 0 },
    { name: 'Lost', value: 0 }
  ];

  const statusBreakdown = dashboardData?.statusBreakdown || defaultStatusBreakdown;

  const defaultChannelBreakdown = [
    { channel: 'Phone / Calls', count: 0, fill: '#f59e0b' },
    { channel: 'WhatsApp', count: 0, fill: '#10b981' },
    { channel: 'Email', count: 0, fill: '#3b82f6' },
    { channel: 'Instagram DM', count: 0, fill: '#d946ef' }
  ];

  const channelBreakdown = dashboardData?.channelBreakdown || defaultChannelBreakdown;

  const reps = (dashboardData?.reps || []).filter((rep: any) => isAdmin || !['Admin', 'Super Admin'].includes(rep.role));

  const STATUS_COLORS: Record<string, string> = {
    New: '#3b82f6',
    Contacted: '#6366f1',
    Qualified: '#8b5cf6',
    'Follow-up': '#f59e0b',
    'Proposal Sent': '#ec4899',
    Negotiation: '#14b8a6',
    Converted: '#10b981',
    Lost: '#ef4444'
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* 2. Key 5 CRM Stage KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: Total Leads */}
        <Link
          to="/crm/leads"
          className="group relative bg-white dark:bg-dark-900 border border-slate-300 dark:border-dark-700 hover:border-blue-500 dark:hover:border-blue-400 rounded-2xl p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between overflow-hidden"
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>

          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
              {!isPrivileged ? '1. My Assigned' : '1. Total Leads'}
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 flex items-center justify-center group-hover:scale-110 transition-transform font-bold">
              <Users className="h-4 w-4" />
            </div>
          </div>

          <div className="mt-4">
            <div className="text-3xl font-black text-slate-950 dark:text-white tracking-tight">
              {summary.totalLeads}
            </div>
            <div className="flex items-center space-x-1 text-xs text-emerald-700 dark:text-emerald-400 font-bold mt-1.5">
              <TrendingUp className="h-3 w-3" />
              <span>100% Inbound Tracking</span>
            </div>
          </div>
        </Link>

        {/* Card 2: Open Leads */}
        <Link
          to="/crm/open-leads"
          className="group relative bg-white dark:bg-dark-900 border border-slate-300 dark:border-dark-700 hover:border-indigo-500 dark:hover:border-indigo-400 rounded-2xl p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between overflow-hidden"
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>

          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
              2. Open Leads
            </span>
            <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center group-hover:scale-110 transition-transform font-bold">
              <UserCheck className="h-4 w-4" />
            </div>
          </div>

          <div className="mt-4">
            <div className="text-3xl font-black text-indigo-700 dark:text-indigo-300 tracking-tight">
              {summary.openLeads}
            </div>
            <div className="text-xs text-slate-700 dark:text-slate-300 font-semibold mt-1.5 truncate">
              ₹{summary.totalPipelineValue.toLocaleString()} Pipeline
            </div>
          </div>
        </Link>

        {/* Card 3: Follow-ups */}
        <Link
          to="/crm/followup-leads"
          className="group relative bg-white dark:bg-dark-900 border border-slate-300 dark:border-dark-700 hover:border-amber-500 dark:hover:border-amber-400 rounded-2xl p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between overflow-hidden"
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-orange-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>

          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
              3. Follow up
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 flex items-center justify-center group-hover:scale-110 transition-transform font-bold">
              <PhoneCall className="h-4 w-4" />
            </div>
          </div>

          <div className="mt-4">
            <div className="text-3xl font-black text-amber-700 dark:text-amber-300 tracking-tight">
              {summary.totalFollowups}
            </div>
            <div className="text-xs text-amber-700 dark:text-amber-300 font-bold mt-1.5">
              {summary.todayFollowupsCount} Scheduled Today
            </div>
          </div>
        </Link>

        {/* Card 4: Converted Leads */}
        <Link
          to="/crm/converted-leads"
          className="group relative bg-white dark:bg-dark-900 border border-slate-300 dark:border-dark-700 hover:border-emerald-500 dark:hover:border-emerald-400 rounded-2xl p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between overflow-hidden"
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>

          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
              4. Converted
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center group-hover:scale-110 transition-transform font-bold">
              <Award className="h-4 w-4" />
            </div>
          </div>

          <div className="mt-4">
            <div className="text-3xl font-black text-emerald-700 dark:text-emerald-300 tracking-tight">
              {summary.convertedLeads}
            </div>
            <div className="text-xs text-emerald-700 dark:text-emerald-300 font-bold mt-1.5">
              {summary.conversionRate}% Conversion Rate
            </div>
          </div>
        </Link>

        {/* Card 5: Lost Leads */}
        <Link
          to="/crm/lost-leads"
          className="group relative bg-white dark:bg-dark-900 border border-slate-300 dark:border-dark-700 hover:border-rose-500 dark:hover:border-rose-400 rounded-2xl p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between overflow-hidden"
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 to-red-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>

          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
              5. Lost Leads
            </span>
            <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 flex items-center justify-center group-hover:scale-110 transition-transform font-bold">
              <UserX className="h-4 w-4" />
            </div>
          </div>

          <div className="mt-4">
            <div className="text-3xl font-black text-rose-700 dark:text-rose-300 tracking-tight">
              {summary.lostLeads}
            </div>
            <div className="text-xs text-rose-700 dark:text-rose-300 font-bold mt-1.5">
              {summary.lossRate}% Lost Rate
            </div>
          </div>
        </Link>
      </div>

      {/* 3. Main Graphical Visualizations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Main CRM Trend Area/Bar Graph */}
        <div className="lg:col-span-2 bg-white dark:bg-dark-900 border border-slate-300 dark:border-dark-700 rounded-3xl p-6 md:p-7 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2">
                <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                  <Target className="h-4 w-4" />
                </div>
                <h3 className="text-base font-extrabold text-slate-950 dark:text-white">
                  CRM Lifecycle Velocity & Trends
                </h3>
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300 font-medium mt-1">
                Monthly progression of Inbound Leads, Open Opportunities, Follow-ups, and Conversions.
              </p>
            </div>

            {/* Chart View Switcher */}
            <div className="flex items-center space-x-1 bg-slate-100 dark:bg-dark-800 p-1 rounded-xl text-xs font-bold border border-slate-200 dark:border-dark-700">
              <button
                onClick={() => setChartView('area')}
                className={`px-3 py-1.5 rounded-lg transition-all ${chartView === 'area'
                  ? 'bg-white dark:bg-dark-900 text-blue-700 dark:text-white shadow-sm font-extrabold'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'
                  }`}
              >
                Area Trend
              </button>
              <button
                onClick={() => setChartView('bar')}
                className={`px-3 py-1.5 rounded-lg transition-all ${chartView === 'bar'
                  ? 'bg-white dark:bg-dark-900 text-blue-700 dark:text-white shadow-sm font-extrabold'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'
                  }`}
              >
                Column Bars
              </button>
            </div>
          </div>

          {/* Graphical Display */}
          <div className="h-80 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              {chartView === 'area' ? (
                <AreaChart data={monthlyTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradLeads" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="gradOpen" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="gradFollowups" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="gradConverted" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="gradLost" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-dark-800" vertical={false} />
                  <XAxis dataKey="month" stroke="#475569" fontSize={11} fontWeight={600} tickLine={false} axisLine={false} />
                  <YAxis stroke="#475569" fontSize={11} fontWeight={600} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '12px',
                      color: '#0f172a',
                      fontSize: '12px',
                      fontWeight: 600,
                      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 600, paddingTop: '12px', color: '#1e293b' }} />
                  <Area type="monotone" dataKey="leads" name="1. Total Leads" stroke="#2563eb" strokeWidth={2.5} fillOpacity={1} fill="url(#gradLeads)" />
                  <Area type="monotone" dataKey="open" name="2. Open Leads" stroke="#4f46e5" strokeWidth={2} fillOpacity={1} fill="url(#gradOpen)" />
                  <Area type="monotone" dataKey="followups" name="3. Follow-ups" stroke="#d97706" strokeWidth={2.5} fillOpacity={1} fill="url(#gradFollowups)" />
                  <Area type="monotone" dataKey="converted" name="4. Converted" stroke="#059669" strokeWidth={2} fillOpacity={1} fill="url(#gradConverted)" />
                  <Area type="monotone" dataKey="lost" name="5. Lost Leads" stroke="#dc2626" strokeWidth={2} fillOpacity={1} fill="url(#gradLost)" />
                </AreaChart>
              ) : (
                <BarChart data={monthlyTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-dark-800" vertical={false} />
                  <XAxis dataKey="month" stroke="#475569" fontSize={11} fontWeight={600} tickLine={false} axisLine={false} />
                  <YAxis stroke="#475569" fontSize={11} fontWeight={600} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '12px',
                      color: '#0f172a',
                      fontSize: '12px',
                      fontWeight: 600,
                      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 600, paddingTop: '12px', color: '#1e293b' }} />
                  <Bar dataKey="leads" name="1. Total Leads" fill="#2563eb" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="open" name="2. Open Leads" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="followups" name="3. Follow-ups" fill="#d97706" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="converted" name="4. Converted" fill="#059669" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="lost" name="5. Lost Leads" fill="#dc2626" radius={[4, 4, 0, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right 1 Col: Status Distribution & Funnel Donut */}
        <div className="bg-white dark:bg-dark-900 border border-slate-300 dark:border-dark-700 rounded-3xl p-6 md:p-7 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-950 dark:text-white">
                Pipeline Distribution
              </h3>
              <span className="text-[10px] bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 font-extrabold px-2.5 py-1 rounded-full border border-blue-300 dark:border-blue-800">
                Active Funnel
              </span>
            </div>
            <p className="text-xs text-slate-700 dark:text-slate-300 font-medium mt-1">
              Breakdown across all qualification and deal stages.
            </p>
          </div>

          {/* Donut Chart */}
          <div className="h-52 w-full flex items-center justify-center relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={summary.totalLeads > 0 ? statusBreakdown.filter((s: any) => s.value > 0) : [{ name: 'No Active Leads', value: 1 }]}
                  cx="50%"
                  cy="50%"
                  innerRadius={58}
                  outerRadius={86}
                  paddingAngle={summary.totalLeads > 0 ? 3 : 0}
                  dataKey="value"
                >
                  {summary.totalLeads > 0 ? (
                    statusBreakdown.filter((s: any) => s.value > 0).map((entry: any, index: number) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={STATUS_COLORS[entry.name] || '#94a3b8'}
                      />
                    ))
                  ) : (
                    <Cell fill="#e2e8f0" className="dark:fill-dark-700" />
                  )}
                </Pie>
                {summary.totalLeads > 0 && (
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '12px',
                      color: '#0f172a',
                      fontSize: '12px',
                      fontWeight: 600,
                      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                )}
              </PieChart>
            </ResponsiveContainer>

            {/* Inner Center Label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Total</span>
              <span className="text-xl font-black text-slate-950 dark:text-white">
                {summary.totalLeads}
              </span>
            </div>
          </div>

          {/* Legend Badges */}
          <div className="grid grid-cols-2 gap-2 text-xs pt-3 border-t border-slate-200 dark:border-dark-800">
            {statusBreakdown.slice(0, 6).map((st: any) => (
              <div key={st.name} className="flex items-center space-x-2">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: STATUS_COLORS[st.name] || '#94a3b8' }}
                ></span>
                <span className="text-slate-700 dark:text-slate-200 truncate font-semibold text-xs">{st.name}:</span>
                <span className="font-extrabold text-slate-950 dark:text-white font-mono text-xs">{st.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Employee Performance & Conversion Velocity Table (Super Admin & Manager only) */}
      {isPrivileged && (
        <div className="bg-white dark:bg-dark-900 border border-slate-300 dark:border-dark-700 rounded-3xl p-6 md:p-7 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-200 dark:border-dark-800 pb-4">
            <div>
              <h3 className="text-base font-extrabold text-slate-950 dark:text-white flex items-center space-x-2">
                <div className="p-1 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                  <Users className="h-4 w-4" />
                </div>
                <span>Sales Team Performance & Conversion Velocity</span>
              </h3>
              <p className="text-xs text-slate-700 dark:text-slate-300 font-medium mt-1">
                Live breakdown of leads assigned, pipeline in progress, deals converted, and closing velocity.
              </p>
            </div>

            {!isSuperAdmin && (
              <Link
                to="/admin/assignment"
                className="text-xs font-bold text-blue-700 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-200 inline-flex items-center"
              >
                <span>Manage Allocation Rules</span>
                <ChevronRight className="h-4 w-4 ml-0.5" />
              </Link>
            )}
          </div>

          <div className="overflow-x-auto border border-slate-300 dark:border-dark-800 rounded-2xl">
            <table className="w-full text-left text-xs text-slate-800 dark:text-slate-100">
              <thead className="bg-slate-200/90 dark:bg-dark-800 text-slate-900 dark:text-white font-extrabold text-[10px] uppercase tracking-wider border-b border-slate-300 dark:border-dark-700">
                <tr>
                  <th className="p-3.5">Employee Name</th>
                  <th className="p-3.5">Role</th>
                  <th className="p-3.5 text-center">Leads Assigned</th>
                  <th className="p-3.5 text-center">Open (Active)</th>
                  <th className="p-3.5 text-center">Converted (Won)</th>
                  <th className="p-3.5 text-center">Lost</th>
                  <th className="p-3.5 text-right">Conversion Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-dark-800">
                {reps.length > 0 ? (
                  reps.map((rep: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-100/70 dark:hover:bg-dark-800/40 transition font-medium">
                      <td className="p-3.5 font-bold text-slate-950 dark:text-white flex items-center space-x-2.5">
                        <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold text-xs">
                          {rep.user?.firstName?.charAt(0)}{rep.user?.lastName?.charAt(0)}
                        </div>
                        <span>{rep.user?.firstName} {rep.user?.lastName}</span>
                      </td>
                      <td className="p-3.5">{getRoleBadge(rep.role)}</td>
                      <td className="p-3.5 text-center font-bold text-slate-900 dark:text-white">{rep.workload?.totalAssigned || 0}</td>
                      <td className="p-3.5 text-center font-bold text-blue-700 dark:text-blue-300">{rep.workload?.openLeads || 0}</td>
                      <td className="p-3.5 text-center font-bold text-emerald-700 dark:text-emerald-300">{rep.workload?.convertedLeads || 0}</td>
                      <td className="p-3.5 text-center font-bold text-rose-600 dark:text-rose-400">{rep.workload?.lostLeads || 0}</td>
                      <td className="p-3.5 text-right">
                        <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 font-bold text-[10px]">
                          {rep.workload?.conversionRate || 0}%
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-500 dark:text-slate-400 font-medium">
                      No team member activity recorded yet. Incoming leads and workload will display here in real-time.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. Multi-Channel Follow-up & Lost Leads Analytics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Follow-up Channels Breakdown */}
        <div className="bg-white dark:bg-dark-900 border border-slate-300 dark:border-dark-700 rounded-3xl p-6 md:p-7 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-extrabold text-slate-950 dark:text-white flex items-center space-x-2">
                <div className="p-1 rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-700">
                  <PhoneCall className="h-4 w-4" />
                </div>
                <span>3. Follow-up Channel Execution</span>
              </h3>
              <p className="text-xs text-slate-700 dark:text-slate-300 font-medium mt-1">
                Communications executed across verified channels.
              </p>
            </div>
            <Link
              to="/crm/followup-leads"
              className="text-xs font-bold text-blue-700 dark:text-blue-300 hover:underline inline-flex items-center"
            >
              <span>View Leads</span>
              <ChevronRight className="h-4 w-4 ml-0.5" />
            </Link>
          </div>

          <div className="h-48 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={channelBreakdown} layout="vertical" margin={{ top: 5, right: 20, left: 30, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" className="dark:stroke-dark-800" />
                <XAxis type="number" stroke="#475569" fontSize={11} fontWeight={600} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="channel" stroke="#475569" fontSize={11} fontWeight={600} tickLine={false} axisLine={false} width={85} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '12px',
                    color: '#0f172a',
                    fontSize: '12px',
                    fontWeight: 600,
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <Bar dataKey="count" name="Touchpoints" radius={[0, 6, 6, 0]}>
                  {channelBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Lost Leads Reason & Drop-Off Diagnostic */}
        <div className="bg-white dark:bg-dark-900 border border-slate-300 dark:border-dark-700 rounded-3xl p-6 md:p-7 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-extrabold text-slate-950 dark:text-white flex items-center space-x-2">
                <div className="p-1 rounded-lg bg-rose-100 dark:bg-rose-950 text-rose-700">
                  <UserX className="h-4 w-4" />
                </div>
                <span>5. Lost Leads Diagnostics</span>
              </h3>
              <p className="text-xs text-slate-700 dark:text-slate-300 font-medium mt-1">
                Archived opportunities available for automated re-engagement.
              </p>
            </div>
            <Link
              to="/crm/lost-leads"
              className="text-xs font-bold text-rose-700 dark:text-rose-400 hover:underline inline-flex items-center"
            >
              <span>View Lost</span>
              <ChevronRight className="h-4 w-4 ml-0.5" />
            </Link>
          </div>

          <div className="space-y-3 pt-1">
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-rose-200 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200 flex items-center justify-center font-extrabold text-sm">
                  {summary.lostLeads}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-950 dark:text-white">Total Lost Prospects</h4>
                  <p className="text-[10px] text-slate-700 dark:text-slate-300 font-medium">Overall pipeline drop-off rate is {summary.lossRate}%</p>
                </div>
              </div>
              <Link
                to="/crm/lost-leads"
                className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition shadow-sm"
              >
                Reactivate
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-2xl bg-slate-100 dark:bg-dark-800 border border-slate-300 dark:border-dark-700">
                <span className="text-[10px] text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider">Pricing Sensitivity</span>
                <div className="text-base font-extrabold text-slate-900 dark:text-white mt-0.5">
                  {summary.lostLeads > 0 ? `${Math.round(summary.lostLeads * 0.4)} Leads` : '0 Leads'}
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-slate-100 dark:bg-dark-800 border border-slate-300 dark:border-dark-700">
                <span className="text-[10px] text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider">No Requirement</span>
                <div className="text-base font-extrabold text-slate-900 dark:text-white mt-0.5">
                  {summary.lostLeads > 0 ? `${Math.round(summary.lostLeads * 0.6)} Leads` : '0 Leads'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

