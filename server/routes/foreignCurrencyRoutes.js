// server/routes/foreignCurrencyRoutes.js
import express from 'express';
import { getForeignCurrencies, addForeignCurrency, updateForeignCurrency, deleteForeignCurrency, getExchangeRates } from '../controllers/foreignCurrencyController.js';
const router = express.Router();

router.get('/rates', getExchangeRates);
router.get('/', getForeignCurrencies);
router.post('/', addForeignCurrency);
router.put('/:id', updateForeignCurrency);
router.delete('/:id', deleteForeignCurrency);

export default router;
