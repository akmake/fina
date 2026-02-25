// server/models/RealEstate.js
import mongoose from 'mongoose';

const realEstateSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

  // פרטי הנכס
  name: { type: String, required: true, trim: true },          // "דירה בתל אביב"
  address: { type: String, trim: true },
  city: { type: String, trim: true },

  // סוג
  type: {
    type: String,
    required: true,
    enum: [
      'apartment',     // דירה
      'house',         // בית פרטי
      'penthouse',     // פנטהאוז
      'land',          // מגרש
      'commercial',    // מסחרי
      'parking',       // חניה
      'storage',       // מחסן
      'other',
    ],
  },

  // שימוש
  usage: { type: String, enum: ['primary_residence', 'investment', 'vacation', 'commercial'], default: 'primary_residence' },

  // שווי
  purchasePrice: { type: Number, default: 0 },
  purchaseDate: { type: Date },
  currentEstimatedValue: { type: Number, required: true, min: 0 },
  lastAppraisalDate: { type: Date },

  // הכנסה משכירות (לנכס להשקעה)
  monthlyRent: { type: Number, default: 0 },
  tenantName: { type: String, trim: true },
  leaseEndDate: { type: Date },

  // הוצאות שוטפות
  monthlyMaintenance: { type: Number, default: 0 },     // ועד בית
  monthlyArnona: { type: Number, default: 0 },           // ארנונה
  monthlyInsurance: { type: Number, default: 0 },        // ביטוח
  otherMonthlyExpenses: { type: Number, default: 0 },

  // משכנתא מקושרת
  linkedMortgageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Mortgage' },

  // מידות
  sizeInSqm: { type: Number, min: 0 },
  rooms: { type: Number, min: 0 },

  // סטטוס
  status: { type: String, enum: ['owned', 'sold', 'under_construction'], default: 'owned' },
  notes: { type: String, trim: true },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// רווח/הפסד מאז רכישה
realEstateSchema.virtual('appreciation').get(function () {
  if (!this.purchasePrice) return 0;
  return this.currentEstimatedValue - this.purchasePrice;
});

// אחוז עליית ערך
realEstateSchema.virtual('appreciationPercent').get(function () {
  if (!this.purchasePrice || this.purchasePrice === 0) return 0;
  return ((this.currentEstimatedValue - this.purchasePrice) / this.purchasePrice) * 100;
});

// הוצאות חודשיות כוללות
realEstateSchema.virtual('totalMonthlyExpenses').get(function () {
  return (this.monthlyMaintenance || 0) + (this.monthlyArnona || 0) +
    (this.monthlyInsurance || 0) + (this.otherMonthlyExpenses || 0);
});

// תשואה חודשית נטו (לנכס להשקעה)
realEstateSchema.virtual('monthlyNetIncome').get(function () {
  return (this.monthlyRent || 0) - this.totalMonthlyExpenses;
});

// תשואה שנתית (%)
realEstateSchema.virtual('annualYield').get(function () {
  if (!this.currentEstimatedValue || this.currentEstimatedValue === 0) return 0;
  return ((this.monthlyNetIncome * 12) / this.currentEstimatedValue) * 100;
});

realEstateSchema.index({ user: 1, status: 1 });

export default mongoose.model('RealEstate', realEstateSchema);
