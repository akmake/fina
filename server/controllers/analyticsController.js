/**
 * Smart Analytics Controller
 * Advanced financial analysis and insights
 */

import Transaction from '../models/Transaction.js';
import User from '../models/User.js';
import CategoryRule from '../models/CategoryRule.js';
import RecurringTransaction from '../models/RecurringTransaction.js';
import Budget from '../models/Budget.js';
import Goal from '../models/Goal.js';
import FinanceProfile from '../models/FinanceProfile.js';
import smartCategoryEngine from '../utils/smartCategoryEngine.js';
import { getPaginationOptions, formatPaginatedResponse } from '../utils/pagination.js';
import logger from '../utils/logger.js';
import { scopeFilter } from '../utils/scopeFilter.js';

/**
 * Get comprehensive financial analytics
 */
export const getFinancialAnalytics = async (req, res) => {
  try {
    const userId = req.user._id;
    const { startDate, endDate, granularity = 'monthly' } = req.query;

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    // Get all transactions in range
    const transactions = await Transaction.find({
      ...scopeFilter(req),
      date: { $gte: start, $lte: end },
    }).lean();

    if (transactions.length === 0) {
      return res.json({
        status: 'success',
        data: {
          summary: {
            totalIncome: 0,
            totalExpense: 0,
            netFlow: 0,
            avgTransaction: 0,
            transactionCount: 0,
          },
          trends: [],
          topCategories: [],
          patterns: [],
        },
      });
    }

    // Calculate comprehensive metrics
    const analytics = {
      summary: calculateSummaryMetrics(transactions),
      trends: calculateTrends(transactions, granularity),
      topCategories: getTopCategories(transactions),
      patterns: detectPatterns(transactions),
      anomalies: detectAnomalies(transactions),
      predictions: generatePredictions(transactions),
      efficiency: calculateEfficiencyScore(transactions),
    };

    res.json({
      status: 'success',
      data: analytics,
    });
  } catch (error) {
    logger.error('Analytics calculation failed', { error: error.message });
    res.status(500).json({ message: 'Failed to calculate analytics' });
  }
};

/**
 * Auto-categorize transactions using smart engine
 */
export const autoCategorizeBatch = async (req, res) => {
  try {
    const userId = req.user._id;
    const { category = 'כללי', limit = 50 } = req.query;

    // Get uncategorized or low-confidence transactions
    const transactions = await Transaction.find({
      ...scopeFilter(req),
      category: category,
    })
      .limit(parseInt(limit))
      .lean();

    // Batch classify — pre-fetches DB data once instead of 6 queries per transaction
    const predictions = await smartCategoryEngine.classifyBatch(transactions);

    const categorized = [];
    const skipped = [];
    const bulkOps = [];

    for (let i = 0; i < transactions.length; i++) {
      const tx         = transactions[i];
      const prediction = predictions[i];

      if (prediction.confidence >= smartCategoryEngine.confidenceThreshold) {
        bulkOps.push({
          updateOne: { filter: { _id: tx._id }, update: { $set: { category: prediction.category } } },
        });
        categorized.push({
          _id: tx._id,
          oldCategory: tx.category,
          newCategory: prediction.category,
          confidence: prediction.confidence,
        });
      } else {
        skipped.push({
          _id: tx._id,
          description: tx.description,
          amount: tx.amount,
          confidence: prediction.confidence,
        });
      }
    }

    if (bulkOps.length > 0) await Transaction.bulkWrite(bulkOps);

    res.json({
      status: 'success',
      data: {
        categorized,
        skipped,
        totalProcessed: transactions.length,
        successRate: transactions.length > 0 ? (categorized.length / transactions.length) * 100 : 0,
      },
    });
  } catch (error) {
    logger.error('Auto-categorization failed', { error: error.message });
    res.status(500).json({ message: 'Auto-categorization failed' });
  }
};

/**
 * Get detailed transaction insights
 */
