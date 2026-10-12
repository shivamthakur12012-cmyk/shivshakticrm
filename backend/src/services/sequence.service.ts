import { FollowUpSequence } from '../models/FollowUpSequence';
import { FollowUp } from '../models/FollowUp';
import { Lead } from '../models/Lead';
import { Activity } from '../models/Activity';
import logger from '../utils/logger';
export class SequenceService {
  /**
   * Initializes default Hot, Warm, and Cold sequences for an organization if none exist
   */
  static async seedDefaultSequences(organizationId: string, createdBy?: string) {
    const orgObjId = organizationId;
    const userObjId = createdBy;
    const existing = await FollowUpSequence.find({ organizationId: orgObjId });
    if (existing.length > 0) return existing;

    const defaultSequences: any[] = [
      {
        organizationId: orgObjId,
        name: '🔥 Hot Lead Multi-Channel Blitz',
        description: 'Aggressive multi-channel sequence combining WhatsApp, direct Phone Calls, and Email for high-intent inquiries.',
        leadTemperature: 'hot',
        isActive: true,
        isDefault: true,
        stopOnReply: true,
        stopOnConversion: true,
        createdBy: userObjId,
        steps: [
          {
            stepNumber: 1,
            channel: 'whatsapp',
            delayDays: 0,
            actionType: 'send_message',
            title: 'Day 0: WhatsApp Welcome & Advisor Intro',
            templateBody: 'Hello {{name}}, welcome to ArthaVenture! Your dedicated advisor is ready to assist with {{service}}. When are you free for a quick 5-min call today?',
            priority: 'urgent'
          },
          {
            stepNumber: 2,
            channel: 'phone',
            delayDays: 0,
            delayHours: 2,
            actionType: 'create_call_task',
            title: 'Day 0: Priority Welcome Discovery Call',
            callObjective: 'Understand immediate service requirements and qualify decision timeline.',
            talkingPoints: ['Confirm specific requirements', 'Explain service package', 'Address immediate questions'],
            priority: 'urgent'
          },
          {
            stepNumber: 3,
            channel: 'email',
            delayDays: 1,
            actionType: 'send_email',
            title: 'Day 1: Comprehensive Proposal & Service Overview',
            templateSubject: 'ArthaVenture Proposal & Service Overview for {{name}}',
            templateBody: '<p>Dear {{name}},</p><p>Thank you for connecting with us regarding <strong>{{service}}</strong>. Attached is our formal service proposal outlining timeline, deliverables, and customized pricing.</p><p>Warm regards,<br/>ArthaVenture Team</p>',
            priority: 'high'
          },
          {
            stepNumber: 4,
            channel: 'phone',
            delayDays: 2,
            actionType: 'create_call_task',
            title: 'Day 2: Quotation Review & Q&A Call',
            callObjective: 'Review proposal feedback and clarify any pricing or document questions.',
            talkingPoints: ['Confirm receipt of proposal email', 'Address any custom requests', 'Offer onboarding schedule'],
            priority: 'high'
          },
          {
            stepNumber: 5,
            channel: 'whatsapp',
            delayDays: 4,
            actionType: 'send_message',
            title: 'Day 4: WhatsApp Document Checklist Reminder',
            templateBody: 'Hi {{name}}, just checking if you have any questions on the proposal. Let us know if you need help with the initial documentation checklist.',
            priority: 'medium'
          },
          {
            stepNumber: 6,
            channel: 'phone',
            delayDays: 7,
            actionType: 'create_call_task',
            title: 'Day 7: Final Opportunity Follow-up Call',
            callObjective: 'Final closing discussion or schedule re-engagement checkpoint.',
            talkingPoints: ['Check if moving forward this quarter', 'Offer special introductory consultation waiver'],
            priority: 'high'
          }
        ]
      },
      {
        organizationId,
        name: '☀️ Warm Lead Strategic Cadence',
        description: 'Balanced multi-channel follow-up cadence alternating WhatsApp, Phone, and Email touchpoints.',
        leadTemperature: 'warm',
        isActive: true,
        isDefault: true,
        stopOnReply: true,
        stopOnConversion: true,
        createdBy,
        steps: [
          {
            stepNumber: 1,
            channel: 'whatsapp',
            delayDays: 0,
            actionType: 'send_message',
            title: 'Day 0: WhatsApp Inquiry Acknowledgement',
            templateBody: 'Hi {{name}}, thank you for inquiring about {{service}}. We have prepared initial details for your review.',
            priority: 'high'
          },
          {
            stepNumber: 2,
            channel: 'phone',
            delayDays: 2,
            actionType: 'create_call_task',
            title: 'Day 2: Discovery & Requirements Call',
            callObjective: 'Understand client context and assess package fit.',
            talkingPoints: ['Inquire about current business status', 'Share relevant case studies'],
            priority: 'medium'
          },
          {
            stepNumber: 3,
            channel: 'email',
            delayDays: 5,
            actionType: 'send_email',
            title: 'Day 5: Case Study & Feature Comparison Email',
            templateSubject: 'How ArthaVenture helped businesses streamline {{service}}',
            templateBody: '<p>Hi {{name}},</p><p>We wanted to share how we helped similar organizations achieve significant efficiency with {{service}}.</p>',
            priority: 'medium'
          },
          {
            stepNumber: 4,
            channel: 'phone',
            delayDays: 8,
            actionType: 'create_call_task',
            title: 'Day 8: Follow-up Checkpoint Call',
            callObjective: 'Review case study reaction and schedule detailed demonstration.',
            talkingPoints: ['Check if client reviewed email', 'Discuss trial or initial milestone'],
            priority: 'medium'
          }
        ]
      },
      {
        organizationId,
        name: '❄️ Cold Lead Nurture & Re-engagement',
        description: 'Low-frequency educational nurture sequence via Email, periodic WhatsApp, and check-in calls.',
        leadTemperature: 'cold',
        isActive: true,
        isDefault: true,
        stopOnReply: true,
        stopOnConversion: true,
        createdBy,
        steps: [
          {
            stepNumber: 1,
            channel: 'email',
            delayDays: 0,
            actionType: 'send_email',
            title: 'Day 0: Introductory Information Pack Email',
            templateSubject: 'Introduction to ArthaVenture Solutions for {{name}}',
            templateBody: '<p>Hello {{name}},</p><p>Explore how ArthaVenture provides seamless financial and compliance solutions for growing businesses.</p>',
            priority: 'low'
          },
          {
            stepNumber: 2,
            channel: 'whatsapp',
            delayDays: 3,
            actionType: 'send_message',
            title: 'Day 3: WhatsApp Resource & Guide Share',
            templateBody: 'Hi {{name}}, here is a quick guide on navigating {{service}} regulations for 2026. Let us know if you find it helpful!',
            priority: 'low'
          },
          {
            stepNumber: 3,
            channel: 'phone',
            delayDays: 7,
            actionType: 'create_call_task',
            title: 'Day 7: Brief Re-engagement Call',
            callObjective: 'Brief 3-minute check-in to determine if requirement is active.',
            talkingPoints: ['Check if looking for solutions currently', 'Update lead status'],
            priority: 'low'
          },
          {
            stepNumber: 4,
            channel: 'email',
            delayDays: 14,
            actionType: 'send_email',
            title: 'Day 14: Industry Insights Newsletter',
            templateSubject: 'Latest Industry Trends & Compliance Updates',
            templateBody: '<p>Dear {{name}},</p><p>Stay ahead with our latest quarterly insights on financial management and compliance.</p>',
            priority: 'low'
          },
          {
            stepNumber: 5,
            channel: 'whatsapp',
            delayDays: 30,
            actionType: 'send_message',
            title: 'Day 30: Re-engagement & Special Offer',
            templateBody: 'Hi {{name}}, we are offering complimentary consultations this month for {{service}}. Would you like to schedule a slot?',
            priority: 'medium'
          }
        ]
      }
    ];

    const created = await FollowUpSequence.insertMany(defaultSequences);
    logger.info(`SequenceService: Seeded ${created.length} default multi-channel sequences.`);
    return created;
  }

