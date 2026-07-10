import Goal from '../models/Goal.js';
import Transaction from '../models/Transaction.js';
import Deposit from '../models/Deposit.js';
import Fund from '../models/Fund.js';

/**
 * goalTrackingService — makes a Goal track real data instead of a static number
 * (§5.6). A goal in 'category' mode sums the transactions in its linked category
 * since startDate; in 'account' mode it reads the linked deposit/fund balance.
 * Recompute updates currentAmount, milestone/completion state, and lastTrackedAt.
 */

/** Sum of transactions in a category within a scope, from `since` onward. */
const sumCategorySince = async (filter, category, since) => {
  const match = { ...filter, category };
  if (since) match.date = { $gte: new Date(since) };
  const rows = await Transaction.aggregate([
    { $match: match },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  return rows[0]?.total || 0;
};

/** Current balance of a linked deposit/fund (best-effort; 0 if unavailable). */
const linkedAccountValue = async (goal, filter) => {
  if (!goal.linkedAccountId) return 0;
  if (goal.linkedAccountType === 'deposit') {
    const dep = await Deposit.findOne({ ...filter, _id: goal.linkedAccountId });
    return dep?.principal || 0;
  }
  if (goal.linkedAccountType === 'fund') {
    const fund = await Fund.findOne({ ...filter, _id: goal.linkedAccountId });
    return fund?.current_value || 0;
  }
  return 0;
};

/**
 * Recompute one goal's currentAmount from its linked source. No-op for manual
 * goals. Persists and returns the (possibly updated) goal.
 * @returns {Promise<{goal:object, changed:boolean}>}
 */
export const recomputeGoal = async (goal, filter) => {
  if (goal.trackingMode === 'manual' || !goal.trackingMode) {
    return { goal, changed: false };
  }

  let computed = goal.currentAmount;
  if (goal.trackingMode === 'category' && goal.linkedCategory) {
    computed = Math.abs(await sumCategorySince(filter, goal.linkedCategory, goal.startDate));
  } else if (goal.trackingMode === 'account') {
    computed = await linkedAccountValue(goal, filter);
  }

  const changed = Math.round(computed) !== Math.round(goal.currentAmount);
  goal.currentAmount = computed;
  goal.lastTrackedAt = new Date();

  // milestones + completion, mirroring depositToGoal's semantics
  for (const ms of goal.milestones || []) {
    if (!ms.isReached && goal.currentAmount >= ms.targetAmount) {
      ms.isReached = true;
      ms.reachedDate = new Date();
    }
  }
  if (goal.currentAmount >= goal.targetAmount && goal.status === 'active') {
    goal.status = 'completed';
  }

  await goal.save();
  return { goal, changed };
};

/**
 * Recompute every connected (non-manual) active goal in a scope.
 * @returns {Promise<{recomputed:number, changed:number}>}
 */
export const recomputeAllGoals = async (filter) => {
  const goals = await Goal.find({ ...filter, status: 'active', trackingMode: { $in: ['category', 'account'] } });
  let changed = 0;
  for (const goal of goals) {
    const res = await recomputeGoal(goal, filter);
    if (res.changed) changed += 1;
  }
  return { recomputed: goals.length, changed };
};