export const getTransactionInsights = async (req, res) => {
  try {
    const userId = req.user._id;
    const { category, merchant, timeRange = 'month' } = req.query;

    const rangeDays = {
      week: 7,
      month: 30,
      quarter: 90,
      year: 365,
    }[timeRange] || 30;

    const startDate = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000);

    let query = { ...scopeFilter(req), date: { $gte: startDate } };

    if (category) query.category = category;
    if (merchant) query.rawDescription = new RegExp(merchant, 'i');

    const transactions = await Transaction.find(query).lean();

    const insights = {
      totalSpending: transactions
        .filter(t => t.type === 'הוצאה')
        .reduce((sum, t) => sum + t.amount, 0),
      totalIncome: transactions
        .filter(t => t.type === 'הכנסה')
        .reduce((sum, t) => sum + t.amount, 0),
      averageTransaction: transactions.length > 0
        ? transactions.reduce((sum, t) => sum + t.amount, 0) / transactions.length
        : 0,
      largestTransaction: Math.max(...transactions.map(t => t.amount), 0),
      smallestTransaction: Math.min(...transactions.map(t => t.amount), Infinity),
      transactionCount: transactions.length,
      uniqueMerchants: [...new Set(transactions.map(t => t.rawDescription))].length,
      frequencyPerDay: (transactions.length / rangeDays).toFixed(2),
      spendingPattern: analyzeSpendingPattern(transactions),
      predictedMonthlySpend: predictMonthlySpending(transactions),
      savingsOpportunities: identifySavingsOpportunities(transactions),
    };

    res.json({ status: 'success', data: insights });
  } catch (error) {
    logger.error('Insights calculation failed', { error: error.message });
    res.status(500).json({ message: 'Failed to calculate insights' });
  }
};

/**
 * Get spending recommendations
 */
export const getSpendingRecommendations = async (req, res) => {
  try {
    const userId = req.user._id;
    const transactions = await Transaction.find(scopeFilter(req))
      .sort({ date: -1 })
      .limit(200)
      .lean();

    const recommendations = [];

    // Recommendation 1: High-frequency categories
    const categoryFreq = {};
    transactions.forEach(t => {
      categoryFreq[t.category] = (categoryFreq[t.category] || 0) + 1;
    });

    const highFreq = Object.entries(categoryFreq)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3);

    highFreq.forEach(([category, count]) => {
      if (count > 10) {
        recommendations.push({
          type: 'high_frequency',
          category,
          frequency: count,
          suggestion: `נצפתה עלות תדירה בקטגוריה ${category}. שקול להגדיל תקציב או למצוא חלופה זולה יותר.`,
          priority: 'medium',
        });
      }
    });

    // Recommendation 2: Unusual spending spikes
    const avgByCategory = calculateAverageByCategory(transactions);
    const recentTransactions = transactions.slice(0, 20);

    recentTransactions.forEach(t => {
      const cat = t.category;
      const avg = avgByCategory[cat] || 0;
      
      if (t.amount > avg * 1.5) {
        recommendations.push({
          type: 'spending_spike',
          description: t.description,
          category: cat,
          amount: t.amount,
          normalAverage: avg,
          suggestion: `הוצאה חריגה בקטגוריה ${cat}: ₪${t.amount} (רגיל: ₪${avg})`,
          priority: 'high',
          date: t.date,
        });
      }
    });

    // Recommendation 3: Potential savings
    const savingsOpps = identifySavingsOpportunities(transactions);
    savingsOpps.forEach(opp => {
      recommendations.push({
        type: 'savings_opportunity',
        ...opp,
        priority: 'low',
      });
    });

    // ── המלצות חוצות-מודולים ──────────────────────────────────────────
    const now = new Date();
    const [recurringCount, currentBudget, offTrackGoals] = await Promise.all([
      RecurringTransaction.countDocuments({ ...scopeFilter(req), isActive: true }),
      Budget.findOne({ ...scopeFilter(req), month: now.getMonth() + 1, year: now.getFullYear() }).lean(),
      Goal.find({ ...scopeFilter(req), status: 'active' }).lean(),
    ]);

    // Recommendation 4: אין קבועות בכלל
    if (recurringCount === 0) {
      recommendations.push({
        type: 'recurring_missing',
        suggestion: 'לא הגדרת תשלומים קבועים עדיין. לחץ על "זיהוי אוטומטי" כדי לגלות דפוסים מההיסטוריה שלך.',
        priority: 'high',
        actionUrl: '/recurring',
        actionLabel: 'לדף קבועות',
      });
    }

    // Recommendation 5: אין תקציב לחודש הנוכחי
    if (!currentBudget) {
      const monthNames = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
      recommendations.push({
        type: 'budget_missing',
        suggestion: `לא הוגדר תקציב לחודש ${monthNames[now.getMonth()]}. הגדרת תקציב עוזרת למנוע חריגות.`,
        priority: 'medium',
        actionUrl: '/budget',
        actionLabel: 'הגדר תקציב',
      });
    }

    // Recommendation 6: יעדים שלא בtrack
    if (offTrackGoals.length > 0) {
      for (const goal of offTrackGoals) {
        const progress = goal.currentAmount / goal.targetAmount;
        const monthsLeft = goal.targetDate
          ? Math.max(0, Math.round((new Date(goal.targetDate) - now) / (30 * 24 * 60 * 60 * 1000)))
          : null;

        if (monthsLeft !== null && monthsLeft > 0) {
          const needed = (goal.targetAmount - goal.currentAmount) / monthsLeft;
          const current = goal.monthlyContribution || 0;
          if (needed > current * 1.1) {
            const extra = Math.ceil(needed - current);
            recommendations.push({
              type: 'goal_behind',
              goalName: goal.name,
              suggestion: `יעד "${goal.name}" מפגר. הגדל הפקדה חודשית ב-₪${extra} כדי לסיים בזמן (${monthsLeft} חודשים נותרו).`,
              priority: 'medium',
              actionUrl: '/goals',
              actionLabel: 'לדף יעדים',
              progress: Math.round(progress * 100),
            });
          }
        }
      }
    }

    // Sort by priority
    const priorityMap = { high: 1, medium: 2, low: 3 };
    recommendations.sort((a, b) => priorityMap[a.priority] - priorityMap[b.priority]);

    res.json({
      status: 'success',
      data: {
        recommendations: recommendations.slice(0, 12),
        totalRecommendations: recommendations.length,
        topPriorities: recommendations.filter(r => r.priority === 'high').length,
      },
    });
  } catch (error) {
    logger.error('Recommendations failed', { error: error.message });
    res.status(500).json({ message: 'Failed to generate recommendations' });
  }
};

