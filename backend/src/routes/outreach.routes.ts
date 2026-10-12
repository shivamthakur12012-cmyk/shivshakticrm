import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { tenantIsolation } from '../middleware/tenant.middleware';
import {
  getFollowUps,
  createFollowUp,
  updateFollowUp,
  deleteFollowUp,
  bulkCreateFollowUps,
  logManualCall,
  initiateClickToCall,
  getCallDashboard,
  getCallLogs,
  getCallBrief,
  analyzeCallOutcome,
  sendEmail,
  sendWhatsAppMessage,
  sendInstagramMessage,
  getSequences,
  updateSequence,
  enrollLeadInSequence,
  getCampaigns,
  createCampaign,
  getOutreachAnalytics,
  getCommunicationConsent,
  updateCommunicationConsent,
  getNextActionRecommendation,
  handleTelephonyWebhook
} from '../controllers/outreach.controller';

const router = Router();

// Inbound Telephony webhook (public endpoint)
router.post('/telephony/webhook', handleTelephonyWebhook);

// Protected routes (require auth and tenant isolation)
router.use(authenticate, tenantIsolation);

// 1. Follow-up Schedules (Strictly 4 Channels)
router.get('/followups', getFollowUps);
router.post('/followups', createFollowUp);
router.put('/followups/:id', updateFollowUp);
router.delete('/followups/:id', deleteFollowUp);
router.post('/followups/bulk', bulkCreateFollowUps);

// 2. Phone / Call Management & AI Assistant
router.get('/calls/dashboard', getCallDashboard);
router.get('/calls/logs', getCallLogs);
router.post('/calls/manual', logManualCall);
router.post('/calls/click-to-call', initiateClickToCall);
router.get('/calls/:id/ai-brief', getCallBrief);
router.post('/calls/ai-analyze', analyzeCallOutcome);

// 3. Multi-Channel Dispatchers (Email via MailerCloud, WA, IG)
router.post('/email/send', sendEmail);
router.post('/whatsapp/send', sendWhatsAppMessage);
router.post('/instagram/send', sendInstagramMessage);

// 4. Automated Sequences & Campaigns
router.get('/sequences', getSequences);
router.put('/sequences/:id', updateSequence);
router.post('/sequences/enroll', enrollLeadInSequence);
router.get('/campaigns', getCampaigns);
router.post('/campaigns', createCampaign);

// 5. Analytics & Consent Management
router.get('/analytics', getOutreachAnalytics);
router.get('/consent/:entityType/:entityId', getCommunicationConsent);
router.put('/consent/:entityType/:entityId', updateCommunicationConsent);
router.get('/ai-recommendation/:leadId', getNextActionRecommendation);

export default router;
