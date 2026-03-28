import axios from 'axios';
import AppError from '../utils/AppError.js';
import { parseTransactions } from '../utils/excelParser.js';

// ── Cal API endpoints ──────────────────────────────────────────────────────
const BASE_URL    = 'https://api.cal-online.co.il';
const CONNECT_URL = 'https://connect.cal-online.co.il';
const X_SITE_ID   = '09031987-273E-2311-906C-8AF85B17C8D9';

const CAL_HEADERS = {
  'Content-Type':    'application/json',
  'Accept':          'application/json, text/plain, */*',
  'Origin':          'https://digital-web.cal-online.co.il',
  'Referer':         'https://digital-web.cal-online.co.il/',
  'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
  'Accept-Language': 'he-IL,he;q=0.9',
  'x-site-id':       X_SITE_ID,
};

// ── שמירת UUID token בין שלב 1 לשלב 2 ────────────────────────────────────
const otpSessions = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [key, val] of otpSessions)
    if (now - val.ts > 10 * 60 * 1000) otpSessions.delete(key);
}, 60_000);

// ── שלב 1: בקשת OTP ───────────────────────────────────────────────────────
export const requestOtp = async (req, res, next) => {
  const { id, last4, channel } = req.body;
  if (!id || !last4) return next(new AppError('חסרים פרטי זיהוי', 400));

  try {
    const { data } = await axios.put(
      `${CONNECT_URL}/col-rest/calconnect/authentication/otp`,
      { userId: id, last4Digits: last4, bankAccountNum: last4, sMSTemplate: null, recaptcha: '' },
      { headers: CAL_HEADERS, timeout: 15000 }
    );

    const uuid = data?.token;
    if (!uuid) {
      console.error('[cal] no token in OTP request response:', data);
      return next(new AppError('שגיאה בשליחת קוד — לא התקבל token', 502));
    }

    otpSessions.set(`${id}_${last4}`, { uuid, ts: Date.now() });
    console.log('[cal] OTP sent, stored uuid for', `${id.slice(0,3)}***`);

    res.json({ maskedPhone: data?.phoneNumber || '' });
  } catch (err) {
    console.error('[cal] requestOtp error:', err.response?.data || err.message);
    return next(new AppError(err.response?.data?.message || 'שגיאה בשליחת קוד', 502));
  }
};

