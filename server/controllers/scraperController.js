import AppError from '../utils/AppError.js';
import {
  getCompanyConfig,
  buildCredentials,
  runScrape,
  triggerOneZeroOtp,
  exchangeOneZeroOtp,
  scrapeOneZeroWithToken,
  getCompaniesConfig,
} from '../services/scrapeService.js';

/**
 * scraperController — thin HTTP layer over scrapeService.
 * All scraping/business logic (company configs, credential shaping, transaction
 * mapping) lives in ../services/scrapeService.js so the unattended background
 * job runner shares exactly the same code path. See docs/modules/bank-scraper.md.
 */

export const scrapeCompany = async (req, res, next) => {
  const { company, startDate, incomesOnly, ...formFields } = req.body;
  const userId = req.user._id;

  try {
    const config = getCompanyConfig(company);

    // One Zero uses an interactive OTP flow — see /onezero/otp/start + /onezero/otp/verify
    if (config.otpFlow) {
      return next(new AppError('One Zero דורש אימות בקוד חד-פעמי — השתמש בזרימת ה-OTP', 400));
    }

    const credentials = buildCredentials(config, formFields);
    const payload = await runScrape({ company, credentials, startDate, incomesOnly, userId });
    return res.json(payload);
  } catch (error) {
    // AppError (validation / mapped scrape failures) → pass through untouched
    if (error instanceof AppError) return next(error);
    console.error(`${company} scrape error:`, error);
    return next(new AppError(`שגיאה בגישה לחברה: ${error.message}`, 500));
  }
};

// ── One Zero OTP flow (SMS two-factor) ──────────────────────────────────────────

export const oneZeroOtpStart = async (req, res, next) => {
  const { phoneNumber } = req.body;
  if (!phoneNumber) return next(new AppError('חסר מספר טלפון', 400));
  if (!phoneNumber.startsWith('+')) {
    return next(new AppError('נדרש מספר טלפון בינלאומי מלא שמתחיל ב-+ עם קידומת מדינה (למשל +9725...)', 400));
  }

  try {
    const otpContext = await triggerOneZeroOtp(phoneNumber);
    // otpContext is the only state needed to complete the OTP in a later request
    return res.json({ otpContext });
  } catch (error) {
    if (error instanceof AppError) return next(error);
    console.error('One Zero OTP start error:', error);
    return next(new AppError(`שגיאה בשליחת קוד ל-One Zero: ${error.message}`, 500));
  }
};

export const oneZeroOtpVerify = async (req, res, next) => {
  const { otpContext, otpCode, email, password, startDate, incomesOnly } = req.body;
  const userId = req.user._id;

  if (!otpContext || !otpCode) return next(new AppError('חסר קוד אימות או הקשר OTP', 400));
  if (!email || !password) return next(new AppError('חסרים פרטי התחברות ל-One Zero', 400));

  try {
    // Step 1: exchange the OTP code for a long-term token (HTTP only, no browser)
    const otpLongTermToken = await exchangeOneZeroOtp({ otpContext, otpCode, startDate });

    // Step 2: run the actual scrape using the long-term token
    const payload = await scrapeOneZeroWithToken({ email, password, otpLongTermToken, startDate, incomesOnly, userId });

    // Return the token so the client may persist it (encrypted) for future imports
    return res.json({ ...payload, otpLongTermToken });
  } catch (error) {
    if (error instanceof AppError) return next(error);
    console.error('One Zero OTP verify error:', error);
    return next(new AppError(`שגיאה בייבוא מ-One Zero: ${error.message}`, 500));
  }
};

// Export config so frontend can know which fields each company needs
export const getCompanies = (req, res) => {
  res.json(getCompaniesConfig());
};
