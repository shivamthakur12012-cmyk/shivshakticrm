import { Router } from 'express';
import { getReportsSummary, getCrmDashboardMetrics } from '../controllers/reports.controller';
import { authenticate } from '../middleware/auth.middleware';
import { tenantIsolation } from '../middleware/tenant.middleware';
import { authorize } from '../middleware/rbac.middleware';

const router = Router();

router.use(authenticate, tenantIsolation);

router.get('/summary', authorize(['accounting:read']), getReportsSummary);
router.get('/crm-dashboard', authorize(['leads:read']), getCrmDashboardMetrics);

export default router;
