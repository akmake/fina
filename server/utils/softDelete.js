import mongoose from 'mongoose';

/**
 * Soft-delete plugin — מוסיף deletedAt ומסנן אוטומטית מסמכים מחוקים
 * מכל שאילתות find / count / aggregate.
 *
 * שימוש:
 *   schema.plugin(softDelete);
 *
 * מחיקה רכה:
 *   await Model.softDeleteOne({ _id, user });   // מחזיר את המסמך או null
 *
 * גישה למסמכים מחוקים (לשחזור / אדמין):
 *   Model.find({...}).withDeleted()
 */
export default function softDelete(schema) {
  schema.add({
    deletedAt: { type: Date, default: null },
  });
  schema.index({ deletedAt: 1 });

  // סינון אוטומטי בכל שאילתות find/count, אלא אם התבקש אחרת
  schema.pre(/^(find|count)/, function (next) {
    if (!this.getOptions().withDeleted) {
      const current = this.getFilter();
      if (!('deletedAt' in current)) {
        this.where({ deletedAt: null });
      }
    }
    next();
  });

  // סינון אוטומטי באגרגציות (דשבורדים, דוחות)
  schema.pre('aggregate', function (next) {
    if (!this.options?.withDeleted) {
      this.pipeline().unshift({ $match: { deletedAt: null } });
    }
    next();
  });

  schema.query.withDeleted = function () {
    return this.setOptions({ withDeleted: true });
  };

  // מחיקה רכה של מסמך יחיד לפי פילטר — מחזיר את המסמך המעודכן או null
  schema.statics.softDeleteOne = function (filter) {
    return this.findOneAndUpdate(filter, { deletedAt: new Date() }, { new: true });
  };

  // מחיקה רכה מרובה
  schema.statics.softDeleteMany = function (filter) {
    return this.updateMany(filter, { deletedAt: new Date() });
  };

  // שחזור
  schema.statics.restoreOne = function (filter) {
    return this.findOneAndUpdate(filter, { deletedAt: null }, { new: true, withDeleted: true });
  };
}
