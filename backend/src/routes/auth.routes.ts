import { Router } from 'express';
import { 
  register, 
  login, 
  refresh, 
  logout, 
  getMe, 
  forgotPassword, 
  resetPassword 
} from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validateBody } from '../middleware/validate.middleware';
import { 
  registerSchema, 
  loginSchema, 
  requestPasswordResetSchema, 
  resetPasswordSchema 
} from '../validators/auth.validator';

const router = Router();

router.post('/register', validateBody(registerSchema), register);
router.post('/login', validateBody(loginSchema), login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/me', authenticate, getMe);
router.post('/forgot-password', validateBody(requestPasswordResetSchema), forgotPassword);
router.post('/reset-password', validateBody(resetPasswordSchema), resetPassword);

export default router;
