import axios from 'axios';
import AppError from '../utils/AppError.js';

/**
 * calService — CAL (כאל) direct-API client.
 *
 * CAL logs in with ID + last-4 digits + an SMS one-time code (no reusable
 * password/token), so it can't run through the headless scraper. Shared by:
 *   - the interactive one-time import (controllers/calController.js), and
 *   - the unattended daily sync (services/importRunner.js), where the SMS code
 *     is relayed by the user's paired phone (see docs/modules/import.md).
 */

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

/** CAL codes are valid for a few minutes; we wait this long for the phone. */
export const CAL_OTP_TTL_MS = 10 * 60 * 1000;

/** Step 1 — ask CAL to SMS a code. Returns the session uuid needed for step 2. */
export const requestCalOtp = async ({ id, last4 }) => {
  if (!id || !last4) throw new AppError('חסרים פרטי זיהוי', 400);
  try {
    const { data } = await axios.put(
      `${CONNECT_URL}/col-rest/calconnect/authentication/otp`,
      { userId: id, last4Digits: last4, bankAccountNum: last4, sMSTemplate: null, recaptcha: '' },
      { headers: CAL_HEADERS, timeout: 15000 }
    );
    const uuid = data?.token;
    if (!uuid) throw new AppError('שגיאה בשליחת קוד — לא התקבל token מכאל', 502);
    return { uuid, maskedPhone: data?.phoneNumber || '' };
  } catch (err) {
    if (err instanceof AppError) throw err;
    const s = err.response?.status;
    if (s === 400 || s === 401 || s === 403 || s === 404) {
      throw new AppError(err.response?.data?.message || 'כאל לא זיהתה את תעודת הזהות / 4 הספרות — בדוק את הפרטים', 400);
    }
    throw new AppError(err.response?.data?.message || 'שגיאה בשליחת קוד מכאל', 502);
  }
};

// Wrong/expired SMS code: 422 + code, so it is never confused with an auth 401
// (the web client would try a session refresh; the phone app would re-pair).
const otpInvalid = () => Object.assign(new AppError('קוד שגוי או פג תוקף', 422), { code: 'OTP_INVALID' });

/** Step 2a — exchange the SMS code for an auth token. */
export const verifyCalOtp = async ({ id, otp, uuid }) => {
  try {
    const { data } = await axios.post(
      `${CONNECT_URL}/col-rest/calconnect/authentication/otp`,
      { custID: id, password: otp, token: uuid },
      { headers: CAL_HEADERS, timeout: 15000 }
    );
    if (!data?.token) throw otpInvalid();
    return data.token;
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (err.response?.status === 401) throw otpInvalid();
    throw new AppError(err.response?.data?.message || 'שגיאה בכניסה לכאל', 502);
  }
};

/**
 * Step 2b — with an auth token, load cards, transactions and pending charges.
 * @returns {Promise<Array<{accountNumber:string, cardType:string, txns:object[]}>>}
 */
export const fetchCalAccounts = async (authToken, startDate) => {
  const authHeaders = { ...CAL_HEADERS, Authorization: `CALAuthScheme ${authToken}` };

  const { data: initData } = await axios.post(
    `${BASE_URL}/Authentication/api/account/init`, {},
    { headers: authHeaders, timeout: 15000 }
  );
  const allCards = extractCards(initData);
  const bankAccountUniqueID = initData?.result?.bankAccounts?.[0]?.bankAccountUniqueID || '';

  const start = startDate ? new Date(startDate) : (() => { const d = new Date(); d.setMonth(d.getMonth() - 2); return d; })();

  const { data: txnData } = await axios.post(
    `${BASE_URL}/Transactions/api/filteredTransactions/getFilteredTransactions`,
    {
      bankAccountUniqueID,
      caller: 'dashboard',
      cards: allCards.map((c) => ({ cardUniqueID: c.cardUniqueId })),
      fromTransDate: start.toISOString(),
      toTransDate: new Date().toISOString(),
      fromTrnAmt: 0, toTrnAmt: 0,
      merchantHebCity: '', merchantHebName: '',
      transCardPresentInd: 0, transactionsOrigin: 0, trnType: 0, walletTranInd: 0,
    },
    { headers: authHeaders, timeout: 30000 }
  );
  const transArr = txnData?.result?.transArr || [];

  // Group by card (init cards first so cards without transactions still appear)
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

  // Pending (not yet cleared) charges
  await Promise.allSettled(allCards.map(async (card) => {
    try {
      const { data: pendingData } = await axios.post(
        `${BASE_URL}/Transactions/api/approvals/getClearanceRequests`,
        { cardUniqueIDArray: [card.cardUniqueId] },
        { headers: authHeaders, timeout: 15000 }
      );
      cardMap.get(card.cardUniqueId)?.txns.push(...parsePendingTransactions(pendingData));
    } catch (err) {
      console.warn(`[cal] pending card ...${card.last4Digits}:`, err.message);
    }
  }));

  return Array.from(cardMap.values());
};

