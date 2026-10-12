import { Lead } from '../models/Lead';
import { Customer } from '../models/Customer';
import { Activity } from '../models/Activity';
import { Deal } from '../models/Deal';
import { Invoice } from '../models/Invoice';
import { CallLog } from '../models/CallLog';
import logger from '../utils/logger';

export class AIOutreachService {
  /**
   * Generates a comprehensive Before-Call Brief for sales reps
   */
  static async generateCallBrief(leadIdOrCustomerId: string, isCustomer = false) {
    try {
      let entity: any = null;
      let activities: any[] = [];
      let deals: any[] = [];
      let invoices: any[] = [];
      let callLogs: any[] = [];

      if (isCustomer) {
        entity = await Customer.findById(leadIdOrCustomerId);
        if (entity) {
          activities = await Activity.find({ customerId: entity._id }).sort({ createdAt: -1 }).limit(10);
          deals = await Deal.find({ customerId: entity._id, isDeleted: false });
          invoices = await Invoice.find({ customerId: entity._id, isDeleted: false });
          callLogs = await CallLog.find({ customerId: entity._id }).sort({ createdAt: -1 }).limit(5);
        }
      } else {
        entity = await Lead.findById(leadIdOrCustomerId);
        if (entity) {
          activities = await Activity.find({ leadId: entity._id }).sort({ createdAt: -1 }).limit(10);
          deals = await Deal.find({ leadId: entity._id, isDeleted: false });
          callLogs = await CallLog.find({ leadId: entity._id }).sort({ createdAt: -1 }).limit(5);
        }
      }

      if (!entity) {
        throw new Error('Entity not found for call brief generation.');
      }

      const name = entity.name || `${entity.firstName || ''} ${entity.lastName || ''}`.trim();
      const service = entity.serviceInterested || entity.productInterested || (deals[0]?.name) || 'General Advisory';
      const lastActivity = activities[0];
      const lastCall = callLogs[0];

      // Build realistic, contextual talking points based on live CRM state
      const talkingPoints: string[] = [
        `Confirm requirement for ${service}`,
        `Follow up on previous discussion (${lastActivity ? lastActivity.type : 'initial contact'})`,
        entity.expectedValue ? `Discuss package details aligned with ₹${entity.expectedValue.toLocaleString()} budget` : 'Clarify expected service volume or budget',
        'Identify missing documents or immediate blockers',
        'Agree on concrete next steps and schedule next checkpoint'
      ];

      const dealContext = deals.length > 0
        ? `Active deal "${deals[0].name}" at stage "${deals[0].stage || 'In Discussion'}" valued at ₹${deals[0].amount.toLocaleString()}`
        : entity.expectedValue ? `Potential opportunity valued at ₹${entity.expectedValue.toLocaleString()}` : 'New sales inquiry';

      const brief = {
        leadName: name,
        company: entity.company || entity.companyName || 'Individual Client',
        phone: entity.phone || entity.whatsApp || 'N/A',
        serviceInterested: service,
        scoreCategory: entity.scoreCategory || 'warm',
        score: entity.score || 50,
        dealContext,
        lastInteraction: lastActivity ? `${lastActivity.type.toUpperCase()}: ${lastActivity.content.substring(0, 80)}...` : 'No prior interactions',
        lastCallOutcome: lastCall ? `${lastCall.outcome} (${new Date(lastCall.createdAt).toLocaleDateString()})` : 'First call attempt',
        recommendedObjective: entity.status === 'New' 
          ? 'Qualify requirements and establish decision-maker timeline'
          : entity.status === 'Proposal Sent' 
          ? 'Address quotation questions and secure verbal approval'
          : 'Confirm document requirements and finalize onboarding schedule',
        suggestedTalkingPoints: talkingPoints,
        riskFactors: [
          entity.scoreCategory === 'cold' ? 'Lead has low engagement score (Cold) — keep conversation concise' : null,
          invoices.some(i => i.status === 'overdue') ? 'Outstanding invoice overdue on account' : null
        ].filter(Boolean) as string[]
      };

      logger.info(`AIOutreachService: Generated call brief for ${name}`);
      return brief;
    } catch (error: any) {
      logger.error('AIOutreachService error generating call brief:', error);
      throw error;
    }
  }

