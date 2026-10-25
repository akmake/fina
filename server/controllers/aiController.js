import crypto from 'crypto';
import mongoose from 'mongoose';
import ApiKey from '../models/ApiKey.js';
import Transaction from '../models/Transaction.js';
import Budget from '../models/Budget.js';
import BankConnection from '../models/BankConnection.js';
import ImportJob from '../models/ImportJob.js';
import Alert from '../models/Alert.js';
import AppError from '../utils/AppError.js';
import { audit } from '../utils/audit.js';
import { scopeFilter } from '../utils/scopeFilter.js';
import { hashDeviceToken } from '../middlewares/deviceAuth.js';
import { IL_TZ, israelMonthStart, israelMonthKey, israelWallToDate } from '../utils/israelTime.js';
import * as categorization from '../services/categorizationService.js';

/**
 * aiController — the read-only API behind the Fina MCP server (/mcp), plus
 * management of the personal AI keys that authorize it.
 *
 * Every data endpoint is GET, household-scoped (scopeFilter) and returns compact
 * JSON shaped for an assistant to read (amounts in ₪, Israel-time months).
 * Contract: docs/modules/ai-mcp.md.
 */

const MAX_KEYS = 5;
const MAX_ROWS = 200;
const INCOME = 'הכנסה';
const EXPENSE = 'הוצאה';

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const round = (n) => Math.round((n || 0) * 100) / 100;

// 'YYYY-MM' (Israel time) → [start, end) ; default = current month.
const monthRange = (month) => {
  if (month !== undefined && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new AppError('month חייב להיות בפורמט YYYY-MM', 400);
  }
  const start = month
    ? israelWallToDate(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 1, 0)
    : israelMonthStart(new Date());
  return { start, end: israelMonthStart(start, 1), key: israelMonthKey(start).slice(0, 7) };
};

// 'YYYY-MM-DD' (Israel time) → Date ; end dates are inclusive (whole day).
const parseDay = (value, name, { endOfDay = false } = {}) => {
  if (value === undefined) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new AppError(`${name} חייב להיות בפורמט YYYY-MM-DD`, 400);
  const [y, m, d] = value.split('-').map(Number);
  const day = israelWallToDate(y, m, d + (endOfDay ? 1 : 0), 0);
  if (Number.isNaN(day.getTime())) throw new AppError(`${name} אינו תאריך תקין`, 400);
  return day;
};

const txOut = (t) => ({
  id: t._id,
  date: t.date,
  description: t.description,
  amount: round(t.amount),
  type: t.type === INCOME ? 'income' : 'expense',
  category: t.category || null,
  account: t.account || null,
});

// ── Key management (session) ────────────────────────────────────────────────

/** GET /api/ai-keys */
export const listKeys = async (req, res, next) => {
  try {
    res.json(await ApiKey.find({ user: req.user._id, revokedAt: null }).sort({ createdAt: -1 }).lean());
  } catch (err) { next(err); }
};

/** POST /api/ai-keys { name } → { key, token } — the token is shown ONCE. */
export const createKey = async (req, res, next) => {
  try {
    // Connector grants (OAuth) are managed by the assistant and don't count here.
    if (await ApiKey.countDocuments({ user: req.user._id, revokedAt: null, oauthClient: null }) >= MAX_KEYS) {
      throw new AppError(`אפשר עד ${MAX_KEYS} מפתחות פעילים — בטל מפתח ישן קודם`, 400);
    }
    const token = `fk_${crypto.randomBytes(32).toString('base64url')}`;
    const key = await ApiKey.create({
      user: req.user._id,
      name: String(req.body?.name || 'עוזר AI').trim().slice(0, 60) || 'עוזר AI',
      tokenHash: hashDeviceToken(token),
      tokenHint: token.slice(0, 7),
      scopes: req.body?.allowCategorize === true ? ['categorize'] : [],
    });
    await audit(req, 'aiKey.create', 'ApiKey', { entityId: key._id, after: { name: key.name, scopes: key.scopes } });
    res.status(201).json({ key, token });
  } catch (err) { next(err); }
};

/** DELETE /api/ai-keys/:id */
export const revokeKey = async (req, res, next) => {
  try {
    const key = await ApiKey.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id, revokedAt: null },
      { $set: { revokedAt: new Date() } },
      { new: true },
    );
    if (!key) throw new AppError('המפתח לא נמצא', 404);
    await audit(req, 'aiKey.revoke', 'ApiKey', { entityId: key._id, before: { name: key.name } });
    res.json({ message: 'המפתח בוטל' });
  } catch (err) { next(err); }
};

