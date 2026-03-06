import mongoose from 'mongoose';

// שמירת תמונות מצב חודשיות של שווי נקי לצורך מעקב מגמה
const netWorthSnapshotSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  // שנה וחודש (ייחודי למשתמש)
  year:  { type: Number, required: true },
  month: { type: Number, required: true }, // 1-12

  // נכסים
  assets: {
    checking:       { type: Number, default: 0 },
    cash:           { type: Number, default: 0 },
    deposits:       { type: Number, default: 0 },
    stocks:         { type: Number, default: 0 },
    funds:          { type: Number, default: 0 },
    pension:        { type: Number, default: 0 },
    realEstate:     { type: Number, default: 0 },
    foreignCurrency:{ type: Number, default: 0 },
    childSavings:   { type: Number, default: 0 },
    total:          { type: Number, default: 0 },
  },
  // התחייבויות
  liabilities: {
    loans:     { type: Number, default: 0 },
    mortgages: { type: Number, default: 0 },
    overdraft: { type: Number, default: 0 },
    total:     { type: Number, default: 0 },
  },
  // שווי נקי
  netWorth: { type: Number, default: 0 },
}, {
  timestamps: true,
});

// ייחודי לשנה+חודש+משתמש
netWorthSnapshotSchema.index({ user: 1, year: 1, month: 1 }, { unique: true });

export default mongoose.model('NetWorthSnapshot', netWorthSnapshotSchema);
