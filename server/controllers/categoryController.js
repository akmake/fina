import mongoose from 'mongoose';
import Category from '../models/Category.js';
import CategoryRule from '../models/CategoryRule.js';
import Transaction from '../models/Transaction.js';
import AppError from '../utils/AppError.js';
import { scopeFilter } from '../utils/scopeFilter.js';

/*--------------------------------------------------------------------
  עזרי מנוע החוקים — למידה מהתנהגות המשתמש (§5.3)
--------------------------------------------------------------------*/

// גוזר טקסט-חיפוש יציב מתיאור עסקה: מסיר מספרים ארוכים (אסמכתאות/כרטיס),
// מנרמל רווחים, ולוקח את המילים המשמעותיות הראשונות — שם הסוחר בפועל.
export const deriveSearchString = (desc = '') => {
  let s = String(desc).trim().replace(/[*"']/g, ' ');
  s = s.replace(/\b\d{2,}\b/g, ' ').replace(/\s+/g, ' ').trim();
  const words = s.split(' ').filter((w) => w.length > 1);
  return (words.slice(0, 3).join(' ') || s).slice(0, 40).trim();
};

// בונה את פילטר ההתאמה של חוק בודד (על rawDescription, ובהיעדרו description).
const buildRuleFilter = (rule, baseFilter) => {
  if (rule.matchType === 'exact') {
    return {
      ...baseFilter,
      $or: [
        { rawDescription: rule.searchString },
        { rawDescription: { $in: [null, ''] }, description: rule.searchString },
      ],
    };
  }
  const escaped = rule.searchString.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(rule.matchType === 'starts_with' ? `^${escaped}` : escaped, 'i');
  return {
    ...baseFilter,
    $or: [
      { rawDescription: { $regex: regex } },
      { rawDescription: { $in: [null, ''] }, description: { $regex: regex } },
    ],
  };
};

// מחיל חוק בודד (מאוכלס) על עסקאות בהיקף baseFilter. מחזיר כמה עודכנו.
export const applyOneRule = async (rule, baseFilter) => {
  const filter = buildRuleFilter(rule, baseFilter);
  const categoryName = rule.category?.name || 'כללי';
  const update = { category: categoryName };
  if (rule.newName) update.description = rule.newName;
  const result = await Transaction.updateMany(filter, update);
  return result.modifiedCount;
};

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
  סורק את כל הקטגוריות האמיתיות מהעסקאות ומוסיף חסרות ל-Category
--------------------------------------------------------------------*/
export const syncCategoriesFromTransactions = async (req, res, next) => {
    try {
        const userId = req.user._id;

        // כל הקטגוריות הקיימות למשתמש
        const existing = await Category.find({ user: userId });
        const existingNames = new Set(existing.map(c => c.name.trim().toLowerCase()));

        // כל ערכי category ייחודיים מהעסקאות של המשתמש
        const txCategories = await Transaction.distinct('category', {
            user: userId,
            category: { $exists: true, $ne: '', $ne: null }
        });

        const INCOME_KEYWORDS = ['משכורת', 'הכנסה', 'החזר', 'זיכוי', 'פיצויים', 'דמי'];
        let added = 0;

        for (const name of txCategories) {
            if (!name || !name.trim()) continue;
            const trimmed = name.trim();

            if (existingNames.has(trimmed.toLowerCase())) continue;

            const isIncome = INCOME_KEYWORDS.some(kw => trimmed.includes(kw));

            await Category.create({
                user: userId,
                name: trimmed,
                type: isIncome ? 'הכנסה' : 'הוצאה',
                color: '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')
            }).catch(() => {}); // skip duplicates silently

            existingNames.add(trimmed.toLowerCase());
            added++;
        }

        res.json({ message: `הסנכרון הסתיים — נוספו ${added} קטגוריות מתוך העסקאות שלך.` });
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
    const { searchString, matchType, newName, categoryId, applyToExisting } = req.body;
    const rule = await CategoryRule.create({
      user: req.user._id,
      searchString,
      matchType: matchType || 'contains',
      newName: newName || null,
      category: categoryId
    });
    const populated = await CategoryRule.findById(rule._id).populate('category');

    // §5.3 — "לסווג כך את כל התנועות הדומות?" — החלה על עסקאות עבר לפי אישור.
    let appliedCount = 0;
    if (applyToExisting) {
      appliedCount = await applyOneRule(populated, scopeFilter(req));
    }

    // שומרים על תאימות לאחור: הלקוח דוחף את אובייקט החוק ישירות לרשימה.
    res.status(201).json({ ...populated.toObject(), appliedCount });
  } catch (error) { next(new AppError('שגיאה ביצירת חוק', 400)); }
};

/*--------------------------------------------------------------------
  POST /api/categories/rules/suggest – הצעת חוק מלמידת סיווג ידני (§5.3)
  body: { transactionId } או { description, category }
  מחזיר טקסט-חיפוש מוצע, כמה עסקאות דומות מושפעות, והאם כבר קיים חוק.
--------------------------------------------------------------------*/
export const suggestRule = async (req, res, next) => {
  try {
    let { description, category, transactionId } = req.body;

    if (transactionId) {
      if (!mongoose.Types.ObjectId.isValid(transactionId)) return next(new AppError('מזהה לא תקין', 400));
      const tx = await Transaction.findOne({ ...scopeFilter(req), _id: transactionId });
      if (!tx) return next(new AppError('עסקה לא נמצאה', 404));
      description = tx.rawDescription || tx.description;
      category = category || tx.category;
    }

    if (!description) return next(new AppError('נדרש תיאור עסקה', 400));

    const searchString = deriveSearchString(description);
    if (!searchString) return res.json({ searchString: '', matchCount: 0, ruleExists: false, suggestedCategory: category });

    // כמה עסקאות בהיקף המשק בית מתאימות (כדי לתת ערך: "יעדכן N עסקאות")
    const probeFilter = buildRuleFilter({ searchString, matchType: 'contains' }, scopeFilter(req));
    const matchCount = await Transaction.countDocuments(probeFilter);

    const existingRule = await CategoryRule.findOne({ user: req.user._id, searchString });

    res.json({
      searchString,
      matchType: 'contains',
      suggestedCategory: category || null,
      matchCount,
      ruleExists: !!existingRule,
    });
  } catch (error) {
    console.error('Error suggesting rule:', error);
    next(new AppError('שגיאה בהצעת חוק', 500));
  }
};

export const deleteRule = async (req, res, next) => {
  try {
    await CategoryRule.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    res.json({ message: 'נמחק בהצלחה' });
  } catch (error) { next(new AppError('שגיאה במחיקה', 500)); }
};

export const applyRulesToTransactions = async (req, res, next) => {
  try {
    const rules = await CategoryRule.find({ user: req.user._id }).populate('category');
    let total = 0;
    for (const rule of rules) {
      total += await applyOneRule(rule, scopeFilter(req));
    }
    res.json({ message: `עודכנו ${total} עסקאות.` });
  } catch (error) {
    console.error('Error applying rules:', error);
    next(new AppError('שגיאה בהחלת חוקים', 500));
  }
};