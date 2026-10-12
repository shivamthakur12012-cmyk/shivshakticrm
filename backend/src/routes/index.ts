import { Router } from 'express';
import authRoutes from './auth.routes';
import orgRoutes from './organization.routes';
import leadRoutes from './leads.routes';
import quotationRoutes from './quotations.routes';
import assignmentRoutes from './assignment.routes';
import customerRoutes from './customers.routes';
import followupRoutes from './followups.routes';
import taskRoutes from './tasks.routes';
import dealRoutes from './deals.routes';
import caseRoutes from './cases.routes';
import docRoutes from './documents.routes';
import invoiceRoutes from './invoices.routes';
import ticketRoutes from './tickets.routes';
import reportRoutes from './reports.routes';
import workflowRoutes from './workflows.routes';
import aiRoutes from './ai.routes';
import billingRoutes from './billing.routes';
import outreachRoutes from './outreach.routes';
import adminRoutes from './admin.routes';
import webhookRoutes from './webhook.routes';
import mobileSyncRoutes from './mobileSync.routes';
import downloadRoutes from './download.routes';
import { getPublicPlans } from '../controllers/billing.controller';

const router = Router();

// Public dynamic plans endpoint
router.get('/plans', getPublicPlans);

// Public download routes
router.use('/download', downloadRoutes);

// Authentication & Platform Admin routes
router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/webhooks', webhookRoutes);

// Billing & Subscription self-service
router.use('/billing', billingRoutes);

// Organization Management
router.use('/organizations', orgRoutes);

// Protected Tenant CRM Modules (Handled with authenticate and tenantIsolation per sub-router)
router.use('/leads', leadRoutes);
router.use('/quotations', quotationRoutes);
router.use('/assignment', assignmentRoutes);
router.use('/customers', customerRoutes);
router.use('/followups', followupRoutes);
router.use('/outreach', outreachRoutes);
router.use('/tasks', taskRoutes);
router.use('/deals', dealRoutes);
router.use('/cases', caseRoutes);
router.use('/documents', docRoutes);
router.use('/invoices', invoiceRoutes);
router.use('/tickets', ticketRoutes);
router.use('/reports', reportRoutes);
router.use('/workflows', workflowRoutes);
router.use('/ai', aiRoutes);
router.use('/mobile-sync', mobileSyncRoutes);

export default router;