// ── שלב 2: אימות OTP + שליפת עסקאות ──────────────────────────────────────
export const verifyOtpAndFetch = async (req, res, next) => {
  const { id, last4, otp, startDate } = req.body;
  if (!id || !last4 || !otp) return next(new AppError('חסרים פרטים', 400));

  const session = otpSessions.get(`${id}_${last4}`);
  if (!session?.uuid) return next(new AppError('פג תוקף — בקש קוד חדש', 400));

  try {
    // 2a. אמת OTP
    const { data: authData } = await axios.post(
      `${CONNECT_URL}/col-rest/calconnect/authentication/otp`,
      { custID: id, password: otp, token: session.uuid },
      { headers: CAL_HEADERS, timeout: 15000 }
    );

    const authToken = authData?.token;
    if (!authToken) {
      console.error('[cal] no auth token in verify response:', authData);
      return next(new AppError('קוד שגוי או פג תוקף', 401));
    }

    otpSessions.delete(`${id}_${last4}`);
    console.log('[cal] auth token received, innerLoginType:', authData?.innerLoginType);

    const authHeaders = {
      ...CAL_HEADERS,
      'Authorization': `CALAuthScheme ${authToken}`,
    };

    // 2b. init — קבל רשימת כרטיסים + bankAccountUniqueID
    const { data: initData } = await axios.post(
      `${BASE_URL}/Authentication/api/account/init`,
      {},
      { headers: authHeaders, timeout: 15000 }
    );

    console.log('[cal] init result keys:', Object.keys(initData?.result || initData || {}));

    const allCards = extractCards(initData);
    console.log('[cal] cards found:', allCards.map(c => `${c.cardType} ...${c.last4Digits}`));

    const bankAccountUniqueID = initData?.result?.bankAccounts?.[0]?.bankAccountUniqueID || '';
    console.log('[cal] bankAccountUniqueID:', bankAccountUniqueID);

    // 2c. שלוף עסקאות
    const start = startDate ? new Date(startDate) : (() => {
      const d = new Date(); d.setMonth(d.getMonth() - 2); return d;
    })();
    const endDate = new Date();

    const { data: txnData } = await axios.post(
      `${BASE_URL}/Transactions/api/filteredTransactions/getFilteredTransactions`,
      {
        bankAccountUniqueID,
        caller:              'dashboard',
        cards:               allCards.map(c => ({ cardUniqueID: c.cardUniqueId })),
        fromTransDate:       start.toISOString(),
        toTransDate:         endDate.toISOString(),
        fromTrnAmt:          0,
        toTrnAmt:            0,
        merchantHebCity:     '',
        merchantHebName:     '',
        transCardPresentInd: 0,
        transactionsOrigin:  0,
        trnType:             0,
        walletTranInd:       0,
      },
      { headers: authHeaders, timeout: 30000 }
    );

    console.log('[cal] getFilteredTransactions result keys:', Object.keys(txnData?.result || {}));

    const transArr = txnData?.result?.transArr || [];
    console.log('[cal] total transactions:', transArr.length);

    // קבץ לפי cardUniqueId
    const cardMap = new Map();

    // אתחל כרטיסים מה-init (כולל כרטיסים ללא עסקאות)
    for (const card of allCards) {
      cardMap.set(card.cardUniqueId, {
        accountNumber: card.last4Digits,
        cardType:      card.cardType,
        txns: [],
      });
    }

    for (const t of transArr) {
      const uid = t.cardUniqueId;
      if (!uid) continue;
      if (!cardMap.has(uid)) {
        // כרטיס שלא היה ב-init — הוסף אותו
        cardMap.set(uid, {
          accountNumber: extractLast4(uid, t),
          cardType:      t.companyDescription || 'כרטיס',
          txns: [],
        });
      }
      cardMap.get(uid).txns.push(convertTransaction(t));
    }

    // הוסף עסקאות ממתינות
    if (allCards.length > 0) {
      await Promise.allSettled(
        allCards.map(async card => {
          try {
            const { data: pendingData } = await axios.post(
              `${BASE_URL}/Transactions/api/approvals/getClearanceRequests`,
              { cardUniqueIDArray: [card.cardUniqueId] },
              { headers: authHeaders, timeout: 15000 }
            );
            const pendingTxns = parsePendingTransactions(pendingData);
            if (cardMap.has(card.cardUniqueId)) cardMap.get(card.cardUniqueId).txns.push(...pendingTxns);
          } catch (err) {
            console.warn(`[cal] pending card ...${card.last4Digits}:`, err.message);
          }
        })
      );
    }

    if (cardMap.size === 0) {
      return next(new AppError('לא נמצאו כרטיסים בחשבון', 404));
    }

    const accounts = Array.from(cardMap.values());
    res.json({ accounts });

  } catch (err) {
    console.error('[cal] verifyOtp error status:', err.response?.status);
    console.error('[cal] verifyOtp error data:', JSON.stringify(err.response?.data, null, 2));
    if (err.response?.status === 401) return next(new AppError('קוד שגוי או פג תוקף', 401));
    return next(new AppError(err.response?.data?.message || err.message || 'שגיאה בכניסה לכאל', 502));
  }
};

// ── עזר: חלץ כרטיסים מ-init ──────────────────────────────────────────────
function extractCards(initData) {
  const result = initData?.result || initData || {};

  if (Array.isArray(result.cards) && result.cards.length > 0) {
    return result.cards
      .filter(c => (c.cardUniqueId || c.cardUniqueID) && c.last4Digits)
      .map(c => ({
        cardUniqueId: c.cardUniqueId || c.cardUniqueID,
        last4Digits:  String(c.last4Digits),
        cardType:     c.companyDescription || c.cardType || 'כרטיס',
      }));
  }

  // fallback — סרוק את כל שדות המערך
  const seen  = new Set();
  const cards = [];
  for (const key of Object.keys(result)) {
    if (!Array.isArray(result[key])) continue;
    for (const item of result[key]) {
      const uid = item?.cardUniqueId || item?.cardUniqueID || item?.cardId;
      const l4  = item?.last4Digits  || item?.last4;
      if (uid && l4 && !seen.has(uid)) {
        seen.add(uid);
        cards.push({
          cardUniqueId: uid,
          last4Digits:  String(l4),
          cardType:     item?.companyDescription || item?.cardBrandName || item?.cardType || 'כרטיס',
        });
      }
    }
  }
  return cards;
}

