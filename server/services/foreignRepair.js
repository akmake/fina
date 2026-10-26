import Transaction from '../models/Transaction.js';
import BankConnection from '../models/BankConnection.js';
import { getIlsRates, normalizeCurrency } from './fxService.js';

/**
 * foreignRepair — one-off cleanup of foreign-currency card deals imported before
 * the 2026-10 fix (see docs/modules/import.md § Foreign-currency deals):
 *
 *   1. duplicates — a pending foreign row whose completed version was also stored
 *      (pending rows used to never be superseded) → soft-deleted.
 *   2. wrong amount — a foreign row stored with its ORIGINAL-currency number as the
 *      ILS amount (CAL pending, USD/EUR-billed cards) → converted at the rate of its
 *      charge date and flagged `amountEstimated`.
 *   3. backfill (opt-in) — deals dropped at import time never reached the DB, so they
 *      can only come back from the bank: card connections get `lastSuccessAt` moved
 *      back so their next sync re-reads the whole period.
 *
 * Dry run unless `apply` is true. Used by scripts/repairForeignTransactions.js.
 */

const CARD_COMPANIES = ['max', 'visaCal', 'calAuto', 'isracard', 'amex'];
const BACKFILL_OVERLAP_MS = 7 * 24 * 60 * 60 * 1000; // mirrors importRunner.syncStartDate

const dayKey = (d) => new Date(d).toISOString().slice(0, 10);
const dealKey = (t) =>
  `${t.user}_${dayKey(t.date)}_${(t.rawDescription || t.description || '').trim()}_${Math.abs(t.originalAmount)}${t.originalCurrency}`;

/** Historical ILS rate for a date (Frankfurter/ECB — weekends resolve to the last business day); null when unavailable. */
export const fetchHistoricalRate = async (currency, date) => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(`https://api.frankfurter.dev/v1/${dayKey(date)}?from=${currency}&to=ILS`, { signal: ctrl.signal });
    if (!res.ok) return null;
    const data = await res.json();
    return data.rates?.ILS ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
};

/**
 * @param {object} p
 * @param {Date}    p.since      only deals on/after this date
 * @param {boolean} [p.apply]    write changes (default: dry run)
 * @param {boolean} [p.backfill] move card connections' lastSuccessAt back to `since`
 * @param {(cur:string, date:Date) => Promise<number|null>} [p.rateFor] injectable for tests
 * @param {(line:string) => void} [p.log]
 */
export const repairForeignTransactions = async ({
  since, apply = false, backfill = false, rateFor = fetchHistoricalRate, log = () => {},
}) => {
  const rows = await Transaction.find({
    date: { $gte: since },
    originalCurrency: { $exists: true, $nin: [null, '', 'ILS', '₪', 'ש"ח', 'NIS'] },
    originalAmount: { $ne: null },
  }).lean();
  const foreign = rows.filter((t) => normalizeCurrency(t.originalCurrency) !== 'ILS');

  const report = { scanned: foreign.length, duplicatesRemoved: 0, amountsFixed: 0, failed: 0, connectionsBackfilled: 0 };

  // 1. Pending rows superseded by a stored completed row
  const completed = foreign.filter((t) => t.status !== 'pending');
  const completedKeys = new Set(completed.map(dealKey));
  const completedIds = new Set(completed.filter((t) => t.identifier).map((t) => `${t.user}_${t.identifier}`));
  const dupes = foreign.filter((t) => t.status === 'pending'
    && (completedKeys.has(dealKey(t)) || (t.identifier && completedIds.has(`${t.user}_${t.identifier}`))));
  for (const t of dupes) log(`duplicate  ${dayKey(t.date)}  ${t.description}  ${t.amount}₪ (pending) → remove`);
  if (apply && dupes.length) {
    await Transaction.softDeleteMany({ _id: { $in: dupes.map((t) => t._id) } });
  }
  report.duplicatesRemoved = dupes.length;
  const dupeIds = new Set(dupes.map((t) => String(t._id)));

  // 2. Original-currency number stored as shekels
  const wrong = foreign.filter((t) => !dupeIds.has(String(t._id))
    && !t.amountEstimated
    && Math.abs(t.amount - Math.abs(t.originalAmount)) < 0.005);
  const rateCache = new Map();
  for (const t of wrong) {
    const cur = normalizeCurrency(t.originalCurrency);
    const when = t.status === 'pending' ? t.date : (t.processedDate || t.date);
    const key = `${cur}_${dayKey(when)}`;
    if (!rateCache.has(key)) {
      rateCache.set(key, (await rateFor(cur, when)) ?? (await getIlsRates([cur]))[cur] ?? null);
    }
    const rate = rateCache.get(key);
    if (!rate) {
      report.failed += 1;
      log(`no rate    ${dayKey(t.date)}  ${t.description}  ${cur} — skipped`);
      continue;
    }
    const amount = Math.round(Math.abs(t.originalAmount) * rate * 100) / 100;
    log(`amount     ${dayKey(t.date)}  ${t.description}  ${t.amount}₪ → ${amount}₪ (${Math.abs(t.originalAmount)} ${cur} × ${rate.toFixed(4)})`);
    if (apply) {
      try {
        await Transaction.updateOne({ _id: t._id }, { $set: { amount, amountEstimated: true, fxRate: rate } });
      } catch (err) {
        report.failed += 1;
        log(`failed     ${t._id}: ${err.message}`);
        continue;
      }
    }
    report.amountsFixed += 1;
  }

  // 3. Re-read the period on the next sync (deals that were dropped at import)
  if (backfill) {
    const target = new Date(since.getTime() + BACKFILL_OVERLAP_MS);
    const conns = await BankConnection.find({ company: { $in: CARD_COMPANIES }, lastSuccessAt: { $gt: target } }).lean();
    for (const c of conns) log(`backfill   connection ${c._id} (${c.company}) → next sync reads from ${dayKey(since)}`);
    if (apply && conns.length) {
      await BankConnection.updateMany({ _id: { $in: conns.map((c) => c._id) } }, { $set: { lastSuccessAt: target } });
    }
    report.connectionsBackfilled = conns.length;
  }

  return report;
};
