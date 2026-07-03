import { Router } from 'express';
import {
  scrapeCompany,
  getCompanies,
  oneZeroOtpStart,
  oneZeroOtpVerify,
} from '../controllers/scraperController.js';

const router = Router();

router.get('/companies', getCompanies);
router.post('/', scrapeCompany);

// One Zero OTP flow (SMS two-factor)
router.post('/onezero/otp/start', oneZeroOtpStart);
router.post('/onezero/otp/verify', oneZeroOtpVerify);

export default router;
