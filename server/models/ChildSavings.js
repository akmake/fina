// server/models/ChildSavings.js
import mongoose from 'mongoose';

const childSavingsSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

  // פרטי הילד
  childName: { type: String, required: true, trim: true },
  childBirthDate: { type: Date },
  childIdLast4: { type: String, trim: true },               // 4 ספרות אחרונות ת.ז.

  // סוג חיסכון
  type: {
    type: String,
    required: true,
    enum: [
      'government',           // חיסכון לכל ילד (ממשלתי)
      'provident_fund',       // קופת גמל להשקעה
      'bank_savings',         // תוכנית חיסכון בנקאית
      'investment_account',   // חשבון השקעות
      'education_fund',       // קרן להשכלה גבוהה
      'other',
    ],
  },

  // פרטי החיסכון
  name: { type: String, required: true, trim: true },        // שם התוכנית
  institution: { type: String, trim: true },                  // מוסד (בנק/חברה)
  track: { type: String, trim: true },                        // מסלול השקעה (ריסק גבוה/נמוך/מניות)
  accountNumber: { type: String, trim: true },

  // סכומים
  currentBalance: { type: Number, default: 0, min: 0 },
  monthlyDeposit: { type: Number, default: 0, min: 0 },       // הפקדה חודשית
  totalDeposited: { type: Number, default: 0, min: 0 },

  // תשואה
  lastYearReturn: { type: Number, default: 0 },               // תשואה שנתית (%)
  totalReturn: { type: Number, default: 0 },                   // תשואה מצטברת (%)

  // תאריכים
  startDate: { type: Date, required: true },
  maturityDate: { type: Date },                                // תאריך פדיון

  // עבור חיסכון ממשלתי
  governmentDeposit: { type: Number, default: 0 },             // הפקדה ממשלתית חודשית (₪50)
  parentDeposit: { type: Number, default: 0 },                 // הפקדת הורים חודשית

  status: { type: String, enum: ['active', 'frozen', 'redeemed'], default: 'active' },
  notes: { type: String, trim: true },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// רווח/הפסד
childSavingsSchema.virtual('profitLoss').get(function () {
  return this.currentBalance - this.totalDeposited;
});

// גיל הילד
childSavingsSchema.virtual('childAge').get(function () {
  if (!this.childBirthDate) return null;
  const diff = new Date() - new Date(this.childBirthDate);
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
});

childSavingsSchema.index({ user: 1, childName: 1 });

export default mongoose.model('ChildSavings', childSavingsSchema);