  /**
   * Analyzes call outcome and notes to recommend next channel, action, and follow-up
   */
  static async analyzePostCall(callNotes: string, outcome: string, leadName = 'Client') {
    const text = (callNotes || '').toLowerCase();
    
    let summary = `Call with ${leadName} concluded with outcome "${outcome}".`;
    const detectedObjections: string[] = [];
    const extractedRequirements: string[] = [];
    let recommendedChannel: 'whatsapp' | 'email' | 'instagram' | 'phone' = 'whatsapp';
    let recommendedNextAction = 'Send WhatsApp follow-up with quotation and details.';
    let daysOffset = 1;

    // Detect Objections
    if (text.includes('price') || text.includes('cost') || text.includes('expensive') || text.includes('discount') || text.includes('budget')) {
      detectedObjections.push('Pricing & Budget constraints');
    }
    if (text.includes('competitor') || text.includes('already using') || text.includes('other vendor')) {
      detectedObjections.push('Competitor comparison');
    }
    if (text.includes('time') || text.includes('busy') || text.includes('later') || text.includes('next month')) {
      detectedObjections.push('Timeline & Bandwidth delay');
    }
    if (text.includes('decision') || text.includes('partner') || text.includes('boss') || text.includes('director')) {
      detectedObjections.push('Secondary decision maker approval needed');
    }

    // Detect Requirements
    if (text.includes('loan') || text.includes('funding') || text.includes('finance')) {
      extractedRequirements.push('Business Loan / Funding eligibility assessment');
    }
    if (text.includes('gst') || text.includes('tax') || text.includes('filing')) {
      extractedRequirements.push('GST Registration & Compliance service');
    }
    if (text.includes('quotation') || text.includes('quote') || text.includes('proposal')) {
      extractedRequirements.push('Formal revised quotation');
    }
    if (text.includes('document') || text.includes('kyc') || text.includes('pan') || text.includes('aadhaar')) {
      extractedRequirements.push('Document checklist submission');
    }

    // Determine Next Best Action & Channel
    switch (outcome) {
      case 'Interested':
        recommendedChannel = 'whatsapp';
        recommendedNextAction = 'Send official WhatsApp quotation & document checklist within 1 hour.';
        daysOffset = 1;
        summary += ` ${leadName} exhibited high interest. Proceeding to formal proposal stage.`;
        break;

      case 'Call Back Later':
        recommendedChannel = 'phone';
        recommendedNextAction = 'Schedule priority call follow-up for the requested time slot.';
        daysOffset = 2;
        summary += ` Customer requested a callback. Follow up on the agreed time window.`;
        break;

      case 'No Answer':
      case 'Busy':
      case 'Switched Off':
        recommendedChannel = 'whatsapp';
        recommendedNextAction = 'Send automated WhatsApp touchpoint ("Tried reaching you regarding your inquiry").';
        daysOffset = 1;
        summary += ` Call attempt unanswered. Triggering gentle multi-channel follow-up.`;
        break;

      case 'Converted':
        recommendedChannel = 'email';
        recommendedNextAction = 'Send formal onboarding welcome email with invoice and client agreement.';
        daysOffset = 0;
        summary += ` Deal successfully converted! Moving to onboarding and service kickoff.`;
        break;

      case 'Not Interested':
      case 'Wrong Number':
        recommendedChannel = 'email';
        recommendedNextAction = 'Add to low-frequency monthly newsletter drip or archive lead.';
        daysOffset = 30;
        summary += ` Lead not currently qualified. Pausing aggressive outreach.`;
        break;

      default:
        recommendedChannel = 'phone';
        recommendedNextAction = 'Schedule standard follow-up checkpoint.';
        daysOffset = 3;
    }

    const suggestedFollowUpDate = new Date();
    suggestedFollowUpDate.setDate(suggestedFollowUpDate.getDate() + daysOffset);

    return {
      summary,
      detectedObjections,
      extractedRequirements,
      recommendedChannel,
      recommendedNextAction,
      suggestedFollowUpDate: suggestedFollowUpDate.toISOString().split('T')[0],
      sentimentScore: outcome === 'Interested' || outcome === 'Converted' ? 85 : outcome === 'Not Interested' ? 25 : 55
    };
  }

