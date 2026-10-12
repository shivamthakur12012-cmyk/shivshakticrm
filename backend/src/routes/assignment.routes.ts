import { Router } from 'express';
import { 
  getAssignmentConfig, 
  autoAssignUnassignedLeads,
  registerEmployee,
  getEmployeesList,
  toggleEmployeeStatus,
  deleteEmployee
} from '../controllers/adminAssignment.controller';
import { authenticate } from '../middleware/auth.middleware';
import { tenantIsolation } from '../middleware/tenant.middleware';
import { authorize } from '../middleware/rbac.middleware';

const router = Router();

router.use(authenticate, tenantIsolation);

router.get('/config', authorize(['leads:read', 'leads:write']), getAssignmentConfig);
router.post('/auto-assign', authorize(['leads:write']), autoAssignUnassignedLeads);

// Employee & Team Management (Super Admin only for mutations; Managers can view list)
router.get('/employees', authorize(['leads:read', 'leads:write']), getEmployeesList);
router.post('/employees', authorize(['leads:write']), registerEmployee);
router.patch('/employees/:id/status', authorize(['leads:write']), toggleEmployeeStatus);
router.delete('/employees/:id', authorize(['leads:write']), deleteEmployee);

export default router;

