import BankConnection from '../models/BankConnection.js';
import { enqueueImportJob } from './importRunner.js';
import { isEncryptionConfigured } from '../utils/crypto.js';
import logger from '../utils/logger.js';

/**
 * importScheduler — drives unattended daily bank sync (Phase 2 completion
 * criterion: "daily automatic sync works without user presence").
 *
 * A lightweight in-process timer wakes periodically, finds connections whose
 * next sync is due, and enqueues a background ImportJob for each. `nextSyncAt`
 * is pushed forward *before* enqueuing so overlapping ticks never double-run a
 * connection. No external cron/queue dependency required.
 */

const CHECK_INTERVAL_MS = Number(process.env.IMPORT_SCHEDULER_INTERVAL_MS) || 30 * 60 * 1000; // 30 min
const SYNC_INTERVAL_MS = Number(process.env.IMPORT_SYNC_INTERVAL_MS) || 24 * 60 * 60 * 1000;   // daily
const BOOT_DELAY_MS = 15 * 1000;

let timer = null;
let ticking = false; // guard against overlapping ticks

export const computeNextSyncAt = (from = new Date()) => new Date(from.getTime() + SYNC_INTERVAL_MS);

/**
 * One scheduler pass: enqueue every connection that is active, auto-syncing, and
 * due (nextSyncAt in the past or unset). Returns the number enqueued.
 */
export const tick = async () => {
  if (ticking) return 0;
  ticking = true;
  try {
    const now = new Date();
    const due = await BankConnection.find({
      autoSync: true,
      status: 'active',
      $or: [{ nextSyncAt: { $lte: now } }, { nextSyncAt: null }],
    });

    let enqueued = 0;
    for (const conn of due) {
      // Reserve the next slot BEFORE enqueuing so a slow job can't be picked up
      // again by the next tick.
      conn.nextSyncAt = computeNextSyncAt(now);
      await conn.save();
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
