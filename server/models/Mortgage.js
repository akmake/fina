// server/models/Mortgage.js
import mongoose from 'mongoose';

// מסלול משכנתא בודד
const trackSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },    // שם המסלול
  type: {
    type: String,
    required: true,
    enum: [
      'prime',                  // פריים
      'fixed_unlinked',        // קבועה לא צמודה
      'fixed_linked',          // קבועה צמודה למדד
      'variable_5y',           // משתנה כל 5 שנים
      'variable_5y_linked',    // משתנה 5 צמודה
      'variable_other',        // משתנה אחר
      'eligibility',           // זכאות (ריבית מסובסדת)
    ],
  },
  originalAmount: { type: Number, required: true },       // סכום מקורי
  currentBalance: { type: Number, required: true },       // יתרה נוכחית
  interestRate: { type: Number, required: true },          // ריבית נוכחית (%)
  linkedToIndex: { type: Boolean, default: false },        // צמוד מדד
  monthlyPayment: { type: Number, required: true },        // החזר חודשי
  termInMonths: { type: Number, required: true },           // תקופה בחודשים
  remainingMonths: { type: Number },                        // חודשים שנותרו
  repaymentType: { type: String, enum: ['שפיצר', 'קרן שווה', 'בלון'], default: 'שפיצר' },
  nextRateChange: { type: Date },                           // תאריך שינוי ריבית הבא (למסלולים משתנים)
}, { _id: true });

const mortgageSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

  // פרטי הנכס
  propertyAddress: { type: String, trim: true },
  propertyValue: { type: Number, default: 0 },              // שווי הנכס
  purchasePrice: { type: Number, default: 0 },              // מחיר רכישה
  purchaseDate: { type: Date },

  // פרטי המשכנתא
  bank: { type: String, trim: true },                        // בנק (לאומי, פועלים, דיסקונט...)
  originalTotalAmount: { type: Number, required: true },      // סכום כולל מקורי
  startDate: { type: Date, required: true },

  // מסלולים
  tracks: [trackSchema],

  // ביטוחים נלווים
  lifeInsuranceCost: { type: Number, default: 0 },            // ביטוח חיים למשכנתא
  structureInsuranceCost: { type: Number, default: 0 },        // ביטוח מבנה

  status: { type: String, enum: ['active', 'completed', 'refinanced'], default: 'active' },
  notes: { type: String, trim: true },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// יתרה כוללת
mortgageSchema.virtual('totalCurrentBalance').get(function () {
  return this.tracks.reduce((sum, t) => sum + (t.currentBalance || 0), 0);
});

// תשלום חודשי כולל
mortgageSchema.virtual('totalMonthlyPayment').get(function () {
  return this.tracks.reduce((sum, t) => sum + (t.monthlyPayment || 0), 0)
    + (this.lifeInsuranceCost || 0) + (this.structureInsuranceCost || 0);
});

// ריבית משוקללת
mortgageSchema.virtual('weightedInterestRate').get(function () {
  const totalBalance = this.totalCurrentBalance;
  if (totalBalance === 0) return 0;
  return this.tracks.reduce((sum, t) => sum + (t.interestRate * t.currentBalance / totalBalance), 0);
});

// LTV (Loan-to-Value)
mortgageSchema.virtual('ltv').get(function () {
  if (!this.propertyValue || this.propertyValue === 0) return 0;
  return (this.totalCurrentBalance / this.propertyValue) * 100;
});

// סה"כ ששולם
mortgageSchema.virtual('totalPaid').get(function () {
  return this.originalTotalAmount - this.totalCurrentBalance;
});

export default mongoose.model('Mortgage', mortgageSchema);
