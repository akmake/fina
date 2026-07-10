// server/controllers/budgetController.js
import Budget from '../models/Budget.js';
import { scopeFilter } from '../utils/scopeFilter.js';
import { audit } from '../utils/audit.js';
import { computeSpending, checkBudgetThresholds, rolloverToMonth } from '../services/budgetCycleService.js';

// חישוב הוצאות בפועל — מקור אמת יחיד ב-budgetCycleService (§5.4)
const calculateActualSpending = computeSpending;

// ──────────────────────────────────────────────────
// @desc   קבלת תקציב לחודש מסוים
// @route  GET /api/budgets?month=&year=
// ──────────────────────────────────────────────────
export const getBudget = async (req, res) => {
  try {
    const { month, year } = req.query;
    const m = parseInt(month) || new Date().getMonth() + 1;
    const y = parseInt(year) || new Date().getFullYear();

    let budget = await Budget.findOne({ ...scopeFilter(req), month: m, year: y });

    if (!budget) {
      return res.json({ budget: null, spending: {}, exists: false });
    }

    // חישוב הוצאות בפועל
    const spending = await calculateActualSpending(scopeFilter(req), m, y);

    // עדכון הוצאות בפריטי התקציב
    let totalSpent = 0;
    budget.items = budget.items.map(item => {
      const spent = spending[item.category] || 0;
      item.spent = spent;
      totalSpent += spent;
      return item;
    });

    // הוסף קטגוריות שיש בהן הוצאות אבל לא בתקציב
    const budgetCategories = new Set(budget.items.map(i => i.category));
    const uncategorizedSpending = {};
    for (const [cat, amount] of Object.entries(spending)) {
      if (!budgetCategories.has(cat)) {
        uncategorizedSpending[cat] = amount;
        totalSpent += amount;
      }
    }

    budget.totalSpent = totalSpent;
    await budget.save();

    res.json({ 
      budget, 
      spending, 
      uncategorizedSpending,
      exists: true 
    });
  } catch (error) {
    console.error('Error getting budget:', error);
    res.status(500).json({ message: 'שגיאה בטעינת התקציב' });
  }
};

// ──────────────────────────────────────────────────
// @desc   יצירת/עדכון תקציב חודשי
// @route  POST /api/budgets
// ──────────────────────────────────────────────────
export const upsertBudget = async (req, res) => {
  try {
    const { month, year, totalLimit, items, alertThreshold, notes } = req.body;

    if (!month || !year || !totalLimit) {
      return res.status(400).json({ message: 'חודש, שנה ותקציב כולל הם שדות חובה' });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'יש להוסיף לפחות קטגוריה אחת לתקציב' });
    }

    const budgetData = {
      user: req.user._id,
      month: parseInt(month),
      year: parseInt(year),
      totalLimit: Number(totalLimit),
      items: items.map(item => ({
        category: item.category,
        limit: Number(item.limit),
        color: item.color || '#3b82f6',
      })),
      alertThreshold: alertThreshold || 80,
      notes: notes || '',
    };

    const budget = await Budget.findOneAndUpdate(
      { user: req.user._id, month: budgetData.month, year: budgetData.year },
      budgetData,
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.status(201).json(budget);
  } catch (error) {
    console.error('Error upserting budget:', error);
    res.status(500).json({ message: 'שגיאה בשמירת התקציב' });
  }
};

// ──────────────────────────────────────────────────
// @desc   מחיקת תקציב
// @route  DELETE /api/budgets/:id
// ──────────────────────────────────────────────────
export const deleteBudget = async (req, res) => {
  try {
    const budget = await Budget.softDeleteOne({ _id: req.params.id, user: req.user._id });
    if (!budget) return res.status(404).json({ message: 'תקציב לא נמצא' });
    await audit(req, 'budget.delete', 'Budget', {
      entityId: budget._id,
      before: { month: budget.month, year: budget.year, totalLimit: budget.totalLimit },
    });
    res.json({ message: 'התקציב נמחק בהצלחה' });
  } catch (error) {
    console.error('Error deleting budget:', error);
    res.status(500).json({ message: 'שגיאה במחיקת התקציב' });
  }
};