// ── Read-only data (AI key) ─────────────────────────────────────────────────

/**
 * GET /api/ai/overview?month=YYYY-MM — month at a glance: totals, top
 * categories, budget usage, connection health, unread alerts.
 */
export const overview = async (req, res, next) => {
  try {
    const { start, end, key } = monthRange(req.query.month);
    const scope = scopeFilter(req);
    const inMonth = { ...scope, date: { $gte: start, $lt: end } };
    const [y, m] = key.split('-').map(Number); // Israel month → budget month/year

    const [totals, byCategory, budget, connections, unreadAlerts] = await Promise.all([
      Transaction.aggregate([{ $match: inMonth }, { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } }]),
      Transaction.aggregate([
        { $match: { ...inMonth, type: EXPENSE } },
        { $group: { _id: '$category', total: { $sum: '$amount' } } },
        { $sort: { total: -1 } },
      ]),
      Budget.findOne({ ...scope, month: m, year: y }).lean(),
      BankConnection.find(scope).select('displayName company status autoSync lastSyncAt lastSyncStatus lastError').lean(),
      Alert.countDocuments({ user: req.user._id, isRead: false, isDismissed: false }),
    ]);

    const t = Object.fromEntries(totals.map((x) => [x._id, x]));
    const income = round(t[INCOME]?.total);
    const expense = round(t[EXPENSE]?.total);
    const spentBy = Object.fromEntries(byCategory.map((c) => [c._id || 'ללא קטגוריה', c.total]));

    res.json({
      month: key,
      currency: 'ILS',
      income,
      expense,
      net: round(income - expense),
      transactionCount: (t[INCOME]?.count || 0) + (t[EXPENSE]?.count || 0),
      topCategories: byCategory.slice(0, 8).map((c) => ({ category: c._id || 'ללא קטגוריה', total: round(c.total) })),
      budget: budget ? (budget.items || []).map((i) => {
        const spent = round(spentBy[i.category] || 0);
        return { category: i.category, limit: i.limit, spent, percentUsed: i.limit ? Math.round((spent / i.limit) * 100) : null };
      }) : null,
      connections: connections.map((c) => ({
        name: c.displayName || c.company,
        status: c.status,
        autoSync: c.autoSync,
        lastSyncAt: c.lastSyncAt || null,
        lastSyncOk: c.lastSyncStatus === 'success',
        problem: c.lastSyncStatus === 'error' ? c.lastError : null,
      })),
      unreadAlerts,
    });
  } catch (err) { next(err); }
};

/**
 * GET /api/ai/transactions?from&to&q&category&type&minAmount&maxAmount&limit
 * Newest first, at most 200 rows. `q` is a literal (escaped) text search.
 */
export const searchTransactions = async (req, res, next) => {
  try {
    const { q, category, type, minAmount, maxAmount } = req.query;
    const filter = { ...scopeFilter(req) };

    const from = parseDay(req.query.from, 'from');
    const to = parseDay(req.query.to, 'to', { endOfDay: true });
    if (from || to) filter.date = { ...(from && { $gte: from }), ...(to && { $lt: to }) };
    if (q) filter.description = { $regex: escapeRegex(String(q).slice(0, 100)), $options: 'i' };
    if (category) filter.category = String(category);
    if (type) {
      if (!['income', 'expense'].includes(type)) throw new AppError('type חייב להיות income או expense', 400);
      filter.type = type === 'income' ? INCOME : EXPENSE;
    }
    const min = minAmount !== undefined ? Number(minAmount) : undefined;
    const max = maxAmount !== undefined ? Number(maxAmount) : undefined;
    if ([min, max].some((v) => v !== undefined && Number.isNaN(v))) throw new AppError('סכום לא תקין', 400);
    if (min !== undefined || max !== undefined) filter.amount = { ...(min !== undefined && { $gte: min }), ...(max !== undefined && { $lte: max }) };

    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), MAX_ROWS);
    const [rows, total] = await Promise.all([
      Transaction.find(filter).select('date description amount type category account').sort({ date: -1 }).limit(limit).maxTimeMS(5000).lean(),
      Transaction.countDocuments(filter).maxTimeMS(5000),
    ]);
    res.json({ total, returned: rows.length, transactions: rows.map(txOut) });
  } catch (err) { next(err); }
};

/**
 * GET /api/ai/spending?from&to&groupBy=category|month|merchant&type=expense|income
 * Sums per group, largest first.
 */