// ── עזר: חלץ 4 ספרות אחרונות ─────────────────────────────────────────────
function extractLast4(uid, txn) {
  const match = String(uid).match(/\d{4}$/);
  if (match) return match[0];
  if (txn?.last4Digits) return String(txn.last4Digits);
  return uid.slice(-4);
}

// ── עזר: עסקאות ממתינות ────────────────────────────────────────────────────
function parsePendingTransactions(data) {
  if (!data?.result?.cardsList) return [];
  return data.result.cardsList
    .flatMap(c => c.authDetalisList || [])
    .map(t => convertPendingTransaction(t));
}

// ── עזר: קודי סוג עסקה (מתואם עם israeli-bank-scrapers TrnTypeCode) ──────
const TRN_TYPE = { regular: '5', credit: '6', installments: '8', standingOrder: '9' };

// ── עזר: המר עסקה מ-getFilteredTransactions ──────────────────────────────
function convertTransaction(t) {
  const rawAmt   = t.trnAmt ?? 0;
  const typeCode = String(t.trnTypeCode ?? t.transactionTypeCode ?? '');

  // chargedAmount = ILS charge for this billing period (negated: negative = expense)
  const charged = (t.amtBeforeConvAndIndex ?? rawAmt) * -1;

  // originalAmount = original-currency amount with sign (credit/refund → positive, else → negative)
  const originalAmount = rawAmt * (typeCode === TRN_TYPE.credit ? 1 : -1);

  const numOfPay = t.numOfPayments;
  const curPay   = t.curPaymentNum ?? 1;
  const installments = numOfPay
    ? { number: curPay, total: numOfPay }
    : undefined;

  // Adjust date for installments: add (curPaymentNum − 1) months to purchase date
  // (matches israeli-bank-scrapers convention)
  let date = t.trnPurchaseDate || null;
  if (installments && date) {
    const d = new Date(date);
    d.setMonth(d.getMonth() + (curPay - 1));
    date = d.toISOString();
  }

  // type: only regular(5) + standingOrder(9) are 'normal', everything else is 'installments'
  const isNormal = [TRN_TYPE.regular, TRN_TYPE.standingOrder].includes(typeCode);

  return {
    date,
    processedDate:    t.debCrdDate      || null,
    description:      t.merchantName   || '',
    memo:             String(t.transTypeCommentDetails ?? t.trnType ?? ''),
    originalAmount,
    originalCurrency: t.trnCurrencySymbol || 'ILS',
    chargedAmount:    charged,
    status:           'completed',
    type:             isNormal ? 'normal' : 'installments',
    installments,
    identifier:       t.trnIntId != null ? String(t.trnIntId) : undefined,
    category:         t.branchCodeDesc || undefined,
  };
}

// ── עזר: המר עסקה ממתינה ─────────────────────────────────────────────────
function convertPendingTransaction(t) {
  const rawAmt   = t.trnAmt ?? 0;
  const numOfPay = t.numberOfPayments;
  const installments = numOfPay ? { number: 1, total: numOfPay } : undefined;

  // Pending transactions: trnTypeCode may be absent → default to expense (negative)
  const typeCode = String(t.trnTypeCode ?? t.transactionTypeCode ?? '');
  const originalAmount = rawAmt * (typeCode === TRN_TYPE.credit ? 1 : -1);

  return {
    date:             t.trnPurchaseDate || null,
    processedDate:    t.trnPurchaseDate || null,
    description:      t.merchantName   || '',
    memo:             String(t.transTypeCommentDetails || ''),
    originalAmount,
    originalCurrency: t.trnCurrencySymbol || 'ILS',
    chargedAmount:    rawAmt * -1,
    status:           'pending',
    type:             'normal',
    installments,
    identifier:       undefined,
  };
}

