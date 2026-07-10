// server/routes/auth.js

import express from 'express';
import {
  registerUser, loginUser, logout, refresh, googleAuth, updateProfile, changePassword,
  verifyEmail, resendVerification,
  setup2FA, enable2FA, disable2FA, verify2FALogin,
} from '../controllers/authController.js';
import { requireAuth } from '../middlewares/authMiddleware.js';
import { csrfProtection } from '../middlewares/csrf.js';

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/google', googleAuth);
router.post('/logout', logout);
router.post('/refresh', refresh);
router.put('/profile', csrfProtection, requireAuth, updateProfile);
router.put('/change-password', csrfProtection, requireAuth, changePassword);

// ── Phase 4: email verification ──
router.post('/verify-email', verifyEmail);                                  // public (email link)
router.post('/resend-verification', csrfProtection, requireAuth, resendVerification);

// ── Phase 4: two-factor auth (TOTP) ──
router.post('/2fa/login', verify2FALogin);                                  // public (second login step)
router.post('/2fa/setup', csrfProtection, requireAuth, setup2FA);
router.post('/2fa/enable', csrfProtection, requireAuth, enable2FA);
router.post('/2fa/disable', csrfProtection, requireAuth, disable2FA);

export default router;
