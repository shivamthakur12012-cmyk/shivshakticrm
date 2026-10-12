import { Request, Response, NextFunction } from 'express';
import { Lead, mongoose } from '../models';
import { Customer } from '../models/Customer';
import { Contact } from '../models/Contact';
import { Activity } from '../models/Activity';
import { Quotation } from '../models/Quotation';
import { FollowUp } from '../models/FollowUp';
import { AssignmentLog } from '../models/AssignmentLog';
import { LeadImportLog } from '../models/LeadImportLog';
import { UserOrganizationRole } from '../models/UserOrganizationRole';
import { Role } from '../models/Role';
import { User } from '../models/User';
import { AuditLog } from '../models/AuditLog';
import { WorkflowService } from '../services/workflow.service';
import prisma from '../config/prisma';
import logger from '../utils/logger';
import { cacheGet, cacheSet, invalidateOrgCache, getOrgCacheKey, cacheDel } from '../services/cache.service';

// Phone number validator regex (10-15 digits, optional + prefix)
const PHONE_REGEX = /^\+?[0-9\s\-()]{10,18}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Concurrency lock for lead creation (prevents race-condition duplicate submissions)
const leadCreationLocks = new Map<string, number>();

export function acquireLeadLock(key: string): boolean {
  const now = Date.now();
  const lockedAt = leadCreationLocks.get(key);
  if (lockedAt && now - lockedAt < 5000) {
    return false;
  }
  leadCreationLocks.set(key, now);
  return true;
}

export function releaseLeadLock(key: string) {
  leadCreationLocks.delete(key);
}

// Redis-backed tenant counts cache with automatic fallback
export function invalidateLeadCountsCache(orgId?: string) {
  if (orgId) {
    invalidateOrgCache(orgId, 'leads:counts').catch(() => {});
  } else {
    cacheDel('cache:org:*:leads:counts*').catch(() => {});
  }
}

// Helper: Automatic Round Robin Lead Assignment (4-Level Hierarchy)
export async function assignLeadRoundRobin(organizationId: string): Promise<string | undefined> {
  try {
    const salesRoles = await Role.find({ 
      name: { $in: ['Admin', 'Super Admin', 'Manager', 'Team Leader', 'Sale Executive', 'Sales Executive', 'Employee'] }, 
      organizationId: null 
    });
    const roleIds = salesRoles.map(r => r._id);

    const teamMembers = await UserOrganizationRole.find({
      organizationId,
      roleId: { $in: roleIds }
    }).populate('userId', 'status');

    const activeRepIds = teamMembers
      .filter((tm: any) => tm.userId && tm.userId.status === 'active')
      .map((tm: any) => tm.userId._id.toString())
      .sort();

    if (activeRepIds.length === 0) return undefined;

    const lastAssignedLead = await Lead.findOne({
      organizationId,
      assignedTo: { $exists: true, $ne: null },
      isDeleted: false
    }).sort({ createdAt: -1 });

    if (!lastAssignedLead || !lastAssignedLead.assignedTo) {
      return activeRepIds[0];
    }

    const lastRepId = lastAssignedLead.assignedTo.toString();
    const lastIndex = activeRepIds.indexOf(lastRepId);
    const nextIndex = (lastIndex + 1) % activeRepIds.length;
    return activeRepIds[nextIndex];
  } catch (err) {
    logger.error('Round-robin assignment error:', err);
    return undefined;
  }
}

