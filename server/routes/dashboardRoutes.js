// server/routes/dashboardRoutes.js
import express from 'express';
import { getDashboardData } from '../controllers/dashboardController.js';
import { getUpdates } from '../controllers/updatesController.js';
import { requireAuth } from '../middlewares/authMiddleware.js';

const router = express.Router();

// כל הנתיבים בקובץ זה דורשים אימות
router.use(requireAuth);

// נתיב לקבלת כל סיכום הנתונים לדשבורד
router.get('/summary', getDashboardData);

// "מה חדש" — מה נכנס מאז הביקור הקודם, מצב החיבורים והתראות
router.get('/updates', getUpdates);

export default router;
