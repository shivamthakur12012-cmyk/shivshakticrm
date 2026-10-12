import { Router } from 'express';
import { getFollowUps, createFollowUp, updateFollowUp } from '../controllers/followups.controller';
import { authenticate } from '../middleware/auth.middleware';
import { tenantIsolation } from '../middleware/tenant.middleware';
import { authorize } from '../middleware/rbac.middleware';

const router = Router();

router.use(authenticate, tenantIsolation);

router.get('/', authorize(['leads:read']), getFollowUps);
router.post('/', authorize(['leads:write']), createFollowUp);
router.put('/:id', authorize(['leads:write']), updateFollowUp);

export default router;
