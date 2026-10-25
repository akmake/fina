import mongoose from 'mongoose';
import Transaction from '../models/Transaction.js';
import Category from '../models/Category.js';
import CategoryRule from '../models/CategoryRule.js';
import Budget from '../models/Budget.js';
import Goal from '../models/Goal.js';
import RecurringTransaction from '../models/RecurringTransaction.js';
import AppError from '../utils/AppError.js';
import { scopeFilter } from '../utils/scopeFilter.js';

/**
 * categorizationService — renaming merchants and (re)categorizing, used by the
 * AI assistant (/api/ai/categorize/*). Every change is household-scoped and
 * "learned" through the household's OWN CategoryRule (exact match on the raw
 * bank description), so future imports get the same name/category.
 *
 * Deliberately NOT written: the global MerchantMap (shared by all customers —
 * AUDIT P1-1). Each operation supports `dryRun` → returns what would change.
 */

const clean = (s, field) => {
  const v = String(s ?? '').trim();
  if (!v) throw new AppError(`${field} חסר`, 400);
  if (v.length > 80) throw new AppError(`${field} ארוך מדי (עד 80 תווים)`, 400);
  return v;
};

/** Find a category by name in the household (any member), optionally create it. */
export const ensureCategory = async (req, name, { create = false } = {}) => {
  const found = await Category.findOne({ ...scopeFilter(req), name });
  if (found) return { category: found, created: false };
  // Categories are also referenced by name only (from imports) — accept those.
  const usedOnTransactions = await Transaction.exists({ ...scopeFilter(req), category: name });
  if (!create && !usedOnTransactions) {
    throw new AppError(`הקטגוריה "${name}" לא קיימת. אפשר ליצור אותה עם createIfMissing=true`, 404);
  }
  const category = await Category.create({ user: req.user._id, name, type: 'הוצאה' });
  return { category, created: true };
};

// Raw bank descriptions behind a displayed merchant name (what future imports carry).
const rawNamesFor = async (req, merchant) => {
  const rows = await Transaction.find({ ...scopeFilter(req), description: merchant }, { rawDescription: 1, description: 1 }).lean();
  return [...new Set(rows.map((t) => t.rawDescription || t.description).filter(Boolean))];
};

