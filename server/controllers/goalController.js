// server/controllers/goalController.js
import Goal from '../models/Goal.js';
import { scopeFilter } from '../utils/scopeFilter.js';
import { audit } from '../utils/audit.js';
import { recomputeGoal, recomputeAllGoals } from '../services/goalTrackingService.js';

const CATEGORY_LABELS = {
  home_purchase: 'קניית דירה',
  emergency_fund: 'קרן חירום',
  wedding: 'חתונה',
  vacation: 'חופשה',
  car: 'רכב',
  education: 'לימודים',
  renovation: 'שיפוץ',
  retirement: 'פרישה',
  debt_payoff: 'סילוק חוב',
  investment: 'השקעה',
  children: 'ילדים',
  other: 'אחר',
};

const CATEGORY_ICONS = {
  home_purchase: '🏠',
  emergency_fund: '🛡️',
  wedding: '💍',
  vacation: '✈️',
  car: '🚗',
  education: '🎓',
  renovation: '🔨',
  retirement: '🏖️',
  debt_payoff: '💳',
  investment: '📈',
  children: '👶',
  other: '🎯',
};

// GET /api/goals
export const getGoals = async (req, res) => {
  try {
    // רענון יעדים מחוברים (§5.6) לפני החזרה, כדי שהרשימה תשקף נתונים חיים.
    // best-effort — כשל ברענון לא מפיל את הטעינה.
    await recomputeAllGoals(scopeFilter(req)).catch(() => {});

    const goals = await Goal.find(scopeFilter(req)).sort({ priority: 1, createdAt: -1 });

    const activeGoals = goals.filter(g => g.status === 'active');
    const summary = {
      total: goals.length,
      active: activeGoals.length,
      completed: goals.filter(g => g.status === 'completed').length,
      totalTarget: activeGoals.reduce((s, g) => s + g.targetAmount, 0),
      totalSaved: activeGoals.reduce((s, g) => s + g.currentAmount, 0),
      totalMonthlyContribution: activeGoals.reduce((s, g) => s + (g.monthlyContribution || 0), 0),
      onTrack: activeGoals.filter(g => g.isOnTrack).length,
      behindSchedule: activeGoals.filter(g => !g.isOnTrack).length,
    };
    summary.overallProgress = summary.totalTarget > 0
      ? (summary.totalSaved / summary.totalTarget) * 100 : 0;

    res.json({ goals, summary, categoryLabels: CATEGORY_LABELS, categoryIcons: CATEGORY_ICONS });
  } catch (error) {
    console.error('Error fetching goals:', error);
    res.status(500).json({ message: 'שגיאה בטעינת יעדים' });
  }
};

// POST /api/goals
export const addGoal = async (req, res) => {
  try {
    const body = { ...req.body, user: req.user._id };
    if (!body.icon && body.category) body.icon = CATEGORY_ICONS[body.category] || '🎯';
    const goal = await Goal.create(body);
    res.status(201).json(goal);
  } catch (error) {
    console.error('Error adding goal:', error);
    res.status(500).json({ message: 'שגיאה בהוספת יעד' });
  }
};

// PUT /api/goals/:id
export const updateGoal = async (req, res) => {
  try {
    const goal = await Goal.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!goal) return res.status(404).json({ message: 'יעד לא נמצא' });
    
    // בדיקת השלמת יעד
    if (goal.currentAmount >= goal.targetAmount && goal.status === 'active') {
      goal.status = 'completed';
      await goal.save();
    }

    res.json(goal);
  } catch (error) {
    console.error('Error updating goal:', error);
    res.status(500).json({ message: 'שגיאה בעדכון יעד' });
  }
};

// POST /api/goals/:id/deposit — הפקדה ליעד
export const depositToGoal = async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ message: 'סכום לא תקין' });

    const goal = await Goal.findOne({ _id: req.params.id, user: req.user._id });
    if (!goal) return res.status(404).json({ message: 'יעד לא נמצא' });

    goal.currentAmount += amount;

    // בדיקת מיילסטונים
    for (const ms of goal.milestones) {
      if (!ms.isReached && goal.currentAmount >= ms.targetAmount) {
        ms.isReached = true;
        ms.reachedDate = new Date();
      }
    }

    // בדיקת סיום
    if (goal.currentAmount >= goal.targetAmount) {
      goal.status = 'completed';
    }

    await goal.save();
    res.json(goal);
  } catch (error) {
    console.error('Error depositing to goal:', error);
    res.status(500).json({ message: 'שגיאה בהפקדה ליעד' });
  }
};

// POST /api/goals/:id/recompute — רענון יעד מחובר יחיד מהמקור המקושר (§5.6)
export const recomputeGoalHandler = async (req, res) => {
  try {
    const goal = await Goal.findOne({ _id: req.params.id, ...scopeFilter(req) });
    if (!goal) return res.status(404).json({ message: 'יעד לא נמצא' });
    const { changed } = await recomputeGoal(goal, scopeFilter(req));
    res.json({ goal, changed });
  } catch (error) {
    console.error('Error recomputing goal:', error);
    res.status(500).json({ message: 'שגיאה ברענון היעד' });
  }
};

// POST /api/goals/recompute-all — רענון כל היעדים המחוברים
export const recomputeAllHandler = async (req, res) => {
  try {
    const result = await recomputeAllGoals(scopeFilter(req));
    res.json(result);
  } catch (error) {
    console.error('Error recomputing goals:', error);
    res.status(500).json({ message: 'שגיאה ברענון היעדים' });
  }
};

// DELETE /api/goals/:id
export const deleteGoal = async (req, res) => {
  try {
    const goal = await Goal.softDeleteOne({ _id: req.params.id, user: req.user._id });
    if (!goal) return res.status(404).json({ message: 'יעד לא נמצא' });
    await audit(req, 'goal.delete', 'Goal', {
      entityId: goal._id,
      before: { name: goal.name, targetAmount: goal.targetAmount, currentAmount: goal.currentAmount },
    });
    res.json({ message: 'יעד נמחק' });
  } catch (error) {
    console.error('Error deleting goal:', error);
    res.status(500).json({ message: 'שגיאה במחיקת יעד' });
  }
};
