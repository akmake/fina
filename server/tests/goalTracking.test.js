import { describe, it, expect, beforeEach } from 'vitest';
import User from '../models/User.js';
import Goal from '../models/Goal.js';
import Transaction from '../models/Transaction.js';
import Deposit from '../models/Deposit.js';
import { recomputeGoal, recomputeAllGoals } from '../services/goalTrackingService.js';

const makeUser = (email) => User.create({ name: 'בודק', email, passwordHash: 'x'.repeat(60) });
const filterFor = (user) => ({ user: user._id });

describe('יעדים מחוברים (goalTrackingService) — שלב 3', () => {
  beforeEach(async () => {
    await Promise.all([Goal.deleteMany({}), Transaction.deleteMany({}), Deposit.deleteMany({})]);
  });

  it('מצב category: currentAmount = סכום תנועות בקטגוריה מאז startDate', async () => {
    const user = await makeUser('gt-1@test.com');
    const goal = await Goal.create({
      user: user._id, name: 'חיסכון לרכב', category: 'car', targetAmount: 10000,
      trackingMode: 'category', linkedCategory: 'חיסכון רכב', startDate: new Date(2026, 0, 1),
    });
    await Transaction.create([
      { user: user._id, date: new Date(2026, 1, 1), description: 'הפקדה', amount: 3000, type: 'הכנסה', category: 'חיסכון רכב' },
      { user: user._id, date: new Date(2026, 2, 1), description: 'הפקדה', amount: 2000, type: 'הכנסה', category: 'חיסכון רכב' },
      { user: user._id, date: new Date(2025, 11, 1), description: 'לפני התחלה', amount: 999, type: 'הכנסה', category: 'חיסכון רכב' },
    ]);

    const { goal: updated, changed } = await recomputeGoal(goal, filterFor(user));
    expect(changed).toBe(true);
    expect(updated.currentAmount).toBe(5000); // 3000+2000, לא כולל לפני startDate
    expect(updated.lastTrackedAt).toBeTruthy();
  });

  it('מצב account (deposit): currentAmount = יתרת הפיקדון', async () => {
    const user = await makeUser('gt-2@test.com');
    const dep = await Deposit.create({
      user: user._id, name: 'פיקדון', principal: 7500, annualInterestRate: 3,
      startDate: new Date(2026, 0, 1), endDate: new Date(2027, 0, 1),
    });
    const goal = await Goal.create({
      user: user._id, name: 'קרן חירום', category: 'emergency_fund', targetAmount: 20000,
      trackingMode: 'account', linkedAccountType: 'deposit', linkedAccountId: dep._id,
    });

    const { goal: updated } = await recomputeGoal(goal, filterFor(user));
    expect(updated.currentAmount).toBe(7500);
  });

  it('הגעה ליעד מסמנת completed', async () => {
    const user = await makeUser('gt-3@test.com');
    const goal = await Goal.create({
      user: user._id, name: 'קטן', category: 'other', targetAmount: 1000,
      trackingMode: 'category', linkedCategory: 'חיסכון', startDate: new Date(2026, 0, 1),
    });
    await Transaction.create({ user: user._id, date: new Date(2026, 1, 1), description: 'x', amount: 1200, type: 'הכנסה', category: 'חיסכון' });

    const { goal: updated } = await recomputeGoal(goal, filterFor(user));
    expect(updated.currentAmount).toBe(1200);
    expect(updated.status).toBe('completed');
  });

  it('יעד manual לא משתנה', async () => {
    const user = await makeUser('gt-4@test.com');
    const goal = await Goal.create({ user: user._id, name: 'ידני', category: 'other', targetAmount: 5000, currentAmount: 1234, trackingMode: 'manual' });
    const { changed, goal: updated } = await recomputeGoal(goal, filterFor(user));
    expect(changed).toBe(false);
    expect(updated.currentAmount).toBe(1234);
  });

  it('recomputeAllGoals מרענן רק יעדים מחוברים פעילים', async () => {
    const user = await makeUser('gt-5@test.com');
    await Goal.create({ user: user._id, name: 'a', category: 'other', targetAmount: 100000, trackingMode: 'category', linkedCategory: 'חיסכון', startDate: new Date(2026, 0, 1) });
    await Goal.create({ user: user._id, name: 'b', category: 'other', targetAmount: 100000, trackingMode: 'manual', currentAmount: 50 });
    await Transaction.create({ user: user._id, date: new Date(2026, 1, 1), description: 'x', amount: 400, type: 'הכנסה', category: 'חיסכון' });

    const result = await recomputeAllGoals(filterFor(user));
    expect(result.recomputed).toBe(1); // רק המחובר
    expect(result.changed).toBe(1);
  });

  it('projectedDate virtual נגזר מקצב ההפקדה', async () => {
    const user = await makeUser('gt-6@test.com');
    const goal = await Goal.create({ user: user._id, name: 'תחזית', category: 'other', targetAmount: 12000, currentAmount: 0, monthlyContribution: 1000 });
    expect(goal.projectedDate).toBeInstanceOf(Date); // ~12 חודשים קדימה
  });
});
