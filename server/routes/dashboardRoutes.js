// server/routes/dashboardRoutes.js
import express from 'express';
import { getDashboardData } from '../controllers/dashboardController.js';
import { requireAuth } from '../middlewares/authMiddleware.js';

const router = express.Router();

// כל הנתיבים בקובץ זה דורשים אימות
router.use(requireAuth);

// נתיב לקבלת כל סיכום הנתונים לדשבורד
router.get('/summary', getDashboardData);

export default router;