// ──────────────────────────────────────────────────
// @desc   העתקת תקציב מחודש קודם
// @route  POST /api/budgets/copy
// ──────────────────────────────────────────────────
export const copyBudget = async (req, res) => {
  try {
    const { fromMonth, fromYear, toMonth, toYear } = req.body;

    const source = await Budget.findOne({
      ...scopeFilter(req),
      month: parseInt(fromMonth),
      year: parseInt(fromYear)
    });

    if (!source) {
      return res.status(404).json({ message: 'תקציב מקור לא נמצא' });
    }

    // בדוק שלא קיים תקציב ביעד
    const existing = await Budget.findOne({
      ...scopeFilter(req),
      month: parseInt(toMonth),
      year: parseInt(toYear)
    });

    if (existing) {
      return res.status(409).json({ message: 'כבר קיים תקציב לחודש היעד' });
    }

    const newBudget = await Budget.create({
      user: req.user._id,
      month: parseInt(toMonth),
      year: parseInt(toYear),
      totalLimit: source.totalLimit,
      items: source.items.map(item => ({
        category: item.category,
        limit: item.limit,
        color: item.color,
      })),
      alertThreshold: source.alertThreshold,
    });

    res.status(201).json(newBudget);
  } catch (error) {
    console.error('Error copying budget:', error);
    res.status(500).json({ message: 'שגיאה בהעתקת התקציב' });
  }
};

// ──────────────────────────────────────────────────
// @desc   סיכום תקציבים – שנתי
// @route  GET /api/budgets/summary?year=
// ──────────────────────────────────────────────────
export const getBudgetSummary = async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();

    const budgets = await Budget.find({ ...scopeFilter(req), year }).sort({ month: 1 });

    // חישוב הוצאות לכל חודש
    const monthlySummary = [];
    for (const budget of budgets) {
      const spending = await calculateActualSpending(scopeFilter(req), budget.month, year);
      const totalSpent = Object.values(spending).reduce((sum, v) => sum + v, 0);

      monthlySummary.push({
        month: budget.month,
        totalLimit: budget.totalLimit,
        totalSpent,
        percentUsed: budget.totalLimit > 0 ? Math.round((totalSpent / budget.totalLimit) * 100) : 0,
        remaining: budget.totalLimit - totalSpent,
        isOverBudget: totalSpent > budget.totalLimit,
        categoriesOverBudget: budget.items
          .filter(item => (spending[item.category] || 0) > item.limit)
          .map(item => item.category),
      });
    }

    const yearTotal = {
      totalLimit: monthlySummary.reduce((s, m) => s + m.totalLimit, 0),
      totalSpent: monthlySummary.reduce((s, m) => s + m.totalSpent, 0),
      monthsOverBudget: monthlySummary.filter(m => m.isOverBudget).length,
      monthsTracked: monthlySummary.length,
    };

    res.json({ monthlySummary, yearTotal });
  } catch (error) {
    console.error('Error getting budget summary:', error);
    res.status(500).json({ message: 'שגיאה בחישוב סיכום שנתי' });
  }
};

// ──────────────────────────────────────────────────
// @desc   גלגול תקציב לחודש הבא (עם carry-over אופציונלי של יתרות)
// @route  POST /api/budgets/rollover
// body: { fromMonth?, fromYear?, toMonth?, toYear?, carryOver? }
// ──────────────────────────────────────────────────
export const rolloverBudget = async (req, res) => {
  try {
    const now = new Date();
    const toMonth = parseInt(req.body.toMonth) || now.getMonth() + 1;
    const toYear = parseInt(req.body.toYear) || now.getFullYear();

    // ברירת מחדל: לגלגל מהחודש שקדם לחודש היעד
    const prev = new Date(toYear, toMonth - 2, 1);
    const fromMonth = parseInt(req.body.fromMonth) || prev.getMonth() + 1;
    const fromYear = parseInt(req.body.fromYear) || prev.getFullYear();

    const { rolled, budget } = await rolloverToMonth({
      ownerUserId: req.user._id,
      filter: scopeFilter(req),
      fromMonth, fromYear, toMonth, toYear,
      carryOver: !!req.body.carryOver,
    });

    if (!budget) return res.status(404).json({ message: 'אין תקציב מקור לגלגול' });
    return res.status(rolled ? 201 : 200).json({ rolled, budget });
  } catch (error) {
    console.error('Error rolling over budget:', error);
    res.status(500).json({ message: 'שגיאה בגלגול התקציב' });
  }
};

// ──────────────────────────────────────────────────
// @desc   בדיקת ספי תקציב (75/90/100) והפקת התראות
// @route  POST /api/budgets/check-thresholds?month=&year=
// ──────────────────────────────────────────────────
export const checkThresholds = async (req, res) => {
  try {
    const result = await checkBudgetThresholds({
      filter: scopeFilter(req),
      ownerId: req.user._id,
      month: parseInt(req.query.month) || undefined,
      year: parseInt(req.query.year) || undefined,
    });
    res.json(result);
  } catch (error) {
    console.error('Error checking budget thresholds:', error);
    res.status(500).json({ message: 'שגיאה בבדיקת ספי התקציב' });
  }
};
