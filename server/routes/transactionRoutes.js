import express from 'express';
import { getTransactions, addTransaction, deleteTransaction } from '../controllers/transactionController.js';
import requireAuth from '../middlewares/requireAuth.js';

const router = express.Router();

// כל הנתיבים כאן דורשים אימות
router.use(requireAuth);

router.route('/')
  .get(getTransactions)
  .post(addTransaction);

router.route('/:id')
  .delete(deleteTransaction);

export default router;