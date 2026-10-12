import { Router } from 'express';
import { 
  getInvoices, 
  getInvoice, 
  createInvoice, 
  transitionInvoiceStatus, 
  recordPayment 
} from '../controllers/invoices.controller';
import { authenticate } from '../middleware/auth.middleware';
import { tenantIsolation } from '../middleware/tenant.middleware';
import { authorize } from '../middleware/rbac.middleware';

const router = Router();

router.use(authenticate, tenantIsolation);

router.get('/', authorize(['accounting:read']), getInvoices);
router.get('/:id', authorize(['accounting:read']), getInvoice);
router.post('/', authorize(['accounting:write']), createInvoice);
router.put('/:id/status', authorize(['accounting:write']), transitionInvoiceStatus);
router.post('/:id/payments', authorize(['accounting:write']), recordPayment);

export default router;