// 1. GET ALL LEADS (Paginated, Search, 4 Sub-Tabs, Unassigned filter, Role-based)
export async function getLeads(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = req.organizationId;
    const { 
      status, 
      priority, 
      source, 
      assignedTo, 
      search, 
      page = 1, 
      limit = 25, 
      unassignedOnly,
      myLeadsOnly,
      todayOnly,
      subStage,
      channel
    } = req.query;

    const query: any = { organizationId: orgId, isDeleted: false };

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);

    const tomorrowEnd = new Date(todayEnd);
    tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);

    const isTodayMode = todayOnly === 'true' || String(status).toLowerCase() === 'today' || String(status).toLowerCase() === 'today_assigned' || String(status).toLowerCase() === 'new';

    // Sub-tab status filter
    if (status && !isTodayMode) {
      const s = String(status).toLowerCase();
      if (s === 'open') {
        if (subStage === 'qualified') query.status = 'Qualified';
        else if (subStage === 'proposal_sent') query.status = 'Proposal Sent';
        else if (subStage === 'negotiation') query.status = 'Negotiation';
        else if (subStage === 'in_progress') query.status = { $in: ['Open', 'Contacted'] };
        else query.status = { $in: ['Open', 'Contacted', 'Qualified', 'Proposal Sent', 'Negotiation'] };
      } else if (s === 'new') {
        query.status = 'New';
      } else if (s === 'followup' || s === 'follow-up' || s === 'follow_up') {
        query.status = { $in: ['Follow-up', 'Follow-Up', 'Followup'] };
        if (subStage === 'today') {
          query.nextFollowUp = { $lte: todayEnd, $ne: null };
        } else if (subStage === 'tomorrow') {
          query.nextFollowUp = { $gte: tomorrowStart, $lte: tomorrowEnd };
        } else if (subStage === 'upcoming') {
          query.nextFollowUp = { $gt: tomorrowEnd };
        } else if (subStage === 'overdue') {
          query.nextFollowUp = { $lt: todayStart };
        } else if (subStage === 'unscheduled') {
          query.nextFollowUp = { $in: [null, undefined] };
        }
      } else if (s === 'converted') {
        query.status = 'Converted';
        if (subStage === 'quotation') query.convertedQuotationId = { $exists: true, $ne: null };
        else if (subStage === 'invoice') query.convertedInvoiceId = { $exists: true, $ne: null };
      } else if (s === 'lost') {
        query.status = 'Lost';
        if (subStage === 'pricing') query.lostReason = { $regex: 'price|cost|budget|expensive', $options: 'i' };
        else if (subStage === 'no_requirement') query.lostReason = { $regex: 'requirement|need|not interested|no need', $options: 'i' };
        else if (subStage === 'competitor') query.lostReason = { $regex: 'competitor|alternative|vendor', $options: 'i' };
      } else if (s === 'all') {
        if (subStage === 'assigned') query.assignedTo = { $exists: true, $ne: null };
        else if (subStage === 'unassigned') query.assignedTo = { $in: [null, undefined] };
        else if (subStage === 'high_priority') query.priority = { $in: ['high', 'urgent', 'High', 'Urgent'] };
      } else {
        query.status = status;
      }
    }

    // Role-based scoping (4-Level Hierarchy)
    const userRole = (req as any).userRole;
    const isPrivileged = ['Super Admin', 'Admin', 'Manager', 'Team Leader'].includes(userRole) || req.user?.email === 'shivamthakur12012@gmail.com';

    if (!isPrivileged) {
      query.assignedTo = req.user?.id;
      if (unassignedOnly === 'true' || subStage === 'unassigned') {
        query.assignedTo = '__unauthorized_unassigned__';
      }
    } else if (myLeadsOnly === 'true') {
      query.assignedTo = req.user?.id;
    }

    // Filter by assigned employee
    if (assignedTo && isPrivileged) {
      query.assignedTo = assignedTo;
    }

    // Today / New Leads filter
    if (isTodayMode) {
      const todayLogs = await AssignmentLog.find({
        organizationId: orgId,
        createdAt: { $gte: todayStart, $lte: todayEnd },
        ...(!isPrivileged ? { toUserId: req.user?.id } : (assignedTo ? { toUserId: assignedTo } : {}))
      });
      const assignedLeadIds = todayLogs.map(l => l.leadId).filter(Boolean);
      
      query.$or = [
        { createdAt: { $gte: todayStart, $lte: todayEnd } },
        { _id: { $in: assignedLeadIds } }
      ];

      // New Leads sub-stage: assigned vs unassigned
      if (subStage === 'assigned') {
        query.assignedTo = { $exists: true, $ne: null };
      } else if (subStage === 'unassigned') {
        query.assignedTo = { $in: [null, undefined] };
      }
    }

    // Specific Channel filtering if explicitly passed
    const activeChannel = channel;
    if (activeChannel) {
      const ch = String(activeChannel).toLowerCase();
      let targetChannels: string[] = [];
      if (ch === 'whatsapp') targetChannels = ['whatsapp'];
      else if (ch === 'email') targetChannels = ['email'];
      else if (ch === 'calls' || ch === 'call' || ch === 'phone') targetChannels = ['phone', 'call'];
      else if (ch === 'meeting' || ch === 'meeting_scheduled') targetChannels = ['meeting'];

      if (targetChannels.length > 0) {
        const matchingFollowUps = await prisma.followUp.findMany({
          where: {
            organizationId: orgId,
            channel: { in: targetChannels },
            ...(!isPrivileged ? { assignedTo: req.user?.id } : {})
          },
          select: { leadId: true }
        });
        const matchedLeadIds = matchingFollowUps.map(f => f.leadId).filter(Boolean) as string[];

        // Fallback matching: also check lead contact fields
        const leadOrFilters: any[] = [{ _id: { $in: matchedLeadIds } }];
        if (ch === 'whatsapp') leadOrFilters.push({ whatsApp: { $exists: true, $ne: null } });
        if (ch === 'email') leadOrFilters.push({ email: { $exists: true, $ne: null } });
        if (ch === 'calls' || ch === 'call' || ch === 'phone') leadOrFilters.push({ phone: { $exists: true, $ne: null } });

        if (query.$or) {
          query.$and = [{ $or: query.$or }, { $or: leadOrFilters }];
          delete query.$or;
        } else {
          query.$or = leadOrFilters;
        }
      }
    }

    // Unassigned filter
    if (unassignedOnly === 'true') {
      query.assignedTo = { $in: [null, undefined] };
    }

    // Priority and Source filters
    if (priority) query.priority = priority;
    if (source) query.source = source;

    // Search query: phone (primary), name, company, email, leadId
    if (search) {
      const regex = new RegExp(search as string, 'i');
      const searchOr = [
        { phone: regex },
        { name: regex },
        { company: regex },
        { email: regex },
        { leadId: regex }
      ];
      if (query.$or) {
        query.$and = [{ $or: query.$or }, { $or: searchOr }];
        delete query.$or;
      } else {
        query.$or = searchOr;
      }
    }

    const pageSize = Math.min(Math.max(Number(limit) || 25, 1), 100);
    const skipIndex = (Number(page) - 1) * pageSize;

    const baseCountFilter: any = { organizationId: orgId, isDeleted: false };
    if (!isPrivileged) {
      baseCountFilter.assignedTo = req.user?.id;
    }

    const todayLogsForCount = await AssignmentLog.find({
      organizationId: orgId,
      createdAt: { $gte: todayStart, $lte: todayEnd },
      ...(!isPrivileged ? { toUserId: req.user?.id } : {})
    });
    const todayAssignedIds = todayLogsForCount.map(l => l.leadId).filter(Boolean);
    const todayCountFilter: any = {
      organizationId: orgId,
      isDeleted: false,
      ...(!isPrivileged ? { assignedTo: req.user?.id } : {}),
      $or: [
        { createdAt: { $gte: todayStart, $lte: todayEnd } },
        { _id: { $in: todayAssignedIds } }
      ]
    };

    const followupBaseFilter: any = {
      ...baseCountFilter,
      status: { $in: ['Follow-up', 'Follow-Up', 'Followup'] }
    };

    const cacheKey = getOrgCacheKey(orgId, 'leads:counts', isPrivileged ? 'priv' : req.user?.id);
    const cachedCounts = await cacheGet<{ counts: any; subCounts: any }>(cacheKey);

    // Primary pagination query (always fetches fresh list data)
    const [leads, total] = await Promise.all([
      Lead.find(query)
        .populate('assignedTo', 'firstName lastName email')
        .populate('convertedQuotationId', 'quotationId totalAmount status')
        .populate('convertedInvoiceId', 'invoiceId totalAmount status outstandingBalance')
        .sort({ createdAt: -1 })
        .skip(skipIndex)
        .limit(pageSize),
      Lead.countDocuments(query)
    ]);

    let counts: any;
    let subCounts: any;

    if (cachedCounts) {
      counts = cachedCounts.counts;
      subCounts = cachedCounts.subCounts;
    } else {
      // Parallel execution of count aggregations when cache expired
      const [
        statusGroups,
        unassignedCount,
        todayCount,
        todayAssignedCount,
        followupTodayCount,
        followupTomorrowCount,
        followupUpcomingCount,
        followupOverdueCount,
        followupUnscheduledCount,
        convertedQuotationCount,
        convertedInvoiceCount,
        allAssignedCount,
        allHighPriorityCount
      ] = await Promise.all([
        prisma.lead.groupBy({
          by: ['status'],
          where: baseCountFilter,
          _count: { _all: true }
        }),
        isPrivileged 
          ? prisma.lead.count({ where: { organizationId: orgId, isDeleted: false, assignedTo: null } })
          : Promise.resolve(0),
        Lead.countDocuments(todayCountFilter),
        Lead.countDocuments({
          ...todayCountFilter,
          assignedTo: { $exists: true, $ne: null }
        }),
        Lead.countDocuments({
          ...followupBaseFilter,
          nextFollowUp: { $lte: todayEnd, $ne: null }
        }),
        Lead.countDocuments({
          ...followupBaseFilter,
          nextFollowUp: { $gte: tomorrowStart, $lte: tomorrowEnd }
        }),
        Lead.countDocuments({
          ...followupBaseFilter,
          nextFollowUp: { $gt: tomorrowEnd }
        }),
        Lead.countDocuments({
          ...followupBaseFilter,
          nextFollowUp: { $lt: todayStart }
        }),
        Lead.countDocuments({
          ...followupBaseFilter,
          nextFollowUp: { $in: [null, undefined] }
        }),
        Lead.countDocuments({
          ...baseCountFilter,
          status: 'Converted',
          convertedQuotationId: { $exists: true, $ne: null }
        }),
        Lead.countDocuments({
          ...baseCountFilter,
          status: 'Converted',
          convertedInvoiceId: { $exists: true, $ne: null }
        }),
        Lead.countDocuments({
          ...baseCountFilter,
          assignedTo: { $exists: true, $ne: null }
        }),
        Lead.countDocuments({
          ...baseCountFilter,
          priority: { $in: ['high', 'urgent', 'High', 'Urgent'] }
        })
      ]);

      let allCount = 0;
      let openCount = 0;
      let followupCount = 0;
      let convertedCount = 0;
      let lostCount = 0;

      for (const g of (statusGroups || [])) {
        const count = g._count?._all || 0;
        allCount += count;
        if (['Open', 'Contacted', 'Qualified', 'Proposal Sent', 'Negotiation'].includes(g.status)) openCount += count;
        else if (['Follow-up', 'Follow-Up', 'Followup'].includes(g.status)) followupCount += count;
        else if (g.status === 'Converted') convertedCount += count;
        else if (g.status === 'Lost') lostCount += count;
      }

      const todayUnassignedCount = Math.max(0, todayCount - todayAssignedCount);

      subCounts = {
        today: {
          all: todayCount,
          assigned: todayAssignedCount,
          unassigned: todayUnassignedCount
        },
        followup: {
          all: followupCount,
          today: followupTodayCount,
          tomorrow: followupTomorrowCount,
          upcoming: followupUpcomingCount,
          overdue: followupOverdueCount,
          unscheduled: followupUnscheduledCount
        },
        open: {
          all: openCount,
          in_progress: (statusGroups || []).filter(g => ['Open', 'Contacted'].includes(g.status)).reduce((acc, g) => acc + (g._count?._all || 0), 0),
          qualified: statusGroups.find(g => g.status === 'Qualified')?._count?._all || 0,
          proposal_sent: statusGroups.find(g => g.status === 'Proposal Sent')?._count?._all || 0,
          negotiation: statusGroups.find(g => g.status === 'Negotiation')?._count?._all || 0
        },
        converted: {
          all: convertedCount,
          quotation: convertedQuotationCount,
          invoice: convertedInvoiceCount
        },
        lost: {
          all: lostCount,
          pricing: 0,
          no_requirement: 0,
          competitor: 0,
          other: 0
        },
        all: {
          all: allCount,
          assigned: allAssignedCount,
          unassigned: unassignedCount,
          high_priority: allHighPriorityCount
        }
      };

      counts = {
        all: allCount,
        today: todayCount,
        open: openCount,
        followup: followupCount,
        converted: convertedCount,
        lost: lostCount,
        unassigned: unassignedCount
      };

      await cacheSet(cacheKey, { counts, subCounts }, 180);
    }

    return res.json({
      success: true,
      data: {
        leads,
        counts,
        subCounts,
        pagination: {
          total,
          page: Number(page),
          limit: pageSize,
          pages: Math.ceil(total / pageSize)
        }
      }
    });
  } catch (error) {
    next(error);
  }
}

