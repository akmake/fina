import { createScraper, CompanyTypes } from 'israeli-bank-scrapers';
import puppeteer from 'puppeteer';
import { existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { parseTransactions } from '../utils/excelParser.js';
import AppError from '../utils/AppError.js';

/**
 * scrapeService — the single, reusable bank/credit-card scraping core.
 *
 * Both the interactive HTTP route (scraperController) and the unattended
 * background job runner (importRunner) call into here, so there is exactly one
 * place that knows how each Israeli institution authenticates and how its raw
 * transactions map to our internal shape.
 */

// ── Widen the scraper login "waiting for redirect" timeout ──────────────────
// israeli-bank-scrapers hardcodes a 20s redirect wait inside its scrapers (incl.
// MAX), so a slow bank login is declared a failure long before it would actually
// complete. Wrap the shared navigation helper (scrapers read this property at call
// time) so login waits up to 90s before giving up. Pure runtime patch — no
// node_modules edits, survives reinstalls.
try {
  const require = createRequire(import.meta.url);
  const navigation = require('israeli-bank-scrapers/lib/helpers/navigation.js');
  if (navigation?.waitForRedirect && !navigation.__finaWidened) {
    const original = navigation.waitForRedirect;
    navigation.waitForRedirect = (pageOrFrame, timeout = 20000, ...rest) =>
      original(pageOrFrame, Math.max(timeout, 90000), ...rest);
    navigation.__finaWidened = true;
  }
} catch (err) {
  console.warn('[scraper] could not widen redirect timeout:', err.message);
}

const RENDER_CHROME_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
];

export const resolveExecutablePath = () => {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
  if (process.env.CHROME_BIN) return process.env.CHROME_BIN;

  try {
    // executablePath() derives a path from install metadata WITHOUT checking the
    // binary is actually there. A partial/interrupted Chrome download leaves the
    // folder present but chrome.exe missing, so this returns a path that makes the
    // launcher throw "Browser was not found". Only hand back a path that exists.
    const resolved = puppeteer.executablePath();
    return resolved && existsSync(resolved) ? resolved : undefined;
  } catch {
    return undefined;
  }
};

export const resolveBrowserArgs = () => {
  if (process.env.PUPPETEER_ARGS) {
    return process.env.PUPPETEER_ARGS.split(/\s+/).filter(Boolean);
  }
  return process.env.RENDER ? RENDER_CHROME_ARGS : undefined;
};

