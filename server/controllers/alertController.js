// server/controllers/alertController.js
import Alert from '../models/Alert.js';
import Insurance from '../models/Insurance.js';
import Budget from '../models/Budget.js';
import Deposit from '../models/Deposit.js';
import Goal from '../models/Goal.js';
import Mortgage from '../models/Mortgage.js';
import Transaction from '../models/Transaction.js';
import RecurringTransaction from '../models/RecurringTransaction.js';
import { subDays, startOfMonth, endOfMonth, addDays } from 'date-fns';
import { scopeFilter } from '../utils/scopeFilter.js';

// GET /api/alerts
export const getAlerts = async (req, res) => {
  try {
    const alerts = await Alert.find({
      ...scopeFilter(req),
      isDismissed: false,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
    }).sort({ createdAt: -1 }).limit(50);

    const unreadCount = alerts.filter(a => !a.isRead).length;
    res.json({ alerts, unreadCount });
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({ message: 'שגיאה בטעינת התראות' });
  }
};

// POST /api/alerts/mark-read
export const markAlertsRead = async (req, res) => {
  try {
    const { alertIds } = req.body;
    if (alertIds && alertIds.length) {
      await Alert.updateMany(
        { _id: { $in: alertIds }, user: req.user._id },
        { isRead: true }
      );
    } else {
      await Alert.updateMany({ user: req.user._id, isRead: false }, { isRead: true });
    }
    res.json({ message: 'עודכנו כנקראו' });
  } catch (error) {
    res.status(500).json({ message: 'שגיאה בעדכון התראות' });
  }
};

// POST /api/alerts/:id/dismiss
export const dismissAlert = async (req, res) => {
  try {
    await Alert.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { isDismissed: true }
    );
    res.json({ message: 'התראה נדחתה' });
  } catch (error) {
    res.status(500).json({ message: 'שגיאה' });
  }
};

