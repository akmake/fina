// server/controllers/taxController.js
// חישוב מס הכנסה ישראלי כולל ביטוח לאומי ומס בריאות

// מדרגות מס הכנסה 2025/2026 (עדכון שנתי)
const TAX_BRACKETS = [
  { from: 0, to: 84120, rate: 10 },
  { from: 84121, to: 120720, rate: 14 },
  { from: 120721, to: 193800, rate: 20 },
  { from: 193801, to: 269280, rate: 31 },
  { from: 269281, to: 560280, rate: 35 },
  { from: 560281, to: 721560, rate: 47 },
  { from: 721561, to: Infinity, rate: 50 },
];

// ביטוח לאומי - שכיר (2025/2026)
const NI_BRACKETS_EMPLOYEE = [
  { from: 0, to: 7522, rate: 0.40 },        // חלק מופחת
  { from: 7522, to: 49030, rate: 7.00 },     // חלק מלא
];

// מס בריאות - שכיר
const HEALTH_BRACKETS_EMPLOYEE = [
  { from: 0, to: 7522, rate: 3.10 },
  { from: 7522, to: 49030, rate: 5.00 },
];

// ביטוח לאומי - עצמאי
const NI_BRACKETS_SELF = [
  { from: 0, to: 7522, rate: 2.87 },
  { from: 7522, to: 49030, rate: 12.83 },
];

// מס בריאות - עצמאי
const HEALTH_BRACKETS_SELF = [
  { from: 0, to: 7522, rate: 3.10 },
  { from: 7522, to: 49030, rate: 5.00 },
];

// ערך נקודת זיכוי 2025/2026
const CREDIT_POINT_VALUE = 2904; // שנתי

// נקודות זיכוי נפוצות
const CREDIT_POINTS_OPTIONS = {
  resident: { points: 2.25, label: 'תושב ישראל' },
  woman: { points: 0.5, label: 'אישה' },
  child_0_5: { points: 1.5, label: 'ילד 0-5 (לאם)' },
  child_6_17: { points: 1.0, label: 'ילד 6-17' },
  child_18: { points: 0.5, label: 'ילד שנת ה-18' },
  single_parent: { points: 1.0, label: 'הורה יחידני' },
  new_immigrant_1: { points: 3.0, label: 'עולה חדש (שנה 1-1.5)' },
  new_immigrant_2: { points: 2.0, label: 'עולה חדש (שנה 1.5-2)' },
  new_immigrant_3: { points: 1.0, label: 'עולה חדש (שנה 2-3.5)' },
  soldier: { points: 2.0, label: 'משוחרר/ת (2 שנה ראשונות)' },
  degree: { points: 1.0, label: 'תואר אקדמי (שנה ראשונה)' },
  disability: { points: 2.0, label: 'נכות' },
  periphery: { points: 0.5, label: 'יישוב ספר/פיתוח' },
};

function calculateBracketTax(annual, brackets) {
  let tax = 0;
  for (const b of brackets) {
    if (annual <= b.from) break;
    const taxable = Math.min(annual, b.to) - b.from;
    tax += taxable * (b.rate / 100);
  }
  return tax;
}

function calculateMonthlyBracketTax(monthly, brackets) {
  let tax = 0;
  for (const b of brackets) {
    if (monthly <= b.from) break;
    const taxable = Math.min(monthly, b.to) - b.from;
    tax += taxable * (b.rate / 100);
  }
  return tax;
}

