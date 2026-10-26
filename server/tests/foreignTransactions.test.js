import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import mongoose from 'mongoose';
import Transaction from '../models/Transaction.js';
import { COMPANY_CONFIG } from '../services/scrapeService.js';
import { parseTransactions } from '../utils/excelParser.js';
import { persistTransactions } from '../services/transactionPersistence.js';
import { __resetFxCache } from '../services/fxService.js';

// exchangerate-api shape: units per 1 ILS → USD rate 1/0.25 = 4 ILS
const mockRates = () => vi.spyOn(globalThis, 'fetch').mockResolvedValue({
  json: async () => ({ rates: { USD: 0.25, EUR: 0.2 } }),
});

const maxTxn = (over) => ({
  date: '2026-10-10T00:00:00.000Z',
  description: 'AMAZON.COM',
  originalAmount: -50,
  originalCurrency: 'USD',
  type: 'normal',
  identifier: 'arn-1',
  ...over,
});

const parse = async (txns, userId) => {
  const rows = txns.map(COMPANY_CONFIG.max.toRow);
  return (await parseTransactions(rows, 'max', userId)).transactions;
};

describe('עסקאות מט"ח מחברות האשראי', () => {
  beforeEach(() => { __resetFxCache(); mockRates(); });
  afterEach(() => vi.restoreAllMocks());

  it('עסקת חו"ל ממתינה (חיוב 0 ₪) לא נזרקת — מומרת לסכום משוער', async () => {
    const userId = new mongoose.Types.ObjectId();
    const [t] = await parse([maxTxn({ chargedAmount: -0, chargedCurrency: 'ILS', status: 'pending', processedDate: '2026-10-10T00:00:00.000Z' })], userId);
    expect(t).toBeTruthy();
    expect(t.amount).toBe(200);
    expect(t.type).toBe('הוצאה');
    expect(t.amountEstimated).toBe(true);
  });

  it('חיוב בדולרים לא נשמר כשקלים; חיוב אמיתי בש"ח נשמר כמו שהוא', async () => {
    const userId = new mongoose.Types.ObjectId();
    const [usd, ils] = await parse([
      maxTxn({ chargedAmount: -50, chargedCurrency: 'USD', status: 'completed' }),
      maxTxn({ identifier: 'arn-2', chargedAmount: -187.3, chargedCurrency: 'ILS', status: 'completed' }),
    ], userId);
    expect(usd.amount).toBe(200);
    expect(usd.amountEstimated).toBe(true);
    expect(ils.amount).toBe(187.3);
    expect(ils.amountEstimated).toBeUndefined();
  });

  it('החיוב האמיתי מחליף את העסקה הממתינה בלי כפילות', async () => {
    const userId = new mongoose.Types.ObjectId();
    const pending = await parse([maxTxn({ chargedAmount: 0, chargedCurrency: 'ILS', status: 'pending', processedDate: '2026-10-10T00:00:00.000Z' })], userId);
    await persistTransactions({ userId, transactions: pending, includeDeleted: true });

    // Next day: still pending, rate moved → must not duplicate
    vi.restoreAllMocks(); __resetFxCache();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ json: async () => ({ rates: { USD: 0.26 } }) });
    const again = await parse([maxTxn({ chargedAmount: 0, chargedCurrency: 'ILS', status: 'pending', processedDate: '2026-10-11T00:00:00.000Z' })], userId);
    expect((await persistTransactions({ userId, transactions: again, includeDeleted: true })).inserted).toBe(0);

    const completed = await parse([maxTxn({ chargedAmount: -186.4, chargedCurrency: 'ILS', status: 'completed', processedDate: '2026-11-02T00:00:00.000Z' })], userId);
    expect((await persistTransactions({ userId, transactions: completed, includeDeleted: true })).inserted).toBe(1);

    const live = await Transaction.find({ user: userId }).lean();
    expect(live).toHaveLength(1);
    expect(live[0].amount).toBe(186.4);
    expect(live[0].status).toBe('completed');
  });
});
