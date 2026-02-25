// server/controllers/pensionController.js
import Pension from '../models/Pension.js';

// ──────────────────────────────────────────────────
// תוויות בעברית לסוגי מוצרים
// ──────────────────────────────────────────────────
const PRODUCT_LABELS = {
  pension: 'קרן פנסיה',
  education_fund: 'קרן השתלמות',
  provident_fund: 'קופת גמל',
  managers_insurance: 'ביטוח מנהלים',
  savings_policy: 'פוליסת חיסכון',
};

// ──────────────────────────────────────────────────
// @desc   קבלת כל המוצרים הפנסיוניים
// @route  GET /api/pension
// ──────────────────────────────────────────────────
export const getPensionProducts = async (req, res) => {
  try {
    const { type, status } = req.query;
    const filter = { user: req.user._id };
    if (type) filter.productType = type;
    if (status) filter.status = status || 'active';

    const products = await Pension.find(filter).sort({ productType: 1, createdAt: -1 });

    // סיכום לפי סוג מוצר
    const summary = {};
    let totalBalance = 0;
    let totalMonthlyContribs = 0;
    let totalAnnualManagementCost = 0;

    products.forEach(p => {
      if (!summary[p.productType]) {
        summary[p.productType] = {
          label: PRODUCT_LABELS[p.productType],
          count: 0,
          totalBalance: 0,
          totalMonthlyContribution: 0,
        };
      }
      const group = summary[p.productType];
      group.count++;
      group.totalBalance += p.currentBalance;
      group.totalMonthlyContribution += p.totalMonthlyContribution || 0;

      totalBalance += p.currentBalance;
      totalMonthlyContribs += p.totalMonthlyContribution || 0;
      totalAnnualManagementCost += p.annualManagementCost || 0;
    });

    res.json({
      products,
      summary,
      totals: {
        totalBalance,
        totalMonthlyContribs,
        totalAnnualContribs: totalMonthlyContribs * 12,
        totalAnnualManagementCost,
        productCount: products.length,
      }
    });
  } catch (error) {
    console.error('Error getting pension products:', error);
    res.status(500).json({ message: 'שגיאה בטעינת נתונים פנסיוניים' });
  }
};

// ──────────────────────────────────────────────────
// @desc   הוספת מוצר פנסיוני
// @route  POST /api/pension
// ──────────────────────────────────────────────────
export const addPensionProduct = async (req, res) => {
  try {
    const { productType, name, startDate } = req.body;

    if (!productType || !name || !startDate) {
      return res.status(400).json({ message: 'סוג מוצר, שם ותאריך התחלה הם שדות חובה' });
    }

    if (!Object.keys(PRODUCT_LABELS).includes(productType)) {
      return res.status(400).json({ message: 'סוג מוצר לא תקין' });
    }

    // לקרן השתלמות – חישוב תאריך פדיון (6 שנים)
    let maturityDate = req.body.maturityDate;
    if (productType === 'education_fund' && !maturityDate) {
      const start = new Date(startDate);
      maturityDate = new Date(start.getFullYear() + 6, start.getMonth(), start.getDate());
    }

    const product = await Pension.create({
      ...req.body,
      user: req.user._id,
      maturityDate,
    });

    res.status(201).json(product);
  } catch (error) {
    console.error('Error adding pension product:', error);
    res.status(500).json({ message: 'שגיאה בהוספת מוצר פנסיוני' });
  }
};

// ──────────────────────────────────────────────────
// @desc   עדכון מוצר פנסיוני
// @route  PUT /api/pension/:id
// ──────────────────────────────────────────────────
export const updatePensionProduct = async (req, res) => {
  try {
    const product = await Pension.findOne({ _id: req.params.id, user: req.user._id });
    if (!product) return res.status(404).json({ message: 'מוצר פנסיוני לא נמצא' });

    const allowedFields = [
      'name', 'policyNumber', 'company', 'track',
      'monthlyEmployeeContribution', 'monthlyEmployerContribution', 'monthlySeveranceContribution',
      'currentBalance', 'totalDeposited', 'lastYearReturn', 'totalReturn',
      'managementFeeDeposits', 'managementFeeBalance',
      'maturityDate', 'status', 'beneficiaries', 'grossSalary', 'notes'
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        product[field] = req.body[field];
      }
    }

    product.lastUpdated = new Date();
    await product.save();
    res.json(product);
  } catch (error) {
    console.error('Error updating pension product:', error);
    res.status(500).json({ message: 'שגיאה בעדכון מוצר פנסיוני' });
  }
};

// ──────────────────────────────────────────────────
// @desc   מחיקת מוצר פנסיוני
// @route  DELETE /api/pension/:id
// ──────────────────────────────────────────────────
export const deletePensionProduct = async (req, res) => {
  try {
    const product = await Pension.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!product) return res.status(404).json({ message: 'מוצר פנסיוני לא נמצא' });
    res.json({ message: 'המוצר הפנסיוני נמחק בהצלחה' });
  } catch (error) {
    console.error('Error deleting pension product:', error);
    res.status(500).json({ message: 'שגיאה במחיקת מוצר פנסיוני' });
  }
};

// ──────────────────────────────────────────────────
// @desc   סימולציית פנסיה – כמה יהיה בגיל פרישה
// @route  GET /api/pension/retirement-simulation
// ──────────────────────────────────────────────────
export const getRetirementSimulation = async (req, res) => {
  try {
    const currentAge = parseInt(req.query.age) || 30;
    const retirementAge = parseInt(req.query.retirementAge) || 67;
    const expectedReturn = parseFloat(req.query.expectedReturn) || 4; // %

    const products = await Pension.find({ 
      user: req.user._id, 
      status: 'active',
      productType: { $in: ['pension', 'managers_insurance', 'provident_fund'] }
    });

    const yearsToRetirement = retirementAge - currentAge;
    const monthsToRetirement = yearsToRetirement * 12;
    const monthlyReturn = expectedReturn / 100 / 12;

    let projectedTotal = 0;

    products.forEach(p => {
      const currentBalance = p.currentBalance || 0;
      const monthlyContrib = p.totalMonthlyContribution || 0;

      // FV = PV * (1 + r)^n + PMT * ((1 + r)^n - 1) / r
      const fvCurrent = currentBalance * Math.pow(1 + monthlyReturn, monthsToRetirement);
      const fvContribs = monthlyReturn > 0 
        ? monthlyContrib * ((Math.pow(1 + monthlyReturn, monthsToRetirement) - 1) / monthlyReturn)
        : monthlyContrib * monthsToRetirement;

      projectedTotal += fvCurrent + fvContribs;
    });

    // חישוב קצבה חודשית משוערת (על פי מקדם 200)
    const estimatedMonthlyPension = projectedTotal / 200;

    res.json({
      currentAge,
      retirementAge,
      yearsToRetirement,
      expectedReturn,
      currentTotalBalance: products.reduce((s, p) => s + (p.currentBalance || 0), 0),
      totalMonthlyContrib: products.reduce((s, p) => s + (p.totalMonthlyContribution || 0), 0),
      projectedTotal: Math.round(projectedTotal),
      estimatedMonthlyPension: Math.round(estimatedMonthlyPension),
      productsIncluded: products.length,
    });
  } catch (error) {
    console.error('Error calculating retirement simulation:', error);
    res.status(500).json({ message: 'שגיאה בחישוב סימולציית פרישה' });
  }
};
