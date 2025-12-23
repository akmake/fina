import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
  description: {
    type: String,
    default: '',
  },
  // שדה לשמירת השם המקורי (חשוב למנוע הכללים)
  rawDescription: {
    type: String,
    default: '',
  },
  amount: {
    type: Number,
    required: true,
  },
  type: {
    type: String,
    // התיקון הקריטי: מקבלים גם אנגלית וגם עברית
    enum: ['הוצאה', 'הכנסה', 'expense', 'income'],
    required: true,
    // ממיר אוטומטית לעברית לפני השמירה
    set: (v) => {
      if (v === 'expense') return 'הוצאה';
      if (v === 'income') return 'הכנסה';
      return v;
    }
  },
  category: {
    type: String,
    default: 'כללי',
  },
  account: {
    type: String,
    // מתיר גם שמות חשבונות באנגלית אם יגיעו
    enum: ['checking', 'cash', 'deposits', 'stocks', 'עו"ש', 'מזומן'],
    default: 'checking',
     // ממיר אוטומטית לאנגלית (מפתח פנימי) לפני השמירה
    set: (v) => {
        const map = { 'עו"ש': 'checking', 'מזומן': 'cash' };
        return map[v] || v;
    }
  }
}, {
  timestamps: true,
});

// אינדקס למניעת כפילויות זהות לחלוטין
transactionSchema.index({ user: 1, date: 1, description: 1, amount: 1, type: 1 }, { unique: true });

export default mongoose.model('Transaction', transactionSchema);