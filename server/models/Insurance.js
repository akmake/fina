// server/models/Insurance.js
import mongoose from 'mongoose';

const insuranceSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

  // סוג ביטוח
  type: {
    type: String,
    required: true,
    enum: [
      'health',             // ביטוח בריאות משלים
      'life',               // ביטוח חיים
      'disability',         // אובדן כושר עבודה
      'car_mandatory',      // ביטוח רכב חובה
      'car_comprehensive',  // ביטוח רכב מקיף
      'home_structure',     // ביטוח מבנה
      'home_contents',      // ביטוח תכולה
      'travel',             // ביטוח נסיעות לחו"ל
      'dental',             // ביטוח שיניים
      'umbrella',           // ביטוח מטריה (צד ג׳)
      'business',           // ביטוח עסקי
      'other',
    ],
  },

  // פרטי הפוליסה
  name: { type: String, required: true, trim: true },
  company: { type: String, trim: true },                // חברת ביטוח (מגדל, הראל, הפניקס...)
  policyNumber: { type: String, trim: true },
  agentName: { type: String, trim: true },               // שם סוכן
  agentPhone: { type: String, trim: true },

  // עלות
  monthlyCost: { type: Number, required: true, min: 0 },
  paymentFrequency: { type: String, enum: ['monthly', 'quarterly', 'semi_annual', 'annual'], default: 'monthly' },
  deductible: { type: Number, default: 0, min: 0 },      // השתתפות עצמית

  // כיסוי
  coverageAmount: { type: Number, default: 0 },           // סכום כיסוי
  coverageDetails: { type: String, trim: true },           // פירוט כיסוי

  // תאריכים
  startDate: { type: Date, required: true },
  endDate: { type: Date },                                 // תאריך חידוש/סיום
  renewalDate: { type: Date },                             // תאריך חידוש קרוב

  // סטטוס
  status: { type: String, enum: ['active', 'expired', 'cancelled', 'pending'], default: 'active' },
  autoRenew: { type: Boolean, default: true },

  notes: { type: String, trim: true },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// עלות שנתית
insuranceSchema.virtual('annualCost').get(function () {
  const freq = { monthly: 12, quarterly: 4, semi_annual: 2, annual: 1 };
  return this.monthlyCost * (freq[this.paymentFrequency] || 12);
});

// האם קרוב חידוש (30 יום)
insuranceSchema.virtual('isRenewalSoon').get(function () {
  if (!this.renewalDate) return false;
  const diff = (new Date(this.renewalDate) - new Date()) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= 30;
});

insuranceSchema.index({ user: 1, type: 1 });
insuranceSchema.index({ user: 1, status: 1 });

export default mongoose.model('Insurance', insuranceSchema);