// Upsert the household rule for each raw description. Rules are per-user; the
// acting user owns them (same as rules created on the web).
const learnRules = async (req, rawNames, { newName, categoryId }) => {
  for (const searchString of rawNames) {
    const set = { matchType: 'exact', category: categoryId };
    if (newName !== undefined) set.newName = newName;
    await CategoryRule.findOneAndUpdate(
      { user: req.user._id, searchString },
      { $set: set },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }
  return rawNames.length;
};

// The category a merchant mostly has today (needed: a rule always carries one).
const dominantCategory = async (req, merchant) => {
  const [top] = await Transaction.aggregate([
    { $match: { ...scopeFilter(req), description: merchant } },
    { $group: { _id: '$category', n: { $sum: 1 } } },
    { $sort: { n: -1 } },
    { $limit: 1 },
  ]);
  return top?._id || 'כללי';
};

/** Rename a merchant on all its transactions (+ future imports). */
export const renameMerchant = async (req, { currentName, newName, dryRun = false }) => {
  const from = clean(currentName, 'currentName');
  const to = clean(newName, 'newName');
  if (from === to) throw new AppError('השם החדש זהה לשם הקיים', 400);

  const count = await Transaction.countDocuments({ ...scopeFilter(req), description: from });
  if (count === 0) throw new AppError(`לא נמצאו עסקאות עם בית העסק "${from}" (יש לציין את השם בדיוק כפי שהוא מופיע)`, 404);
  if (dryRun) return { dryRun: true, wouldUpdate: count, from, to };

  const rawNames = await rawNamesFor(req, from);
  const { category } = await ensureCategory(req, await dominantCategory(req, from), { create: true });
  const result = await Transaction.updateMany({ ...scopeFilter(req), description: from, deletedAt: null }, { $set: { description: to } });
  const rules = await learnRules(req, rawNames, { newName: to, categoryId: category._id });
  return { updated: result.modifiedCount, from, to, rulesLearned: rules };
};

/** Put every transaction of a merchant in a category (+ future imports). */
export const setMerchantCategory = async (req, { merchant, category, createIfMissing = false, dryRun = false }) => {
  const name = clean(merchant, 'merchant');
  const target = clean(category, 'category');

  const filter = { ...scopeFilter(req), description: name };
  const count = await Transaction.countDocuments(filter);
  if (count === 0) throw new AppError(`לא נמצאו עסקאות עם בית העסק "${name}"`, 404);
  if (dryRun) {
    await ensureCategoryExistsOrCreatable(req, target, createIfMissing);
    return { dryRun: true, wouldUpdate: count, merchant: name, category: target };
  }

  const { category: cat, created } = await ensureCategory(req, target, { create: createIfMissing });
  const rawNames = await rawNamesFor(req, name);
  const result = await Transaction.updateMany({ ...filter, deletedAt: null }, { $set: { category: target } });
  const rules = await learnRules(req, rawNames, { categoryId: cat._id });
  return { updated: result.modifiedCount, merchant: name, category: target, categoryCreated: created, rulesLearned: rules };
};

const ensureCategoryExistsOrCreatable = async (req, name, createIfMissing) => {
  if (createIfMissing) return;
  const exists = await Category.exists({ ...scopeFilter(req), name })
    || await Transaction.exists({ ...scopeFilter(req), category: name });
  if (!exists) throw new AppError(`הקטגוריה "${name}" לא קיימת. אפשר ליצור אותה עם createIfMissing=true`, 404);
};

/** Recategorize one transaction (no rule — a one-off correction). */
export const setTransactionCategory = async (req, { transactionId, category, createIfMissing = false }) => {
  if (!mongoose.Types.ObjectId.isValid(transactionId)) throw new AppError('מזהה עסקה לא תקין', 400);
  const target = clean(category, 'category');
  const tx = await Transaction.findOne({ _id: transactionId, ...scopeFilter(req) });
  if (!tx) throw new AppError('העסקה לא נמצאה', 404);
  await ensureCategory(req, target, { create: createIfMissing });
  const previous = tx.category || null;
  tx.category = target;
  await tx.save();
  return { transactionId: tx._id, description: tx.description, previousCategory: previous, category: target };
};

/**
 * Rename a category everywhere it is referenced by name: transactions, budget
 * items, recurring transactions, goals tracking it, and the Category itself.
 * Refuses if the new name already exists (merging is a different decision).
 */
export const renameCategory = async (req, { currentName, newName, dryRun = false }) => {
  const from = clean(currentName, 'currentName');
  const to = clean(newName, 'newName');
  if (from === to) throw new AppError('השם החדש זהה לשם הקיים', 400);

  const scope = scopeFilter(req);
  const [doc, txCount, clash] = await Promise.all([
    Category.findOne({ ...scope, name: from }),
    Transaction.countDocuments({ ...scope, category: from }),
    Category.exists({ ...scope, name: to }),
  ]);
  if (!doc && txCount === 0) throw new AppError(`הקטגוריה "${from}" לא נמצאה`, 404);
  if (clash || await Transaction.exists({ ...scope, category: to })) {
    throw new AppError(`כבר קיימת קטגוריה בשם "${to}". כדי לאחד, העבר בתי עסק אליה עם set_merchant_category`, 409);
  }
  if (dryRun) return { dryRun: true, from, to, transactionsWouldUpdate: txCount };

  if (doc) { doc.name = to; await doc.save(); }
  const [tx, budgets, recurring, goals] = await Promise.all([
    Transaction.updateMany({ ...scope, category: from, deletedAt: null }, { $set: { category: to } }),
    Budget.updateMany({ ...scope, 'items.category': from }, { $set: { 'items.$[i].category': to } }, { arrayFilters: [{ 'i.category': from }] }),
    RecurringTransaction.updateMany({ ...scope, category: from }, { $set: { category: to } }),
    Goal.updateMany({ ...scope, linkedCategory: from }, { $set: { linkedCategory: to } }),
  ]);
  return {
    from, to,
    transactionsUpdated: tx.modifiedCount,
    budgetsUpdated: budgets.modifiedCount,
    recurringUpdated: recurring.modifiedCount,
    goalsUpdated: goals.modifiedCount,
  };
};

/** Categories the assistant may use: defined ones + names used on transactions. */
export const listCategories = async (req) => {
  const scope = scopeFilter(req);
  const [defined, used] = await Promise.all([
    Category.find(scope).select('name type').lean(),
    Transaction.aggregate([
      { $match: { ...scope, category: { $nin: [null, ''] } } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ]),
  ]);
  const counts = Object.fromEntries(used.map((u) => [u._id, u.count]));
  const names = new Set([...defined.map((c) => c.name), ...used.map((u) => u._id)]);
  const typeOf = Object.fromEntries(defined.map((c) => [c.name, c.type === 'הכנסה' ? 'income' : 'expense']));
  return [...names].sort((a, b) => (counts[b] || 0) - (counts[a] || 0)).map((name) => ({
    name, type: typeOf[name] || null, transactionCount: counts[name] || 0,
  }));
};
