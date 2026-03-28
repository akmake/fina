import { Router } from 'express';
import { requestOtp, verifyOtpAndFetch, verifyOtpAndImport, processRawAccounts } from '../controllers/calController.js';
import requireAuth from '../middlewares/requireAuth.js';

const router = Router();
router.use(requireAuth);

router.post('/request-otp', requestOtp);
router.post('/verify-otp',  verifyOtpAndFetch);
router.post('/verify-otp-import', verifyOtpAndImport);
router.post('/process-accounts', processRawAccounts);

export default router;
