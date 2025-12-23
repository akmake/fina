import mongoose from 'mongoose';
import Category  from '../models/Category.js';
import AppError  from '../utils/AppError.js';

/*--------------------------------------------------------------------
  GET /api/categories – שליפת כל הקטגוריות
--------------------------------------------------------------------*/
export const getCategories = async (req, res, next) => {
  try {
    const categories = await Category.find().sort({ name: 1 });
    return res.json(categories);
  } catch (err) {
    return next(new AppError('שגיאה בשליפת קטגוריות', 500));
  }
};

/*--------------------------------------------------------------------
  POST /api/categories – יצירת קטגוריה חדשה
--------------------------------------------------------------------*/
export const createCategory = async (req, res, next) => {
  try {
    const { name, type = 'הוצאה' } = req.body;

    if (!name?.trim())
      return next(new AppError('שם קטגוריה הוא שדה חובה', 400));

    const exists = await Category.findOne({ name: name.trim() });
    if (exists)
      return next(new AppError('קטגוריה בשם זה כבר קיימת', 409));

    const newCategory = await Category.create({ name: name.trim(), type });
    return res.status(201).json(newCategory);
  } catch (err) {
    if (err.code === 11000)
      return next(new AppError('קטגוריה בשם זה כבר קיימת', 409));

    return next(new AppError('שגיאה ביצירת קטגוריה חדשה', 500));
  }
};

/*--------------------------------------------------------------------
  PUT /api/categories/:id – עדכון קטגוריה קיימת
--------------------------------------------------------------------*/
export const updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      return next(new AppError('מזהה קטגוריה לא תקין', 400));

    const { name, type } = req.body;
    if (!name?.trim() && !type)
      return next(new AppError('אין נתונים לעדכון', 400));

    const updates = {};
    if (name?.trim()) {
      const dup = await Category.findOne({ name: name.trim(), _id: { $ne: id } });
      if (dup)
        return next(new AppError('קטגוריה בשם זה כבר קיימת', 409));
      updates.name = name.trim();
    }
    if (type) updates.type = type;

    const updated = await Category.findByIdAndUpdate(id, updates, { new: true });
    if (!updated)
      return next(new AppError('קטגוריה לא נמצאה', 404));

    return res.json(updated);
  } catch (err) {
    return next(new AppError('שגיאה בעדכון קטגוריה', 500));
  }
};

/*--------------------------------------------------------------------
  DELETE /api/categories/:id – מחיקת קטגוריה
--------------------------------------------------------------------*/
export const deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      return next(new AppError('מזהה קטגוריה לא תקין', 400));

    const deleted = await Category.findByIdAndDelete(id);
    if (!deleted)
      return next(new AppError('קטגוריה לא נמצאה', 404));

    return res.status(204).send(); //  No Content
  } catch (err) {
    return next(new AppError('שגיאה במחיקת קטגוריה', 500));
  }
};
