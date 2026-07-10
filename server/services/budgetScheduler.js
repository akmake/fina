import Budget from '../models/Budget.js';
import { resolveActiveHousehold } from '../utils/ensureHousehold.js';
import { checkBudgetThresholds } from './budgetCycleService.js';
import logger from '../utils/logger.js';

/**
 * budgetScheduler — periodic budget-threshold checks (Phase 3, §5.4 completion
 * criterion: "תזמון תקופתי לבדיקות ספים"). Complements the request-time check
 * (`POST /api/budgets/check-thresholds`) so 75/90/100% alerts fire even when the
 * user hasn't opened the app — spending accumulates from unattended bank sync.
 *
 * A lightweight in-process timer wakes periodically, finds every household with a
 * budget for the current month, and runs `checkBudgetThresholds` once per
 * household. Notifications are de-duped in `notificationService` (once per
 * threshold per month), so repeated ticks never spam. No external cron/queue.
 */

const CHECK_INTERVAL_MS = Number(process.env.BUDGET_SCHEDULER_INTERVAL_MS) || 6 * 60 * 60 * 1000; // 6h
const BOOT_DELAY_MS = 20 * 1000;

let timer = null;
let ticking = false; // guard against overlapping ticks

/**
 * One scheduler pass: check every household's current-month budget against actual
 * spending and raise the highest newly-crossed threshold. Returns the number of
 * notifications raised.
 */
export const tick = async () => {
  if (ticking) return 0;
  ticking = true;
  try {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    // Distinct owners with a (non-deleted) budget this month. `distinct` is not
    // covered by the soft-delete query hook, so filter deletedAt explicitly.
    const owners = await Budget.distinct('user', { month, year, deletedAt: null });

    const seenHouseholds = new Set(); // one check per household even if two members have budgets
    let raised = 0;

    for (const ownerId of owners) {
      try {
        const { household, memberUserIds } = await resolveActiveHousehold(ownerId);
        const hid = String(household?._id || ownerId);
        if (seenHouseholds.has(hid)) continue;
        seenHouseholds.add(hid);

        const filter = memberUserIds.length > 1
          ? { user: { $in: memberUserIds } }
          : { user: ownerId };
        const res = await checkBudgetThresholds({ filter, ownerId, month, year });
        raised += res.raised || 0;
      } catch (err) {
        logger.error(`[budget-scheduler] owner ${ownerId} failed: ${err.message}`);
      }
    }

    if (raised > 0) logger.info(`[budget-scheduler] raised ${raised} threshold alert(s)`);
    return raised;
  } catch (err) {
    logger.error(`[budget-scheduler] tick failed: ${err.message}`);
    return 0;
  } finally {
    ticking = false;
  }
};

/** Start the periodic budget-threshold scheduler. */
export const startBudgetScheduler = () => {
  if (timer) return;

  timer = setInterval(() => { tick(); }, CHECK_INTERVAL_MS);
  timer.unref?.(); // don't keep the process alive for the timer alone

  // First pass shortly after boot so a restart re-checks the current month.
  setTimeout(() => { tick(); }, BOOT_DELAY_MS).unref?.();

  logger.info(`[budget-scheduler] periodic budget threshold checks active (every ${Math.round(CHECK_INTERVAL_MS / 3600000)}h)`);
};

export const stopBudgetScheduler = () => {
  if (timer) clearInterval(timer);
  timer = null;
};
