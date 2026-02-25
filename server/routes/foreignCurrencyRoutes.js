// server/routes/foreignCurrencyRoutes.js
import express from 'express';
import { getForeignCurrencies, addForeignCurrency, updateForeignCurrency, deleteForeignCurrency } from '../controllers/foreignCurrencyController.js';
const router = express.Router();

router.get('/', getForeignCurrencies);
router.post('/', addForeignCurrency);
router.put('/:id', updateForeignCurrency);
router.delete('/:id', deleteForeignCurrency);

export default router;
