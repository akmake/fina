import AppError from '../utils/AppError.js';
import { parseTransactions } from '../utils/excelParser.js';
import {
  requestCalOtp, verifyCalOtp, fetchCalAccounts, calAccountsToRows, CAL_OTP_TTL_MS,
} from '../services/calService.js';

/**
 * calController — the interactive one-time CAL import (OTP typed by the user).
 * The CAL API client itself lives in services/calService.js, shared with the
 * unattended daily sync.
 */

// ── CAL session uuid kept between step 1 and step 2 ────────────────────────
const otpSessions = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [key, val] of otpSessions)
    if (now - val.ts > CAL_OTP_TTL_MS) otpSessions.delete(key);
}, 60_000).unref?.();

// Sessions are keyed per Fina user too, so one user can't consume another's step 1.
const sessionKey = (req, id, last4) => `${req.user._id}_${id}_${last4}`;

// ── Step 1: request OTP ────────────────────────────────────────────────────
export const requestOtp = async (req, res, next) => {
  const { id, last4 } = req.body;
  if (!id || !last4) return next(new AppError('חסרים פרטי זיהוי', 400));

  try {
    const { uuid, maskedPhone } = await requestCalOtp({ id, last4 });
    otpSessions.set(sessionKey(req, id, last4), { uuid, ts: Date.now() });
    res.json({ maskedPhone });
  } catch (err) {
    return next(err);
  }
};

// Shared step 2: verify the code, then load CAL accounts.
const verifyAndLoad = async (req) => {
  const { id, last4, otp, startDate } = req.body;
  if (!id || !last4 || !otp) throw new AppError('חסרים פרטים', 400);

  const key = sessionKey(req, id, last4);
  const session = otpSessions.get(key);
  if (!session?.uuid) throw new AppError('פג תוקף — בקש קוד חדש', 400);

  const authToken = await verifyCalOtp({ id, otp, uuid: session.uuid });
  otpSessions.delete(key);
  return fetchCalAccounts(authToken, startDate);
};

// ── Step 2: verify OTP + return raw accounts ───────────────────────────────
export const verifyOtpAndFetch = async (req, res, next) => {
  try {
    const accounts = await verifyAndLoad(req);
    if (accounts.length === 0) return next(new AppError('לא נמצאו כרטיסים בחשבון', 404));
    res.json({ accounts });
  } catch (err) {
    return next(err instanceof AppError ? err : new AppError(err.message || 'שגיאה בכניסה לכאל', 502));
  }
};

// ── endpoint: raw accounts from the client → parsed import rows ────────────
export const processRawAccounts = async (req, res, next) => {
  const { accounts } = req.body;
  if (!Array.isArray(accounts)) return next(new AppError('נתונים שגויים', 400));

  const cleanedData = calAccountsToRows(accounts);
  if (cleanedData.length === 0) return res.json({ transactions: [], unseenMerchants: [] });

  try {
    const { transactions, unseenMerchants } = await parseTransactions(cleanedData, 'cal', req.user._id);
    res.json({ transactions, unseenMerchants });
  } catch (err) {
    return next(new AppError(err.message || 'שגיאה בעיבוד עסקאות', 500));
  }
};

// ── Step 2 (import): verify OTP + fetch + convert to import format ─────────
export const verifyOtpAndImport = async (req, res, next) => {
  try {
    const accounts = await verifyAndLoad(req);
    const cleanedData = calAccountsToRows(accounts);
    if (cleanedData.length === 0) return res.json({ transactions: [], unseenMerchants: [] });

    const { transactions, unseenMerchants } = await parseTransactions(cleanedData, 'cal', req.user._id);
    res.json({ transactions, unseenMerchants });
  } catch (err) {
    return next(err instanceof AppError ? err : new AppError(err.message || 'שגיאה בכניסה לכאל', 502));
  }
};
