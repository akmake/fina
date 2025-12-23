import express from 'express';
// ✨ התיקון: מייבאים מהקונטרולर הנקי של הלקוח, לא מה-admin
import { getMyOrders } from '../controllers/orderController.js'; 
import { requireAuth } from '../middlewares/authMiddleware.js';

const router = express.Router();

// מגדיר את הנתיב /api/orders/my-orders
router.get('/my-orders', requireAuth, getMyOrders);

export default router;