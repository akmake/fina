import express from 'express';
import { updatePrimeRate } from '../controllers/rateController.js';
import { requireAdmin } from '../middlewares/authMiddleware.js'; // נניח שרק מנהל יכול לעדכן

const router = express.Router();

router.post('/prime', requireAdmin, updatePrimeRate);

export default router;