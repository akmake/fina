import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import Transaction from '../models/Transaction.js';
import { repairForeignTransactions } from '../services/foreignRepair.js';

const base = (user, over) => ({
  user, date: new Date('2026-09-10'), description: 'AMAZON.COM', rawDescription: 'AMAZON.COM',
  type: 'הוצאה', source: 'max', originalCurrency: 'USD', originalAmount: -50, ...over,
});

describe('סקריפט תיקון עסקאות מט"ח', () => {
  it('dry run לא כותב; apply מסיר כפילות ממתינה ומתקן סכום שנשמר במטבע המקורי', async () => {
    const user = new mongoose.Types.ObjectId();
    await Transaction.create([
      // pending copy + its completed version (duplicate)
      base(user, { amount: 50, status: 'pending', identifier: 'arn-1', processedDate: new Date('2026-09-10') }),
      base(user, { amount: 186.4, status: 'completed', identifier: 'arn-1', processedDate: new Date('2026-10-02') }),
      // USD-billed: 30 USD stored as 30 ₪
      base(user, { description: 'NETFLIX', rawDescription: 'NETFLIX', originalAmount: -30, amount: 30, status: 'completed', identifier: 'arn-2', processedDate: new Date('2026-10-02') }),
    ]);
    const rateFor = async () => 3.75;
    const since = new Date('2026-01-01');

    const dry = await repairForeignTransactions({ since, rateFor });
    expect(dry).toMatchObject({ duplicatesRemoved: 1, amountsFixed: 1 });
    expect(await Transaction.countDocuments({ user })).toBe(3);

    await repairForeignTransactions({ since, rateFor, apply: true });
    const live = await Transaction.find({ user }).sort({ description: 1 }).lean();
    expect(live).toHaveLength(2);
    expect(live.find((t) => t.description === 'AMAZON.COM').amount).toBe(186.4);
    const netflix = live.find((t) => t.description === 'NETFLIX');
    expect(netflix.amount).toBe(112.5);
    expect(netflix.amountEstimated).toBe(true);

    // idempotent
    expect(await repairForeignTransactions({ since, rateFor, apply: true })).toMatchObject({ duplicatesRemoved: 0, amountsFixed: 0 });
  });
});
