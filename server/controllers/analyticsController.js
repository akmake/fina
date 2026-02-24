/**
 * Smart Analytics Controller
 * Advanced financial analysis and insights
 */

import Transaction from '../models/Transaction.js';
import User from '../models/User.js';
import CategoryRule from '../models/CategoryRule.js';
import smartCategoryEngine from '../utils/smartCategoryEngine.js';
import { getPaginationOptions, formatPaginatedResponse } from '../utils/pagination.js';
import logger from '../utils/logger.js';

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
      user: userId,
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
      user: userId,
      category: category,
    })
      .limit(parseInt(limit))
      .lean();

    const categorized = [];
    const skipped = [];

    for (const transaction of transactions) {
      const prediction = await smartCategoryEngine.classifyTransaction(transaction);

      if (prediction.confidence >= smartCategoryEngine.confidenceThreshold) {
        // Auto-update category
        await Transaction.findByIdAndUpdate(transaction._id, {
          category: prediction.category,
        });

        categorized.push({
          _id: transaction._id,
          oldCategory: transaction.category,
          newCategory: prediction.category,
          confidence: prediction.confidence,
        });
      } else {
        skipped.push({
          _id: transaction._id,
          description: transaction.description,
          amount: transaction.amount,
          confidence: prediction.confidence,
        });
      }
    }

    res.json({
      status: 'success',
      data: {
        categorized,
        skipped,
        totalProcessed: transactions.length,
        successRate: (categorized.length / transactions.length) * 100,
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

    let query = { user: userId, date: { $gte: startDate } };

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
    const transactions = await Transaction.find({ user: userId })
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

    // Sort by priority
    const priorityMap = { high: 1, medium: 2, low: 3 };
    recommendations.sort((a, b) => priorityMap[a.priority] - priorityMap[b.priority]);

    res.json({
      status: 'success',
      data: {
        recommendations: recommendations.slice(0, 10),
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

    const transactions = await Transaction.find({ user: userId })
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
