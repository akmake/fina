import mongoose from 'mongoose';
import Transaction from '../models/Transaction.js';
import FinanceProfile from '../models/FinanceProfile.js';

// ... פונקציית getTransactions נשארת ללא שינוי ...
export const getTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.find({ user: req.user._id }).sort({ date: -1 });
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};


// @desc   הוספת עסקה חדשה ועדכון היתרה בחשבון
// @route  POST /api/transactions
export const addTransaction = async (req, res) => {
  const { date, description, amount, type, category, account } = req.body;

  if (!date || !description || !amount || !type || !account) {
    return res.status(400).json({ message: 'נא למלא את כל שדות החובה' });
  }
  
  // --- בדיקה אם הסביבה תומכת בטרנזקציות ---
  const supportsTransactions = process.env.DB_SUPPORTS_TRANSACTIONS === 'true';

  if (supportsTransactions) {
    // --- לוגיקה לסביבת Production (עם טרנזקציה) ---
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const newTransaction = new Transaction({ user: req.user._id, date, description, amount: Number(amount), type, category, account });
      await newTransaction.save({ session });

      const amountToUpdate = type === 'הכנסה' ? Number(amount) : -Number(amount);
      await FinanceProfile.updateOne({ user: req.user._id }, { $inc: { [account]: amountToUpdate } }, { session });

      await session.commitTransaction();
      res.status(201).json(newTransaction);
    } catch (error) {
      await session.abortTransaction();
      console.error("Error adding transaction with session:", error);
      res.status(500).json({ message: 'שגיאה בהוספת העסקה' });
    } finally {
      session.endSession();
    }
  } else {
    // --- לוגיקה לסביבת פיתוח מקומית (בלי טרנזקציה) ---
    try {
      const newTransaction = await Transaction.create({ user: req.user._id, date, description, amount: Number(amount), type, category, account });
      const amountToUpdate = type === 'הכנסה' ? Number(amount) : -Number(amount);
      await FinanceProfile.updateOne({ user: req.user._id }, { $inc: { [account]: amountToUpdate } });
      res.status(201).json(newTransaction);
    } catch (error) {
      console.error("Error adding transaction without session:", error);
      res.status(500).json({ message: 'שגיאה בהוספת העסקה' });
    }
  }
};