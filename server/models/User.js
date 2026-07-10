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
    googleId: {
      type: String,
      unique: true,
      sparse: true // Ensures uniqueness only for documents that have this field
    },
    avatar: {
      type: String
    },
    // שונה מ-password ל-passwordHash כדי להתאים לקונטרולר
    passwordHash: { 
      type: String, 
      required: function() { return !this.googleId; } // Required only if not a Google user
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
    },
    familyGroup: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FamilyGroup',
      default: null,
    },
    // v2 tenancy: the household whose data the user is currently acting within.
    // A user may belong to several households (via HouseholdMember); this points
    // at the "active" one used for scoping. `role` above is the system-level role.
    activeHousehold: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Household',
      default: null,
    },

    // ── Phase 4 (SaaS Shell) ──────────────────────────────────────────────
    // Email verification (§ onboarding). Google-OAuth users are created verified.
    emailVerified: { type: Boolean, default: false },
    emailVerifiedAt: { type: Date, default: null },
    // Only the SHA-256 HASH of the token is stored; the raw token is emailed once.
    emailVerificationTokenHash: { type: String, select: false, default: null },
    emailVerificationExpires: { type: Date, select: false, default: null },

    // Onboarding: null until the user finishes the first-run flow.
    onboardedAt: { type: Date, default: null },

    // Two-factor auth (TOTP). Secrets/recovery codes are select:false + hashed.
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: { type: String, select: false, default: null },          // active base32 secret
    twoFactorPendingSecret: { type: String, select: false, default: null },   // during setup, before confirm
    twoFactorRecoveryHashes: { type: [String], select: false, default: [] },  // SHA-256 of one-time codes

    // Account lifecycle: set when the user self-deletes (anonymize-in-place).
    deletedAt: { type: Date, default: null },
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

// --- Indexes ---
// email index is automatically created by "unique: true" in schema
userSchema.index({ role: 1 }); // For filtering by role
userSchema.index({ createdAt: -1 }); // For sorting by creation date
userSchema.index({ lockUntil: 1 }, { sparse: true }); // Sparse index for locked accounts

const User = mongoose.models.User || mongoose.model('User', userSchema);

export default User;