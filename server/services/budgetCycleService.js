import Budget from '../models/Budget.js';
import Transaction from '../models/Transaction.js';
import { endOfMonth } from 'date-fns';
import { notify } from './notificationService.js';

/**
 * budgetCycleService — the monthly-budget engine (Phase 3, §5.4):
 *   1. computeSpending — actual expense per category for a month (shared with
 *      budgetController so there is one source of truth for the math).
 *   2. checkBudgetThresholds — raises 75 / 90 / 100% notifications per category
 *      (and overall), de-duped so each threshold fires once per month.
 *   3. rolloverToMonth — "roll" a month's budget forward, optionally carrying
 *      the previous month's unspent balance into each category.
 */

export const THRESHOLDS = [75, 90, 100];

/** Actual expense totals keyed by category for {month,year} within a scope. */
export const computeSpending = async (userFilter, month, year) => {
  const start = new Date(year, month - 1, 1);
  const end = endOfMonth(start);
  const rows = await Transaction.aggregate([
    { $match: { ...userFilter, type: 'הוצאה', date: { $gte: start, $lte: end } } },
    { $group: { _id: '$category', total: { $sum: '$amount' } } },
  ]);
  return rows.reduce((map, r) => { map[r._id] = r.total; return map; }, {});
};

const severityFor = (threshold) =>
  threshold >= 100 ? 'danger' : threshold >= 90 ? 'warning' : 'info';
const iconFor = (threshold) => (threshold >= 100 ? '🚨' : '⚠️');

/**
 * Check the given month's budget against actual spending and raise a
 * notification for the highest threshold each category has newly crossed.
 * @param {object} opts
 * @param {object} opts.filter    scopeFilter(req) — expands to household members
 * @param {object} opts.ownerId   who receives the notifications (budget.user)
 * @param {number} [opts.month]   1-12 (default: current)
 * @param {number} [opts.year]
 * @returns {Promise<{checked:boolean, raised:number}>}
 */
export const checkBudgetThresholds = async ({ filter, ownerId, month, year }) => {
  const now = new Date();
  const m = month || now.getMonth() + 1;
  const y = year || now.getFullYear();

  const budget = await Budget.findOne({ ...filter, month: m, year: y });
  if (!budget) return { checked: false, raised: 0 };

  const spending = await computeSpending(filter, m, y);
  const user = ownerId || budget.user;
  const ym = `${y}-${String(m).padStart(2, '0')}`;
  let raised = 0;

  const raiseFor = async (label, spent, limit, keyBase, actionUrl) => {
    if (!limit || limit <= 0) return;
    const pct = (spent / limit) * 100;
    const crossed = [...THRESHOLDS].reverse().find((t) => pct >= t); // highest reached
    if (!crossed) return;
    const res = await notify({
      user,
      type: crossed >= 100 ? 'budget_exceeded' : 'budget_warning',
      title: crossed >= 100 ? `חריגה מתקציב: ${label}` : `אזהרת תקציב: ${label}`,
      message: `נוצלו ${Math.round(spent).toLocaleString()} ₪ מתוך ${Math.round(limit).toLocaleString()} ₪ ` +
        `בקטגוריית "${label}" (${Math.round(pct)}%)`,
      icon: iconFor(crossed),
      severity: severityFor(crossed),
      actionUrl: actionUrl || '/budget',
      actionLabel: 'לתקציב',
      relatedModel: 'Budget',
      relatedId: budget._id,
      dedupeKey: `${keyBase}:${crossed}:${ym}`,
      dedupeWindowMs: 35 * 24 * 60 * 60 * 1000, // once per threshold per month
    });
    if (res.created) raised += 1;
  };

  // Per-category
  for (const item of budget.items) {
    await raiseFor(item.category, spending[item.category] || 0, item.limit, `budget:${item.category}`);
  }
  // Overall
  const totalSpent = Object.values(spending).reduce((s, v) => s + v, 0);
  await raiseFor('סה"כ חודשי', totalSpent, budget.totalLimit, 'budget:__total__');

  return { checked: true, raised };
};

/**
 * Roll a budget forward into a target month. Copies category limits from the
 * source month; when carryOver is on, each category's unspent balance from the
 * source month is added to the new limit (spec §5.4 "rollover אופציונלי").
 * No-op (returns the existing) if the target month already has a budget.
 * @returns {Promise<{rolled:boolean, budget:object}>}
 */
export const rolloverToMonth = async ({ ownerUserId, filter, fromMonth, fromYear, toMonth, toYear, carryOver }) => {
  const existing = await Budget.findOne({ ...filter, month: toMonth, year: toYear });
  if (existing) return { rolled: false, budget: existing };

  const source = await Budget.findOne({ ...filter, month: fromMonth, year: fromYear });
  if (!source) return { rolled: false, budget: null };

  const spending = carryOver ? await computeSpending(filter, fromMonth, fromYear) : {};

  const items = source.items.map((item) => {
    let limit = item.limit;
    if (carryOver) {
      const leftover = Math.max(0, item.limit - (spending[item.category] || 0));
      limit += leftover;
    }
    return { category: item.category, limit, color: item.color };
  });

  const totalLimit = carryOver
    ? items.reduce((s, i) => s + i.limit, 0)
    : source.totalLimit;

  const budget = await Budget.create({
    user: ownerUserId,
    month: toMonth,
    year: toYear,
    totalLimit,
    items,
    alertThreshold: source.alertThreshold,
    carryOverEnabled: source.carryOverEnabled,
  });

  return { rolled: true, budget };
};
