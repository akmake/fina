// server/controllers/mortgageController.js
import Mortgage from '../models/Mortgage.js';

// GET /api/mortgages
export const getMortgages = async (req, res) => {
  try {
    const mortgages = await Mortgage.find({ user: req.user._id }).sort({ startDate: -1 });

    const summary = {
      totalBalance: mortgages.reduce((s, m) => s + (m.totalCurrentBalance || 0), 0),
      totalMonthlyPayment: mortgages.reduce((s, m) => s + (m.totalMonthlyPayment || 0), 0),
      count: mortgages.length,
      avgWeightedRate: 0,
    };

    if (summary.totalBalance > 0) {
      summary.avgWeightedRate = mortgages.reduce(
        (s, m) => s + (m.weightedInterestRate * m.totalCurrentBalance / summary.totalBalance), 0
      );
    }

    res.json({ mortgages, summary });
  } catch (error) {
    console.error('Error fetching mortgages:', error);
    res.status(500).json({ message: 'שגיאה בטעינת משכנתאות' });
  }
};

// POST /api/mortgages
export const addMortgage = async (req, res) => {
  try {
    const mortgage = await Mortgage.create({ ...req.body, user: req.user._id });
    res.status(201).json(mortgage);
  } catch (error) {
    console.error('Error adding mortgage:', error);
    res.status(500).json({ message: 'שגיאה בהוספת משכנתא' });
  }
};

// PUT /api/mortgages/:id
export const updateMortgage = async (req, res) => {
  try {
    const mortgage = await Mortgage.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!mortgage) return res.status(404).json({ message: 'משכנתא לא נמצאה' });
    res.json(mortgage);
  } catch (error) {
    console.error('Error updating mortgage:', error);
    res.status(500).json({ message: 'שגיאה בעדכון משכנתא' });
  }
};

// DELETE /api/mortgages/:id
export const deleteMortgage = async (req, res) => {
  try {
    const mortgage = await Mortgage.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!mortgage) return res.status(404).json({ message: 'משכנתא לא נמצאה' });
    res.json({ message: 'משכנתא נמחקה' });
  } catch (error) {
    console.error('Error deleting mortgage:', error);
    res.status(500).json({ message: 'שגיאה במחיקת משכנתא' });
  }
};

// POST /api/mortgages/:id/simulate-refinance
export const simulateRefinance = async (req, res) => {
  try {
    const mortgage = await Mortgage.findOne({ _id: req.params.id, user: req.user._id });
    if (!mortgage) return res.status(404).json({ message: 'משכנתא לא נמצאה' });

    // --- תוספת/תיקון: קבלת סוג ההחזר המבוקש מהלקוח לסימולציה ---
    const { newRate, newTermMonths, newRepaymentType = 'שפיצר' } = req.body;
    const totalBalance = mortgage.totalCurrentBalance;

    const monthlyRate = (newRate / 100) / 12;
    let newMonthlyPayment;
    let newTotalPayments = 0;

    // --- תוספת/תיקון: תמיכה גם בשפיצר וגם בקרן שווה בסימולטור המיחזור ---
    if (newRepaymentType === 'קרן שווה') {
      const principalPerMonth = totalBalance / newTermMonths;
      // בקרן שווה התשלום הראשון הוא הגבוה ביותר, ולכן נציג אותו כ"החזר חודשי" להשוואה
      newMonthlyPayment = principalPerMonth + (totalBalance * monthlyRate);

      for (let i = 1; i <= newTermMonths; i++) {
        newTotalPayments += principalPerMonth + ((totalBalance - (i - 1) * principalPerMonth) * monthlyRate);
      }
    } else { // ברירת מחדל: שפיצר
      if (monthlyRate === 0) {
        newMonthlyPayment = totalBalance / newTermMonths;
      } else {
        newMonthlyPayment = totalBalance * (monthlyRate * Math.pow(1 + monthlyRate, newTermMonths)) /
          (Math.pow(1 + monthlyRate, newTermMonths) - 1);
      }
      newTotalPayments = newMonthlyPayment * newTermMonths;
    }

    const currentMonthlyPayment = mortgage.totalMonthlyPayment;
    const currentTotalRemaining = mortgage.tracks.reduce((sum, t) => {
      return sum + (t.monthlyPayment * (t.remainingMonths || t.termInMonths));
    }, 0);

    res.json({
      currentMonthlyPayment,
      newMonthlyPayment: Math.round(newMonthlyPayment),
      monthlySavings: Math.round(currentMonthlyPayment - newMonthlyPayment),
      currentTotalRemaining: Math.round(currentTotalRemaining),
      newTotalPayments: Math.round(newTotalPayments),
      totalSavings: Math.round(currentTotalRemaining - newTotalPayments),
      newRate,
      newTermMonths,
      newRepaymentType // מחזירים גם את השיטה לטובת הלקוח
    });
  } catch (error) {
    console.error('Error simulating refinance:', error);
    res.status(500).json({ message: 'שגיאה בסימולציית מיחזור' });
  }
};

// GET /api/mortgages/:id/prime-scenario
export const primeScenario = async (req, res) => {
  try {
    const mortgage = await Mortgage.findOne({ _id: req.params.id, user: req.user._id });
    if (!mortgage) return res.status(404).json({ message: 'משכנתא לא נמצאה' });

    const scenarios = [
      { primeChange: -1.0, label: 'ירידת 1%' },
      { primeChange: -0.5, label: 'ירידת 0.5%' },
      { primeChange: 0, label: 'ללא שינוי' },
      { primeChange: 0.5, label: 'עליית 0.5%' },
      { primeChange: 1.0, label: 'עליית 1%' },
      { primeChange: 1.5, label: 'עליית 1.5%' },
      { primeChange: 2.0, label: 'עליית 2%' },
    ];

    const results = scenarios.map(s => {
      let totalMonthly = 0;
      for (const track of mortgage.tracks) {
        let effectiveRate = track.interestRate;
        if (track.type === 'prime') {
          effectiveRate += s.primeChange;
        }
        const monthlyRate = (effectiveRate / 100) / 12;
        const remaining = track.remainingMonths || track.termInMonths;
        let payment;
        if (monthlyRate <= 0) {
          payment = track.currentBalance / remaining;
        } else {
          payment = track.currentBalance * (monthlyRate * Math.pow(1 + monthlyRate, remaining)) /
            (Math.pow(1 + monthlyRate, remaining) - 1);
        }
        totalMonthly += payment;
      }
      return {
        ...s,
        monthlyPayment: Math.round(totalMonthly),
        diff: Math.round(totalMonthly - mortgage.totalMonthlyPayment),
      };
    });

    res.json({ results, currentPayment: mortgage.totalMonthlyPayment });
  } catch (error) {
    console.error('Error in prime scenario:', error);
    res.status(500).json({ message: 'שגיאה בסימולציית ריבית פריים' });
  }
};