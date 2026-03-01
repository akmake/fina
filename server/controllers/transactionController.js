import mongoose from 'mongoose';
import Transaction from '../models/Transaction.js';
import FinanceProfile from '../models/FinanceProfile.js';
import MerchantMap from '../models/MerchantMap.js';

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
    const filter = { user: req.user._id };

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
    // 1. עדכון העסקאות הנוכחיות של המשתמש במסד הנתונים
    const updateFields = {};
    if (newDisplayName && newDisplayName !== originalName) updateFields.description = newDisplayName;
    if (newCategory) updateFields.category = newCategory;

    if (Object.keys(updateFields).length > 0) {
      await Transaction.updateMany({ user: userId, description: originalName }, { $set: updateFields });
    }

    // 2. משיכת כל ה-rawDescriptions (השמות המקוריים מהאקסל) כדי ללמד את המערכת על כל הווריאציות!
    const transactions = await Transaction.find({ user: userId, description: originalName }).select('rawDescription description');
    const uniqueRawDescriptions = [...new Set(transactions.map(t => t.rawDescription || t.description))];
    
    // אם אין עסקאות, לפחות נשמור את השם שהועבר כברירת מחדל
    if (uniqueRawDescriptions.length === 0) uniqueRawDescriptions.push(originalName);

    const shouldUpdateCategory = newCategory && newCategory !== 'כללי';
    const shouldUpdateName = newDisplayName && newDisplayName !== originalName;

    // 3. עדכון הטבלה הגלובלית (MerchantMap) לכל וריאציה בנפרד
    if (shouldUpdateCategory || shouldUpdateName) {
      for (const rawDesc of uniqueRawDescriptions) {
        await MerchantMap.findOneAndUpdate(
          { originalName: rawDesc },
          {
            $set: {
              newName: newDisplayName || originalName,
              ...(shouldUpdateCategory ? { categoryName: newCategory } : {}),
            },
            $unset: { category: 1 } // חובה לנקות ObjectID ישן כדי שהפארסר יקרא את הטקסט נכון
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