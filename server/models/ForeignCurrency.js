// server/models/ForeignCurrency.js
import mongoose from 'mongoose';

const foreignCurrencySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

  // פרטי ההחזקה
  name: { type: String, required: true, trim: true },         // "חשבון דולרי בנק הפועלים"
  type: {
    type: String,
    required: true,
    enum: [
      'bank_account',       // חשבון בנק מט"ח
      'cash',               // מזומן מט"ח
      'digital_wallet',     // Wise / PayPal / Payoneer
      'crypto',             // קריפטו
      'other',
    ],
  },

  // מטבע
  currency: {
    type: String,
    required: true,
    enum: ['USD', 'EUR', 'GBP', 'CHF', 'JPY', 'CAD', 'AUD', 'BTC', 'ETH', 'OTHER'],
  },
  currencySymbol: { type: String, trim: true },

  // סכומים
  amountInCurrency: { type: Number, required: true, min: 0 },  // סכום במטבע המקורי
  exchangeRate: { type: Number, default: 0 },                   // שער חליפין אחרון
  amountInILS: { type: Number, default: 0 },                    // שווי ב-₪

  // פרטי חשבון
  institution: { type: String, trim: true },                    // בנק/פלטפורמה
  accountNumber: { type: String, trim: true },

  // עלות רכישה (לחישוב רווח/הפסד)
  purchaseRate: { type: Number, default: 0 },                   // שער רכישה ממוצע
  purchaseDate: { type: Date },

  lastUpdated: { type: Date, default: Date.now },
  status: { type: String, enum: ['active', 'closed'], default: 'active' },
  notes: { type: String, trim: true },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// רווח/הפסד ממטבע
foreignCurrencySchema.virtual('profitLoss').get(function () {
  if (!this.purchaseRate || this.purchaseRate === 0) return 0;
  return this.amountInCurrency * (this.exchangeRate - this.purchaseRate);
});

// אחוז רווח/הפסד
foreignCurrencySchema.virtual('profitLossPercent').get(function () {
  if (!this.purchaseRate || this.purchaseRate === 0) return 0;
  return ((this.exchangeRate - this.purchaseRate) / this.purchaseRate) * 100;
});

foreignCurrencySchema.index({ user: 1, currency: 1 });

export default mongoose.model('ForeignCurrency', foreignCurrencySchema);
