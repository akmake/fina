// server/controllers/netWorthController.js
import FinanceProfile from '../models/FinanceProfile.js';
import Deposit from '../models/Deposit.js';
import Stock from '../models/Stock.js';
import Fund from '../models/Fund.js';
import Loan from '../models/Loan.js';
import Pension from '../models/Pension.js';
import Transaction from '../models/Transaction.js';
import Budget from '../models/Budget.js';
import RecurringTransaction from '../models/RecurringTransaction.js';
import RealEstate from '../models/RealEstate.js';
import Mortgage from '../models/Mortgage.js';
import ForeignCurrency from '../models/ForeignCurrency.js';
import ChildSavings from '../models/ChildSavings.js';
import Insurance from '../models/Insurance.js';
import Goal from '../models/Goal.js';
import { startOfMonth, endOfMonth, subMonths } from 'date-fns';

// ──────────────────────────────────────────────────
// @desc   חישוב שווי נקי מפורט — כולל כל המודולים
// @route  GET /api/net-worth
// ──────────────────────────────────────────────────
export const getNetWorth = async (req, res) => {
  try {
    const userId = req.user._id;

    const [profile, deposits, stocks, funds, loans, pensions, properties, mortgages, foreignCurrency, childSavings] = await Promise.all([
      FinanceProfile.findOne({ user: userId }),
      Deposit.find({ user: userId, status: 'active' }),
      Stock.find({ user: userId }),
      Fund.find({ user: userId }),
      Loan.find({ user: userId }),
      Pension.find({ user: userId, status: 'active' }),
      RealEstate.find({ user: userId, status: 'owned' }),
      Mortgage.find({ user: userId, status: 'active' }),
      ForeignCurrency.find({ user: userId, status: 'active' }),
      ChildSavings.find({ user: userId, status: 'active' }),
    ]);

    // ── נכסים (Assets) ──────────────────
    const assets = {
      // חשבונות
      checking: profile?.checking || 0,
      cash: profile?.cash || 0,

      // פיקדונות
      deposits: deposits.reduce((sum, d) => sum + (d.futureValue || d.principal), 0),
      depositsCount: deposits.length,

      // מניות
      stocks: stocks.reduce((sum, s) => sum + (s.currentValueILS || s.investedAmount * 3.7), 0),
      stocksCount: stocks.length,

      // קרנות נאמנות
      funds: funds.reduce((sum, f) => sum + (f.current_value || f.invested_amount), 0),
      fundsCount: funds.length,

      // חסכון פנסיוני
      pension: pensions.reduce((sum, p) => sum + (p.currentBalance || 0), 0),
      pensionCount: pensions.length,

      // נדל"ן
      realEstate: properties.reduce((sum, p) => sum + (p.currentEstimatedValue || 0), 0),
      realEstateCount: properties.length,

      // מט"ח
      foreignCurrency: foreignCurrency.reduce((sum, f) => sum + (f.amountInILS || 0), 0),
      foreignCurrencyCount: foreignCurrency.length,

      // חיסכון ילדים
      childSavings: childSavings.reduce((sum, c) => sum + (c.currentBalance || 0), 0),
      childSavingsCount: childSavings.length,
    };

    assets.totalLiquid = assets.checking + assets.cash + assets.foreignCurrency;
    assets.totalInvestments = assets.stocks + assets.funds;
    assets.totalSavings = assets.deposits + assets.pension + assets.childSavings;
    assets.totalRealEstate = assets.realEstate;
    assets.total = assets.totalLiquid + assets.totalInvestments + assets.totalSavings + assets.totalRealEstate;

    // ── התחייבויות (Liabilities) ──────────
    const liabilities = {
      loans: loans.reduce((sum, l) => sum + (l.principal || 0), 0),
      loansCount: loans.length,
      // משכנתאות
      mortgages: mortgages.reduce((sum, m) => sum + (m.totalCurrentBalance || 0), 0),
      mortgagesCount: mortgages.length,
      // מסגרת אשראי שלילית (overdraft)
      overdraft: Math.abs(Math.min(0, assets.checking)),
    };
    liabilities.total = liabilities.loans + liabilities.mortgages + liabilities.overdraft;

    // ── שווי נקי ──────────────────────────
    const netWorth = assets.total - liabilities.total;

    // ── התפלגות נכסים ────────────────────
    const assetBreakdown = [];
    if (assets.checking > 0) assetBreakdown.push({ label: 'עו"ש', value: assets.checking, color: '#3b82f6' });
    if (assets.cash > 0) assetBreakdown.push({ label: 'מזומן', value: assets.cash, color: '#10b981' });
    if (assets.deposits > 0) assetBreakdown.push({ label: 'פיקדונות', value: assets.deposits, color: '#f59e0b' });
    if (assets.stocks > 0) assetBreakdown.push({ label: 'מניות', value: assets.stocks, color: '#8b5cf6' });
    if (assets.funds > 0) assetBreakdown.push({ label: 'קרנות', value: assets.funds, color: '#ec4899' });
    if (assets.pension > 0) assetBreakdown.push({ label: 'פנסיוני', value: assets.pension, color: '#06b6d4' });
    if (assets.realEstate > 0) assetBreakdown.push({ label: 'נדל"ן', value: assets.realEstate, color: '#f97316' });
    if (assets.foreignCurrency > 0) assetBreakdown.push({ label: 'מט"ח', value: assets.foreignCurrency, color: '#14b8a6' });
    if (assets.childSavings > 0) assetBreakdown.push({ label: 'חיסכון ילדים', value: assets.childSavings, color: '#a855f7' });

    // ── התפלגות התחייבויות ────────────────
    const liabilityBreakdown = [];
    if (liabilities.mortgages > 0) liabilityBreakdown.push({ label: 'משכנתא', value: liabilities.mortgages, color: '#ef4444' });
    if (liabilities.loans > 0) liabilityBreakdown.push({ label: 'הלוואות', value: liabilities.loans, color: '#f97316' });
    if (liabilities.overdraft > 0) liabilityBreakdown.push({ label: 'מינוס', value: liabilities.overdraft, color: '#dc2626' });

    res.json({
      netWorth,
      assets,
      liabilities,
      assetBreakdown,
      liabilityBreakdown,
    });
  } catch (error) {
    console.error('Error calculating net worth:', error);
    res.status(500).json({ message: 'שגיאה בחישוב שווי נקי' });
  }
};

