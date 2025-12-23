// server/controllers/depositController.js
import Deposit from '../models/Deposit.js';
import Account from '../models/Account.js';
import { add_months } from '../utils/dateHelpers.js';

// קבלת כל הפיקדונות של המשתמש
export const getDeposits = async (req, res) => {
  // אין שינוי כאן, השדה החדש יישלף אוטומטית
  const deposits = await Deposit.find({ user: req.user.id, status: 'active' }).sort({ endDate: 1 });
  res.json(deposits);
};

// הוספת פיקדון חדש
export const addDeposit = async (req, res) => {
  // --- שינוי ---
  // הוספת exitPoints לדסטרקטוריזציה, עם ערך ברירת מחדל למקרה שלא נשלח
  const { name, principal, annualInterestRate, startDate, durationValue, durationUnit, sourceAccount, exitPoints = [] } = req.body;
  // --- סוף שינוי ---
  
  if (!name || !principal || !annualInterestRate || !startDate || !durationValue || !durationUnit) {
    return res.status(400).json({ message: 'נא למלא את כל השדות' });
  }

  const endDate = add_months(new Date(startDate), durationUnit === 'שנים' ? durationValue * 12 : durationValue);

  // --- שינוי ---
  // הוספת exitPoints לאובייקט שנשמר במסד הנתונים
  const deposit = await Deposit.create({ 
      ...req.body, 
      user: req.user.id, 
      endDate,
      exitPoints // הוספת השדה החדש
  });
  // --- סוף שינוי ---

  if (sourceAccount && sourceAccount !== "ללא הורדה מחשבון") {
    await Account.findOneAndUpdate(
      { userId: req.user.id, name: sourceAccount },
      { $inc: { balance: -principal } }
    );
  }

  res.status(201).json(deposit);
};

// --- אין צורך בשינויים בפונקציות הבאות בשלב זה ---
// שבירת פיקדון
export const breakDeposit = async (req, res) => {
  const deposit = await Deposit.findOne({ _id: req.params.id, user: req.user.id });
  if (!deposit) return res.status(404).send();

  await Account.findOneAndUpdate({ userId: req.user.id, name: 'עו"ש' }, { $inc: { balance: deposit.principal } }, { upsert: true });

  deposit.status = 'broken';
  await deposit.save();
  
  res.json({ message: 'הפיקדון נשבר והקרן הועברה לעו"ש' });
};

// משיכת פיקדון בסוף תקופה
export const withdrawDeposit = async (req, res) => {
  const deposit = await Deposit.findOne({ _id: req.params.id, user: req.user.id });
  if (!deposit) return res.status(404).send();

  if (new Date() < deposit.endDate) {
    return res.status(400).json({ message: 'הפיקדון טרם הגיע למועד הפירעון' });
  }

  const finalValue = deposit.futureValue;
  await Account.findOneAndUpdate({ userId: req.user.id, name: 'עו"ש' }, { $inc: { balance: finalValue } }, { upsert: true });

  deposit.status = 'matured';
  await deposit.save();

  res.json({ message: `הפיקדון נפרע. סכום של ${finalValue.toFixed(2)} ₪ הועבר לעו"ש` });
};