// 2. CHECK DUPLICATE LEAD PRE-FLIGHT
export async function checkDuplicateLead(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = req.organizationId;
    const { phone, email, leadId } = req.body;

    const query: any = { organizationId: orgId, isDeleted: false };
    if (leadId) {
      query._id = { $ne: leadId };
    }

    let duplicateLead: any = null;
    let matchType = '';

    // Check Phone Match (Primary)
    if (phone) {
      const cleanPhone = phone.replace(/[^0-9]/g, '').slice(-10);
      if (cleanPhone.length >= 7) {
        duplicateLead = await Lead.findOne({
          ...query,
          phone: { $regex: cleanPhone }
        }).populate('assignedTo', 'firstName lastName email');
        if (duplicateLead) matchType = 'phone';
      }
    }

    // Check Email Match (Secondary)
    if (!duplicateLead && email) {
      duplicateLead = await Lead.findOne({
        ...query,
        email: email.trim().toLowerCase()
      }).populate('assignedTo', 'firstName lastName email');
      if (duplicateLead) matchType = 'email';
    }

    return res.json({
      success: true,
      isDuplicate: !!duplicateLead,
      matchType,
      existingLead: duplicateLead
    });
  } catch (error) {
    next(error);
  }
}

// 3. GET SINGLE LEAD WITH TIMELINE & DETAILS
export async function getLead(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = req.organizationId;
    const { id } = req.params;

    const lead = await Lead.findOne({ _id: id, organizationId: orgId, isDeleted: false })
      .populate('assignedTo', 'firstName lastName email')
      .populate('reopenedBy', 'firstName lastName email')
      .populate('convertedBy', 'firstName lastName email')
      .populate('convertedQuotationId')
      .populate('convertedInvoiceId');

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found.',
        errorCode: 'LEAD_NOT_FOUND'
      });
    }

    // Scoping check for non-privileged employee
    const userRole = (req as any).userRole;
    const isPrivileged = ['Admin', 'Super Admin', 'Manager', 'Team Leader'].includes(userRole) || req.user?.email === 'shivamthakur12012@gmail.com';
    const assignedId = (typeof lead.assignedTo === 'object' && lead.assignedTo) ? ((lead.assignedTo as any)._id || (lead.assignedTo as any).id)?.toString() : lead.assignedTo?.toString();
    if (!isPrivileged && (!assignedId || assignedId !== req.user?.id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view leads assigned to you.',
        errorCode: 'FORBIDDEN'
      });
    }

    // Fetch activities / timeline logs
    const activities = await Activity.find({ leadId: lead._id, organizationId: orgId })
      .populate('userId', 'firstName lastName email')
      .sort({ createdAt: -1 });

    // Fetch linked quotations
    const quotations = await Quotation.find({ leadId: lead._id, organizationId: orgId, isDeleted: false })
      .populate('createdBy', 'firstName lastName')
      .sort({ createdAt: -1 });

    // Fetch assignment logs
    const assignmentLogs = await AssignmentLog.find({ leadId: lead._id, organizationId: orgId })
      .populate('assignedBy', 'firstName lastName')
      .populate('fromUserId', 'firstName lastName')
      .populate('toUserId', 'firstName lastName')
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      data: {
        lead,
        activities,
        quotations,
        assignmentLogs
      }
    });
  } catch (error) {
    next(error);
  }
}

