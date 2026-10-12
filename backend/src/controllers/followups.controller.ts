import { Request, Response, NextFunction } from 'express';
import { FollowUp } from '../models/FollowUp';
import { Lead } from '../models/Lead';
import { Activity } from '../models/Activity';

export async function getFollowUps(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = req.organizationId;
    const userRole = (req as any).userRole;
    const isPrivileged = ['Super Admin', 'Manager'].includes(userRole);
    const userId = req.user?.id;
    const { status, type, period, assignedTo } = req.query;

    const query: any = { organizationId: orgId };

    if (!isPrivileged && userId) {
      query.assignedTo = userId;
    } else if (assignedTo) {
      query.assignedTo = assignedTo;
    }

    if (status) query.status = status;
    if (type) query.type = type;

    // Period Filter
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    if (period === 'today') {
      query.date = { $gte: todayStart, $lte: todayEnd };
    } else if (period === 'upcoming') {
      query.date = { $gt: todayEnd };
      query.status = 'pending';
    } else if (period === 'overdue') {
      query.date = { $lt: todayStart };
      query.status = 'pending';
    }

    const followups = await FollowUp.find(query)
      .populate('leadId', 'name company email phone leadId')
      .populate('customerId', 'name companyName email phone customerId')
      .populate('assignedTo', 'firstName lastName')
      .sort({ date: 1, time: 1 });

    return res.json({
      success: true,
      data: followups
    });
  } catch (error) {
    next(error);
  }
}

export async function createFollowUp(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = req.organizationId;
    const userRole = (req as any).userRole;
    const isPrivileged = ['Super Admin', 'Manager'].includes(userRole);
    const userId = req.user?.id;
    const { leadId, customerId, date, time, type, notes, assignedTo } = req.body;

    const targetAssignedTo = isPrivileged ? (assignedTo || userId) : userId;

    const followup = await FollowUp.create({
      organizationId: orgId,
      leadId,
      customerId,
      assignedTo: targetAssignedTo,
      date: new Date(date),
      time,
      type,
      notes,
      status: 'pending'
    });

    // Update Lead.nextFollowUp if linked
    if (leadId) {
      const currentLead = await Lead.findById(leadId);
      const updateData: any = { nextFollowUp: new Date(date) };
      if (currentLead && currentLead.status !== 'Converted' && currentLead.status !== 'Lost') {
        updateData.status = 'Follow-up';
      }
      await Lead.findByIdAndUpdate(leadId, { $set: updateData });
      
      // Log in Lead Activity timeline
      const formattedDate = new Date(date).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
      await Activity.create({
        organizationId: orgId,
        leadId,
        userId,
        type: 'followup',
        content: `Scheduled a follow-up (${type || 'phone'}) for ${formattedDate} at ${time || '11:00 AM'}.${notes ? ` Notes: ${notes}` : ''}`,
        metadata: { followupId: followup._id, channel: type || 'phone', scheduledDate: date, scheduledTime: time, notes }
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
    const { status, outcome, notes } = req.body;

    const oldFollowup = await FollowUp.findOne({ _id: id, organizationId: orgId });
    if (!oldFollowup) {
      return res.status(404).json({
        success: false,
        message: 'Follow-up task not found.',
        errorCode: 'NOT_FOUND'
      });
    }

    const updatedFollowup = await FollowUp.findByIdAndUpdate(
      id,
      { $set: { status, outcome, notes } },
      { new: true }
    );

    // If completed/cancelled, update activity logs
    if (status && oldFollowup.status !== status) {
      const logContent = status === 'completed' 
        ? `Completed scheduled follow-up. Outcome: ${outcome || 'No outcome recorded.'}`
        : `Cancelled scheduled follow-up.`;

      if (oldFollowup.leadId) {
        await Activity.create({
          organizationId: orgId,
          leadId: oldFollowup.leadId,
          userId,
          type: 'call',
          content: logContent,
          metadata: { followupId: id, status, outcome }
        });

        // Clear nextFollowUp date on lead
        if (status === 'completed') {
          await Lead.findByIdAndUpdate(oldFollowup.leadId, { $unset: { nextFollowUp: 1 } });
        }
      }
    }

    return res.json({
      success: true,
      data: updatedFollowup
    });
  } catch (error) {
    next(error);
  }
}
