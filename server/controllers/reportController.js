// server/controllers/reportController.js
import Transaction from '../models/Transaction.js';
import Budget from '../models/Budget.js';
import RecurringTransaction from '../models/RecurringTransaction.js';
import Loan from '../models/Loan.js';
import Deposit from '../models/Deposit.js';
import Stock from '../models/Stock.js';
import Fund from '../models/Fund.js';
import Pension from '../models/Pension.js';
import FinanceProfile from '../models/FinanceProfile.js';
import Insurance from '../models/Insurance.js';
import Goal from '../models/Goal.js';
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns';

// GET /api/reports/yearly-comparison
export const yearlyComparison = async (req, res) => {
  try {
    const userId = req.user._id;
    const currentYear = new Date().getFullYear();
    const years = [currentYear, currentYear - 1];

    const results = {};
    for (const year of years) {
      const startDate = new Date(year, 0, 1);
      const endDate = new Date(year, 11, 31, 23, 59, 59);

      const transactions = await Transaction.find({
        user: userId,
        date: { $gte: startDate, $lte: endDate },
      });

      const income = transactions.filter(t => t.type === 'הכנסה').reduce((s, t) => s + t.amount, 0);
      const expense = transactions.filter(t => t.type === 'הוצאה').reduce((s, t) => s + t.amount, 0);

      // פירוט לפי חודש
      const monthly = {};
      for (let m = 0; m < 12; m++) {
        const month = m + 1;
        const monthTx = transactions.filter(t => new Date(t.date).getMonth() === m);
        monthly[month] = {
          income: monthTx.filter(t => t.type === 'הכנסה').reduce((s, t) => s + t.amount, 0),
          expense: monthTx.filter(t => t.type === 'הוצאה').reduce((s, t) => s + t.amount, 0),
        };
        monthly[month].net = monthly[month].income - monthly[month].expense;
      }

      // פירוט לפי קטגוריה
      const byCategory = {};
      for (const t of transactions.filter(t => t.type === 'הוצאה')) {
        const cat = t.category || 'ללא קטגוריה';
        byCategory[cat] = (byCategory[cat] || 0) + t.amount;
      }

      results[year] = {
        totalIncome: income,
        totalExpense: expense,
        totalNet: income - expense,
        savingsRate: income > 0 ? ((income - expense) / income * 100) : 0,
        monthly,
        byCategory: Object.entries(byCategory)
          .sort((a, b) => b[1] - a[1])
          .map(([category, amount]) => ({ category, amount })),
        transactionCount: transactions.length,
      };
    }

    // השוואות
    const comparison = {};
    if (results[currentYear] && results[currentYear - 1]) {
      const cur = results[currentYear];
      const prev = results[currentYear - 1];
      comparison.incomeChange = prev.totalIncome > 0
        ? ((cur.totalIncome - prev.totalIncome) / prev.totalIncome * 100) : 0;
      comparison.expenseChange = prev.totalExpense > 0
        ? ((cur.totalExpense - prev.totalExpense) / prev.totalExpense * 100) : 0;
      comparison.savingsRateChange = cur.savingsRate - prev.savingsRate;
    }

    res.json({ years: results, comparison });
  } catch (error) {
    console.error('Error in yearly comparison:', error);
    res.status(500).json({ message: 'שגיאה בהשוואה שנתית' });
  }
};

