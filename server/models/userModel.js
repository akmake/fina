import mongoose from 'mongoose';

const MAX_FAILED = 5;       // נעילה אחרי 5 כשלונות
const LOCK_MS    = 10 * 60 * 1000; // 10 דקות

const cartItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    default: 1,
  },
}, { _id: false });

const userSchema = new mongoose.Schema(
  {
    // 👇 --- הוספנו את השדה הזה כדי להתאים לקונטרולר --- 👇
    name: {
      type: String,
      required: [true, 'שם חובה'],
      trim: true,
    },
    // 👆 --- עד כאן --- 👆

    email: {
      type: String,
      required: [true, 'אימייל חובה'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'פורמט אימייל לא תקין'],
    },
    passwordHash: {
      type: String,
      required: [true, 'סיסמה חובה'],
      minlength: 60,
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    cart: {
      type: [cartItemSchema],
      default: [],
    },
    twoFactorEnabled: { type: Boolean, default: false },
    totpSecret: { type: String, default: '' },
    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },
    tokenVersion: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

userSchema.virtual('isLocked').get(function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

userSchema.methods.incrementLoginAttempts = function () {
  if (this.isLocked) return;
  const updates = { $inc: { failedLoginAttempts: 1 } };
  if (this.failedLoginAttempts + 1 >= MAX_FAILED) {
    updates.$set = { lockUntil: Date.now() + LOCK_MS };
  }
  return this.updateOne(updates);
};

userSchema.methods.resetLoginAttempts = function () {
  if (this.failedLoginAttempts || this.lockUntil) {
    return this.updateOne({ failedLoginAttempts: 0, lockUntil: null });
  }
};

export default mongoose.models.User || mongoose.model('User', userSchema);