// server/routes/auth.js

import express from 'express';
// 👇 --- התיקון כאן: שימוש בשמות הפונקציות הנכונים --- 👇
import { registerUser, loginUser, logout, refresh } from '../controllers/authController.js';

const router = express.Router();

// 👇 --- וגם כאן, כדי להתאים לשמות החדשים --- 👇
router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/logout', logout);
router.post('/refresh', refresh);

export default router;