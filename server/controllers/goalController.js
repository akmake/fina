// server/controllers/goalController.js
import Goal from '../models/Goal.js';
import { scopeFilter } from '../utils/scopeFilter.js';

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

// DELETE /api/goals/:id
export const deleteGoal = async (req, res) => {
  try {
    const goal = await Goal.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!goal) return res.status(404).json({ message: 'יעד לא נמצא' });
    res.json({ message: 'יעד נמחק' });
  } catch (error) {
    console.error('Error deleting goal:', error);
    res.status(500).json({ message: 'שגיאה במחיקת יעד' });
  }
};
