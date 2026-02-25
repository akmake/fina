// server/routes/recurringRoutes.js
import express from 'express';
import { 
  getRecurringTransactions, 
  addRecurringTransaction, 
  updateRecurringTransaction, 
  deleteRecurringTransaction,
  toggleRecurringTransaction,
  getCashflowForecast
} from '../controllers/recurringController.js';

const router = express.Router();

router.get('/',              getRecurringTransactions);
router.get('/cashflow',      getCashflowForecast);
router.post('/',             addRecurringTransaction);
router.put('/:id',           updateRecurringTransaction);
router.delete('/:id',        deleteRecurringTransaction);
router.post('/:id/toggle',   toggleRecurringTransaction);

export default router;
