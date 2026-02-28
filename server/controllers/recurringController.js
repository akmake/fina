// server/controllers/recurringController.js
import RecurringTransaction from '../models/RecurringTransaction.js';
import Transaction from '../models/Transaction.js';
import { addDays, addWeeks, addMonths, addYears, isBefore, isAfter, startOfDay } from 'date-fns';

// ──────────────────────────────────────────────────
// חישוב התאריך הבא לביצוע
// ──────────────────────────────────────────────────
const calculateNextExecution = (recurring, fromDate = new Date()) => {
  const base = fromDate;
  switch (recurring.frequency) {
    case 'daily': return addDays(base, 1);
    case 'weekly': return addWeeks(base, 1);
    case 'monthly': {
      const next = addMonths(base, 1);
      if (recurring.dayOfMonth) {
        next.setDate(Math.min(recurring.dayOfMonth, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()));
      }
      return next;
    }
    case 'yearly': return addYears(base, 1);
    default: return addMonths(base, 1);
  }
};

// ──────────────────────────────────────────────────
// @desc   זיהוי אוטומטי של דפוסים חוזרים מהיסטוריית עסקאות
// @route  GET /api/recurring/detect
// ──────────────────────────────────────────────────
export const detectRecurringPatterns = async (req, res) => {
  try {
    const userId = req.user._id;
    const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);

    // שלוף כל עסקאות המשתמש מ-6 חודשים אחרונים
    const [allTxns, existingRecurring] = await Promise.all([
      Transaction.find({ user: userId, date: { $gte: sixMonthsAgo } })
        .select('description rawDescription amount type category date')
        .lean(),
      RecurringTransaction.find({ user: userId }).select('description amount').lean(),
    ]);

    // בנה Set של תיאורים שכבר מוגדרים כקבועות
    const existingDescriptions = new Set(
      existingRecurring.map(r => r.description.trim().toLowerCase())
    );

    // קבץ לפי תיאור מנורמל
    const groups = {};
    for (const tx of allTxns) {
      const key = tx.description.trim().toLowerCase();
      if (!groups[key]) groups[key] = [];
      groups[key].push(tx);
    }

    const candidates = [];

    for (const [key, txns] of Object.entries(groups)) {
      // דלג על דפוסים שכבר קיימים
      if (existingDescriptions.has(key)) continue;
      // דרוש לפחות 2 הופעות
      if (txns.length < 2) continue;

      // בדוק שמופיע ב-2+ חודשים שונים
      const months = new Set(txns.map(t => {
        const d = new Date(t.date);
        return `${d.getFullYear()}-${d.getMonth()}`;
      }));
      if (months.size < 2) continue;

      // בדוק עקביות סכום (±15%)
      const amounts = txns.map(t => t.amount);
      const avgAmount = amounts.reduce((s, a) => s + a, 0) / amounts.length;
      const allSimilar = amounts.every(a => Math.abs(a - avgAmount) / avgAmount <= 0.15);
      if (!allSimilar) continue;

      // זהה יום-בחודש דומינטי
      const days = txns.map(t => new Date(t.date).getDate());
      const dayFreq = {};
      days.forEach(d => { dayFreq[d] = (dayFreq[d] || 0) + 1; });
      const [dominantDay, dayCount] = Object.entries(dayFreq).sort(([, a], [, b]) => b - a)[0];
      const dayConsistency = dayCount / txns.length;

      // ציון ביטחון: חודשים שונים * עקביות יום
      const confidence = Math.min(1, (months.size / 6) * 0.6 + dayConsistency * 0.4);

      candidates.push({
        description: txns[0].description,
        amount: Math.round(avgAmount * 100) / 100,
        type: txns[0].type,
        category: txns[0].category || 'כללי',
        occurrenceCount: txns.length,
        monthsCount: months.size,
        suggestedDay: parseInt(dominantDay),
        confidence: Math.round(confidence * 100) / 100,
      });
    }

    // מיין לפי confidence ואז occurrenceCount
    candidates.sort((a, b) => b.confidence - a.confidence || b.occurrenceCount - a.occurrenceCount);

    res.json({ candidates: candidates.slice(0, 20) });
  } catch (error) {
    console.error('Error detecting recurring patterns:', error);
    res.status(500).json({ message: 'שגיאה בזיהוי דפוסים חוזרים' });
  }
};

