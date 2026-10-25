import BankConnection from '../models/BankConnection.js';
import ImportJob from '../models/ImportJob.js';
import { encrypt, decryptJSON } from '../utils/crypto.js';
import {
  calRequests, calCardIds, buildCalAccounts, calAccountsToRows, calOtpRequestError, CAL_OTP_TTL_MS,
} from './calService.js';
import { markSuccess, markFailure, syncStartDate, extractOtp } from './importRunner.js';
import { parseTransactions } from '../utils/excelParser.js';
import { persistTransactions } from './transactionPersistence.js';
import AppError from '../utils/AppError.js';
import logger from '../utils/logger.js';

/**
 * calDeviceSync — CAL auto-sync (`calAuto`) run THROUGH the paired phone.
 *
 * CAL rejects requests from the server's IP (the one-time import runs in the browser
 * for the same reason), so the server never calls CAL here. It drives the phone step
 * by step instead: each answer to POST /api/devices/cal/step is the next action —
 *   { action:'http', request }  → the phone executes this exact CAL request and posts
 *                                 back { status, body } (hosts: *.cal-online.co.il only)
 *   { action:'wait_sms' }       → CAL sent the code to this phone; post { code } when it lands
 *   { action:'done', ok }       → finished (result is on the job / connection)
 *   { action:'none' }           → nothing to do
 * All CAL logic, parsing and state stay on the server (state is encrypted on the job),
 * so a CAL change is fixed here without an app update. The phone learns there is work
 * from the heartbeat (`calTask: true`). Contract: docs/modules/import.md § Phone-run CAL sync.
 */

const CLAIM_TTL_MS = 5 * 60 * 1000;   // after pickup, the OTP request must come back soon
const STEP_TTL_MS = 5 * 60 * 1000;    // each later step extends the deadline
const MAX_OTP_ATTEMPTS = 3;
const DEFAULT_HISTORY_MONTHS = 2;

const transient = (message, status = 502) => Object.assign(new AppError(message, status), { transient: true });
const later = (ms) => new Date(Date.now() + ms);
const parse = (text) => { try { return JSON.parse(text ?? ''); } catch { return null; } };

const action = (job, type, extra = {}) => ({ action: type, jobId: job._id, seq: job.deviceSeq, ...extra });
const done = (job, ok, message) => ({ action: 'done', jobId: job._id, ok, message });

const save = async (job, state, fields = {}) => {
  Object.assign(job, fields);
  job.deviceState = encrypt(JSON.stringify(state));
  await job.save();
};

const credentialsOf = async (job) => {
  const conn = await BankConnection.findById(job.connection).select('+credentials');
  if (!conn) throw new AppError('החיבור לא נמצא או נמחק', 404);
  return { conn, ...decryptJSON(conn.credentials) };
};

/** Is a phone-run sync waiting for this user's phone to pick it up? (heartbeat flag) */
export const deviceTaskPending = async (userId) => !!(await ImportJob.exists({
  user: userId, runsOn: 'device', status: 'awaiting_otp', deviceStage: 'waiting_phone', otpExpiresAt: { $gt: new Date() },
}));

/** Pick up the newest waiting sync for the phone's owner → the CAL "send me a code" request. */
const claim = async (device) => {
  const job = await ImportJob.findOneAndUpdate(
    { user: device.user, runsOn: 'device', status: 'awaiting_otp', deviceStage: 'waiting_phone', otpExpiresAt: { $gt: new Date() } },
    { $set: { device: device._id, deviceStage: 'requesting', otpExpiresAt: later(CLAIM_TTL_MS) }, $inc: { deviceSeq: 1 } },
    { new: true, sort: { createdAt: -1 } },
  ).select('+deviceState');
  if (!job) return { action: 'none' };

  try {
    const { conn, id, last4 } = await credentialsOf(job);
    const start = syncStartDate(conn) || (() => { const d = new Date(); d.setMonth(d.getMonth() - DEFAULT_HISTORY_MONTHS); return d; })();
    await save(job, { step: 'otp', start: start.toISOString() });
    logger.info(`[calDevice] job ${job._id} picked up by device ${device._id}`);
    return action(job, 'http', { request: calRequests.otp({ id, last4 }) });
  } catch (err) {
    job.deviceState = undefined;
    await markFailure(job, err);
    return done(job, false, err.message);
  }
};

const nextPending = async (job, state) => {
  if (state.cardIndex < state.cards.length) {
    await save(job, { ...state, step: 'pending' }, { otpExpiresAt: later(STEP_TTL_MS) });
    return action(job, 'http', { request: calRequests.pending(state.authToken, state.cards[state.cardIndex]) });
  }
  // Everything fetched → parse + persist exactly like the server-run path.
  const conn = await BankConnection.findById(job.connection);
  if (!conn) throw new AppError('החיבור לא נמצא או נמחק', 404);
  const accounts = buildCalAccounts(state);
  let rows = calAccountsToRows(accounts);
  if (conn.incomesOnly) rows = rows.filter((r) => r._transactionType === 'הכנסה');
  const { transactions } = rows.length ? await parseTransactions(rows, 'cal', conn.user) : { transactions: [] };
  const { inserted, skipped, received } = await persistTransactions({ userId: conn.user, transactions, includeDeleted: true });
  job.deviceState = undefined;
  await markSuccess(job, conn, { inserted, skipped, received, accounts: accounts.length, balances: [] });
  return done(job, true, inserted ? `נוספו ${inserted} עסקאות חדשות` : 'אין עסקאות חדשות');
};

