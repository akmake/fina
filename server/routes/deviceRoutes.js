// server/routes/deviceRoutes.js
// Paired phones that relay bank SMS codes. Mounted at /api/devices in app.js
// (after the global CSRF middleware — the app sends `X-Fina-Client` too).

import { Router } from 'express';
import { requireAuth } from '../middlewares/authMiddleware.js';
import deviceAuth from '../middlewares/deviceAuth.js';
import { deviceLimiter } from '../middlewares/rateLimiter.js';
import {
  listDevices, pairDevice, revokeDevice, submitDeviceOtp,
} from '../controllers/deviceController.js';

const router = Router();

// Phone side — device token only (declared first so requireAuth doesn't catch them).
// /heartbeat and /sms are mounted in app.js BEFORE the CSRF middleware (the Relay app
// sends only a Bearer token); /otp keeps the generic contract (needs X-Fina-Client).
router.post('/otp', deviceLimiter, deviceAuth, submitDeviceOtp);

// Web side — the signed-in user manages their phones.
router.get('/', requireAuth, listDevices);
router.post('/', requireAuth, pairDevice);
router.delete('/:id', requireAuth, revokeDevice);

export default router;