// POST /api/alerts/generate — יצירה אוטומטית של התראות
export const generateAlerts = async (req, res) => {
  try {
    const userId = req.user._id;
    const now = new Date();
    const newAlerts = [];

    // ── 1. חידוש ביטוח קרוב (30 יום) ────
    const insurances = await Insurance.find({
      ...scopeFilter(req), status: 'active',
      renewalDate: { $gte: now, $lte: addDays(now, 30) },
    });
    for (const ins of insurances) {
      const exists = await Alert.findOne({
        user: userId, type: 'insurance_renewal', relatedId: ins._id,
        createdAt: { $gte: subDays(now, 7) },
      });
      if (!exists) {
        newAlerts.push({
          user: userId,
          type: 'insurance_renewal',
          title: `חידוש ביטוח מתקרב`,
          message: `הפוליסה "${ins.name}" מתחדשת בקרוב. כדאי להשוות מחירים.`,
          icon: '🛡️',
          severity: 'warning',
          actionUrl: '/insurance',
          actionLabel: 'לביטוחים',
          relatedModel: 'Insurance',
          relatedId: ins._id,
          expiresAt: ins.renewalDate,
        });
      }
    }

    // ── 2. חריגה מתקציב ────────────────
    const thisMonth = now.getMonth() + 1;
    const thisYear = now.getFullYear();
    const budget = await Budget.findOne({ ...scopeFilter(req), month: thisMonth, year: thisYear });
    if (budget) {
      for (const item of budget.items) {
        const spent = item.spent || 0;
        const pct = item.limit > 0 ? (spent / item.limit) * 100 : 0;
        if (pct >= 100) {
          const exists = await Alert.findOne({
            user: userId, type: 'budget_exceeded',
            'title': { $regex: item.category },
            createdAt: { $gte: startOfMonth(now) },
          });
          if (!exists) {
            newAlerts.push({
              user: userId,
              type: 'budget_exceeded',
              title: `חריגה מתקציב: ${item.category}`,
              message: `הוצאת ${spent.toLocaleString()} ₪ מתוך ${item.limit.toLocaleString()} ₪ בקטגוריית "${item.category}" (${pct.toFixed(0)}%)`,
              icon: '🚨',
              severity: 'danger',
              actionUrl: '/budget',
              actionLabel: 'לתקציב',
              relatedModel: 'Budget',
              relatedId: budget._id,
            });
          }
        } else if (pct >= 80) {
          const exists = await Alert.findOne({
            user: userId, type: 'budget_warning',
            'title': { $regex: item.category },
            createdAt: { $gte: startOfMonth(now) },
          });
          if (!exists) {
            newAlerts.push({
              user: userId,
              type: 'budget_warning',
              title: `אזהרת תקציב: ${item.category}`,
              message: `כבר הוצאת ${pct.toFixed(0)}% מהתקציב בקטגוריית "${item.category}"`,
              icon: '⚠️',
              severity: 'warning',
              actionUrl: '/budget',
              actionLabel: 'לתקציב',
              relatedModel: 'Budget',
              relatedId: budget._id,
            });
          }
        }
      }
    }

    // ── 3. פיקדון מגיע לפדיון (14 יום) ──
    const deposits = await Deposit.find({
      ...scopeFilter(req), status: 'active',
      endDate: { $gte: now, $lte: addDays(now, 14) },
    });
    for (const dep of deposits) {
      const exists = await Alert.findOne({
        user: userId, type: 'deposit_maturity', relatedId: dep._id,
        createdAt: { $gte: subDays(now, 7) },
      });
      if (!exists) {
        newAlerts.push({
          user: userId,
          type: 'deposit_maturity',
          title: 'פיקדון מגיע לפדיון',
          message: `הפיקדון "${dep.name || 'ללא שם'}" מגיע לפדיון בקרוב`,
          icon: '💰',
          severity: 'info',
          actionUrl: '/deposits',
          actionLabel: 'לפיקדונות',
          relatedModel: 'Deposit',
          relatedId: dep._id,
        });
      }
    }

    // ── 4. יעדים שפיגרו ────────────────
    const goals = await Goal.find({ ...scopeFilter(req), status: 'active' });
    for (const goal of goals) {
      if (!goal.isOnTrack && goal.targetDate) {
        const exists = await Alert.findOne({
          user: userId, type: 'goal_behind', relatedId: goal._id,
          createdAt: { $gte: subDays(now, 7) },
        });
        if (!exists) {
          newAlerts.push({
            user: userId,
            type: 'goal_behind',
            title: `פיגור ביעד: ${goal.name}`,
            message: `הקצב הנוכחי לא מספיק להגיע ליעד "${goal.name}" בזמן. כדאי להגדיל הפקדות.`,
            icon: '📉',
            severity: 'warning',
            actionUrl: '/goals',
            actionLabel: 'ליעדים',
            relatedModel: 'Goal',
            relatedId: goal._id,
          });
        }
      }
    }

    // ── 5. שינוי ריבית משכנתא קרוב ────
    const mortgages = await Mortgage.find({ ...scopeFilter(req), status: 'active' });
    for (const m of mortgages) {
      for (const track of m.tracks) {
        if (track.nextRateChange) {
          const daysUntil = (new Date(track.nextRateChange) - now) / (1000 * 60 * 60 * 24);
          if (daysUntil >= 0 && daysUntil <= 90) {
            const exists = await Alert.findOne({
              user: userId, type: 'mortgage_rate_change', relatedId: m._id,
              createdAt: { $gte: subDays(now, 30) },
            });
            if (!exists) {
              newAlerts.push({
                user: userId,
                type: 'mortgage_rate_change',
                title: 'שינוי ריבית משכנתא מתקרב',
                message: `מסלול "${track.name}" ישתנה בעוד ${Math.round(daysUntil)} ימים. כדאי לבדוק אפשרויות מיחזור.`,
                icon: '🏦',
                severity: 'warning',
                actionUrl: '/mortgage',
                actionLabel: 'למשכנתא',
                relatedModel: 'Mortgage',
                relatedId: m._id,
              });
            }
          }
        }
      }
    }

    // ── 6. עסקה חריגה (כפולה / גדולה) ──
    const recent = await Transaction.find({
      ...scopeFilter(req),
      date: { $gte: subDays(now, 3) },
      type: 'הוצאה',
    }).sort({ amount: -1 });

    if (recent.length >= 2) {
      // בדיקת כפול
      for (let i = 0; i < recent.length - 1; i++) {
        for (let j = i + 1; j < recent.length; j++) {
          if (
            recent[i].amount === recent[j].amount &&
            recent[i].description === recent[j].description &&
            Math.abs(new Date(recent[i].date) - new Date(recent[j].date)) < 86400000
          ) {
            const exists = await Alert.findOne({
              user: userId, type: 'duplicate_charge',
              createdAt: { $gte: subDays(now, 3) },
              message: { $regex: recent[i].description },
            });
            if (!exists) {
              newAlerts.push({
                user: userId,
                type: 'duplicate_charge',
                title: 'חיוב כפול חשוד',
                message: `נמצאו 2 חיובים זהים: "${recent[i].description}" בסכום ${recent[i].amount} ₪`,
                icon: '🔍',
                severity: 'warning',
                actionUrl: '/portfolio',
                actionLabel: 'לעסקאות',
              });
            }
          }
        }
      }
    }

    if (newAlerts.length > 0) {
      await Alert.insertMany(newAlerts);
    }

    res.json({ generated: newAlerts.length, alerts: newAlerts });
  } catch (error) {
    console.error('Error generating alerts:', error);
    res.status(500).json({ message: 'שגיאה ביצירת התראות' });
  }
};
