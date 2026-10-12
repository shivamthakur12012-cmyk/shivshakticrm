import { Router } from 'express';
import { 
  getWorkflows, 
  createWorkflow, 
  updateWorkflow, 
  toggleWorkflowActive, 
  deleteWorkflow 
} from '../controllers/workflows.controller';
import { authenticate } from '../middleware/auth.middleware';
import { tenantIsolation } from '../middleware/tenant.middleware';
import { authorize } from '../middleware/rbac.middleware';

const router = Router();

router.use(authenticate, tenantIsolation);

router.get('/', authorize(['settings:read']), getWorkflows);
router.post('/', authorize(['settings:write']), createWorkflow);
router.put('/:id', authorize(['settings:write']), updateWorkflow);
router.put('/:id/toggle', authorize(['settings:write']), toggleWorkflowActive);
router.delete('/:id', authorize(['settings:write']), deleteWorkflow);

export default router;
