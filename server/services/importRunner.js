import BankConnection from '../models/BankConnection.js';
import ImportJob from '../models/ImportJob.js';
import { decrypt, decryptJSON } from '../utils/crypto.js';
import { runScrape, scrapeOneZeroWithToken } from './scrapeService.js';
import { persistTransactions } from './transactionPersistence.js';
import AppError from '../utils/AppError.js';
import logger from '../utils/logger.js';

/**
 * importRunner — executes a single ImportJob end to end:
 *   load connection → decrypt credentials → scrape → persist → update status.
 *
 * Used by both the manual "sync now" endpoint and the daily scheduler, so an
 * unattended sync produces the exact same result as a user-triggered one.
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

/** Scrape one connection (respecting its company's flow) → client payload. */
const scrapeConnection = async (conn) => {
  const credentials = decryptJSON(conn.credentials);
  const userId = conn.user;
  const incomesOnly = conn.incomesOnly;

  if (conn.company === 'oneZero') {
    if (!conn.otpLongTermToken) {
      throw new AppError('נדרש אימות מחדש ל-One Zero (קוד חד-פעמי)', 401);
    }
    const otpLongTermToken = decrypt(conn.otpLongTermToken);
    return scrapeOneZeroWithToken({
      email: credentials.email,
      password: credentials.password,
      otpLongTermToken,
      incomesOnly,
      userId,
    });
  }

  return runScrape({ company: conn.company, credentials, incomesOnly, userId });
};

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

  const startedAt = new Date();
  job.status = 'running';
  job.startedAt = startedAt;
  await job.save();

  await acquireSlot();
  try {
    // Load the connection WITH its (select:false) secrets.
    const conn = await BankConnection.findOne({ _id: job.connection })
      .select('+credentials +otpLongTermToken');
    if (!conn) throw new AppError('החיבור לא נמצא או נמחק', 404);

    const payload = await scrapeConnection(conn);
    const { inserted, skipped, received } = await persistTransactions({
      userId: conn.user,
      transactions: payload.transactions,
    });

    const finishedAt = new Date();
    job.status = 'success';
    job.finishedAt = finishedAt;
    job.durationMs = finishedAt - startedAt;
    job.stats = { received, inserted, skipped, accounts: payload.rawAccounts?.length || 0 };
    job.balances = payload.balances || [];
    await job.save();

    conn.status = 'active';
    conn.lastSyncAt = finishedAt;
    conn.lastSyncStatus = 'success';
    conn.lastError = undefined;
    conn.lastInserted = inserted;
    conn.lastSkipped = skipped;
    await conn.save();

    logger.info(`[importRunner] job ${jobId} (${conn.company}) success: +${inserted} / skip ${skipped}`);
    return job;
  } catch (err) {
    const finishedAt = new Date();
    job.status = 'error';
    job.finishedAt = finishedAt;
    job.durationMs = finishedAt - startedAt;
    job.error = err.message;
    await job.save().catch((e) => logger.error(`[importRunner] failed to save job error: ${e.message}`));

    // Expired One Zero token → flag for re-auth; anything else → generic error.
    const connStatus = (job.company === 'oneZero' && err.statusCode === 401) ? 'needs_otp' : 'error';
    await BankConnection.updateOne(
      { _id: job.connection },
      { $set: { status: connStatus, lastSyncAt: finishedAt, lastSyncStatus: 'error', lastError: err.message } },
    ).catch((e) => logger.error(`[importRunner] failed to update connection status: ${e.message}`));

    logger.error(`[importRunner] job ${jobId} (${job.company}) failed: ${err.message}`);
    return job;
  } finally {
    releaseSlot();
  }
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
