import { Router } from 'express';
import { 
  getCases, 
  getCase, 
  createCase, 
  updateCaseStage, 
  updateCaseChecklistItem 
} from '../controllers/cases.controller';
import { authenticate } from '../middleware/auth.middleware';
import { tenantIsolation } from '../middleware/tenant.middleware';
import { authorize } from '../middleware/rbac.middleware';

const router = Router();

router.use(authenticate, tenantIsolation);

router.get('/', authorize(['sales:read']), getCases);
router.get('/:id', authorize(['sales:read']), getCase);
router.post('/', authorize(['sales:write']), createCase);
router.put('/:id/stage', authorize(['sales:write']), updateCaseStage);
router.put('/:id/checklist/:itemId', authorize(['sales:write']), updateCaseChecklistItem);

export default router;
