import express from 'express';
// הוספנו כאן את updateTransaction לייבוא
import { getTransactions, addTransaction, deleteTransaction, updateTransaction, bulkUpdateMerchant } from '../controllers/transactionController.js';
import requireAuth from '../middlewares/requireAuth.js';

const router = express.Router();

// כל הנתיבים כאן דורשים אימות
router.use(requireAuth);

router.route('/')
  .get(getTransactions)
  .post(addTransaction);

router.post('/merchant-bulk', bulkUpdateMerchant);

router.route('/:id')
  .delete(deleteTransaction)
  // הוספנו כאן את נתיב ה-PUT לעריכה
  .put(updateTransaction);

export default router;