// 4. CREATE LEAD (Manual Quick-Add)
export async function createLead(req: Request, res: Response, next: NextFunction) {
  try {
    let orgId = req.organizationId;
    if (!orgId) {
      const { Organization } = await import('../models/Organization');
      const firstOrg = await Organization.findOne({ isDeleted: false });
      orgId = firstOrg ? (firstOrg._id || firstOrg.id) : undefined;
    }

    const userId = req.user?.id;
    const userRole = (req as any).userRole;
    const isPrivileged = ['Admin', 'Super Admin', 'Manager', 'Team Leader'].includes(userRole) || req.user?.email === 'shivamthakur12012@gmail.com';
    const {
      name,
      company,
      email,
      phone,
      whatsApp,
      alternatePhone,
      source = 'Website',
      serviceInterested,
      productInterested,
      priority = 'medium',
      assignedTo,
      notes,
      tags,
      nextFollowUp,
      expectedValue,
      force = false
    } = req.body;

    // Validate name & phone (Required)
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Lead name is required.',
        errorCode: 'NAME_REQUIRED'
      });
    }

    if (!phone || !PHONE_REGEX.test(phone.trim())) {
      return res.status(400).json({
        success: false,
        message: 'A valid phone number (at least 10 digits) is required.',
        errorCode: 'INVALID_PHONE'
      });
    }

    if (email && !EMAIL_REGEX.test(email.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email address format.',
        errorCode: 'INVALID_EMAIL'
      });
    }

    // Concurrency lock to prevent race-condition double-click duplicates
    const cleanPhone = phone.replace(/[^0-9]/g, '').slice(-10);
    const lockKey = `${orgId}:${cleanPhone}`;
    if (!force && !acquireLeadLock(lockKey)) {
      // Another concurrent request is actively creating this lead.
      // Wait briefly for the first write to complete, then return the existing lead or conflict.
      await new Promise(r => setTimeout(r, 250));
      const existing = await Lead.findOne({
        organizationId: orgId,
        isDeleted: false,
        phone: { $regex: cleanPhone }
      }).populate('assignedTo', 'firstName lastName');

      if (existing) {
        return res.status(409).json({
          success: false,
          isDuplicate: true,
          message: `A lead with this phone/email was just created (#${existing.leadId} - ${existing.name}).`,
          existingLead: existing,
          errorCode: 'DUPLICATE_LEAD'
        });
      }
    }

    try {
      // Duplicate check if force flag is false
      if (!force) {
        const existing = await Lead.findOne({
          organizationId: orgId,
          isDeleted: false,
          $or: [
            { phone: { $regex: cleanPhone } },
            ...(email ? [{ email: email.trim().toLowerCase() }] : [])
          ]
        }).populate('assignedTo', 'firstName lastName');

        if (existing) {
          return res.status(409).json({
            success: false,
            isDuplicate: true,
            message: `A lead with this phone/email already exists (#${existing.leadId} - ${existing.name}).`,
            existingLead: existing,
            errorCode: 'DUPLICATE_LEAD'
          });
        }
      }

      // Initial status determined by assignment:
      // If assignedTo is set, status is 'Open'; if not assigned, status is 'New' (sits in Unassigned queue)
      let assignedUserId = isPrivileged ? (assignedTo || undefined) : (assignedTo || userId || undefined);
      let initialStatus: 'New' | 'Open' = assignedUserId ? 'Open' : 'New';

      const newLead = await Lead.create({
        organizationId: orgId,
        name: name.trim(),
        company: company?.trim(),
        email: email?.trim().toLowerCase(),
        phone: phone.trim(),
        whatsApp: whatsApp?.trim() || phone.trim(),
        alternatePhone: alternatePhone?.trim(),
        source,
        serviceInterested,
        productInterested,
        priority,
        status: initialStatus,
        assignedTo: assignedUserId,
        expectedValue: Number(expectedValue) || 0,
        notes,
        tags: Array.isArray(tags) ? tags : [],
        nextFollowUp: nextFollowUp ? new Date(nextFollowUp) : undefined
      });

      // Timeline creation activity
      await Activity.create({
        organizationId: orgId,
        leadId: newLead._id,
        userId,
        type: 'system',
        content: `Lead #${newLead.leadId} created via ${source}.`
      });

      // Assignment log if assigned
      if (assignedUserId) {
        await AssignmentLog.create({
          organizationId: orgId,
          leadId: newLead._id,
          assignedBy: userId,
          toUserId: assignedUserId,
          ruleApplied: 'manual_admin',
          reason: 'Assigned on lead creation.'
        });

        await Activity.create({
          organizationId: orgId,
          leadId: newLead._id,
          userId,
          type: 'assignment_change',
          content: `Lead assigned to sales agent.`,
          metadata: { assignedTo: assignedUserId }
        });
      }

      // Invalidate cached counts for this tenant so stats reflect immediately
      invalidateLeadCountsCache(orgId);

      // Trigger workflows
      await WorkflowService.triggerWorkflows(orgId as string, 'lead_created', newLead);

      return res.status(201).json({
        success: true,
        message: 'Lead created successfully.',
        data: newLead
      });
    } finally {
      releaseLeadLock(lockKey);
    }
  } catch (error) {
    next(error);
  }
}