// ──────────────────────────────────────────────────
// @desc   ציון בריאות פיננסית
// @route  GET /api/net-worth/health-score
// ──────────────────────────────────────────────────
export const getFinancialHealthScore = async (req, res) => {
  try {
    const userId = req.user._id;
    const today = new Date();
    const thisMonth = today.getMonth() + 1;
    const thisYear = today.getFullYear();

    const [profile, deposits, stocks, funds, loans, pensions, budget, recurring, recentTransactions, insurances, goals, mortgages] = await Promise.all([
      FinanceProfile.findOne({ user: userId }),
      Deposit.find({ user: userId, status: 'active' }),
      Stock.find({ user: userId }),
      Fund.find({ user: userId }),
      Loan.find({ user: userId }),
      Pension.find({ user: userId, status: 'active' }),
      Budget.findOne({ user: userId, month: thisMonth, year: thisYear }),
      RecurringTransaction.find({ user: userId, isActive: true }),
      Transaction.find({ user: userId, date: { $gte: subMonths(today, 3) } }),
      Insurance.find({ user: userId, status: 'active' }),
      Goal.find({ user: userId, status: 'active' }),
      Mortgage.find({ user: userId, status: 'active' }),
    ]);

    const scores = [];
    const tips = [];

    // ── 1. קרן חירום (25 נקודות) ────────
    // מומלץ שיהיו 3-6 חודשי הוצאות בנזילות
    const monthlyExpenses = recurring
      .filter(r => r.type === 'הוצאה' && !r.isPaused)
      .reduce((sum, r) => sum + (r.monthlyCost || 0), 0) || 5000;
    
    const liquidAssets = (profile?.checking || 0) + (profile?.cash || 0);
    const emergencyMonths = monthlyExpenses > 0 ? liquidAssets / monthlyExpenses : 0;
    
    let emergencyScore = 0;
    if (emergencyMonths >= 6) emergencyScore = 25;
    else if (emergencyMonths >= 3) emergencyScore = 20;
    else if (emergencyMonths >= 1) emergencyScore = 10;
    else emergencyScore = 0;
    
    scores.push({ category: 'קרן חירום', score: emergencyScore, maxScore: 25, detail: `${emergencyMonths.toFixed(1)} חודשי הוצאות` });
    if (emergencyMonths < 3) tips.push({ priority: 'high', tip: `כדאי לשמור לפחות 3 חודשי הוצאות (${(monthlyExpenses * 3).toLocaleString()} ₪) כקרן חירום`, icon: '🛡️' });

    // ── 2. יחס חוב להכנסה (20 נקודות) ────
    const totalDebt = loans.reduce((s, l) => s + l.principal, 0);
    const monthlyIncome = recurring
      .filter(r => r.type === 'הכנסה' && !r.isPaused)
      .reduce((sum, r) => sum + (r.monthlyCost || 0), 0) || 10000;
    
    const debtToIncomeRatio = monthlyIncome > 0 ? (totalDebt / (monthlyIncome * 12)) : 0;
    
    let debtScore = 0;
    if (debtToIncomeRatio === 0) debtScore = 20;
    else if (debtToIncomeRatio < 0.2) debtScore = 18;
    else if (debtToIncomeRatio < 0.4) debtScore = 12;
    else if (debtToIncomeRatio < 0.6) debtScore = 6;
    else debtScore = 0;

    scores.push({ category: 'יחס חוב', score: debtScore, maxScore: 20, detail: `${(debtToIncomeRatio * 100).toFixed(0)}% מהכנסה שנתית` });
    if (debtToIncomeRatio > 0.4) tips.push({ priority: 'high', tip: 'יחס החוב גבוה. כדאי לשקול תוכנית להפחתת חובות', icon: '⚠️' });

    // ── 3. שיעור חיסכון (20 נקודות) ─────
    const last3MonthsIncome = recentTransactions.filter(t => t.type === 'הכנסה').reduce((s, t) => s + t.amount, 0);
    const last3MonthsExpense = recentTransactions.filter(t => t.type === 'הוצאה').reduce((s, t) => s + t.amount, 0);
    const savingsRate = last3MonthsIncome > 0 ? ((last3MonthsIncome - last3MonthsExpense) / last3MonthsIncome) * 100 : 0;

    let savingsScore = 0;
    if (savingsRate >= 20) savingsScore = 20;
    else if (savingsRate >= 10) savingsScore = 15;
    else if (savingsRate >= 5) savingsScore = 8;
    else if (savingsRate > 0) savingsScore = 3;
    else savingsScore = 0;

    scores.push({ category: 'שיעור חיסכון', score: savingsScore, maxScore: 20, detail: `${savingsRate.toFixed(0)}% מההכנסה` });
    if (savingsRate < 10) tips.push({ priority: 'medium', tip: 'נסה לחסוך לפחות 10% מההכנסה החודשית', icon: '💰' });

    // ── 4. פיזור השקעות (15 נקודות) ─────
    const hasDeposits = deposits.length > 0;
    const hasStocks = stocks.length > 0;
    const hasFunds = funds.length > 0;
    const hasPension = pensions.length > 0;
    const diversificationCount = [hasDeposits, hasStocks, hasFunds, hasPension].filter(Boolean).length;

    let diversificationScore = 0;
    if (diversificationCount >= 4) diversificationScore = 15;
    else if (diversificationCount >= 3) diversificationScore = 12;
    else if (diversificationCount >= 2) diversificationScore = 8;
    else if (diversificationCount >= 1) diversificationScore = 4;
    else diversificationScore = 0;

    scores.push({ category: 'פיזור השקעות', score: diversificationScore, maxScore: 15, detail: `${diversificationCount} סוגי מכשירים` });
    if (!hasPension) tips.push({ priority: 'high', tip: 'חשוב מאוד לוודא שיש לך חיסכון פנסיוני פעיל', icon: '🏦' });
    if (diversificationCount < 2) tips.push({ priority: 'medium', tip: 'כדאי לפזר את ההשקעות בין מספר מכשירים שונים', icon: '📊' });

    // ── 5. עמידה בתקציב (10 נקודות) ─────
    let budgetScore = 0;
    if (budget) {
      const percentUsed = budget.totalLimit > 0 ? (budget.totalSpent / budget.totalLimit) * 100 : 0;
      if (percentUsed <= 90) budgetScore = 10;
      else if (percentUsed <= 100) budgetScore = 7;
      else if (percentUsed <= 120) budgetScore = 3;
      else budgetScore = 0;

      scores.push({ category: 'עמידה בתקציב', score: budgetScore, maxScore: 10, detail: `${percentUsed.toFixed(0)}% ניצול` });
    } else {
      scores.push({ category: 'עמידה בתקציב', score: 0, maxScore: 10, detail: 'לא הוגדר תקציב' });
      tips.push({ priority: 'medium', tip: 'הגדר תקציב חודשי כדי לעקוב אחרי ההוצאות', icon: '📋' });
    }

    // ── 6. ביטוח וכיסוי (10 נקודות) ─────
    const hasHealthInsurance = insurances.some(i => i.type === 'health');
    const hasLifeInsurance = insurances.some(i => i.type === 'life');
    const hasDisabilityInsurance = insurances.some(i => i.type === 'disability');
    const hasHomeInsurance = insurances.some(i => ['home_structure', 'home_contents'].includes(i.type));
    const insuranceCoverage = [hasHealthInsurance, hasLifeInsurance, hasDisabilityInsurance, hasHomeInsurance].filter(Boolean).length;
    
    let insuranceScore = 0;
    if (insuranceCoverage >= 4) insuranceScore = 10;
    else if (insuranceCoverage >= 3) insuranceScore = 8;
    else if (insuranceCoverage >= 2) insuranceScore = 5;
    else if (insuranceCoverage >= 1) insuranceScore = 2;
    
    scores.push({ category: 'ביטוח וכיסוי', score: insuranceScore, maxScore: 10, detail: `${insuranceCoverage}/4 סוגי כיסוי` });
    if (!hasLifeInsurance) tips.push({ priority: 'high', tip: 'ביטוח חיים חיוני במיוחד אם יש לך משפחה/משכנתא', icon: '🛡️' });
    if (!hasDisabilityInsurance) tips.push({ priority: 'medium', tip: 'ביטוח אובדן כושר עבודה מגן על ההכנסה שלך', icon: '🏥' });

    // ── 7. יעדים פיננסיים (BONUS 5 נקודות) ──
    let goalsScore = 0;
    if (goals.length > 0) {
      const onTrack = goals.filter(g => g.isOnTrack).length;
      const ratio = onTrack / goals.length;
      if (ratio >= 0.8) goalsScore = 5;
      else if (ratio >= 0.5) goalsScore = 3;
      else goalsScore = 1;
    }
    scores.push({ category: 'יעדים פיננסיים', score: goalsScore, maxScore: 5, detail: goals.length > 0 ? `${goals.filter(g => g.isOnTrack).length}/${goals.length} בזמן` : 'לא הוגדרו יעדים' });
    if (goals.length === 0) tips.push({ priority: 'low', tip: 'הגדר יעדים פיננסיים כדי להישאר ממוקד', icon: '🎯' });

    // ── 8. בריאות משכנתא (BONUS 5 נקודות) ──
    let mortgageScore = 0;
    if (mortgages.length > 0) {
      const avgLtv = mortgages.reduce((s, m) => s + (m.ltv || 0), 0) / mortgages.length;
      if (avgLtv <= 50) mortgageScore = 5;
      else if (avgLtv <= 60) mortgageScore = 4;
      else if (avgLtv <= 70) mortgageScore = 3;
      else if (avgLtv <= 75) mortgageScore = 2;
      else mortgageScore = 1;
      scores.push({ category: 'בריאות משכנתא', score: mortgageScore, maxScore: 5, detail: `LTV ${avgLtv.toFixed(0)}%` });
      if (avgLtv > 70) tips.push({ priority: 'medium', tip: 'שקול להפחית את יחס ה-LTV של המשכנתא', icon: '🏠' });
    }

    // ── סיכום ────────────────────────────
    const totalScore = scores.reduce((s, item) => s + item.score, 0);
    const maxPossible = scores.reduce((s, item) => s + item.maxScore, 0);
    const normalizedScore = Math.round((totalScore / maxPossible) * 100);

    let grade, gradeLabel, gradeColor;
    if (normalizedScore >= 85) { grade = 'A'; gradeLabel = 'מצוין'; gradeColor = '#10b981'; }
    else if (normalizedScore >= 70) { grade = 'B'; gradeLabel = 'טוב'; gradeColor = '#3b82f6'; }
    else if (normalizedScore >= 55) { grade = 'C'; gradeLabel = 'סביר'; gradeColor = '#f59e0b'; }
    else if (normalizedScore >= 40) { grade = 'D'; gradeLabel = 'צריך שיפור'; gradeColor = '#f97316'; }
    else { grade = 'F'; gradeLabel = 'מצב חירום'; gradeColor = '#ef4444'; }

    res.json({
      totalScore,
      normalizedScore,
      maxPossible,
      grade,
      gradeLabel,
      gradeColor,
      scores,
      tips: tips.sort((a, b) => {
        const order = { high: 0, medium: 1, low: 2 };
        return order[a.priority] - order[b.priority];
      }),
    });
  } catch (error) {
    console.error('Error calculating health score:', error);
    res.status(500).json({ message: 'שגיאה בחישוב ציון בריאות פיננסית' });
  }
};
