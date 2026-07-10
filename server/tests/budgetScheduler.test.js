import { describe, it, expect, beforeEach } from 'vitest';
import User from '../models/User.js';
import Budget from '../models/Budget.js';
import Transaction from '../models/Transaction.js';
import Alert from '../models/Alert.js';
import Household from '../models/Household.js';
import HouseholdMember from '../models/HouseholdMember.js';
import { tick } from '../services/budgetScheduler.js';

const makeUser = (email) => User.create({ name: 'מתזמן', email, passwordHash: 'x'.repeat(60) });

describe('תזמון בדיקות ספי תקציב (budgetScheduler) — שלב 3', () => {
  beforeEach(async () => {
    await Promise.all([
      Budget.deleteMany({}), Transaction.deleteMany({}), Alert.deleteMany({}),
      Household.deleteMany({}), HouseholdMember.deleteMany({}), User.deleteMany({}),
    ]);
  });

  it('tick מפיק התראת חריגה לתקציב החודש הנוכחי — ללא בקשת HTTP', async () => {
    const user = await makeUser('sched-1@test.com');
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    await Budget.create({ user: user._id, month, year, totalLimit: 1000, items: [{ category: 'מזון', limit: 500 }] });
    // 104% מ-500 בקטגוריית מזון בחודש הנוכחי
    await Transaction.create({ user: user._id, date: new Date(year, month - 1, 2), description: 'סופר', amount: 520, type: 'הוצאה', category: 'מזון' });

    const raised = await tick();
    expect(raised).toBeGreaterThanOrEqual(1);
    expect(await Alert.findOne({ user: user._id, type: 'budget_exceeded' })).toBeTruthy();
  });

  it('tick שני לא מכפיל התראה לאותו סף (dedup דרך notificationService)', async () => {
    const user = await makeUser('sched-2@test.com');
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    await Budget.create({ user: user._id, month, year, totalLimit: 1000, items: [{ category: 'רכב', limit: 100 }] });
    await Transaction.create({ user: user._id, date: new Date(year, month - 1, 3), description: 'דלק', amount: 120, type: 'הוצאה', category: 'רכב' });

    await tick();
    await tick();
    const carAlerts = await Alert.find({ user: user._id, dedupeKey: /^budget:רכב:100:/ });
    expect(carAlerts.length).toBe(1);
  });

  it('tick לא מפיק כלום כשאין תקציב לחודש הנוכחי', async () => {
    const user = await makeUser('sched-3@test.com');
    // תקציב לחודש/שנה שאינם הנוכחיים
    await Budget.create({ user: user._id, month: 1, year: 2020, totalLimit: 1000, items: [{ category: 'מזון', limit: 500 }] });
    const raised = await tick();
    expect(raised).toBe(0);
  });
});
