import BankConnection from '../models/BankConnection.js';
import ImportJob from '../models/ImportJob.js';
import User from '../models/User.js';
import { enqueueImportJob, expireStaleOtpJobs, expireStuckJobs, nextDailySlot } from './importRunner.js';
import { isEncryptionConfigured } from '../utils/crypto.js';
import { nextIsraelHour } from '../utils/israelTime.js';
import logger from '../utils/logger.js';

/**
 * importScheduler — drives unattended daily bank sync.
 *
 * A lightweight in-process timer wakes periodically, finds connections whose
 * next sync is due, and enqueues a background ImportJob for each. `nextSyncAt`
 * is pushed forward *before* enqueuing so overlapping ticks never double-run a
 * connection. Each connection syncs daily at its Israel-local `syncHour`;
 * failed runs reschedule themselves (backoff) inside importRunner. No external
 * cron/queue dependency required.
 */

const CHECK_INTERVAL_MS = Number(process.env.IMPORT_SCHEDULER_INTERVAL_MS) || 5 * 60 * 1000; // 5 min
const BOOT_DELAY_MS = 15 * 1000;

let timer = null;
let ticking = false; // guard against overlapping ticks

/** Next daily sync instant at an Israel-local hour (default 06:00). */
export const computeNextSyncAt = (from = new Date(), hour = 6) => nextIsraelHour(from, hour);

/**
 * One scheduler pass: expire device-OTP jobs whose code never came, then enqueue
 * every connection that is active, auto-syncing, due, and owned by an active
 * (approved, not deleted) user. Returns the number enqueued.
 */
export const tick = async () => {
  if (ticking) return 0;
  ticking = true;
  try {
    const now = new Date();
    await expireStaleOtpJobs(now);
    await expireStuckJobs(now);

    const due = await BankConnection.find({
      autoSync: true,
      status: 'active',
      $or: [{ nextSyncAt: { $lte: now } }, { nextSyncAt: null }],
    });
    if (due.length === 0) return 0;

    // Never sync for blocked / pending / deleted accounts.
    const ownerIds = [...new Set(due.map((c) => String(c.user)))];
    const activeOwners = new Set((await User.find({
      _id: { $in: ownerIds },
      deletedAt: null,
      approvalStatus: { $nin: ['pending', 'rejected'] },
    }).select('_id').lean()).map((u) => String(u._id)));

    // A manual sync may already be running / waiting for its SMS code.
    const busy = new Set((await ImportJob.find({
      connection: { $in: due.map((c) => c._id) },
      status: { $in: ['queued', 'running', 'awaiting_otp'] },
    }).select('connection').lean()).map((j) => String(j.connection)));

    let enqueued = 0;
    for (const conn of due) {
      // Reserve the next slot atomically BEFORE enqueuing, so an overlapping tick
      // (or a second server instance) can't run the same connection twice.
      const reserved = await BankConnection.findOneAndUpdate(
        { _id: conn._id, nextSyncAt: conn.nextSyncAt ?? null },
        { $set: { nextSyncAt: nextDailySlot(conn, now) } },
        { new: true },
      );
      if (!reserved) continue;
      if (!activeOwners.has(String(conn.user)) || busy.has(String(conn._id))) continue;
      conn.nextSyncAt = reserved.nextSyncAt;
      await enqueueImportJob(conn, { trigger: 'scheduled' });
      enqueued += 1;
    }

    if (enqueued > 0) logger.info(`[scheduler] enqueued ${enqueued} scheduled sync(s)`);
    return enqueued;
  } catch (err) {
    logger.error(`[scheduler] tick failed: ${err.message}`);
    return 0;
  } finally {
    ticking = false;
  }
};

/** Start the periodic scheduler. No-op (with a warning) if encryption is unset. */
export const startImportScheduler = () => {
  if (!isEncryptionConfigured()) {
    logger.warn('[scheduler] FINA_ENCRYPTION_KEY not configured — automatic bank sync disabled');
    return;
  }
  if (timer) return;

  timer = setInterval(() => { tick(); }, CHECK_INTERVAL_MS);
  timer.unref?.(); // don't keep the process alive for the timer alone

  // First pass shortly after boot so a restart resumes overdue syncs.
  setTimeout(() => { tick(); }, BOOT_DELAY_MS).unref?.();

  logger.info(`[scheduler] automatic bank sync active (checking every ${Math.round(CHECK_INTERVAL_MS / 60000)}m)`);
};

export const stopImportScheduler = () => {
  if (timer) clearInterval(timer);
  timer = null;
};
