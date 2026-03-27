import mongoose from 'mongoose';
import Transaction from '../models/Transaction.js';
import FinanceProfile from '../models/FinanceProfile.js';
import MerchantMap from '../models/MerchantMap.js';
import { scopeFilter } from '../utils/scopeFilter.js';

// --- פונקציית עזר לתרגום סוגים ---
const normalizeType = (type) => {
    if (type === 'income' || type === 'הכנסה') return 'הכנסה';
    return 'הוצאה'; // ברירת מחדל
};

const normalizeAccount = (account) => {
    const map = { 'עו"ש': 'checking', 'מזומן': 'cash' };
    return map[account] || account || 'checking';
};

// @desc   קבלת עסקאות של המשתמש
// @route  GET /api/transactions
// Query params: ?from=DATE&to=DATE (month range) | ?before=DATE&limit=N (cursor) | ?limit=N (latest N)
export const getTransactions = async (req, res) => {
  try {
    const filter = { ...scopeFilter(req) };

    if (req.query.from || req.query.to) {
      filter.date = {};
      if (req.query.from) filter.date.$gte = new Date(req.query.from);
      if (req.query.to)   filter.date.$lte = new Date(req.query.to);
    } else if (req.query.before) {
      filter.date = { $lt: new Date(req.query.before) };
    }

    let query = Transaction.find(filter).sort({ date: -1 });
    if (req.query.limit) query = query.limit(Math.min(parseInt(req.query.limit), 2000));

    const transactions = await query;
    res.json(transactions);
  } catch (error) {
    console.error("Get transactions error:", error);
    res.status(500).json({ message: 'שגיאת שרת בשליפת עסקאות' });
  }
};

// @desc   חיפוש עסקאות בכל ההיסטוריה
// @route  GET /api/transactions/search?q=QUERY&type=expense|income
export const searchTransactions = async (req, res) => {
  try {
    const { q, type } = req.query;
    if (!q || !q.trim()) return res.json([]);

    const filter = {
      ...scopeFilter(req),
      $or: [
        { description: { $regex: q.trim(), $options: 'i' } },
        { category:    { $regex: q.trim(), $options: 'i' } },
      ],
    };
    if (type === 'expense') filter.type = 'הוצאה';
    if (type === 'income')  filter.type = 'הכנסה';

    const transactions = await Transaction.find(filter).sort({ date: -1 }).limit(500);
    res.json(transactions);
  } catch (error) {
    console.error("Search transactions error:", error);
    res.status(500).json({ message: 'שגיאת שרת בחיפוש' });
  }
};

