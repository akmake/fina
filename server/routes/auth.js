// server/routes/auth.js

import express from 'express';
// 👇 --- התיקון כאן: שימוש בשמות הפונקציות הנכונים --- 👇
import { registerUser, loginUser, logout, refresh, googleAuth, updateProfile, changePassword } from '../controllers/authController.js';
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

export default router;
