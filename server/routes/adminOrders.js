import express from 'express';
import requireAdmin from '../middlewares/requireAdmin.js';
import {
  getAllOrders,
  updateOrderStatus,
  deleteOrder,
} from '../controllers/admin/orderAdminController.js';

const router = express.Router();
router.use(requireAdmin);

router.get('/',    getAllOrders);
router.put('/:id', updateOrderStatus);
router.delete('/:id', deleteOrder);

export default router;
