import { Router } from 'express';
import { 
  getTickets, 
  getTicket, 
  createTicket, 
  updateTicket, 
  postTicketMessage,
  submitPublicIssueReport
} from '../controllers/tickets.controller';
import { authenticate } from '../middleware/auth.middleware';
import { tenantIsolation } from '../middleware/tenant.middleware';

const router = Router();

// Public Direct Client Issue Reporting Endpoint (No login required)
router.post('/public-report', submitPublicIssueReport);

// Authenticated CRM & Tenant Isolated Routes
router.use(authenticate, tenantIsolation);

router.get('/', getTickets);
router.get('/:id', getTicket);
router.post('/', createTicket);
router.put('/:id', updateTicket);
router.post('/:id/messages', postTicketMessage);

export default router;