// ── endpoint: קבל accounts מהלקוח ועבד לDB ────────────────────────────────
export const processRawAccounts = async (req, res, next) => {
  const { accounts } = req.body;
  const userId = req.user._id;

  if (!Array.isArray(accounts)) return next(new AppError('נתונים שגויים', 400));

  const cleanedData = [];
  for (const acc of accounts) {
    for (const txn of (acc.txns || [])) {
      cleanedData.push(calTxnToRow(txn, acc.accountNumber));
    }
  }

  if (cleanedData.length === 0) return res.json({ transactions: [], unseenMerchants: [] });

  try {
    const { transactions, unseenMerchants } = await parseTransactions(cleanedData, 'cal', userId);
    res.json({ transactions, unseenMerchants });
  } catch (err) {
    return next(new AppError(err.message || 'שגיאה בעיבוד עסקאות', 500));
  }
};

// ── עזר: פורמט תאריך לכאל (DD/MM/YYYY) ──────────────────────────────────
function formatDateForCal(date) {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

// ── עזר: המרת עסקת CAL לשורה בפורמט toRowCreditCard (כמו MAX) ──────────
const extraFields = (txn) => ({
  _processedDate:    txn.processedDate ? new Date(txn.processedDate) : null,
  _originalAmount:   txn.originalAmount  ?? null,
  _originalCurrency: txn.originalCurrency ?? null,
  _scraperType:      txn.type     ?? null,
  _status:           txn.status   ?? null,
  _installments:     txn.installments ?? null,
  _identifier:       txn.identifier != null ? String(txn.identifier) : null,
  _scraperCategory:  txn.category ?? null,
  _memo:             txn.memo     ?? null,
  _source:           'visaCal',
});

function calTxnToRow(txn, accountNumber) {
  // chargedAmount is already negated: negative = expense, positive = income/refund
  // Use ?? (not ||) so chargedAmount === 0 doesn't fall through to originalAmount
  const charged = txn.chargedAmount ?? txn.originalAmount ?? 0;
  return {
    'תאריך עסקה': new Date(txn.date),
    'שם בית העסק': txn.description || txn.memo || 'לא ידוע',
    'סכום בש"ח': Math.abs(charged),
    ...extraFields(txn),
    _transactionType: charged <= 0 ? 'הוצאה' : 'הכנסה',
    _cardNumber: accountNumber || null,
  };
}

// ── שלב 2 (ייבוא): אימות OTP + שליפת עסקאות + המרה לפורמט ייבוא ───────
export const verifyOtpAndImport = async (req, res, next) => {
  const { id, last4, otp, startDate } = req.body;
  const userId = req.user._id;
  if (!id || !last4 || !otp) return next(new AppError('חסרים פרטים', 400));

  const session = otpSessions.get(`${id}_${last4}`);
  if (!session?.uuid) return next(new AppError('פג תוקף — בקש קוד חדש', 400));

  try {
    // 2a. אמת OTP
    const { data: authData } = await axios.post(
      `${CONNECT_URL}/col-rest/calconnect/authentication/otp`,
      { custID: id, password: otp, token: session.uuid },
      { headers: CAL_HEADERS, timeout: 15000 }
    );

    const authToken = authData?.token;
    if (!authToken) return next(new AppError('קוד שגוי או פג תוקף', 401));

    otpSessions.delete(`${id}_${last4}`);

    const authHeaders = { ...CAL_HEADERS, 'Authorization': `CALAuthScheme ${authToken}` };

    // 2b. init — קבל רשימת כרטיסים
    const { data: initData } = await axios.post(
      `${BASE_URL}/Authentication/api/account/init`, {},
      { headers: authHeaders, timeout: 15000 }
    );

    const allCards = extractCards(initData);
    const bankAccountUniqueID = initData?.result?.bankAccounts?.[0]?.bankAccountUniqueID || '';

    // 2c. שלוף עסקאות
    const start = startDate ? new Date(startDate) : (() => { const d = new Date(); d.setMonth(d.getMonth() - 2); return d; })();
    const endDate = new Date();

    const { data: txnData } = await axios.post(
      `${BASE_URL}/Transactions/api/filteredTransactions/getFilteredTransactions`,
      {
        bankAccountUniqueID,
        caller: 'dashboard',
        cards: allCards.map(c => ({ cardUniqueID: c.cardUniqueId })),
        fromTransDate: start.toISOString(),
        toTransDate: endDate.toISOString(),
        fromTrnAmt: 0, toTrnAmt: 0,
        merchantHebCity: '', merchantHebName: '',
        transCardPresentInd: 0, transactionsOrigin: 0, trnType: 0, walletTranInd: 0,
      },
      { headers: authHeaders, timeout: 30000 }
    );

    const transArr = txnData?.result?.transArr || [];

    // DEBUG: log first few raw transactions (installment + regular) for verification
    const installmentSample = transArr.filter(t => t.numOfPayments > 0).slice(0, 3);
    const regularSample     = transArr.filter(t => !t.numOfPayments).slice(0, 2);
    console.log('[cal-import-debug] total raw txns:', transArr.length);
    for (const s of [...installmentSample, ...regularSample]) {
      console.log('[cal-import-debug] raw txn:', JSON.stringify({
        merchantName: s.merchantName,
        trnAmt: s.trnAmt,
        amtBeforeConvAndIndex: s.amtBeforeConvAndIndex,
        numOfPayments: s.numOfPayments,
        curPaymentNum: s.curPaymentNum,
        trnTypeCode: s.trnTypeCode,
        transactionTypeCode: s.transactionTypeCode,
        trnPurchaseDate: s.trnPurchaseDate,
        debCrdDate: s.debCrdDate,
        trnCurrencySymbol: s.trnCurrencySymbol,
        transTypeCommentDetails: s.transTypeCommentDetails,
        branchCodeDesc: s.branchCodeDesc,
      }));
    }

    // קבץ עסקאות לפי כרטיס
    const cardMap = new Map();
    for (const card of allCards) {
      cardMap.set(card.cardUniqueId, { accountNumber: card.last4Digits, cardType: card.cardType, txns: [] });
    }
    for (const t of transArr) {
      const uid = t.cardUniqueId;
      if (!uid) continue;
      if (!cardMap.has(uid)) {
        cardMap.set(uid, { accountNumber: extractLast4(uid, t), cardType: t.companyDescription || 'כרטיס', txns: [] });
      }
      cardMap.get(uid).txns.push(convertTransaction(t));
    }

    // הוסף עסקאות ממתינות
    await Promise.allSettled(
      allCards.map(async card => {
        try {
          const { data: pendingData } = await axios.post(
            `${BASE_URL}/Transactions/api/approvals/getClearanceRequests`,
            { cardUniqueIDArray: [card.cardUniqueId] },
            { headers: authHeaders, timeout: 15000 }
          );
          const pendingTxns = parsePendingTransactions(pendingData);
          if (cardMap.has(card.cardUniqueId)) cardMap.get(card.cardUniqueId).txns.push(...pendingTxns);
        } catch (err) {
          console.warn(`[cal-import] pending card ...${card.last4Digits}:`, err.message);
        }
      })
    );

    // המר לפורמט toRowCreditCard (כמו scraperController עושה ל-MAX)
    const cleanedData = [];
    for (const [, acc] of cardMap) {
      for (const txn of acc.txns) {
        cleanedData.push(calTxnToRow(txn, acc.accountNumber));
      }
    }

    if (cleanedData.length === 0) {
      return res.json({ transactions: [], unseenMerchants: [] });
    }

    const { transactions, unseenMerchants } = await parseTransactions(cleanedData, 'cal', userId);

    res.json({ transactions, unseenMerchants });

  } catch (err) {
    console.error('[cal-import] error:', err.response?.status, err.response?.data || err.message);
    if (err.response?.status === 401) return next(new AppError('קוד שגוי או פג תוקף', 401));
    return next(new AppError(err.response?.data?.message || err.message || 'שגיאה בכניסה לכאל', 502));
  }
};
