// server/routes/importRoutes.js

import express from 'express';
import { uploadAndParse, processTransactions, checkMerchants } from '../controllers/importController.js';

const router = express.Router();

router.post('/upload', uploadAndParse);
router.post('/check-merchants', checkMerchants);
router.post('/process-transactions', processTransactions);

export default router;
