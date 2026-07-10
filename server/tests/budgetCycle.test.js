import { describe, it, expect, beforeEach } from 'vitest';
import User from '../models/User.js';
import Budget from '../models/Budget.js';
import Transaction from '../models/Transaction.js';
import Alert from '../models/Alert.js';
import { checkBudgetThresholds, rolloverToMonth, computeSpending } from '../services/budgetCycleService.js';

const makeUser = (email) => User.create({ name: 'בודק', email, passwordHash: 'x'.repeat(60) });
const filterFor = (user) => ({ user: user._id });

describe('מחזור תקציב חודשי (budgetCycleService) — שלב 3', () => {
  beforeEach(async () => {
    await Promise.all([Budget.deleteMany({}), Transaction.deleteMany({}), Alert.deleteMany({})]);
  });

  it('computeSpending מסכם הוצאות לפי קטגוריה בחודש', async () => {
    const user = await makeUser('bc-1@test.com');
    await Transaction.create([
      { user: user._id, date: new Date(2026, 6, 3), description: 'סופר', amount: 400, type: 'הוצאה', category: 'מזון' },
      { user: user._id, date: new Date(2026, 6, 10), description: 'סופר2', amount: 200, type: 'הוצאה', category: 'מזון' },
      { user: user._id, date: new Date(2026, 6, 5), description: 'משכורת', amount: 9000, type: 'הכנסה', category: 'הכנסה' },
    ]);
    const spending = await computeSpending(filterFor(user), 7, 2026);
    expect(spending['מזון']).toBe(600);
    expect(spending['הכנסה']).toBeUndefined(); // הכנסות לא נספרות
  });

  it('חציית 90% מפיקה אזהרה; חציית 100% מפיקה חריגה', async () => {
    const user = await makeUser('bc-2@test.com');
    await Budget.create({
      user: user._id, month: 7, year: 2026, totalLimit: 1000,
      items: [{ category: 'מזון', limit: 500 }],
    });
    // 92% מ-500
    await Transaction.create({ user: user._id, date: new Date(2026, 6, 4), description: 'x', amount: 460, type: 'הוצאה', category: 'מזון' });

    const r1 = await checkBudgetThresholds({ filter: filterFor(user), ownerId: user._id, month: 7, year: 2026 });
    expect(r1.raised).toBeGreaterThanOrEqual(1);
    const warn = await Alert.findOne({ user: user._id, type: 'budget_warning' });
    expect(warn).toBeTruthy();

    // עכשיו חורגים מעל 100% → התראת חריגה חדשה
    await Transaction.create({ user: user._id, date: new Date(2026, 6, 6), description: 'y', amount: 100, type: 'הוצאה', category: 'מזון' });
    const r2 = await checkBudgetThresholds({ filter: filterFor(user), ownerId: user._id, month: 7, year: 2026 });
    expect(r2.raised).toBeGreaterThanOrEqual(1);
    expect(await Alert.findOne({ user: user._id, type: 'budget_exceeded' })).toBeTruthy();
  });

  it('בדיקה חוזרת באותו סף לא מכפילה התראה', async () => {
    const user = await makeUser('bc-3@test.com');
    await Budget.create({ user: user._id, month: 7, year: 2026, totalLimit: 1000, items: [{ category: 'רכב', limit: 100 }] });
    await Transaction.create({ user: user._id, date: new Date(2026, 6, 4), description: 'דלק', amount: 80, type: 'הוצאה', category: 'רכב' });

    await checkBudgetThresholds({ filter: filterFor(user), ownerId: user._id, month: 7, year: 2026 });
    await checkBudgetThresholds({ filter: filterFor(user), ownerId: user._id, month: 7, year: 2026 });
    // 80% → סף 75 בלבד, פעם אחת (הקטגוריה); ייתכן גם total. נוודא שאין כפילות לאותה קטגוריה+סף
    const carAlerts = await Alert.find({ user: user._id, dedupeKey: /^budget:רכב:75:/ });
    expect(carAlerts.length).toBe(1);
  });

  it('rollover מעתיק גבולות; carryOver מוסיף יתרה שלא נוצלה', async () => {
    const user = await makeUser('bc-4@test.com');
    await Budget.create({ user: user._id, month: 6, year: 2026, totalLimit: 1000, items: [{ category: 'מזון', limit: 500 }, { category: 'בילוי', limit: 500 }] });
    // ניצול חלקי: מזון 300 (נשאר 200), בילוי 500 (נשאר 0)
    await Transaction.create([
      { user: user._id, date: new Date(2026, 5, 4), description: 'a', amount: 300, type: 'הוצאה', category: 'מזון' },
      { user: user._id, date: new Date(2026, 5, 4), description: 'b', amount: 500, type: 'הוצאה', category: 'בילוי' },
    ]);

    const { rolled, budget } = await rolloverToMonth({
      ownerUserId: user._id, filter: filterFor(user),
      fromMonth: 6, fromYear: 2026, toMonth: 7, toYear: 2026, carryOver: true,
    });
    expect(rolled).toBe(true);
    const food = budget.items.find((i) => i.category === 'מזון');
    const fun = budget.items.find((i) => i.category === 'בילוי');
    expect(food.limit).toBe(700); // 500 + 200 יתרה
    expect(fun.limit).toBe(500);  // 500 + 0
  });

  it('rollover לא דורס תקציב יעד קיים', async () => {
    const user = await makeUser('bc-5@test.com');
    await Budget.create({ user: user._id, month: 6, year: 2026, totalLimit: 1000, items: [{ category: 'מזון', limit: 500 }] });
    await Budget.create({ user: user._id, month: 7, year: 2026, totalLimit: 2000, items: [{ category: 'מזון', limit: 999 }] });

    const { rolled, budget } = await rolloverToMonth({
      ownerUserId: user._id, filter: filterFor(user),
      fromMonth: 6, fromYear: 2026, toMonth: 7, toYear: 2026, carryOver: false,
    });
    expect(rolled).toBe(false);
    expect(budget.totalLimit).toBe(2000); // הקיים נשמר
  });
});
