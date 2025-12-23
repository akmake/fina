import mongoose from 'mongoose';
import Category from '../models/Category.js';
import CategoryRule from '../models/CategoryRule.js';
import Transaction from '../models/Transaction.js';
import AppError from '../utils/AppError.js';

/*--------------------------------------------------------------------
  GET /api/categories – שליפת כל הקטגוריות
--------------------------------------------------------------------*/
export const getCategories = async (req, res, next) => {
  try {
    const categories = await Category.find({ user: req.user._id }).sort({ name: 1 });
    res.json(categories);
  } catch (err) {
    next(new AppError('שגיאה בשליפת קטגוריות', 500));
  }
};

/*--------------------------------------------------------------------
  POST /api/categories – יצירת קטגוריה (עם תיקון התרגום)
--------------------------------------------------------------------*/
export const createCategory = async (req, res, next) => {
  try {
    let { name, type, color } = req.body;

    if (!name?.trim()) {
      return next(new AppError('שם קטגוריה הוא שדה חובה', 400));
    }

    // מילון תרגום - מנסים להפוך לעברית
    const typeMapping = {
      'expense': 'הוצאה',
      'income': 'הכנסה',
      'general': 'כללי'
    };

    // אם קיים תרגום - קח אותו. אם לא - קח את מה שהגיע (expense).
    // בזכות התיקון במודל, שניהם יעברו תקין.
    let finalType = typeMapping[type] || type || 'הוצאה';

    // בדיקה אם הקטגוריה כבר קיימת למשתמש
    const exists = await Category.findOne({ user: req.user._id, name: name.trim() });
    if (exists) {
      return next(new AppError('קטגוריה בשם זה כבר קיימת', 409));
    }

    const newCategory = await Category.create({
      user: req.user._id,
      name: name.trim(),
      type: finalType,
      color: color || '#64748b'
    });

    res.status(201).json(newCategory);
  } catch (err) {
    console.error("Create Category Error:", err);
    if (err.code === 11000) {
      return next(new AppError('קטגוריה בשם זה כבר קיימת', 409));
    }
    // החזרת הודעת השגיאה המקורית מהשרת
    next(new AppError(`שגיאה ביצירת קטגוריה: ${err.message}`, 500));
  }
};

/*--------------------------------------------------------------------
  DELETE /api/categories/:id – מחיקת קטגוריה
--------------------------------------------------------------------*/
export const deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return next(new AppError('מזהה לא תקין', 400));

    const deleted = await Category.findOneAndDelete({ _id: id, user: req.user._id });
    if (!deleted) return next(new AppError('קטגוריה לא נמצאה', 404));

    // מחיקת חוקים קשורים
    await CategoryRule.deleteMany({ user: req.user._id, category: id });

    res.json({ message: 'Category removed' });
  } catch (err) {
    next(new AppError('שגיאה במחיקת קטגוריה', 500));
  }
};

/*--------------------------------------------------------------------
  POST /api/categories/sync – סנכרון אוטומטי
--------------------------------------------------------------------*/
export const syncCategoriesFromTransactions = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const existing = await Category.find({ user: userId });
        const existingNames = new Set(existing.map(c => c.name));
        
        const defaults = ['מזון', 'דלק', 'סופר', 'משכנתא', 'חשמל', 'ארנונה', 'מים', 'תקשורת', 'ביטוח', 'רכב', 'בילויים', 'משכורת', 'הלוואות'];
        let added = 0;

        for (const name of defaults) {
            if (!existingNames.has(name)) {
                await Category.create({
                    user: userId,
                    name: name,
                    type: name === 'משכורת' ? 'הכנסה' : 'הוצאה',
                    color: '#' + Math.floor(Math.random()*16777215).toString(16)
                });
                added++;
            }
        }
        res.json({ message: `תהליך הסנכרון הסתיים. נוספו ${added} קטגוריות.` });
    } catch (error) {
        console.error('Sync error:', error);
        next(new AppError(`שגיאה בסנכרון: ${error.message}`, 500));
    }
};

/*--------------------------------------------------------------------
  ניהול חוקים (Rules)
--------------------------------------------------------------------*/
export const getRules = async (req, res, next) => {
  try {
    const rules = await CategoryRule.find({ user: req.user._id }).populate('category');
    res.json(rules);
  } catch (error) { next(new AppError('שגיאה בטעינת חוקים', 500)); }
};

export const createRule = async (req, res, next) => {
  try {
    const { searchString, matchType, newName, categoryId } = req.body;
    const rule = await CategoryRule.create({
      user: req.user._id,
      searchString,
      matchType: matchType || 'contains',
      newName: newName || null,
      category: categoryId
    });
    const populated = await CategoryRule.findById(rule._id).populate('category');
    res.status(201).json(populated);
  } catch (error) { next(new AppError('שגיאה ביצירת חוק', 400)); }
};

export const deleteRule = async (req, res, next) => {
  try {
    await CategoryRule.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    res.json({ message: 'נמחק בהצלחה' });
  } catch (error) { next(new AppError('שגיאה במחיקה', 500)); }
};

export const applyRulesToTransactions = async (req, res, next) => {
  try {
    const rules = await CategoryRule.find({ user: req.user._id });
    let total = 0;
    for (const rule of rules) {
      const regex = new RegExp(rule.matchType === 'starts_with' ? `^${rule.searchString}` : rule.searchString, 'i');
      
      const filter = { 
        user: req.user._id,
        $or: [
          { originalDescription: { $regex: regex } },
          { originalDescription: { $exists: false }, description: { $regex: regex } }
        ]
      };

      if (rule.matchType === 'exact') {
         filter.$or = [
            { originalDescription: rule.searchString },
            { originalDescription: { $exists: false }, description: rule.searchString }
        ];
      }

      const update = { category: rule.category };
      if (rule.newName) update.description = rule.newName;
      
      const res = await Transaction.updateMany(filter, update);
      total += res.modifiedCount;
    }
    res.json({ message: `עודכנו ${total} עסקאות.` });
  } catch (error) { next(new AppError('שגיאה בהחלת חוקים', 500)); }
};