// 5. UPDATE LEAD (Strict State Machine: New -> Open -> (Converted | Lost))
export async function updateLead(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = req.organizationId;
    const userId = req.user?.id;
    const { id } = req.params;
    const updates = req.body;

    const lead = await Lead.findOne({ _id: id, organizationId: orgId, isDeleted: false });
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found.',
        errorCode: 'LEAD_NOT_FOUND'
      });
    }

    // Scoping check for non-privileged employee
    const userRole = (req as any).userRole;
    const isPrivileged = ['Admin', 'Super Admin', 'Manager', 'Team Leader'].includes(userRole) || req.user?.email === 'shivamthakur12012@gmail.com';
    const assignedId = (typeof lead.assignedTo === 'object' && lead.assignedTo) ? ((lead.assignedTo as any)._id || (lead.assignedTo as any).id)?.toString() : lead.assignedTo?.toString();
    if (!isPrivileged && (!assignedId || assignedId !== req.user?.id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only update leads assigned to you.',
        errorCode: 'FORBIDDEN'
      });
    }

    if (!isPrivileged && updates.assignedTo) {
      delete updates.assignedTo;
    }

    // 1. Workflow State Machine & Admin Position Dispatch
    if (updates.status && updates.status !== lead.status) {
      // If previously converted or lost, non-privileged standard employees cannot edit without admin reopen
      if ((lead.status === 'Converted' || lead.status === 'Lost') && !isPrivileged) {
        return res.status(400).json({
          success: false,
          message: `This lead is marked as "${lead.status}" and is locked from direct status edits. Admin must use the "Reopen Lead" or dispatch action.`,
          errorCode: 'LEAD_LOCKED'
        });
      }

      // Moving from New -> Open requires assigned employee for standard employees
      if (updates.status === 'Open' && !lead.assignedTo && !updates.assignedTo && !isPrivileged) {
        return res.status(400).json({
          success: false,
          message: 'An assigned employee is required before moving a lead from "New" to "Open".',
          errorCode: 'ASSIGNMENT_REQUIRED'
        });
      }

      // Moving to New (Reset / Fresh Pipeline)
      if (updates.status === 'New') {
        lead.lostReason = null;
        lead.lostNotes = null;
        lead.convertedAt = null;
        lead.convertedBy = null;
        lead.convertedQuotationId = null;
      }

      // Moving to Open or Follow-up (Reactivate / Active Pipeline)
      if (updates.status === 'Open' || updates.status === 'Follow-up' || updates.status === 'Follow-Up') {
        lead.lostReason = null;
        lead.lostNotes = null;
        lead.convertedAt = null;
        lead.convertedBy = null;
        lead.convertedQuotationId = null;
      }

      // Moving to Lost
      if (updates.status === 'Lost') {
        if (!isPrivileged && (!updates.lostReason || !['Price', 'No Response', 'Competitor', 'Not Interested', 'Other'].includes(updates.lostReason))) {
          return res.status(400).json({
            success: false,
            message: 'A valid "Reason for Loss" (Price, No Response, Competitor, Not Interested, Other) is mandatory when marking a lead as Lost.',
            errorCode: 'LOST_REASON_REQUIRED'
          });
        }
        lead.lostReason = updates.lostReason || 'Other';
        lead.lostNotes = updates.lostNotes || (isPrivileged ? 'Dispatched to Lost by Admin' : '');
        lead.convertedAt = null;
        lead.convertedBy = null;
        lead.convertedQuotationId = null;
      }

      // Moving to Converted
      if (updates.status === 'Converted') {
        const acceptedQuote = await Quotation.findOne({
          leadId: lead._id,
          organizationId: orgId,
          status: { $in: ['accepted', 'converted'] },
          isDeleted: false
        });

        if (!acceptedQuote && !updates.adminOverrideReason && !isPrivileged) {
          return res.status(400).json({
            success: false,
            requiresQuotationOverride: true,
            message: 'A lead can only be converted after at least one Quotation with status "Accepted" exists against it. If you wish to override, provide a confirmation reason.',
            errorCode: 'ACCEPTED_QUOTATION_REQUIRED'
          });
        }

        lead.convertedAt = new Date();
        lead.convertedBy = userId as any;
        lead.lostReason = null;
        lead.lostNotes = null;
        if (acceptedQuote) {
          lead.convertedQuotationId = acceptedQuote._id as any;
        }
      }

      // Log status transition in timeline
      const transitionReason = updates.lostReason ? ` (Reason: ${updates.lostReason})` : updates.adminOverrideReason ? ` (Override: ${updates.adminOverrideReason})` : '';
      await Activity.create({
        organizationId: orgId,
        leadId: lead._id,
        userId,
        type: 'status_change',
        content: `Workflow stage dispatched from "${lead.status}" to "${updates.status}"${isPrivileged ? ' by Admin' : ''}.${transitionReason}`,
        metadata: { oldStatus: lead.status, newStatus: updates.status, lostReason: updates.lostReason, isPrivileged }
      });

      lead.status = updates.status;
    }

    // 2. Track Assignment Changes
    if (updates.assignedTo && lead.assignedTo?.toString() !== updates.assignedTo) {
      const oldRep = lead.assignedTo;
      lead.assignedTo = updates.assignedTo;

      // Auto move from New to Open upon assignment
      if (lead.status === 'New') {
        lead.status = 'Open';
      }

      const assignedUser = await User.findById(updates.assignedTo);
      const repName = assignedUser ? `${assignedUser.firstName} ${assignedUser.lastName}` : 'Sales Agent';

      await AssignmentLog.create({
        organizationId: orgId,
        leadId: lead._id,
        assignedBy: userId,
        fromUserId: oldRep,
        toUserId: updates.assignedTo,
        ruleApplied: 'manual_reassign',
        reason: updates.assignmentReason || 'Reassigned by Admin'
      });

      await Activity.create({
        organizationId: orgId,
        leadId: lead._id,
        userId,
        type: 'assignment_change',
        content: `Reassigned to ${repName} by Admin.`,
        metadata: { fromRep: oldRep, toRep: updates.assignedTo }
      });
    }

    // 3. Update fields
    if (updates.name) lead.name = updates.name.trim();
    if (updates.company !== undefined) lead.company = updates.company;
    if (updates.email !== undefined) lead.email = updates.email?.trim().toLowerCase();
    if (updates.phone) lead.phone = updates.phone.trim();
    if (updates.whatsApp !== undefined) lead.whatsApp = updates.whatsApp;
    if (updates.alternatePhone !== undefined) lead.alternatePhone = updates.alternatePhone;
    if (updates.source) lead.source = updates.source;
    if (updates.serviceInterested !== undefined) lead.serviceInterested = updates.serviceInterested;
    if (updates.productInterested !== undefined) lead.productInterested = updates.productInterested;
    if (updates.priority) lead.priority = updates.priority;
    if (updates.expectedValue !== undefined) lead.expectedValue = Number(updates.expectedValue);
    if (updates.location !== undefined) lead.location = updates.location;
    if (updates.tags) lead.tags = updates.tags;
    if (updates.nextFollowUp !== undefined) lead.nextFollowUp = updates.nextFollowUp ? new Date(updates.nextFollowUp) : null;
    if (updates.lastFollowUpDate !== undefined) lead.lastFollowUpDate = updates.lastFollowUpDate ? new Date(updates.lastFollowUpDate) : null;

    // Track note addition
    if (updates.notes && lead.notes !== updates.notes) {
      lead.notes = updates.notes;
      await Activity.create({
        organizationId: orgId,
        leadId: lead._id,
        userId,
        type: 'note',
        content: updates.notes
      });
    }

    lead.version = (lead.version || 1) + 1;
    await lead.save();

    invalidateLeadCountsCache(orgId);

    return res.json({
      success: true,
      message: 'Lead updated successfully.',
      data: lead
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Reopen a previously Closed (Won/Lost/Converted) Lead
 */
export async function reopenLead(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const orgId = req.organizationId;
    const userId = req.user?.id;

    if (!reason || !reason.trim()) {
      return res.status(400).json({
        success: false,
        message: 'A mandatory reason is required to reopen a closed lead.',
        errorCode: 'REOPEN_REASON_REQUIRED'
      });
    }

    const lead = await Lead.findOne({ _id: id, organizationId: orgId, isDeleted: false });
    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found.' });
    }

    const prevStatus = lead.status;
    lead.status = 'Open';
    lead.reopenedAt = new Date();
    lead.reopenedBy = userId as any;
    lead.reopenedReason = reason.trim();
    lead.lostReason = null;
    lead.lostNotes = null;

    await lead.save();

    await Activity.create({
      organizationId: orgId,
      leadId: lead._id,
      userId,
      type: 'status_change',
      content: `Lead reopened from "${prevStatus}" to "Open". Reason: "${reason.trim()}".`,
      metadata: { prevStatus, reopenReason: reason }
    });

    return res.json({
      success: true,
      message: 'Lead reopened successfully.',
      data: lead
    });
  } catch (error) {
    next(error);
  }
}