// ──────────────────────────────────────────────────
// @desc   קבלת כל ההוצאות/הכנסות הקבועות
// @route  GET /api/recurring
// ──────────────────────────────────────────────────
export const getRecurringTransactions = async (req, res) => {
  try {
    const { active, type, subcategory } = req.query;
    const filter = { user: req.user._id };

    if (active !== undefined) filter.isActive = active === 'true';
    if (type) filter.type = type;
    if (subcategory) filter.subcategory = subcategory;

    const transactions = await RecurringTransaction.find(filter).sort({ nextExecution: 1 });

    // חישוב סיכומים
    const activeExpenses = transactions.filter(t => t.isActive && t.type === 'הוצאה' && !t.isPaused);
    const activeIncome = transactions.filter(t => t.isActive && t.type === 'הכנסה' && !t.isPaused);

    const summary = {
      totalMonthlyExpenses: activeExpenses.reduce((sum, t) => sum + (t.monthlyCost || 0), 0),
      totalMonthlyIncome: activeIncome.reduce((sum, t) => sum + (t.monthlyCost || 0), 0),
      totalAnnualExpenses: activeExpenses.reduce((sum, t) => sum + (t.annualCost || 0), 0),
      totalAnnualIncome: activeIncome.reduce((sum, t) => sum + (t.annualCost || 0), 0),
      activeCount: transactions.filter(t => t.isActive).length,
      pausedCount: transactions.filter(t => t.isPaused).length,
      subscriptionCount: transactions.filter(t => t.subcategory === 'subscription' && t.isActive).length,
    };

    res.json({ transactions, summary });
  } catch (error) {
    console.error('Error getting recurring transactions:', error);
    res.status(500).json({ message: 'שגיאה בטעינת הוצאות קבועות' });
  }
};

// ──────────────────────────────────────────────────
// @desc   הוספת עסקה קבועה חדשה
// @route  POST /api/recurring
// ──────────────────────────────────────────────────
export const addRecurringTransaction = async (req, res) => {
  try {
    const {
      description, amount, type, category, account,
      frequency, dayOfMonth, dayOfWeek, startDate, endDate,
      subcategory, provider, notes, remindDaysBefore
    } = req.body;

    if (!description || !amount || !type || !startDate) {
      return res.status(400).json({ message: 'תיאור, סכום, סוג ותאריך התחלה הם שדות חובה' });
    }

    const recurData = {
      user: req.user._id,
      description,
      amount: Math.abs(Number(amount)),
      type,
      category: category || 'כללי',
      account: account || 'checking',
      frequency: frequency || 'monthly',
      dayOfMonth,
      dayOfWeek,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
      subcategory: subcategory || 'other',
      provider,
      notes,
      remindDaysBefore: remindDaysBefore || 0,
    };

    // חישוב הביצוע הבא
    recurData.nextExecution = calculateNextExecution(recurData, new Date(startDate));

    const transaction = await RecurringTransaction.create(recurData);
    res.status(201).json(transaction);
  } catch (error) {
    console.error('Error adding recurring transaction:', error);
    res.status(500).json({ message: 'שגיאה בהוספת עסקה קבועה' });
  }
};

