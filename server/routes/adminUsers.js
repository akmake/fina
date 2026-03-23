import express from 'express';
import { requireAuth, requireAdmin } from '../middlewares/authMiddleware.js';
import {
  getAllUsers,
  updateUserRole,
  deleteUser,
} from '../controllers/admin/userAdminController.js';

const router = express.Router();
router.use(requireAuth, requireAdmin);

router.get('/',    getAllUsers);
router.put('/:id', updateUserRole);
router.delete('/:id', deleteUser);

export default router;
