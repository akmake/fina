import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { 
      type: String, 
      required: true 
    },
    email: { 
      type: String, 
      required: true, 
      unique: true,
      lowercase: true,
      trim: true
    },
    // שונה מ-password ל-passwordHash כדי להתאים לקונטרולר
    passwordHash: { 
      type: String, 
      required: true 
    },
    role: { 
      type: String, 
      enum: ['user', 'admin'], 
      default: 'user' 
    },
    // שדות נדרשים לניהול אבטחה ורענון טוקנים
    tokenVersion: { 
      type: Number, 
      default: 0 
    },
    loginAttempts: { 
      type: Number, 
      default: 0 
    },
    lockUntil: { 
      type: Date 
    }
  },
  { timestamps: true }
);

// --- וירטואלים (Virtuals) ---
// מאפשר לקונטרולר לבדוק user.isLocked בלי לשמור את זה במסד
userSchema.virtual('isLocked').get(function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// --- מתודות (Instance Methods) ---

// איפוס ניסיונות התחברות (נקרא אחרי התחברות מוצלחת)
userSchema.methods.resetLoginAttempts = async function () {
  this.loginAttempts = 0;
  this.lockUntil = undefined;
  await this.save();
};

// העלאת מונה ניסיונות ונעילה אם צריך
userSchema.methods.incrementLoginAttempts = async function () {
  // אם החשבון כבר נעול ועדיין לא עבר הזמן, אל תעשה כלום
  if (this.lockUntil && this.lockUntil > Date.now()) {
    return;
  }

  // עדכון המונה
  this.loginAttempts += 1;

  // נעילה אחרי 5 ניסיונות כושלים למשך שעה
  if (this.loginAttempts >= 5) {
    this.lockUntil = Date.now() + 60 * 60 * 1000; // שעה אחת
  }

  await this.save();
};

const User = mongoose.models.User || mongoose.model('User', userSchema);

export default User;