// @desc   סיכום כל בתי העסק עם נתונים חודשיים
// @route  GET /api/transactions/merchants/summary
export const getMerchantsSummary = async (req, res) => {
  try {
    const filter = scopeFilter(req);
    const months = parseInt(req.query.months) || 12;

    const since = new Date();
    since.setMonth(since.getMonth() - months);
    since.setDate(1);
    since.setHours(0, 0, 0, 0);

    const pipeline = [
      {
        $match: {
          ...filter,
          type: 'הוצאה',
          date: { $gte: since },
          description: { $exists: true, $ne: '' },
        },
      },
      {
        $group: {
          _id: {
            name: '$description',
            month: { $dateToString: { format: '%Y-%m', date: '$date' } },
          },
          monthTotal: { $sum: '$amount' },
          monthCount: { $sum: 1 },
          category: { $last: '$category' },
          lastDate: { $max: '$date' },
        },
      },
      {
        $group: {
          _id: '$_id.name',
          total: { $sum: '$monthTotal' },
          count: { $sum: '$monthCount' },
          category: { $last: '$category' },
          lastDate: { $max: '$lastDate' },
          monthCount: { $sum: 1 },
          monthly: {
            $push: { month: '$_id.month', total: '$monthTotal', count: '$monthCount' },
          },
        },
      },
      {
        $project: {
          _id: 0,
          name: '$_id',
          total: { $round: ['$total', 2] },
          count: 1,
          category: 1,
          lastDate: 1,
          monthCount: 1,
          isRecurring: { $gte: ['$monthCount', 2] },
          avgPerMonth: { $round: [{ $divide: ['$total', '$monthCount'] }, 2] },
          monthly: 1,
        },
      },
      { $sort: { total: -1 } },
    ];

    const merchants = await Transaction.aggregate(pipeline);
    res.json(merchants);
  } catch (err) {
    console.error('getMerchantsSummary error:', err);
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

// @desc   כל העסקאות של בית עסק מסוים
// @route  GET /api/transactions/merchant/:name
export const getMerchantTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.find({
      ...scopeFilter(req),
      description: req.params.name,
    }).sort({ date: -1 });
    res.json(transactions);
  } catch (error) {
    console.error("Get merchant transactions error:", error);
    res.status(500).json({ message: 'שגיאת שרת' });
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

// --- תוספת/תיקון: פונקציית עריכת עסקה חסרה (PUT) ---
// @desc   עדכון עסקה קיימת וחישוב מחדש של יתרות העו"ש
// @route  PUT /api/transactions/:id
export const updateTransaction = async (req, res) => {
  const { id } = req.params;
  let { date, description, amount, type, category, account } = req.body;

  if (!date || !description || !amount || !type) {
    return res.status(400).json({ message: 'נא למלא תאריך, תיאור, סכום וסוג' });
  }

  const finalType = normalizeType(type);
  const finalAccount = normalizeAccount(account);
  const numericAmount = Math.abs(Number(amount));
  const supportsTransactions = process.env.DB_SUPPORTS_TRANSACTIONS === 'true';

  try {
    const oldTransaction = await Transaction.findOne({ _id: id, user: req.user._id });
    if (!oldTransaction) {
      return res.status(404).json({ message: 'העסקה לא נמצאה' });
    }

    const oldAccount = oldTransaction.account || 'checking';
    const oldReverseAmount = oldTransaction.type === 'הכנסה' ? -oldTransaction.amount : oldTransaction.amount;
    const newApplyAmount = finalType === 'הכנסה' ? numericAmount : -numericAmount;

    // --- תוספת קריטית: למידה אוטומטית למילון הגלובלי ---
    // המערכת תזכור את הקטגוריה לשם המקורי בכל ייבוא עתידי של כל המשתמשים
    const rawDesc = oldTransaction.rawDescription || oldTransaction.description;
    const updateGlobalDictionary = async () => {
      if (category && category !== 'כללי') {
        try {
          await MerchantMap.findOneAndUpdate(
            { originalName: rawDesc },
            {
              $set: { newName: description, categoryName: category },
              $unset: { category: 1 } // ניקוי שיוכים ישנים כדי לא להתנגש בייבוא
            },
            { upsert: true }
          );
        } catch (err) {
          console.error("Error updating global memory:", err);
        }
      }
    };

    if (supportsTransactions) {
      const session = await mongoose.startSession();
      session.startTransaction();
      try {
        oldTransaction.date = date;
        oldTransaction.description = description;
        oldTransaction.amount = numericAmount;
        oldTransaction.type = finalType;
        oldTransaction.category = category;
        oldTransaction.account = finalAccount;
        await oldTransaction.save({ session });

        if (oldAccount === finalAccount) {
          const netChange = oldReverseAmount + newApplyAmount;
          if (netChange !== 0) {
            await FinanceProfile.updateOne(
              { user: req.user._id },
              { $inc: { [oldAccount]: netChange } },
              { session }
            );
          }
        } else {
          await FinanceProfile.updateOne(
            { user: req.user._id },
            { $inc: { [oldAccount]: oldReverseAmount, [finalAccount]: newApplyAmount } },
            { session }
          );
        }

        await session.commitTransaction();
        session.endSession();
        
        await updateGlobalDictionary(); // שמירה לזיכרון הגלובלי מחוץ לטרנזקציה
        return res.json(oldTransaction);
      } catch (err) {
        await session.abortTransaction();
        session.endSession();
        if (err.code === 11000) return res.status(409).json({ message: 'עסקה זו כבר קיימת במערכת' });
        throw err;
      }
    } else {
      oldTransaction.date = date;
      oldTransaction.description = description;
      oldTransaction.amount = numericAmount;
      oldTransaction.type = finalType;
      oldTransaction.category = category;
      oldTransaction.account = finalAccount;
      await oldTransaction.save();

      if (oldAccount === finalAccount) {
        const netChange = oldReverseAmount + newApplyAmount;
        if (netChange !== 0) {
          await FinanceProfile.updateOne(
            { user: req.user._id },
            { $inc: { [oldAccount]: netChange } }
          );
        }
      } else {
        await FinanceProfile.updateOne(
          { user: req.user._id },
          { $inc: { [oldAccount]: oldReverseAmount, [finalAccount]: newApplyAmount } }
        );
      }
      
      await updateGlobalDictionary(); // שמירה לזיכרון הגלובלי
      return res.json(oldTransaction);
    }
  } catch (error) {
    console.error('Update transaction error:', error);
    res.status(500).json({ message: 'שגיאה בעדכון העסקה' });
  }
};


// @desc   מחיקת כל עסקאות המשתמש + איפוס יתרות
// @route  DELETE /api/transactions/all
export const deleteAllTransactions = async (req, res) => {
  try {
    await Transaction.deleteMany({ user: req.user._id });
    await FinanceProfile.updateOne(
      { user: req.user._id },
      { $set: { checking: 0, cash: 0 } }
    );
    res.json({ message: 'כל העסקאות נמחקו בהצלחה' });
  } catch (error) {
    console.error('Delete all transactions error:', error);
    res.status(500).json({ message: 'שגיאה במחיקת העסקאות' });
  }
};

// @desc   עדכון bulk לכל עסקאות בית עסק + שמירה ב-MerchantMap הגלובלי
// @route  POST /api/transactions/merchant-bulk
export const bulkUpdateMerchant = async (req, res) => {
  const { originalName, newDisplayName, newCategory } = req.body;
  const userId = req.user._id;

  if (!originalName) {
    return res.status(400).json({ message: 'originalName נדרש' });
  }

  try {
    // 1. קודם כל משלים את ה-rawDescriptions לפני שהעדכון משנה את ה-description
    const existingTxns = await Transaction.find(
      { ...scopeFilter(req), description: originalName },
      { rawDescription: 1, description: 1 }
    ).lean();
    const uniqueRawDescriptions = [...new Set(
      existingTxns.map(t => t.rawDescription || t.description).filter(Boolean)
    )];
    if (uniqueRawDescriptions.length === 0) uniqueRawDescriptions.push(originalName);

    // 2. עדכון העסקאות במסד הנתונים
    const updateFields = {};
    if (newDisplayName && newDisplayName !== originalName) updateFields.description = newDisplayName;
    if (newCategory) updateFields.category = newCategory;

    if (Object.keys(updateFields).length > 0) {
      await Transaction.updateMany({ user: userId, description: originalName }, { $set: updateFields });
    }

    // 3. עדכון הטבלה הגלובלית (MerchantMap) לכל וריאציה
    const shouldUpdateCategory = newCategory && newCategory !== 'כללי';
    const shouldUpdateName = newDisplayName && newDisplayName !== originalName;

    if (shouldUpdateCategory || shouldUpdateName) {
      for (const rawDesc of uniqueRawDescriptions) {
        await MerchantMap.findOneAndUpdate(
          { originalName: rawDesc },
          {
            $set: {
              newName: newDisplayName || originalName,
              ...(shouldUpdateCategory ? { categoryName: newCategory } : {}),
            },
            $unset: { category: 1 }
          },
          { upsert: true, new: true }
        );
      }
    }

    res.json({ message: 'עודכן בהצלחה והמערכת למדה את הקטגוריה!' });
  } catch (error) {
    console.error('bulkUpdateMerchant error:', error);
    res.status(500).json({ message: 'שגיאה בעדכון בית העסק' });
  }
};