/**
 * calDirectApi.js
 * כל הקריאות לכאל API מתבצעות ישירות מהדפדפן (IP של המשתמש, לא VPS)
 */

const BASE_URL    = 'https://api.cal-online.co.il';
const CONNECT_URL = 'https://connect.cal-online.co.il';
const X_SITE_ID   = '09031987-273E-2311-906C-8AF85B17C8D9';

const CAL_HEADERS = {
  'Content-Type':    'application/json',
  'Accept':          'application/json, text/plain, */*',
  'Accept-Language': 'he-IL,he;q=0.9',
  'x-site-id':       X_SITE_ID,
};

async function calFetch(url, options, timeoutMs = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { throw new Error('תגובה לא תקינה מכאל'); }
    if (!res.ok) throw new Error(data?.message || `שגיאה ${res.status}`);
    return data;
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('הבקשה פגה זמן');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ── שלב 1: בקשת OTP ── מחזיר { uuid, maskedPhone }
export async function requestOtp({ id, last4 }) {
  const data = await calFetch(
    `${CONNECT_URL}/col-rest/calconnect/authentication/otp`,
    {
      method: 'PUT',
      headers: CAL_HEADERS,
      body: JSON.stringify({ userId: id, last4Digits: last4, bankAccountNum: last4, sMSTemplate: null, recaptcha: '' }),
    }
  );
  if (!data?.token) throw new Error('שגיאה בשליחת קוד — לא התקבל token');
  return { uuid: data.token, maskedPhone: data?.phoneNumber || '' };
}

// ── שלב 2א: אימות OTP ── מחזיר authToken
export async function verifyOtp({ id, otp, uuid }) {
  const data = await calFetch(
    `${CONNECT_URL}/col-rest/calconnect/authentication/otp`,
    {
      method: 'POST',
      headers: CAL_HEADERS,
      body: JSON.stringify({ custID: id, password: otp, token: uuid }),
    }
  );
  if (!data?.token) throw new Error('קוד שגוי או פג תוקף');
  return data.token;
}

// ── שלב 2ב: שליפת עסקאות ── מחזיר accounts[]
export async function fetchTransactions({ authToken, startDate }) {
  const authHeaders = { ...CAL_HEADERS, 'Authorization': `CALAuthScheme ${authToken}` };

  const initData = await calFetch(
    `${BASE_URL}/Authentication/api/account/init`,
    { method: 'POST', headers: authHeaders, body: JSON.stringify({}) }
  );

  const allCards = extractCards(initData);
  const bankAccountUniqueID = initData?.result?.bankAccounts?.[0]?.bankAccountUniqueID || '';

  const start = startDate
    ? new Date(startDate)
    : (() => { const d = new Date(); d.setMonth(d.getMonth() - 2); return d; })();

  const txnData = await calFetch(
    `${BASE_URL}/Transactions/api/filteredTransactions/getFilteredTransactions`,
    {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        bankAccountUniqueID,
        caller:              'dashboard',
        cards:               allCards.map(c => ({ cardUniqueID: c.cardUniqueId })),
        fromTransDate:       start.toISOString(),
        toTransDate:         new Date().toISOString(),
        fromTrnAmt:          0, toTrnAmt: 0,
        merchantHebCity:     '', merchantHebName: '',
        transCardPresentInd: 0, transactionsOrigin: 0, trnType: 0, walletTranInd: 0,
      }),
    },
    35000
  );

  const transArr = txnData?.result?.transArr || [];

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

  await Promise.allSettled(
    allCards.map(async card => {
      try {
        const pendingData = await calFetch(
          `${BASE_URL}/Transactions/api/approvals/getClearanceRequests`,
          {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({ cardUniqueIDArray: [card.cardUniqueId] }),
          }
        );
        const pendingTxns = parsePendingTransactions(pendingData);
        if (cardMap.has(card.cardUniqueId)) cardMap.get(card.cardUniqueId).txns.push(...pendingTxns);
      } catch { /* pending הוא בונוס, לא קריטי */ }
    })
  );

  return Array.from(cardMap.values());
}

// ── helpers (זהים לשרת) ────────────────────────────────────────────────────

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
  const seen = new Set();
  const cards = [];
  for (const key of Object.keys(result)) {
    if (!Array.isArray(result[key])) continue;
    for (const item of result[key]) {
      const uid = item?.cardUniqueId || item?.cardUniqueID || item?.cardId;
      const l4  = item?.last4Digits  || item?.last4;
      if (uid && l4 && !seen.has(uid)) {
        seen.add(uid);
        cards.push({ cardUniqueId: uid, last4Digits: String(l4), cardType: item?.companyDescription || item?.cardBrandName || item?.cardType || 'כרטיס' });
      }
    }
  }
  return cards;
}

function extractLast4(uid, txn) {
  const match = String(uid).match(/\d{4}$/);
  if (match) return match[0];
  if (txn?.last4Digits) return String(txn.last4Digits);
  return uid.slice(-4);
}

const TRN_TYPE = { regular: '5', credit: '6', installments: '8', standingOrder: '9' };

function convertTransaction(t) {
  const rawAmt   = t.trnAmt ?? 0;
  const typeCode = String(t.trnTypeCode ?? t.transactionTypeCode ?? '');
  const charged  = (t.amtBeforeConvAndIndex ?? rawAmt) * -1;
  const originalAmount = rawAmt * (typeCode === TRN_TYPE.credit ? 1 : -1);
  const numOfPay = t.numOfPayments;
  const curPay   = t.curPaymentNum ?? 1;
  const installments = numOfPay ? { number: curPay, total: numOfPay } : undefined;

  let date = t.trnPurchaseDate || null;
  if (installments && date) {
    const d = new Date(date);
    d.setMonth(d.getMonth() + (curPay - 1));
    date = d.toISOString();
  }

  return {
    date,
    processedDate:    t.debCrdDate      || null,
    description:      t.merchantName   || '',
    memo:             String(t.transTypeCommentDetails ?? t.trnType ?? ''),
    originalAmount,
    originalCurrency: t.trnCurrencySymbol || 'ILS',
    chargedAmount:    charged,
    status:           'completed',
    type:             [TRN_TYPE.regular, TRN_TYPE.standingOrder].includes(typeCode) ? 'normal' : 'installments',
    installments,
    identifier:       t.trnIntId != null ? String(t.trnIntId) : undefined,
    category:         t.branchCodeDesc || undefined,
  };
}

function parsePendingTransactions(data) {
  if (!data?.result?.cardsList) return [];
  return data.result.cardsList.flatMap(c => c.authDetalisList || []).map(t => {
    const rawAmt     = t.trnAmt ?? 0;
    const numOfPay   = t.numberOfPayments;
    const typeCode   = String(t.trnTypeCode ?? t.transactionTypeCode ?? '');
    return {
      date:             t.trnPurchaseDate || null,
      processedDate:    t.trnPurchaseDate || null,
      description:      t.merchantName   || '',
      memo:             String(t.transTypeCommentDetails || ''),
      originalAmount:   rawAmt * (typeCode === TRN_TYPE.credit ? 1 : -1),
      originalCurrency: t.trnCurrencySymbol || 'ILS',
      chargedAmount:    rawAmt * -1,
      status:           'pending',
      type:             'normal',
      installments:     numOfPay ? { number: 1, total: numOfPay } : undefined,
      identifier:       undefined,
    };
  });
}