// 7. ASSIGN / REASSIGN LEADS (Admin Single & Bulk)
export async function assignLeads(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = req.organizationId;
    const userId = req.user?.id;
    const { leadIds, assignedTo, toUserId, reason = 'Admin Assignment' } = req.body;
    const targetAssigneeId = assignedTo || toUserId;

    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0 || !targetAssigneeId) {
      return res.status(400).json({
        success: false,
        message: 'Valid lead IDs array and target employee ID required.',
        errorCode: 'BAD_REQUEST'
      });
    }

    const targetUser = await User.findById(targetAssigneeId);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'Assigned employee not found.' });
    }
    const repName = `${targetUser.firstName} ${targetUser.lastName}`;

    const leads = await Lead.find({ _id: { $in: leadIds }, organizationId: orgId, isDeleted: false });

    for (const lead of leads) {
      const oldRep = lead.assignedTo;
      lead.assignedTo = targetAssigneeId;
      if (lead.status === 'New') {
        lead.status = 'Open';
      }
      if ((lead as any).save) await (lead as any).save();

      await AssignmentLog.create({
        organizationId: orgId,
        leadId: lead._id,
        assignedBy: userId,
        fromUserId: oldRep,
        toUserId: targetAssigneeId,
        ruleApplied: 'manual_admin',
        reason
      });

      await Activity.create({
        organizationId: orgId,
        leadId: lead._id,
        userId,
        type: 'assignment_change',
        content: `Lead assigned to ${repName} by Admin.`,
        metadata: { fromRep: oldRep, toRep: targetAssigneeId }
      });
    }

    return res.json({
      success: true,
      message: `Successfully assigned ${leads.length} lead(s) to ${repName}.`,
      data: { count: leads.length, toUserId: targetAssigneeId, repName }
    });
  } catch (error) {
    next(error);
  }
}

// 8. BULK ACTIONS (Status, Tag, Delete)
export async function bulkUpdateLeads(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = req.organizationId;
    const { leadIds, status, tag, action } = req.body;

    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid lead IDs array required.',
        errorCode: 'BAD_REQUEST'
      });
    }

    const filter: any = { _id: { $in: leadIds }, organizationId: orgId };
    const update: any = {};

    if (action === 'status' && status) {
      update.status = status;
    } else if (action === 'add_tag' && tag) {
      update.$addToSet = { tags: tag };
    } else if (action === 'delete') {
      update.isDeleted = true;
    }

    await Lead.updateMany(filter, update);

    return res.json({
      success: true,
      message: `Bulk operation ${action} executed successfully.`
    });
  } catch (error) {
    next(error);
  }
}


// 9. BULK EXCEL / CSV UPLOAD PROCESSOR
export async function bulkUploadLeads(req: Request, res: Response, next: NextFunction) {
  try {
    const userRole = (req as any).userRole;
    const isPrivileged = ['Admin', 'Super Admin', 'Manager', 'Team Leader'].includes(userRole) || req.user?.email === 'shivamthakur12012@gmail.com';
    if (!isPrivileged) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only Admins, Managers, and Team Leaders are permitted to bulk upload leads.',
        errorCode: 'FORBIDDEN'
      });
    }

    let orgId = req.organizationId;
    if (!orgId) {
      const { Organization } = await import('../models/Organization');
      const firstOrg = await Organization.findOne({ isDeleted: false });
      orgId = firstOrg ? (firstOrg._id || firstOrg.id) : undefined;
    }

    const userId = req.user?.id;
    const { rows, fileName = 'leads_import.csv', fileSize = 1024, duplicateStrategy = 'preview' } = req.body;

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No data rows provided for upload.',
        errorCode: 'EMPTY_FILE'
      });
    }

    const errors: any[] = [];
    const duplicates: any[] = [];
    const successfulLeads: any[] = [];

    // Process row-by-row
    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2; // header is row 1
      const row = rows[i] || {};

      // Helper to extract fields case-insensitively with alias support
      const getField = (candidates: string[]): string => {
        for (const c of candidates) {
          if (row[c] !== undefined && row[c] !== null && String(row[c]).trim()) {
            return String(row[c]).trim();
          }
        }
        const rowKeys = Object.keys(row);
        for (const c of candidates) {
          const target = c.toLowerCase().replace(/[^a-z0-9]/g, '');
          const matchedKey = rowKeys.find(k => k.trim().toLowerCase().replace(/[^a-z0-9]/g, '') === target);
          if (matchedKey && row[matchedKey] !== undefined && row[matchedKey] !== null && String(row[matchedKey]).trim()) {
            return String(row[matchedKey]).trim();
          }
        }
        return '';
      };

      const name = getField(['name', 'fullName', 'leadName', 'customerName', 'clientName', 'contactPerson', 'client', 'person']);
      const phone = getField(['phone', 'phoneNumber', 'mobile', 'mobileNumber', 'contact', 'cell', 'telephone', 'whatsApp']);
      const email = getField(['email', 'emailAddress', 'mail', 'emailId']).toLowerCase();
      const company = getField(['company', 'companyName', 'organization', 'org', 'business', 'firm']);
      const source = getField(['source', 'leadSource', 'channel', 'platform']) || 'Website';
      const serviceInterested = getField(['serviceInterested', 'service', 'productInterested', 'product', 'requirement', 'inquiry']);
      const notes = getField(['notes', 'note', 'remarks', 'comments', 'description']);

      // Validate required name
      if (!name) {
        errors.push({ rowNumber: rowNum, phone, email, name: name || 'Empty', reason: 'Missing lead name' });
        continue;
      }

      // Validate required phone
      if (!phone || !PHONE_REGEX.test(phone)) {
        errors.push({ rowNumber: rowNum, phone: phone || 'Empty', email, name, reason: 'Invalid or missing phone number (min 10 digits required)' });
        continue;
      }

      // Validate email format if provided
      if (email && !EMAIL_REGEX.test(email)) {
        errors.push({ rowNumber: rowNum, phone, email, name, reason: 'Invalid email address format' });
        continue;
      }

      // Duplicate Check
      const cleanPhone = phone.replace(/[^0-9]/g, '').slice(-10);
      const existingMatch = await Lead.findOne({
        organizationId: orgId,
        isDeleted: false,
        $or: [
          { phone: { $regex: cleanPhone } },
          ...(email ? [{ email }] : [])
        ]
      });

      if (existingMatch) {
        duplicates.push({
          rowNumber: rowNum,
          phone,
          email,
          name,
          existingLeadId: existingMatch.leadId,
          resolution: duplicateStrategy === 'skip' ? 'skipped' : duplicateStrategy === 'create_new' ? 'created_new' : 'pending'
        });

        if (duplicateStrategy === 'skip' || duplicateStrategy === 'preview') {
          continue;
        }
      }

      // If valid, create lead in 'New' state
      const created = await Lead.create({
        organizationId: orgId,
        name,
        company,
        phone,
        email: email || undefined,
        whatsApp: phone,
        source: ['Website', 'WhatsApp', 'Email', 'JustDial', 'IndiaMART', 'Referral', 'Walk-in', 'Phone', 'Manual', 'Other'].includes(source) ? source : 'Other',
        serviceInterested,
        status: 'New',
        notes
      });

      successfulLeads.push(created);
    }

    // Save Raw Upload Log (30-day retention)
    const importLog = await LeadImportLog.create({
      organizationId: orgId,
      importedBy: userId,
      fileName,
      fileSize,
      totalRows: rows.length,
      successfulRows: successfulLeads.length,
      failedRows: errors.length,
      duplicateRows: duplicates.length,
      rowErrors: errors,
      duplicates,
      status: 'completed'
    });

    return res.json({
      success: true,
      message: `Processed ${rows.length} rows: ${successfulLeads.length} imported, ${duplicates.length} duplicates flagged, ${errors.length} failed.`,
      data: {
        importLogId: importLog._id,
        totalRows: rows.length,
        successfulCount: successfulLeads.length,
        failedCount: errors.length,
        duplicateCount: duplicates.length,
        errors,
        duplicates
      }
    });
  } catch (error) {
    next(error);
  }
}

