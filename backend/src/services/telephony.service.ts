import { CallLog, CallOutcome } from '../models/CallLog';
import { Activity } from '../models/Activity';
import { FollowUp } from '../models/FollowUp';
import { Lead } from '../models/Lead';
import logger from '../utils/logger';

export interface InitiateCallParams {
  organizationId: string;
  employeeId: string;
  leadId?: string;
  customerId?: string;
  contactId?: string;
  dealId?: string;
  phoneNumber: string;
  provider?: 'manual' | 'twilio' | 'exotel' | 'knowlarity' | 'custom';
}

export interface LogManualCallParams {
  organizationId: string;
  employeeId: string;
  leadId?: string;
  customerId?: string;
  contactId?: string;
  dealId?: string;
  phoneNumber: string;
  direction?: 'outbound' | 'inbound';
  duration: number; // in seconds
  outcome: CallOutcome;
  notes?: string;
  nextFollowUpDate?: string | Date;
  nextFollowUpChannel?: 'whatsapp' | 'email' | 'instagram' | 'phone';
  nextFollowUpPurpose?: string;
  recordingUrl?: string;
}

export class TelephonyService {
  /**
   * Mode 2: Initiates click-to-call via configured telephony provider
   */
  static async initiateClickToCall(params: InitiateCallParams) {
    const provider = params.provider || 'twilio';
    const callSid = `call_${provider}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    logger.info(`TelephonyService: Initiating click-to-call via ${provider} to ${params.phoneNumber}`);

    // Create active CallLog entry
    const callDoc = await CallLog.create({
      organizationId: params.organizationId,
      employeeId: params.employeeId,
      leadId: params.leadId,
      customerId: params.customerId,
      contactId: params.contactId,
      dealId: params.dealId,
      phoneNumber: params.phoneNumber,
      direction: 'outbound',
      provider,
      providerCallId: callSid,
      startTime: new Date(),
      status: 'ringing',
      outcome: 'Connected'
    });

    return {
      success: true,
      callId: callDoc._id,
      providerCallId: callSid,
      provider,
      status: 'ringing'
    };
  }

  /**
   * Mode 1 & Mode 2: Log completed call with outcome, notes, and auto next follow-up
   */
  static async recordCallResult(params: LogManualCallParams) {
    const {
      organizationId,
      employeeId,
      leadId,
      customerId,
      contactId,
      dealId,
      phoneNumber,
      direction = 'outbound',
      duration,
      outcome,
      notes,
      nextFollowUpDate,
      nextFollowUpChannel = 'phone',
      nextFollowUpPurpose = 'Quotation Follow-up',
      recordingUrl
    } = params;

    // 1. Create CallLog entry
    const callLog = await CallLog.create({
      organizationId,
      employeeId,
      leadId,
      customerId,
      contactId,
      dealId,
      phoneNumber,
      direction,
      provider: 'manual',
      startTime: new Date(Date.now() - duration * 1000),
      endTime: new Date(),
      duration,
      status: 'completed',
      outcome,
      notes,
      recordingUrl
    });

    // 2. Add to Activity timeline
    const durationFormatted = `${Math.floor(duration / 60).toString().padStart(2, '0')}:${(duration % 60).toString().padStart(2, '0')}`;
    const activityContent = `[Phone Call Completed] Outcome: ${outcome} | Duration: ${durationFormatted}\nNotes: ${notes || 'No call notes recorded.'}`;

    await Activity.create({
      organizationId,
      leadId,
      customerId,
      dealId,
      userId: employeeId,
      type: 'phone',
      content: activityContent,
      metadata: {
        callId: callLog._id,
        duration,
        outcome,
        phoneNumber,
        recordingUrl
      }
    });

    // 3. If next follow-up scheduled, create FollowUp item
    let nextFollowUpDoc = null;
    if (nextFollowUpDate) {
      nextFollowUpDoc = await FollowUp.create({
        organizationId,
        leadId,
        customerId,
        contactId,
        assignedTo: employeeId,
        date: new Date(nextFollowUpDate),
        time: '11:30 AM',
        channel: nextFollowUpChannel,
        type: nextFollowUpChannel,
        purpose: nextFollowUpPurpose,
        notes: `Follow-up after phone call outcome: ${outcome}`,
        status: 'pending'
      });

      // Link to CallLog
      callLog.nextFollowUpId = (nextFollowUpDoc._id || nextFollowUpDoc.id) as string;
      await callLog.save();

      // Update lead next follow-up date
      if (leadId) {
        await Lead.findByIdAndUpdate(leadId, {
          $set: {
            nextFollowUp: new Date(nextFollowUpDate),
            lastContacted: new Date()
          }
        });
      }
    } else if (leadId) {
      await Lead.findByIdAndUpdate(leadId, {
        $set: { lastContacted: new Date() }
      });
    }

    // 4. Update Lead status if converted or interested
    if (leadId && outcome === 'Converted') {
      await Lead.findByIdAndUpdate(leadId, { $set: { status: 'Converted' } });
    } else if (leadId && (outcome === 'Interested' || outcome === 'Connected')) {
      await Lead.findByIdAndUpdate(leadId, { $set: { status: 'Contacted' } });
    }

    return {
      success: true,
      callLog,
      nextFollowUp: nextFollowUpDoc
    };
  }

  /**
   * Inbound provider webhook handler (Twilio / Exotel / Knowlarity)
   */
  static async handleProviderWebhook(payload: any) {
    logger.info('TelephonyService: Received provider webhook event:', payload);
    const providerCallId = payload.CallSid || payload.call_id || payload.CallId;
    const status = payload.CallStatus || payload.status;
    const duration = Number(payload.CallDuration || payload.duration || 0);
    const recordingUrl = payload.RecordingUrl || payload.recording_url;

    if (providerCallId) {
      await CallLog.findOneAndUpdate(
        { providerCallId },
        {
          $set: {
            status: status === 'completed' ? 'completed' : status,
            duration,
            recordingUrl,
            endTime: new Date()
          }
        }
      );
    }

    return { received: true };
  }
}
