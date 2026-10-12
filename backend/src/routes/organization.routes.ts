import { Router } from 'express';
import { onboard, getOrganization, updateOrganization } from '../controllers/organization.controller';
import { authenticate } from '../middleware/auth.middleware';
import { tenantIsolation } from '../middleware/tenant.middleware';
import { authorize } from '../middleware/rbac.middleware';
import { validateBody } from '../middleware/validate.middleware';
import { onboardSchema, updateOrgSchema } from '../validators/organization.validator';

const router = Router();

// Onboarding doesn't check tenant isolation since it's the creation phase
router.post('/onboard', authenticate, validateBody(onboardSchema), onboard);

// Access organization settings (protected by tenant isolation and settings permissions)
router.get('/', authenticate, tenantIsolation, getOrganization);
router.put('/', authenticate, tenantIsolation, authorize(['settings:write']), validateBody(updateOrgSchema), updateOrganization);

export default router;
