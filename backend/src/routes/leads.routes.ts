import { Router } from 'express';
import { 
  getLeads, 
  getLead, 
  createLead, 
  updateLead, 
  deleteLead, 
  bulkUpdateLeads, 
  convertLead,
  checkDuplicateLead,
  reopenLead,
  assignLeads,
  bulkUploadLeads,
  getBulkTemplate,
  getAssignmentLogs,
  getImportLogs,
  addLeadNote,
  logLeadCall,
  logLeadTouchpoint
} from '../controllers/leads.controller';
import { authenticate } from '../middleware/auth.middleware';
import { tenantIsolation } from '../middleware/tenant.middleware';
import { authorize } from '../middleware/rbac.middleware';

const router = Router();

// Apply auth and tenant isolation to all lead routes
router.use(authenticate, tenantIsolation);

// Specific paths must come before param /:id
router.get('/bulk-template', getBulkTemplate);
router.get('/assignment-logs', authorize(['leads:read']), getAssignmentLogs);
router.get('/import-logs', authorize(['leads:read']), getImportLogs);
router.post('/check-duplicate', authorize(['leads:read']), checkDuplicateLead);
router.post('/bulk-upload', authorize(['leads:write']), bulkUploadLeads);
router.post('/assign', authorize(['leads:write']), assignLeads);
router.post('/convert', authorize(['leads:write']), convertLead);
router.post('/bulk', authorize(['leads:write']), bulkUpdateLeads);

router.post('/:id/reopen', authorize(['leads:write']), reopenLead);
router.post('/:id/notes', authorize(['leads:write']), addLeadNote);
router.post('/:id/log-call', authorize(['leads:write']), logLeadCall);
router.post('/:id/log-touchpoint', authorize(['leads:write']), logLeadTouchpoint);

router.get('/', authorize(['leads:read']), getLeads);
router.get('/:id', authorize(['leads:read']), getLead);
router.post('/', authorize(['leads:write']), createLead);
router.put('/:id', authorize(['leads:write']), updateLead);
router.delete('/:id', authorize(['leads:delete']), deleteLead);

export default router;
