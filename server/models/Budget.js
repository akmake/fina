// server/models/Budget.js
import mongoose from 'mongoose';

// פריט תקציב בודד – כל קטגוריה עם סכום מותר
const budgetItemSchema = new mongoose.Schema({
  category: { type: String, required: true, trim: true },
  limit: { type: Number, required: true, min: 0 },       // תקציב מותר לקטגוריה
  spent: { type: Number, default: 0, min: 0 },            // סכום שנוצל (מחושב)
  color: { type: String, default: '#3b82f6' },
}, { _id: true });

const budgetSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  
  // תקופת תקציב
  month: { type: Number, required: true, min: 1, max: 12 },   // 1-12
  year: { type: Number, required: true },
  
  // תקציב כולל
  totalLimit: { type: Number, required: true, min: 0 },       // סה"כ תקציב חודשי
  
  // פריטי תקציב לפי קטגוריה
  items: [budgetItemSchema],
  
  // הגדרות
  alertThreshold: { type: Number, default: 80, min: 0, max: 100 },  // אחוז להתראה
  isActive: { type: Boolean, default: true },
  
  // סיכום (מחושב בכל בקשת נתונים)
  totalSpent: { type: Number, default: 0 },
  
  notes: { type: String, maxlength: 500, trim: true },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// מניעת כפילויות – תקציב אחד לכל חודש/שנה למשתמש
budgetSchema.index({ user: 1, month: 1, year: 1 }, { unique: true });

// וירטואלים
budgetSchema.virtual('percentUsed').get(function() {
  if (this.totalLimit === 0) return 0;
  return Math.round((this.totalSpent / this.totalLimit) * 100);
});

budgetSchema.virtual('remaining').get(function() {
  return this.totalLimit - this.totalSpent;
});

budgetSchema.virtual('isOverBudget').get(function() {
  return this.totalSpent > this.totalLimit;
});

budgetSchema.virtual('isNearLimit').get(function() {
  return this.percentUsed >= this.alertThreshold && !this.isOverBudget;
});

export default mongoose.model('Budget', budgetSchema);