// GET /api/reports/trends
export const getCategoryTrends = async (req, res) => {
  try {
    const userId = req.user._id;
    const months = parseInt(req.query.months) || 6;
    const now = new Date();

    const trends = [];
    for (let i = months - 1; i >= 0; i--) {
      const monthDate = subMonths(now, i);
      const start = startOfMonth(monthDate);
      const end = endOfMonth(monthDate);

      const transactions = await Transaction.find({
        user: userId,
        date: { $gte: start, $lte: end },
        type: 'הוצאה',
      });

      const byCategory = {};
      for (const t of transactions) {
        const cat = t.category || 'אחר';
        byCategory[cat] = (byCategory[cat] || 0) + t.amount;
      }

      trends.push({
        month: format(monthDate, 'MM/yyyy'),
        label: format(monthDate, 'MMM yyyy'),
        monthNum: monthDate.getMonth() + 1,
        year: monthDate.getFullYear(),
        total: transactions.reduce((s, t) => s + t.amount, 0),
        categories: byCategory,
      });
    }

    // חישוב ממוצע לקטגוריה
    const allCategories = new Set();
    trends.forEach(m => Object.keys(m.categories).forEach(c => allCategories.add(c)));

    const categoryAverages = {};
    for (const cat of allCategories) {
      const values = trends.map(m => m.categories[cat] || 0);
      categoryAverages[cat] = {
        average: values.reduce((s, v) => s + v, 0) / months,
        current: values[values.length - 1] || 0,
        min: Math.min(...values),
        max: Math.max(...values),
      };
      // השוואה לממוצע
      const avg = categoryAverages[cat].average;
      const cur = categoryAverages[cat].current;
      categoryAverages[cat].vsAverage = avg > 0 ? ((cur - avg) / avg * 100) : 0;
    }

    res.json({ trends, categoryAverages, months });
  } catch (error) {
    console.error('Error in trends:', error);
    res.status(500).json({ message: 'שגיאה בטרנדים' });
  }
};

// GET /api/reports/financial-summary — סיכום פיננסי כולל
export const getFinancialSummary = async (req, res) => {
  try {
    const userId = req.user._id;

    const [profile, deposits, stocks, funds, loans, pensions, recurring, goals, insurances] = await Promise.all([
      FinanceProfile.findOne({ user: userId }),
      Deposit.find({ user: userId, status: 'active' }),
      Stock.find({ user: userId }),
      Fund.find({ user: userId }),
      Loan.find({ user: userId }),
      Pension.find({ user: userId, status: 'active' }),
      RecurringTransaction.find({ user: userId, isActive: true }),
      Goal.find({ user: userId, status: 'active' }),
      Insurance.find({ user: userId, status: 'active' }),
    ]);

    // הכנסות חודשיות
    const monthlyIncome = recurring
      .filter(r => r.type === 'הכנסה')
      .reduce((s, r) => s + (r.monthlyCost || 0), 0);

    // הוצאות קבועות
    const monthlyFixedExpenses = recurring
      .filter(r => r.type === 'הוצאה')
      .reduce((s, r) => s + (r.monthlyCost || 0), 0);

    // ביטוח שנתי
    const annualInsuranceCost = insurances.reduce((s, i) => s + (i.annualCost || 0), 0);

    // נכסים
    const totalAssets = (profile?.checking || 0) + (profile?.cash || 0) +
      deposits.reduce((s, d) => s + (d.futureValue || d.principal), 0) +
      stocks.reduce((s, s2) => s + (s2.currentValueILS || 0), 0) +
      funds.reduce((s, f) => s + (f.current_value || 0), 0) +
      pensions.reduce((s, p) => s + (p.currentBalance || 0), 0);

    // התחייבויות
    const totalLiabilities = loans.reduce((s, l) => s + l.principal, 0);

    res.json({
      monthlyIncome,
      monthlyFixedExpenses,
      monthlyDisposable: monthlyIncome - monthlyFixedExpenses,
      annualInsuranceCost,
      totalAssets,
      totalLiabilities,
      netWorth: totalAssets - totalLiabilities,
      activeGoals: goals.length,
      goalsProgress: goals.length > 0
        ? goals.reduce((s, g) => s + g.progressPercent, 0) / goals.length : 0,
      pensionMonthlyContribution: pensions.reduce((s, p) =>
        s + (p.monthlyEmployeeContribution || 0) + (p.monthlyEmployerContribution || 0), 0),
    });
  } catch (error) {
    console.error('Error in financial summary:', error);
    res.status(500).json({ message: 'שגיאה בסיכום פיננסי' });
  }
};