/** Apply the phone's answer to the current step and return the next action. */
const advance = async (job, state, body) => {
  if (state.step === 'sms') {
    const code = extractOtp(body.code);
    if (!code) return action(job, 'wait_sms', { expiresAt: job.otpExpiresAt });
    const { id } = await credentialsOf(job);
    await save(job, { ...state, step: 'verify' }, { otpAttempts: (job.otpAttempts || 0) + 1, otpExpiresAt: later(STEP_TTL_MS) });
    return action(job, 'http', { request: calRequests.verify({ id, otp: code, uuid: state.uuid }) });
  }

  const res = body.response;
  if (!res) throw transient('תשובה חסרה מהטלפון', 400);
  if (res.error) throw transient(`הטלפון לא הצליח להגיע לכאל: ${String(res.error).slice(0, 120)}`);
  const data = parse(res.body);
  const ok = res.status >= 200 && res.status < 300 && data && typeof data === 'object';

  switch (state.step) {
    case 'otp': {
      if (!ok) throw calOtpRequestError({ response: { status: res.status, data: data ?? String(res.body ?? '') } });
      if (!data.token) throw transient('כאל לא החזירה מזהה כניסה — ננסה שוב');
      const now = new Date();
      await save(job, { ...state, step: 'sms', uuid: data.token }, {
        deviceStage: 'waiting_sms', otpRequestedAt: now, otpExpiresAt: later(CAL_OTP_TTL_MS), maskedPhone: data.phoneNumber || '',
      });
      return action(job, 'wait_sms', { expiresAt: job.otpExpiresAt });
    }
    case 'verify': {
      if (ok && data.token) {
        await save(job, { ...state, step: 'init', authToken: data.token }, { deviceStage: 'fetching', otpExpiresAt: later(STEP_TTL_MS) });
        return action(job, 'http', { request: calRequests.init(data.token) });
      }
      if (res.status === 401 || res.status === 400 || ok) {
        // Wrong/expired code (e.g. another CAL SMS) — wait for the next one, but stop
        // before CAL locks the customer's account.
        if (job.otpAttempts >= MAX_OTP_ATTEMPTS) throw transient('התקבלו כמה קודים שגויים — הסנכרון יידחה למועד הבא', 429);
        await save(job, { ...state, step: 'sms' }, { otpExpiresAt: later(CAL_OTP_TTL_MS) });
        return action(job, 'wait_sms', { expiresAt: job.otpExpiresAt });
      }
      throw transient(`שגיאה בכניסה לכאל (HTTP ${res.status})`);
    }
    case 'init': {
      if (!ok) throw transient(`כאל לא החזירה את פרטי הכרטיסים (HTTP ${res.status})`);
      await save(job, { ...state, step: 'transactions', init: data }, { otpExpiresAt: later(STEP_TTL_MS) });
      return action(job, 'http', { request: calRequests.transactions(state.authToken, data, state.start) });
    }
    case 'transactions': {
      if (!ok) throw transient(`כאל לא החזירה את העסקאות (HTTP ${res.status})`);
      return nextPending(job, { ...state, transactions: data, cards: calCardIds(state.init), cardIndex: 0, pending: [] });
    }
    case 'pending': {
      // A failed pending-charges call is not fatal (same as the server path).
      const pending = ok ? [...state.pending, { cardUniqueId: state.cards[state.cardIndex], response: data }] : state.pending;
      return nextPending(job, { ...state, pending, cardIndex: state.cardIndex + 1 });
    }
    default:
      throw transient('מצב סנכרון לא מוכר');
  }
};

/**
 * One step of a phone-run CAL sync (POST /api/devices/cal/step).
 * @param {import('mongoose').Document} device  the authenticated phone
 * @param {{jobId?:string, seq?:number, response?:{status:number, body:string}|{error:string}, code?:string}} body
 *   `{}` asks for work; otherwise the answer to the action that carried this jobId + seq.
 */
export const deviceCalStep = async (device, body = {}) => {
  if (!body.jobId) return claim(device);

  // Claim this step atomically: a duplicate or stale answer (e.g. a worker retry) is refused.
  const job = await ImportJob.findOneAndUpdate(
    { _id: body.jobId, device: device._id, runsOn: 'device', status: 'awaiting_otp', deviceSeq: Number(body.seq) },
    { $inc: { deviceSeq: 1 } },
    { new: true },
  ).select('+deviceState');
  if (!job) throw new AppError('השלב הזה כבר טופל או שהסנכרון הסתיים', 409);

  try {
    return await advance(job, job.deviceState ? decryptJSON(job.deviceState) : {}, body);
  } catch (err) {
    job.deviceState = undefined;
    const failure = err instanceof AppError ? err : transient(err.message || 'שגיאה בסנכרון כאל');
    await markFailure(job, failure);
    return done(job, false, failure.message);
  }
};
