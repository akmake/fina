// server/routes/alertRoutes.js
import express from 'express';
import { getAlerts, markAlertsRead, dismissAlert, generateAlerts } from '../controllers/alertController.js';
const router = express.Router();

router.get('/', getAlerts);
router.post('/mark-read', markAlertsRead);
router.post('/generate', generateAlerts);
router.post('/:id/dismiss', dismissAlert);

export default router;