  /**
   * Cross-Channel Next-Action Recommendation across WhatsApp, Email, Instagram, and Phone
   */
  static async getNextActionRecommendation(leadId: string) {
    const lead = await Lead.findById(leadId);
    if (!lead) throw new Error('Lead not found.');

    const activities = await Activity.find({ leadId: lead._id }).sort({ createdAt: -1 }).limit(10);
    const callLogs = await CallLog.find({ leadId: lead._id }).sort({ createdAt: -1 }).limit(5);

    const channelCounts = {
      phone: activities.filter(a => a.type === 'phone' || a.type === 'call').length,
      whatsapp: activities.filter(a => a.type === 'whatsapp').length,
      email: activities.filter(a => a.type === 'email').length,
      instagram: activities.filter(a => a.type === 'instagram').length
    };

    let recommendedChannel: 'whatsapp' | 'email' | 'instagram' | 'phone' = 'phone';
    let reason = '';
    let action = '';

    const lastCall = callLogs[0];
    const lastActivity = activities[0];

    if (!lastActivity) {
      if (lead.scoreCategory === 'hot' || lead.scoreCategory === 'very_hot') {
        recommendedChannel = 'phone';
        reason = 'High lead score (Hot). Direct voice call yields the highest immediate conversion rate.';
        action = 'Make initial introductory phone call and establish decision timeline.';
      } else {
        recommendedChannel = 'whatsapp';
        reason = 'New inquiry with initial contact needed via instant messaging.';
        action = 'Send WhatsApp Welcome & Service Introduction template.';
      }
    } else if (lastCall && lastCall.outcome === 'Interested') {
      recommendedChannel = 'whatsapp';
      reason = 'Lead expressed interest during the recent phone call. WhatsApp provides the quickest medium for sharing quotations and document checklists.';
      action = 'Send WhatsApp quotation and confirm receipt.';
    } else if (lastCall && (lastCall.outcome === 'No Answer' || lastCall.outcome === 'Busy')) {
      recommendedChannel = 'whatsapp';
      reason = 'Voice call went unanswered. A quick WhatsApp touchpoint confirms availability without being intrusive.';
      action = 'Send gentle WhatsApp check-in: "Hi, tried calling you regarding your inquiry..."';
    } else if (channelCounts.phone > 0 && channelCounts.whatsapp > 0 && channelCounts.email === 0) {
      recommendedChannel = 'email';
      reason = 'Customer has phone & WhatsApp touchpoints. An official email creates a professional written record and detailed proposal overview.';
      action = 'Send detailed proposal email via MailerCloud with formal presentation attached.';
    } else if (lead.source === 'Instagram' && channelCounts.instagram === 0) {
      recommendedChannel = 'instagram';
      reason = 'Inquiry originated from Instagram Direct/Ad. Re-engaging on the discovery platform ensures familiarity.';
      action = 'Reply via Instagram Direct Message with service overview.';
    } else {
      recommendedChannel = 'phone';
      reason = 'Follow-up checkpoint required to review progress and answer client questions.';
      action = 'Schedule direct phone call to address pending inquiries.';
    }

    return {
      leadId: lead._id,
      leadName: lead.name,
      leadTemperature: lead.scoreCategory,
      recommendedChannel,
      reason,
      action,
      historySummary: {
        totalInteractions: activities.length,
        channelCounts,
        lastInteractionDate: lastActivity?.createdAt,
        lastInteractionType: lastActivity?.type
      }
    };
  }
}
