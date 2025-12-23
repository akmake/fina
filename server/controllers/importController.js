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
    if (newMappings && newMappings.length > 0) {
      const mappingDocs = newMappings.map(m => ({
        originalName: m.originalName,
        newName: m.newName,
        category: m.category || null,
      }));
      // שמירת מיפויים חדשים (מתעלם מכפילויות)
      await MerchantMap.insertMany(mappingDocs, { ordered: false }).catch(err => {
        if (err.code !== 11000) throw err;
      });
    }

    let insertedCount = 0;
    if (transactions.length > 0) {
        try {
            // שמירת עסקאות (מתעלם מכפילויות כדי לא לעצור את כל התהליך)
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

    // חישוב יתרות מחדש
    const aggregation = await Transaction.aggregate([
      { $match: { user: userId } },
      {
        $group: {
          _id: '$account',
          total: { $sum: { $cond: [{ $eq: ['$type', 'הכנסה'] }, '$amount', { $multiply: ['$amount', -1] }] } }
        }
      }
    ]);
    
    const newBalances = { checking: 0, cash: 0, deposits: 0, stocks: 0 };
    aggregation.forEach(item => {
      if (newBalances.hasOwnProperty(item._id)) {
        newBalances[item._id] = item.total;
      }
    });

    await FinanceProfile.updateOne({ user: userId }, { $set: newBalances }, { upsert: true });

    res.json({ message: `הייבוא הושלם! נוספו ${insertedCount} עסקאות חדשות.` });
  } catch (error) {
    console.error("Error processing transactions:", error);
    return next(new AppError(`שגיאה בעיבוד העסקאות: ${error.message}`, 500));
  }
};