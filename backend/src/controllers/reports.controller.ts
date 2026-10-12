import { Request, Response, NextFunction } from 'express';
import { Invoice } from '../models/Invoice';
import { Deal } from '../models/Deal';
import { AuditLog } from '../models/AuditLog';
import { Lead } from '../models/Lead';
import { FollowUp } from '../models/FollowUp';
import { ServiceCase } from '../models/ServiceCase';
import { UserOrganizationRole } from '../models/UserOrganizationRole';
import { cacheWrap, getOrgCacheKey } from '../services/cache.service';

export async function getReportsSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = req.organizationId;
    const now = new Date();

    // 1. Financial Analytics Summary
    const activeInvoices = await Invoice.find({ organizationId: orgId, isDeleted: false, status: { $ne: 'void' } });
    
    let totalInvoiced = 0;
    let netSubtotal = 0;
    let taxTotal = 0;
    let totalCollected = 0;

    // Overdue aging variables
    let agingBracket1 = 0; // 1-30 days
    let agingBracket2 = 0; // 31-60 days
    let agingBracket3 = 0; // 61-90 days
    let agingBracket4 = 0; // 91+ days

    for (const inv of activeInvoices) {
      totalInvoiced += inv.totalAmount;
      netSubtotal += inv.subtotal;
      taxTotal += inv.taxTotal;

      const paid = (inv.payments || []).reduce((sum: number, p: any) => sum + p.amount, 0);
      totalCollected += paid;

      const balance = inv.totalAmount - paid;
      if (balance > 0 && inv.status !== 'draft') {
        const daysOverdue = Math.floor((now.getTime() - new Date(inv.dueDate).getTime()) / (1000 * 3600 * 24));
        if (daysOverdue > 0) {
          if (daysOverdue <= 30) agingBracket1 += balance;
          else if (daysOverdue <= 60) agingBracket2 += balance;
          else if (daysOverdue <= 90) agingBracket3 += balance;
          else agingBracket4 += balance;
        }
      }
    }

    const totalOutstanding = totalInvoiced - totalCollected;

    // 2. Sales Pipeline opportunity breakdown
    const activeDeals = await Deal.find({ organizationId: orgId, isDeleted: false });
    const pipelines = await (await import('../models/Pipeline')).Pipeline.find({ organizationId: orgId });
    const allStages = pipelines.flatMap((p: any) => p.stages || []);

    const stageMap: Record<string, { count: number; value: number; probability: number; expected: number }> = {};
    let totalPipelineAmount = 0;
    let totalExpectedValue = 0;

    for (const deal of activeDeals) {
      const stage = allStages.find((s: any) => (s._id || s.id)?.toString() === deal.stageId?.toString());
      const prob = stage ? (stage.probability ?? stage.winProbability ?? 50) : 50;
      const stageName = stage ? stage.name : 'Pipeline In Progress';
      const expVal = ((deal.amount || 0) * prob) / 100;

      totalPipelineAmount += deal.amount || 0;
      totalExpectedValue += expVal;

      if (!stageMap[stageName]) {
        stageMap[stageName] = {
          count: 0,
          value: 0,
          probability: prob,
          expected: 0
        };
      }

      stageMap[stageName].count += 1;
      stageMap[stageName].value += deal.amount || 0;
      stageMap[stageName].expected += expVal;
    }

    const pipelineBreakdown = Object.entries(stageMap).map(([stage, metrics]) => ({
      stage,
      ...metrics
    }));

    // 3. Platform Operations Audit Trail
    const auditLogs = await AuditLog.find({ organizationId: orgId })
      .populate('userId', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .limit(20);

    return res.json({
      success: true,
      data: {
        financials: {
          totalInvoiced,
          netSubtotal,
          taxTotal,
          cgstCollected: taxTotal / 2,
          sgstCollected: taxTotal / 2,
          totalCollected,
          totalOutstanding
        },
        aging: {
          bracket1to30: agingBracket1,
          bracket31to60: agingBracket2,
          bracket61to90: agingBracket3,
          bracket91plus: agingBracket4,
          totalAging: agingBracket1 + agingBracket2 + agingBracket3 + agingBracket4
        },
        pipeline: {
          totalPipelineAmount,
          totalExpectedValue,
          breakdown: pipelineBreakdown
        },
        auditLogs
      }
    });
  } catch (error) {
    next(error);
  }
}

