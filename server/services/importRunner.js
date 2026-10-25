import BankConnection from '../models/BankConnection.js';
import ImportJob from '../models/ImportJob.js';
import { decrypt, decryptJSON, encrypt } from '../utils/crypto.js';
import { runScrape, scrapeOneZeroWithToken, getCompanyConfig } from './scrapeService.js';
import { requestCalOtp, verifyCalOtp, fetchCalAccounts, calAccountsToRows, CAL_OTP_TTL_MS } from './calService.js';
import { parseTransactions } from '../utils/excelParser.js';
import { persistTransactions } from './transactionPersistence.js';
import { notify } from './notificationService.js';
import { nextIsraelHour } from '../utils/israelTime.js';
import AppError from '../utils/AppError.js';
import logger from '../utils/logger.js';

/**
 * importRunner — executes a single ImportJob end to end:
 *   load connection → decrypt credentials → scrape → persist → update status.
 *
 * Used by both the manual "sync now" endpoint and the daily scheduler, so an
 * unattended sync produces the exact same result as a user-triggered one.
 *
 * Device-OTP providers (CAL, `deviceOtp` in COMPANY_CONFIG) run in two phases:
 *   1. runImportJob asks the provider to SMS a code → job `awaiting_otp`;
 *   2. submitJobOtp (code relayed by the paired phone, or typed on the web)
 *      finishes the login, fetches and persists. Unanswered jobs expire.
 */

// ── Concurrency limiter ─────────────────────────────────────────────────────
// Each scrape launches a headless Chrome — memory-heavy. Cap how many run at
// once (across manual + scheduled) so a burst can't exhaust the host.
const MAX_CONCURRENT = Number(process.env.IMPORT_MAX_CONCURRENCY) || 2;
let active = 0;
const waiters = [];

const acquireSlot = () => new Promise((resolve) => {
  if (active < MAX_CONCURRENT) { active += 1; resolve(); }
  else waiters.push(resolve);
});

const releaseSlot = () => {
  active -= 1;
  const next = waiters.shift();
  if (next) { active += 1; next(); }
};

// ── Retry policy ────────────────────────────────────────────────────────────
// Transient failures (site down, timeout) retry soon; after MAX_QUICK_RETRIES
// the connection falls back to its normal daily slot and the user is told.
const RETRY_BACKOFF_MS = [30 * 60 * 1000, 2 * 60 * 60 * 1000, 6 * 60 * 60 * 1000];
const MAX_QUICK_RETRIES = RETRY_BACKOFF_MS.length;
const BACKFILL_OVERLAP_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_BACKFILL_MS = 365 * 24 * 60 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 3;
// A job still queued/running after this long died with its process (restart/crash).
const STUCK_JOB_MS = 45 * 60 * 1000;

/** Next daily slot for a connection (Israel-local syncHour). */
export const nextDailySlot = (conn, from = new Date()) => nextIsraelHour(from, conn.syncHour ?? 6);

/**
 * Scrape window: from a week before the last success (covers gaps after
 * failures/downtime and late-posting charges), else the provider default.
 */
export const syncStartDate = (conn, now = new Date()) => {
  if (!conn.lastSuccessAt) return undefined;
  const from = new Date(conn.lastSuccessAt).getTime() - BACKFILL_OVERLAP_MS;
  return new Date(Math.max(from, now.getTime() - MAX_BACKFILL_MS));
};

/**
 * Credential problems can't fix themselves — they need the user. Everything
 * else (timeouts, 5xx, a phone that didn't answer) is worth retrying.
 */
const isCredentialError = (err) => err?.statusCode === 400 || err?.statusCode === 401;

/** Scrape one (non device-OTP) connection → parsed payload. */
const scrapeConnection = async (conn) => {
  const credentials = decryptJSON(conn.credentials);
  const userId = conn.user;
  const incomesOnly = conn.incomesOnly;
  const startDate = syncStartDate(conn);

  if (conn.company === 'oneZero') {
    if (!conn.otpLongTermToken) {
      throw new AppError('נדרש אימות מחדש ל-One Zero (קוד חד-פעמי)', 401);
    }
    const otpLongTermToken = decrypt(conn.otpLongTermToken);
    return scrapeOneZeroWithToken({
      email: credentials.email,
      password: credentials.password,
      otpLongTermToken,
      startDate,
      incomesOnly,
      userId,
    });
  }

  return runScrape({ company: conn.company, credentials, startDate, incomesOnly, userId });
};