/**
 * Predict future spending
 */
export const predictSpending = async (req, res) => {
  try {
    const userId = req.user._id;
    const { months = 3 } = req.query;

    const transactions = await Transaction.find(scopeFilter(req))
      .sort({ date: -1 })
      .limit(200)
      .lean();

    const predictions = {};

    // Group by category and month
    const monthlyData = {};
    transactions.forEach(t => {
      const month = new Date(t.date).getMonth();
      if (!monthlyData[month]) monthlyData[month] = {};
      if (!monthlyData[month][t.category]) monthlyData[month][t.category] = 0;
      if (t.type === 'הוצאה') {
        monthlyData[month][t.category] += t.amount;
      }
    });

    // Calculate trends and predict
    Object.entries(monthlyData).forEach(([month, categories]) => {
      Object.entries(categories).forEach(([category, amount]) => {
        if (!predictions[category]) {
          predictions[category] = { historical: [], forecast: [] };
        }
        predictions[category].historical.push(amount);
      });
    });

    // Simple linear regression for prediction
    for (const category in predictions) {
      const data = predictions[category].historical;
      if (data.length >= 2) {
        const trend = calculateTrend(data);
        const lastValue = data[data.length - 1];

        for (let i = 0; i < months; i++) {
          predictions[category].forecast.push(lastValue + trend * (i + 1));
        }
      }
    }

    res.json({
      status: 'success',
      data: {
        predictions,
        forecastMonths: months,
        generatedAt: new Date(),
      },
    });
  } catch (error) {
    logger.error('Prediction failed', { error: error.message });
    res.status(500).json({ message: 'Failed to predict spending' });
  }
};

// ==================== Helper Functions ====================

