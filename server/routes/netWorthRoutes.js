// server/routes/netWorthRoutes.js
import express from 'express';
import { getNetWorth, getFinancialHealthScore, saveNetWorthSnapshot, getNetWorthHistory } from '../controllers/netWorthController.js';

const router = express.Router();

router.get('/',             getNetWorth);
router.get('/health-score', getFinancialHealthScore);
router.get('/history',      getNetWorthHistory);
router.post('/snapshot',    saveNetWorthSnapshot);

export default router;
