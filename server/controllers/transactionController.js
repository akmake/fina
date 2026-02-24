import mongoose from 'mongoose';
import Transaction from '../models/Transaction.js';
import FinanceProfile from '../models/FinanceProfile.js';

// --- פונקציית עזר לתרגום סוגים ---
const normalizeType = (type) => {
    if (type === 'income' || type === 'הכנסה') return 'הכנסה';
    return 'הוצאה'; // ברירת מחדל
};

const normalizeAccount = (account) => {
    const map = { 'עו"ש': 'checking', 'מזומן': 'cash' };
    return map[account] || account || 'checking';
};

// @desc   קבלת כל העסקאות של המשתמש
// @route  GET /api/transactions
export const getTransactions = async (req, res) => {
  try {
    // שליפה לפי המשתמש המחובר, ממוין לפי תאריך יורד
    const transactions = await Transaction.find({ user: req.user._id }).sort({ date: -1 });
    res.json(transactions);
  } catch (error) {
    console.error("Get transactions error:", error);
    res.status(500).json({ message: 'שגיאת שרת בשליפת עסקאות' });
  }
};

// @desc   מחיקת עסקה והחזרת היתרה
// @route  DELETE /api/transactions/:id
export const deleteTransaction = async (req, res) => {
  const { id } = req.params;
  const supportsTransactions = process.env.DB_SUPPORTS_TRANSACTIONS === 'true';

  try {
    const transaction = await Transaction.findOne({ _id: id, user: req.user._id });
    if (!transaction) {
      return res.status(404).json({ message: 'העסקה לא נמצאה' });
    }

    // חישוב הפוך: אם הייתה הכנסה -> מורידים, אם הוצאה -> מוסיפים
    const reverseAmount = transaction.type === 'הכנסה' ? -transaction.amount : transaction.amount;
    const account = transaction.account || 'checking';

    if (supportsTransactions) {
      const session = await mongoose.startSession();
      session.startTransaction();
      try {
        await Transaction.deleteOne({ _id: id }, { session });
        await FinanceProfile.updateOne(
          { user: req.user._id },
          { $inc: { [account]: reverseAmount } },
          { session }
        );
        await session.commitTransaction();
        session.endSession();
      } catch (err) {
        await session.abortTransaction();
        session.endSession();
        throw err;
      }
    } else {
      await Transaction.deleteOne({ _id: id });
      await FinanceProfile.updateOne(
        { user: req.user._id },
        { $inc: { [account]: reverseAmount } }
      );
    }

    res.json({ message: 'העסקה נמחקה בהצלחה' });
  } catch (error) {
    console.error('Delete transaction error:', error);
    res.status(500).json({ message: 'שגיאה במחיקת העסקה' });
  }
};

// @desc   הוספת עסקה חדשה ועדכון היתרה
// @route  POST /api/transactions
export const addTransaction = async (req, res) => {
  let { date, description, amount, type, category, account } = req.body;

  if (!date || !description || !amount || !type) {
    return res.status(400).json({ message: 'נא למלא תאריך, תיאור, סכום וסוג' });
  }

  // 1. נרמול הנתונים לפני עבודה (כדי למנוע באגים בחישובים)
  const finalType = normalizeType(type);
  const finalAccount = normalizeAccount(account);
  const numericAmount = Math.abs(Number(amount)); // מוודאים שהסכום חיובי בבסיסו

  const supportsTransactions = process.env.DB_SUPPORTS_TRANSACTIONS === 'true';

  if (supportsTransactions) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const newTransaction = new Transaction({ 
          user: req.user._id, 
          date, 
          description, 
          amount: numericAmount, 
          type: finalType, 
          category, 
          account: finalAccount 
      });
      
      await newTransaction.save({ session });

      // חישוב העדכון: אם הכנסה -> פלוס, אם הוצאה -> מינוס
      const amountToUpdate = finalType === 'הכנסה' ? numericAmount : -numericAmount;
      
      // עדכון הפרופיל הפיננסי
      await FinanceProfile.updateOne(
          { user: req.user._id }, 
          { $inc: { [finalAccount]: amountToUpdate } }, 
          { session }
      );

      await session.commitTransaction();
      res.status(201).json(newTransaction);
    } catch (error) {
      await session.abortTransaction();
      // טיפול בשגיאת כפילות (אם מנסים להוסיף אותה עסקה בדיוק פעמיים)
      if (error.code === 11000) {
          return res.status(409).json({ message: 'עסקה זו כבר קיימת במערכת' });
      }
      console.error("Error adding transaction (session):", error);
      res.status(500).json({ message: 'שגיאה בהוספת העסקה' });
    } finally {
      session.endSession();
    }
  } else {
    // --- לוגיקה ללא טרנזקציות (פיתוח) ---
    try {
      const newTransaction = await Transaction.create({ 
          user: req.user._id, 
          date, 
          description, 
          amount: numericAmount, 
          type: finalType, 
          category, 
          account: finalAccount 
      });

      const amountToUpdate = finalType === 'הכנסה' ? numericAmount : -numericAmount;
      
      await FinanceProfile.updateOne(
          { user: req.user._id }, 
          { $inc: { [finalAccount]: amountToUpdate } }
      );
      
      res.status(201).json(newTransaction);
    } catch (error) {
      if (error.code === 11000) {
          return res.status(409).json({ message: 'עסקה זו כבר קיימת במערכת' });
      }
      console.error("Error adding transaction (no session):", error);
      res.status(500).json({ message: 'שגיאה בהוספת העסקה' });
    }
  }
};