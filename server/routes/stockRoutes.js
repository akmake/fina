// server/routes/stockRoutes.js

import express from 'express';
import {
  getAllStocks,
  addStock,
  deleteStock,
  sellStock,
  refreshPrices,
} from '../controllers/stockController.js';

const router = express.Router();

// All routes here are protected by the requireAuth middleware applied in app.js

router.route('/')
  .get(getAllStocks)
  .post(addStock);

router.post('/refresh-prices', refreshPrices);

router.route('/:id')
  .delete(deleteStock);

router.post('/:id/sell', sellStock);

export default router;