/** Flatten CAL accounts into parseTransactions rows (fileType 'cal'). */
export const calAccountsToRows = (accounts = []) => {
  const rows = [];
  for (const acc of accounts) {
    for (const txn of (acc.txns || [])) rows.push(calTxnToRow(txn, acc.accountNumber));
  }
  return rows;
};

// ── helpers ────────────────────────────────────────────────────────────────

function extractCards(initData) {
  const result = initData?.result || initData || {};

  if (Array.isArray(result.cards) && result.cards.length > 0) {
    return result.cards
      .filter((c) => (c.cardUniqueId || c.cardUniqueID) && c.last4Digits)
      .map((c) => ({
        cardUniqueId: c.cardUniqueId || c.cardUniqueID,
        last4Digits:  String(c.last4Digits),
        cardType:     c.companyDescription || c.cardType || 'כרטיס',
      }));
  }

  // fallback — scan every array field
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

function extractLast4(uid, txn) {
  const match = String(uid).match(/\d{4}$/);
  if (match) return match[0];
  if (txn?.last4Digits) return String(txn.last4Digits);
  return String(uid).slice(-4);
}

function parsePendingTransactions(data) {
  if (!data?.result?.cardsList) return [];
  return data.result.cardsList
    .flatMap((c) => c.authDetalisList || [])
    .map((t) => convertPendingTransaction(t));
}

// Transaction type codes (aligned with israeli-bank-scrapers TrnTypeCode)
const TRN_TYPE = { regular: '5', credit: '6', installments: '8', standingOrder: '9' };

function convertTransaction(t) {
  const rawAmt   = t.trnAmt ?? 0;
  const typeCode = String(t.trnTypeCode ?? t.transactionTypeCode ?? '');

  // chargedAmount = ILS charge for this billing period (negated: negative = expense)
  const charged = (t.amtBeforeConvAndIndex ?? rawAmt) * -1;
  // originalAmount = original-currency amount with sign (credit/refund → positive)
  const originalAmount = rawAmt * (typeCode === TRN_TYPE.credit ? 1 : -1);

  const numOfPay = t.numOfPayments;
  const curPay   = t.curPaymentNum ?? 1;
  const installments = numOfPay ? { number: curPay, total: numOfPay } : undefined;

  // Installments: shift purchase date by (curPaymentNum − 1) months (scrapers convention)
  let date = t.trnPurchaseDate || null;
  if (installments && date) {
    const d = new Date(date);
    d.setMonth(d.getMonth() + (curPay - 1));
    date = d.toISOString();
  }

  const isNormal = [TRN_TYPE.regular, TRN_TYPE.standingOrder].includes(typeCode);

  return {
    date,
    processedDate:    t.debCrdDate    || null,
    description:      t.merchantName  || '',
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

function convertPendingTransaction(t) {
  const rawAmt   = t.trnAmt ?? 0;
  const numOfPay = t.numberOfPayments;
  const installments = numOfPay ? { number: 1, total: numOfPay } : undefined;
  // Pending: trnTypeCode may be absent → default to expense (negative)
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
  // chargedAmount is already negated: negative = expense, positive = income/refund.
  // ?? (not ||) so chargedAmount === 0 doesn't fall through to originalAmount.
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
