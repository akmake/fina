import mongoose from 'mongoose';

const MaaserSettingsSchema = new mongoose.Schema({
  user:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  percentage:         { type: Number, enum: [10, 20], default: 10 },
  startDate:          { type: Date, default: null },
  donationCategories: { type: [String], default: ['צדקה', 'תרומה', 'מעשר', 'חומש'] },
  // קטגוריות הכנסה שחייבות במעשרות (null = לא הוגדר עדיין)
  incomeCategories:   { type: [String], default: ['משכורת'] },
}, { timestamps: true });

export default mongoose.model('MaaserSettings', MaaserSettingsSchema);