// ──────────────────────────────────────────────────
// @desc   עדכון עסקה קבועה
// @route  PUT /api/recurring/:id
// ──────────────────────────────────────────────────
export const updateRecurringTransaction = async (req, res) => {
  try {
    const transaction = await RecurringTransaction.findOne({ _id: req.params.id, user: req.user._id });
    if (!transaction) return res.status(404).json({ message: 'עסקה קבועה לא נמצאה' });

    const allowedFields = [
      'description', 'amount', 'type', 'category', 'account',
      'frequency', 'dayOfMonth', 'dayOfWeek', 'startDate', 'endDate',
      'isActive', 'isPaused', 'subcategory', 'provider', 'notes', 'remindDaysBefore'
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        transaction[field] = req.body[field];
      }
    }

    if (req.body.amount) transaction.amount = Math.abs(Number(req.body.amount));
    
    // חישוב מחדש של הביצוע הבא
    if (req.body.frequency || req.body.startDate) {
      transaction.nextExecution = calculateNextExecution(transaction);
    }

    await transaction.save();
    res.json(transaction);
  } catch (error) {
    console.error('Error updating recurring transaction:', error);
    res.status(500).json({ message: 'שגיאה בעדכון עסקה קבועה' });
  }
};

// ──────────────────────────────────────────────────
// @desc   מחיקת עסקה קבועה
// @route  DELETE /api/recurring/:id
// ──────────────────────────────────────────────────
export const deleteRecurringTransaction = async (req, res) => {
  try {
    const transaction = await RecurringTransaction.findOneAndDelete({ 
      _id: req.params.id, 
      user: req.user._id 
    });
    if (!transaction) return res.status(404).json({ message: 'עסקה קבועה לא נמצאה' });
    res.json({ message: 'העסקה הקבועה נמחקה בהצלחה' });
  } catch (error) {
    console.error('Error deleting recurring transaction:', error);
    res.status(500).json({ message: 'שגיאה במחיקת עסקה קבועה' });
  }
};

// ──────────────────────────────────────────────────
// @desc   השהיה / הפעלה מחדש
// @route  POST /api/recurring/:id/toggle
// ──────────────────────────────────────────────────
export const toggleRecurringTransaction = async (req, res) => {
  try {
    const transaction = await RecurringTransaction.findOne({ _id: req.params.id, user: req.user._id });
    if (!transaction) return res.status(404).json({ message: 'עסקה קבועה לא נמצאה' });

    transaction.isPaused = !transaction.isPaused;
    await transaction.save();

    res.json({ 
      message: transaction.isPaused ? 'העסקה הושהתה' : 'העסקה הופעלה מחדש',
      transaction 
    });
  } catch (error) {
    console.error('Error toggling recurring transaction:', error);
    res.status(500).json({ message: 'שגיאה בשינוי סטטוס' });
  }
};

// ──────────────────────────────────────────────────
// @desc   תחזית תזרים מזומנים
// @route  GET /api/recurring/cashflow?months=3
// ──────────────────────────────────────────────────
export const getCashflowForecast = async (req, res) => {
  try {
    const months = parseInt(req.query.months) || 3;
    const active = await RecurringTransaction.find({ 
      user: req.user._id, 
      isActive: true,
      isPaused: false 
    });

    const forecast = [];
    const today = startOfDay(new Date());

    for (let i = 0; i < months; i++) {
      const monthDate = addMonths(today, i);
      const monthNum = monthDate.getMonth() + 1;
      const yearNum = monthDate.getFullYear();

      let income = 0;
      let expenses = 0;

      for (const t of active) {
        // בדוק אם העסקה פעילה בתקופה
        if (t.endDate && isAfter(monthDate, t.endDate)) continue;
        if (isBefore(monthDate, t.startDate)) continue;

        const monthlyCost = t.monthlyCost || 0;
        if (t.type === 'הכנסה') income += monthlyCost;
        else expenses += monthlyCost;
      }

      forecast.push({
        month: monthNum,
        year: yearNum,
        income: Math.round(income),
        expenses: Math.round(expenses),
        net: Math.round(income - expenses),
      });
    }

    res.json({ forecast });
  } catch (error) {
    console.error('Error calculating cashflow:', error);
    res.status(500).json({ message: 'שגיאה בחישוב תחזית' });
  }
};
