// server/models/Alert.js
import mongoose from 'mongoose';

const alertSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

  // סוג התראה
  type: {
    type: String,
    required: true,
    enum: [
      'budget_warning',         // חריגה מתקציב
      'budget_exceeded',        // עברת את התקציב
      'duplicate_charge',       // חיוב כפול חשוד
      'insurance_renewal',      // חידוש ביטוח מתקרב
      'loan_payment',           // תשלום הלוואה
      'mortgage_rate_change',   // שינוי ריבית משכנתא
      'goal_milestone',         // הגעת לאבן דרך ביעד
      'goal_behind',            // פיגור ביעד
      'deposit_maturity',       // פיקדון מגיע לפדיון
      'recurring_failed',       // הוצאה קבועה נכשלה
      'large_transaction',      // עסקה גדולה חריגה
      'savings_tip',            // טיפ חיסכון
      'pension_update',         // עדכון פנסיוני
      'net_worth_change',       // שינוי משמעותי בשווי נקי
      'general',
    ],
  },

  // תוכן
  title: { type: String, required: true, trim: true },
  message: { type: String, required: true, trim: true },
  icon: { type: String, default: '🔔' },
  severity: { type: String, enum: ['info', 'warning', 'danger', 'success'], default: 'info' },

  // קישור
  actionUrl: { type: String, trim: true },         // לאן לנווט בלחיצה
  actionLabel: { type: String, trim: true },        // טקסט כפתור

  // מטא דאטא
  relatedModel: { type: String, trim: true },       // 'Insurance', 'Budget', 'Loan'...
  relatedId: { type: mongoose.Schema.Types.ObjectId },

  // סטטוס
  isRead: { type: Boolean, default: false },
  isDismissed: { type: Boolean, default: false },
  expiresAt: { type: Date },                        // תוקף ההתראה
}, {
  timestamps: true,
});

alertSchema.index({ user: 1, isRead: 1, isDismissed: 1 });
alertSchema.index({ user: 1, createdAt: -1 });
alertSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });  // TTL - נמחק אוטומטית

export default mongoose.model('Alert', alertSchema);
