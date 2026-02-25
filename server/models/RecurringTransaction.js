// server/models/RecurringTransaction.js
import mongoose from 'mongoose';

const recurringTransactionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  
  // פרטי העסקה
  description: { type: String, required: true, trim: true },
  amount: { type: Number, required: true, min: 0 },
  type: { 
    type: String, 
    enum: ['הוצאה', 'הכנסה'], 
    required: true,
    set: v => (v === 'income' || v === 'הכנסה') ? 'הכנסה' : 'הוצאה'
  },
  category: { type: String, default: 'כללי', trim: true },
  account: { 
    type: String, 
    enum: ['checking', 'cash', 'deposits', 'stocks'],
    default: 'checking',
    set: v => {
      const map = { 'עו"ש': 'checking', 'מזומן': 'cash' };
      return map[v] || v || 'checking';
    }
  },
  
  // תזמון
  frequency: { 
    type: String, 
    enum: ['daily', 'weekly', 'monthly', 'yearly'], 
    default: 'monthly' 
  },
  dayOfMonth: { type: Number, min: 1, max: 31 },          // לחודשי – באיזה יום
  dayOfWeek: { type: Number, min: 0, max: 6 },             // לשבועי – באיזה יום
  
  // תקופה
  startDate: { type: Date, required: true },
  endDate: { type: Date },                                  // null = ללא הגבלה
  
  // סטטוס
  isActive: { type: Boolean, default: true },
  isPaused: { type: Boolean, default: false },
  
  // מעקב
  lastExecuted: { type: Date },
  nextExecution: { type: Date },
  executionCount: { type: Number, default: 0 },
  
  // סיווג מיוחד
  subcategory: { 
    type: String, 
    enum: ['subscription', 'bill', 'salary', 'rent', 'insurance', 'loan_payment', 'savings', 'other'],
    default: 'other'
  },
  
  // שם ספק/שירות
  provider: { type: String, trim: true },
  
  notes: { type: String, maxlength: 500, trim: true },
  
  // התראות
  remindDaysBefore: { type: Number, default: 0, min: 0, max: 30 },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// חישוב עלות שנתית
recurringTransactionSchema.virtual('annualCost').get(function() {
  const multipliers = { daily: 365, weekly: 52, monthly: 12, yearly: 1 };
  return this.amount * (multipliers[this.frequency] || 12);
});

// חישוב עלות חודשית ממוצעת
recurringTransactionSchema.virtual('monthlyCost').get(function() {
  return this.annualCost / 12;
});

recurringTransactionSchema.index({ user: 1, isActive: 1 });
recurringTransactionSchema.index({ user: 1, nextExecution: 1 });
recurringTransactionSchema.index({ user: 1, subcategory: 1 });

export default mongoose.model('RecurringTransaction', recurringTransactionSchema);