function calculateSummaryMetrics(transactions) {
  const income = transactions
    .filter(t => t.type === 'הכנסה')
    .reduce((sum, t) => sum + t.amount, 0);

  const expense = transactions
    .filter(t => t.type === 'הוצאה')
    .reduce((sum, t) => sum + t.amount, 0);

  return {
    totalIncome: Math.round(income * 100) / 100,
    totalExpense: Math.round(expense * 100) / 100,
    netFlow: Math.round((income - expense) * 100) / 100,
    avgTransaction: Math.round((transactions.reduce((sum, t) => sum + t.amount, 0) / transactions.length) * 100) / 100,
    transactionCount: transactions.length,
    expenseRatio: Math.round((expense / income) * 100),
  };
}

function calculateTrends(transactions, granularity) {
  const grouped = {};

  transactions.forEach(t => {
    const date = new Date(t.date);
    let key;

    if (granularity === 'daily') {
      key = date.toISOString().split('T')[0];
    } else if (granularity === 'weekly') {
      const week = Math.ceil(date.getDate() / 7);
      key = `${date.getFullYear()}-W${week}`;
    } else {
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }

    if (!grouped[key]) {
      grouped[key] = { income: 0, expense: 0, net: 0 };
    }

    if (t.type === 'הכנסה') {
      grouped[key].income += t.amount;
    } else {
      grouped[key].expense += t.amount;
    }
    grouped[key].net = grouped[key].income - grouped[key].expense;
  });

  return Object.entries(grouped).map(([date, data]) => ({
    date,
    ...data,
  }));
}

