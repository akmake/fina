// server/models/Goal.js
import mongoose from 'mongoose';

const milestoneSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  targetAmount: { type: Number, required: true },
  reachedDate: { type: Date },
  isReached: { type: Boolean, default: false },
}, { _id: true });

const goalSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

  // פרטי היעד
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  icon: { type: String, default: '🎯' },
  color: { type: String, default: '#3b82f6' },

  // סוג
  category: {
    type: String,
    required: true,
    enum: [
      'home_purchase',       // קניית דירה (מקדמה)
      'emergency_fund',      // קרן חירום
      'wedding',             // חתונה
      'vacation',            // חופשה
      'car',                 // רכב
      'education',           // לימודים
      'renovation',          // שיפוץ
      'retirement',          // פרישה
      'debt_payoff',         // סילוק חוב
      'investment',          // השקעה
      'children',            // ילדים (לידה/בר מצווה וכו')
      'other',
    ],
  },

  // סכומים
  targetAmount: { type: Number, required: true, min: 0 },
  currentAmount: { type: Number, default: 0, min: 0 },
  monthlyContribution: { type: Number, default: 0, min: 0 },   // הפקדה חודשית
  
  // מקור מימון מקושר (אופציונלי)
  linkedAccountType: { type: String, enum: ['deposit', 'fund', 'savings', 'manual'], default: 'manual' },
  linkedAccountId: { type: mongoose.Schema.Types.ObjectId },

  // תאריכים
  targetDate: { type: Date },
  startDate: { type: Date, default: Date.now },

  // מיילסטונים
  milestones: [milestoneSchema],

  // עדיפות
  priority: { type: String, enum: ['high', 'medium', 'low'], default: 'medium' },
  status: { type: String, enum: ['active', 'completed', 'paused', 'cancelled'], default: 'active' },

  notes: { type: String, trim: true },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// אחוז התקדמות
goalSchema.virtual('progressPercent').get(function () {
  if (this.targetAmount === 0) return 100;
  return Math.min(100, (this.currentAmount / this.targetAmount) * 100);
});

// כמה חסר
goalSchema.virtual('remaining').get(function () {
  return Math.max(0, this.targetAmount - this.currentAmount);
});

// חודשים עד סיום (בקצב הנוכחי)
goalSchema.virtual('monthsToGoal').get(function () {
  if (this.monthlyContribution <= 0 || this.remaining === 0) return 0;
  return Math.ceil(this.remaining / this.monthlyContribution);
});

// האם בזמן
goalSchema.virtual('isOnTrack').get(function () {
  if (!this.targetDate) return true;
  const monthsLeft = (new Date(this.targetDate) - new Date()) / (1000 * 60 * 60 * 24 * 30.44);
  if (monthsLeft <= 0) return this.remaining === 0;
  const neededMonthlyRate = this.remaining / monthsLeft;
  return this.monthlyContribution >= neededMonthlyRate;
});

goalSchema.index({ user: 1, status: 1 });
goalSchema.index({ user: 1, category: 1 });

export default mongoose.model('Goal', goalSchema);