// POST /api/tax/calculate
export const calculateTax = async (req, res) => {
  try {
    const {
      monthlyGross,           // שכר ברוטו חודשי
      employmentType = 'employee', // employee / self_employed
      creditPoints = [],      // מערך מפתחות נקודות זיכוי
      pensionDeposit = 0,     // הפקדה לפנסיה חודשית
      educationFund = 0,      // הפקדה לקרן השתלמות חודשית
      donations = 0,          // תרומות שנתיות (מעל 190₪)
      hasTaxExemptIncome = 0, // הכנסה פטורה (נכות, קצבאות וכו')
    } = req.body;

    if (!monthlyGross || monthlyGross <= 0) {
      return res.status(400).json({ message: 'שכר ברוטו לא תקין' });
    }

    const annualGross = monthlyGross * 12;

    // ── חישוב נקודות זיכוי ──────────────
    let totalCreditPoints = 0;
    const appliedCredits = [];
    for (const key of creditPoints) {
      const cp = CREDIT_POINTS_OPTIONS[key];
      if (cp) {
        totalCreditPoints += cp.points;
        appliedCredits.push({ key, ...cp });
      }
    }
    const totalCreditValue = totalCreditPoints * CREDIT_POINT_VALUE;

    // ── ניכויים מותרים (סעיף 47) ────────
    // הפקדה לפנסיה — עד 7% מ-תקרת 12,900 (2025)
    const pensionCeiling = 12900;
    const monthlyPensionDeductible = Math.min(pensionDeposit, pensionCeiling * 0.07);
    const annualPensionDeduction = monthlyPensionDeductible * 12;

    // קרן השתלמות — עד 2.5% מהשכר (תקרה)
    const eduCeiling = Math.min(monthlyGross, 15712);
    const monthlyEduDeductible = Math.min(educationFund, eduCeiling * 0.025);

    // הכנסה חייבת
    const annualTaxableIncome = Math.max(0, annualGross - annualPensionDeduction - hasTaxExemptIncome * 12);

    // ── חישוב מס הכנסה ─────────────────
    const grossIncomeTax = calculateBracketTax(annualTaxableIncome, TAX_BRACKETS);
    const incomeTaxAfterCredits = Math.max(0, grossIncomeTax - totalCreditValue);

    // זיכוי על תרומות (35% מעל 190₪, עד 30% מההכנסה)
    const donationCredit = donations > 190
      ? Math.min((donations - 190) * 0.35, annualTaxableIncome * 0.30)
      : 0;
    const finalIncomeTax = Math.max(0, incomeTaxAfterCredits - donationCredit);

    // ── ביטוח לאומי ומס בריאות ──────────
    const niBrackets = employmentType === 'employee' ? NI_BRACKETS_EMPLOYEE : NI_BRACKETS_SELF;
    const healthBrackets = employmentType === 'employee' ? HEALTH_BRACKETS_EMPLOYEE : HEALTH_BRACKETS_SELF;
    const monthlyNI = calculateMonthlyBracketTax(monthlyGross, niBrackets);
    const monthlyHealth = calculateMonthlyBracketTax(monthlyGross, healthBrackets);
    const annualNI = monthlyNI * 12;
    const annualHealth = monthlyHealth * 12;

    // ── סיכום ────────────────────────────
    const totalAnnualTax = finalIncomeTax + annualNI + annualHealth;
    const totalMonthlyTax = totalAnnualTax / 12;
    const monthlyNet = monthlyGross - totalMonthlyTax;
    const effectiveTaxRate = (totalAnnualTax / annualGross) * 100;
    const marginalTaxRate = TAX_BRACKETS.find(b => annualTaxableIncome <= b.to)?.rate || 50;

    // ── פירוט תוצאות ────────────────────
    res.json({
      input: { monthlyGross, employmentType, annualGross },

      incomeTax: {
        grossTax: Math.round(grossIncomeTax),
        creditPointsUsed: totalCreditPoints,
        creditValue: Math.round(totalCreditValue),
        donationCredit: Math.round(donationCredit),
        pensionDeduction: Math.round(annualPensionDeduction),
        finalAnnual: Math.round(finalIncomeTax),
        finalMonthly: Math.round(finalIncomeTax / 12),
      },

      nationalInsurance: {
        monthly: Math.round(monthlyNI),
        annual: Math.round(annualNI),
      },

      healthTax: {
        monthly: Math.round(monthlyHealth),
        annual: Math.round(annualHealth),
      },

      totals: {
        totalAnnualTax: Math.round(totalAnnualTax),
        totalMonthlyTax: Math.round(totalMonthlyTax),
        monthlyNet: Math.round(monthlyNet),
        annualNet: Math.round(monthlyNet * 12),
        effectiveTaxRate: Number(effectiveTaxRate.toFixed(1)),
        marginalTaxRate,
      },

      appliedCredits,
      creditPointOptions: CREDIT_POINTS_OPTIONS,
      taxBrackets: TAX_BRACKETS,
    });
  } catch (error) {
    console.error('Error calculating tax:', error);
    res.status(500).json({ message: 'שגיאה בחישוב מס' });
  }
};

// GET /api/tax/brackets
export const getTaxBrackets = async (req, res) => {
  res.json({
    taxBrackets: TAX_BRACKETS,
    creditPointValue: CREDIT_POINT_VALUE,
    creditPointOptions: CREDIT_POINTS_OPTIONS,
  });
};