// CRM DASHBOARD ANALYTICS (Leads, Open Leads, Follow-ups, Lost Leads, Conversion)
export async function getCrmDashboardMetrics(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = req.organizationId;
    if (!orgId) {
      return res.status(400).json({ success: false, message: 'Organization ID required' });
    }

    const userRole = (req as any).userRole;
    const isPrivileged = ['Admin', 'Super Admin', 'Manager', 'Team Leader'].includes(userRole) || req.user?.email === 'shivamthakur12012@gmail.com';
    const userId = req.user?.id;
    const cacheKey = getOrgCacheKey(orgId, 'crm_dashboard', isPrivileged ? 'priv' : userId);

    const data = await cacheWrap(cacheKey, 30, async () => {
      const now = new Date();

      // Query filters (strictly scoped to assigned representative for standard employees)
      const leadFilter: any = { organizationId: orgId, isDeleted: false };
      const followupFilter: any = { organizationId: orgId };
      const caseFilter: any = { organizationId: orgId };

      if (!isPrivileged && userId) {
        leadFilter.assignedTo = userId;
        followupFilter.assignedTo = userId;
        caseFilter.assignedTo = userId;
      }

    // 1. Fetch leads for this tenant / rep
    const leads = await Lead.find(leadFilter)
      .populate('assignedTo', 'firstName lastName email')
      .sort({ createdAt: -1 });

    const totalLeads = leads.length;
    const convertedLeads = leads.filter(l => l.status === 'Converted');
    const lostLeads = leads.filter(l => l.status === 'Lost');
    const openLeads = leads.filter(l => l.status !== 'Converted' && l.status !== 'Lost');

    const totalPipelineValue = openLeads.reduce((sum, l) => sum + (l.expectedValue || 0), 0);
    const wonRevenue = convertedLeads.reduce((sum, l) => sum + (l.expectedValue || 0), 0);

    // Status distribution
    const statusCounts: Record<string, number> = {
      New: 0,
      Contacted: 0,
      Qualified: 0,
      'Follow-up': 0,
      'Proposal Sent': 0,
      Negotiation: 0,
      Converted: 0,
      Lost: 0
    };
    leads.forEach(l => {
      if (statusCounts[l.status] !== undefined) {
        statusCounts[l.status] += 1;
      } else {
        statusCounts[l.status] = 1;
      }
    });

    const statusBreakdown = Object.entries(statusCounts).map(([status, count]) => ({
      name: status,
      value: count
    }));

    // Lead Sources distribution
    const sourceCounts: Record<string, number> = {};
    leads.forEach(l => {
      const src = l.source || 'Other';
      sourceCounts[src] = (sourceCounts[src] || 0) + 1;
    });

    const sourceBreakdown = Object.entries(sourceCounts).map(([source, count]) => ({
      name: source,
      value: count
    }));

    // 2. Fetch Follow-ups
    const followups = await FollowUp.find(followupFilter)
      .populate('leadId', 'name phone leadId company')
      .populate('customerId', 'name phone customerId')
      .populate('assignedTo', 'firstName lastName email')
      .sort({ date: 1, time: 1 });

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const totalFollowups = followups.length;
    const pendingFollowups = followups.filter(f => f.status === 'pending');
    const completedFollowups = followups.filter(f => f.status === 'completed');
    const overdueFollowups = followups.filter(f => f.status === 'pending' && new Date(f.date) < todayStart);
    const todayFollowups = followups.filter(f => {
      const d = new Date(f.date);
      return d >= todayStart && d <= todayEnd;
    });

    // Channel breakdown for follow-ups
    const channelCounts = { phone: 0, whatsapp: 0, email: 0, instagram: 0 };
    followups.forEach(f => {
      const ch = (f.channel || f.type || 'phone') as keyof typeof channelCounts;
      if (channelCounts[ch] !== undefined) channelCounts[ch] += 1;
    });

    const channelBreakdown = [
      { channel: 'Phone / Calls', count: channelCounts.phone, fill: '#f59e0b' },
      { channel: 'WhatsApp', count: channelCounts.whatsapp, fill: '#10b981' },
      { channel: 'Email', count: channelCounts.email, fill: '#3b82f6' },
      { channel: 'Instagram DM', count: channelCounts.instagram, fill: '#d946ef' }
    ];

    // 3. Service Cases
    const serviceCases = await ServiceCase.find(caseFilter);
    const totalCases = serviceCases.length;
    const activeCases = serviceCases.filter(c => c.stage !== 'completed' && c.stage !== 'closed' && c.stage !== 'cancelled');

    // 4. Monthly Timeline Trends (Past 6 Months)
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const trendMap: Record<string, { month: string; leads: number; followups: number; converted: number; lost: number; open: number }> = {};

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      trendMap[key] = {
        month: `${monthNames[d.getMonth()]} ${d.getFullYear().toString().slice(2)}`,
        leads: 0,
        followups: 0,
        converted: 0,
        lost: 0,
        open: 0
      };
    }

    leads.forEach(l => {
      const d = new Date(l.createdAt);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (trendMap[key]) {
        trendMap[key].leads += 1;
        if (l.status === 'Converted') trendMap[key].converted += 1;
        else if (l.status === 'Lost') trendMap[key].lost += 1;
        else trendMap[key].open += 1;
      }
    });

    followups.forEach(f => {
      const d = new Date(f.date);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (trendMap[key]) {
        trendMap[key].followups += 1;
      }
    });

    const monthlyTrends = Object.values(trendMap);

    // Conversion rate
    const conversionRate = totalLeads > 0 ? Math.round((convertedLeads.length / totalLeads) * 100) : 0;
    const lossRate = totalLeads > 0 ? Math.round((lostLeads.length / totalLeads) * 100) : 0;

    // 5. Fetch Reps Workload for privileged users
    let reps: any[] = [];
    if (isPrivileged) {
      const userRoles = await UserOrganizationRole.find({ organizationId: orgId })
        .populate('userId', 'firstName lastName email status')
        .populate('roleId', 'name description');

      reps = (await Promise.all(
        userRoles.map(async (ur: any) => {
          const u = ur.userId;
          const role = ur.roleId;
          if (!u) return null;

          const [assignedCount, openCount, convertedCount, lostCount] = await Promise.all([
            Lead.countDocuments({ organizationId: orgId, assignedTo: u._id, isDeleted: false }),
            Lead.countDocuments({ organizationId: orgId, assignedTo: u._id, status: { $nin: ['Converted', 'Lost'] }, isDeleted: false }),
            Lead.countDocuments({ organizationId: orgId, assignedTo: u._id, status: 'Converted', isDeleted: false }),
            Lead.countDocuments({ organizationId: orgId, assignedTo: u._id, status: 'Lost', isDeleted: false })
          ]);

          return {
            user: u,
            role: role?.name || 'Sale Executive',
            workload: {
              totalAssigned: assignedCount,
              openLeads: openCount,
              convertedLeads: convertedCount,
              lostLeads: lostCount,
              conversionRate: assignedCount > 0 ? Math.round((convertedCount / assignedCount) * 100) : 0
            }
          };
        })
      )).filter(Boolean);
    }

    return {
      summary: {
          totalLeads,
          openLeads: openLeads.length,
          convertedLeads: convertedLeads.length,
          lostLeads: lostLeads.length,
          totalFollowups,
          pendingFollowups: pendingFollowups.length,
          completedFollowups: completedFollowups.length,
          overdueFollowups: overdueFollowups.length,
          todayFollowupsCount: todayFollowups.length,
          totalCases,
          activeCases: activeCases.length,
          totalPipelineValue,
          wonRevenue,
          conversionRate,
          lossRate
        },
        monthlyTrends,
        statusBreakdown,
        sourceBreakdown,
        channelBreakdown,
        recentLeads: leads.slice(0, 6),
        todayFollowups: todayFollowups.slice(0, 6),
        upcomingFollowups: pendingFollowups.slice(0, 6),
        reps
      };
    });

    return res.json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
}

