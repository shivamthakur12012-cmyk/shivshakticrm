import { Router } from 'express';
import { 
  getPublicPlans, 
  getSubscriptionDetails, 
  submitPaymentRequest,
  submitSeatAddonPaymentRequest,
  createCheckoutOrder, 
  verifyPayment, 
  createSeatAddonOrder,
  verifySeatAddonPayment,
  subscribeToPlan 
} from '../controllers/billing.controller';
import { authenticate } from '../middleware/auth.middleware';
import { tenantIsolation } from '../middleware/tenant.middleware';

const router = Router();

// Public route to fetch active plans
router.get('/plans', getPublicPlans);

// Organization Protected routes
router.use(authenticate, tenantIsolation);

router.get('/subscription', getSubscriptionDetails);
router.post('/submit-payment', submitPaymentRequest);
router.post('/submit-seat-payment', submitSeatAddonPaymentRequest);
router.post('/create-order', createCheckoutOrder);
router.post('/checkout-order', createCheckoutOrder);
router.post('/verify-payment', verifyPayment);
router.post('/seat-order', createSeatAddonOrder);
router.post('/verify-seat-payment', verifySeatAddonPayment);
router.post('/subscribe', subscribeToPlan);


export default router;