// 10. DOWNLOAD BULK TEMPLATE CSV
export function getBulkTemplate(req: Request, res: Response) {
  const userRole = (req as any).userRole;
  const isPrivileged = ['Admin', 'Super Admin', 'Manager', 'Team Leader'].includes(userRole) || (req as any).user?.email === 'shivamthakur12012@gmail.com';
  if (!isPrivileged) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Only Admins, Managers, and Team Leaders can download the bulk template.',
      errorCode: 'FORBIDDEN'
    });
  }

  const headers = 'Name,Company,Phone,Email,Source,ServiceInterested,ExpectedValue,Notes\n';
  const sample1 = 'Rahul Sharma,Apex Enterprises,9876543210,rahul@apex.com,IndiaMART,Business Loan,150000,Interested in quick sanction\n';
  const sample2 = 'Priya Patel,Innovatech Solutions,9811223344,priya@innovatech.com,JustDial,GST Registration,25000,Requires filing assistance\n';

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="leads_bulk_template.csv"');
  return res.send(headers + sample1 + sample2);
}

// 11. GET ASSIGNMENT AUDIT LOGS
export async function getAssignmentLogs(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = req.organizationId;
    const userRole = (req as any).userRole;
    const isAdmin = ['Admin', 'Super Admin'].includes(userRole) || req.user?.email === 'shivamthakur12012@gmail.com';
    const { page = 1, limit = 50 } = req.query;

    const skipIndex = (Number(page) - 1) * Number(limit);

    const logs = await AssignmentLog.find({ organizationId: orgId })
      .populate('leadId', 'name leadId company phone status')
      .populate('assignedBy', 'firstName lastName email')
      .populate('fromUserId', 'firstName lastName email')
      .populate('toUserId', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .skip(skipIndex)
      .limit(Number(limit));

    const total = await AssignmentLog.countDocuments({ organizationId: orgId });

    // If requester is not Admin, mask Admin profile in logs
    let sanitizedLogs = logs;
    if (!isAdmin) {
      const superAdminRole = await Role.findOne({ name: { $in: ['Super Admin', 'Admin'] }, organizationId: null });
      const superAdminMemberships = superAdminRole ? await UserOrganizationRole.find({ roleId: superAdminRole._id }) : [];
      const superAdminUserIds = new Set(superAdminMemberships.map((m: any) => m.userId?.toString()));

      sanitizedLogs = logs.map((log: any) => {
        const logObj = log.toObject ? log.toObject() : { ...log };
        if (logObj.assignedBy && superAdminUserIds.has(logObj.assignedBy._id?.toString())) {
          logObj.assignedBy = { _id: logObj.assignedBy._id, firstName: 'System', lastName: 'Admin', email: '' };
        }
        if (logObj.fromUserId && superAdminUserIds.has(logObj.fromUserId._id?.toString())) {
          logObj.fromUserId = { _id: logObj.fromUserId._id, firstName: 'System', lastName: 'Admin', email: '' };
        }
        if (logObj.toUserId && superAdminUserIds.has(logObj.toUserId._id?.toString())) {
          logObj.toUserId = { _id: logObj.toUserId._id, firstName: 'System', lastName: 'Admin', email: '' };
        }
        return logObj;
      });
    }

    return res.json({
      success: true,
      data: {
        logs: sanitizedLogs,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          pages: Math.ceil(total / Number(limit))
        }
      }
    });
  } catch (error) {
    next(error);
  }
}

// 12. GET IMPORT HISTORY LOGS (30-day raw logs)
export async function getImportLogs(req: Request, res: Response, next: NextFunction) {
  try {
    const userRole = (req as any).userRole;
    if (!['Super Admin', 'Manager'].includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only Admins and Managers can view import logs.',
        errorCode: 'FORBIDDEN'
      });
    }

    const orgId = req.organizationId;
    const logs = await LeadImportLog.find({ organizationId: orgId })
      .populate('importedBy', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .limit(30);

    return res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    next(error);
  }
}

// 13. DELETE LEAD (Soft Delete)
export async function deleteLead(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = req.organizationId;
    const { id } = req.params;

    const lead = await Lead.findOneAndUpdate(
      { _id: id, organizationId: orgId },
      { $set: { isDeleted: true } },
      { new: true }
    );

    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found.' });
    }

    await AuditLog.create({
      userId: req.user?.id,
      organizationId: orgId,
      action: 'LEAD_DELETED',
      entity: 'Lead',
      entityId: id
    });

    invalidateLeadCountsCache(orgId);

    return res.json({
      success: true,
      message: 'Lead deleted successfully.'
    });
  } catch (error) {
    next(error);
  }
}

