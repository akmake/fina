import Transaction from '../models/Transaction.js';
import FinanceProfile from '../models/FinanceProfile.js';
import CategoryRule from '../models/CategoryRule.js';

/**
 * transactionPersistence — the single place that turns parsed transactions into
 * saved Transaction documents: apply category rules, drop duplicates already in
 * the DB, insert the rest, and refresh the FinanceProfile account balances.
 *
 * Extracted from importController.processTransactions so the unattended import
 * job runner (importRunner) persists via exactly the same logic as the
 * interactive "review then import" flow.
 */

const GENERIC_CATEGORIES = ['כללי', 'שונות', '', 'null', 'undefined'];

/**
 * Apply user category rules to a single in-memory transaction (pre-save).
 * Does not overwrite a real category already set (e.g. from a MerchantMap).
 */
export const applyRulesToTransactionInMemory = (transaction, rules) => {
  // שמירת השם המקורי אם עדיין לא נשמר
  if (!transaction.originalDescription) {
    transaction.originalDescription = transaction.description;
  }

  // אם כבר יש קטגוריה אמיתית (למשל מ-MerchantMap ב-parseTransactions) — לא דורסים
  if (transaction.category && !GENERIC_CATEGORIES.includes(transaction.category)) {
    return transaction;
  }

  for (const rule of rules) {
    let isMatch = false;
    const desc = transaction.originalDescription || transaction.description;

    if (rule.matchType === 'exact') {
      isMatch = desc === rule.searchString;
    } else if (rule.matchType === 'starts_with') {
      isMatch = desc.startsWith(rule.searchString);
    } else {
      isMatch = desc.includes(rule.searchString);
    }

    if (isMatch) {
      // אם נמצאה התאמה, מעדכנים קטגוריה ושם (משתמשים בשם, לא ObjectId)
      transaction.category = rule.category?.name || rule.category || 'כללי';
      if (rule.newName) {
        transaction.description = rule.newName;
      }
      break;
    }
  }
  return transaction;
};

// Duplicate key: same day + amount + description (+ processedDate/installment leg).
// Matches the partial unique index on Transaction and the client-side importer.
const makeDedupeKey = (t) => {
  const d = new Date(t.date);
  const pd = t.processedDate ? new Date(t.processedDate) : null;
  const pdKey = pd ? `_pd${pd.getUTCFullYear()}-${pd.getUTCMonth()}-${pd.getUTCDate()}` : '';
  const instKey = t.installments?.number != null ? `_i${t.installments.number}` : '';
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}_${t.amount}_${(t.rawDescription || t.description || '').trim()}${pdKey}${instKey}`;
};

/** Recompute FinanceProfile per-account balances from all of a user's transactions. */
const refreshBalances = async (userId) => {
  const aggregation = await Transaction.aggregate([
    { $match: { user: userId } },
    {
      $group: {
        _id: '$account',
        total: { $sum: { $cond: [{ $eq: ['$type', 'הכנסה'] }, '$amount', { $multiply: ['$amount', -1] }] } },
      },
    },
  ]);

  const updates = {};
  const knownFields = ['checking', 'cash', 'deposits', 'stocks'];
  aggregation.forEach((item) => {
    const accountKey = item._id;
    if (knownFields.includes(accountKey)) {
      updates[accountKey] = item.total;
    } else {
      updates['checking'] = (updates['checking'] || 0) + item.total;
    }
  });

  if (Object.keys(updates).length > 0) {
    await FinanceProfile.updateOne({ user: userId }, { $set: updates }, { upsert: true });
  }
};

/**
 * Persist parsed transactions for a user: apply rules, dedupe against existing,
 * insert the new ones, refresh balances.
 *
 * @param {object} p
 * @param {string|import('mongoose').Types.ObjectId} p.userId
 * @param {object[]} p.transactions  parsed transactions (client shape / parseTransactions output)
 * @param {object[]} [p.rules]       preloaded CategoryRule docs; loaded if omitted
 * @returns {Promise<{inserted:number, skipped:number, received:number}>}
 */
export const persistTransactions = async ({ userId, transactions, rules }) => {
  const received = Array.isArray(transactions) ? transactions.length : 0;
  if (received === 0) return { inserted: 0, skipped: 0, received: 0 };

  // 1. Category rules (populate the category name for display)
  const ruleSet = rules ?? await CategoryRule.find({ user: userId }).populate('category').lean();

  // 2. Apply rules + stamp the owning user + keep the original description
  const processed = transactions.map((t) => applyRulesToTransactionInMemory(
    { ...t, user: userId, originalDescription: t.originalDescription || t.description },
    ruleSet,
  ));

  // 3. Dedupe against transactions already stored in the same date window
  const dates = processed.map((t) => new Date(t.date));
  const minDate = new Date(Math.min(...dates));
  const maxDate = new Date(Math.max(...dates));
  minDate.setDate(minDate.getDate() - 1);
  maxDate.setDate(maxDate.getDate() + 1);

  const existingInRange = await Transaction.find(
    { user: userId, date: { $gte: minDate, $lte: maxDate } },
    { date: 1, amount: 1, rawDescription: 1, description: 1, identifier: 1, processedDate: 1, installments: 1 },
  ).lean();

  const existingKeys = new Set(existingInRange.map(makeDedupeKey));
  const existingIdentifiers = new Set(existingInRange.filter((t) => t.identifier).map((t) => t.identifier));

  const newTransactions = processed.filter((t) => {
    if (t.identifier && existingIdentifiers.has(t.identifier)) return false;
    return !existingKeys.has(makeDedupeKey(t));
  });
  const skipped = processed.length - newTransactions.length;

  // 4. Insert (unordered so one dup key doesn't abort the batch)
  let inserted = 0;
  if (newTransactions.length > 0) {
    try {
      const result = await Transaction.insertMany(newTransactions, { ordered: false });
      inserted = result.length;
    } catch (error) {
      if (error.code === 11000) {
        inserted = error.insertedDocs?.length || error.result?.insertedCount || error.result?.nInserted || 0;
      } else {
        throw error;
      }
    }
  }

  // 5. Refresh account balances
  await refreshBalances(userId);

  return { inserted, skipped, received };
};