// Diagnostic: when SCRAPER_DEBUG_SCREENSHOTS is set, the scraper writes a
// full-page PNG of the browser at the moment a scrape FAILS — the fastest way to
// see what a bank actually showed (e.g. an UNKNOWN_ERROR "unrecognized landing
// page"). Files land under LOG_DIR/scrape-failures. Returns undefined (feature
// off) unless the env flag is present, so it is inert in normal operation.
export const failureScreenshotPath = (company) => {
  if (!process.env.SCRAPER_DEBUG_SCREENSHOTS) return undefined;
  const dir = `${process.env.LOG_DIR || './logs'}/scrape-failures`;
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${dir}/${company}-${stamp}.png`;
};

// Extra scraped fields — passed as underscore-prefixed keys through the Excel parser pipeline
const extraFields = (txn, source) => ({
  _processedDate:    txn.processedDate ? new Date(txn.processedDate) : null,
  _originalAmount:   txn.originalAmount  ?? null,
  _originalCurrency: txn.originalCurrency ?? null,
  _scraperType:      txn.type     ?? null, // 'normal' | 'installments'
  _status:           txn.status   ?? null, // 'completed' | 'pending'
  _installments:     txn.installments ?? null, // { number, total }
  _identifier:       txn.identifier != null ? String(txn.identifier) : null,
  _scraperCategory:  txn.category ?? null,
  _memo:             txn.memo     ?? null,
  _source:           source,
});

// ── קונבנציית chargedAmount ────────────────────────────────────────────────────
// israeli-bank-scrapers v6+:
// כרטיסי אשראי + בנקים:  שלילי chargedAmount = הוצאה/חיוב, חיובי = הכנסה/זיכוי
// ─────────────────────────────────────────────────────────────────────────────

// Credit card toRow (Max, CAL, Isracard, Amex):
// negative chargedAmount = expense (charge to card)
// positive = refund/credit
const toRowCreditCard = (source) => (txn) => {
  // Use ?? so chargedAmount===0 doesn't incorrectly fall through to originalAmount
  const charged = txn.chargedAmount ?? txn.originalAmount ?? 0;
  return {
    'תאריך עסקה': new Date(txn.date),
    'שם בית העסק': txn.description || txn.memo || 'לא ידוע',
    'סכום בש"ח': Math.abs(charged),
    ...extraFields(txn, source),
    _transactionType: charged <= 0 ? 'הוצאה' : 'הכנסה',
  };
};

// Bank toRow (Hapoalim, Leumi, Discount...):
// negative chargedAmount = debit/expense, positive = credit/income
const toRowBank = (source) => (txn) => {
  const charged = txn.chargedAmount ?? txn.originalAmount ?? 0;
  return {
    'תאריך עסקה': new Date(txn.date),
    'שם בית העסק': txn.description || txn.memo || 'לא ידוע',
    'סכום בש"ח': Math.abs(charged),
    ...extraFields(txn, source),
    _transactionType: charged < 0 ? 'הוצאה' : 'הכנסה',
  };
};

// credFields: which credential fields this company needs (order matters for display)
export const COMPANY_CONFIG = {
  // ── כרטיסי אשראי — חיובי = הוצאה ─────────────────────────────────────────
  max: {
    companyId: CompanyTypes.max,
    fileType: 'max',
    name: 'מקס',
    credFields: ['username', 'password'],
    toRow: toRowCreditCard('max'),
  },
  visaCal: {
    companyId: CompanyTypes.visaCal,
    fileType: 'cal',
    name: 'כאל',
    credFields: ['username', 'password'],
    toRow: toRowCreditCard('visaCal'),
  },
  isracard: {
    companyId: CompanyTypes.isracard,
    fileType: 'cal',
    name: 'ישראכרט',
    credFields: ['id', 'card6Digits', 'password'],
    toRow: toRowCreditCard('isracard'),
  },
  amex: {
    companyId: CompanyTypes.amex,
    fileType: 'cal',
    name: 'אמריקן אקספרס',
    credFields: ['id', 'card6Digits', 'password'],
    toRow: toRowCreditCard('amex'),
  },

  // ── בנקים — שלילי = הוצאה ─────────────────────────────────────────────────
  hapoalim: {
    companyId: CompanyTypes.hapoalim,
    fileType: 'cal',
    name: 'בנק הפועלים',
    credFields: ['userCode', 'password'],
    toRow: toRowBank('hapoalim'),
  },
  leumi: {
    companyId: CompanyTypes.leumi,
    fileType: 'cal',
    name: 'בנק לאומי',
    credFields: ['username', 'password'],
    toRow: toRowBank('leumi'),
  },
  discount: {
    companyId: CompanyTypes.discount,
    fileType: 'cal',
    name: 'בנק דיסקונט',
    credFields: ['id', 'password', 'num'],
    toRow: toRowBank('discount'),
  },
  mercantile: {
    companyId: CompanyTypes.mercantile,
    fileType: 'cal',
    name: 'מרכנתיל',
    credFields: ['id', 'password', 'num'],
    toRow: toRowBank('mercantile'),
  },
  mizrahi: {
    companyId: CompanyTypes.mizrahi,
    fileType: 'cal',
    name: 'מזרחי-טפחות',
    credFields: ['username', 'password'],
    toRow: toRowBank('mizrahi'),
  },
  otsarHahayal: {
    companyId: CompanyTypes.otsarHahayal,
    fileType: 'cal',
    name: 'אוצר החייל',
    credFields: ['username', 'password'],
    toRow: toRowBank('otsarHahayal'),
  },
  beinleumi: {
    companyId: CompanyTypes.beinleumi,
    fileType: 'cal',
    name: 'הבינלאומי',
    credFields: ['username', 'password'],
    toRow: toRowBank('beinleumi'),
  },
  union: {
    companyId: CompanyTypes.union,
    fileType: 'cal',
    name: 'איגוד',
    credFields: ['username', 'password'],
    toRow: toRowBank('union'),
  },
  massad: {
    companyId: CompanyTypes.massad,
    fileType: 'cal',
    name: 'מסד',
    credFields: ['username', 'password'],
    toRow: toRowBank('massad'),
  },
  yahav: {
    companyId: CompanyTypes.yahav,
    fileType: 'cal',
    name: 'יהב',
    credFields: ['username', 'nationalID', 'password'],
    toRow: toRowBank('yahav'),
  },
  beyahadBishvilha: {
    companyId: CompanyTypes.beyahadBishvilha,
    fileType: 'cal',
    name: 'ביחד בשבילה',
    credFields: ['id', 'password'],
    toRow: toRowBank('beyahadBishvilha'),
  },
  behatsdaa: {
    companyId: CompanyTypes.behatsdaa,
    fileType: 'cal',
    name: 'בהצדעה',
    credFields: ['id', 'password'],
    toRow: toRowBank('behatsdaa'),
  },
  pagi: {
    companyId: CompanyTypes.pagi,
    fileType: 'cal',
    name: 'פאגי',
    credFields: ['username', 'password'],
    toRow: toRowBank('pagi'),
  },
  oneZero: {
    companyId: CompanyTypes.oneZero,
    fileType: 'cal',
    name: 'One Zero',
    // One Zero authenticates via SMS OTP — email/password/phone are collected,
    // then a code is sent and exchanged for a token (see oneZeroOtp* controllers)
    credFields: ['email', 'password', 'phoneNumber'],
    otpFlow: true,
    toRow: toRowBank('oneZero'),
  },
};

// Map an israeli-bank-scrapers failure result → AppError with a Hebrew message
const ERROR_MAP = {
  invalidpassword: { status: 401, message: 'שם משתמש או סיסמא שגויים — בדוק את הפרטים ונסה שנית' },
  changepassword:  { status: 400, message: 'נדרש לשנות סיסמה באתר הבנק/חברת האשראי לפני הייבוא' },
  timeout:         { status: 504, message: 'אתר הבנק לא הגיב בזמן — האתר עמוס, נסה שנית בעוד מספר דקות' },
  generic:         { status: 502, message: 'שגיאה בהתחברות לאתר הבנק — ייתכן שהאתר בתחזוקה, נסה שנית מאוחר יותר' },
};

export const mapScrapeError = (result) => {
  const key = result.errorType?.toLowerCase();
  const err = ERROR_MAP[key] ?? { status: 502, message: `שגיאת כניסה: ${result.errorType}` };
  const detail = result.errorMessage ? ` (${result.errorMessage})` : '';
  return new AppError(err.message + detail, err.status);
};

// Default start date = one month ago
export const resolveStartDate = (startDate) => startDate
  ? new Date(startDate)
  : (() => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d; })();

/** Look up a company config, throwing a 400 for unknown keys. */
export const getCompanyConfig = (company) => {
  const config = COMPANY_CONFIG[company];
  if (!config) throw new AppError('חברת אשראי/בנק לא נתמכת', 400);
  return config;
};

/**
 * Build & validate a credentials object from loose form fields, keeping only the
 * keys the given company actually needs. Throws 400 on any missing field.
 */
export const buildCredentials = (config, formFields = {}) => {
  const credentials = {};
  for (const field of config.credFields) {
    if (!formFields[field]) throw new AppError(`חסר שדה: ${field}`, 400);
    credentials[field] = formFields[field];
  }
  return credentials;
};

// Turn a successful scrape result into the JSON payload the client expects
export const buildScrapeResponse = async (result, config, { incomesOnly, userId }) => {
  // Raw debug info — full scraper output per account
  const rawAccounts = (result.accounts || []).map(account => ({
    accountNumber: account.accountNumber || null,
    balance: account.balance ?? null,
    txnCount: (account.txns || []).length,
    txns: (account.txns || []).map(txn => ({
      date: txn.date,
      processedDate: txn.processedDate,
      description: txn.description,
      memo: txn.memo,
      originalAmount: txn.originalAmount,
      originalCurrency: txn.originalCurrency,
      chargedAmount: txn.chargedAmount,
      chargedCurrency: txn.chargedCurrency,
      status: txn.status,
      type: txn.type,
      identifier: txn.identifier,
      installments: txn.installments,
      category: txn.category,
    })),
  }));

  const allTxns = (result.accounts || []).flatMap(account =>
    account.txns.map(txn => ({ ...txn, _accountNumber: account.accountNumber || null }))
  );

  const txnsToProcess = incomesOnly ? allTxns.filter(t => (t.chargedAmount || 0) > 0) : allTxns;
  const cleanedData = txnsToProcess.map(txn => {
    const row = config.toRow(txn);
    if (txn._accountNumber) row._cardNumber = txn._accountNumber;
    return row;
  });

  const balances = (result.accounts || [])
    .filter(a => a.balance != null)
    .map(a => ({ accountNumber: a.accountNumber, balance: a.balance }));

  const futureDebits = result.futureDebits || [];

  if (cleanedData.length === 0) {
    return { transactions: [], unseenMerchants: [], balances, futureDebits, rawAccounts };
  }

  const { transactions, unseenMerchants } = await parseTransactions(cleanedData, config.fileType, userId);
  return { transactions, unseenMerchants, balances, futureDebits, rawAccounts };
};

/**
 * Run a standard (non-OTP) scrape end to end and return the client payload.
 * Shared by scraperController.scrapeCompany and importRunner (unattended sync).
 *
 * @param {object}  p
 * @param {string}  p.company        COMPANY_CONFIG key
 * @param {object}  p.credentials    already-built credentials object
 * @param {Date|string} [p.startDate]
 * @param {boolean} [p.incomesOnly]
 * @param {string}  p.userId
 * @returns {Promise<object>} { transactions, unseenMerchants, balances, futureDebits, rawAccounts }
 */
export const runScrape = async ({ company, credentials, startDate, incomesOnly, userId }) => {
  const config = getCompanyConfig(company);
  if (config.otpFlow) {
    throw new AppError('חברה זו דורשת אימות בקוד חד-פעמי — השתמש בזרימת ה-OTP', 400);
  }

  const start = resolveStartDate(startDate);
  const scraper = createScraper({
    companyId: config.companyId,
    startDate: start,
    combineInstallments: false,
    showBrowser: false,
    executablePath: resolveExecutablePath(),
    args: resolveBrowserArgs(),
    // Give slow/heavy bank sites (notably MAX) more room before giving up.
    // The library's hardcoded 20s "waiting for redirect" wait is widened to 90s
    // by the waitForRedirect wrapper at the top of this file.
    defaultTimeout: 90000,
    navigationRetryCount: 2,
    storeFailureScreenShotPath: failureScreenshotPath(company),
  });

  const result = await scraper.scrape(credentials);
  if (!result.success) {
    console.error(`[scraper] ${company} failed — errorType=${result.errorType}`, result);
    throw mapScrapeError(result);
  }

  return buildScrapeResponse(result, config, { incomesOnly, userId });
};

// ── One Zero OTP flow ──────────────────────────────────────────────────────────
// One Zero (bank) authenticates via SMS OTP. The flow is:
//   1) triggerOneZeroOtp(phone)              — send SMS, return otpContext
//   2) exchangeOneZeroOtp(otpContext, code)  — swap code for a long-term token
//   3) scrapeOneZeroWithToken({ token ... }) — scrape (reusable for auto-sync)
// The long-term token is persisted (encrypted) so unattended re-syncs skip 1–2.

const buildOneZeroScraper = (start) => createScraper({
  companyId: CompanyTypes.oneZero,
  startDate: start,
  combineInstallments: false,
  showBrowser: false,
  executablePath: resolveExecutablePath(),
  args: resolveBrowserArgs(),
});

/** Step 1 — trigger the SMS OTP. Returns the otpContext string. */
export const triggerOneZeroOtp = async (phoneNumber) => {
  const scraper = buildOneZeroScraper(new Date());
  const triggerResult = await scraper.triggerTwoFactorAuth(phoneNumber);
  if (!triggerResult.success) throw mapScrapeError(triggerResult);
  if (!scraper.otpContext) throw new AppError('שליחת קוד ל-One Zero נכשלה', 502);
  return scraper.otpContext;
};

/** Step 2 — exchange the OTP code for a long-term token. Returns the token string. */
export const exchangeOneZeroOtp = async ({ otpContext, otpCode, startDate }) => {
  const scraper = buildOneZeroScraper(resolveStartDate(startDate));
  scraper.otpContext = otpContext;
  const tokenResult = await scraper.getLongTermTwoFactorToken(otpCode);
  if (!tokenResult.success) throw mapScrapeError(tokenResult);
  return tokenResult.longTermTwoFactorAuthToken;
};

/**
 * Step 3 — scrape One Zero using a previously obtained long-term token.
 * Reusable for both the interactive verify step and unattended auto-sync.
 */
export const scrapeOneZeroWithToken = async ({ email, password, otpLongTermToken, startDate, incomesOnly, userId }) => {
  const start = resolveStartDate(startDate);
  const scraper = buildOneZeroScraper(start);
  const result = await scraper.scrape({ email, password, otpLongTermToken });
  if (!result.success) {
    console.error(`[scraper] oneZero failed — errorType=${result.errorType}`, result);
    throw mapScrapeError(result);
  }
  return buildScrapeResponse(result, COMPANY_CONFIG.oneZero, { incomesOnly, userId });
};

/** Build the /companies payload — which fields each institution needs. */
export const getCompaniesConfig = () => {
  const FIELD_LABELS = {
    username:   'שם משתמש',
    userCode:   'קוד משתמש',
    id:         'תעודת זהות',
    card6Digits:'6 ספרות אחרונות של הכרטיס',
    num:        'מספר לקוח',
    nationalID: 'מספר זהות',
    email:      'אימייל',
    password:   'סיסמא',
    phoneNumber:'מספר טלפון (בינלאומי, למשל ‎+9725...)',
  };

  const GROUPS = {
    max: 'כרטיסי אשראי', visaCal: 'כרטיסי אשראי',
    isracard: 'כרטיסי אשראי', amex: 'כרטיסי אשראי',
    hapoalim: 'בנקים', leumi: 'בנקים', discount: 'בנקים',
    mercantile: 'בנקים', mizrahi: 'בנקים', otsarHahayal: 'בנקים',
    beinleumi: 'בנקים', union: 'בנקים', massad: 'בנקים',
    yahav: 'בנקים', beyahadBishvilha: 'בנקים', behatsdaa: 'בנקים',
    pagi: 'בנקים', oneZero: 'בנקים',
  };

  return Object.entries(COMPANY_CONFIG).map(([key, cfg]) => ({
    value: key,
    label: cfg.name,
    group: GROUPS[key] || 'אחר',
    otpFlow: cfg.otpFlow || false,
    fields: cfg.credFields.map(f => ({
      name: f,
      label: FIELD_LABELS[f] || f,
      type: f === 'password' ? 'password' : f === 'email' ? 'email' : f === 'phoneNumber' ? 'tel' : 'text',
      inputMode: ['card6Digits', 'num', 'id', 'nationalID', 'userCode'].includes(f) ? 'numeric' : undefined,
    })),
  }));
};
