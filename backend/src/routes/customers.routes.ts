import { Router } from 'express';
import { 
  getCustomers, 
  getCustomer, 
  createCustomer, 
  updateCustomer, 
  deleteCustomer 
} from '../controllers/customers.controller';
import { authenticate } from '../middleware/auth.middleware';
import { tenantIsolation } from '../middleware/tenant.middleware';
import { authorize } from '../middleware/rbac.middleware';

const router = Router();

router.use(authenticate, tenantIsolation);

router.get('/', authorize(['customers:read']), getCustomers);
router.get('/:id', authorize(['customers:read']), getCustomer);
router.post('/', authorize(['customers:write']), createCustomer);
router.put('/:id', authorize(['customers:write']), updateCustomer);
router.delete('/:id', authorize(['customers:delete']), deleteCustomer);

export default router;
