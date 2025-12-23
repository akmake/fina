import express from 'express';
// 👇 --- התיקון כאן: שימוש בשמות הפונקציות הנכונים מהקונטרולר --- 👇
import { getFinanceProfile, updateFinanceProfile } from '../controllers/financeController.js';
import requireAuth from '../middlewares/requireAuth.js';

const router = express.Router();

// כל הנתיבים כאן דורשים אימות משתמש
router.use(requireAuth);

router.route('/')
  .get(getFinanceProfile) // <-- שימוש בשם המעודכן
  .post(updateFinanceProfile); // <-- שימוש בשם המעודכן

export default router;