// server/routes/netWorthRoutes.js
import express from 'express';
import { getNetWorth, getFinancialHealthScore } from '../controllers/netWorthController.js';

const router = express.Router();

router.get('/',             getNetWorth);
router.get('/health-score', getFinancialHealthScore);

export default router;
