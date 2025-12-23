import express from 'express';
import { getCart, updateCart } from '../controllers/cartController.js';
import { requireAuth } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.route('/')
  .get(requireAuth, getCart)
  .post(requireAuth, updateCart);

export default router;