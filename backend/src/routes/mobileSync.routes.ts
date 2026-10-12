import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { tenantIsolation } from '../middleware/tenant.middleware';
import { Lead } from '../models/Lead';
import { Customer } from '../models/Customer';
import { FollowUp } from '../models/FollowUp';
import { Activity } from '../models/Activity';
import { User } from '../models/User';
import logger from '../utils/logger';

const router = Router();

// Apply auth and tenant isolation
router.use(authenticate, tenantIsolation);

/**
 * Helper to normalize phone numbers (strip non-digits, extracts last 10 digits for search)
 */
function normalizePhone(raw: string): string {
  if (!raw) return '';
  const digitsOnly = raw.replace(/\D/g, '');
  if (digitsOnly.length >= 10) {
    return digitsOnly.slice(-10);
  }
  return digitsOnly;
}

/**
 * 1. BATCH SYNC CALL LOGS FROM ANDROID PHONES (₹0 Telephony Sync)
 */
router.post('/calls', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.organizationId;
    const userId = req.user?.id;
    const { callLogs, deviceName = 'Android Phone' } = req.body;

    if (!Array.isArray(callLogs) || callLogs.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid array of callLogs is required.',
        errorCode: 'EMPTY_CALL_LOGS'
      });
    }

    const employee = await User.findById(userId);
    const employeeName = employee ? `${employee.firstName} ${employee.lastName}` : 'Sales Agent';

    let syncedCount = 0;
    let matchedLeadCount = 0;
    let matchedCustomerCount = 0;
    const processedLogs: any[] = [];
    const seenInBatch = new Set<string>();

    for (const log of callLogs) {
      const {
        phoneNumber,
        contactName,
        callType = 'OUTGOING', // INCOMING, OUTGOING, MISSED, REJECTED
        duration = 0, // in seconds
        timestamp,
        notes = '',
        simSlot = 1
      } = log;

      if (!phoneNumber) continue;

      const norm = normalizePhone(phoneNumber);
      const callDate = timestamp ? new Date(Number(timestamp)) : new Date();

      // Deduplicate within the same request batch
      const batchKey = `${norm}_${Math.floor(callDate.getTime() / 30000)}`;
      if (seenInBatch.has(batchKey)) {
        continue;
      }
      seenInBatch.add(batchKey);

      // Find matching Lead in organization across phone, whatsApp, and alternatePhone
      let matchedLead = await Lead.findOne({
        organizationId: orgId,
        isDeleted: false,
        $or: [
          { phone: { $regex: norm } },
          { whatsApp: { $regex: norm } },
          { alternatePhone: { $regex: norm } }
        ]
      });

      // Find matching Customer if no Lead
      let matchedCustomer = null;
      if (!matchedLead) {
        matchedCustomer = await Customer.findOne({
          organizationId: orgId,
          isDeleted: false,
          $or: [
            { phone: { $regex: norm } },
            { alternatePhone: { $regex: norm } }
          ]
        });
      }

      // Filter: Ignore calls that do not match any CRM Lead or Customer
      if (!matchedLead && !matchedCustomer) {
        continue;
      }

      if (matchedLead) matchedLeadCount++;
      if (matchedCustomer) matchedCustomerCount++;

      // Prevent exact duplicate insertion within 90-second window, or update if duration is now more accurate
      const windowStart = new Date(callDate.getTime() - 90000);
      const windowEnd = new Date(callDate.getTime() + 90000);

      const existingFollowUp = await FollowUp.findOne({
        organizationId: orgId,
        assignedTo: userId,
        channel: 'phone',
        date: { $gte: windowStart, $lte: windowEnd },
        purpose: { $regex: norm }
      });

      const numDuration = Number(duration) || 0;
      const outcome = numDuration > 0 
        ? 'Connected' 
        : (callType === 'MISSED' || callType === 'REJECTED' ? 'Missed / Rejected' : 'No Answer');

      if (existingFollowUp) {
        const details = (existingFollowUp.channelDetails as any) || {};
        const prevDuration = Number(details.callDuration) || 0;
        // If the new sync has greater duration or updates a 0s/No-Answer entry to actual talk time
        if (numDuration > prevDuration || (prevDuration === 0 && numDuration > 0) || (existingFollowUp.outcome !== 'Connected' && outcome === 'Connected')) {
          existingFollowUp.outcome = outcome;
          existingFollowUp.notes = notes || `Call duration: ${numDuration}s via SIM ${simSlot}. (${deviceName})`;
          existingFollowUp.channelDetails = {
            ...details,
            callDuration: numDuration,
            callOutcome: outcome,
            simSlot,
            callType,
            phoneNumber,
            contactName,
            deviceName
          };
          await existingFollowUp.save();

          // Update corresponding Activity on Lead Timeline
          if (matchedLead) {
            await Activity.findOneAndUpdate(
              {
                organizationId: orgId,
                leadId: matchedLead._id,
                type: 'call',
                createdAt: { $gte: windowStart, $lte: windowEnd }
              },
              {
                content: `📱 SIM Call (${callType}): ${numDuration}s connected with ${matchedLead.name}. Logged by ${employeeName} via Android SIM.`,
                metadata: {
                  channel: 'phone',
                  duration: numDuration,
                  callType,
                  simSlot,
                  phoneNumber,
                  source: 'android_sim_sync'
                }
              }
            );

            matchedLead.lastFollowUpDate = callDate;
            matchedLead.lastContacted = callDate;
            await matchedLead.save();
          }

          syncedCount++;
          processedLogs.push({
            followUpId: existingFollowUp._id,
            phoneNumber,
            matchedLead: matchedLead ? { id: matchedLead._id, name: matchedLead.name, leadId: matchedLead.leadId } : null,
            matchedCustomer: matchedCustomer ? { id: matchedCustomer._id, name: matchedCustomer.name } : null,
            duration: numDuration,
            callType,
            updated: true
          });
        }
        continue;
      }

      // Create FollowUp record
      const followUp = await FollowUp.create({
        organizationId: orgId,
        leadId: matchedLead?._id,
        customerId: matchedCustomer?._id,
        assignedTo: userId,
        type: 'phone',
        channel: 'phone',
        date: callDate,
        purpose: `SIM Call (${callType}) — ${contactName || phoneNumber} [${norm}]`,
        status: 'completed',
        outcome,
        notes: notes || `Call duration: ${numDuration}s via SIM ${simSlot}. (${deviceName})`,
        channelDetails: {
          callDuration: numDuration,
          callOutcome: outcome,
          source: 'android_sim_sync',
          simSlot,
          callType,
          phoneNumber,
          contactName,
          deviceName
        }
      });

      // If matched with Lead, update Lead timeline and timestamps
      if (matchedLead) {
        await Activity.create({
          organizationId: orgId,
          leadId: matchedLead._id,
          userId,
          type: 'call',
          content: `📱 SIM Call (${callType}): ${numDuration}s connected with ${matchedLead.name}. Logged by ${employeeName} via Android SIM.`,
          metadata: {
            channel: 'phone',
            duration: numDuration,
            callType,
            simSlot,
            phoneNumber,
            source: 'android_sim_sync'
          }
        });

        matchedLead.lastFollowUpDate = callDate;
        matchedLead.lastContacted = callDate;
        if (matchedLead.status === 'New') {
          matchedLead.status = 'Open';
        }
        await matchedLead.save();
      }

      syncedCount++;
      processedLogs.push({
        followUpId: followUp._id,
        phoneNumber,
        matchedLead: matchedLead ? { id: matchedLead._id, name: matchedLead.name, leadId: matchedLead.leadId } : null,
        matchedCustomer: matchedCustomer ? { id: matchedCustomer._id, name: matchedCustomer.name } : null,
        duration: numDuration,
        callType
      });
    }

    logger.info(`[MobileSync] Synced ${syncedCount} call(s) for user ${employeeName}`);

    return res.json({
      success: true,
      message: `Successfully synced ${syncedCount} call log(s) from ${deviceName}.`,
      data: {
        syncedCount,
        matchedLeadCount,
        matchedCustomerCount,
        logs: processedLogs
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 2. GET ASSIGNED LEADS FOR OFFLINE / FAST CALLER ID ON MOBILE
 */
router.get('/assigned-leads', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.organizationId;
    const userId = req.user?.id;
    const userRole = (req as any).userRole;
    const isPrivileged = ['Admin', 'Super Admin', 'Manager', 'Team Leader'].includes(userRole);

    const filter: any = { organizationId: orgId, isDeleted: false };
    if (!isPrivileged) {
      filter.assignedTo = userId;
    }

    const leads = await Lead.find(filter)
      .select('_id leadId name company phone status source priority')
      .sort({ updatedAt: -1 })
      .limit(500);

    return res.json({
      success: true,
      data: leads
    });
  } catch (error) {
    next(error);
  }
});

router.get('/logs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.organizationId;
    const userId = req.user?.id;
    const userRole = (req as any).userRole;
    const isPrivileged = ['Admin', 'Super Admin', 'Manager', 'Team Leader'].includes(userRole);
    const { employeeId } = req.query;

    const filter: any = {
      organizationId: orgId,
      channel: 'phone',
      purpose: { $regex: /SIM Call/i },
      $or: [
        { leadId: { $ne: null } },
        { customerId: { $ne: null } }
      ]
    };

    if (!isPrivileged) {
      filter.assignedTo = userId;
    } else if (employeeId) {
      filter.assignedTo = employeeId;
    }

    const logs = await FollowUp.find(filter)
      .populate('assignedTo', 'firstName lastName email')
      .populate('leadId', 'name leadId company phone status')
      .populate('customerId', 'name customerId phone')
      .sort({ date: -1 })
      .limit(100);

    return res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    next(error);
  }
});

export default router;