// ── Outcome bookkeeping (shared by both phases) ─────────────────────────────

const markSuccess = async (job, conn, { inserted, skipped, received, accounts, balances }) => {
  const finishedAt = new Date();
  job.status = 'success';
  job.finishedAt = finishedAt;
  job.durationMs = finishedAt - (job.startedAt || finishedAt);
  job.stats = { received, inserted, skipped, accounts };
  job.balances = balances || [];
  job.otpSession = undefined;
  await job.save();

  conn.status = 'active';
  conn.lastSyncAt = finishedAt;
  conn.lastSuccessAt = finishedAt;
  conn.lastSyncStatus = 'success';
  conn.lastError = undefined;
  conn.lastInserted = inserted;
  conn.lastSkipped = skipped;
  conn.consecutiveFailures = 0;
  // A quick retry that succeeded goes back to the regular daily slot.
  if (job.trigger === 'scheduled') conn.nextSyncAt = nextDailySlot(conn, finishedAt);
  await conn.save();

  logger.info(`[importRunner] job ${job._id} (${conn.company}) success: +${inserted} / skip ${skipped}`);
};

const markFailure = async (job, err) => {
  const finishedAt = new Date();
  job.status = 'error';
  job.finishedAt = finishedAt;
  job.durationMs = finishedAt - (job.startedAt || finishedAt);
  job.error = err.message;
  job.otpSession = undefined;
  await job.save().catch((e) => logger.error(`[importRunner] failed to save job error: ${e.message}`));

  const conn = await BankConnection.findById(job.connection);
  if (!conn) return;

  const needsOtp = job.company === 'oneZero' && err.statusCode === 401;
  const credential = isCredentialError(err) && !err.transient;
  const failures = (conn.consecutiveFailures || 0) + 1;

  conn.lastSyncAt = finishedAt;
  conn.lastSyncStatus = 'error';
  conn.lastError = err.message;
  conn.consecutiveFailures = failures;

  if (needsOtp) {
    conn.status = 'needs_otp';
  } else if (credential) {
    conn.status = 'error'; // wrong/changed credentials — stop until the user fixes them
  } else if (job.trigger === 'scheduled') {
    // Transient: stay active and retry. Device-OTP providers send an SMS per
    // attempt, so they wait for the next daily slot instead of quick retries.
    conn.status = 'active';
    const quick = !getCompanyConfig(conn.company).deviceOtp && failures <= MAX_QUICK_RETRIES;
    conn.nextSyncAt = quick
      ? new Date(finishedAt.getTime() + RETRY_BACKOFF_MS[failures - 1])
      : nextDailySlot(conn, finishedAt);
  }
  await conn.save().catch((e) => logger.error(`[importRunner] failed to update connection: ${e.message}`));

  // Tell the owner when it needs them: credentials, or a transient problem that
  // outlasted the quick retries (or a device-OTP sync whose code never arrived).
  const deviceOtp = getCompanyConfig(conn.company).deviceOtp;
  const shouldNotify = needsOtp || credential || deviceOtp || failures >= MAX_QUICK_RETRIES;
  if (job.trigger === 'scheduled' && shouldNotify) {
    const name = conn.displayName || conn.company;
    await notify({
      user: job.user,
      type: 'bank_sync_failed',
      title: needsOtp ? 'נדרש אימות מחדש לחיבור הבנק' : credential ? 'פרטי ההתחברות לבנק לא תקינים' : 'הסנכרון האוטומטי לא הצליח',
      message: needsOtp
        ? `החיבור ל-${name} דורש קוד חד-פעמי מחדש. יש להתחבר שוב מעמוד החיבורים.`
        : credential
          ? `לא הצלחנו להתחבר ל-${name}: ${err.message}. עדכן את הפרטים בעמוד החיבורים.`
          : `הסנכרון של ${name} נכשל: ${err.message}. ננסה שוב אוטומטית.`,
      icon: needsOtp ? '🔐' : '⚠️',
      severity: credential || needsOtp ? 'danger' : 'warning',
      actionUrl: '/connections',
      actionLabel: 'לחיבורים',
      relatedModel: 'BankConnection',
      relatedId: job.connection,
      channels: ['inapp', 'email'],
      dedupeKey: `bank_sync_failed:${needsOtp ? 'otp' : credential ? 'credential' : 'transient'}:${job.connection}`,
    }).catch((e) => logger.error(`[importRunner] failed to notify sync failure: ${e.message}`));
  }

  logger.error(`[importRunner] job ${job._id} (${job.company}) failed: ${err.message}`);
};

