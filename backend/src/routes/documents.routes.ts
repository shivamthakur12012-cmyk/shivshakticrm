import { Router } from 'express';
import { 
  uploadCaseDocument, 
  downloadDocument, 
  deleteDocument,
  uploadMiddleware
} from '../controllers/documents.controller';
import { authenticate } from '../middleware/auth.middleware';
import { tenantIsolation } from '../middleware/tenant.middleware';
import { authorize } from '../middleware/rbac.middleware';

const router = Router();

router.use(authenticate, tenantIsolation);

router.post('/cases/:id/upload/:itemId', authorize(['sales:write']), uploadMiddleware.single('file'), uploadCaseDocument);
router.get('/:id/download', authorize(['sales:read']), downloadDocument);
router.delete('/:id', authorize(['sales:write']), deleteDocument);

export default router;