  /**
   * Enrolls a lead into a sequence based on lead temperature
   */
  static async enrollLead(leadId: string, organizationId: string, sequenceId?: string) {
    const lead = await Lead.findById(leadId);
    if (!lead) throw new Error('Lead not found.');

    let sequence = null;
    if (sequenceId) {
      sequence = await FollowUpSequence.findById(sequenceId);
    } else {
      const temp = lead.scoreCategory || 'cold';
      sequence = await FollowUpSequence.findOne({
        organizationId,
        leadTemperature: temp,
        isActive: true
      });
      if (!sequence) {
        sequence = await FollowUpSequence.findOne({ organizationId, isActive: true });
      }
    }

    const steps = (sequence?.steps || []) as any[];
    if (!sequence || steps.length === 0) {
      logger.warn(`SequenceService: No active sequence found for lead "${leadId}"`);
      return null;
    }

    // Schedule all sequence steps as FollowUp records
    const scheduledFollowUps = [];
    const baseDate = new Date();

    for (const step of steps) {
      const stepDate = new Date(baseDate);
      stepDate.setDate(stepDate.getDate() + (step.delayDays || 0));

      const followup = await FollowUp.create({
        organizationId,
        leadId: lead._id,
        assignedTo: lead.assignedTo || sequence.createdBy,
        date: stepDate,
        time: step.delayHours ? `${10 + (step.delayHours % 8)}:00 AM` : '11:00 AM',
        channel: step.channel,
        type: step.channel,
        priority: step.priority,
        purpose: step.title,
        notes: step.callObjective || step.templateBody,
        status: 'pending',
        sequenceId: sequence._id,
        sequenceStepNumber: step.stepNumber,
        channelDetails: {
          templateId: step.templateSubject,
          subject: step.templateSubject,
          messageBody: step.templateBody
        }
      });

      scheduledFollowUps.push(followup);
    }

    // Log Activity
    await Activity.create({
      organizationId,
      leadId: lead._id,
      userId: lead.assignedTo || sequence.createdBy,
      type: 'system',
      content: `Enrolled in automated sequence "${sequence.name}" (${steps.length} scheduled multi-channel touchpoints).`
    });

    logger.info(`SequenceService: Lead "${lead.name}" enrolled into sequence "${sequence.name}"`);
    return {
      sequenceName: sequence.name,
      totalStepsScheduled: scheduledFollowUps.length,
      firstFollowUpDate: scheduledFollowUps[0]?.date
    };
  }
}
