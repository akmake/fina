import { createScraper, CompanyTypes } from 'israeli-bank-scrapers';
import { parseTransactions } from '../utils/excelParser.js';
import AppError from '../utils/AppError.js';

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

// Generic toRow for all scrapers:
// chargedAmount < 0 = expense, > 0 = income (universal convention in the library)
const toRowGeneric = (source) => (txn) => ({
  'תאריך עסקה': new Date(txn.date),
  'שם בית העסק': txn.description || txn.memo || 'לא ידוע',
  'סכום בש"ח': -(txn.chargedAmount || 0), // negate: scraper negative→expense, cal parser positive→expense
  ...extraFields(txn, source),
});

const toRowMax = (txn) => {
  const charged = txn.chargedAmount || 0;
  const base = {
    'תאריך עסקה': new Date(txn.date),
    'שם בית העסק': txn.description || txn.memo || 'לא ידוע',
    ...extraFields(txn, 'max'),
  };
  return charged <= 0
    ? { ...base, 'סכום חיוב': Math.abs(charged) }
    : { ...base, 'סכום זיכוי': charged };
};

// credFields: which credential fields this company needs (order matters for display)
const COMPANY_CONFIG = {
  // ── כרטיסי אשראי ──────────────────────────────────────────────────────────
  max: {
    companyId: CompanyTypes.max,
    fileType: 'max',
    name: 'מקס',
    credFields: ['username', 'password'],
    toRow: toRowMax,
  },
  visaCal: {
    companyId: CompanyTypes.visaCal,
    fileType: 'cal',
    name: 'כאל',
    credFields: ['username', 'password'],
    toRow: toRowGeneric('visaCal'),
  },
  isracard: {
    companyId: CompanyTypes.isracard,
    fileType: 'cal',
    name: 'ישראכרט',
    credFields: ['id', 'card6Digits', 'password'],
    toRow: toRowGeneric('isracard'),
  },
  amex: {
    companyId: CompanyTypes.amex,
    fileType: 'cal',
    name: 'אמריקן אקספרס',
    credFields: ['id', 'card6Digits', 'password'],
    toRow: toRowGeneric('amex'),
  },

  // ── בנקים ──────────────────────────────────────────────────────────────────
  hapoalim: {
    companyId: CompanyTypes.hapoalim,
    fileType: 'cal',
    name: 'בנק הפועלים',
    credFields: ['userCode', 'password'],
    toRow: toRowGeneric('hapoalim'),
  },
  leumi: {
    companyId: CompanyTypes.leumi,
    fileType: 'cal',
    name: 'בנק לאומי',
    credFields: ['username', 'password'],
    toRow: toRowGeneric('leumi'),
  },
  discount: {
    companyId: CompanyTypes.discount,
    fileType: 'cal',
    name: 'בנק דיסקונט',
    credFields: ['id', 'password', 'num'],
    toRow: toRowGeneric('discount'),
  },
  mercantile: {
    companyId: CompanyTypes.mercantile,
    fileType: 'cal',
    name: 'מרכנתיל',
    credFields: ['id', 'password', 'num'],
    toRow: toRowGeneric('mercantile'),
  },
  mizrahi: {
    companyId: CompanyTypes.mizrahi,
    fileType: 'cal',
    name: 'מזרחי-טפחות',
    credFields: ['username', 'password'],
    toRow: toRowGeneric('mizrahi'),
  },
  otsarHahayal: {
    companyId: CompanyTypes.otsarHahayal,
    fileType: 'cal',
    name: 'אוצר החייל',
    credFields: ['username', 'password'],
    toRow: toRowGeneric('otsarHahayal'),
  },
  beinleumi: {
    companyId: CompanyTypes.beinleumi,
    fileType: 'cal',
    name: 'הבינלאומי',
    credFields: ['username', 'password'],
    toRow: toRowGeneric('beinleumi'),
  },
  union: {
    companyId: CompanyTypes.union,
    fileType: 'cal',
    name: 'איגוד',
    credFields: ['username', 'password'],
    toRow: toRowGeneric('union'),
  },
  massad: {
    companyId: CompanyTypes.massad,
    fileType: 'cal',
    name: 'מסד',
    credFields: ['username', 'password'],
    toRow: toRowGeneric('massad'),
  },
  yahav: {
    companyId: CompanyTypes.yahav,
    fileType: 'cal',
    name: 'יהב',
    credFields: ['username', 'nationalID', 'password'],
    toRow: toRowGeneric('yahav'),
  },
  beyahadBishvilha: {
    companyId: CompanyTypes.beyahadBishvilha,
    fileType: 'cal',
    name: 'ביחד בשבילה',
    credFields: ['id', 'password'],
    toRow: toRowGeneric('beyahadBishvilha'),
  },
  behatsdaa: {
    companyId: CompanyTypes.behatsdaa,
    fileType: 'cal',
    name: 'בהצדעה',
    credFields: ['id', 'password'],
    toRow: toRowGeneric('behatsdaa'),
  },
  pagi: {
    companyId: CompanyTypes.pagi,
    fileType: 'cal',
    name: 'פאגי',
    credFields: ['username', 'password'],
    toRow: toRowGeneric('pagi'),
  },
  oneZero: {
    companyId: CompanyTypes.oneZero,
    fileType: 'cal',
    name: 'One Zero',
    credFields: ['email', 'password'],
    toRow: toRowGeneric('oneZero'),
  },
};

export const scrapeCompany = async (req, res, next) => {
  const { company, startDate, ...formFields } = req.body;
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

    // Transactions
    const cleanedData = (result.accounts || []).flatMap(account =>
      account.txns.map(config.toRow)
    );

    // Account balances (banks return this, credit cards usually don't)
    const balances = (result.accounts || [])
      .filter(a => a.balance != null)
      .map(a => ({ accountNumber: a.accountNumber, balance: a.balance }));

    // Future debits (upcoming credit card charges hitting bank accounts)
    const futureDebits = result.futureDebits || [];

    if (cleanedData.length === 0) {
      return res.json({ transactions: [], unseenMerchants: [], balances, futureDebits });
    }

    const { transactions, unseenMerchants } = await parseTransactions(cleanedData, config.fileType, userId);

    res.json({ transactions, unseenMerchants, balances, futureDebits });
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
