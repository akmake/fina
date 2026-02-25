// server/controllers/insuranceController.js
import Insurance from '../models/Insurance.js';

const TYPE_LABELS = {
  health: 'ביטוח בריאות',
  life: 'ביטוח חיים',
  disability: 'אובדן כושר עבודה',
  car_mandatory: 'ביטוח רכב חובה',
  car_comprehensive: 'ביטוח רכב מקיף',
  home_structure: 'ביטוח מבנה',
  home_contents: 'ביטוח תכולה',
  travel: 'ביטוח נסיעות',
  dental: 'ביטוח שיניים',
  umbrella: 'ביטוח מטריה',
  business: 'ביטוח עסקי',
  other: 'אחר',
};

// GET /api/insurance
export const getInsurancePolicies = async (req, res) => {
  try {
    const policies = await Insurance.find({ user: req.user._id }).sort({ type: 1 });

    // קיבוץ לפי סוג
    const grouped = {};
    for (const p of policies) {
      const key = p.type;
      if (!grouped[key]) grouped[key] = { type: key, label: TYPE_LABELS[key] || key, policies: [] };
      grouped[key].policies.push(p);
    }

    // סיכום
    const totalMonthlyCost = policies.filter(p => p.status === 'active').reduce((s, p) => s + (p.monthlyCost || 0), 0);
    const totalAnnualCost = policies.filter(p => p.status === 'active').reduce((s, p) => s + (p.annualCost || 0), 0);
    const renewalsSoon = policies.filter(p => p.isRenewalSoon);
    const activePolicies = policies.filter(p => p.status === 'active').length;

    res.json({
      policies,
      grouped: Object.values(grouped),
      summary: { totalMonthlyCost, totalAnnualCost, activePolicies, renewalsSoon: renewalsSoon.length },
      typeLabels: TYPE_LABELS,
    });
  } catch (error) {
    console.error('Error fetching insurance:', error);
    res.status(500).json({ message: 'שגיאה בטעינת ביטוחים' });
  }
};

// POST /api/insurance
export const addInsurancePolicy = async (req, res) => {
  try {
    const policy = await Insurance.create({ ...req.body, user: req.user._id });
    res.status(201).json(policy);
  } catch (error) {
    console.error('Error adding insurance:', error);
    res.status(500).json({ message: 'שגיאה בהוספת פוליסה' });
  }
};

// PUT /api/insurance/:id
export const updateInsurancePolicy = async (req, res) => {
  try {
    const policy = await Insurance.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!policy) return res.status(404).json({ message: 'פוליסה לא נמצאה' });
    res.json(policy);
  } catch (error) {
    console.error('Error updating insurance:', error);
    res.status(500).json({ message: 'שגיאה בעדכון פוליסה' });
  }
};

// DELETE /api/insurance/:id
export const deleteInsurancePolicy = async (req, res) => {
  try {
    const policy = await Insurance.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!policy) return res.status(404).json({ message: 'פוליסה לא נמצאה' });
    res.json({ message: 'פוליסה נמחקה' });
  } catch (error) {
    console.error('Error deleting insurance:', error);
    res.status(500).json({ message: 'שגיאה במחיקת פוליסה' });
  }
};
