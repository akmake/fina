// server/controllers/debtController.js
import Loan from '../models/Loan.js';
import Mortgage from '../models/Mortgage.js';
import FinanceProfile from '../models/FinanceProfile.js';
import RecurringTransaction from '../models/RecurringTransaction.js';
import Transaction from '../models/Transaction.js';
import { subMonths } from 'date-fns';

// GET /api/debts — תמונת חובות מלאה
export const getDebtOverview = async (req, res) => {
  try {
    const userId = req.user._id;

    const [loans, mortgages, profile, recurring] = await Promise.all([
      Loan.find({ user: userId }),
      Mortgage.find({ user: userId, status: 'active' }),
      FinanceProfile.findOne({ user: userId }),
      RecurringTransaction.find({ user: userId, isActive: true, subcategory: 'loan_payment' }),
    ]);

    // ── חובות ────────────────────────────
    const debts = [];

    // הלוואות רגילות
    for (const loan of loans) {
      debts.push({
        id: loan._id,
        type: 'loan',
        name: loan.name,
        balance: loan.principal,
        interestRate: loan.interestMargin || 0,
        monthlyPayment: recurring.find(r => r.description?.includes(loan.name))?.monthlyCost || 0,
        startDate: loan.startDate,
        termInMonths: loan.termInMonths,
        source: 'loans',
      });
    }

    // משכנתאות (כל מסלול = חוב נפרד)
    for (const m of mortgages) {
      for (const track of m.tracks) {
        debts.push({
          id: m._id,
          trackId: track._id,
          type: 'mortgage',
          name: `משכנתא - ${track.name}`,
          balance: track.currentBalance,
          interestRate: track.interestRate,
          monthlyPayment: track.monthlyPayment,
          remainingMonths: track.remainingMonths || track.termInMonths,
          trackType: track.type,
          source: 'mortgage',
        });
      }
    }

    // מינוס בעו"ש
    const overdraft = profile?.checking < 0 ? Math.abs(profile.checking) : 0;
    if (overdraft > 0) {
      debts.push({
        id: 'overdraft',
        type: 'overdraft',
        name: 'מינוס בעו"ש',
        balance: overdraft,
        interestRate: 6.5, // ריבית מינוס ממוצעת
        monthlyPayment: 0,
        source: 'profile',
      });
    }

    // מיון לפי ריבית (Avalanche) ולפי יתרה (Snowball)
    const avalancheOrder = [...debts].sort((a, b) => b.interestRate - a.interestRate);
    const snowballOrder = [...debts].sort((a, b) => a.balance - b.balance);

    // סיכום
    const totalDebt = debts.reduce((s, d) => s + d.balance, 0);
    const totalMonthlyPayments = debts.reduce((s, d) => s + d.monthlyPayment, 0);

    // חישוב "מתי אצא מחובות"
    let debtFreeMonths = 0;
    if (totalMonthlyPayments > 0 && totalDebt > 0) {
      // פשוט: חוב / תשלום חודשי (בלי ריבית — אומדן)
      debtFreeMonths = Math.ceil(totalDebt / totalMonthlyPayments);
    }

    // הכנסה חודשית לחישוב יחס
    const monthlyIncome = recurring
      .filter(r => r.type === 'הכנסה')
      .reduce((s, r) => s + (r.monthlyCost || 0), 0) || 10000;
    const debtToIncomeRatio = monthlyIncome > 0 ? (totalMonthlyPayments / monthlyIncome) * 100 : 0;

    res.json({
      debts,
      avalancheOrder,
      snowballOrder,
      summary: {
        totalDebt,
        totalMonthlyPayments,
        debtFreeMonths,
        debtToIncomeRatio: Number(debtToIncomeRatio.toFixed(1)),
        debtCount: debts.length,
        hasOverdraft: overdraft > 0,
        overdraftAmount: overdraft,
      },
    });
  } catch (error) {
    console.error('Error fetching debt overview:', error);
    res.status(500).json({ message: 'שגיאה בטעינת נתוני חובות' });
  }
};

// POST /api/debts/simulate — סימולציית פירעון
export const simulatePayoff = async (req, res) => {
  try {
    const { debts, extraMonthly = 0, strategy = 'avalanche' } = req.body;

    if (!debts || debts.length === 0) {
      return res.status(400).json({ message: 'לא נמסרו חובות' });
    }

    // העתק עמוק
    let remainingDebts = debts.map(d => ({
      name: d.name,
      balance: d.balance,
      interestRate: d.interestRate,
      monthlyPayment: d.monthlyPayment,
    }));

    // מיון לפי אסטרטגיה
    if (strategy === 'avalanche') {
      remainingDebts.sort((a, b) => b.interestRate - a.interestRate);
    } else {
      remainingDebts.sort((a, b) => a.balance - b.balance);
    }

    const timeline = [];
    let month = 0;
    const maxMonths = 600; // מקסימום 50 שנה

    while (remainingDebts.some(d => d.balance > 0) && month < maxMonths) {
      month++;
      let extraLeft = extraMonthly;

      for (const d of remainingDebts) {
        if (d.balance <= 0) continue;

        // ריבית חודשית
        const interest = d.balance * (d.interestRate / 100) / 12;
        d.balance += interest;

        // תשלום רגיל
        const payment = Math.min(d.monthlyPayment, d.balance);
        d.balance -= payment;

        // תשלום נוסף (לחוב הראשון ברשימה שעדיין חיובי)
        if (extraLeft > 0 && d.balance > 0) {
          const extra = Math.min(extraLeft, d.balance);
          d.balance -= extra;
          extraLeft -= extra;
        }

        d.balance = Math.max(0, d.balance);
      }

      const totalRemaining = remainingDebts.reduce((s, d) => s + d.balance, 0);
      timeline.push({
        month,
        totalRemaining: Math.round(totalRemaining),
        debtsRemaining: remainingDebts.filter(d => d.balance > 0).length,
      });

      // סנן חובות שנגמרו
      remainingDebts = remainingDebts.filter(d => d.balance > 0 || true); // שמור הכל לצפייה
    }

    // חישוב ללא תוספת
    let baselineMonths = 0;
    let baseDebts = debts.map(d => ({ ...d, balance: d.balance }));
    while (baseDebts.some(d => d.balance > 0) && baselineMonths < maxMonths) {
      baselineMonths++;
      for (const d of baseDebts) {
        if (d.balance <= 0) continue;
        d.balance += d.balance * (d.interestRate / 100) / 12;
        d.balance -= Math.min(d.monthlyPayment, d.balance);
        d.balance = Math.max(0, d.balance);
      }
    }

    res.json({
      strategy,
      monthsToPayoff: month,
      baselineMonths,
      savedMonths: baselineMonths - month,
      timeline: timeline.filter((_, i) => i % 3 === 0 || i === timeline.length - 1), // כל 3 חודשים
    });
  } catch (error) {
    console.error('Error simulating payoff:', error);
    res.status(500).json({ message: 'שגיאה בסימולציית פירעון' });
  }
};
