// server/controllers/childSavingsController.js
import ChildSavings from '../models/ChildSavings.js';
import { scopeFilter } from '../utils/scopeFilter.js';

const TYPE_LABELS = {
  government: 'חיסכון לכל ילד',
  provident_fund: 'קופת גמל להשקעה',
  bank_savings: 'חיסכון בנקאי',
  investment_account: 'חשבון השקעות',
  education_fund: 'קרן להשכלה גבוהה',
  other: 'אחר',
};

// GET /api/child-savings
export const getChildSavings = async (req, res) => {
  try {
    const savings = await ChildSavings.find(scopeFilter(req)).sort({ childName: 1 });

    // קיבוץ לפי ילד
    const byChild = {};
    for (const s of savings) {
      if (!byChild[s.childName]) {
        byChild[s.childName] = {
          childName: s.childName,
          childBirthDate: s.childBirthDate,
          childAge: s.childAge,
          accounts: [],
          totalBalance: 0,
          totalMonthlyDeposit: 0,
        };
      }
      byChild[s.childName].accounts.push(s);
      byChild[s.childName].totalBalance += s.currentBalance || 0;
      byChild[s.childName].totalMonthlyDeposit += s.monthlyDeposit || 0;
    }

    const summary = {
      totalChildren: Object.keys(byChild).length,
      totalAccounts: savings.length,
      totalBalance: savings.reduce((s, a) => s + (a.currentBalance || 0), 0),
      totalMonthlyDeposits: savings.reduce((s, a) => s + (a.monthlyDeposit || 0), 0),
      totalProfit: savings.reduce((s, a) => s + (a.profitLoss || 0), 0),
    };

    res.json({
      savings,
      byChild: Object.values(byChild),
      summary,
      typeLabels: TYPE_LABELS,
    });
  } catch (error) {
    console.error('Error fetching child savings:', error);
    res.status(500).json({ message: 'שגיאה בטעינת חיסכון ילדים' });
  }
};

// POST /api/child-savings
export const addChildSavings = async (req, res) => {
  try {
    const saving = await ChildSavings.create({ ...req.body, user: req.user._id });
    res.status(201).json(saving);
  } catch (error) {
    console.error('Error adding child savings:', error);
    res.status(500).json({ message: 'שגיאה בהוספת חיסכון' });
  }
};

// PUT /api/child-savings/:id
export const updateChildSavings = async (req, res) => {
  try {
    const saving = await ChildSavings.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!saving) return res.status(404).json({ message: 'חיסכון לא נמצא' });
    res.json(saving);
  } catch (error) {
    console.error('Error updating child savings:', error);
    res.status(500).json({ message: 'שגיאה בעדכון חיסכון' });
  }
};

// DELETE /api/child-savings/:id
export const deleteChildSavings = async (req, res) => {
  try {
    const saving = await ChildSavings.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!saving) return res.status(404).json({ message: 'חיסכון לא נמצא' });
    res.json({ message: 'חיסכון נמחק' });
  } catch (error) {
    console.error('Error deleting child savings:', error);
    res.status(500).json({ message: 'שגיאה במחיקת חיסכון' });
  }
};