// ── Phase 1 / single-phase run ──────────────────────────────────────────────

/**
 * Run the job identified by jobId. Never throws — every outcome is recorded on
 * the ImportJob and mirrored onto its BankConnection.
 * @returns {Promise<import('mongoose').Document|null>} the finished job doc
 */
export const runImportJob = async (jobId) => {
  const job = await ImportJob.findById(jobId);
  if (!job) {
    logger.warn(`[importRunner] job ${jobId} not found`);
    return null;
  }

  job.status = 'running';
  job.startedAt = new Date();
  await job.save();

  // Load the connection WITH its (select:false) secrets.
  const conn = await BankConnection.findOne({ _id: job.connection })
    .select('+credentials +otpLongTermToken');
  if (!conn) {
    await markFailure(job, new AppError('החיבור לא נמצא או נמחק', 404));
    return job;
  }

  // Device-OTP: ask the provider to send the SMS and park the job. No Chrome is
  // involved, so no concurrency slot is held while waiting for the phone.
  if (getCompanyConfig(conn.company).deviceOtp) {
    try {
      const { id, last4 } = decryptJSON(conn.credentials);
      const { uuid, maskedPhone } = await requestCalOtp({ id, last4 });
      const now = new Date();
      job.status = 'awaiting_otp';
      job.otpRequestedAt = now;
      job.otpExpiresAt = new Date(now.getTime() + CAL_OTP_TTL_MS);
      job.maskedPhone = maskedPhone;
      job.otpSession = encrypt(uuid);
      await job.save();
      logger.info(`[importRunner] job ${job._id} (${conn.company}) awaiting SMS code`);
    } catch (err) {
      await markFailure(job, err);
    }
    return job;
  }

  await acquireSlot();
  try {
    const payload = await scrapeConnection(conn);
    const { inserted, skipped, received } = await persistTransactions({
      userId: conn.user,
      transactions: payload.transactions,
      includeDeleted: true,
    });
    await markSuccess(job, conn, {
      inserted, skipped, received,
      accounts: payload.rawAccounts?.length || 0,
      balances: payload.balances,
    });
  } catch (err) {
    await markFailure(job, err);
  } finally {
    releaseSlot();
  }
  return job;
};

// ── Phase 2: an SMS code arrived ────────────────────────────────────────────

/** Extract a numeric one-time code from a code or a full SMS text. */
export const extractOtp = (input) => {
  const text = String(input ?? '').trim();
  if (/^\d{4,8}$/.test(text)) return text;
  const match = text.match(/(?<!\d)(\d{4,8})(?!\d)/);
  return match ? match[1] : null;
};

/**
 * Finish an awaiting_otp job with the SMS code. Throws AppError for the caller
 * (wrong/expired code, nothing waiting); success/failure is also recorded on the
 * job + connection exactly like a single-phase run.
 * @returns {Promise<import('mongoose').Document>} the finished job
 */
