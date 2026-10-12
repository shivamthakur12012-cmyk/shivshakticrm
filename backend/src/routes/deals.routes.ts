import { Router } from 'express';
import { 
  getPipelines, 
  createPipeline, 
  getDeals, 
  getDeal, 
  createDeal, 
  updateDeal, 
  updateDealStage, 
  deleteDeal 
} from '../controllers/deals.controller';
import { authenticate } from '../middleware/auth.middleware';
import { tenantIsolation } from '../middleware/tenant.middleware';
import { authorize } from '../middleware/rbac.middleware';

const router = Router();

router.use(authenticate, tenantIsolation);

router.get('/pipelines', authorize(['sales:read']), getPipelines);
router.post('/pipelines', authorize(['sales:write']), createPipeline);

router.get('/', authorize(['sales:read']), getDeals);
router.get('/:id', authorize(['sales:read']), getDeal);
router.post('/', authorize(['sales:write']), createDeal);
router.put('/:id', authorize(['sales:write']), updateDeal);
router.put('/:id/stage', authorize(['sales:write']), updateDealStage);
router.delete('/:id', authorize(['sales:delete']), deleteDeal);

export default router;