function getTopCategories(transactions) {
  const categories = {};

  transactions.forEach(t => {
    if (!categories[t.category]) {
      categories[t.category] = { count: 0, total: 0, type: null };
    }
    categories[t.category].count++;
    categories[t.category].total += t.amount;
    categories[t.category].type = t.type;
  });

  return Object.entries(categories)
    .map(([category, data]) => ({
      category,
      ...data,
      average: Math.round((data.total / data.count) * 100) / 100,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);
}

function detectPatterns(transactions) {
  const patterns = [];

  // Daily pattern
  const dayFreq = {};
  transactions.forEach(t => {
    const day = new Date(t.date).getDay();
    dayFreq[day] = (dayFreq[day] || 0) + 1;
  });

  const maxDay = Object.entries(dayFreq).sort(([, a], [, b]) => b - a)[0];
  patterns.push({
    type: 'day_of_week',
    mostCommon: ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'][maxDay[0]],
    frequency: maxDay[1],
  });

  return patterns;
}

function detectAnomalies(transactions) {
  if (transactions.length < 10) return [];

  const amounts = transactions.map(t => t.amount).sort((a, b) => a - b);
  const q1 = amounts[Math.floor(amounts.length * 0.25)];
  const q3 = amounts[Math.floor(amounts.length * 0.75)];
  const iqr = q3 - q1;

  const anomalies = transactions.filter(t => 
    t.amount > q3 + 1.5 * iqr || t.amount < q1 - 1.5 * iqr
  );

  return anomalies.slice(0, 5);
}

function generatePredictions(transactions) {
  // Simple trend analysis
  const recentAvg = transactions.slice(0, 10).reduce((sum, t) => sum + t.amount, 0) / 10;
  const overallAvg = transactions.reduce((sum, t) => sum + t.amount, 0) / transactions.length;

  return {
    trendDirection: recentAvg > overallAvg ? 'increasing' : 'decreasing',
    trendStrength: Math.abs((recentAvg - overallAvg) / overallAvg) * 100,
  };
}

function calculateEfficiencyScore(transactions) {
  const expenses = transactions.filter(t => t.type === 'הוצאה');
  const income = transactions.filter(t => t.type === 'הכנסה');

  const totalExpense = expenses.reduce((sum, t) => sum + t.amount, 0);
  const totalIncome = income.reduce((sum, t) => sum + t.amount, 0);

  if (totalIncome === 0) return 0;

  const ratio = (totalIncome - totalExpense) / totalIncome;
  return Math.max(0, Math.min(100, ratio * 100));
}

function analyzeSpendingPattern(transactions) {
  const amounts = transactions.map(t => t.amount);
  const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
  const variance = amounts.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / amounts.length;

  return {
    average: Math.round(avg * 100) / 100,
    variance: Math.round(variance * 100) / 100,
    consistency: variance < avg ? 'consistent' : 'variable',
  };
}

function predictMonthlySpending(transactions) {
  const monthlyAmounts = {};
  
  transactions.forEach(t => {
    const month = Math.floor(t.date / (30 * 24 * 60 * 60 * 1000));
    if (!monthlyAmounts[month]) monthlyAmounts[month] = 0;
    if (t.type === 'הוצאה') {
      monthlyAmounts[month] += t.amount;
    }
  });

  const amounts = Object.values(monthlyAmounts);
  const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;

  return Math.round(avg * 100) / 100;
}

function identifySavingsOpportunities(transactions) {
  const opportunities = [];
  const categorySpending = {};

  transactions.forEach(t => {
    if (t.type === 'הוצאה') {
      if (!categorySpending[t.category]) {
        categorySpending[t.category] = [];
      }
      categorySpending[t.category].push(t.amount);
    }
  });

  // Find categories with high variance (potential for optimization)
  Object.entries(categorySpending).forEach(([category, amounts]) => {
    if (amounts.length >= 5) {
      const avg = amounts.reduce((a, b) => a + b) / amounts.length;
      const max = Math.max(...amounts);
      const min = Math.min(...amounts);

      if (max - min > avg * 0.5) {
        opportunities.push({
          category,
          suggestion: `שנות ₪${Math.round((max - avg))} בממוצע בקטגוריה ${category}`,
          potentialSavings: Math.round((max - avg) * 12),
        });
      }
    }
  });

  return opportunities.sort((a, b) => b.potentialSavings - a.potentialSavings).slice(0, 5);
}

function calculateAverageByCategory(transactions) {
  const categoryData = {};

  transactions.forEach(t => {
    if (!categoryData[t.category]) {
      categoryData[t.category] = { sum: 0, count: 0 };
    }
    categoryData[t.category].sum += t.amount;
    categoryData[t.category].count++;
  });

  const result = {};
  for (const [cat, data] of Object.entries(categoryData)) {
    result[cat] = Math.round((data.sum / data.count) * 100) / 100;
  }

  return result;
}

// ==================== Weekly Action Plan ====================

/**
 * @desc   תוכנית פעולה שבועית — 3-5 פעולות קונקרטיות עם סכומים ספציפיים
 * @route  GET /api/analytics/action-plan
 */
export const getWeeklyActionPlan = async (req, res) => {
  try {
    const userId = req.user._id;
    const now = new Date();
    const month = now.getMonth() + 1;
    const year  = now.getFullYear();

    const monthStart = new Date(year, month - 1, 1);
    const monthEnd   = new Date(year, month, 0, 23, 59, 59);

    const [profile, budget, goals, thisMonthTx, recurringTx] = await Promise.all([
      FinanceProfile.findOne(scopeFilter(req)).lean(),
      Budget.findOne({ ...scopeFilter(req), month, year }).lean(),
      Goal.find({ ...scopeFilter(req), status: 'active' }).lean(),
      Transaction.find({ ...scopeFilter(req), date: { $gte: monthStart, $lte: monthEnd } }).lean(),
      RecurringTransaction.find({ ...scopeFilter(req), isActive: true }).lean(),
    ]);

    const actions = [];

    // ── חישובי בסיס ──────────────────────────────────────────────
    const thisIncome  = thisMonthTx.filter(t => t.type === 'הכנסה').reduce((s, t) => s + t.amount, 0);
    const thisExpense = thisMonthTx.filter(t => t.type === 'הוצאה').reduce((s, t) => s + t.amount, 0);
    const savingsRate = thisIncome > 0 ? (thisIncome - thisExpense) / thisIncome * 100 : 0;

    const liquidAssets = (profile?.checking || 0) + (profile?.cash || 0);
    const avgExpense   = recurringTx.filter(r => r.type === 'הוצאה' && !r.isPaused)
                           .reduce((s, r) => s + (r.monthlyCost || 0), 0) || thisExpense || 5000;
    const emergencyMonths = avgExpense > 0 ? liquidAssets / avgExpense : 0;

    // ── Action 1: שיעור חיסכון נמוך ──────────────────────────────
    if (savingsRate < 10 && thisIncome > 0) {
      const targetSavings  = Math.round(thisIncome * 0.10);
      const currentSavings = Math.max(0, thisIncome - thisExpense);
      const gap            = targetSavings - currentSavings;
      if (gap > 0) {
        actions.push({
          priority: 'high', icon: '💰',
          title: 'העבר לחיסכון',
          description: `שיעור החיסכון שלך הוא ${savingsRate.toFixed(0)}% — מתחת ל-10%. העבר ₪${gap.toLocaleString()} לחשבון חיסכון עוד החודש כדי להגיע ליעד.`,
          amount: gap, actionLabel: 'לניהול פיננסי', actionUrl: '/finance',
        });
      }
    }

    // ── Action 2: קרן חירום לא מספיקה ───────────────────────────
    if (emergencyMonths < 3) {
      const targetLiquid  = avgExpense * 3;
      const missing       = Math.round(targetLiquid - liquidAssets);
      const monthlyBuild  = Math.round(missing / 6);
      if (missing > 0) {
        actions.push({
          priority: 'high', icon: '🛡️',
          title: 'בנה קרן חירום',
          description: `יש לך ${emergencyMonths.toFixed(1)} חודשי הוצאות בנזילות — צריך 3 לפחות. הפרש ₪${monthlyBuild.toLocaleString()} בחודש ל-6 חודשים (חסר ₪${missing.toLocaleString()}).`,
          amount: monthlyBuild, actionLabel: 'לפרופיל פיננסי', actionUrl: '/finance',
        });
      }
    }

    // ── Action 3: תקציב — קטגוריות שחרגו ────────────────────────
    if (budget?.items?.length > 0) {
      const categorySpend = {};
      thisMonthTx.filter(t => t.type === 'הוצאה').forEach(t => {
        categorySpend[t.category] = (categorySpend[t.category] || 0) + t.amount;
      });

      const overBudget = budget.items
        .map(item => ({ ...item, actualSpent: categorySpend[item.category] || 0, overage: (categorySpend[item.category] || 0) - item.limit }))
        .filter(item => item.overage > 0)
        .sort((a, b) => b.overage - a.overage);

      if (overBudget.length > 0) {
        const worst    = overBudget[0];
        const daysLeft = Math.max(1, monthEnd.getDate() - now.getDate());
        const cutPerWeek = Math.round(worst.overage / Math.max(1, Math.floor(daysLeft / 7)));
        actions.push({
          priority: 'high', icon: '✂️',
          title: `הפחת הוצאות: ${worst.category}`,
          description: `חרגת ב-₪${Math.round(worst.overage).toLocaleString()} ב"${worst.category}" (₪${Math.round(worst.actualSpent).toLocaleString()} מתוך ₪${worst.limit.toLocaleString()}). נותרו ${daysLeft} ימים — הפחת ₪${cutPerWeek.toLocaleString()}/שבוע.`,
          amount: Math.round(worst.overage), actionLabel: 'לתקציב', actionUrl: '/budget',
        });
      } else {
        const nearCats = budget.items
          .map(item => ({ ...item, actualSpent: categorySpend[item.category] || 0, pct: item.limit > 0 ? (categorySpend[item.category] || 0) / item.limit * 100 : 0 }))
          .filter(item => item.pct >= 80 && item.pct < 100)
          .sort((a, b) => b.pct - a.pct);
        if (nearCats.length > 0) {
          const near = nearCats[0];
          actions.push({
            priority: 'medium', icon: '⚠️',
            title: `שים לב: ${near.category}`,
            description: `ניצלת ${near.pct.toFixed(0)}% מהתקציב של "${near.category}". נותרו ₪${Math.round(near.limit - near.actualSpent).toLocaleString()} עד סוף החודש — האט את ההוצאות.`,
            amount: Math.round(near.limit - near.actualSpent), actionLabel: 'לתקציב', actionUrl: '/budget',
          });
        }
      }
    } else {
      actions.push({
        priority: 'medium', icon: '📋',
        title: 'צור תקציב חודשי',
        description: 'אין לך תקציב מוגדר לחודש זה. בלי תקציב אי-אפשר לדעת אם אתה על המסלול הנכון — זה הצעד הראשון.',
        amount: null, actionLabel: 'צור תקציב', actionUrl: '/budget',
      });
    }

    // ── Action 4: יעדים מפגרים — כמה צריך להוסיף ──────────────
    const behindGoals = goals.filter(g => {
      if (!g.targetDate) return false;
      const monthsLeft = (new Date(g.targetDate) - now) / (1000 * 60 * 60 * 24 * 30.44);
      if (monthsLeft <= 0) return false;
      const needed = (g.targetAmount - g.currentAmount) / monthsLeft;
      return needed > (g.monthlyContribution || 0) * 1.05;
    });

    if (behindGoals.length > 0) {
      const goal = behindGoals[0];
      const monthsLeft = Math.max(1, Math.round((new Date(goal.targetDate) - now) / (1000 * 60 * 60 * 24 * 30.44)));
      const needed     = Math.ceil((goal.targetAmount - goal.currentAmount) / monthsLeft);
      const extra      = Math.max(1, needed - (goal.monthlyContribution || 0));
      actions.push({
        priority: 'medium', icon: '🎯',
        title: `הגדל הפקדה: ${goal.name}`,
        description: `יעד "${goal.name}" מפגר. נדרשת הפקדה של ₪${needed.toLocaleString()}/חודש אך אתה מפקיד ₪${(goal.monthlyContribution || 0).toLocaleString()}. הוסף ₪${extra.toLocaleString()}/חודש (${monthsLeft} חודשים נותרו).`,
        amount: extra, actionLabel: 'לדף יעדים', actionUrl: '/goals',
      });
    }

    // ── Action 5: כסף נזיל מוגזם ────────────────────────────────
    if (liquidAssets > avgExpense * 8 && emergencyMonths >= 6) {
      const idleCash = Math.round(liquidAssets - avgExpense * 6);
      actions.push({
        priority: 'low', icon: '📈',
        title: 'העבר כסף למכשיר מניב',
        description: `יש לך ${emergencyMonths.toFixed(0)} חודשי נזילות — מעל מה שצריך. ₪${idleCash.toLocaleString()} עומדים ללא תשואה. שקול פיקדון, קרן כספית או מניות.`,
        amount: idleCash, actionLabel: 'לפיקדונות', actionUrl: '/deposits',
      });
    }

    const order = { high: 0, medium: 1, low: 2 };
    actions.sort((a, b) => order[a.priority] - order[b.priority]);

    res.json({
      status: 'success',
      data: {
        actions: actions.slice(0, 4),
        generatedAt: now,
        monthContext: { month, year, thisIncome, thisExpense, savingsRate: Math.round(savingsRate * 10) / 10 },
      },
    });
  } catch (error) {
    logger.error('Action plan generation failed', { error: error.message });
    res.status(500).json({ message: 'Failed to generate action plan' });
  }
};

// ==================== Seasonal Analysis ====================

/**
 * @desc   ניתוח עונתי — הוצאות לפי חודש ורבעון על פני כל ההיסטוריה
 * @route  GET /api/analytics/seasonal
 */
export const getSeasonalAnalysis = async (req, res) => {
  try {
    const userId = req.user._id;

    const transactions = await Transaction.find({ ...scopeFilter(req), type: 'הוצאה' }).lean();

    if (transactions.length === 0) {
      return res.json({ status: 'success', data: { monthly: [], quarterly: [], insights: [], peakMonth: null, cheapestMonth: null } });
    }

    // ── 1. קיבוץ לפי חודש קלנדרי (ממוצע על פני שנים) ──
    const monthlyMap  = {};
    const monthYears  = {};

    transactions.forEach(t => {
      const d = new Date(t.date);
      const m = d.getMonth();
      const y = d.getFullYear();
      if (!monthlyMap[m]) { monthlyMap[m] = 0; monthYears[m] = new Set(); }
      monthlyMap[m] += t.amount;
      monthYears[m].add(y);
    });

    const HMONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
    const SEASONS  = ['חורף','חורף','אביב','אביב','אביב','קיץ','קיץ','קיץ','סתיו','סתיו','סתיו','חורף'];

    const monthly = Array.from({ length: 12 }, (_, i) => ({
      month:  i + 1,
      label:  HMONTHS[i],
      season: SEASONS[i],
      total:  Math.round(monthlyMap[i] || 0),
      avg:    monthYears[i]?.size > 0 ? Math.round((monthlyMap[i] || 0) / monthYears[i].size) : 0,
      years:  monthYears[i]?.size || 0,
    })).filter(m => m.years > 0);

    // ── 2. קיבוץ לפי רבעון ──
    const quarterMap   = { 1: 0, 2: 0, 3: 0, 4: 0 };
    const quarterYears = { 1: new Set(), 2: new Set(), 3: new Set(), 4: new Set() };

    transactions.forEach(t => {
      const d = new Date(t.date);
      const q = Math.floor(d.getMonth() / 3) + 1;
      quarterMap[q] += t.amount;
      quarterYears[q].add(d.getFullYear());
    });

    const QLABELS = { 1: 'ינואר–מרץ', 2: 'אפריל–יוני', 3: 'יולי–ספטמבר', 4: 'אוקטובר–דצמבר' };
    const quarterly = [1, 2, 3, 4].map(q => ({
      quarter: q,
      label:   `רבעון ${q} (${QLABELS[q]})`,
      total:   Math.round(quarterMap[q]),
      avg:     quarterYears[q].size > 0 ? Math.round(quarterMap[q] / quarterYears[q].size) : 0,
    }));

    // ── 3. תובנות אוטומטיות ──
    const insights = [];
    const sorted    = [...monthly].sort((a, b) => b.avg - a.avg);
    const peakMonth = sorted[0];
    const cheapMonth = sorted[sorted.length - 1];
    const allAvg    = monthly.reduce((s, m) => s + m.avg, 0) / (monthly.length || 1);

    if (peakMonth) {
      insights.push({ type: 'peak', icon: '📈', priority: 'medium',
        text: `${peakMonth.label} הוא החודש היקר ביותר בממוצע (₪${peakMonth.avg.toLocaleString()})` });
    }
    if (cheapMonth && cheapMonth.month !== peakMonth?.month) {
      insights.push({ type: 'trough', icon: '💡', priority: 'low',
        text: `${cheapMonth.label} הוא החודש הזול ביותר (₪${cheapMonth.avg.toLocaleString()}) — מתאים לחיסכון` });
    }

    // עונות
    if (quarterly[1].avg > quarterly[0].avg * 1.15) {
      insights.push({ type: 'summer_spike', icon: '☀️', priority: 'medium',
        text: 'הוצאות הקיץ (אפריל–יוני) גבוהות ב-15%+ מהחורף — שקול תכנון תקציב קיץ' });
    }

    // חגי תשרי (ספטמבר–אוקטובר)
    const tishriM = monthly.filter(m => [9, 10].includes(m.month));
    if (tishriM.length > 0) {
      const tishriAvg = tishriM.reduce((s, m) => s + m.avg, 0) / tishriM.length;
      if (tishriAvg > allAvg * 1.2) {
        insights.push({ type: 'holiday', icon: '🍎', priority: 'high',
          text: `ספטמבר–אוקטובר (חגי תשרי) עולים ${Math.round((tishriAvg / allAvg - 1) * 100)}% מעל הממוצע השנתי` });
      }
    }

    // פסח (מרץ–אפריל)
    const nisanM = monthly.filter(m => [3, 4].includes(m.month));
    if (nisanM.length > 0) {
      const nisanAvg = nisanM.reduce((s, m) => s + m.avg, 0) / nisanM.length;
      if (nisanAvg > allAvg * 1.1) {
        insights.push({ type: 'passover', icon: '🌸', priority: 'medium',
          text: `מרץ–אפריל (פסח) גבוהים ב-${Math.round((nisanAvg / allAvg - 1) * 100)}% מהממוצע` });
      }
    }

    res.json({
      status: 'success',
      data: { monthly, quarterly, insights, peakMonth, cheapestMonth: cheapMonth },
    });
  } catch (error) {
    logger.error('Seasonal analysis failed', { error: error.message });
    res.status(500).json({ message: 'Failed to calculate seasonal analysis' });
  }
};

function calculateTrend(data) {
  if (data.length < 2) return 0;

  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  const n = data.length;

  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += data[i];
    sumXY += i * data[i];
    sumX2 += i * i;
  }

  return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
}
