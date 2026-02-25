// server/routes/budgetRoutes.js
import express from 'express';
import { getBudget, upsertBudget, deleteBudget, copyBudget, getBudgetSummary } from '../controllers/budgetController.js';

const router = express.Router();

router.get('/',        getBudget);
router.get('/summary', getBudgetSummary);
router.post('/',       upsertBudget);
router.post('/copy',   copyBudget);
router.delete('/:id',  deleteBudget);

export default router;
