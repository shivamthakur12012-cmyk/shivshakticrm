import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { platformAdminOnly } from '../middleware/subscription.middleware';
import {
  getAdminOverview,
  getAdminPlans,
  createAdminPlan,
  updateAdminPlan,
  toggleAdminPlan,
  getAdminSubscriptions,
  manualAssignAdminSubscription,
  extendAdminSubscription,
  changeAdminSubscriptionPlan,
  suspendAdminSubscription,
  activateAdminSubscription,
  cancelAdminSubscription,
  createAdminCustomSubscription,
  getAdminOrganizations,
  createAdminOrganization,
  deleteAdminOrganization,
  toggleAdminOrganizationSuspension,
  getAdminPayments,
  verifyAndActivateAdminPayment,
  rejectAdminPayment,
  getAdminAuditLogs,
  getAdminIntegrations
} from '../controllers/admin.controller';

const router = Router();

// All admin routes require authentication and platform administrator privileges
router.use(authenticate);
router.use(platformAdminOnly);

// Overview
router.get('/overview', getAdminOverview);

// Platform Integrations Hub
router.get('/integrations', getAdminIntegrations);

// Dynamic Plans CRUD
router.get('/plans', getAdminPlans);
router.post('/plans', createAdminPlan);
router.put('/plans/:id', updateAdminPlan);
router.patch('/plans/:id/toggle', toggleAdminPlan);

// Subscriptions Management
router.get('/subscriptions', getAdminSubscriptions);
router.post('/subscriptions/manual', manualAssignAdminSubscription);
router.post('/subscriptions/custom', createAdminCustomSubscription);
router.post('/subscriptions/:id/extend', extendAdminSubscription);
router.post('/subscriptions/:id/change-plan', changeAdminSubscriptionPlan);
router.post('/subscriptions/:id/suspend', suspendAdminSubscription);
router.post('/subscriptions/:id/activate', activateAdminSubscription);
router.post('/subscriptions/:id/cancel', cancelAdminSubscription);

// Organizations Directory & Provisioning
router.get('/organizations', getAdminOrganizations);
router.post('/organizations', createAdminOrganization);
router.delete('/organizations/:id', deleteAdminOrganization);
router.patch('/organizations/:id/toggle-suspension', toggleAdminOrganizationSuspension);

// Payments & Audits
router.get('/payments', getAdminPayments);
router.post('/payments/:id/verify', verifyAndActivateAdminPayment);
router.post('/payments/:id/reject', rejectAdminPayment);
router.get('/audit-logs', getAdminAuditLogs);

export default router;
