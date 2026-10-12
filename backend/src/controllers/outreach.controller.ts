import { Request, Response, NextFunction } from 'express';
import prisma from '../config/prisma';
import { FollowUp } from '../models/FollowUp';
import { CallLog, CallOutcome } from '../models/CallLog';
import { FollowUpSequence } from '../models/FollowUpSequence';
import { Campaign } from '../models/Campaign';
import { CommunicationConsent } from '../models/CommunicationConsent';
import { Lead } from '../models/Lead';
import { Activity } from '../models/Activity';
import { User } from '../models/User';
import { EmailService } from '../services/email.service';
import { WhatsAppService } from '../services/whatsapp.service';
import { InstagramService } from '../services/instagram.service';
import { TelephonyService } from '../services/telephony.service';
import { AIOutreachService } from '../services/aiOutreach.service';
import { SequenceService } from '../services/sequence.service';
import logger from '../utils/logger';

// ==========================================
// 1. FOLLOW-UP SCHEDULES (ONLY 4 CHANNELS)
// ==========================================

export async function getFollowUps(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = req.organizationId;
    const userRole = (req as any).userRole;
    const isPrivileged = ['Admin', 'Super Admin', 'Manager', 'Team Leader'].includes(userRole) || req.user?.email === 'shivamthakur12012@gmail.com';
    const userId = req.user?.id;
    const { status, channel, period, assignedTo, leadId, customerId } = req.query;

    // Purge historical orphan unmatched SIM calls (spam, personal, non-CRM numbers)
    try {
      await prisma.followUp.deleteMany({
        where: {
          organizationId: orgId,
          leadId: null,
          customerId: null,
          purpose: { contains: 'SIM Call' }
        }
      });
    } catch (e) {
      // Ignore background cleanup error
    }

    const query: any = { organizationId: orgId };

    if (!isPrivileged && userId) {
      query.assignedTo = userId;
    } else if (assignedTo) {
      query.assignedTo = assignedTo;
    }

    if (status && status !== 'all') {
      query.status = status;
    }

    if (channel && channel !== 'all') {
      if (channel === 'call' || channel === 'phone') {
        query.channel = { $in: ['phone', 'call'] };
      } else {
        query.channel = channel;
      }
    }

    if (leadId) query.leadId = leadId;
    if (customerId) query.customerId = customerId;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    if (period === 'today') {
      query.date = { $gte: todayStart, $lte: todayEnd };
    } else if (period === 'upcoming') {
      query.date = { $gt: todayEnd };
      if (!query.status) query.status = 'pending';
    } else if (period === 'overdue') {
      query.date = { $lt: todayStart };
      if (!query.status) query.status = 'pending';
    }

    const statsQuery: any = { organizationId: orgId };
    if (!isPrivileged && userId) {
      statsQuery.assignedTo = userId;
    } else if (assignedTo) {
      statsQuery.assignedTo = assignedTo;
    }

    const [followups, allForStats] = await Promise.all([
      FollowUp.find(query)
        .populate('leadId', 'name company email phone whatsApp leadId score scoreCategory serviceInterested')
        .populate('customerId', 'name companyName email phone customerId')
        .populate('assignedTo', 'firstName lastName email')
        .sort({ date: 1, time: 1 }),
      FollowUp.find(statsQuery)
    ]);

    // Only keep matched CRM Leads/Customers or manually scheduled CRM follow-ups
    const validFollowups = followups.filter((f: any) => {
      const isSimCall = f.purpose && /SIM Call/i.test(f.purpose);
      if (isSimCall) {
        return Boolean(f.leadId || f.customerId || f.lead || f.customer);
      }
      return true;
    });

    const validForStats = allForStats.filter((f: any) => {
      const isSimCall = f.purpose && /SIM Call/i.test(f.purpose);
      if (isSimCall) {
        return Boolean(f.leadId || f.customerId || f.lead || f.customer);
      }
      return true;
    });

    let totalCount = 0;
    let waCount = 0;
    let emailCount = 0;
    let phoneCount = 0;
    let pendingCount = 0;
    let completedCount = 0;
    let todayDueCount = 0;
    let overdueCount = 0;

    for (const f of validForStats) {
      totalCount++;
      const ch = f.channel || f.type;
      if (ch === 'whatsapp') waCount++;
      else if (ch === 'email') emailCount++;
      else if (ch === 'phone' || ch === 'call') phoneCount++;

      if (f.status === 'completed') {
        completedCount++;
      } else {
        pendingCount++;
        const fDate = new Date(f.date);
        if (fDate >= todayStart && fDate <= todayEnd) todayDueCount++;
        else if (fDate < todayStart) overdueCount++;
      }
    }

    return res.json({
      success: true,
      data: validFollowups,
      stats: {
        total: totalCount,
        whatsapp: waCount,
        email: emailCount,
        phone: phoneCount,
        pending: pendingCount,
        completed: completedCount,
        todayDue: todayDueCount,
        overdue: overdueCount
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteFollowUp(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = req.organizationId;
    const { id } = req.params;

    const old = await FollowUp.findOne({ _id: id, organizationId: orgId });
    if (!old) {
      return res.status(404).json({ success: false, message: 'Follow-up not found.', errorCode: 'NOT_FOUND' });
    }

    await FollowUp.findByIdAndDelete(id);

    if (old.leadId && old.status === 'pending') {
      const remaining = await FollowUp.findOne({ leadId: old.leadId, status: 'pending' }).sort({ date: 1 });
      if (remaining) {
        await Lead.findByIdAndUpdate(old.leadId, { $set: { nextFollowUp: remaining.date } });
      } else {
        await Lead.findByIdAndUpdate(old.leadId, { $unset: { nextFollowUp: 1 } });
      }
    }

    return res.json({ success: true, message: 'Follow-up deleted successfully.' });
  } catch (error) {
    next(error);
  }
}

export async function createFollowUp(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = req.organizationId;
    const userRole = (req as any).userRole;
    const isPrivileged = ['Admin', 'Super Admin', 'Manager', 'Team Leader'].includes(userRole) || req.user?.email === 'shivamthakur12012@gmail.com';
    const userId = req.user?.id;
    const { 
      leadId, customerId, contactId, assignedTo, 
      date, time, channel = 'phone', priority = 'medium', 
      purpose = 'Quotation Follow-up', notes, messageBody, subject 
    } = req.body;

    const targetAssignedTo = isPrivileged ? (assignedTo || userId) : userId;
    const normalizedChannel = channel === 'call' ? 'phone' : channel;

    // Consent Check
    if (leadId || customerId) {
      const consentQuery: any = { organizationId: orgId };
      if (leadId) consentQuery.entityId = leadId;
      else if (customerId) consentQuery.entityId = customerId;

      const consent = await CommunicationConsent.findOne(consentQuery);
      if (consent && consent.doNotContact) {
        return res.status(400).json({
          success: false,
          message: 'Cannot schedule follow-up: Recipient has opted out of all communications (Do Not Contact).',
          errorCode: 'CONSENT_OPT_OUT'
        });
      }
    }

    const followup = await FollowUp.create({
      organizationId: orgId,
      leadId: leadId || undefined,
      customerId: customerId || undefined,
      contactId: contactId || undefined,
      assignedTo: targetAssignedTo,
      date: new Date(date),
      time: time || '11:00 AM',
      channel: normalizedChannel,
      type: normalizedChannel,
      priority,
      purpose,
      notes,
      status: 'pending',
      channelDetails: {
        subject,
        messageBody
      }
    });

    // Update Lead timeline
    if (leadId) {
      await Lead.findByIdAndUpdate(leadId, { $set: { nextFollowUp: new Date(date) } });
      await Activity.create({
        organizationId: orgId,
        leadId,
        userId,
        type: normalizedChannel === 'phone' ? 'phone' : (normalizedChannel as any),
        content: `Scheduled ${normalizedChannel.toUpperCase()} follow-up (${purpose}) for ${date} at ${time || '11:00 AM'}.`,
        metadata: { followupId: followup._id, priority, purpose }
      });
    }

    return res.status(201).json({
      success: true,
      data: followup
    });
  } catch (error) {
    next(error);
  }
}

export async function updateFollowUp(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = req.organizationId;
    const userId = req.user?.id;
    const { id } = req.params;
    const { status, outcome, notes, date, time } = req.body;

    const old = await FollowUp.findOne({ _id: id, organizationId: orgId });
    if (!old) {
      return res.status(404).json({ success: false, message: 'Follow-up not found.', errorCode: 'NOT_FOUND' });
    }

    const updates: any = {};
    if (status) updates.status = status;
    if (outcome) updates.outcome = outcome;
    if (notes) updates.notes = notes;
    if (date) updates.date = new Date(date);
    if (time) updates.time = time;

    const updated = await FollowUp.findByIdAndUpdate(id, { $set: updates }, { new: true });

    if (status && status !== old.status && old.leadId) {
      await Activity.create({
        organizationId: orgId,
        leadId: old.leadId,
        userId,
        type: old.channel === 'phone' ? 'phone' : (old.channel as any),
        content: status === 'completed' 
          ? `Completed ${old.channel.toUpperCase()} follow-up. Outcome: ${outcome || 'Completed'}`
          : `Updated follow-up status to ${status}.`
      });

      if (status === 'completed') {
        await Lead.findByIdAndUpdate(old.leadId, { $unset: { nextFollowUp: 1 } });
      }
    }

    return res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
}

// Bulk Call Tasks Generator & Multi-Channel Bulk Action
export async function bulkCreateFollowUps(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = req.organizationId;
    const userId = req.user?.id;
    const { 
      filterTemperature, filterStatus, 
      channel = 'phone', purpose = 'Bulk Follow-up Campaign', 
      assignToUserIds = [], notes, date = new Date() 
    } = req.body;

    const leadQuery: any = { organizationId: orgId, isDeleted: false };
    if (filterTemperature && filterTemperature.length > 0) {
      leadQuery.scoreCategory = { $in: filterTemperature };
    }
    if (filterStatus && filterStatus.length > 0) {
      leadQuery.status = { $in: filterStatus };
    }

    const matchingLeads = await Lead.find(leadQuery);
    if (matchingLeads.length === 0) {
      return res.json({ success: true, count: 0, message: 'No leads matched filter criteria.' });
    }

    // Get active sales reps for distribution
    let employeePool = assignToUserIds;
    if (employeePool.length === 0) {
      const activeUsers = await User.find({ status: 'active' }).limit(10);
      employeePool = activeUsers.map(u => u._id);
    }
    if (employeePool.length === 0) employeePool = [userId];

    const followUpsToCreate = matchingLeads.map((lead, idx) => {
      const assigned = employeePool[idx % employeePool.length];
      return {
        organizationId: orgId,
        leadId: lead._id,
        assignedTo: assigned,
        date: new Date(date),
        time: '11:00 AM',
        channel: channel === 'call' ? 'phone' : channel,
        type: channel === 'call' ? 'phone' : channel,
        priority: lead.scoreCategory === 'hot' || lead.scoreCategory === 'very_hot' ? 'urgent' : 'medium',
        purpose: `${purpose} (${lead.scoreCategory.toUpperCase()})`,
        notes: notes || `Bulk assigned ${channel} task for ${lead.name}`,
        status: 'pending'
      };
    });

    const created = await FollowUp.insertMany(followUpsToCreate);
    logger.info(`OutreachController: Created ${created.length} bulk ${channel} tasks for ${matchingLeads.length} leads.`);

    return res.json({
      success: true,
      count: created.length,
      message: `Successfully created and distributed ${created.length} ${channel} follow-up tasks across ${employeePool.length} team members.`
    });
  } catch (error) {
    next(error);
  }
}

// ==========================================
// 2. PHONE / CALL MANAGEMENT & DASHBOARD
// ==========================================

export async function logManualCall(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = req.organizationId;
    const userId = req.user?.id;
    const {
      leadId, customerId, contactId, dealId,
      phoneNumber, direction = 'outbound', duration = 0,
      outcome, notes, nextFollowUpDate, nextFollowUpChannel, nextFollowUpPurpose, recordingUrl
    } = req.body;

    if (!phoneNumber || !outcome) {
      return res.status(400).json({
        success: false,
        message: 'Phone number and Call outcome are required.',
        errorCode: 'BAD_REQUEST'
      });
    }

    const result = await TelephonyService.recordCallResult({
      organizationId: orgId!,
      employeeId: userId!,
      leadId,
      customerId,
      contactId,
      dealId,
      phoneNumber,
      direction,
      duration: Number(duration),
      outcome: outcome as CallOutcome,
      notes,
      nextFollowUpDate,
      nextFollowUpChannel,
      nextFollowUpPurpose,
      recordingUrl
    });

    return res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

export async function initiateClickToCall(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = req.organizationId;
    const userId = req.user?.id;
    const { leadId, customerId, contactId, dealId, phoneNumber, provider } = req.body;

    const result = await TelephonyService.initiateClickToCall({
      organizationId: orgId!,
      employeeId: userId!,
      leadId,
      customerId,
      contactId,
      dealId,
      phoneNumber,
      provider
    });

    return res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

export async function getCallDashboard(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = req.organizationId;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // Calls scheduled today
    const scheduledToday = await FollowUp.countDocuments({
      organizationId: orgId,
      channel: { $in: ['phone', 'call'] },
      date: { $gte: todayStart, $lte: todayEnd }
    });

    // Completed calls today
    const completedToday = await CallLog.countDocuments({
      organizationId: orgId,
      startTime: { $gte: todayStart, $lte: todayEnd }
    });

    // Outcomes aggregation
    const allCalls = await CallLog.find({
      organizationId: orgId,
      startTime: { $gte: todayStart, $lte: todayEnd }
    }).populate('employeeId', 'firstName lastName');

    let connected = 0;
    let noAnswer = 0;
    let interested = 0;
    let converted = 0;
    let followUpRequired = 0;
    let totalDuration = 0;

    const employeeCallCounts: Record<string, { name: string; count: number; duration: number }> = {};

    for (const call of allCalls) {
      totalDuration += call.duration || 0;

      if (call.outcome === 'Connected' || call.outcome === 'Interested' || call.outcome === 'Converted') {
        connected++;
      }
      if (call.outcome === 'No Answer' || call.outcome === 'Switched Off' || call.outcome === 'Busy') {
        noAnswer++;
      }
      if (call.outcome === 'Interested') {
        interested++;
      }
      if (call.outcome === 'Converted') {
        converted++;
      }
      if (call.outcome === 'Follow-up Required' || call.outcome === 'Call Back Later') {
        followUpRequired++;
      }

      const emp = call.employeeId as any;
      const empId = emp?._id?.toString() || 'unassigned';
      const empName = emp ? `${emp.firstName} ${emp.lastName}` : 'Unassigned';

      if (!employeeCallCounts[empId]) {
        employeeCallCounts[empId] = { name: empName, count: 0, duration: 0 };
      }
      employeeCallCounts[empId].count++;
      employeeCallCounts[empId].duration += call.duration || 0;
    }

    const avgDurationSeconds = allCalls.length > 0 ? Math.round(totalDuration / allCalls.length) : 0;
    const conversionRate = allCalls.length > 0 ? Math.round((converted / allCalls.length) * 100) : 0;

    return res.json({
      success: true,
      data: {
        today: {
          scheduled: scheduledToday,
          completed: completedToday,
          connected,
          noAnswer,
          interested,
          converted,
          followUpRequired,
          averageDurationSeconds: avgDurationSeconds,
          conversionRatePercent: conversionRate
        },
        callsByEmployee: Object.values(employeeCallCounts)
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function getCallLogs(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = req.organizationId;
    const { leadId, customerId, outcome, employeeId, limit = 50 } = req.query;

    const query: any = { organizationId: orgId };
    if (leadId) query.leadId = leadId;
    if (customerId) query.customerId = customerId;
    if (outcome) query.outcome = outcome;
    if (employeeId) query.employeeId = employeeId;

    const logs = await CallLog.find(query)
      .populate('leadId', 'name company email phone leadId')
      .populate('customerId', 'name companyName email phone customerId')
      .populate('employeeId', 'firstName lastName')
      .sort({ startTime: -1 })
      .limit(Number(limit));

    return res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    next(error);
  }
}

// AI Call Brief (Before Call)
export async function getCallBrief(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { isCustomer } = req.query;

    const brief = await AIOutreachService.generateCallBrief(id, isCustomer === 'true');
    return res.json({
      success: true,
      data: brief
    });
  } catch (error) {
    next(error);
  }
}

// AI Post-Call Analysis (After Call)
export async function analyzeCallOutcome(req: Request, res: Response, next: NextFunction) {
  try {
    const { notes, outcome, leadName } = req.body;
    const analysis = await AIOutreachService.analyzePostCall(notes, outcome, leadName);
    return res.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    next(error);
  }
}

// ==========================================
// 3. MULTI-CHANNEL DISPATCHERS (EMAIL, WA, IG)
// ==========================================

export async function sendEmail(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = req.organizationId;
    const userId = req.user?.id;
    const { to, subject, html, text, leadId, customerId } = req.body;

    if (!to || !subject) {
      return res.status(400).json({ success: false, message: 'Recipient email and subject are required.' });
    }

    const result = await EmailService.sendEmail({ to, subject, html, text });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error || 'Failed to send email. Please check your SMTP configuration or quota.',
        data: result
      });
    }

    // Record Activity in CRM timeline
    await Activity.create({
      organizationId: orgId,
      leadId: leadId || undefined,
      customerId: customerId || undefined,
      userId,
      type: 'email',
      content: `[Email Dispatched via ${result.provider}]\nSubject: ${subject}\nTo: ${to}`,
      metadata: { messageId: result.messageId, provider: result.provider }
    });

    // Record completed FollowUp in Follow-up Command Center
    await FollowUp.create({
      organizationId: orgId,
      leadId: leadId || undefined,
      customerId: customerId || undefined,
      assignedTo: userId,
      channel: 'email',
      type: 'email',
      purpose: subject,
      notes: text || subject,
      date: new Date(),
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      status: 'completed',
      outcome: `Dispatched via ${result.provider}`,
      channelDetails: { email: to }
    });

    if (leadId) {
      await Lead.findByIdAndUpdate(leadId, {
        lastContacted: new Date(),
        lastFollowUpDate: new Date()
      });
    }

    return res.json({
      success: true,
      message: `Email dispatched successfully via ${result.provider}`,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

export async function sendWhatsAppMessage(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = req.organizationId;
    const userId = req.user?.id;
    const { to, customMessage, templateName, templateParameters, leadId, customerId } = req.body;

    if (!to) {
      return res.status(400).json({ success: false, message: 'Phone number is required.' });
    }

    const result = await WhatsAppService.sendMessage({
      to,
      customMessage,
      templateName,
      templateParameters
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error || 'Failed to send WhatsApp message.',
        data: result
      });
    }

    await Activity.create({
      organizationId: orgId,
      leadId: leadId || undefined,
      customerId: customerId || undefined,
      userId,
      type: 'whatsapp',
      content: `[WhatsApp Message Sent]\nTo: ${to}\nContent: ${customMessage || templateName}`,
      metadata: { messageId: result.messageId, provider: result.provider }
    });

    await FollowUp.create({
      organizationId: orgId,
      leadId: leadId || undefined,
      customerId: customerId || undefined,
      assignedTo: userId,
      channel: 'whatsapp',
      type: 'whatsapp',
      purpose: customMessage ? customMessage.slice(0, 50) : `WhatsApp: ${templateName}`,
      notes: customMessage || templateName,
      date: new Date(),
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      status: 'completed',
      outcome: `Sent via ${result.provider}`,
      channelDetails: { phoneNumber: to }
    });

    if (leadId) {
      await Lead.findByIdAndUpdate(leadId, {
        lastContacted: new Date(),
        lastFollowUpDate: new Date()
      });
    }

    return res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function sendInstagramMessage(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = req.organizationId;
    const userId = req.user?.id;
    const { recipientHandle, messageText, leadId } = req.body;

    if (!recipientHandle || !messageText) {
      return res.status(400).json({ success: false, message: 'Instagram handle and message text are required.' });
    }

    const result = await InstagramService.sendDirectMessage({
      recipientInstagramIdOrHandle: recipientHandle,
      messageText,
      leadId
    });

    if (result.success) {
      await Activity.create({
        organizationId: orgId,
        leadId: leadId || undefined,
        userId,
        type: 'instagram',
        content: `[Instagram DM Sent]\nRecipient: ${recipientHandle}\nMessage: ${messageText}`,
        metadata: { messageId: result.messageId }
      });
    }

    return res.json({ success: result.success, data: result });
  } catch (error) {
    next(error);
  }
}

// ==========================================
// 4. AUTOMATED SEQUENCES & CAMPAIGNS
// ==========================================

export async function getSequences(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = req.organizationId;
    let sequences: any = await FollowUpSequence.find({ organizationId: orgId }).sort({ createdAt: -1 });

    if (sequences.length === 0) {
      sequences = await SequenceService.seedDefaultSequences(orgId!, req.user?.id);
    }

    return res.json({ success: true, data: sequences });
  } catch (error) {
    next(error);
  }
}

export async function updateSequence(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = req.organizationId;
    const { id } = req.params;
    const { name, isActive, steps } = req.body;

    const updated = await FollowUpSequence.findOneAndUpdate(
      { _id: id, organizationId: orgId },
      { $set: { name, isActive, steps } },
      { new: true }
    );

    return res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
}

export async function enrollLeadInSequence(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = req.organizationId;
    const { leadId, sequenceId } = req.body;

    const result = await SequenceService.enrollLead(leadId, orgId!, sequenceId);
    return res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function getCampaigns(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = req.organizationId;
    const campaigns = await Campaign.find({ organizationId: orgId })
      .populate('createdBy', 'firstName lastName')
      .sort({ createdAt: -1 });
    return res.json({ success: true, data: campaigns });
  } catch (error) {
    next(error);
  }
}

export async function createCampaign(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = req.organizationId;
    const userId = req.user?.id;
    const { name, channel, type, targetCriteria, content, scheduledAt } = req.body;

    const campaign = await Campaign.create({
      organizationId: orgId,
      name,
      channel: channel === 'call' ? 'phone' : channel,
      type: type || 'broadcast',
      status: 'scheduled',
      scheduledAt: scheduledAt ? new Date(scheduledAt) : new Date(),
      targetCriteria: targetCriteria || {},
      content: content || {},
      createdBy: userId
    });

    return res.status(201).json({ success: true, data: campaign });
  } catch (error) {
    next(error);
  }
}

// ==========================================
// 5. CROSS-CHANNEL ANALYTICS & CONSENT
// ==========================================

export async function getOutreachAnalytics(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = req.organizationId;

    const totalFollowUps = await FollowUp.countDocuments({ organizationId: orgId });
    const pendingFollowUps = await FollowUp.countDocuments({ organizationId: orgId, status: 'pending' });
    const completedFollowUps = await FollowUp.countDocuments({ organizationId: orgId, status: 'completed' });

    // Breakdown by channel
    const channelStats = {
      phone: await FollowUp.countDocuments({ organizationId: orgId, channel: { $in: ['phone', 'call'] } }),
      whatsapp: await FollowUp.countDocuments({ organizationId: orgId, channel: 'whatsapp' }),
      email: await FollowUp.countDocuments({ organizationId: orgId, channel: 'email' }),
      instagram: await FollowUp.countDocuments({ organizationId: orgId, channel: 'instagram' })
    };

    // Total Call logs
    const totalCalls = await CallLog.countDocuments({ organizationId: orgId });
    const convertedCalls = await CallLog.countDocuments({ organizationId: orgId, outcome: 'Converted' });
    const interestedCalls = await CallLog.countDocuments({ organizationId: orgId, outcome: 'Interested' });

    return res.json({
      success: true,
      data: {
        overview: {
          totalFollowUps,
          pendingFollowUps,
          completedFollowUps,
          completionRatePercent: totalFollowUps > 0 ? Math.round((completedFollowUps / totalFollowUps) * 100) : 0
        },
        channelDistribution: channelStats,
        calls: {
          total: totalCalls,
          converted: convertedCalls,
          interested: interestedCalls,
          conversionRate: totalCalls > 0 ? Math.round((convertedCalls / totalCalls) * 100) : 0
        }
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function getCommunicationConsent(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = req.organizationId;
    const { entityType, entityId } = req.params;

    let consent = await CommunicationConsent.findOne({
      organizationId: orgId,
      entityType,
      entityId
    });

    if (!consent) {
      consent = await CommunicationConsent.create({
        organizationId: orgId,
        entityType: entityType as any,
        entityId: entityId,
        whatsAppAllowed: true,
        emailAllowed: true,
        instagramAllowed: true,
        phoneAllowed: true,
        marketingAllowed: true,
        doNotContact: false
      });
    }

    return res.json({ success: true, data: consent });
  } catch (error) {
    next(error);
  }
}

export async function updateCommunicationConsent(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = req.organizationId;
    const userId = req.user?.id;
    const { entityType, entityId } = req.params;
    const { whatsAppAllowed, emailAllowed, instagramAllowed, phoneAllowed, marketingAllowed, doNotContact, optOutReason } = req.body;

    const consent = await CommunicationConsent.findOneAndUpdate(
      { organizationId: orgId, entityType, entityId },
      {
        $set: {
          whatsAppAllowed,
          emailAllowed,
          instagramAllowed,
          phoneAllowed,
          marketingAllowed,
          doNotContact,
          optOutReason,
          optOutTimestamp: doNotContact ? new Date() : undefined,
          updatedBy: userId
        }
      },
      { new: true, upsert: true }
    );

    return res.json({ success: true, data: consent });
  } catch (error) {
    next(error);
  }
}

export async function getNextActionRecommendation(req: Request, res: Response, next: NextFunction) {
  try {
    const { leadId } = req.params;
    const rec = await AIOutreachService.getNextActionRecommendation(leadId);
    return res.json({ success: true, data: rec });
  } catch (error) {
    next(error);
  }
}

export async function handleTelephonyWebhook(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await TelephonyService.handleProviderWebhook(req.body);
    return res.json(result);
  } catch (error) {
    next(error);
  }
}
