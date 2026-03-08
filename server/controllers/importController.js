import { cleanCalFile, cleanMaxFile, cleanIsracardFile } from '../utils/excelCleaners.js';
import { parseTransactions } from '../utils/excelParser.js';
import Transaction from '../models/Transaction.js';
import FinanceProfile from '../models/FinanceProfile.js';
import MerchantMap from '../models/MerchantMap.js';
import CategoryRule from '../models/CategoryRule.js'; // ייבוא מודל החוקים
import AppError from '../utils/AppError.js';

export const uploadAndParse = async (req, res, next) => {
  const { data, fileType } = req.body;
  const userId = req.user._id;

  if (!data || !fileType) {
    return next(new AppError('Data and fileType are required.', 400));
  }

  try {
    const cleaner = fileType === 'cal' ? cleanCalFile : fileType === 'isracard' ? cleanIsracardFile : cleanMaxFile;
    const cleanedData = cleaner(data);
    const { transactions, unseenMerchants } = await parseTransactions(cleanedData, fileType, userId);

    res.json({ transactions, unseenMerchants });
  } catch (error) {
    console.error(`Error parsing file type ${fileType}:`, error);
    return next(new AppError(`שגיאה בפענוח הקובץ: ${error.message}`, 500));
  }
};

/**
 * פונקציית עזר להחלת חוקים על עסקה בודדת בזיכרון (לפני שמירה)
 */
const applyRulesToTransactionInMemory = (transaction, rules) => {
  // שמירת השם המקורי אם עדיין לא נשמר
  if (!transaction.originalDescription) {
    transaction.originalDescription = transaction.description;
  }

  for (const rule of rules) {
    let isMatch = false;
    const desc = transaction.originalDescription || transaction.description;

    if (rule.matchType === 'exact') {
      isMatch = desc === rule.searchString;
    } else if (rule.matchType === 'starts_with') {
      isMatch = desc.startsWith(rule.searchString);
    } else {
      isMatch = desc.includes(rule.searchString);
    }

    if (isMatch) {
      // אם נמצאה התאמה, מעדכנים קטגוריה ושם (משתמשים בשם, לא ObjectId)
      transaction.category = rule.category?.name || rule.category || 'כללי';
      if (rule.newName) {
        transaction.description = rule.newName;
      }
      // ברגע שמצאנו חוק מתאים, אפשר לעצור (או להמשיך אם רוצים חוקים דורסים - כרגע עוצרים בראשון)
      break; 
    }
  }
  return transaction;
};

export const processTransactions = async (req, res, next) => {
  const { transactions, newMappings } = req.body;
  const userId = req.user._id;

  if (!Array.isArray(transactions)) {
    return next(new AppError('Transactions array is required.', 400));
  }

  try {
    // 1. טעינת כל החוקים של המשתמש לזיכרון (עם populate לשם הקטגוריה)
    const rules = await CategoryRule.find({ user: userId }).populate('category').lean();

    // 2. עיבוד העסקאות (החלת חוקים + שמירת מקור)
    const processedTransactions = transactions.map(t => {
      // יצירת אובייקט עסקה בסיסי
      const transactionObj = {
        ...t,
        user: userId,
        originalDescription: t.description // שומרים את השם המקורי תמיד
      };
      
      // החלת המנוע
      return applyRulesToTransactionInMemory(transactionObj, rules);
    });

    // 3. שמירת מיפויים (MerchantMap) - אופציונלי, למקרים ידניים בעתיד
    if (newMappings && newMappings.length > 0) {
      const mappingDocs = newMappings.map(m => ({
        originalName: m.originalName,
        newName: m.newName,
        category: m.category || null,
      }));
      await MerchantMap.insertMany(mappingDocs, { ordered: false }).catch(err => {
        if (err.code !== 11000) throw err;
      });
    }

    // 4. סינון כפילויות: מצא עסקאות שכבר קיימות בתחום התאריכים
    let insertedCount = 0;
    let skippedCount = 0;

    if (processedTransactions.length > 0) {
      const dates = processedTransactions.map(t => new Date(t.date));
      const minDate = new Date(Math.min(...dates));
      const maxDate = new Date(Math.max(...dates));
      minDate.setDate(minDate.getDate() - 1);
      maxDate.setDate(maxDate.getDate() + 1);

      const existingInRange = await Transaction.find({
        user: userId,
        date: { $gte: minDate, $lte: maxDate },
      }, { date: 1, amount: 1, rawDescription: 1, description: 1, identifier: 1 }).lean();

      const makeKey = (t) => {
        const d = new Date(t.date);
        return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}_${t.amount}_${(t.rawDescription || t.description || '').trim()}`;
      };

      const existingKeys = new Set(existingInRange.map(makeKey));
      const existingIdentifiers = new Set(
        existingInRange.filter(t => t.identifier).map(t => t.identifier)
      );

      const newTransactions = processedTransactions.filter(t => {
        if (t.identifier && existingIdentifiers.has(t.identifier)) return false;
        return !existingKeys.has(makeKey(t));
      });
      skippedCount = processedTransactions.length - newTransactions.length;

      if (newTransactions.length > 0) {
        try {
          const result = await Transaction.insertMany(newTransactions, { ordered: false });
          insertedCount = result.length;
        } catch (error) {
          if (error.code === 11000) {
            insertedCount = error.insertedDocs?.length || error.result?.insertedCount || error.result?.nInserted || 0;
          } else {
            throw error;
          }
        }
      }
    }

    // 5. חישוב יתרות (כמו בקובץ הקודם)
    const aggregation = await Transaction.aggregate([
      { $match: { user: userId } },
      {
        $group: {
          _id: '$account',
          total: { $sum: { $cond: [{ $eq: ['$type', 'הכנסה'] }, '$amount', { $multiply: ['$amount', -1] }] } }
        }
      }
    ]);
    
    const updates = {};
    const knownFields = ['checking', 'cash', 'deposits', 'stocks'];

    aggregation.forEach(item => {
      const accountKey = item._id;
      if (knownFields.includes(accountKey)) {
        updates[accountKey] = item.total;
      } else {
        updates['checking'] = (updates['checking'] || 0) + item.total;
      }
    });

    if (Object.keys(updates).length > 0) {
      await FinanceProfile.updateOne({ user: userId }, { $set: updates }, { upsert: true });
    }

    const skippedMsg = skippedCount > 0 ? ` (${skippedCount} עסקאות כבר היו קיימות ודולגו)` : '';
    res.json({ message: `הייבוא הושלם! נוספו ${insertedCount} עסקאות חדשות.${skippedMsg}` });
  } catch (error) {
    console.error("Error processing transactions:", error);
    return next(new AppError(`שגיאה בעיבוד העסקאות: ${error.message}`, 500));
  }
};
