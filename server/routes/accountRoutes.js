import express from 'express';
import { getAccount, exportData, deleteAccount, completeOnboarding } from '../controllers/accountController.js';

// Mounted in app.js as: requireAuth + familyScope (so req.householdId is set).
const router = express.Router();

router.get('/', getAccount);
router.get('/export', exportData);
router.delete('/', deleteAccount);
router.post('/onboarding', completeOnboarding);

export default router;