export const submitJobOtp = async (jobId, rawCode) => {
  const code = extractOtp(rawCode);
  if (!code) throw new AppError('לא נמצא קוד בהודעה', 400);

  // Atomically claim the job so the phone and the web can't both use one code.
  const job = await ImportJob.findOneAndUpdate(
    { _id: jobId, status: 'awaiting_otp' },
    { $set: { status: 'running' }, $inc: { otpAttempts: 1 } },
    { new: true },
  ).select('+otpSession');
  if (!job) throw new AppError('אין סנכרון שממתין לקוד', 404);

  if (!job.otpExpiresAt || job.otpExpiresAt < new Date()) {
    await markFailure(job, Object.assign(new AppError('פג תוקף הקוד — הסנכרון ינסה שוב במועד הבא', 408), { transient: true }));
    throw new AppError('פג תוקף הקוד', 410);
  }

  const conn = await BankConnection.findOne({ _id: job.connection }).select('+credentials');
  if (!conn) {
    await markFailure(job, new AppError('החיבור לא נמצא או נמחק', 404));
    throw new AppError('החיבור לא נמצא', 404);
  }

  let authToken;
  try {
    const { id } = decryptJSON(conn.credentials);
    authToken = await verifyCalOtp({ id, otp: code, uuid: decrypt(job.otpSession) });
  } catch (err) {
    if (err.code === 'OTP_INVALID') {
      if (job.otpAttempts >= MAX_OTP_ATTEMPTS) {
        // Stop before CAL locks the customer's account; retry at the next daily slot.
        await markFailure(job, Object.assign(new AppError('התקבלו כמה קודים שגויים — הסנכרון יידחה למועד הבא', 429), { transient: true }));
        throw new AppError('יותר מדי קודים שגויים — הסנכרון בוטל', 429);
      }
      // Wrong code (e.g. a different SMS was relayed) — keep waiting until expiry.
      await ImportJob.updateOne({ _id: job._id }, { $set: { status: 'awaiting_otp' } });
      throw err;
    }
    await markFailure(job, err);
    throw err;
  }

  try {
    const accounts = await fetchCalAccounts(authToken, syncStartDate(conn));
    let rows = calAccountsToRows(accounts);
    if (conn.incomesOnly) rows = rows.filter((r) => r._transactionType === 'הכנסה');
    const { transactions } = rows.length
      ? await parseTransactions(rows, 'cal', conn.user)
      : { transactions: [] };
    const { inserted, skipped, received } = await persistTransactions({ userId: conn.user, transactions, includeDeleted: true });
    await markSuccess(job, conn, { inserted, skipped, received, accounts: accounts.length, balances: [] });
    return job;
  } catch (err) {
    const wrapped = err instanceof AppError ? err : new AppError(err.message || 'שגיאה במשיכת עסקאות מכאל', 502);
    await markFailure(job, wrapped);
    throw wrapped;
  }
};

/** Expire device-OTP jobs whose code never arrived. Returns how many expired. */
export const expireStaleOtpJobs = async (now = new Date()) => {
  const stale = await ImportJob.find({ status: 'awaiting_otp', otpExpiresAt: { $lt: now } });
  for (const job of stale) {
    const claimed = await ImportJob.findOneAndUpdate(
      { _id: job._id, status: 'awaiting_otp' },
      { $set: { status: 'running' } },
      { new: true },
    );
    if (!claimed) continue;
    await markFailure(claimed, Object.assign(
      new AppError('לא התקבל קוד SMS מהטלפון בזמן — ננסה שוב במועד הבא', 408),
      { transient: true },
    ));
  }
  return stale.length;
};

/**
 * Close jobs left `queued`/`running` by a crashed or restarted process, so they
 * stop blocking single-flight and the history shows what happened.
 */
export const expireStuckJobs = async (now = new Date()) => {
  const cutoff = new Date(now.getTime() - STUCK_JOB_MS);
  const stuck = await ImportJob.find({
    status: { $in: ['queued', 'running'] },
    $or: [{ startedAt: { $lt: cutoff } }, { startedAt: null, createdAt: { $lt: cutoff } }],
  });
  for (const job of stuck) {
    await markFailure(job, Object.assign(new AppError('הסנכרון נקטע (השרת הופעל מחדש) — ננסה שוב', 503), { transient: true }));
  }
  return stuck.length;
};

/**
 * Create a queued ImportJob for a connection and start running it in the
 * background (fire-and-forget). Returns the created job document immediately so
 * the caller can hand a job id back to the client to poll.
 */
export const enqueueImportJob = async (conn, { trigger = 'manual' } = {}) => {
  const job = await ImportJob.create({
    user: conn.user,
    household: conn.household,
    connection: conn._id,
    company: conn.company,
    trigger,
    status: 'queued',
  });

  // Kick off async; runImportJob owns all error handling.
  runImportJob(job._id).catch((e) => logger.error(`[importRunner] unhandled job error: ${e.message}`));

  return job;
};
