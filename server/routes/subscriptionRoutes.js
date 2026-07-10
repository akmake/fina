import express from 'express';
import { getSubscription, listPlans, changePlan } from '../controllers/subscriptionController.js';

// Mounted in app.js as: requireAuth + familyScope (household-scoped; viewer writes
// are already blocked by familyScope, owner-only enforced in the controller).
const router = express.Router();

router.get('/', getSubscription);
router.get('/plans', listPlans);
router.post('/change', changePlan);

export default router;
