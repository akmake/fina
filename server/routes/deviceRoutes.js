// server/routes/deviceRoutes.js
// Paired phones that relay bank SMS codes. Mounted at /api/devices in app.js
// (after the global CSRF middleware — the app sends `X-Fina-Client` too).

import { Router } from 'express';
import { requireAuth } from '../middlewares/authMiddleware.js';
import deviceAuth from '../middlewares/deviceAuth.js';
import { deviceLimiter } from '../middlewares/rateLimiter.js';
import {
  listDevices, pairDevice, revokeDevice, heartbeat, submitDeviceOtp,
} from '../controllers/deviceController.js';

const router = Router();

// Phone side — device token only (declared first so requireAuth doesn't catch them).
router.post('/heartbeat', deviceLimiter, deviceAuth, heartbeat);
router.post('/otp', deviceLimiter, deviceAuth, submitDeviceOtp);

// Web side — the signed-in user manages their phones.
router.get('/', requireAuth, listDevices);
router.post('/', requireAuth, pairDevice);
router.delete('/:id', requireAuth, revokeDevice);

export default router;