export const spending = async (req, res, next) => {
  try {
    const groupBy = req.query.groupBy || 'category';
    const keyExpr = {
      category: { $ifNull: ['$category', 'ללא קטגוריה'] },
      merchant: '$description',
      month: { $dateToString: { format: '%Y-%m', date: '$date', timezone: IL_TZ } },
    }[groupBy];
    if (!keyExpr) throw new AppError('groupBy חייב להיות category, month או merchant', 400);
    const type = req.query.type || 'expense';
    if (!['income', 'expense'].includes(type)) throw new AppError('type חייב להיות income או expense', 400);

    const from = parseDay(req.query.from, 'from') || israelMonthStart(new Date(), -2);
    const to = parseDay(req.query.to, 'to', { endOfDay: true }) || new Date();

    const rows = await Transaction.aggregate([
      { $match: { ...scopeFilter(req), type: type === 'income' ? INCOME : EXPENSE, date: { $gte: from, $lt: to } } },
      { $group: { _id: keyExpr, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: groupBy === 'month' ? { _id: 1 } : { total: -1 } },
      { $limit: 100 },
    ]).option({ maxTimeMS: 5000 });

    res.json({
      from, to, type, groupBy, currency: 'ILS',
      total: round(rows.reduce((s, r) => s + r.total, 0)),
      groups: rows.map((r) => ({ [groupBy]: r._id, total: round(r.total), count: r.count })),
    });
  } catch (err) { next(err); }
};

/** GET /api/ai/connections — bank/card connection health incl. waiting-for-SMS. */
export const connections = async (req, res, next) => {
  try {
    const conns = await BankConnection.find(scopeFilter(req))
      .select('displayName company status autoSync syncHour nextSyncAt lastSyncAt lastSyncStatus lastInserted lastError')
      .lean();
    const waiting = await ImportJob.find({
      connection: { $in: conns.map((c) => c._id) },
      status: 'awaiting_otp',
      otpExpiresAt: { $gt: new Date() },
    }).select('connection').lean();
    const waitingSet = new Set(waiting.map((j) => String(j.connection)));
    res.json(conns.map((c) => ({
      name: c.displayName || c.company,
      provider: c.company,
      status: c.status,
      autoSync: c.autoSync,
      dailySyncHourIsrael: c.syncHour ?? 6,
      nextSyncAt: c.nextSyncAt || null,
      lastSyncAt: c.lastSyncAt || null,
      lastSyncOk: c.lastSyncStatus === 'success',
      lastNewTransactions: c.lastInserted || 0,
      problem: c.lastSyncStatus === 'error' ? c.lastError : null,
      waitingForSmsCode: waitingSet.has(String(c._id)),
    })));
  } catch (err) { next(err); }
};

/** GET /api/ai/alerts — unread, not dismissed (newest 20). */
export const alerts = async (req, res, next) => {
  try {
    const rows = await Alert.find({ user: new mongoose.Types.ObjectId(String(req.user._id)), isRead: false, isDismissed: false })
      .select('type title message severity createdAt')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
    res.json(rows.map(({ _id, ...a }) => a));
  } catch (err) { next(err); }
};

// ── Categorization (AI key with the 'categorize' scope) ─────────────────────

/** GET /api/ai/categories — names the assistant may use, most used first. */
export const categories = async (req, res, next) => {
  try { res.json(await categorization.listCategories(req)); } catch (err) { next(err); }
};

// Wrap a categorization op: run it, audit real changes (who + which key), respond.
const categorize = (op, action) => async (req, res, next) => {
  try {
    const result = await categorization[op](req, req.body || {});
    if (!result.dryRun) {
      await audit(req, action, 'Transaction', { after: { ...result, viaAiKey: req.apiKey?._id } });
    }
    res.json(result);
  } catch (err) { next(err); }
};

/** POST /api/ai/categorize/merchant-name { currentName, newName, dryRun? } */
export const renameMerchant = categorize('renameMerchant', 'ai.merchant.rename');
/** POST /api/ai/categorize/merchant-category { merchant, category, createIfMissing?, dryRun? } */
export const setMerchantCategory = categorize('setMerchantCategory', 'ai.merchant.category');
/** POST /api/ai/categorize/transaction-category { transactionId, category, createIfMissing? } */
export const setTransactionCategory = categorize('setTransactionCategory', 'ai.transaction.category');
/** POST /api/ai/categorize/rename-category { currentName, newName, dryRun? } */
export const renameCategory = categorize('renameCategory', 'ai.category.rename');
