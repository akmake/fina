// server/routes/debtRoutes.js
import express from 'express';
import { getDebtOverview, simulatePayoff } from '../controllers/debtController.js';
const router = express.Router();

router.get('/', getDebtOverview);
router.post('/simulate', simulatePayoff);

export default router;
