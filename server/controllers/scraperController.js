import { createScraper, CompanyTypes } from 'israeli-bank-scrapers';
import { parseTransactions } from '../utils/excelParser.js';
import AppError from '../utils/AppError.js';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * israeli-bank-scrapers — מבנה הנתונים המלא
 * ════════════════════════════════════════════════════════════════════════════
 *
 * scraper.scrape(credentials) מחזיר:
 * {
 *   success: boolean,
 *   errorType?: 'invalidPassword' | 'changePassword' | 'timeout' | 'generic',
 *   accounts?: [
 *     {
 *       accountNumber: string,
 *       balance?: number,          // יתרת חשבון (בנקים בדרך כלל, כרטיסי אשראי לא תמיד)
 *       txns: Transaction[]
 *     }
 *   ],
 *   futureDebits?: [              // חיובים עתידיים (מתי יצא הכסף מחשבון הבנק)
 *     {
 *       amount: number,
 *       amountCurrency: string,
 *       chargeDate?: string,       // ISO date
 *       bankAccountNumber?: string
 *     }
 *   ]
 * }
 *
 * Transaction:
 * {
 *   type:             'normal' | 'installments',
 *   identifier?:      string | number,  // אסמכתא
 *   date:             string,           // ISO — תאריך הרכישה
 *   processedDate:    string,           // ISO — תאריך החיוב בפועל
 *   originalAmount:   number,           // סכום במטבע מקורי (לקניות בחו"ל)
 *   originalCurrency: string,           // מטבע מקורי (ILS, USD, EUR...)
 *   chargedAmount:    number,           // סכום בש"ח — תלוי בחברה! ראה הערת סימנים למטה
 *   chargedCurrency?: string,
 *   description:      string,           // שם בית העסק
 *   memo?:            string,           // הערות חופשיות
 *   status:           'completed' | 'pending',   // ממתינה = עדיין לא חויבה!
 *   installments?:    { number: number, total: number }, // תשלום X מתוך Y
 *   category?:        string,           // קטגוריה מהאתר (לא תמיד קיים)
 * }
 *
 * אפשרויות createScraper רלוונטיות:
 *   combineInstallments: false     → כל תשלום = עסקה נפרדת (מה שיש לנו)
 *   futureMonthsToScrape: number   → שלוף עסקאות עתידיות N חודשים קדימה
 *   additionalTransactionInformation: true → מידע מעמיק יותר (אטי יותר)
 *
 * ════════════════════════════════════════════════════════════════════════════
 */

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
const COMPANY_CONFIG = {
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
    credFields: ['email', 'password'],
    toRow: toRowBank('oneZero'),
  },
};

export const scrapeCompany = async (req, res, next) => {
  const { company, startDate, incomesOnly, ...formFields } = req.body;
  const userId = req.user._id;

  const config = COMPANY_CONFIG[company];
  if (!config) return next(new AppError('חברת אשראי/בנק לא נתמכת', 400));

  // Build credentials object from only the fields this company needs
  const credentials = {};
  for (const field of config.credFields) {
    if (!formFields[field]) return next(new AppError(`חסר שדה: ${field}`, 400));
    credentials[field] = formFields[field];
  }

  const start = startDate
    ? new Date(startDate)
    : (() => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d; })();

  try {
    const scraper = createScraper({
      companyId: config.companyId,
      startDate: start,
      combineInstallments: false,
      showBrowser: false,
    });

    const result = await scraper.scrape(credentials);

    if (!result.success) {
      const errMsg = result.errorType === 'invalidPassword'
        ? 'שם משתמש או סיסמא שגויים'
        : `שגיאת כניסה: ${result.errorType}`;
      return next(new AppError(errMsg, 401));
    }

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

    // Transactions — optionally filter to incomes only (chargedAmount > 0) for bank accounts
    const allTxns = (result.accounts || []).flatMap(account =>
      account.txns.map(txn => ({ ...txn, _accountNumber: account.accountNumber || null }))
    );

    // DEBUG: log first 3 raw transactions to check chargedAmount sign
    if (allTxns.length > 0) {
      console.log(`[scraper-debug] company=${company}, first 3 raw txns:`);
      allTxns.slice(0, 3).forEach((t, i) => {
        console.log(`  [${i}] desc="${t.description}" chargedAmount=${t.chargedAmount} originalAmount=${t.originalAmount}`);
      });
    }

    const txnsToProcess = incomesOnly ? allTxns.filter(t => (t.chargedAmount || 0) > 0) : allTxns;
    const cleanedData = txnsToProcess.map(txn => {
      const row = config.toRow(txn);
      if (txn._accountNumber) row._cardNumber = txn._accountNumber;
      return row;
    });

    // Account balances (banks return this, credit cards usually don't)
    const balances = (result.accounts || [])
      .filter(a => a.balance != null)
      .map(a => ({ accountNumber: a.accountNumber, balance: a.balance }));

    // Future debits (upcoming credit card charges hitting bank accounts)
    const futureDebits = result.futureDebits || [];

    if (cleanedData.length === 0) {
      return res.json({ transactions: [], unseenMerchants: [], balances, futureDebits, rawAccounts });
    }

    const { transactions, unseenMerchants } = await parseTransactions(cleanedData, config.fileType, userId);

    res.json({ transactions, unseenMerchants, balances, futureDebits, rawAccounts });
  } catch (error) {
    console.error(`${config.name} scrape error:`, error);
    return next(new AppError(`שגיאה בגישה ל${config.name}: ${error.message}`, 500));
  }
};

// Export config so frontend can know which fields each company needs
export const getCompanies = (req, res) => {
  const FIELD_LABELS = {
    username:   'שם משתמש',
    userCode:   'קוד משתמש',
    id:         'תעודת זהות',
    card6Digits:'6 ספרות אחרונות של הכרטיס',
    num:        'מספר לקוח',
    nationalID: 'מספר זהות',
    email:      'אימייל',
    password:   'סיסמא',
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

  const companies = Object.entries(COMPANY_CONFIG).map(([key, cfg]) => ({
    value: key,
    label: cfg.name,
    group: GROUPS[key] || 'אחר',
    fields: cfg.credFields.map(f => ({
      name: f,
      label: FIELD_LABELS[f] || f,
      type: f === 'password' ? 'password' : f === 'email' ? 'email' : 'text',
      inputMode: ['card6Digits', 'num', 'id', 'nationalID', 'userCode'].includes(f) ? 'numeric' : undefined,
    })),
  }));

  res.json(companies);
};
