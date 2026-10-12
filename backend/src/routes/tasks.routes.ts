import { Router } from 'express';
import { getTasks, createTask, updateTask, deleteTask } from '../controllers/tasks.controller';
import { authenticate } from '../middleware/auth.middleware';
import { tenantIsolation } from '../middleware/tenant.middleware';
import { authorize } from '../middleware/rbac.middleware';

const router = Router();

router.use(authenticate, tenantIsolation);

router.get('/', authorize(['leads:read']), getTasks);
router.post('/', authorize(['leads:write']), createTask);
router.put('/:id', authorize(['leads:write']), updateTask);
router.delete('/:id', authorize(['leads:delete']), deleteTask);

export default router;
