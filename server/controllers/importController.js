import { cleanCalFile, cleanMaxFile, cleanIsracardFile } from '../utils/excelCleaners.js';
import { parseTransactions } from '../utils/excelParser.js';
import MerchantMap from '../models/MerchantMap.js';
import Category from '../models/Category.js';
import { persistTransactions } from '../services/transactionPersistence.js';
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

/** Persist newly confirmed merchant→category mappings for future imports. */
const saveMerchantMappings = async (newMappings) => {
  if (!newMappings || newMappings.length === 0) return;
  const allCategories = await Category.find({}, { _id: 1, name: 1 }).lean();
  for (const m of newMappings) {
    const catName = m.categoryName || (m.category ? allCategories.find(c => String(c._id) === String(m.category))?.name : null);
    await MerchantMap.findOneAndUpdate(
      { originalName: m.originalName },
      {
        $set: {
          newName: m.newName || m.originalName,
          ...(catName ? { categoryName: catName } : {}),
        },
        $unset: { category: 1 },
      },
      { upsert: true }
    ).catch(err => console.error('[MerchantMap] upsert failed:', err.message));
  }
};

export const processTransactions = async (req, res, next) => {
  const { transactions, newMappings } = req.body;
  const userId = req.user._id;

  if (!Array.isArray(transactions)) {
    return next(new AppError('Transactions array is required.', 400));
  }

  try {
    // Persist merchant mappings (affect future imports), then save the batch.
    await saveMerchantMappings(newMappings);
    const { inserted, skipped } = await persistTransactions({ userId, transactions });

    const skippedMsg = skipped > 0 ? ` (${skipped} עסקאות כבר היו קיימות ודולגו)` : '';
    res.json({ message: `הייבוא הושלם! נוספו ${inserted} עסקאות חדשות.${skippedMsg}` });
  } catch (error) {
    console.error("Error processing transactions:", error);
    return next(new AppError(`שגיאה בעיבוד העסקאות: ${error.message}`, 500));
  }
};
