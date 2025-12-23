// server/routes/loanRoutes.js

import express from 'express';
import { createLoan, getLoans, getLoanById } from '../controllers/loanController.js';
import { requireAuth } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.use(requireAuth);

router.route('/')
  .get(getLoans)
  .post(createLoan);

router.route('/:id')
  .get(getLoanById);

export default router;