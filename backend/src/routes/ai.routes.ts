import { Router } from 'express';
import { askAICopilot } from '../controllers/ai.controller';
import { authenticate } from '../middleware/auth.middleware';
import { tenantIsolation } from '../middleware/tenant.middleware';

const router = Router();

router.use(authenticate, tenantIsolation);

router.post('/chat', askAICopilot);

export default router;
