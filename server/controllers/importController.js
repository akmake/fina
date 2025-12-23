// server/controllers/importController.js

import { cleanCalFile, cleanMaxFile } from '../utils/excelCleaners.js';
import { parseTransactions } from '../utils/excelParser.js';
import Transaction from '../models/Transaction.js';
import FinanceProfile from '../models/FinanceProfile.js';
import MerchantMap from '../models/MerchantMap.js';
import AppError from '../utils/AppError.js';

export const uploadAndParse = async (req, res, next) => {
  const { data, fileType } = req.body;
  const userId = req.user._id;

  if (!data || !fileType) {
    return next(new AppError('Data and fileType are required.', 400));
  }

  try {
    const cleaner = fileType === 'cal' ? cleanCalFile : cleanMaxFile;
    const cleanedData = cleaner(data);
    const { transactions, unseenMerchants } = await parseTransactions(cleanedData, fileType, userId);

    res.json({ transactions, unseenMerchants });
  } catch (error) {
    console.error(`Error parsing file type ${fileType}:`, error);
    return next(new AppError(`שגיאה בפענוח הקובץ: ${error.message}`, 500));
  }
};

export const processTransactions = async (req, res, next) => {
  const { transactions, newMappings } = req.body;
  const userId = req.user._id;

  if (!Array.isArray(transactions)) {
    return next(new AppError('Transactions array is required.', 400));
  }

  try {
    // 1. שמירת מיפויים חדשים
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

    // 2. שמירת עסקאות
    let insertedCount = 0;
    if (transactions.length > 0) {
        try {
            const result = await Transaction.insertMany(transactions, { ordered: false });
            insertedCount = result.length;
        } catch (error) {
            if (error.code === 11000 && error.result && Array.isArray(error.result.insertedDocs)) {
                insertedCount = error.result.insertedDocs.length;
            } else {
                throw error;
            }
        }
    }

    // 3. חישוב יתרות חכם (ללא דריסת שדות ידניים)
    const aggregation = await Transaction.aggregate([
      { $match: { user: userId } },
      {
        $group: {
          _id: '$account', // מקבץ לפי שם החשבון בעסקה
          total: { $sum: { $cond: [{ $eq: ['$type', 'הכנסה'] }, '$amount', { $multiply: ['$amount', -1] }] } }
        }
      }
    ]);
    
    // מכינים אובייקט עדכון ריק
    const updates = {};
    const knownFields = ['checking', 'cash', 'deposits', 'stocks'];

    aggregation.forEach(item => {
      const accountKey = item._id;
      
      // בדיקה האם שם החשבון קיים בסכמה שלנו
      if (knownFields.includes(accountKey)) {
        updates[accountKey] = item.total;
      } else {
        // אם שם החשבון לא מוכר (למשל 'Leumi Card'), נוסיף אותו ל-checking כברירת מחדל
        // או שאפשר ליצור שדה דינמי אם הסכמה מאפשרת. כרגע נסכם ל-checking:
        updates['checking'] = (updates['checking'] || 0) + item.total;
      }
    });

    // שימוש ב-$set כדי לעדכן רק את השדות שחושבו מחדש, מבלי למחוק שדות אחרים (כמו מזומן שלא היה בקובץ)
    if (Object.keys(updates).length > 0) {
      await FinanceProfile.updateOne({ user: userId }, { $set: updates }, { upsert: true });
    }

    res.json({ message: `הייבוא הושלם! נוספו ${insertedCount} עסקאות חדשות.` });
  } catch (error) {
    console.error("Error processing transactions:", error);
    return next(new AppError(`שגיאה בעיבוד העסקאות: ${error.message}`, 500));
  }
};