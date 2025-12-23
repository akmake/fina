import express from 'express';
import requireAdmin from '../middlewares/requireAdmin.js';
import {
  getAllUsers,
  updateUserRole,
  deleteUser,
} from '../controllers/admin/userAdminController.js';

const router = express.Router();
router.use(requireAdmin);

router.get('/',    getAllUsers);
router.put('/:id', updateUserRole);
router.delete('/:id', deleteUser);

export default router;
