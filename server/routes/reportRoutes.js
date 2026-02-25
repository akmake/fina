// server/routes/reportRoutes.js
import express from 'express';
import { yearlyComparison, getCategoryTrends, getFinancialSummary } from '../controllers/reportController.js';
const router = express.Router();

router.get('/yearly-comparison', yearlyComparison);
router.get('/trends', getCategoryTrends);
router.get('/financial-summary', getFinancialSummary);

export default router;