// 14. CONVERT LEAD TO CUSTOMER (ACID Transaction)
export async function convertLead(req: Request, res: Response, next: NextFunction) {
  const orgId = req.organizationId;
  const userId = req.user?.id;
  const { leadId, linkCustomerId } = req.body;

  const mongoSession = await mongoose.startSession();
  mongoSession.startTransaction();

  try {
    const lead = await Lead.findOne({ _id: leadId, organizationId: orgId, isDeleted: false }).session(mongoSession);
    if (!lead) {
      await mongoSession.abortTransaction();
      mongoSession.endSession();
      return res.status(404).json({ success: false, message: 'Lead not found.' });
    }

    let customer: any = null;

    if (linkCustomerId) {
      customer = await Customer.findOne({ _id: linkCustomerId, organizationId: orgId }).session(mongoSession);
    } else {
      const [newCust] = await Customer.create(
        [
          {
            organizationId: orgId,
            name: lead.name,
            companyName: lead.company,
            email: lead.email || `contact_${Date.now()}@temp.com`,
            phone: lead.phone,
            whatsApp: lead.whatsApp,
            notes: lead.notes,
            outstandingBalance: 0
          }
        ],
        { session: mongoSession }
      );
      customer = newCust;

      await Contact.create(
        [
          {
            organizationId: orgId,
            customerId: customer._id,
            firstName: lead.name.split(' ')[0],
            lastName: lead.name.split(' ').slice(1).join(' ') || undefined,
            email: lead.email,
            phone: lead.phone,
            whatsApp: lead.whatsApp,
            isPrimary: true
          }
        ],
        { session: mongoSession }
      );
    }

    lead.status = 'Converted';
    lead.convertedAt = new Date();
    lead.convertedBy = userId as any;
    if ((lead as any).save) await (lead as any).save();

    await Activity.create(
      [
        {
          organizationId: orgId,
          leadId: lead._id,
          userId,
          type: 'status_change',
          content: 'Lead converted to Customer.',
          metadata: { customerId: customer._id }
        }
      ],
      { session: mongoSession }
    );

    await mongoSession.commitTransaction();
    mongoSession.endSession();

    return res.status(200).json({
      success: true,
      message: 'Lead converted successfully.',
      data: { customer, leadStatus: lead.status }
    });
  } catch (err) {
    await mongoSession.abortTransaction();
    mongoSession.endSession();
    logger.error('Lead conversion failed:', err);
    next(err);
  }
}

// 14. ADD QUICK NOTE TO LEAD TIMELINE
export async function addLeadNote(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = req.organizationId;
    const userId = req.user?.id;
    const { id } = req.params;
    const { note, tag, content } = req.body;

    const noteText = (note || content || '').trim();
    if (!noteText) {
      return res.status(400).json({
        success: false,
        message: 'Note content cannot be empty.',
        errorCode: 'NOTE_REQUIRED'
      });
    }

    const lead = await Lead.findOne({ _id: id, organizationId: orgId, isDeleted: false });
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found.',
        errorCode: 'LEAD_NOT_FOUND'
      });
    }

    const selectedTag = tag && tag !== 'General' ? tag : 'General';
    const tagPrefix = selectedTag !== 'General' ? `[${selectedTag} Note]` : '[Note]';
    const activityContent = `${tagPrefix} ${noteText}`;

    const activity = await Activity.create({
      organizationId: orgId,
      leadId: lead._id,
      userId,
      type: 'note',
      content: activityContent,
      metadata: {
        tag: selectedTag,
        note: noteText,
        source: 'quick_note'
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Note added successfully.',
      data: {
        activity
      }
    });
  } catch (error) {
    next(error);
  }
}

// 15. LOG CALL FOR LEAD (Click-to-Call & Manual Entry)
export async function logLeadCall(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = req.organizationId;
    const userId = req.user?.id;
    const { id } = req.params;
    const {
      callType = 'OUTGOING',
      duration = 0,
      outcome = 'Connected',
      notes = '',
      phoneNumber
    } = req.body;

    const lead = await Lead.findOne({ _id: id, organizationId: orgId, isDeleted: false });
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found.',
        errorCode: 'LEAD_NOT_FOUND'
      });
    }

    const employee = await User.findById(userId);
    const employeeName = employee ? `${employee.firstName} ${employee.lastName}`.trim() : 'Sales Agent';
    const cleanPhone = (phoneNumber || lead.phone || '').replace(/[^0-9]/g, '').slice(-10);
    const now = new Date();

    const formattedDuration = Number(duration) > 0 ? `${duration}s connected` : 'Outgoing call placed';
    const noteText = notes ? `. Notes: ${notes}` : '';
    const content = `📱 SIM Call (${callType}): ${formattedDuration} with ${lead.name}. Logged by ${employeeName}.${noteText}`;

    // 1. Create Activity record in Lead timeline
    const activity = await Activity.create({
      organizationId: orgId,
      leadId: lead._id,
      userId,
      type: 'call',
      content,
      metadata: {
        channel: 'phone',
        callType,
        duration: Number(duration) || 0,
        outcome,
        phoneNumber: cleanPhone,
        notes,
        source: 'web_click_to_call'
      }
    });

    // 2. Create completed FollowUp record for analytics
    const followUp = await FollowUp.create({
      organizationId: orgId,
      leadId: lead._id,
      assignedTo: userId,
      type: 'phone',
      channel: 'phone',
      date: now,
      purpose: `SIM Call (${callType}) — ${lead.name} [${cleanPhone}]`,
      status: 'completed',
      outcome,
      notes: notes || `Call placed to ${lead.name} (${cleanPhone}).`,
      channelDetails: {
        callDuration: Number(duration) || 0,
        callOutcome: outcome,
        source: 'web_click_to_call',
        callType,
        phoneNumber: cleanPhone
      }
    });

    // 3. Update Lead timestamps and status
    lead.lastFollowUpDate = now;
    lead.lastContacted = now;
    if (lead.status === 'New') {
      lead.status = 'Open';
    }
    if ((lead as any).save) {
      await (lead as any).save();
    } else {
      await Lead.findByIdAndUpdate(lead._id, {
        $set: {
          lastFollowUpDate: now,
          lastContacted: now,
          status: lead.status
        }
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Call logged successfully.',
      data: {
        activity,
        followUp
      }
    });
  } catch (error) {
    next(error);
  }
}

// 16. LOG OUTREACH TOUCHPOINT (WhatsApp / Email)
export async function logLeadTouchpoint(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = req.organizationId;
    const userId = req.user?.id;
    const { id } = req.params;
    const { channel = 'whatsapp', details = '' } = req.body;

    const lead = await Lead.findOne({ _id: id, organizationId: orgId, isDeleted: false });
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found.',
        errorCode: 'LEAD_NOT_FOUND'
      });
    }

    const employee = await User.findById(userId);
    const employeeName = employee ? `${employee.firstName} ${employee.lastName}`.trim() : 'Sales Agent';
    const channelName = channel === 'whatsapp' ? 'WhatsApp' : 'Email';
    const icon = channel === 'whatsapp' ? '💬' : '✉️';
    const now = new Date();

    const activity = await Activity.create({
      organizationId: orgId,
      leadId: lead._id,
      userId,
      type: channel === 'whatsapp' ? 'whatsapp' : 'email',
      content: `${icon} ${channelName} outreach initiated with ${lead.name} by ${employeeName}.${details ? ` (${details})` : ''}`,
      metadata: {
        channel,
        source: 'web_click_action',
        timestamp: now.toISOString()
      }
    });

    lead.lastContacted = now;
    if (lead.status === 'New') {
      lead.status = 'Open';
    }
    if ((lead as any).save) {
      await (lead as any).save();
    } else {
      await Lead.findByIdAndUpdate(lead._id, {
        $set: {
          lastContacted: now,
          status: lead.status
        }
      });
    }

    return res.status(201).json({
      success: true,
      message: `${channelName} touchpoint logged.`,
      data: { activity }
    });
  } catch (error) {
    next(error);
  }
}


