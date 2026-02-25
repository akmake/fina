import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middlewares/authMiddleware.js';
import {
  getAllLogs,
  getLogsSummary,
  getMyLogs,
  deleteOldLogs,
  getLiveLogs,
} from '../controllers/logsController.js';

const router = Router();

// --- Admin routes ---
router.get('/admin/all', requireAuth, requireAdmin, getAllLogs);
router.get('/admin/summary', requireAuth, requireAdmin, getLogsSummary);
router.get('/admin/live', requireAuth, requireAdmin, getLiveLogs);
router.delete('/admin/cleanup', requireAuth, requireAdmin, deleteOldLogs);

// --- User routes ---
router.get('/my-logs', requireAuth, getMyLogs);

export default router;
