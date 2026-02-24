// server/controllers/managementController.js
import Category from '../models/Category.js';
import MerchantMap from '../models/MerchantMap.js';
import CategoryRule from '../models/CategoryRule.js';
import Transaction from '../models/Transaction.js';
import { body, validationResult } from 'express-validator';

// @desc   שליפת כל נתוני הניהול (קטגוריות, מיפויים וחוקים)
// @route  GET /api/management
export const getManagementData = async (req, res) => {
  try {
    const [categories, merchantMaps, categoryRules] = await Promise.all([
      Category.find().sort({ name: 1 }),
      MerchantMap.find().populate('category', 'name').sort({ newName: 1 }),
      CategoryRule.find().populate('category', 'name').sort({ searchString: 1 }),
    ]);

    res.json({ categories, merchantMaps, categoryRules });
  } catch (error) {
    res.status(500).json({ message: 'שגיאת שרת בשליפת נתוני הניהול' });
  }
};

// --- ניהול מיפויי ספקים (Merchant Maps) ---

export const updateMerchantMap = async (req, res) => {
  const { newName, category } = req.body;
  try {
    const updatedMap = await MerchantMap.findByIdAndUpdate(
      req.params.id,
      { newName, category },
      { new: true }
    ).populate('category', 'name');
    if (!updatedMap) return res.status(404).json({ message: 'מיפוי לא נמצא' });
    res.json(updatedMap);
  } catch (error) {
    res.status(500).json({ message: 'שגיאה בעדכון המיפוי' });
  }
};

export const deleteMerchantMap = async (req, res) => {
  try {
    const deletedMap = await MerchantMap.findByIdAndDelete(req.params.id);
    if (!deletedMap) return res.status(404).json({ message: 'מיפוי לא נמצא' });
    res.status(204).send(); // No Content
  } catch (error) {
    res.status(500).json({ message: 'שגיאה במחיקת המיפוי' });
  }
};

// --- ניהול חוקי קטגוריה (Category Rules) ---

export const createCategoryRule = async (req, res) => {
  const { keyword, searchString, category } = req.body;
  const finalSearchString = searchString || keyword;
  try {
    const newRule = await CategoryRule.create({
      searchString: finalSearchString,
      category,
      user: req.user._id || req.user.id
    });
    const populatedRule = await newRule.populate('category', 'name');
    res.status(201).json(populatedRule);
  } catch (error) {
     if (error.code === 11000) {
        return res.status(409).json({ message: 'חוק עם מילת מפתח זו כבר קיים.' });
    }
    res.status(500).json({ message: 'שגיאה ביצירת חוק חדש' });
  }
};

export const updateCategoryRule = async (req, res) => {
  const { category } = req.body;
  try {
    const updatedRule = await CategoryRule.findByIdAndUpdate(
      req.params.id,
      { category },
      { new: true }
    ).populate('category', 'name');
    if (!updatedRule) return res.status(404).json({ message: 'חוק לא נמצא' });
    res.json(updatedRule);
  } catch (error) {
    res.status(500).json({ message: 'שגיאה בעדכון החוק' });
  }
};

export const deleteCategoryRule = async (req, res) => {
  try {
    const deletedRule = await CategoryRule.findByIdAndDelete(req.params.id);
    if (!deletedRule) return res.status(404).json({ message: 'חוק לא נמצא' });
    res.status(204).send(); // No Content
  } catch (error) {
    res.status(500).json({ message: 'שגיאה במחיקת החוק' });
  }
};

// @desc   הפעלת כל החוקים והמיפויים רטרואקטיבית על כל העסקאות
// @route  POST /api/management/apply-rules
export const applyRulesRetroactively = async (req, res) => {
  try {
    const userId = req.user.id; 

    const [rules, maps] = await Promise.all([
      CategoryRule.find().populate('category').lean(),
      MerchantMap.find().populate('category').lean()
    ]);
    const merchantMapsCache = new Map(maps.map(m => [m.originalName, m]));
    const transactions = await Transaction.find({ user: userId });

    let updatedCount = 0;
    const bulkOps = [];

    for (const trx of transactions) {
      const originalDescription = trx.rawDescription || trx.description;
      let newDescription = trx.description;
      let newCategoryName = trx.category;
      let categoryFound = false;

      // שלב 1: בדיקת מיפוי לניקוי השם ולקטגוריה בעדיפות ראשונה
      const directMap = merchantMapsCache.get(originalDescription);
      if (directMap) {
        newDescription = directMap.newName;
        if (directMap.category) {
          newCategoryName = directMap.category.name;
          categoryFound = true;
        }
      }

      // שלב 2: אם המיפוי לא קבע קטגוריה, בדוק חוקים
      if (!categoryFound) {
        for (const rule of rules) {
          const keyword = rule.searchString || rule.keyword || '';
          if (keyword && newDescription.toLowerCase().includes(keyword.toLowerCase())) {
            if (rule.category) {
              newCategoryName = rule.category.name;
              break;
            }
          }
        }
      }
      
      // שלב 3: אם משהו השתנה, הוסף לפעולת העדכון
      if (trx.category !== newCategoryName || trx.description !== newDescription) {
        updatedCount++;
        bulkOps.push({
          updateOne: {
            filter: { _id: trx._id },
            update: { $set: { category: newCategoryName, description: newDescription } }
          }
        });
      }
    }

    if (bulkOps.length > 0) {
      await Transaction.bulkWrite(bulkOps);
    }

    res.json({ message: 'החלת החוקים הושלמה בהצלחה.', updatedCount });

  } catch (error) {
    console.error('Error applying rules retroactively:', error);
    res.status(500).json({ message: 'שגיאת שרת בעת החלת החוקים' });
  }
};