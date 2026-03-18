import Loan from '../models/Loan.js';
import RateHistory from '../models/RateHistory.js'; // ייבוא מודל הריביות
import { calculateDynamicSchedule } from '../utils/loanCalculator.js';
import { scopeFilter } from '../utils/scopeFilter.js';

export const createLoan = async (req, res, next) => {
  try {
    // שים לב: אנחנו כבר לא מחשבים את לוח הסילוקין כאן
    const { name, principal, interestMargin, termInMonths, startDate, repaymentType } = req.body;
    
    // בבקשת יצירה, ה-annualRate שנשלח מהלקוח הוא בעצם המרווח
    const newLoan = await Loan.create({
      user: req.user.id,
      name,
      principal,
      interestMargin: interestMargin, // נשמור את המרווח
      termInMonths,
      startDate,
      repaymentType,
    });
    res.status(201).json(newLoan);
  } catch (error) {
    next(error);
  }
};

export const getLoans = async (req, res, next) => {
  try {
    const loans = await Loan.find(scopeFilter(req)).sort({ createdAt: -1 });
    res.status(200).json(loans);
  } catch (error) {
    next(error);
  }
};

export const getLoanById = async (req, res, next) => {
  try {
    const loan = await Loan.findOne({ _id: req.params.id, ...scopeFilter(req) }).lean(); // lean() for performance
    if (!loan) {
      return res.status(404).json({ message: 'הלוואה לא נמצאה' });
    }

    // שליפת היסטוריית הריביות
    const rateHistory = await RateHistory.find({ indexName: 'prime' }).sort({ date: 'asc' }).lean();

    // חישוב דינמי של לוח הסילוקין
    const amortizationSchedule = calculateDynamicSchedule({ loan, rateHistory });

    // הרכבת האובייקט המלא שיוחזר ללקוח
    const fullLoanDetails = {
      ...loan,
      amortizationSchedule
    };

    res.status(200).json(fullLoanDetails);
  } catch (error) {
    next(error);
  }
};