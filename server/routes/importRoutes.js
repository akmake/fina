// server/routes/importRoutes.js

import express from 'express';
import { uploadAndParse, processTransactions } from '../controllers/importController.js';

const router = express.Router();

router.post('/upload', uploadAndParse);
router.post('/process-transactions', processTransactions);

export default router;